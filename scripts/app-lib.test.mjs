import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  commandFor, isAlive, parsePidFile, readEnvValue, resolveMode, startProcess, stopProcess, tailText,
} from './app-lib.mjs';

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quizmaster-app-lib-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }));
  return dir;
}

test('PID dosyası hem JSON hem eski düz sayı biçimini okur, bozuğu reddeder', () => {
  assert.deepEqual(parsePidFile('123\n'), { pid: 123, mode: null, startedAt: null });
  assert.equal(parsePidFile('{"pid":45,"mode":"dev","startedAt":"x"}').pid, 45);
  assert.equal(parsePidFile('{bozuk'), null);
  assert.equal(parsePidFile('{"pid":-1}'), null);
  assert.equal(parsePidFile(''), null);
});

test('.env değeri okunur; mod NODE_ENV’den çıkarılır, açık istek önceliklidir', t => {
  const env = path.join(tempDir(t), '.env');
  fs.writeFileSync(env, '# yorum\nNODE_ENV="production"\nPORT=5100\n');
  assert.equal(readEnvValue(env, 'PORT'), '5100');
  assert.equal(readEnvValue(env, 'YOK'), null);
  assert.equal(resolveMode(undefined, env), 'production');
  assert.equal(resolveMode('dev', env), 'dev');
  assert.equal(resolveMode(undefined, path.join(path.dirname(env), 'yok.env')), 'dev');
});

test('tailText son N satırı verir', () => {
  assert.equal(tailText('a\nb\nc\n', 2), 'b\nc');
  assert.equal(tailText('a', 5), 'a');
});

test('süreç başlatılır, log ve PID kaydı yazılır, ikinci başlatma reddedilir, stop tüm ağacı durdurur', { timeout: 30000 }, async t => {
  const dir = tempDir(t);
  const pidFile = path.join(dir, 'app.pid');
  const logPath = path.join(dir, 'logs', 'app.log');
  const childPidFile = path.join(dir, 'child.pid');
  // Ebeveyn bir alt süreç doğurur (pnpm dev → vite benzeri ağaç) ve ikisi de sonsuza kadar yaşar.
  const script = `const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});require('node:fs').writeFileSync(${JSON.stringify(childPidFile)},String(c.pid));console.log('merhaba');setInterval(()=>{},1000);`;
  const record = startProcess({ command: process.execPath, args: ['-e', script], cwd: dir, logPath, pidFile, mode: 'dev' });
  t.after(async () => { await stopProcess(pidFile); });
  assert.ok(isAlive(record.pid));
  assert.equal(JSON.parse(fs.readFileSync(pidFile, 'utf8')).pid, record.pid);

  for (let i = 0; i < 60 && !fs.existsSync(childPidFile); i += 1) await new Promise(r => setTimeout(r, 100));
  const childPid = Number(fs.readFileSync(childPidFile, 'utf8'));
  assert.ok(isAlive(childPid), 'alt süreç çalışmıyor');
  assert.match(fs.readFileSync(logPath, 'utf8'), /merhaba/);

  assert.throws(() => startProcess({ command: process.execPath, args: ['-e', ''], cwd: dir, logPath, pidFile, mode: 'dev' }), /zaten çalışıyor/);

  const result = await stopProcess(pidFile);
  assert.equal(result.stopped, true);
  assert.equal(isAlive(record.pid), false);
  for (let i = 0; i < 30 && isAlive(childPid); i += 1) await new Promise(r => setTimeout(r, 100));
  assert.equal(isAlive(childPid), false, 'alt süreç ebeveyn durunca ayakta kaldı');
  assert.equal(fs.existsSync(pidFile), false);
});

test('stop: kayıt yoksa veya süreç ölmüşse zararsızdır ve ölü kaydı temizler', async t => {
  const dir = tempDir(t);
  const pidFile = path.join(dir, 'app.pid');
  assert.equal((await stopProcess(pidFile)).reason, 'no-record');
  fs.writeFileSync(pidFile, '{"pid":2147483000}\n');
  assert.equal((await stopProcess(pidFile)).reason, 'not-running');
  assert.equal(fs.existsSync(pidFile), false);
});

test('dev komutu seçili yöneticiyle kabuksuz üretilir; üretim derlenmiş girişi çalıştırır', () => {
  const root = path.resolve('/proje');
  const production = commandFor('production', root, {});
  assert.equal(production.command, process.execPath);
  assert.deepEqual(production.args, [path.join(root, 'dist', 'index.cjs')]);
  // npm her Node kurulumuyla gelir; test pnpm/bun kurulu olmasına bağlı kalmaz.
  const dev = commandFor('dev', root, { ...process.env, QUIZMASTER_PM: 'npm' });
  assert.deepEqual(dev.args.slice(-2), ['run', 'dev'], 'kök dev betiği çalıştırılmalı');
  assert.ok(!/cmd\.exe$/i.test(dev.command), 'cmd.exe üzerinden çalıştırılmamalı');
});
