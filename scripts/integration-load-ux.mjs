// Real HTTP/Chromium checks against a migrated disposable fixture only.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { waitForAuditServer } from './audit-server-readiness.mjs';
import { verifyFixturePortsReleased } from './linux-owned-process-cleanup.mjs';
import { cleanupStartupChild } from './server-startup-child-cleanup.mjs';
const root = path.resolve(import.meta.dirname, '..'), out = path.join(root, 'tests/denetim-kanitlari/entegrasyon');
const req = createRequire(path.join(root, 'package.json'));
const srv = createRequire(path.join(root, 'server/package.json'));
const cli = createRequire(path.join(root, 'client/package.json'));
const { chromium, request } = req('playwright');
fs.mkdirSync(path.join(out, 'runtime-logs'), { recursive: true });
const hash = () => createHash('sha256').update(fs.readFileSync(path.join(root, 'server/data/quiz.db'))).digest('hex');
const uxOnly = process.env.INTEGRATION_UX_ONLY === '1';
const loadOnly = process.env.INTEGRATION_LOAD_ONLY === '1';
const reuse = uxOnly || loadOnly;
const requestCount = loadOnly ? Number(process.env.INTEGRATION_LOAD_REQUESTS || 180) : 180;
assert(Number.isInteger(requestCount) && requestCount >= 6 && requestCount <= 180);
const concurrencyLevels = loadOnly && process.env.INTEGRATION_LOAD_CONCURRENCY ? process.env.INTEGRATION_LOAD_CONCURRENCY.split(',').map(Number) : [2, 8, 20];
assert(concurrencyLevels.every(x => [2, 8, 20].includes(x)));
const report = { startedAt: new Date().toISOString(), mode: loadOnly ? 'load-only' : uxOnly ? 'ux-only' : 'load-and-ux', databaseHashBefore: hash(), load: [], ux: [], cleanup: [] };
const states = [], contexts = [];
let browser;
function launch(args, name, env = {}) {
  const child = spawn(process.execPath, args, { cwd: root, windowsHide: true,
    env: { ...process.env, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const state = { child, name }; child.on('error', e => { state.errorCode = e.code; });
  report.ownedProcesses ??= [];
  report.ownedProcesses.push({ name, pid: child.pid });
  const log = fs.createWriteStream(path.join(out, 'runtime-logs', name + '.log'));
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false }); child.on('close', () => log.end());
  states.push(state); return state;
}
async function login(context, role) {
  const csrf = await (await context.get('/api/csrf-token')).json();
  const email = role === 'parent' ? 'parent-audit@example.test' : role === 'student' ? 'parent-audit-child@example.test' : `parent-audit-${role}@example.test`;
  const result = await context.post('/api/auth/login', { data: { email, password: 'StudentAuditOnly2026!' }, headers: { 'x-csrf-token': csrf.csrfToken } });
  assert.equal(result.status(), 200);
}
try {
  assert((await verifyFixturePortsReleased([5560, 5561])).every(x => x.stopped), 'Ports occupied; refusing existing process');
  const fixtureIdentity = randomUUID();
  const api = launch([srv.resolve('tsx/cli'), reuse ? 'server/tests/integration-reuse-server.ts' : 'server/tests/parent-audit-server.ts'], 'api', { INTEGRATION_AUDIT_ID: fixtureIdentity });
  await waitForAuditServer('http://127.0.0.1:5560/api/csrf-token', api, { timeoutMs: 300000 });
  const proof = await fetch('http://127.0.0.1:5560/api/csrf-token');
  assert.equal(proof.headers.get('x-quizmaster-audit-fixture'), fixtureIdentity, 'Running service is not the owned fixture');
  await proof.body.cancel();
  const runtime = JSON.parse(fs.readFileSync(path.join(root, 'tests/denetim-kanitlari/veli/runtime.json')));
  assert.equal(path.dirname(path.resolve(runtime.root)), path.join(root, 'server/data'));
  assert(path.basename(runtime.root).startsWith('quizmaster-test-parent-audit-'));
  runtime.integrationIdentity = fixtureIdentity;
  fs.writeFileSync(path.join(root, 'tests/denetim-kanitlari/veli/runtime.json'), JSON.stringify(runtime, null, 2));
  report.isolatedFixture = true;
  report.fixtureIdentityVerified = true;
  const users = {};
  for (const role of ['admin', 'teacher', 'student', 'parent']) {
    const context = await request.newContext({ baseURL: 'http://127.0.0.1:5560' });
    contexts.push(context); await login(context, role); users[role] = context;
  }
  const jobs = [ ['student', '/api/student/quizzes'], ['student', '/api/student/results'],
    ['parent', '/api/parents/students'], ['parent', '/api/parents/students/parent-audit-student/overview'],
    ['teacher', '/api/quizzes'], ['admin', '/api/notifications'] ];
  // Closed-loop bounded stress: not a production capacity or concurrent-user guarantee.
  for (const concurrency of uxOnly ? [] : concurrencyLevels) {
    const durations = [], statuses = {}, errors = {}; let cursor = 0;
    const started = performance.now();
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (cursor < requestCount) {
        const index = cursor++, [role, url] = jobs[index % jobs.length], start = performance.now();
        try {
          const response = await users[role].get(url, { timeout: 15000 });
          const body = await response.json();
          statuses[response.status()] = (statuses[response.status()] || 0) + 1;
          if (JSON.stringify(body).includes('Private Other Learner')) throw new Error('Foreign student leak');
        } catch (error) { statuses.requestError = (statuses.requestError || 0) + 1;
          // Capture a bounded reason without Playwright's cookie-bearing call log.
          const reason = String(error.message || '').split('\n')[0].replace(/https?:\/\/\S+/g, '[fixture-url]').slice(0, 160);
          const code = error.name + '/' + (error.cause?.code || 'none') + '/' + reason; errors[code] = (errors[code] || 0) + 1; }
        durations.push(performance.now() - start);
      }
    }));
    const elapsedMs = performance.now() - started;
    durations.sort((a, b) => a - b);
    report.load.push({ concurrency, requests: durations.length, statuses, errors, elapsedMs: Math.round(elapsedMs),
      requestsPerSecond: +(durations.length / (elapsedMs / 1000)).toFixed(2),
      p50Ms: Math.round(durations[Math.ceil(durations.length * .5) - 1]),
      p95Ms: Math.round(durations[Math.ceil(durations.length * .95) - 1]), maxMs: Math.round(durations.at(-1)),
      passed: statuses[200] === requestCount && !statuses.requestError });
    console.log(JSON.stringify(report.load.at(-1)));
  }
  if (!loadOnly) {
  const ui = launch([path.join(path.dirname(cli.resolve('vite/package.json')), 'bin/vite.js'), 'client', '--host', '127.0.0.1', '--port', '5561', '--strictPort'], 'ui', { PORT: '5560' });
  await waitForAuditServer('http://127.0.0.1:5561/auth', ui);
  browser = await chromium.launch({ headless: true });
  report.mobileSkipped = process.env.INTEGRATION_UX_EXTRA === '1' || process.env.INTEGRATION_UX_DETAIL_ONLY === '1';
  for (const [role, route] of report.mobileSkipped ? [] : [['student', '/student/dashboard'], ['student', '/student/quizzes'], ['student', '/my-stats'],
    ['student', '/student/survey/55555555-5555-4555-8555-555555555555'], ['teacher', '/quizzes'], ['teacher', '/student/results'],
    ['admin', '/management'], ['parent', '/parent/dashboard'], ['parent', '/parent/results']]) {
    const context = await browser.newContext({ storageState: await users[role].storageState(), viewport: { width: 390, height: 844 } });
    const page = await context.newPage(), errors = [], failures = [];
    page.on('pageerror', error => errors.push(error.name));
    page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 400) failures.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    const start = performance.now(); await page.goto('http://127.0.0.1:5561' + route);
    await page.locator('main').waitFor({ timeout: 30000 });
    let networkSettled = true;
    try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch { networkSettled = false; }
    const controls = await page.locator('main').evaluate(element => [...element.querySelectorAll('button,input,select,textarea')].map(e => ({ tag: e.tagName.toLowerCase(), type: e.getAttribute('type'), text: e.textContent?.trim().slice(0, 80), ariaLabel: e.getAttribute('aria-label'), labelledBy: e.getAttribute('aria-labelledby'), placeholder: e.getAttribute('placeholder'), id: e.id, label: e.id ? document.querySelector(`label[for="${CSS.escape(e.id)}"]`)?.textContent?.trim() : null, pressed: e.getAttribute('aria-pressed'), checked: e.getAttribute('aria-checked') })));
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    const stem = role + '-' + route.replaceAll('/', '-');
    await page.screenshot({ path: path.join(out, stem + '.png'), fullPage: true });
    fs.writeFileSync(path.join(out, stem + '-aria.txt'), await page.locator('main').ariaSnapshot());
    report.ux.push({ role, route, urlPath: new URL(page.url()).pathname, viewport: '390x844', networkSettled, elapsedMs: Math.round(performance.now() - start), horizontalOverflow, errors, failures, controls });
    console.log(JSON.stringify({ role, route, horizontalOverflow, errors, failures }));
    await context.close();
  }
  const detail = spawn(process.execPath, [process.env.INTEGRATION_UX_EXTRA === '1' ? 'scripts/integration-ux-print-extra.mjs' : 'scripts/integration-ux-detail.mjs'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  detail.stdout.on('data', value => process.stdout.write(value));
  detail.stderr.on('data', () => {});
  report.detailExitCode = await new Promise(resolve => { detail.once('error', () => resolve(1)); detail.once('exit', resolve); });
  const extra = process.env.INTEGRATION_UX_EXTRA === '1';
  const detailReport = JSON.parse(fs.readFileSync(path.join(out, extra ? 'ux-extra-results.json' : 'ux-detail-results.json')));
  report.detailCoverageComplete = detailReport.checks?.length === (extra ? 2 : 16)
    && detailReport.checks.every(x => x.status === 'passed') && !detailReport.runnerError && !detailReport.error;
  report.mobileAccepted = report.ux.every(x => x.networkSettled && !x.horizontalOverflow && x.errors.length === 0 && x.failures.length === 0);
  } else {
    report.detailExitCode = 0; report.detailCoverageComplete = true; report.mobileAccepted = true;
  }
  report.status = report.load.every(x => x.passed) ? 'executed' : 'load-failed';
} catch (error) { report.status = 'runner-failed'; report.error = error.name + ': ' + error.message; process.exitCode = 1; }
finally {
  await browser?.close();
  for (const context of contexts) await context.dispose();
  for (const state of states.reverse()) {
    report.cleanup.push({ name: state.name, ...(await cleanupStartupChild(state.child, {}, async () => {
      if (state.child.exitCode !== null || state.child.signalCode !== null) throw new Error('Already exited');
      const kill = spawnSync('taskkill', ['/PID', String(state.child.pid), '/T', '/F'], { windowsHide: true, timeout: 15000, stdio: 'pipe' });
      if (kill.status !== 0) throw new Error('Tree cleanup failed');
    }, 15000)) });
  }
  report.ports = await verifyFixturePortsReleased([5560, 5561]);
  report.databaseHashAfter = hash(); report.databaseUnchanged = report.databaseHashBefore === report.databaseHashAfter;
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(out, loadOnly ? (process.env.INTEGRATION_LOAD_REPORT || 'load-repair-results.json') : process.env.INTEGRATION_UX_EXTRA === '1' ? 'ux-extra-runner-results.json' : uxOnly ? 'ux-runner-results.json' : 'load-ux-results.json'), JSON.stringify(report, null, 2) + '\n');
  if (!report.databaseUnchanged || report.cleanup.some(x => !x.stopProven) || report.ports.some(x => !x.stopped) || report.status !== 'executed' || report.detailExitCode !== 0 || !report.mobileAccepted || !report.detailCoverageComplete) process.exitCode = 1;
  console.log(JSON.stringify({ status: report.status, databaseUnchanged: report.databaseUnchanged, cleanup: report.cleanup, ports: report.ports }));
}
