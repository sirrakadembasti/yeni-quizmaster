// Real installer/browser runner. No dependency junctions, storage mocks or source resets.
// Run from the reviewed checkout; each entrypoint receives its own fresh source copy.
import { createInvocation, resolveLocalBin } from './package-manager.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { releaseOwnedChildHandles } from './server-startup-child-cleanup.mjs';
import { linuxProcessSnapshot, captureOwnedLinuxProcesses, cleanupOwnedLinuxProcesses, verifyFixturePortsReleased } from './linux-owned-process-cleanup.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = process.argv[2] || 'terminal';
const full = process.argv.includes('--apply');
assert(['terminal', 'bat', 'sh'].includes(entry), 'Use terminal, bat or sh');
const root = fs.mkdtempSync(path.join(os.tmpdir(), `quizmaster-fresh-${entry}-`));
const evidence = path.join(root, 'closure-evidence');
fs.mkdirSync(evidence);
const protectedFiles = ['server/.env', 'server/data/quiz.db', 'server/data/sessions.db',
  'server/data/deployment-config.json', 'server/data/installation.lock',
  'client/src/lib/api.ts', 'client/src/pages/server-setup.tsx'];
const digest = file => fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
const before = Object.fromEntries(protectedFiles.map(file => [file, digest(path.join(source, file))]));
const files = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: source, encoding: 'utf8', windowsHide: true, timeout: 10000,
});
assert.equal(files.status, 0, 'Source inventory failed');
const markerInventory = spawnSync('git', ['ls-files', '--cached', '--', 'server/data/README.md'], {
  cwd: source, encoding: 'utf8', windowsHide: true, timeout: 10000 });
assert.equal(markerInventory.status, 0, 'Tracked directory marker inventory failed');
const trackedDataMarker = markerInventory.stdout.trim() === 'server/data/README.md';
const rootFiles = new Set(['package.json', 'package-lock.json', 'kurulum.bat', 'kurulum.sh', 'start-local.ps1']);
const excluded = new Set(['node_modules', 'data', 'uploads', 'backups', 'dist', 'coverage', '.git', '.agents', '.codex', 'test-results', 'playwright-report']);
let copied = 0;
for (const file of files.stdout.split('\0').filter(Boolean)) {
  const parts = file.replaceAll('\\', '/').split('/');
  if (!rootFiles.has(file) && !['client', 'server', 'scripts'].includes(parts[0])) continue;
  const directoryMarker = trackedDataMarker && parts.join('/') === 'server/data/README.md';
  if ((!directoryMarker && parts.some(part => excluded.has(part) || part === '.env' || part.startsWith('.env.')))
    || /\.(db|sqlite|sqlite3)(-|$)/i.test(file)) continue;
  const from = path.join(source, file);
  if (!fs.existsSync(from)) continue;
  assert(fs.lstatSync(from).isFile(), `Source symlink/directory rejected: ${file}`);
  const destination = path.join(root, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(from, destination);
  copied++;
}
for (const file of protectedFiles.slice(0, 5)) assert(!fs.existsSync(path.join(root, file)), `Fixture is not fresh: ${file}`);
assert(!fs.existsSync(path.join(root, 'node_modules')));
const report = { date: new Date().toISOString(), entry, fullApplyRequested: full, root, copiedSourceFiles: copied,
  runtime: { platform: process.platform, node: process.version, arch: process.arch, osRelease: os.release() },
  initialState: 'source-only; no env/database/config/lock/node_modules', phases: [], status: 'running' };
const save = () => fs.writeFileSync(path.join(evidence, 'result.json'), `${redact(JSON.stringify(report, null, 2))}\n`);
const secrets = new Set();
const redact = text => {
  const credentialHeader = /^(?:cookie|set-cookie|authorization|proxy-authorization|x-csrf-token|x-setup-csrf)$/i;
  const secretField = /^(?:csrfToken|sessionSecret|password|token)$/i;
  const scalar = value => {
    let safe = String(value)
      .replace(/(?:\x1b|\\u001b|\\x1b)\[[0-?]*[ -/]*[@-~]/gi, '')
      .replace(/^[^\r\n]*\b(?:set-cookie|cookie|authorization|proxy-authorization|x-csrf-token|x-setup-csrf)\b[\\"']*\s*[:=][^\r\n]*/gmi, '[redacted credential header]')
      .replace(/([?&]token=)[A-Za-z0-9_-]+/g, '$1[redacted]')
      .replace(/("(?:csrfToken|sessionSecret|password|token)"\s*:\s*)"[^"]*"/gi, '$1"[redacted]"')
      .replace(/\b(SESSION_SECRET|EMAIL_PASS|SETUP_TOKEN)\s*=\s*[^\r\n]+/gi, '$1=[redacted]');
    for (const secret of secrets) safe = safe.split(secret).join('[redacted]');
    return safe;
  };
  const walk = (value, depth) => {
    if (depth > 20) return '[redacted nested payload]';
    if (typeof value === 'string') return encoded(value, depth + 1);
    if (Array.isArray(value)) return value.map(item => walk(item, depth + 1));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) =>
      [key, credentialHeader.test(key) ? '[redacted credential header]' : secretField.test(key) ? '[redacted]' : walk(item, depth + 1)]));
    return value;
  };
  const encoded = (value, depth) => {
    if (depth > 20) return '[redacted nested payload]';
    try { return JSON.stringify(walk(JSON.parse(value), depth + 1), null, 2); }
    catch { return scalar(value); }
  };
  return encoded(String(text), 0);
};
save();
console.log(`Fresh fixture: ${root}`);
const progressStates = new Map();
let closing = false;
function recordProgress(stage, state) {
  if (closing) return;
  const snapshot = { recordedAt: new Date().toISOString(), stage,
    job: state.job ? { type: state.job.type, status: state.job.status, message: state.job.message,
      exitCode: state.job.exitCode, logs: (state.job.logs || []).slice(-250) } : undefined,
    apply: state.apply ? { status: state.apply.status, message: state.apply.message, steps: state.apply.steps } : undefined };
  const safe = JSON.parse(redact(JSON.stringify(snapshot)));
  const current = progressStates.get(stage) || {};
  const signature = JSON.stringify({ job: safe.job && [safe.job.type, safe.job.status, safe.job.logs], apply: safe.apply });
  if (signature !== current.signature) {
    fs.writeFileSync(path.join(evidence, `${stage}-progress.json`), `${JSON.stringify(safe, null, 2)}\n`);
    const logs = safe.job?.logs || [];
    if (logs.length) fs.writeFileSync(path.join(evidence, `${stage}-progress.log`), `${logs.join('\n')}\n`);
    report.lastProgress = { stage, jobStatus: safe.job?.status, jobExitCode: safe.job?.exitCode,
      message: safe.apply?.message || safe.job?.message,
      lastLogLines: logs.slice(-8), steps: safe.apply?.steps?.map(step => ({ id: step.id, status: step.status })) };
    save();
  }
  const phase = safe.apply
    ? `${safe.apply.status}; ${safe.apply.steps?.filter(step => step.status === 'running' || step.status === 'error').map(step => `${step.id}:${step.status}`).join(', ') || 'no active step'}`
    : `${safe.job?.type || stage}:${safe.job?.status || 'idle'}`;
  if (phase !== current.phase || Date.now() - (current.lastOutput || 0) >= 60000) {
    console.log(`[${new Date().toISOString()}] ${stage}: ${phase}`);
    current.lastOutput = Date.now();
  }
  progressStates.set(stage, { ...current, signature, phase });
}
function completedPhase(message) {
  captureOwnedProcesses();
  report.phases.push(message); save();
  console.log(`[${new Date().toISOString()}] completed: ${message}`);
}
const cleanEnv = { ...process.env, FORCE_COLOR: '0' };
for (const key of ['DATABASE_URL', 'SESSION_SECRET', 'NODE_ENV', 'PORT', 'HOST', 'APP_BASE_PATH', 'FRONTEND_URL',
  'ALLOWED_ORIGINS', 'TRUST_PROXY_HOPS', 'SETUP_TOKEN', 'SETUP_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM',
  'DEPLOYMENT_CONFIG_PATH', 'QUIZMASTER_PROJECT_ROOT', 'VITE_BASE_PATH', 'NODE_PATH']) delete cleanEnv[key];
const children = [];
function launch(command, args, cwd, env, logName) {
  const launchedAt = Date.now();
  const child = spawn(command, args, { cwd, env, windowsHide: true,
    detached: process.platform === 'linux', stdio: ['ignore', 'pipe', 'pipe'] });
  const state = { child, output: '', exit: null, error: null, launchedAt, spawnCompletedAt: Date.now(), knownProcesses: new Map() };
  child.on('error', error => { state.error = error; });
  child.on('exit', code => { state.exit = code; });
  const log = chunk => {
    state.output = (state.output + chunk.toString()).slice(-100000);
    // Rewrite the bounded log, so a token split between chunks cannot leak.
    fs.writeFileSync(path.join(evidence, logName), redact(state.output));
  };
  child.stdout.on('data', log); child.stderr.on('data', log);
  children.push(state);
  captureOwnedProcesses();
  return state;
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function bounded(operation, timeout, description, onTimeout = () => {}) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => { onTimeout(); reject(new Error(`Timed out: ${description}`)); }, timeout);
      }),
    ]);
  } finally { clearTimeout(timer); }
}
async function until(check, timeout, description, checkTimeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const controller = new AbortController();
    const value = await bounded(() => check(controller.signal), Math.min(checkTimeout, end - Date.now()),
      `${description} (single check)`, () => controller.abort());
    if (value) return value;
    await wait(Math.min(1800, Math.max(0, end - Date.now())));
  }
  throw new Error(`Timed out: ${description}`);
}
async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
const bootstrapPort = await availablePort(), wizardPort = await availablePort(), appPort = await availablePort(), uiPort = await availablePort();
assert(new Set([bootstrapPort, wizardPort, appPort, uiPort]).size === 4, 'Retry after ephemeral port collision');
report.ports = { bootstrapPort, wizardPort, appPort, uiPort };
// npm, Node ile çalışan giriş dosyasıyla (cmd.exe/kabuk olmadan) çağrılır: [komut, argümanlar].
const npm = op => { const { command, args } = createInvocation('npm', op); return [command, args]; };
const navigationStates = new WeakMap();
const observedPages = [];
function observeNavigation(page, label) {
  const state = { label, events: [], pending: new Map() };
  const event = value => {
    state.events.push(JSON.parse(redact(JSON.stringify({ at: new Date().toISOString(), ...value }))));
    state.events = state.events.slice(-100);
  };
  page.on('request', request => {
    const info = { url: redact(request.url()), type: request.resourceType(), method: request.method(),
      navigation: request.isNavigationRequest() };
    state.pending.set(request, info); event({ kind: 'request', ...info });
  });
  page.on('response', response => event({ kind: 'response', url: redact(response.url()), status: response.status() }));
  page.on('requestfinished', request => { state.pending.delete(request); });
  page.on('requestfailed', request => {
    state.pending.delete(request);
    event({ kind: 'requestfailed', url: redact(request.url()), error: request.failure()?.errorText });
  });
  page.on('domcontentloaded', () => event({ kind: 'domcontentloaded', url: redact(page.url()) }));
  page.on('load', () => event({ kind: 'load', url: redact(page.url()) }));
  page.on('pageerror', error => event({ kind: 'pageerror', message: redact(error.message).slice(0, 1500) }));
  navigationStates.set(page, state);
  observedPages.push(page);
}
async function navigationDiagnostic(page, phase, outcome, error) {
  const state = navigationStates.get(page);
  const diagnostic = { at: new Date().toISOString(), phase, outcome, url: redact(page.url()),
    error: error ? redact(error.message).slice(0, 2000) : undefined,
    pending: [...(state?.pending.values() || [])].slice(-30), events: state?.events || [] };
  try {
    diagnostic.document = await bounded(() => page.evaluate(() => ({ readyState: document.readyState,
      title: document.title, installerPresent: Boolean(document.querySelector('#install')),
      wizardPresent: Boolean(document.querySelector('form#wizard')), loginPresent: Boolean(document.querySelector('#email')),
      bootstrapState: document.querySelector('#state')?.textContent?.slice(0, 120) })), 2000, 'navigation DOM diagnostic');
  } catch (domError) { diagnostic.documentError = redact(domError.message); }
  const filename = `${phase}-navigation.json`;
  fs.writeFileSync(path.join(evidence, filename), `${redact(JSON.stringify(diagnostic, null, 2))}\n`);
  report.navigationDiagnostics = [...(report.navigationDiagnostics || []), { phase, outcome, file: filename }].slice(-10);
  save();
}
async function navigate(page, url, phase, readySelector) {
  try {
    // A newly installed Vite workspace transforms its first browser request.
    // Keep the observed BAT timeout as evidence; later cold-login checks get a
    // bounded budget without weakening element, authentication or API checks.
    const navigationTimeout = phase === 'fresh-login' ? 120000 : 30000;
    await bounded(() => page.goto(url, { waitUntil: 'domcontentloaded', timeout: navigationTimeout }), navigationTimeout + 5000, `${phase} DOM navigation`);
    if (readySelector) await page.locator(readySelector).waitFor({ state: 'visible', timeout: 30000 });
    await navigationDiagnostic(page, phase, 'dom-and-selector-ready');
  } catch (error) {
    await navigationDiagnostic(page, phase, 'failed', error);
    throw error;
  }
}
function isRunning(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}
function windowsMetadataExecutable() {
  const override = process.env.HYBRID_POWERSHELL;
  if (override !== undefined) return path.isAbsolute(override) ? override : null;
  return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}
function windowsProcessSnapshot(timeout = 10000) {
  if (timeout <= 0) return null;
  const executable = windowsMetadataExecutable();
  if (!executable) return null;
  const result = spawnSync(executable, ['-NoProfile', '-NonInteractive', '-Command',
    'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CreationDate | ConvertTo-Json -Compress'],
  { windowsHide: true, shell: false, encoding: 'utf8', timeout: Math.min(10000, timeout), maxBuffer: 4 * 1024 * 1024 });
  const diagnostic = { at: new Date().toISOString(), status: result.status,
    errorCode: result.error?.code, stdoutBytes: Buffer.byteLength(result.stdout || ''),
    stderrBytes: Buffer.byteLength(result.stderr || '') };
  const record = () => {
    if (typeof report !== 'undefined') report.processSnapshotDiagnostic = diagnostic;
  };
  record();
  if (result.error || result.status !== 0) return null;
  try {
    const parsed = JSON.parse(result.stdout);
    const rawRows = Array.isArray(parsed) ? parsed : [parsed];
    // Windows reports System Idle as PID 0. It cannot be a spawned child or
    // termination target; keep every positive PID subject to identity checks.
    const rows = rawRows.filter(row => row?.ProcessId !== 0);
    diagnostic.rowCount = rawRows.length;
    diagnostic.excludedSystemIdleRows = rawRows.length - rows.length;
    diagnostic.invalidRows = rows.filter(row => !row || !Number.isInteger(row.ProcessId) || row.ProcessId <= 0
      || !Number.isInteger(row.ParentProcessId) || row.ParentProcessId < 0
      || typeof row.CreationDate !== 'string' || !Number.isFinite(creationTime(row.CreationDate)))
      .slice(0, 8).map(row => ({ pid: Number.isInteger(row?.ProcessId) ? row.ProcessId : undefined,
        pidValid: Number.isInteger(row?.ProcessId) && row.ProcessId > 0,
        parentValid: Number.isInteger(row?.ParentProcessId) && row.ParentProcessId >= 0,
        creationValid: typeof row?.CreationDate === 'string' && Number.isFinite(creationTime(row.CreationDate)) }));
    record();
    if (!rows.every(row => row && Number.isInteger(row.ProcessId) && row.ProcessId > 0
      && Number.isInteger(row.ParentProcessId) && row.ParentProcessId >= 0
      && typeof row.CreationDate === 'string' && Number.isFinite(creationTime(row.CreationDate)))) return null;
    return rows;
  } catch { diagnostic.invalidJson = true; record(); return null; }
}
function ownedTree(snapshot, rootPid) {
  if (!snapshot) return null;
  const owned = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of snapshot) {
      if (owned.has(row.ParentProcessId) && !owned.has(row.ProcessId)) { owned.add(row.ProcessId); changed = true; }
    }
  }
  return snapshot.filter(row => owned.has(row.ProcessId));
}
function knownSurvivors(known, snapshot) {
  if (!snapshot) return null;
  return known.filter(owned => snapshot.some(current => current.ProcessId === owned.ProcessId
    && current.CreationDate === owned.CreationDate));
}
function creationTime(value) {
  const match = String(value).match(/\/Date\((\d+)/);
  return match ? Number(match[1]) : Date.parse(value);
}
function captureOwnedProcesses() {
  if (process.platform === 'linux' && children.length) {
    const snapshot = linuxProcessSnapshot();
    for (const state of children) captureOwnedLinuxProcesses(state, snapshot);
    return;
  }
  if (process.platform !== 'win32' || !children.length) return;
  const snapshot = windowsProcessSnapshot();
  if (!snapshot) { report.ownershipSnapshotError = 'Windows process ownership snapshot unavailable'; return; }
  for (const state of children) {
    const rootRow = snapshot.find(row => row.ProcessId === state.child.pid);
    if (!rootRow || state.child.exitCode !== null || state.child.signalCode !== null) continue;
    const existing = state.knownProcesses.get(rootRow.ProcessId);
    if (existing && existing.CreationDate !== rootRow.CreationDate) continue;
    const started = creationTime(rootRow.CreationDate);
    if (!existing && (!Number.isFinite(started) || started < state.launchedAt - 1000 || started > state.spawnCompletedAt + 1000)) continue;
    for (const row of ownedTree(snapshot, rootRow.ProcessId)) {
      if (creationTime(row.CreationDate) >= started) state.knownProcesses.set(row.ProcessId, row);
    }
  }
}
let browser, browserServer, browserProcess;
try {
  const invocation = entry === 'terminal' ? npm({ type: 'run', script: 'setup', args: ['--no-open'] })
    : entry === 'bat' ? [process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'kurulum.bat', '--no-open']]
      : [process.env.HYBRID_SH || (process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\sh.exe' : 'sh'), ['kurulum.sh', '--no-open']];
  const startup = launch(...invocation, root, { ...cleanEnv, SETUP_BOOTSTRAP_PORT: String(bootstrapPort),
  }, 'bootstrap.log');
  const tokenUrl = await until(() => {
    if (startup.error) throw startup.error;
    if (startup.exit !== null) throw new Error(`Entrypoint exited (${startup.exit}); see redacted bootstrap.log`);
    // Require a completed output line: do not navigate with a token truncated
    // at an arbitrary stdout chunk boundary.
    return startup.output.match(/(http:\/\/127\.0\.0\.1:\d+\/setup\?token=[A-Za-z0-9_-]+)(?=\s)/)?.[1];
  }, 120000, 'real bootstrap URL');
  secrets.add(new URL(tokenUrl).searchParams.get('token'));
  const browserLaunchedAt = Date.now();
  browserServer = await chromium.launchServer({ headless: true, host: '127.0.0.1' });
  browserProcess = browserServer.process();
  children.push({ child: browserProcess, launchedAt: browserLaunchedAt, spawnCompletedAt: Date.now(), knownProcesses: new Map() });
  captureOwnedProcesses();
  report.ownedBrowserPid = browserProcess.pid; save();
  const browserEndpoint = browserServer.wsEndpoint(); secrets.add(browserEndpoint);
  browser = await chromium.connect(browserEndpoint, { timeout: 30000 });
  const context = await browser.newContext();
  // The local wizard's completion UI knows shared 5173/5000. This isolated run
  // must never follow its automatic handoff into an existing real installation.
  await context.route(/^http:\/\/(127\.0\.0\.1|localhost):(5173|5000)(\/|$)/, route => route.abort());
  const page = await context.newPage();
  observeNavigation(page, 'bootstrap');
  page.setDefaultTimeout(30000);
  // Capture the real page's status polling too, including wizard launch logs
  // emitted between clicking #wizard and navigation to the wizard port.
  page.on('response', async response => {
    if (response.status() !== 200 || !response.url().startsWith(`http://127.0.0.1:${bootstrapPort}/api/status`)) return;
    try { recordProgress('bootstrap', await bounded(() => response.json(), 5000, 'status response body')); }
    catch { /* navigation/cancellation may dispose the body */ }
  });
  await navigate(page, tokenUrl, 'bootstrap-entry', '#install');
  try {
    await page.waitForURL(`http://127.0.0.1:${bootstrapPort}/setup`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('#state')?.textContent === 'Yeni kurulum', undefined, { timeout: 30000 });
    await navigationDiagnostic(page, 'bootstrap-entry', 'fresh-state-ready');
  } catch (error) { await navigationDiagnostic(page, 'bootstrap-entry', 'failed', error); throw error; }
  const getState = async signal => {
    const deadline = Date.now() + 90000;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (closing || signal?.aborted) throw new Error('Status request cancelled');
      let response;
      try {
        // Read-only HTTP polling uses the actual browser session cookies while
        // remaining independent of a busy page renderer. Never retry mutations.
        response = await context.request.get(new URL('/api/status', page.url()).href,
          { timeout: Math.min(20000, Math.max(1, deadline - Date.now())) });
        if (response.status() !== 200) throw new Error(`Status HTTP ${response.status()}`);
        const state = await bounded(() => response.json(), 5000, 'status response body');
        if (closing || signal?.aborted) throw new Error('Status request cancelled');
        recordProgress(state.apply ? 'wizard-apply' : state.job?.type || 'bootstrap', state);
        return state;
      } catch (error) {
        const transient = /Timeout|Timed out|AbortError|ECONNRESET|ECONNREFUSED|socket hang up|net::ERR_/i.test(error.message);
        if (!transient || closing || signal?.aborted) throw error;
        report.statusReadMisses = [...(report.statusReadMisses || []), { at: new Date().toISOString(), attempt,
          error: redact(error.message).slice(0, 1500), lastProgress: report.lastProgress }].slice(-10);
        save(); console.log(`[${new Date().toISOString()}] status read miss ${attempt}/3; retrying read only`);
        if (attempt === 3 || Date.now() >= deadline) throw error;
        await wait(Math.min(1800, Math.max(0, deadline - Date.now())));
      } finally {
        // APIRequestContext otherwise retains every response body for its whole
        // lifetime; free repeated job logs without making disposal an open wait.
        if (response) {
          try { await bounded(() => response.dispose(), 2000, 'status response disposal'); }
          catch (error) { report.statusResponseDisposalError = redact(error.message).slice(0, 500); }
        }
      }
    }
  };
  const initial = await getState();
  assert.equal(initial.installation.state, 'fresh');
  assert.equal(initial.installation.dependencies.ready, false);
  await page.screenshot({ path: path.join(evidence, 'bootstrap-fresh.png'), fullPage: true });
  completedPhase('real entrypoint + token exchange + fresh/no-dependencies browser state');
  await page.locator('#install').click();
  const packages = await until(async signal => {
    const state = await getState(signal);
    if (state.job.status === 'error') throw new Error(`Real dependency install failed: ${state.job.message}`);
    return state.packagesReady && state.job.status === 'success' ? state : null;
  }, 1800000, 'real npm ci', 90000);
  assert.equal(packages.installation.dependencies.ready, true);
  completedPhase('real package install finished; independent node_modules verified');
  await page.locator('#wizard').click();
  try {
    await bounded(() => page.waitForURL(`http://127.0.0.1:${bootstrapPort}/wizard`, { waitUntil: 'domcontentloaded', timeout: 120000 }),
      125000, 'real wizard DOM navigation');
  } catch (error) { await navigationDiagnostic(page, 'wizard-entry', 'failed', error); throw error; }
  await page.locator('#checks .check').first().waitFor();
  await navigationDiagnostic(page, 'wizard-entry', 'dom-and-preflight-ready');
  await page.screenshot({ path: path.join(evidence, 'wizard-fresh.png'), fullPage: true });
  completedPhase('real web wizard opened with fresh preflight');
  if (full) {
    await page.locator('#next').click();
    await page.locator('#mode').selectOption('localhost');
    await page.locator('#port').fill(String(appPort));
    await page.locator('#publicUrl').fill(`http://127.0.0.1:${appPort}`);
    await page.locator('#origins').fill(`http://127.0.0.1:${appPort},http://127.0.0.1:${uiPort}`);
    await page.locator('#proxy').fill('0');
    await page.locator('#next').click();
    await page.locator('#next').click();
    const email = `fresh-${crypto.randomBytes(5).toString('hex')}@example.test`;
    const password = `Aa9!${crypto.randomBytes(24).toString('hex')}`;
    secrets.add(password);
    await page.locator('#adminName').fill('Fresh Installation Admin');
    await page.locator('#adminEmail').fill(email);
    await page.locator('#adminPassword').fill(password);
    await page.locator('#next').click();
    await page.locator('[name="buildClient"]').check();
    await page.locator('[name="confirm"]').check();
    await page.locator('#apply').click();
    const applied = await until(async signal => {
      const state = await getState(signal);
      if (state.apply.status === 'error') throw new Error(`Real wizard apply failed: ${state.apply.message}`);
      return state.apply.status === 'success' ? state.apply : null;
    }, 1800000, 'real build/migrate/first-admin/config/env/lock', 90000);
    for (const id of ['buildServer', 'buildClient', 'migrate', 'admin', 'artifacts', 'env', 'finish'])
      assert.equal(applied.steps.find(step => step.id === id)?.status, 'done', `Incomplete actual step ${id}`);
    for (const file of ['server/.env', 'server/data/quiz.db', 'server/data/installation.lock',
      'server/data/deployment-config.json', 'dist/index.cjs', 'client/dist/index.html'])
      assert(fs.existsSync(path.join(root, file)), `Missing fresh installation artifact: ${file}`);
    const generatedEnv = fs.readFileSync(path.join(root, 'server/.env'), 'utf8');
    assert(!generatedEnv.includes(password), 'Admin password persisted in env');
    assert(generatedEnv.includes(`PORT=${appPort}\n`), 'Generated API port differs from form');
    assert(generatedEnv.includes('NODE_ENV=development'), 'Local mode did not generate development env');
    assert(generatedEnv.includes('DATABASE_URL="file:../data/quiz.db"'), 'Generated database is not fixture-local SQLite');
    assert(generatedEnv.includes('ALLOW_RUNTIME_DEPLOYMENT_CHANGES=false'), 'Unexpected runtime-change policy');
    const deployment = JSON.parse(fs.readFileSync(path.join(root, 'server/data/deployment-config.json'), 'utf8'));
    assert.equal(deployment.mode, 'localhost');
    assert.equal(deployment.publicUrl, `http://127.0.0.1:${appPort}`);
    assert.equal(deployment.basePath, '/');
    assert.equal(deployment.trustProxyHops, 0);
    assert(deployment.allowedOrigins.includes(`http://127.0.0.1:${appPort}`));
    assert(deployment.allowedOrigins.includes(`http://127.0.0.1:${uiPort}`));
    assert.equal(deployment.retention.enabled, false);
    assert.equal(deployment.updatedBy, 'setup-wizard');
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'server/data/installation.lock'), 'utf8'));
    assert.equal(lock.publicUrl, `http://127.0.0.1:${appPort}`);
    assert(Number.isFinite(Date.parse(lock.installedAt)));
    completedPhase('real browser apply: server/client builds, migration, first admin, config/env/lock');
    const lockedPage = await context.newPage();
    observeNavigation(lockedPage, 'bootstrap-locked');
    await navigate(lockedPage, `http://127.0.0.1:${bootstrapPort}/setup`, 'bootstrap-locked', '#wizard');
    await lockedPage.waitForFunction(() => document.querySelector('#state')?.textContent?.includes('zaten kurulu'));
    assert.equal(await lockedPage.locator('#wizard').isDisabled(), true);
    const bootstrapCsrf = await lockedPage.locator('meta[name="setup-csrf"]').getAttribute('content');
    const reentry = await context.request.post(`http://127.0.0.1:${bootstrapPort}/api/wizard`, {
      headers: { Origin: `http://127.0.0.1:${bootstrapPort}`, 'x-setup-csrf': bootstrapCsrf }, data: {},
    });
    assert.equal(reentry.status(), 409, 'Installed fixture allowed wizard reentry');
    assert.equal((await reentry.json()).message,
      "Uygulama zaten kurulu (installation.lock var). Yeniden kurulum için önce 'Yedekle ve Temiz Kuruluma Geç' ile sıfırlayın.");
    completedPhase('persisted form values + bootstrap reload installed/disabled + actual reentry rejection');
    await lockedPage.close();
      // Use the documented production command and its workspace module resolution.
    // Do not use wizard local-start button: it starts Vite on shared fixed 5173.
      const [startCommand, startArgs] = npm({ type: 'run', workspace: 'server', script: 'start' });
      launch(startCommand, startArgs, root, cleanEnv, 'fresh-app.log');
    await until(async () => {
      try { return (await context.request.get(`http://127.0.0.1:${appPort}/api/csrf-token`, { timeout: 10000 })).ok(); }
      catch { return false; }
    }, 120000, 'freshly built actual API startup');
    const csrf = await (await context.request.get(`http://127.0.0.1:${appPort}/api/csrf-token`)).json();
    const login = await context.request.post(`http://127.0.0.1:${appPort}/api/auth/login`, {
      headers: { 'x-csrf-token': csrf.csrfToken, Origin: `http://127.0.0.1:${appPort}` }, data: { email, password },
    });
    assert.equal(login.status(), 200, 'Fresh admin actual login failed');
    const me = await context.request.get(`http://127.0.0.1:${appPort}/api/auth/me`);
    assert.equal(me.status(), 200);
    assert.equal((await me.json()).user.role, 'admin');
    completedPhase('actual built API startup + first-admin login/auth cookie');
    // Stop before the known fixed-proxy defect can send a fixture password or
    // mutate sessions on an unrelated existing application listening on 5000.
    const viteSource = fs.readFileSync(path.join(root, 'client/vite.config.ts'), 'utf8');
    if (/target:\s*['"]http:\/\/127\.0\.0\.1:5000['"]/.test(viteSource))
      throw new Error('FRESH_CUSTOM_PORT_PROXY: shipped Vite proxy still targets 5000, so isolated fresh UI login would reach the wrong API. Real UI login not attempted; fix the production proxy before rerun.');
    // Vite, istemci dizininden doğrudan Node ile (npm exec yok): kök argümanı 'client'.
    const vite = [process.execPath, [resolveLocalBin(root, 'client', 'vite'), 'client', '--host', '127.0.0.1', '--port', String(uiPort), '--strictPort']];
    launch(...vite, root, cleanEnv, 'fresh-ui.log');
    await until(async () => {
      try { return (await context.request.get(`http://127.0.0.1:${uiPort}/auth`, { timeout: 10000 })).ok(); }
      catch { return false; }
    }, 120000, 'actual unmodified Vite frontend startup');
    const loginContext = await browser.newContext();
    await loginContext.route(/^http:\/\/(127\.0\.0\.1|localhost):(5173|5000)(\/|$)/, route => route.abort());
    const loginPage = await loginContext.newPage();
    observeNavigation(loginPage, 'fresh-login');
    await navigate(loginPage, `http://127.0.0.1:${uiPort}/auth`, 'fresh-login', '#email');
    await loginPage.locator('#email').fill(email);
    await loginPage.locator('#password').fill(password);
    const response = loginPage.waitForResponse(response => response.url().includes('/api/auth/login') && response.request().method() === 'POST');
    await loginPage.getByRole('button', { name: 'Giriş Yap', exact: true }).click();
    assert.equal((await response).status(), 200, 'Actual fresh frontend login request failed');
    await loginPage.waitForURL(`http://127.0.0.1:${uiPort}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const uiMe = await loginContext.request.get(`http://127.0.0.1:${uiPort}/api/auth/me`);
    assert.equal(uiMe.status(), 200);
    assert.equal((await uiMe.json()).user.role, 'admin');
    await loginPage.screenshot({ path: path.join(evidence, 'fresh-admin-ui.png'), fullPage: true });
    completedPhase('actual unmodified Vite frontend + browser first-admin login + authenticated admin route');
    await loginContext.close();
  }
  report.status = full ? 'passed-full-install-api-and-ui-login' : 'passed-partial-entrypoint-package-wizard';
} catch (error) {
  report.status = 'failed'; report.error = redact(String(error.message)); process.exitCode = 1;
  for (const page of observedPages) {
    if (page.isClosed()) continue;
    try { await navigationDiagnostic(page, `${navigationStates.get(page).label}-failure`, 'failed', error); }
    catch (diagnosticError) { report.navigationDiagnosticError = redact(diagnosticError.message).slice(0, 1500); }
  }
} finally {
  closing = true;
  report.cleanup = [];
  const cleanupDeadline = Date.now() + 120000;
  try {
  captureOwnedProcesses();
  if (browserServer) {
    report.browserCloseErrors = [];
    try { await bounded(() => browserServer.close(), 15000, 'owned browser server close'); }
    catch (error) { report.browserCloseErrors.push(redact(error.message)); }
    if (browserProcess && browserProcess.exitCode === null && browserProcess.signalCode === null) {
      try { await bounded(() => browserServer.kill(), 10000, 'owned browser server kill'); }
      catch (error) { report.browserCloseErrors.push(redact(error.message)); }
    }
    // The exact ChildProcess returned at launch joins the same bounded PID-tree
    // fallback as other owned children. No browser-name/process discovery kill.
    if (!browserProcess) report.cleanup.push({ kind: 'owned-browser', stopped: false, error: 'Owned browser process handle missing' });
  }
  if (browser) {
    try { await bounded(() => browser.close(), 5000, 'browser connection close'); }
    catch (error) { report.browserCloseErrors ||= []; report.browserCloseErrors.push(redact(error.message)); }
  }
  for (const state of children.reverse()) {
    const { child } = state;
    if (!child.pid) continue;
    if (Date.now() >= cleanupDeadline) {
      report.cleanup.push({ kind: 'owned-process', pid: child.pid, stopped: false, error: 'Overall cleanup deadline exceeded' }); continue;
    }
    if (process.platform === 'win32') {
      const known = [...state.knownProcesses.values()];
      const snapshot = windowsProcessSnapshot(cleanupDeadline - Date.now());
      const survivors = knownSurvivors(known, snapshot);
      if (!state.knownProcesses.has(child.pid) || survivors === null) {
        report.cleanup.push({ kind: 'owned-process-tree', pid: child.pid, stopped: false,
          error: 'Cannot verify launch identity/known descendant absence; no unknown PID was killed' }); continue;
      }
      const outcomes = [];
      // Every target was observed beneath this live owned root, and its current
      // creation identity is checked before signalling. Reused PIDs are skipped.
      for (const owned of survivors.sort((a, b) => creationTime(b.CreationDate) - creationTime(a.CreationDate))) {
        const current = windowsProcessSnapshot(cleanupDeadline - Date.now());
        if (!current) { outcomes.push({ pid: owned.ProcessId, error: 'Identity snapshot unavailable' }); continue; }
        if (!knownSurvivors([owned], current).length) continue;
        if (Date.now() >= cleanupDeadline) { outcomes.push({ pid: owned.ProcessId, error: 'Overall cleanup deadline exceeded' }); continue; }
        const killed = spawnSync('taskkill', ['/PID', String(owned.ProcessId), '/F'], {
          windowsHide: true, encoding: 'utf8', timeout: Math.min(10000, cleanupDeadline - Date.now()), killSignal: 'SIGKILL' });
        outcomes.push({ pid: owned.ProcessId, exitCode: killed.status,
          error: killed.error ? redact(killed.error.message) : undefined });
      }
      await new Promise(resolve => setImmediate(resolve));
      const remaining = knownSurvivors(known, windowsProcessSnapshot(cleanupDeadline - Date.now()));
      report.cleanup.push({ kind: 'owned-process-tree', pid: child.pid,
        stopped: remaining !== null && remaining.length === 0,
        knownProcessCount: known.length, remainingPids: remaining?.map(row => row.ProcessId), outcomes,
        error: remaining === null ? 'Final identity/absence snapshot unavailable' : undefined });
      continue;
    }
    if (process.platform === 'linux') {
      report.cleanup.push(await cleanupOwnedLinuxProcesses(state, { timeoutMs: cleanupDeadline - Date.now() }));
      continue;
    }
    if (child.exitCode !== null || !isRunning(child.pid)) {
      report.cleanup.push({ kind: 'owned-process', pid: child.pid, stopped: true, alreadyExited: true }); continue;
    }
    try {
      child.kill('SIGTERM');
      await until(() => !isRunning(child.pid), 5000, 'owned process termination');
      report.cleanup.push({ kind: 'owned-process', pid: child.pid, stopped: true });
    } catch (error) { report.cleanup.push({ kind: 'owned-process', pid: child.pid, stopped: false, error: redact(error.message) }); }
  }
  } finally {
    // Release only handles we own, after identity/termination attempts. This
    // cannot establish process-tree absence or authorize fixture deletion.
    report.handleRelease = children.map(({ child }) => ({
      pid: Number.isInteger(child.pid) ? child.pid : undefined,
      ...releaseOwnedChildHandles(child),
    }));
  }
  if (process.platform === 'linux') {
    report.cleanup.push(...await verifyFixturePortsReleased(Object.values(report.ports), {
      timeoutMs: Math.min(2000, Math.max(1, cleanupDeadline - Date.now())),
    }));
  }
  report.cleanupSucceeded = report.cleanup.every(item => item.stopped);
  if (!report.cleanupSucceeded) {
    report.productStatusBeforeCleanup = report.status;
    report.status = 'failed'; report.error ||= 'Owned browser/process cleanup did not complete; see cleanup evidence.';
    process.exitCode = 1;
  }
  const after = Object.fromEntries(protectedFiles.map(file => [file, digest(path.join(source, file))]));
  report.sourceProtectedFilesUnchanged = JSON.stringify(before) === JSON.stringify(after);
  if (!report.sourceProtectedFilesUnchanged) { report.status = 'failed'; report.error = 'Protected source files changed during closure run'; process.exitCode = 1; }
  report.finishedAt = new Date().toISOString(); save();
  console.log(redact(JSON.stringify({ status: report.status, root, evidence: path.join(evidence, 'result.json'),
    sourceProtectedFilesUnchanged: report.sourceProtectedFilesUnchanged, error: report.error,
    cleanupSucceeded: report.cleanupSucceeded,
    lastProgress: report.status === 'failed' ? report.lastProgress : undefined })));
}
