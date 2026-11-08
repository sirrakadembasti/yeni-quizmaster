// Unit/HTTP regression only: pnpm --version is controlled here. This does not
// provide fresh dependency-install, migration, build or browser evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
async function port() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}

test('bootstrap caches runtime and installed renderer rejects retained wizard handoff (controlled pnpm unit regression)', { timeout: 45000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quizmaster-bootstrap-runtime-'));
  const scripts = path.join(root, 'scripts');
  fs.mkdirSync(scripts);
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"quiz-master","type":"module"}\n');
  for (const file of ['setup-bootstrap.mjs', 'setup-bootstrap-lib.mjs', 'pnpm-invocation.mjs', 'upgrade-process-supervisor.mjs', 'setup-proxy.mjs'])
    fs.copyFileSync(path.join(scriptRoot, file), path.join(scripts, file));
  const calls = path.join(root, 'version-calls.txt');
  const mockPnpm = path.join(root, 'pnpm.cjs');
  fs.writeFileSync(path.join(scripts,'upgrade.mjs'),"import fs from 'node:fs';fs.writeFileSync('upgrade-args.json',JSON.stringify(process.argv.slice(2)));\n");
  fs.writeFileSync(mockPnpm, `
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--version') {
  fs.appendFileSync(process.env.RUNTIME_TEST_CALLS, '--version\\n');
  console.log('9.15.1');
} else if (args[0] === 'install' && args.includes('--frozen-lockfile')) {
  if (process.env.NODE_ENV === 'production' && !args.includes('--prod=false')) {
    console.error('Controlled install excluded the wizard/build tools');
    process.exit(91);
  }
  if (process.env.CI !== 'true') {
    console.error('Controlled modules replacement would require confirmation');
    process.exit(92);
  }
  // Controlled dependency evidence only; no real packages are installed.
  for (const relative of ['node_modules/.pnpm', 'server/node_modules', 'client/node_modules'])
    fs.mkdirSync(path.join(process.cwd(), relative), { recursive: true });
  for (const relative of ['server/package.json', 'client/package.json'])
    fs.writeFileSync(path.join(process.cwd(), relative), '{}');
} else if (args.join(' ') === '--filter quiz-master-server run setup') {
  console.log('http://127.0.0.1:' + process.env.SETUP_PORT + '/setup?token=controlled-unit-wizard');
  // Nonzero exit retains the handoff URL without closing the HTTP bootstrap.
  process.exitCode = 90;
} else if (args[0] === 'run' && args[1] === 'upgrade') {
  fs.writeFileSync(path.join(process.cwd(), 'upgrade-args.json'), JSON.stringify(args));
} else process.exit(90);
`);
  const bootstrapPort = await port();
  const env = { ...process.env, NODE_ENV: 'production', CI: 'false', npm_execpath: mockPnpm, RUNTIME_TEST_CALLS: calls,
    SETUP_BOOTSTRAP_PORT: String(bootstrapPort) };
  delete env.SETUP_TOKEN;
  const child = spawn(process.execPath, [path.join(scripts, 'setup-bootstrap.mjs'), '--no-open'], {
    cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.pid && child.exitCode === null) {
      // Terminate our directly spawned HTTP process and wait until Windows has
      // released its working directory before removing the disposable fixture.
      const closed = new Promise(resolve => child.once('close', resolve));
      assert.ok(child.kill('SIGTERM'), 'Owned bootstrap process could not be stopped');
      await Promise.race([closed, new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error('Owned bootstrap process did not close')), 5000);
        timer.unref();
      })]);
    }
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('quizmaster-bootstrap-runtime-'));
    fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  let output = '', failure;
  child.on('error', error => { failure = error; });
  child.stdout.on('data', chunk => { output = (output + chunk.toString()).slice(-10000); });
  // Consume errors, but never print one-time URLs or cookie proof to test output.
  child.stderr.on('data', () => {});
  const deadline = Date.now() + 15000;
  let tokenUrl;
  while (Date.now() < deadline) {
    if (failure) throw failure;
    assert.equal(child.exitCode, null, 'Isolated bootstrap exited before becoming ready');
    tokenUrl = output.match(/http:\/\/127\.0\.0\.1:\d+\/setup\?token=[A-Za-z0-9_-]+/)?.[0];
    if (tokenUrl) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(tokenUrl, 'Isolated bootstrap URL missing');
  const exchange = await fetch(tokenUrl, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
  assert.equal(exchange.status, 303);
  const cookie = exchange.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie, 'Bootstrap cookie missing');
  const unauthenticatedStatus=await fetch(`http://127.0.0.1:${bootstrapPort}/api/status`,{signal:AbortSignal.timeout(5000)});
  assert.equal(unauthenticatedStatus.status,403);
  assert.equal(unauthenticatedStatus.headers.get('set-cookie'),null,'Rejected status polling must not renew a bootstrap cookie');
  const status = async () => {
    const response = await fetch(`http://127.0.0.1:${bootstrapPort}/api/status`, {
      headers: { Cookie: cookie }, signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie')||'',/quizmaster\.bootstrap=.*; HttpOnly; SameSite=Strict; Path=\/; Max-Age=1800/,'Authenticated status polling must renew the short bootstrap cookie during long upgrades');
    return response.json();
  };
  const fresh = await status();
  assert.equal(fresh.runtime.pnpmVersion, '9.15.1');
  assert.equal(fresh.runtime.pnpmSupported, true);
  assert.equal(fresh.installation.state, 'fresh');
  const page = await fetch(`http://127.0.0.1:${bootstrapPort}/setup`, {
    headers: { Cookie: cookie }, signal: AbortSignal.timeout(5000),
  });
  const html = await page.text();
  const csrf = html.match(/name="setup-csrf" content="([^"]+)"/)?.[1];
  assert.ok(csrf, 'Bootstrap CSRF proof missing');
  const mutation = endpoint => fetch(`http://127.0.0.1:${bootstrapPort}${endpoint}`, {
    method: 'POST', headers: { Cookie: cookie, Origin: `http://127.0.0.1:${bootstrapPort}`,
      'x-setup-csrf': csrf, 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(5000),
  });
  const waitForStatus = async predicate => {
    const end = Date.now() + 10000;
    while (Date.now() < end) {
      const value = await status();
      if (predicate(value)) return value;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Controlled bootstrap job did not reach expected state');
  };
  assert.equal((await mutation('/api/install')).status, 202);
  const installed = await waitForStatus(value => value.job.type === 'dependencies' && ['success','error'].includes(value.job.status));
  assert.equal(installed.job.status,'success','Production launch must retain the wizard/build dependencies');
  assert.equal(installed.packagesReady,true);
  assert.equal((await mutation('/api/wizard')).status, 202);
  const handoff = await waitForStatus(value => value.job.wizardUrl && value.job.status === 'error');
  fs.mkdirSync(path.join(root, 'server/data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'server/data/installation.lock'), '{}\n');
  const subsequent = await Promise.all([status(), status(), status()]);
  for (const state of subsequent) {
    assert.deepEqual(state.runtime, fresh.runtime, 'Runtime snapshot changed during polling');
    assert.equal(state.installation.state, 'installed', 'Installation state was accidentally frozen with runtime');
    assert.equal(state.job.wizardUrl, handoff.job.wizardUrl, 'Regression requires retained real job handoff state');
  }
  // Execute the actual HTTP-served browser renderer against live status data.
  // DOM/timers/network are controlled unit surfaces; this is not a browser E2E.
  const scriptResponse = await fetch(`http://127.0.0.1:${bootstrapPort}/bootstrap.js`, {
    headers: { Cookie: cookie }, signal: AbortSignal.timeout(5000),
  });
  assert.equal(scriptResponse.status, 200);
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { content: csrf, dataset: { confirmation: '' },
      classList: { toggle() {} }, scrollHeight: 0 });
    return elements.get(id);
  };
  const location = { href: `http://127.0.0.1:${bootstrapPort}/setup` };
  const pendingReads = [];
  const statusTimers = new Map();
  let nextTimer = 0;
  const sandbox = vm.createContext({ document: { querySelector: element, getElementById: element },
    location, AbortController, setInterval() {},
    setTimeout(callback, timeout) { const id = ++nextTimer; statusTimers.set(id, { callback, timeout }); return id; },
    clearTimeout(id) { statusTimers.delete(id); },
    fetch: (_url, options) => new Promise((resolve, reject) => {
      pendingReads.push({ resolve, signal: options.signal });
      options.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Controlled status abort'), { name: 'AbortError' })), { once: true });
    }), alert() {}, confirm: () => false });
  vm.runInContext(await scriptResponse.text(), sandbox, { timeout: 1000 });
  vm.runInContext('refresh(); refresh();', sandbox, { timeout: 1000 });
  assert.equal(pendingReads.length, 1, 'Overlapping timer/manual refresh calls must share one pending status read');
  pendingReads[0].resolve({ ok: true, json: async () => subsequent[0] });
  await new Promise(resolve => setImmediate(resolve));
  vm.runInContext('refresh()', sandbox, { timeout: 1000 });
  assert.equal(pendingReads.length, 2, 'Completed refresh must allow the next live status read');
  assert.equal(statusTimers.size, 1, 'Completed read must clear its timeout; new pending read must own one timer');
  const timer = [...statusTimers.values()][0];
  assert.equal(timer.timeout, 30000, 'Only the status read must have a 30-second timeout');
  timer.callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(pendingReads[1].signal.aborted, true, 'Status timer did not abort the hanging request');
  assert.equal(statusTimers.size, 0, 'Aborted read timer was not cleared');
  vm.runInContext('refresh()', sandbox, { timeout: 1000 });
  assert.equal(pendingReads.length, 3, 'Aborted/rejected status read must release the single-flight gate');
  sandbox.testStatus = handoff;
  vm.runInContext('render(testStatus)', sandbox, { timeout: 1000 });
  assert.equal(location.href, handoff.job.wizardUrl, 'Uninstalled wizard handoff stopped working');
  const bootstrapUrl = `http://127.0.0.1:${bootstrapPort}/setup`;
  location.href = bootstrapUrl;
  sandbox.testStatus = subsequent[0];
  vm.runInContext('render(testStatus)', sandbox, { timeout: 1000 });
  assert.equal(location.href, bootstrapUrl, 'Installed bootstrap redirected back into retained wizard');
  assert.equal(element('wizard').disabled, true, 'Installed wizard button was enabled');
  assert.equal(element('upgrade').disabled, false, 'Installed application must offer a data-preserving upgrade');
  assert.ok(!element('summary').innerHTML.includes('Önce “Paketleri Kur / Onar”'),'Installed upgrade must not require the separate fresh-install package step');
  sandbox.testStatus={...subsequent[0],job:{...subsequent[0].job,type:'upgrade',status:'success',message:'Verified upgrade completed'}};
  vm.runInContext('render(testStatus)',sandbox,{timeout:1000});
  assert.equal(element('message').className,'success','A recovered status request must not leave a successful upgrade styled as an error');
  sandbox.testStatus={...subsequent[0],job:{...subsequent[0].job,type:'upgrade',status:'error',message:'Upgrade failed'}};
  vm.runInContext('render(testStatus)',sandbox,{timeout:1000});
  assert.equal(element('message').className,'error');
  const reentry = await mutation('/api/wizard');
  assert.equal(reentry.status, 409);
  assert.equal((await reentry.json()).message,
    "Uygulama zaten kurulu (installation.lock var). Yeniden kurulum için önce 'Yedekle ve Temiz Kuruluma Geç' ile sıfırlayın.");
  assert.equal((await fetch(`http://127.0.0.1:${bootstrapPort}/api/upgrade`,{method:'POST',body:'{}',signal:AbortSignal.timeout(5000)})).status,403);
  assert.equal((await mutation('/api/upgrade')).status,202);
  const upgraded=await waitForStatus(value=>value.job.type==='upgrade'&&value.job.status==='success');
  assert.equal(upgraded.installation.state,'installed');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'upgrade-args.json'),'utf8')),['--project',root,'--parent-lease']);
  assert.equal(fs.readFileSync(path.join(root,'server/data/installation.lock'),'utf8'),'{}\n');
  const actualCalls = fs.readFileSync(calls, 'utf8').trim().split(/\r?\n/);
  assert.equal(actualCalls.length, 1, 'Polling must not repeatedly spawn pnpm --version and block bootstrap HTTP');
  const harnessSource = fs.readFileSync(path.join(scriptRoot, 'admin-hybrid-setup-closure.mjs'), 'utf8');
  const survivorHelper = harnessSource.match(/function knownSurvivors\(known, snapshot\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(survivorHelper, 'Actual cleanup identity helper missing');
  const checkSurvivors = vm.runInNewContext(`(${survivorHelper})`);
  const parent = { ProcessId: 10, CreationDate: 'owned-parent' };
  const descendant = { ProcessId: 11, CreationDate: 'owned-descendant' };
  assert.equal(checkSurvivors([parent, descendant], [descendant]).length, 1,
    'Exited parent must not hide its still-running known descendant');
  assert.equal(checkSurvivors([parent], [{ ProcessId: 10, CreationDate: 'reused-unrelated-pid' }]).length, 0,
    'A reused PID is not an owned process and must not be targeted');
  assert.equal(checkSurvivors([parent], null), null, 'Unavailable snapshot must not prove cleanup success');
  assert.equal(checkSurvivors([parent, descendant], []).length, 0, 'Confirmed absence must allow cleanup success');
});
