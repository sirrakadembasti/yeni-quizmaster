// Paket yöneticisi katmanı: kurulum, yükseltme, CLI ve sihirbaz tek yerden komut üretir.
// Yönetici açık seçimden gelir (QUIZMASTER_PM / arayüz); `npm_execpath` tahmini kullanılmaz.
// Komutlar cmd.exe/kabuk olmadan, doğrudan çalıştırılabilir giriş noktalarıyla üretilir:
// proje yolları ve argümanlar veridir, kabuk metakarakterleri korunur.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const MANAGERS = ['npm', 'bun'];
// Yeni kurulumların varsayılanı npm'dir. Var olan bir kurulum kendi yöneticisini korur (bkz. detectInstalledManager).
export const DEFAULT_MANAGER = 'npm';
export const MIN_NPM_MAJOR = 11;

// Mantıksal çalışma alanı → paket adı / dizin
export const WORKSPACES = {
  server: { name: 'quiz-master-server', dir: 'server' },
  client: { name: 'quiz-master-client', dir: 'client' },
};

/**
 * npm ve bun betik çalıştırırken npm_config_user_agent ayarlar ("npm/11.x node/…").
 * Betiği hangi yöneticinin başlattığını söyleyen en güvenilir işarettir (npm_execpath tahmininden farklı).
 */
export function detectInvokingManager(env = process.env) {
  const name = String(env.npm_config_user_agent || '').split(' ')[0].split('/')[0].toLowerCase();
  return MANAGERS.includes(name) ? name : null;
}

/**
 * node_modules düzeninden, bu dizindeki kurulumun hangi yöneticiyle yapıldığını söyler; yoksa null.
 * pnpm artık desteklenmez: pnpm ağacı (node_modules/.pnpm) "legacy" sayılır, null döner ve npm'e geçilir
 * (bkz. hasLegacyPnpmTree; `npm ci` node_modules'ü silip yeniden kurar).
 */
export function detectInstalledManager(root, { exists = fs.existsSync } = {}) {
  if (!root) return null;
  if (exists(path.join(root, 'bun.lock')) || exists(path.join(root, 'bun.lockb'))) return 'bun';
  if (exists(path.join(root, 'node_modules', '.package-lock.json'))) return 'npm';
  return null;
}

/** Eski pnpm kurulumundan kalan node_modules düzeni var mı? (pnpm kaldırıldı; npm ci yeniden kurar) */
export function hasLegacyPnpmTree(root, { exists = fs.existsSync } = {}) {
  return Boolean(root) && exists(path.join(root, 'node_modules', '.pnpm'));
}

// Öncelik: açık istek > QUIZMASTER_PM > betiği başlatan yönetici > kurulu yönetici (root verilirse) > varsayılan (npm).
export function selectManager({ requested, env = process.env, root, exists } = {}) {
  const value = String(requested || env.QUIZMASTER_PM || detectInvokingManager(env) || detectInstalledManager(root, { exists }) || DEFAULT_MANAGER).toLowerCase();
  if (value === 'pnpm') throw new Error('pnpm artık desteklenmiyor. npm 11 veya üstünü (ya da deneysel Bun) kullanın.');
  if (!MANAGERS.includes(value)) throw new Error(`Desteklenmeyen paket yöneticisi: ${value}. Geçerli: ${MANAGERS.join(', ')}.`);
  return value;
}

function pathEntries(env, platform) {
  const raw = Object.entries(env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] || '';
  return raw.split(platform === 'win32' ? ';' : ':').filter(Boolean);
}

/** npm'in Node ile çalışan giriş dosyasını (npm-cli.js) bulur; yoksa null. */
export function resolveNpmEntry({ platform = process.platform, env = process.env, execPath = process.execPath, exists = fs.existsSync, realpath = fs.realpathSync } = {}) {
  const inherited = env.npm_execpath;
  if (inherited && path.basename(inherited) === 'npm-cli.js' && exists(inherited)) return inherited;
  // Sıra, Node'un kendi npm kabuk betiğiyle aynıdır: `npm install -g npm@11` ile kurulan (genel önek)
  // npm, Node'la gelen paketli npm'den ÖNCE kullanılır; aksi hâlde güncel npm yanlışlıkla eski sanılır.
  const candidates = [];
  const prefixes = [env.npm_config_prefix, platform === 'win32' && env.APPDATA ? path.join(env.APPDATA, 'npm') : null].filter(Boolean);
  for (const prefix of prefixes) {
    candidates.push(path.join(prefix, 'node_modules', 'npm', 'bin', 'npm-cli.js')); // Windows
    candidates.push(path.join(prefix, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')); // POSIX
  }
  for (const directory of pathEntries(env, platform)) {
    candidates.push(path.join(directory, 'node_modules', 'npm', 'bin', 'npm-cli.js'));
    // POSIX: `npm` bir simgesel bağdır → npm-cli.js
    const link = path.join(directory, 'npm');
    try {
      if (platform !== 'win32' && exists(link)) {
        const real = realpath(link);
        if (path.basename(real) === 'npm-cli.js') candidates.push(real);
      }
    } catch { /* bağ çözülemedi */ }
  }
  const nodeDir = path.dirname(execPath);
  candidates.push(path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js')); // Windows, nvm-windows
  candidates.push(path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')); // macOS/Linux resmi paket
  return candidates.map(entry => path.resolve(entry)).find(entry => exists(entry)) || null;
}

/** Bun çalıştırılabilir dosyası; yoksa null. */
export function resolveBunExecutable({ platform = process.platform, env = process.env, exists = fs.existsSync, home = os.homedir() } = {}) {
  const name = platform === 'win32' ? 'bun.exe' : 'bun';
  for (const directory of pathEntries(env, platform)) {
    const exe = path.join(directory, name);
    if (exists(exe)) return exe;
  }
  const fallback = path.join(home, '.bun', 'bin', name);
  return exists(fallback) ? fallback : null;
}

/**
 * Yöneticinin çalıştırma önekini döndürür: { command, args }.
 * Bulunamazsa açık bir hata verir (kabuk yedeği yoktur; Windows'ta özellikle güvenlidir).
 */
export function managerInvocation(manager, options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  if (manager === 'npm') {
    const entry = resolveNpmEntry({ ...options, platform, env });
    if (entry) return { command: options.execPath || process.execPath, args: [entry] };
    if (platform === 'win32') throw new Error('npm Node giriş dosyası (npm-cli.js) bulunamadı; Node.js kurulumunu onarın.');
    return { command: 'npm', args: [] };
  }
  if (manager === 'bun') {
    const exe = resolveBunExecutable({ ...options, platform, env });
    if (!exe) throw new Error('Bun bulunamadı. https://bun.sh adresinden kurun veya npm kullanın.');
    return { command: exe, args: [] };
  }
  throw new Error(`Desteklenmeyen paket yöneticisi: ${manager}`);
}

function workspaceOf(name) {
  const workspace = WORKSPACES[name];
  if (!workspace) throw new Error(`Bilinmeyen çalışma alanı: ${name}. Geçerli: ${Object.keys(WORKSPACES).join(', ')}.`);
  return workspace;
}

/**
 * Mantıksal işlemi yöneticiye özgü komuta çevirir. Saf işlevdir; çalıştırmaz.
 *   install: { frozen = true, dev = true }
 *   run:     { workspace?, script, args? }
 *   exec:    { workspace?, bin, args? }  (npm için DESTEKLENMEZ, bkz. aşağıdaki not)
 * Dönüş: { args, cwd? } — `args`, managerInvocation() önekinin ARDINA eklenir.
 * `cwd` (proje köküne göre) yalnız yöneticinin çalışma alanı seçeneği olmadığında verilir.
 */
export function buildCommand(manager, op) {
  const args = op.args || [];
  switch (op.type) {
    case 'install': {
      const frozen = op.frozen !== false;
      const dev = op.dev !== false;
      if (manager === 'npm') return { args: [frozen ? 'ci' : 'install', ...(dev ? ['--include=dev'] : ['--omit=dev'])] };
      if (manager === 'bun') return { args: ['install', ...(frozen ? ['--frozen-lockfile'] : []), ...(dev ? [] : ['--production'])] };
      break;
    }
    case 'run': {
      if (!op.script) throw new Error('run için script gerekli.');
      const workspace = op.workspace ? workspaceOf(op.workspace) : null;
      if (manager === 'npm') return { args: ['run', op.script, ...(workspace ? [`--workspace=${workspace.dir}`] : []), ...(args.length ? ['--', ...args] : [])] };
      if (manager === 'bun') return { args: ['run', op.script, ...args], ...(workspace ? { cwd: workspace.dir } : {}) };
      break;
    }
    case 'exec': {
      if (!op.bin) throw new Error('exec için bin gerekli.');
      const workspace = op.workspace ? workspaceOf(op.workspace) : null;
      // npm exec, yerel bin'i bulamazsa kayıt defterinden aynı adlı BAŞKA bir paketi indirip çalıştırabilir
      // (ölçüldü: `npm exec -- tsc` alakasız "tsc" paketini çalıştırdı; `--no` bunu engellemez).
      // Bu yüzden npm için exec yoktur: package.json betiği tanımlayıp 'run' kullanın.
      if (manager === 'npm') throw new Error('npm için exec güvenli değildir (kayıt defterinden paket indirebilir); package.json betiği tanımlayıp run kullanın.');
      // --no-install: yerel bin yoksa indirmek yerine durur.
      if (manager === 'bun') return { args: ['x', '--no-install', op.bin, ...args], ...(workspace ? { cwd: workspace.dir } : {}) };
      break;
    }
    default:
      throw new Error(`Bilinmeyen işlem türü: ${op.type}`);
  }
  throw new Error(`Desteklenmeyen paket yöneticisi: ${manager}`);
}

/** Çalıştırmaya hazır tam çağrı: { command, args, cwd, env } (cwd mutlak, root'a göre çözülmüş). */
export function createInvocation(manager, op, { root = process.cwd(), env = process.env, platform = process.platform, ...options } = {}) {
  const prefix = managerInvocation(manager, { env, platform, ...options });
  const built = buildCommand(manager, op);
  return {
    command: prefix.command,
    args: [...prefix.args, ...built.args],
    cwd: built.cwd ? path.join(root, built.cwd) : root,
    // Alt süreçlerin yöneticiyi tahminle değil açık seçimle bulması için iletilir.
    env: { ...env, QUIZMASTER_PM: manager },
  };
}

/** Yöneticinin sürümünü okur; kurulu değilse null. Hızlı (--version) ve kabuksuzdur. */
export function detectVersion(manager, { env = process.env, platform = process.platform, run = spawnSync, ...options } = {}) {
  try {
    const prefix = managerInvocation(manager, { env, platform, ...options });
    const result = run(prefix.command, [...prefix.args, '--version'], { encoding: 'utf8', windowsHide: true, timeout: 15000, env, shell: false });
    if (result.status !== 0) return null;
    const version = String(result.stdout || '').trim().split(/\r?\n/).pop();
    return /^\d+\.\d+\.\d+/.test(version) ? version : null;
  } catch {
    return null;
  }
}

export function isSupportedVersion(manager, version) {
  if (!version) return false;
  const major = Number(version.split('.')[0]);
  if (manager === 'npm') return major >= MIN_NPM_MAJOR;
  if (manager === 'bun') return major >= 1;
  return false;
}

/** Tüm yöneticilerin durumu: { npm: { version, supported }, ... } */
export function detectAll(options = {}) {
  return Object.fromEntries(MANAGERS.map(manager => {
    const version = detectVersion(manager, options);
    return [manager, { version, supported: isSupportedVersion(manager, version) }];
  }));
}
