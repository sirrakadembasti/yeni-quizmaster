import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadConfigFromFile } from '../client/node_modules/vite/dist/node/index.js';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientRoot = path.join(repositoryRoot, 'client');
const secretSentinel = 'DISPOSABLE_CONFIG_TEST_SECRET_DO_NOT_EXPOSE';

// Copy the actual config into a disposable sibling client/server layout. Node
// resolves existing dependencies from the ancestor client/node_modules; no real
// .env, DB, running service, or settings file is touched.
function fixture(t, envText = '') {
  const root = fs.mkdtempSync(path.join(clientRoot, '.vite-proxy-config-fixture-'));
  const isolatedClient = path.join(root, 'client');
  const isolatedServer = path.join(root, 'server');
  const dependencyLink = path.join(isolatedServer, 'node_modules');
  const previousPort = process.env.PORT;
  delete process.env.PORT;
  t.after(() => {
    if (previousPort === undefined) delete process.env.PORT;
    else process.env.PORT = previousPort;
    // Verify the absolute recursive removal stays within its intended workspace.
    assert.equal(path.dirname(path.resolve(root)), clientRoot);
    assert.ok(path.basename(root).startsWith('.vite-proxy-config-fixture-'));
    if (fs.existsSync(dependencyLink)) {
      assert.ok(fs.lstatSync(dependencyLink).isSymbolicLink(), 'Only unlink the fixture dependency junction');
      fs.unlinkSync(dependencyLink);
    }
    fs.rmSync(root, { recursive: true, force: true });
  });
  fs.mkdirSync(isolatedClient);
  fs.mkdirSync(isolatedServer);
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}\n');
  fs.copyFileSync(path.join(repositoryRoot, 'server', 'package.json'), path.join(isolatedServer, 'package.json'));
  // This config-only fixture uses the installed server dotenv without adding a
  // client dependency. Cleanup unlinks the junction before removing the fixture.
  fs.symlinkSync(path.join(repositoryRoot, 'server', 'node_modules'), dependencyLink, 'junction');
  for (const filename of ['vite.config.ts', 'vite.admin-audit.config.ts', 'app-shell-manifest.mjs']) {
    fs.copyFileSync(path.join(clientRoot, filename), path.join(isolatedClient, filename));
  }
  if (envText) fs.writeFileSync(path.join(isolatedServer, '.env'), envText);
  return {
    root,
    server: isolatedServer,
    load: async (filename = 'vite.config.ts', mode = 'development') => {
      const loaded = await loadConfigFromFile({ command: 'serve', mode }, path.join(isolatedClient, filename), isolatedClient, 'silent');
      assert.ok(loaded, 'Actual Vite config must load');
      return loaded.config;
    },
  };
}

function assertProxyTargets(config, port) {
  for (const route of ['/api', '/uploads', '/socket.io']) {
    assert.equal(config.server?.proxy?.[route]?.target, `http://127.0.0.1:${port}`, `${route} must use the selected backend port`);
    assert.equal(config.server.proxy[route].changeOrigin, true);
  }
  assert.equal(config.server.proxy['/socket.io'].ws, true, 'Custom port must keep the Socket.IO WebSocket proxy enabled');
}

test('fresh localhost setup backend PORT reaches API, uploads, and Socket.IO without exposing server secrets', async t => {
  const item = fixture(t, `PORT=5843\nJWT_SECRET=${secretSentinel}\nDATABASE_URL=file:./data/disposable.db\n`);
  const originalSecret = process.env.JWT_SECRET;
  const config = await item.load();
  assertProxyTargets(config, 5843);
  assert.equal(config.server.host, '127.0.0.1');
  assert.equal(config.server.port, 5173);
  assert.equal(config.envDir, undefined, 'Server environment must not become the client environment directory');
  assert.ok(config.envPrefix === undefined || config.envPrefix === 'VITE_', 'Do not expose all server environment variables to the browser');
  assert.equal(JSON.stringify(config.define || {}).includes(secretSentinel), false);
  assert.equal(JSON.stringify(config.define || {}).includes('JWT_SECRET'), false);
  assert.equal(process.env.PORT === undefined, true, 'Loading frontend config must not populate backend PORT into process.env');
  assert.equal(process.env.JWT_SECRET === originalSecret, true, 'Reading backend config must not mutate process secrets');
});

test('missing backend PORT retains the conventional 5000 proxy target', async t => {
  const item = fixture(t);
  assertProxyTargets(await item.load(), 5000);
});

test('invalid backend PORT fails clearly instead of routing requests to an unrelated default server', async t => {
  const item = fixture(t);
  for (const invalid of ['0', '1023', '65536', '-1', '5843abc', '5843.5']) {
    fs.writeFileSync(path.join(item.server, '.env'), `PORT=${invalid}\n`);
    await assert.rejects(item.load(), /PORT/i, `Invalid PORT=${invalid} must stop config loading with a named PORT error`);
  }
});

test('backend server .env beats root .env; mode files are ignored and explicit process PORT wins', async t => {
  const item = fixture(t, 'export PORT="5843" # dotenv quote/comment syntax\n');
  fs.writeFileSync(path.join(item.root, '.env'), 'PORT=5842\n');
  for (const [filename, port] of [['.env.local', 5844], ['.env.development', 5845], ['.env.development.local', 5846], ['.env.production', 5847]]) {
    fs.writeFileSync(path.join(item.server, filename), `PORT=${port}\n`);
  }
  assertProxyTargets(await item.load(), 5843);
  assertProxyTargets(await item.load('vite.config.ts', 'production'), 5843);
  assert.equal(process.env.PORT === undefined, true, 'File parsing must not mutate process PORT');
  fs.unlinkSync(path.join(item.server, '.env'));
  assertProxyTargets(await item.load(), 5842);
  assertProxyTargets(await item.load('vite.config.ts', 'production'), 5842);
  process.env.PORT = '5848';
  assertProxyTargets(await item.load(), 5848);
  assertProxyTargets(await item.load('vite.config.ts', 'production'), 5848);
});

test('audit config keeps its isolated 5510 backend and strict 5511 frontend after base becomes a factory', async t => {
  const item = fixture(t, `PORT=5843\nJWT_SECRET=${secretSentinel}\n`);
  const config = await item.load('vite.admin-audit.config.ts');
  assertProxyTargets(config, 5510);
  assert.equal(config.server.port, 5511);
  assert.equal(config.server.strictPort, true);
  assert.equal(config.envDir, undefined);
  assert.equal(JSON.stringify(config.define || {}).includes(secretSentinel), false);
});
