// QuizMaster uygulamasını arka planda başlatma/durdurma/izleme yardımcıları.
// Durum dosyası: server/data/app.pid (JSON; eski sürümün düz sayı biçimi de okunur).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

export function paths(root) {
  const data = path.join(root, 'server', 'data');
  return {
    root,
    pidFile: path.join(data, 'app.pid'),
    logDir: path.join(data, 'logs'),
    envFile: path.join(root, 'server', '.env'),
    distEntry: path.join(root, 'dist', 'index.cjs'),
  };
}

export function parsePidFile(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return { pid: Number(trimmed), mode: null, startedAt: null };
  try {
    const parsed = JSON.parse(trimmed);
    return Number.isInteger(parsed?.pid) && parsed.pid > 0
      ? { pid: parsed.pid, mode: parsed.mode ?? null, startedAt: parsed.startedAt ?? null, logFile: parsed.logFile ?? null }
      : null;
  } catch {
    return null;
  }
}

export function readPidFile(file) {
  try { return parsePidFile(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

export function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === 'EPERM'; }
}

export function readEnvValue(envFile, key) {
  try {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (match && match[1] === key) return match[2].trim().replace(/^"(.*)"$/, '$1');
    }
  } catch { /* .env yok */ }
  return null;
}

/** --mode verilmediyse server/.env içindeki NODE_ENV'den (development → dev) çıkarılır. */
export function resolveMode(requested, envFile) {
  if (requested === 'dev' || requested === 'production') return requested;
  return readEnvValue(envFile, 'NODE_ENV') === 'production' ? 'production' : 'dev';
}

export function isPortOpen(port, timeoutMs = 700) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const done = value => { socket.removeAllListeners(); socket.destroy(); resolve(value); };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

export function tailText(text, lines) {
  const all = String(text).split(/\r?\n/);
  if (all[all.length - 1] === '') all.pop();
  return all.slice(-Math.max(1, lines)).join('\n');
}

export function commandFor(mode, root) {
  if (mode === 'production') {
    return { command: process.execPath, args: [paths(root).distEntry] };
  }
  return process.platform === 'win32'
    ? { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', 'pnpm', 'run', 'dev'] }
    : { command: 'pnpm', args: ['run', 'dev'] };
}

/** Süreci ayrık (detached) başlatır, çıktısını log dosyasına yönlendirir ve PID kaydı yazar. */
export function startProcess({ command, args, cwd, logPath, pidFile, mode, env = {} }) {
  const existing = readPidFile(pidFile);
  if (existing && isAlive(existing.pid)) {
    throw Object.assign(new Error(`Uygulama zaten çalışıyor (PID ${existing.pid}). Önce durdurun: node scripts/app.mjs stop`), { code: 'ALREADY_RUNNING', pid: existing.pid });
  }
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  const logFd = fs.openSync(logPath, 'a', 0o600);
  let child;
  try {
    fs.writeSync(logFd, `\n--- ${new Date().toISOString()} başlatılıyor: ${command} ${args.join(' ')} ---\n`);
    child = spawn(command, args, {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0', ...env },
      detached: true,
      stdio: ['ignore', logFd, logFd],
      windowsHide: true,
    });
  } finally {
    fs.closeSync(logFd);
  }
  child.on('error', () => { /* başlatma hatası log'a düşer; PID doğrulaması status'ta görülür */ });
  child.unref();
  if (!child.pid) throw new Error('Süreç başlatılamadı.');
  const record = { pid: child.pid, mode, startedAt: new Date().toISOString(), logFile: logPath };
  fs.writeFileSync(pidFile, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  return record;
}

function killTree(pid, force) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', ...(force ? ['/F'] : [])], { windowsHide: true, stdio: 'ignore' });
  } else {
    try { process.kill(-pid, force ? 'SIGKILL' : 'SIGTERM'); } catch { try { process.kill(pid, force ? 'SIGKILL' : 'SIGTERM'); } catch { /* yok */ } }
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Kayıtlı süreç ağacını durdurur; kayıt yoksa/ölüyse yalnız kaydı temizler. */
export async function stopProcess(pidFile, { timeoutMs = 8000 } = {}) {
  const record = readPidFile(pidFile);
  if (!record) return { stopped: false, reason: 'no-record' };
  if (!isAlive(record.pid)) {
    fs.rmSync(pidFile, { force: true });
    return { stopped: false, reason: 'not-running', pid: record.pid };
  }
  killTree(record.pid, false);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && isAlive(record.pid)) await sleep(100);
  if (isAlive(record.pid)) {
    killTree(record.pid, true);
    const hard = Date.now() + 3000;
    while (Date.now() < hard && isAlive(record.pid)) await sleep(100);
  }
  if (isAlive(record.pid)) return { stopped: false, reason: 'still-running', pid: record.pid };
  fs.rmSync(pidFile, { force: true });
  return { stopped: true, pid: record.pid };
}
