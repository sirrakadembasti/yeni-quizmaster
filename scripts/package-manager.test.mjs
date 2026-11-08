import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  DEFAULT_MANAGER, buildCommand, detectInvokingManager, createInvocation, detectVersion, isSupportedVersion, managerInvocation, resolveBunExecutable,
  resolveNpmEntry, selectManager, detectInstalledManager, hasLegacyPnpmTree, resolveLocalBin,
} from './package-manager.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('yönetici seçimi: açık istek > QUIZMASTER_PM > varsayılan; geçersiz değer reddedilir', () => {
  assert.equal(DEFAULT_MANAGER, 'npm');
  assert.equal(selectManager({ env: {} }), 'npm');
  assert.throws(() => selectManager({ env: { QUIZMASTER_PM: 'pnpm' } }), /pnpm artık desteklenmiyor/);
  assert.throws(() => selectManager({ requested: 'pnpm' }), /pnpm artık desteklenmiyor/);
  assert.equal(selectManager({ requested: 'BUN', env: { QUIZMASTER_PM: 'npm' } }), 'bun');
  assert.throws(() => selectManager({ requested: 'yarn' }), /Desteklenmeyen/);
});

test('install komutları: donmuş kurulum ve geliştirme bağımlılıkları her yöneticide', () => {
  assert.deepEqual(buildCommand('npm', { type: 'install' }).args, ['ci', '--include=dev']);
  assert.deepEqual(buildCommand('bun', { type: 'install' }).args, ['install', '--frozen-lockfile']);
  assert.deepEqual(buildCommand('npm', { type: 'install', frozen: false, dev: false }).args, ['install', '--omit=dev']);
  assert.deepEqual(buildCommand('bun', { type: 'install', dev: false }).args, ['install', '--frozen-lockfile', '--production']);
});

test('run komutları: çalışma alanı ve argümanlar yöneticiye göre eşlenir', () => {
  const op = { type: 'run', workspace: 'server', script: 'db:deploy', args: ['--flag', 'a b'] };
  assert.deepEqual(buildCommand('npm', op).args, ['run', 'db:deploy', '--workspace=server', '--', '--flag', 'a b']);
  assert.deepEqual(buildCommand('bun', op), { args: ['run', 'db:deploy', '--flag', 'a b'], cwd: 'server' });
  assert.deepEqual(buildCommand('npm', { type: 'run', script: 'build' }).args, ['run', 'build']);
});

test('exec komutları ve hatalı girdiler', () => {
  const op = { type: 'exec', workspace: 'server', bin: 'tsc', args: ['--noEmit'] };
  assert.throws(() => buildCommand('npm', op), /npm için exec güvenli değildir/, 'npm exec kayıt defterinden paket indirebilir');
  assert.deepEqual(buildCommand('bun', op), { args: ['x', '--no-install', 'tsc', '--noEmit'], cwd: 'server' });
  assert.throws(() => buildCommand('npm', { type: 'run' }), /script/);
  assert.throws(() => buildCommand('npm', { type: 'exec' }), /bin/);
  assert.throws(() => buildCommand('npm', { type: 'run', script: 'x', workspace: 'yok' }), /Bilinmeyen çalışma alanı/);
  assert.throws(() => buildCommand('npm', { type: 'bilinmeyen' }), /Bilinmeyen işlem/);
  assert.throws(() => buildCommand('yarn', { type: 'install' }), /Desteklenmeyen/);
});

test('kabuk metakarakterli argümanlar olduğu gibi kalır (kabuk yok)', () => {
  const tricky = 'F:\\quiz&master;rm -rf $HOME "x"';
  for (const manager of ['npm', 'bun']) {
    const built = buildCommand(manager, { type: 'run', script: 'upgrade', args: ['--project', tricky] });
    assert.ok(built.args.includes(tricky), `${manager}: argüman bozuldu`);
  }
});

test('npm giriş dosyası Node dizininden çözülür; yoksa Windows güvenle hata verir', () => {
  // Yollar ana makinenin path modülüyle kurulur: test her işletim sisteminde aynı davranır.
  const nodeDir = path.resolve('/sahte/node');
  const execPath = path.join(nodeDir, 'node.exe');
  const npmEntry = path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const exists = file => path.resolve(file) === path.resolve(npmEntry);
  assert.equal(resolveNpmEntry({ platform: 'win32', env: { PATH: '' }, execPath, exists }), path.resolve(npmEntry));
  assert.deepEqual(managerInvocation('npm', { platform: 'win32', env: { PATH: '' }, execPath, exists }), { command: execPath, args: [path.resolve(npmEntry)] });
  assert.throws(() => managerInvocation('npm', { platform: 'win32', env: { PATH: '' }, execPath: path.join(path.resolve('/yok'), 'node.exe'), exists: () => false }), /npm-cli.js/);
  assert.deepEqual(managerInvocation('npm', { platform: 'linux', env: { PATH: '' }, execPath: '/yok/node', exists: () => false }), { command: 'npm', args: [] });
});

test('npm_execpath yalnız npm-cli.js ise kullanılır (Bun yolu npm sayılmaz)', () => {
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

test('sürüm desteği: npm ≥ 11, Bun ≥ 1; pnpm artık desteklenmez', () => {
  assert.equal(isSupportedVersion('npm', '11.11.1'), true);
  assert.equal(isSupportedVersion('npm', '10.9.2'), false);
  assert.equal(isSupportedVersion('pnpm', '9.15.1'), false, 'pnpm artık desteklenmez');
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
for (const manager of ['npm', 'bun']) {
  const version = detectVersion(manager);
  const ready = version && fs.existsSync(path.join(root, 'server', 'node_modules', '.bin'));
  test(`gerçek ${manager}: çalışma alanı betiği çalışır`, { skip: ready ? false : `${manager} veya bağımlılıklar yok` }, () => {
    const invocation = createInvocation(manager, { type: 'run', workspace: 'server', script: 'type-check', args: ['--version'] }, { root });
    const result = spawnSync(invocation.command, invocation.args, { cwd: invocation.cwd, env: invocation.env, encoding: 'utf8', windowsHide: true, shell: false, timeout: 120000 });
    assert.equal(result.status, 0, `${manager} hata verdi: ${result.stderr}`);
    assert.match(`${result.stdout}`, /Version 5./);
  });
}

test('betiği başlatan yönetici npm_config_user_agent ile tanınır ve seçimde varsayılandan önce gelir', () => {
  assert.equal(detectInvokingManager({ npm_config_user_agent: 'pnpm/9.15.1 npm/? node/v22.0.0 win32 x64' }), null, 'pnpm artık desteklenmez');
  assert.equal(detectInvokingManager({ npm_config_user_agent: 'npm/11.11.1 node/v22.0.0 win32 x64 workspaces/false' }), 'npm');
  assert.equal(detectInvokingManager({ npm_config_user_agent: 'bun/1.3.14 npm/? node/v24.3.0 win32 x64' }), 'bun');
  assert.equal(detectInvokingManager({ npm_config_user_agent: 'yarn/1.22.0 npm/? node/v22.0.0' }), null);
  assert.equal(detectInvokingManager({}), null);
  assert.equal(selectManager({ env: { npm_config_user_agent: 'npm/11.11.1 node/v22' } }), 'npm');
  assert.equal(selectManager({ env: { npm_config_user_agent: 'npm/11.11.1 node/v22', QUIZMASTER_PM: 'bun' } }), 'bun', 'açık QUIZMASTER_PM user agent\'tan önce gelir');
  assert.equal(selectManager({ requested: 'bun', env: { npm_config_user_agent: 'npm/11.11.1 node/v22' } }), 'bun');
});

test('genel önekte (npm install -g npm@11) kurulu npm, Node ile gelen paketli npm\'den önce seçilir', () => {
  const nodeDir = path.resolve('/sahte/node');
  const execPath = path.join(nodeDir, 'node.exe');
  const bundled = path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const appdata = path.resolve('/sahte/appdata');
  const upgraded = path.join(appdata, 'npm', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const exists = file => [bundled, upgraded].some(item => path.resolve(item) === path.resolve(file));
  assert.equal(resolveNpmEntry({ platform: 'win32', env: { PATH: '', APPDATA: appdata }, execPath, exists }), path.resolve(upgraded));
  assert.equal(resolveNpmEntry({ platform: 'win32', env: { PATH: '' }, execPath, exists }), path.resolve(bundled), 'APPDATA yoksa paketli npm');
  const prefix = path.resolve('/sahte/prefix');
  const posixUpgraded = path.join(prefix, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  assert.equal(resolveNpmEntry({ platform: 'linux', env: { PATH: '', npm_config_prefix: prefix }, execPath: '/yok/node', exists: file => path.resolve(file) === path.resolve(posixUpgraded) }), path.resolve(posixUpgraded));
});

test('kurulu yönetici node_modules düzeninden tanınır; var olan kurulum sessizce yönetici değiştirmez', () => {
  const root = path.resolve('/proje');
  const has = (...files) => file => files.some(item => path.resolve(file) === path.resolve(root, item));
  assert.equal(detectInstalledManager(root, { exists: has('node_modules/.pnpm') }), null, 'pnpm ağacı artık kurulu yönetici sayılmaz');
  assert.equal(hasLegacyPnpmTree(root, { exists: has('node_modules/.pnpm') }), true);
  assert.equal(hasLegacyPnpmTree(root, { exists: () => false }), false);
  assert.equal(hasLegacyPnpmTree(undefined), false);
  assert.equal(detectInstalledManager(root, { exists: has('node_modules/.package-lock.json') }), 'npm');
  assert.equal(detectInstalledManager(root, { exists: has('bun.lock') }), 'bun');
  assert.equal(detectInstalledManager(root, { exists: () => false }), null);
  assert.equal(detectInstalledManager(undefined), null);
  // Öncelik: açık istek ve QUIZMASTER_PM, kurulu yöneticiden önce gelir; kurulu yönetici varsayılandan önce gelir.
  assert.equal(selectManager({ env: {}, root, exists: has('node_modules/.pnpm') }), 'npm', 'eski pnpm ağacı olan dizin npm\'e geçer');
  assert.equal(selectManager({ env: {}, root, exists: () => false }), 'npm');
  assert.equal(selectManager({ requested: 'npm', env: {}, root, exists: has('node_modules/.pnpm') }), 'npm');
  assert.equal(selectManager({ env: { QUIZMASTER_PM: 'bun' }, root, exists: has('node_modules/.pnpm') }), 'bun');
  assert.equal(selectManager({ env: { npm_config_user_agent: 'npm/11.0.0 node/v22' }, root, exists: has('node_modules/.pnpm') }), 'npm', 'betiği başlatan yönetici kurulu yöneticiden önce gelir');
});

const depsReady = fs.existsSync(path.join(root, 'server', 'node_modules', '.bin'));
test('resolveLocalBin: çalışma alanı bin dosyasını npm exec olmadan, mutlak JS yolu olarak bulur', { skip: depsReady ? false : 'bağımlılıklar yok' }, () => {
  for (const [workspace, name, bin] of [['server', 'tsx'], ['client', 'vite'], [null, '@playwright/test', 'playwright']]) {
    const file = resolveLocalBin(root, workspace, name, bin);
    assert.ok(path.isAbsolute(file) && fs.existsSync(file), `${name}: bin bulunamadı (${file})`);
    assert.match(file, /.(c|m)?js$/, `${name}: JS dosyası olmalı`);
  }
});
test('resolveLocalBin: olmayan paket ve olmayan bin açık hata verir', { skip: depsReady ? false : 'bağımlılıklar yok' }, () => {
  assert.throws(() => resolveLocalBin(root, 'server', 'yok-boyle-bir-paket-xyz'));
  // tsx'in bin alanı düz dizgedir (ad aranmaz); vite'inki nesnedir, olmayan ad hata verir.
  assert.throws(() => resolveLocalBin(root, 'client', 'vite', 'olmayan-bin'), /bin dosyası yok/);
});
