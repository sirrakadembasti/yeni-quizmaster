import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { managerInvocation } from './package-manager.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

// Windows'ta Node, SIGINT/SIGTERM'i süreci hemen öldüren çağrıya çevirir; sinyal işleyicisi çalışmaz.
// Bu yüzden düzgün kapanış yalnız POSIX sistemlerde sınanabilir (bkz. scripts/app-lib.mjs killTree).
const skip = process.platform === 'win32' ? 'Windows sinyal işleyicilerini çalıştırmaz' : false;

test('SIGINT ve SIGTERM sunucuyu 10 sn içinde çıkış kodu 0 ile kapatır', { timeout: 300000, skip }, async t => {
  const npm = managerInvocation('npm');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quizmaster-graceful-shutdown-'));
  assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
  const children = new Set();
  t.after(() => {
    // Yalnız bu testin başlattığı süreçler durdurulur.
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    for (const directory of ['server/node_modules', 'node_modules']) {
      const link = path.join(root, directory);
      if (fs.existsSync(link)) fs.unlinkSync(link);
    }
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  for (const directory of ['server/data', 'client/dist', 'dist']) fs.mkdirSync(path.join(root, directory), { recursive: true });
  for (const file of ['package.json', 'server/package.json', 'client/package.json'])
    fs.copyFileSync(path.join(repository, file), path.join(root, file));
  fs.writeFileSync(path.join(root, 'client/dist/index.html'), '<!doctype html><title>Isolated shutdown</title>');
  for (const directory of ['node_modules', 'server/node_modules'])
    fs.symlinkSync(path.join(repository, directory), path.join(root, directory), 'junction');

  const env = { ...process.env, CHECKPOINT_DISABLE: '1', FORCE_COLOR: '0' };
  for (const name of ['DATABASE_URL', 'SESSION_SECRET', 'NODE_ENV', 'PORT', 'HOST', 'APP_BASE_PATH',
    'FRONTEND_URL', 'ALLOWED_ORIGINS', 'TRUST_PROXY_HOPS', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM',
    'DEPLOYMENT_CONFIG_PATH', 'QUIZMASTER_PROJECT_ROOT', 'FORCE_SECURE_COOKIES', 'NODE_PATH']) delete env[name];
  const output = path.join(root, 'dist/index.cjs');
  execFileSync(npm.command, [...npm.args, 'run', 'build', '--workspace=server', '--', `--outfile=${output}`], {
    cwd: repository, env, shell: false, windowsHide: true, timeout: 120000, stdio: 'pipe',
  });
  const database = path.join(root, 'server/data/isolated.db');
  const databaseUrl = `file:${database.replaceAll('\\', '/')}`;
  execFileSync(npm.command, [...npm.args, 'run', 'db:deploy', '--workspace=server'], {
    cwd: repository, shell: false, windowsHide: true, timeout: 120000, stdio: 'pipe',
    env: { ...env, DATABASE_URL: databaseUrl, RUST_LOG: 'info' },
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    const port = await freePort();
    const secret = randomBytes(32).toString('hex');
    // npm/cross-env aracısı olmadan doğrudan node: sinyal sunucu sürecine ulaşmalı.
    const child = spawn(process.execPath, [output], {
      cwd: root, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), SESSION_SECRET: secret,
        DATABASE_URL: databaseUrl, FRONTEND_URL: `http://127.0.0.1:${port}`, ALLOWED_ORIGINS: `http://127.0.0.1:${port}` },
    });
    children.add(child);
    let logs = '';
    const collect = chunk => { logs = (logs + chunk.toString()).slice(-12000).split(secret).join('[redacted]'); };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const closed = new Promise(resolve => child.once('close', (code, sig) => resolve({ code, sig })));

    const deadline = Date.now() + 120000;
    let ready = false;
    while (Date.now() < deadline && !ready) {
      assert.equal(child.exitCode, null, `Sunucu hazır olmadan çıktı:\n${logs}`);
      try { ready = (await fetch(`http://127.0.0.1:${port}/api/csrf-token`, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
      if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, `Sunucu hazır olmadı:\n${logs}`);

    child.kill(signal);
    const result = await Promise.race([closed, new Promise(resolve => setTimeout(() => resolve('zaman aşımı'), 10000))]);
    assert.notEqual(result, 'zaman aşımı', `${signal} sonrası 10 sn içinde çıkmadı:\n${logs}`);
    assert.deepEqual(result, { code: 0, sig: null }, `${signal} çıkış kodu 0 olmalı:\n${logs}`);
  }
});
