// Kurulum başlatıcılarının (kurulum.bat / kurulum.sh) ön kontrol davranışı.
// Kontrollü fixture kullanır: gerçek paket kurulumu, gerçek port taraması veya ağ yoktur.
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
  // pnpm/npm/corepack/bun içeren dizinleri çıkar; gerçek bir paket yöneticisi sızmasın.
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
  fs.copyFileSync(path.join(repository, `kurulum.${entry}`), path.join(fixture, `kurulum.${entry}`));
  // Gerçek Node'u pnpm/npm olmadan görünür kıl.
  fs.writeFileSync(path.join(bin, 'node.cmd'), '@echo off\r\n"%LAUNCHER_TEST_NODE%" %*\r\nexit /b %errorlevel%\r\n');
  fs.writeFileSync(path.join(bin, 'node'), '#!/bin/sh\nexec "$LAUNCHER_TEST_NODE" "$@"\n', { mode: 0o755 });
  return { fixture, bin };
}

function run(entry, fixture, env) {
  return entry === 'bat'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', '.\\kurulum.bat'], { cwd: fixture, env, windowsHide: true, timeout: 30000, input: 'H\r\n\r\n', encoding: 'latin1' })
    : spawnSync(sh, ['kurulum.sh'], { cwd: fixture, env, windowsHide: true, timeout: 30000, encoding: 'utf8' });
}

for (const entry of isWindows ? ['bat', 'sh'] : ['sh']) {
  test(`${entry} launcher: pnpm yoksa kurulum başlamaz ve npm/corepack olmayan sistem için çıkmaz yol göstermez`, { timeout: 60000 }, t => {
    assert(entry !== 'sh' || fs.existsSync(sh), 'Gerçek sh bulunamadı; sahte kabuk kullanılmaz (HYBRID_SH ayarlayın)');
    const { fixture, bin } = makeFixture(t, entry);
    const result = run(entry, fixture, launcherEnv(bin));
    assert.equal(result.error, undefined, 'Başlatıcı çalıştırılamadı');
    assert.notEqual(result.status, 0, 'pnpm yokken başlatıcı başarıyla bitmemeli');
    const output = `${result.stdout}${result.stderr}`;
    assert.match(output, /pnpm bulunamad/, 'Eksik pnpm bildirilmedi');
    assert.match(output, /npm ve corepack yok/, 'npm/corepack olmayan Node için yönlendirme yok');
    assert.doesNotMatch(output, /npm install --global pnpm@9\.15\.1\r?\n.*npm ve corepack yok/s, 'npm yokken npm komutu önerilmemeli');
    assert.equal(fs.existsSync(path.join(fixture, 'server')), false, 'Ön kontrol kurulum verisi/dizini oluşturmamalı');
  });
}

test('sh launcher: server/data yazılamıyorsa net hata verir ve veriye dokunmaz', { timeout: 60000, skip: isWindows || (process.getuid && process.getuid() === 0) }, t => {
  const { fixture, bin } = makeFixture(t, 'sh');
  const dataDirectory = path.join(fixture, 'server', 'data');
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.chmodSync(dataDirectory, 0o555);
  fs.writeFileSync(path.join(bin, 'pnpm'), '#!/bin/sh\necho 9.15.1\n', { mode: 0o755 });
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
