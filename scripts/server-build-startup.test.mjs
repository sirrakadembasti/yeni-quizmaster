import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { cleanupStartupChild } from './server-startup-child-cleanup.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireServer = createRequire(path.join(repository, 'server/package.json'));

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('canonical pnpm production start boots with native Sharp and serves CSRF using only isolated paths', { timeout: 180000 }, async t => {
  const pnpm = [process.env.npm_execpath, ...(process.env.PATH || '').split(path.delimiter).flatMap(directory => [
    path.join(directory, 'node_modules/pnpm/bin/pnpm.cjs'),
    path.resolve(directory, '../lib/node_modules/pnpm/bin/pnpm.cjs'),
  ])].find(candidate => candidate && /pnpm\.c?js$/i.test(candidate) && fs.existsSync(candidate));
  assert.ok(pnpm, 'Installed pnpm JavaScript entrypoint must be available');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quizmaster-server-startup-'));
  const guard = () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('quizmaster-server-startup-'));
  };
  guard();
  let child;
  const lifecycle = { spawned: false, closed: false, exited: false };
  t.after(async () => {
    if (child) {
      const cleanup = await cleanupStartupChild(child, lifecycle, async () => {
        if (process.platform === 'win32') {
        // Canonical pnpm start owns cross-env and API descendants; stop that
        // exact spawned process tree, never a port-derived or unrelated PID.
        assert.ok(Number.isInteger(child.pid) && child.pid > 0);
        execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 10000, stdio: 'pipe' });
        } else {
          process.kill(-child.pid, 'SIGTERM');
        }
      });
      assert.ok(cleanup.stopProven && cleanup.handlesReleased,
        `Owned child cleanup incomplete; fixture preserved at ${root}: ${JSON.stringify({ ...cleanup, lifecycle })}`);
    }
    guard();
    // Remove only fixture junctions before recursively deleting the guarded root.
    for (const directory of ['server/node_modules', 'node_modules']) {
      const link = path.join(root, directory);
      if (fs.existsSync(link)) {
        assert.ok(fs.lstatSync(link).isSymbolicLink());
        fs.unlinkSync(link);
      }
    }
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  for (const directory of ['server/data', 'client/dist', 'dist'])
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  for (const file of ['package.json', 'pnpm-workspace.yaml', 'server/package.json', 'client/package.json'])
    fs.copyFileSync(path.join(repository, file), path.join(root, file));
  fs.writeFileSync(path.join(root, 'client/dist/index.html'), '<!doctype html><title>Isolated startup</title>');
  // Full installed workspace dependency layout, including the actual cross-env
  // shim. No manual NODE_PATH or individual Sharp/SQLite resolution workaround.
  for (const directory of ['node_modules', 'server/node_modules'])
    fs.symlinkSync(path.join(repository, directory), path.join(root, directory), 'junction');

  const output = path.join(root, 'dist/index.cjs');
  const regularOutput = path.join(repository, 'dist/index.cjs');
  const fingerprint = () => fs.existsSync(regularOutput) ? [fs.statSync(regularOutput).size, fs.statSync(regularOutput).mtimeMs] : null;
  const before = fingerprint();
  const env = { ...process.env, CHECKPOINT_DISABLE: '1', FORCE_COLOR: '0' };
  for (const name of ['DATABASE_URL', 'SESSION_SECRET', 'NODE_ENV', 'PORT', 'HOST', 'APP_BASE_PATH',
    'FRONTEND_URL', 'ALLOWED_ORIGINS', 'TRUST_PROXY_HOPS', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM',
    'DEPLOYMENT_CONFIG_PATH', 'QUIZMASTER_PROJECT_ROOT', 'FORCE_SECURE_COOKIES', 'NODE_PATH']) delete env[name];
  // esbuild accepts the appended outfile override; verify the regular output is untouched.
  execFileSync(process.execPath, [pnpm, '--filter', 'quiz-master-server', 'run', 'build', `--outfile=${output}`], {
    cwd: repository, env, shell: false, windowsHide: true, timeout: 120000, stdio: 'pipe',
  });
  assert.ok(fs.existsSync(output), 'Actual build must honor the isolated outfile');
  assert.deepEqual(fingerprint(), before, 'Regression must not overwrite the normal production bundle');
  // Relocating the bundle breaks Prisma's generated relative engine lookup.
  // Provide the real installed native engine inside the fixture explicitly;
  // this is a build/start integration regression, not a fresh-install proof.
  const generatedClient = createRequire(requireServer.resolve('@prisma/client'));
  const generatedDirectory = path.dirname(generatedClient.resolve('.prisma/client/default'));
  const engineName = fs.readdirSync(generatedDirectory).find(name => process.platform === 'win32'
    ? name === 'query_engine-windows.dll.node' : /^libquery_engine.*\.node$/.test(name));
  assert.ok(engineName, 'Real generated Prisma native engine must exist');
  const fixtureEngine = path.join(root, 'dist', engineName);
  fs.copyFileSync(path.join(generatedDirectory, engineName), fixtureEngine);

  // Exercise the installed native addon too; no replacement or mock of Sharp.
  execFileSync(process.execPath, ['-e', "require('sharp')({create:{width:2,height:2,channels:3,background:'#123456'}}).png().toBuffer().then(buffer=>{if(buffer.length<8||buffer.subarray(1,4).toString()!=='PNG')process.exitCode=1}).catch(()=>{process.exitCode=1})"], {
    cwd: path.join(root, 'server'), env, shell: false, windowsHide: true, timeout: 45000, stdio: 'pipe',
  });
  const port = await freePort();
  const secret = randomBytes(32).toString('hex');
  const database = path.join(root, 'server/data/isolated.db');
  assert.equal(path.dirname(path.resolve(database)), path.join(root, 'server/data'));
  const startupEnv = { ...env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
    SESSION_SECRET: secret, DATABASE_URL: `file:${database.replaceAll('\\', '/')}`,
    PRISMA_QUERY_ENGINE_LIBRARY: fixtureEngine,
    FRONTEND_URL: `http://127.0.0.1:${port}`, ALLOWED_ORIGINS: `http://127.0.0.1:${port}` };
  assert.equal(startupEnv.NODE_PATH, undefined);
  child = spawn(process.execPath, [pnpm, '--filter', 'quiz-master-server', 'start'], {
    cwd: root, env: startupEnv, shell: false, windowsHide: true,
    detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '', spawnError;
  const collect = chunk => { logs = (logs + chunk.toString()).slice(-12000).split(secret).join('[redacted]'); };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  child.on('spawn', () => { lifecycle.spawned = true; lifecycle.pid = child.pid; });
  child.on('error', error => { spawnError = error; lifecycle.errorCode = error.code || 'spawn-error'; });
  child.on('exit', (code, signal) => { lifecycle.exited = true; lifecycle.exitCode = code; lifecycle.signal = signal; });
  child.on('close', (code, signal) => { lifecycle.closed = true; lifecycle.closeCode = code; lifecycle.closeSignal = signal; });
  // Cold canonical pnpm startup exceeded the former 30 s window on this host.
  // Match the fresh-install harness's bounded API budget; keep readiness assertions.
  const deadline = Date.now() + 120000;
  let ready = false;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    assert.equal(child.exitCode, null, `Production bundle exited before API readiness: ${JSON.stringify(lifecycle)}\n${logs}`);
    let response;
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/csrf-token`, { signal: AbortSignal.timeout(1000) });
    } catch {}
    if (response?.ok) {
        const body = await response.json();
        assert.equal(typeof body.csrfToken, 'string');
        assert.ok(body.csrfToken.length > 10);
        ready = true;
        break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Production bundle never served CSRF: ${JSON.stringify(lifecycle)}\n${logs}`);
  assert.ok(fs.existsSync(path.join(root, 'server/data/sessions.db')), 'Session store must be in the fixture');
  assert.ok(fs.existsSync(path.join(root, 'server/uploads')), 'Uploads must be in the fixture');
  assert.equal(fs.existsSync(path.join(root, 'server/.env')), false, 'Regression does not create an environment file');
});
