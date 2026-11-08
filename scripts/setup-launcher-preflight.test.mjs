// Kurulum başlatıcılarının (kurulum.bat / kurulum.sh) ön kontrol davranışı.
// Kontrollü fixture kullanır: gerçek paket kurulumu, gerçek port taraması veya ağ yoktur.
// Kabul kuralı: Node 22/24 + (npm >= 11 veya pnpm 9.15.1 veya Bun) — biri yeterlidir.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const sh = process.env.HYBRID_SH || (isWindows ? 'C:\\Program Files\\Git\\bin\\sh.exe' : '/bin/sh');
const PACKAGE_MANAGERS = ['pnpm', 'pnpm.cmd', 'pnpm.exe', 'npm', 'npm.cmd', 'corepack', 'corepack.cmd', 'bun', 'bun.exe'];

function launcherEnv(bin) {
  const original = Object.entries(process.env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] || '';
  // npm/pnpm/corepack/bun içeren dizinleri çıkar; gerçek bir paket yöneticisi sızmasın.
  const kept = original.split(path.delimiter).filter(Boolean)
    .filter(directory => !PACKAGE_MANAGERS.some(name => fs.existsSync(path.join(directory, name))));
  const env = { ...process.env, SETUP_BOOTSTRAP_PORT: '5849' };
  for (const key of Object.keys(env)) if (key.toUpperCase() === 'PATH') delete env[key];
  env.PATH = [bin, ...kept].join(path.delimiter);
  env.LAUNCHER_TEST_NODE = process.execPath.replaceAll('\\', '/');
  return env;
}

function makeFixture(t, entry) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'quizmaster-launcher-preflight-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(os.tmpdir()));
    fs.chmodSync(fixture, 0o755);
    fs.rmSync(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const bin = path.join(fixture, 'bin');
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(fixture, 'scripts'));
  fs.writeFileSync(path.join(fixture, 'package.json'), '{"name":"quiz-master"}\n');
  fs.writeFileSync(path.join(fixture, 'scripts/find-port-holder.mjs'), 'process.exit(1);\n');
  // Sahte bootstrap: çalıştığını bir işaret dosyasıyla kanıtlar.
  fs.writeFileSync(path.join(fixture, 'scripts/setup-bootstrap.mjs'), "import fs from 'node:fs';fs.writeFileSync('bootstrap-ran.txt','evet');\n");
  fs.copyFileSync(path.join(repository, `kurulum.${entry}`), path.join(fixture, `kurulum.${entry}`));
  // Gerçek Node'u paket yöneticisi olmadan görünür kıl.
  fs.writeFileSync(path.join(bin, 'node.cmd'), '@echo off\r\n"%LAUNCHER_TEST_NODE%" %*\r\nexit /b %errorlevel%\r\n');
  fs.writeFileSync(path.join(bin, 'node'), '#!/bin/sh\nexec "$LAUNCHER_TEST_NODE" "$@"\n', { mode: 0o755 });
  return { fixture, bin };
}

/** Yalnızca `--version` yanıtlayan sahte paket yöneticisi. */
function addManager(bin, name, version) {
  fs.writeFileSync(path.join(bin, `${name}.cmd`), `@echo off\r\necho ${version}\r\n`);
  fs.writeFileSync(path.join(bin, name), `#!/bin/sh\necho ${version}\n`, { mode: 0o755 });
}

function run(entry, fixture, env) {
  return entry === 'bat'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', '.\\kurulum.bat'], { cwd: fixture, env, windowsHide: true, timeout: 30000, input: 'H\r\n\r\n', encoding: 'latin1' })
    : spawnSync(sh, ['kurulum.sh'], { cwd: fixture, env, windowsHide: true, timeout: 30000, encoding: 'utf8' });
}

for (const entry of isWindows ? ['bat', 'sh'] : ['sh']) {
  const prepare = t => {
    assert(entry !== 'sh' || fs.existsSync(sh), 'Gerçek sh bulunamadı; sahte kabuk kullanılmaz (HYBRID_SH ayarlayın)');
    return makeFixture(t, entry);
  };
  const outputOf = result => `${result.stdout}${result.stderr}`;
  const bootstrapRan = fixture => fs.existsSync(path.join(fixture, 'bootstrap-ran.txt'));

  test(`${entry} launcher: hiç paket yöneticisi yoksa kurulum başlamaz ve npm/corepack olmayan sistem için çıkmaz yol göstermez`, { timeout: 60000 }, t => {
    const { fixture, bin } = prepare(t);
    const result = run(entry, fixture, launcherEnv(bin));
    assert.equal(result.error, undefined, 'Başlatıcı çalıştırılamadı');
    assert.notEqual(result.status, 0, 'Paket yöneticisi yokken başlatıcı başarıyla bitmemeli');
    const output = outputOf(result);
    assert.match(output, /Desteklenen paket y.neticisi bulunamad/, 'Eksik paket yöneticisi bildirilmedi');
    assert.match(output, /npm ve corepack yok/, 'npm/corepack olmayan Node için yönlendirme yok');
    assert.doesNotMatch(output, /npm install --global npm@11/, 'npm yokken npm komutu önerilmemeli');
    assert.equal(bootstrapRan(fixture), false, 'Ön kontrol başarısızken bootstrap açılmamalı');
    assert.equal(fs.existsSync(path.join(fixture, 'server')), false, 'Ön kontrol kurulum verisi/dizini oluşturmamalı');
  });

  test(`${entry} launcher: npm 10 (Node 22 ile gelen) reddedilir ve npm 11 yükseltme komutu gösterilir`, { timeout: 60000 }, t => {
    const { fixture, bin } = prepare(t);
    addManager(bin, 'npm', '10.9.2');
    const result = run(entry, fixture, launcherEnv(bin));
    assert.notEqual(result.status, 0);
    const output = outputOf(result);
    assert.match(output, /npm 10\.9\.2 bulundu/);
    assert.match(output, /npm install --global npm@11/, 'npm 11 yükseltme komutu gösterilmeli');
    assert.equal(bootstrapRan(fixture), false);
  });

  test(`${entry} launcher: npm 11 yeterlidir; bootstrap doğrudan Node ile açılır`, { timeout: 60000 }, t => {
    const { fixture, bin } = prepare(t);
    addManager(bin, 'npm', '11.1.0');
    const result = run(entry, fixture, launcherEnv(bin));
    assert.equal(result.status, 0, outputOf(result));
    assert.match(outputOf(result), /\[TAMAM\] npm 11\.1\.0/);
    assert.equal(bootstrapRan(fixture), true, 'Bootstrap çalışmadı');
  });

  test(`${entry} launcher: yalnız pnpm 9.15.1 de yeterlidir (npm yok)`, { timeout: 60000 }, t => {
    const { fixture, bin } = prepare(t);
    addManager(bin, 'pnpm', '9.15.1');
    const result = run(entry, fixture, launcherEnv(bin));
    assert.equal(result.status, 0, outputOf(result));
    assert.match(outputOf(result), /\[TAMAM\] pnpm 9\.15\.1/);
    assert.equal(bootstrapRan(fixture), true);
  });

  test(`${entry} launcher: desteklenmeyen pnpm sürümü tek başına yetmez ama yok sayıldığı bildirilir`, { timeout: 60000 }, t => {
    const { fixture, bin } = prepare(t);
    addManager(bin, 'pnpm', '9.14.0');
    const result = run(entry, fixture, launcherEnv(bin));
    assert.notEqual(result.status, 0);
    assert.match(outputOf(result), /pnpm 9\.14\.0 bulundu/);
    assert.equal(bootstrapRan(fixture), false);
  });

  test(`${entry} launcher: desteklenmeyen pnpm, destekli npm 11 varken engel olmaz`, { timeout: 60000 }, t => {
    const { fixture, bin } = prepare(t);
    addManager(bin, 'npm', '11.2.0');
    addManager(bin, 'pnpm', '8.0.0');
    const result = run(entry, fixture, launcherEnv(bin));
    assert.equal(result.status, 0, outputOf(result));
    assert.equal(bootstrapRan(fixture), true);
  });
}

test('sh launcher: server/data yazılamıyorsa net hata verir ve veriye dokunmaz', { timeout: 60000, skip: isWindows || (process.getuid && process.getuid() === 0) }, t => {
  const { fixture, bin } = makeFixture(t, 'sh');
  const dataDirectory = path.join(fixture, 'server', 'data');
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.chmodSync(dataDirectory, 0o555);
  addManager(bin, 'npm', '11.0.0');
  let result;
  try {
    result = run('sh', fixture, launcherEnv(bin));
  } finally {
    // Fixture temizliği (makeFixture'ın t.after kancası) bu testin kancalarından önce
    // çalışabildiği için izin burada, test gövdesinde geri alınır.
    fs.chmodSync(dataDirectory, 0o755);
  }
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /Yazma izni yok/);
});

test('kurulum.sh ve scripts/*.sh git dizininde çalıştırılabilir (100755) olarak kayıtlı', t => {
  const listed = spawnSync('git', ['ls-files', '-s', 'kurulum.sh', 'scripts/prepare-linux-closure.sh'], { cwd: repository, encoding: 'utf8' });
  if (listed.error || listed.status !== 0 || !listed.stdout.trim()) return t.skip('git dizini bulunamadı');
  for (const line of listed.stdout.trim().split(/\r?\n/)) {
    assert.match(line, /^100755 /, `Linux'ta ./kurulum.sh çalışmaz (çalıştırma biti yok): ${line}`);
  }
});

test('kurulum.sh geçerli UTF-8, LF satır sonlu ve BOM\'suzdur', () => {
  const bytes = fs.readFileSync(path.join(repository, 'kurulum.sh'));
  assert.doesNotThrow(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  assert.equal(bytes.includes(13), false, 'CRLF içeriyor; Linux shebang satırı bozulur');
  assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'BOM içeriyor');
  assert.equal(bytes.subarray(0, 2).toString(), '#!');
});

test('kurulum.bat CP1254 kodlu, yalnız CRLF satır sonlu ve BOM\'suzdur', () => {
  const bytes = fs.readFileSync(path.join(repository, 'kurulum.bat'));
  const text = bytes.toString('latin1');
  assert.equal(/[^\r]\n/.test(text), false, 'Yalnız LF satır sonu içeriyor; cmd etiketleri bozulabilir');
  assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 BOM içeriyor');
  assert.match(text, /chcp 1254/);
});
