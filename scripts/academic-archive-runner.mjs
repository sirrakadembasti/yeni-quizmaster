// Owns a disposable project root; never reads the deployment .env or database.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { waitForAuditServer } from './audit-server-readiness.mjs';
import { verifyFixturePortsReleased } from './linux-owned-process-cleanup.mjs';
import { launchOwned, cleanupOwned } from './academic-owned-process.mjs';
const repo = path.resolve(import.meta.dirname, '..');
const req = createRequire(path.join(repo, 'server/package.json'));
const clientReq = createRequire(path.join(repo, 'client/package.json'));
const rootReq = createRequire(path.join(repo, 'package.json'));
const protectedFiles = ['server/data/quiz.db', 'client/src/lib/api.ts', 'client/src/pages/server-setup.tsx'];
const hashes = () => protectedFiles.map(file => createHash('sha256').update(fs.readFileSync(path.join(repo, file))).digest('hex'));
const before = hashes();
const root = fs.mkdtempSync(path.join(repo, 'server/data/quizmaster-test-academic-'));
const children = [];
let ports = [];
let cancelled = false;
const cancel = () => {
  cancelled = true;
  for (const state of children) void cleanupOwned(state).catch(error => { state.cleanupError = error; });
};
process.once('SIGINT', cancel);
process.once('SIGTERM', cancel);
async function port() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}
// Only operating-system runtime variables are inherited; credentials are absent.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|LOCALAPPDATA|APPDATA|USERPROFILE|HOME)$/i.test(key)));
async function launch(args, cwd = root) {
  if (cancelled) throw new Error('Fixture run cancelled');
  return launchOwned(args, { cwd, env, onState: state => children.push(state) });
}
try {
  for (const directory of ['server/data', 'server/uploads', 'client', 'artifacts']) fs.mkdirSync(path.join(root, directory), { recursive: true });
  for (const directory of ['server', 'client']) fs.writeFileSync(path.join(root, directory, 'package.json'), '{}');
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(root, '.env'), '# Disposable fixture: no credentials\n');
  fs.writeFileSync(path.join(root, 'server/.env'), '# Disposable fixture: no credentials\n');
  if (process.argv.includes('--startup-failure-smoke')) {
    const failed = await launch([path.join(root, 'absent-entry.mjs')]);
    let rejected = false;
    try { await waitForAuditServer('http://127.0.0.1:1', failed, { timeoutMs: 5000 }); }
    catch { rejected = true; }
    if (!rejected) throw new Error('Startup failure was not detected');
    console.log('Owned startup failure detected');
  } else {
  fs.mkdirSync(path.join(root, 'server/prisma'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'server/prisma/schema.prisma'), path.join(root, 'server/prisma/schema.prisma'));
  fs.cpSync(path.join(repo, 'server/prisma/migrations'), path.join(root, 'server/prisma/migrations'), { recursive: true });
  const apiPort = await port();
  let uiPort = await port();
  while (uiPort === apiPort) uiPort = await port();
  ports = [apiPort, uiPort];
  const database = path.join(root, 'server/data/academic.db');
  const runtime = { root, database, ports: [apiPort, uiPort], baseURL: `http://127.0.0.1:${uiPort}` };
  const runtimeFile = path.join(root, 'runtime.json');
  fs.writeFileSync(runtimeFile, JSON.stringify(runtime));
  Object.assign(env, { DATABASE_URL: 'file:' + database.replaceAll('\\', '/'), SESSION_SECRET: 'disposable-academic-fixture-secret', PORT: String(apiPort), HOST: '127.0.0.1', NODE_ENV: 'development', FRONTEND_URL: runtime.baseURL, ALLOWED_ORIGINS: runtime.baseURL, ARCHIVE_BACKUP_ROOT: path.join(root, 'artifacts'), CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1', RUST_LOG: 'info', ACADEMIC_ARCHIVE_RUNTIME: runtimeFile });
  const migrationStart = Date.now();
  // Windows measured 14/17 migrations in 120s; allow 17 at that observed
  // rate plus 30s CLI startup, with a hard bound independent of browser tests.
  const migration = spawnSync(process.execPath, [req.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', path.join(root, 'server/prisma/schema.prisma')], { cwd: root, env, windowsHide: true, encoding: 'utf8', timeout: 180000 });
  if (migration.status !== 0) throw new Error(`Disposable migration failed: ${migration.error?.message ?? ''}\n${migration.stdout}\n${migration.stderr}`);
  console.log(`Disposable migrations completed in ${Date.now() - migrationStart}ms`);
  const entry = path.join(root, 'entry.mjs');
  fs.writeFileSync(entry, `import { createRequire } from 'node:module';\nconst require = createRequire(${JSON.stringify(path.join(repo, 'server/package.json'))});\nconst { PrismaClient } = require('@prisma/client');\nconst bcrypt = require('bcryptjs');\nconst db = new PrismaClient();\ntry { await db.user.create({ data: { id: 'academic-admin', name: 'Synthetic Academic Admin', email: 'academic-admin@example.test', role: 'admin', password: await bcrypt.hash('AcademicFixtureOnly2026!', 10) } }); } finally { await db.$disconnect(); }\nawait import(${JSON.stringify('file:///' + path.join(repo, 'server/index.ts').replaceAll('\\', '/'))});\n`);
  const api = await launch(['--import', pathToFileURL(req.resolve('tsx')).href, entry]);
  await waitForAuditServer(`http://127.0.0.1:${apiPort}/api/csrf-token`, api);
  const viteEntry = path.join(root, 'ui.mjs');
  fs.writeFileSync(viteEntry, `import { loadConfigFromFile, createServer } from ${JSON.stringify('file:///' + clientReq.resolve('vite').replaceAll('\\', '/'))};\nconst loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' }, ${JSON.stringify(path.join(repo, 'client/vite.config.ts'))});\nconst server = await createServer({ ...loaded.config, configFile: false, root: ${JSON.stringify(path.join(repo, 'client'))}, envDir: ${JSON.stringify(root)}, server: { ...loaded.config.server, host: '127.0.0.1', port: ${uiPort}, strictPort: true } });\nawait server.listen();\n`);
  const ui = await launch([viteEntry]);
  await waitForAuditServer(runtime.baseURL + '/auth', ui);
  if (!process.argv.includes('--smoke')) {
    const tests = await launch([path.join(path.dirname(rootReq.resolve('playwright/package.json')), 'cli.js'), 'test', '-c', path.join(repo, 'playwright.academic-archive.config.ts'), ...process.argv.slice(2)], repo);
    process.exitCode = await tests.finished;
  } else {
    const { chromium } = rootReq('playwright');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      // The app injects Google Fonts while online. Acceptance is local and
      // must not wait on or send requests to third-party font/image services.
      await page.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort());
      await page.goto(runtime.baseURL + '/auth', { waitUntil: 'domcontentloaded' });
      const csrf = await (await page.request.get(runtime.baseURL + '/api/csrf-token')).json();
      const response = await page.request.post(runtime.baseURL + '/api/auth/login', { data: { email: 'academic-admin@example.test', password: 'AcademicFixtureOnly2026!' }, headers: { 'x-csrf-token': csrf.csrfToken } });
      if (response.status() !== 200) throw new Error('Synthetic browser login failed');
      const me = await (await page.request.get(runtime.baseURL + '/api/auth/me')).json();
      if (me.user.email !== 'academic-admin@example.test') throw new Error('Synthetic browser identity mismatch');
      await page.goto(runtime.baseURL + '/archive', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: /Arşiv/ }).first().waitFor({ state: 'visible', timeout: 30000 });
      await page.getByLabel('Eğitim yılı', { exact: true }).waitFor({ state: 'visible', timeout: 30000 });
      console.log('Isolated Chromium navigation and admin login passed');
    } finally { await browser.close(); }
  }
  }
} catch (error) {
  console.error('Fixture run failed:', error);
  throw error;
} finally {
  const cleanupErrors = [];
  for (const state of children.reverse()) {
    try {
      await cleanupOwned(state);
    } catch (error) { cleanupErrors.push(error); }
  }
  if (ports.length && !(await verifyFixturePortsReleased(ports)).every(result => result.stopped)) cleanupErrors.push(new Error('Owned fixture ports remain occupied'));
  if (JSON.stringify(before) !== JSON.stringify(hashes())) cleanupErrors.push(new Error('Protected database or user files changed'));
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Fixture cleanup failed; root preserved for diagnosis');
  if (path.dirname(root) !== path.join(repo, 'server/data') || !path.basename(root).startsWith('quizmaster-test-academic-')) throw new Error('Unsafe fixture cleanup target');
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  console.log('Owned fixture removed; protected file hashes preserved');
  process.removeListener('SIGINT', cancel);
  process.removeListener('SIGTERM', cancel);
}
