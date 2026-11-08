import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  DEFAULT_MANAGER, buildCommand, createInvocation, detectVersion, isSupportedVersion, managerInvocation, resolveBunExecutable,
  resolveNpmEntry, selectManager,
} from './package-manager.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('yönetici seçimi: açık istek > QUIZMASTER_PM > varsayılan; geçersiz değer reddedilir', () => {
  assert.equal(DEFAULT_MANAGER, 'pnpm');
  assert.equal(selectManager({ env: {} }), 'pnpm');
  assert.equal(selectManager({ env: { QUIZMASTER_PM: 'npm' } }), 'npm');
  assert.equal(selectManager({ requested: 'BUN', env: { QUIZMASTER_PM: 'npm' } }), 'bun');
  assert.throws(() => selectManager({ requested: 'yarn' }), /Desteklenmeyen/);
});

test('install komutları: donmuş kurulum ve geliştirme bağımlılıkları her yöneticide', () => {
  assert.deepEqual(buildCommand('npm', { type: 'install' }).args, ['ci', '--include=dev']);
  assert.deepEqual(buildCommand('pnpm', { type: 'install' }).args, ['install', '--frozen-lockfile', '--prod=false']);
  assert.deepEqual(buildCommand('bun', { type: 'install' }).args, ['install', '--frozen-lockfile']);
  assert.deepEqual(buildCommand('npm', { type: 'install', frozen: false, dev: false }).args, ['install', '--omit=dev']);
  assert.deepEqual(buildCommand('bun', { type: 'install', dev: false }).args, ['install', '--frozen-lockfile', '--production']);
});

test('run komutları: çalışma alanı ve argümanlar yöneticiye göre eşlenir', () => {
  const op = { type: 'run', workspace: 'server', script: 'db:deploy', args: ['--flag', 'a b'] };
  assert.deepEqual(buildCommand('npm', op).args, ['run', 'db:deploy', '--workspace=server', '--', '--flag', 'a b']);
  assert.deepEqual(buildCommand('pnpm', op).args, ['--filter', 'quiz-master-server', 'run', 'db:deploy', '--flag', 'a b']);
  assert.deepEqual(buildCommand('bun', op), { args: ['run', 'db:deploy', '--flag', 'a b'], cwd: 'server' });
  assert.deepEqual(buildCommand('npm', { type: 'run', script: 'build' }).args, ['run', 'build']);
  assert.deepEqual(buildCommand('pnpm', { type: 'run', script: 'build' }).args, ['run', 'build']);
});

test('exec komutları ve hatalı girdiler', () => {
  const op = { type: 'exec', workspace: 'server', bin: 'tsc', args: ['--noEmit'] };
  assert.throws(() => buildCommand('npm', op), /npm için exec güvenli değildir/, 'npm exec kayıt defterinden paket indirebilir');
  assert.deepEqual(buildCommand('pnpm', op).args, ['--filter', 'quiz-master-server', 'exec', 'tsc', '--noEmit']);
  assert.deepEqual(buildCommand('bun', op), { args: ['x', '--no-install', 'tsc', '--noEmit'], cwd: 'server' });
  assert.throws(() => buildCommand('npm', { type: 'run' }), /script/);
  assert.throws(() => buildCommand('npm', { type: 'exec' }), /bin/);
  assert.throws(() => buildCommand('npm', { type: 'run', script: 'x', workspace: 'yok' }), /Bilinmeyen çalışma alanı/);
  assert.throws(() => buildCommand('npm', { type: 'bilinmeyen' }), /Bilinmeyen işlem/);
  assert.throws(() => buildCommand('yarn', { type: 'install' }), /Desteklenmeyen/);
});

test('kabuk metakarakterli argümanlar olduğu gibi kalır (kabuk yok)', () => {
  const tricky = 'F:\\quiz&master;rm -rf $HOME "x"';
  for (const manager of ['npm', 'pnpm', 'bun']) {
    const built = buildCommand(manager, { type: 'run', script: 'upgrade', args: ['--project', tricky] });
    assert.ok(built.args.includes(tricky), `${manager}: argüman bozuldu`);
  }
});

test('npm giriş dosyası Node dizininden ve PATH’ten çözülür; yoksa Windows güvenle hata verir', () => {
  const present = new Set([path.resolve('C:\\node\\node_modules\\npm\\bin\\npm-cli.js')]);
  const exists = file => present.has(path.resolve(file));
  const entry = resolveNpmEntry({ platform: 'win32', env: { PATH: '' }, execPath: 'C:\\node\\node.exe', exists });
  assert.equal(entry, path.resolve('C:\\node\\node_modules\\npm\\bin\\npm-cli.js'));
  const prefix = managerInvocation('npm', { platform: 'win32', env: { PATH: '' }, execPath: 'C:\\node\\node.exe', exists });
  assert.deepEqual(prefix, { command: 'C:\\node\\node.exe', args: [entry] });
  assert.throws(() => managerInvocation('npm', { platform: 'win32', env: { PATH: '' }, execPath: 'C:\\yok\\node.exe', exists: () => false }), /npm-cli\.js/);
  assert.deepEqual(managerInvocation('npm', { platform: 'linux', env: { PATH: '' }, execPath: '/yok/node', exists: () => false }), { command: 'npm', args: [] });
});

test('npm_execpath yalnız npm-cli.js ise kullanılır (Bun/pnpm yolu npm sayılmaz)', () => {
  const exists = () => true;
  assert.equal(resolveNpmEntry({ platform: 'linux', env: { npm_execpath: '/usr/lib/node_modules/npm/bin/npm-cli.js', PATH: '' }, exists }), '/usr/lib/node_modules/npm/bin/npm-cli.js');
  const bunLike = resolveNpmEntry({ platform: 'linux', env: { npm_execpath: '/home/u/.bun/bin/bun', PATH: '' }, execPath: '/yok/node', exists: file => file === '/home/u/.bun/bin/bun' });
  assert.equal(bunLike, null, 'Bun yolu npm giriş dosyası sayılmamalı');
});

test('Bun yürütülebilir dosyası PATH ve ~/.bun/bin içinde aranır; yoksa net hata', () => {
  const exists = file => file === path.join('/opt/bin', 'bun');
  assert.equal(resolveBunExecutable({ platform: 'linux', env: { PATH: '/opt/bin' }, exists, home: '/h' }), path.join('/opt/bin', 'bun'));
  const home = resolveBunExecutable({ platform: 'win32', env: { PATH: '' }, exists: file => file === path.join('C:\\Users\\u', '.bun', 'bin', 'bun.exe'), home: 'C:\\Users\\u' });
  assert.equal(home, path.join('C:\\Users\\u', '.bun', 'bin', 'bun.exe'));
  assert.throws(() => managerInvocation('bun', { platform: 'linux', env: { PATH: '' }, exists: () => false, home: '/h' }), /Bun bulunamadı/);
});

test('createInvocation: seçilen yönetici alt sürece açıkça iletilir; çalışma alanı cwd çözülür', () => {
  const invocation = createInvocation('bun', { type: 'run', workspace: 'server', script: 'setup' }, {
    root: path.resolve('/proje'), env: { PATH: '/opt/bin' }, platform: 'linux', exists: file => file === path.join('/opt/bin', 'bun'), home: '/h',
  });
  assert.equal(invocation.env.QUIZMASTER_PM, 'bun');
  assert.equal(invocation.cwd, path.join(path.resolve('/proje'), 'server'));
  assert.deepEqual(invocation.args, ['run', 'setup']);
});

test('sürüm desteği: npm ≥ 11, pnpm tam 9.15.1, Bun ≥ 1', () => {
  assert.equal(isSupportedVersion('npm', '11.11.1'), true);
  assert.equal(isSupportedVersion('npm', '10.9.2'), false);
  assert.equal(isSupportedVersion('pnpm', '9.15.1'), true);
  assert.equal(isSupportedVersion('pnpm', '9.15.0'), false);
  assert.equal(isSupportedVersion('bun', '1.3.14'), true);
  assert.equal(isSupportedVersion('bun', null), false);
});

test('sürüm algılama: başarısız komut ve anlamsız çıktı null döner', () => {
  const opts = { platform: 'linux', env: { PATH: '' }, run: () => ({ status: 0, stdout: 'merhaba\n' }) };
  assert.equal(detectVersion('npm', opts), null);
  assert.equal(detectVersion('npm', { ...opts, run: () => ({ status: 1, stdout: '' }) }), null);
  assert.equal(detectVersion('npm', { ...opts, run: () => ({ status: 0, stdout: '11.11.1\n' }) }), '11.11.1');
  assert.equal(detectVersion('bun', { ...opts, exists: () => false }), null, 'Bun yoksa istisna yerine null');
});

// Gerçek yöneticilerle: komutların gerçekten çalıştığını kanıtlar. Yönetici veya bağımlılık yoksa atlanır.
// 'run' ile server/package.json içindeki "type-check" betiği kullanılır (tsc --noEmit --version → sürüm yazdırır).
for (const manager of ['npm', 'pnpm', 'bun']) {
  const version = detectVersion(manager);
  const ready = version && fs.existsSync(path.join(root, 'server', 'node_modules', '.bin'));
  test(`gerçek ${manager}: çalışma alanı betiği çalışır`, { skip: ready ? false : `${manager} veya bağımlılıklar yok` }, () => {
    const invocation = createInvocation(manager, { type: 'run', workspace: 'server', script: 'type-check', args: ['--version'] }, { root });
    const result = spawnSync(invocation.command, invocation.args, { cwd: invocation.cwd, env: invocation.env, encoding: 'utf8', windowsHide: true, shell: false, timeout: 120000 });
    assert.equal(result.status, 0, `${manager} hata verdi: ${result.stderr}`);
    assert.match(`${result.stdout}`, /Version 5./);
  });
}
