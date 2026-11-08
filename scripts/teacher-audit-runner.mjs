// Native Linux runner; disposable DB created by teacher-audit-server.ts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { resolveLocalBin } from './package-manager.mjs';
import { captureOwnedLinuxProcesses, cleanupOwnedLinuxProcesses, verifyFixturePortsReleased } from './linux-owned-process-cleanup.mjs';
import { releaseOwnedChildHandles } from './server-startup-child-cleanup.mjs';
import { waitForAuditServer } from './audit-server-readiness.mjs';
import { sanitizeTeacherAuditReportFile } from './teacher-audit-report-sanitize.mjs';
if (process.platform !== 'linux') throw new Error('Run this isolated runner with native Linux Node.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tests/denetim-kanitlari/ogretmen');
const logs = path.join(out, 'runtime-logs');
fs.mkdirSync(logs, { recursive: true });
const report = { startedAt: new Date().toISOString(), platform: process.platform, node: process.version,
  status: 'running', ports: [5530, 5531], cleanup: [] };
const save = () => fs.writeFileSync(path.join(out, 'runner-result.json'), JSON.stringify(report, null, 2) + '\n');
const states = [];
// Yerel bin dosyaları doğrudan Node ile çalıştırılır (npm exec kayıt defterinden paket indirebilir).
function launch(args, name, env = {}, cwd = root) {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, FORCE_COLOR: '0', ...env }, detached: true,
    stdio: ['ignore', 'pipe', 'pipe'] });
  const state = { child, knownProcesses: new Map(), errorCode: null };
  child.on('error', error => { state.errorCode = error.code || 'SPAWN_FAILED'; });
  const stream = fs.createWriteStream(path.join(logs, `${name}.log`));
  child.stdout.pipe(stream, { end: false }); child.stderr.pipe(stream, { end: false });
  if (name === 'playwright') {
    let pending = '';
    child.stdout.on('data', chunk => {
      pending = (pending + chunk.toString()).slice(-8000);
      const lines = pending.split('\n'); pending = lines.pop();
      for (const line of lines) if (/^\s*[✓✘]\s+\d+\s/.test(line)) console.log(line.trim());
    });
  }
  child.once('close', () => stream.end());
  states.push(state); captureOwnedLinuxProcesses(state);
  return state;
}
async function ready(url, state) {
  await waitForAuditServer(url, state);
}
const inventory = setInterval(() => { for (const state of states) captureOwnedLinuxProcesses(state); }, 500);
inventory.unref(); save();
try {
  const ports = await verifyFixturePortsReleased(report.ports);
  if (!ports.every(item => item.stopped)) throw new Error('Audit ports are occupied; no holder was stopped');
  const api = launch([resolveLocalBin(root, 'server', 'tsx'), 'tests/teacher-audit-server.ts'], 'api', {}, path.join(root, 'server'));
  await ready('http://127.0.0.1:5530/api/csrf-token', api);
  const ui = launch([resolveLocalBin(root, 'client', 'vite'), '--host', '127.0.0.1', '--port', '5531', '--strictPort'],
    'ui', { PORT: '5530' }, path.join(root, 'client'));
  await ready('http://127.0.0.1:5531/auth', ui);
  console.log('Isolated teacher API and frontend ready on 5530/5531');
  const tests = launch([resolveLocalBin(root, null, '@playwright/test', 'playwright'), 'test', '-c', 'tests/yapilandirma/playwright.teacher-audit.config.ts', ...process.argv.slice(2)], 'playwright');
  const code = await new Promise(resolve => {
    tests.child.once('exit', resolve); tests.child.once('error', () => resolve(1));
  });
  report.reportSanitation = sanitizeTeacherAuditReportFile(path.join(out, 'results-latest.json'));
  report.testExitCode = code; report.status = code === 0 ? 'passed' : 'tests-failed';
  if (code !== 0) process.exitCode = 1;
} catch (error) {
  report.status = 'runner-failed'; report.error = error.message; process.exitCode = 1;
} finally {
  clearInterval(inventory);
  for (const state of states.reverse()) {
    try { report.cleanup.push(await cleanupOwnedLinuxProcesses(state, { timeoutMs: 15000 })); }
    finally { releaseOwnedChildHandles(state.child); }
  }
  report.cleanup.push(...await verifyFixturePortsReleased(report.ports));
  report.cleanupSucceeded = report.cleanup.every(item => item.stopped);
  if (!report.cleanupSucceeded) { report.status = 'cleanup-failed'; process.exitCode = 1; }
  report.finishedAt = new Date().toISOString(); save();
  console.log(JSON.stringify({ status: report.status, testExitCode: report.testExitCode,
    cleanupSucceeded: report.cleanupSucceeded, error: report.error }));
}
