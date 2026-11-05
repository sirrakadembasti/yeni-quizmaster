// Native Windows fallback: real student fixture, Chromium and owned tree cleanup.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { waitForAuditServer } from './audit-server-readiness.mjs';
import { verifyFixturePortsReleased } from './linux-owned-process-cleanup.mjs';
import { cleanupStartupChild } from './server-startup-child-cleanup.mjs';
import { sanitizeStudentAuditReportFile } from './student-audit-report-sanitize.mjs';
if (process.platform !== 'win32') throw new Error('Use the native Linux runner on Linux.');
const root = path.resolve(import.meta.dirname, '..'), out = path.join(root, 'tests/denetim-kanitlari/ogrenci');
fs.mkdirSync(path.join(out, 'runtime-logs'), { recursive: true });
const label = process.env.STUDENT_AUDIT_RUN || 'verification';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid run label');
const report = { startedAt: new Date().toISOString(), platform: process.platform, node: process.version, cleanup: [] };
const states = [];
const req = createRequire(path.join(root, 'package.json'));
const serverReq = createRequire(path.join(root, 'server/package.json'));
const clientReq = createRequire(path.join(root, 'client/package.json'));
function launch(args, name, env = {}) {
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1', FORCE_COLOR: '0', ...env },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const state = { child, errorCode: null, name };
  child.on('error', error => { state.errorCode = error.code; });
  const log = fs.createWriteStream(path.join(out, 'runtime-logs', `${label}-${name}.log`));
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  child.once('close', () => log.end());
  states.push(state); return state;
}
try {
  if (!(await verifyFixturePortsReleased([5540,5541])).every(x => x.stopped)) throw new Error('Fixture ports occupied');
  const api = launch([serverReq.resolve('tsx/cli'), 'server/tests/student-audit-server.ts'], 'api');
  await waitForAuditServer('http://127.0.0.1:5540/api/csrf-token', api, { timeoutMs: 300000 });
  const ui = launch([path.join(path.dirname(clientReq.resolve('vite/package.json')), 'bin/vite.js'), 'client', '--host', '127.0.0.1', '--port', '5541', '--strictPort'], 'ui', { PORT: '5540' });
  await waitForAuditServer('http://127.0.0.1:5541/auth', ui);
  console.log('Disposable student servers ready');
  const latestPath = path.join(out, 'results-latest.json');
  if (fs.existsSync(latestPath)) fs.unlinkSync(latestPath);
  const testStartedAt = Date.now();
  const tests = launch([path.join(path.dirname(req.resolve('playwright/package.json')), 'cli.js'), 'test', '-c', 'tests/yapilandirma/playwright.student-audit.config.ts', ...process.argv.slice(2)], 'playwright');
  const code = await new Promise(resolve => { tests.child.once('exit', resolve); tests.child.once('error', () => resolve(1)); });
  report.testExitCode = code;
  const fresh = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
  if (!(Date.parse(fresh.stats?.startTime) >= testStartedAt)) throw new Error('Playwright report is stale or missing start time');
  report.sanitation = sanitizeStudentAuditReportFile(path.join(out, 'results-latest.json'));
  fs.copyFileSync(path.join(out, 'results-latest.json'), path.join(out, `results-${label}.json`));
  report.status = code === 0 ? 'passed' : 'tests-failed';
  if (code !== 0) process.exitCode = 1;
} catch (error) { report.status = 'runner-failed'; report.error = error.message; process.exitCode = 1; }
finally {
  for (const state of states.reverse()) {
    if (state.child.exitCode !== null || state.child.signalCode !== null) {
      report.cleanup.push({ name: state.name, exited: true, exitCode: state.child.exitCode }); continue;
    }
    const stopped = await cleanupStartupChild(state.child, {}, async () => {
      if (state.child.exitCode !== null || state.child.signalCode !== null) throw new Error('Owned child already exited');
      const kill = spawnSync('taskkill', ['/PID', String(state.child.pid), '/T', '/F'], { windowsHide: true, timeout: 15000, stdio: 'pipe' });
      if (kill.status !== 0) throw new Error('Owned tree termination failed');
    }, 15000);
    report.cleanup.push({ name: state.name, ...stopped });
  }
  report.ports = await verifyFixturePortsReleased([5540,5541]);
  report.cleanupSucceeded = report.cleanup.every(x => x.exited || x.stopProven) && report.ports.every(x => x.stopped);
  if (!report.cleanupSucceeded) { report.status = 'cleanup-failed'; process.exitCode = 1; }
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(out, `runner-${label}.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
