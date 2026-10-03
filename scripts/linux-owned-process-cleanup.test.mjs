import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import test from 'node:test';

// A missing helper is an assertion failure, so the first RED demonstrates the
// missing cleanup behavior instead of failing during module loading.
const helper = await import('./linux-owned-process-cleanup.mjs').catch(() => null);
const row = (pid, parentPid, startTicks = '100', pgid = pid, sessionId = pgid, state = 'S') =>
  ({ pid, parentPid, startTicks, pgid, sessionId, state });
const owner = () => ({ child: { pid: 123, exitCode: null, signalCode: null }, knownProcesses: new Map() });

test('missing ownership metadata refuses all signals', async () => {
  assert.equal(typeof helper?.cleanupOwnedLinuxProcesses, 'function', 'Linux descendant cleanup is missing');
  const signals = [];
  const result = await helper.cleanupOwnedLinuxProcesses(owner(), {
    snapshot: () => null, signal: (...args) => signals.push(args), timeoutMs: 100,
  });
  assert.equal(result.stopped, false);
  assert.deepEqual(signals, []);
});

test('invalid snapshot refuses all signals', async () => {
  assert.equal(typeof helper?.cleanupOwnedLinuxProcesses, 'function');
  const state = owner();
  state.knownProcesses.set(123, row(123, process.pid));
  const signals = [];
  const result = await helper.cleanupOwnedLinuxProcesses(state, {
    snapshot: () => [row(123, process.pid, 'invalid')], signal: (...args) => signals.push(args), timeoutMs: 100,
  });
  assert.equal(result.stopped, false);
  assert.deepEqual(signals, []);
});

test('reused PID is never signalled', async () => {
  assert.equal(typeof helper?.cleanupOwnedLinuxProcesses, 'function');
  const state = owner();
  state.knownProcesses.set(123, row(123, process.pid, '100'));
  const signals = [];
  const result = await helper.cleanupOwnedLinuxProcesses(state, {
    snapshot: () => [row(123, process.pid, '200')], signal: (...args) => signals.push(args), timeoutMs: 100,
  });
  assert.equal(result.stopped, true, 'Original identity is absent; its replacement must remain untouched');
  assert.deepEqual(signals, []);
});

test('invalid known identity refuses all signals', async () => {
  assert.equal(typeof helper?.cleanupOwnedLinuxProcesses, 'function');
  const state = owner();
  state.knownProcesses.set(123, row(123, process.pid, 'invalid'));
  const signals = [];
  const result = await helper.cleanupOwnedLinuxProcesses(state, {
    snapshot: () => [row(123, process.pid)], signal: (...args) => signals.push(args), timeoutMs: 100,
  });
  assert.equal(result.stopped, false);
  assert.deepEqual(signals, []);
});

test('an owned process changing groups is not falsely declared absent', async () => {
  const state = owner();
  state.knownProcesses.set(123, row(123, process.pid));
  const signals = [];
  const result = await helper.cleanupOwnedLinuxProcesses(state, {
    snapshot: () => [row(123, process.pid, '100', 200, 200)], signal: (...args) => signals.push(args), timeoutMs: 100,
  });
  assert.equal(result.stopped, false);
  assert.deepEqual(signals, []);
});

test('zombie identity is exited without a signal', async () => {
  assert.equal(typeof helper?.cleanupOwnedLinuxProcesses, 'function');
  const state = owner();
  state.knownProcesses.set(123, row(123, process.pid));
  const signals = [];
  const result = await helper.cleanupOwnedLinuxProcesses(state, {
    snapshot: () => [row(123, 1, '100', 123, 123, 'Z')], signal: (...args) => signals.push(args), timeoutMs: 100,
  });
  assert.equal(result.stopped, true);
  assert.deepEqual(signals, []);
});

test('an unrelated process sharing the runner group is never captured', () => {
  assert.equal(typeof helper?.captureOwnedLinuxProcesses, 'function');
  const state = owner();
  const snapshot = [row(123, process.pid, '100', 50, 50), row(124, 123, '101', 50, 50), row(125, 1, '102', 50, 50)];
  assert.equal(helper.captureOwnedLinuxProcesses(state, snapshot), true);
  assert.deepEqual([...state.knownProcesses.keys()].sort(), [123, 124]);
});

test('proc stat accepts spaces and parentheses in process names', () => {
  assert.equal(typeof helper?.parseLinuxProcessStat, 'function');
  const fields = ['S', '7', '11', '11', ...Array(15).fill('0'), '456'];
  assert.deepEqual(helper.parseLinuxProcessStat(`11 (name (with) spaces) ${fields.join(' ')}`, 11),
    row(11, 7, '456', 11, 11));
  assert.equal(helper.parseLinuxProcessStat('not a proc stat', 11), null);
});

async function fixture(t) {
  assert.equal(typeof helper?.cleanupOwnedLinuxProcesses, 'function', 'Linux descendant cleanup is missing');
  const code = `
    const {spawn}=require('node:child_process');
    const child=spawn(process.execPath,['-e', 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'],{stdio:'ignore'});
    process.stdout.write(String(child.pid)+'\\n');
    process.on('SIGTERM',()=>process.exit(0));
    setInterval(()=>{},1000);
  `;
  const child = spawn(process.execPath, ['-e', code], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const state = { child, knownProcesses: new Map() };
  t.after(async () => {
    // This group was created by this exact live fixture handle. The helper's
    // tests must clean up even when an assertion fails.
    const current = helper.linuxProcessSnapshot();
    const owned = [...state.knownProcesses.values()];
    for (const identity of owned) {
      if (current?.some(item => item.pid === identity.pid && item.startTicks === identity.startTicks)) {
        try { process.kill(identity.pid, 'SIGKILL'); } catch {}
      }
    }
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    child.stdout.destroy(); child.stderr.destroy(); child.unref();
  });
  let output = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Fixture readiness timed out')), 5000);
    child.stdout.on('data', chunk => {
      output += chunk;
      if (/^\d+\n/.test(output)) { clearTimeout(timer); resolve(); }
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
  });
  const grandchildPid = Number(output.trim());
  assert.equal(helper.captureOwnedLinuxProcesses(state), true);
  assert(state.knownProcesses.has(grandchildPid), 'Real grandchild ownership was not captured');
  // Ensure the grandchild installed its SIGTERM handler before cleanup.
  await new Promise(resolve => setTimeout(resolve, 100));
  return { state, grandchildPid };
}

test('real Linux cleanup stops parent and SIGTERM-resistant grandchild', { skip: process.platform !== 'linux', timeout: 15000 }, async t => {
  const { state, grandchildPid } = await fixture(t);
  const result = await helper.cleanupOwnedLinuxProcesses(state, { timeoutMs: 5000, graceMs: 100 });
  assert.equal(result.stopped, true, JSON.stringify(result));
  assert(result.knownProcessCount >= 2);
  const snapshot = helper.linuxProcessSnapshot();
  assert(snapshot);
  for (const pid of [state.child.pid, grandchildPid]) {
    const processRow = snapshot.find(item => item.pid === pid);
    assert(!processRow || ['Z', 'X'].includes(processRow.state), `Owned PID ${pid} survived`);
  }
  assert(result.outcomes.some(item => item.pid === grandchildPid && item.signal === 'SIGKILL'));
});

test('real Linux cleanup stops captured orphan after parent already exited', { skip: process.platform !== 'linux', timeout: 15000 }, async t => {
  const { state, grandchildPid } = await fixture(t);
  const exited = once(state.child, 'exit');
  state.child.kill('SIGTERM');
  await exited;
  const result = await helper.cleanupOwnedLinuxProcesses(state, { timeoutMs: 5000, graceMs: 100 });
  assert.equal(result.stopped, true, JSON.stringify(result));
  assert(result.outcomes.some(item => item.pid === grandchildPid));
});

async function listeningServer(t) {
  const server = net.createServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, resolve);
  });
  return server;
}

test('fixture port check proves a released port can be bound and closes its probe', async t => {
  assert.equal(typeof helper?.verifyFixturePortsReleased, 'function', 'Fixture port release verification is missing');
  const server = await listeningServer(t);
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  const result = await helper.verifyFixturePortsReleased([port]);
  assert.deepEqual(result, [{ kind: 'fixture-port', port, stopped: true }]);
  // The probe must have closed its own listener before reporting success.
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port, exclusive: true }, resolve);
  });
});

test('fixture port check fails for a held port and leaves its external holder running', async t => {
  assert.equal(typeof helper?.verifyFixturePortsReleased, 'function', 'Fixture port release verification is missing');
  const server = await listeningServer(t);
  const port = server.address().port;
  const result = await helper.verifyFixturePortsReleased([port]);
  assert.equal(result[0].stopped, false);
  assert.equal(result[0].port, port);
  assert.equal(result[0].error, 'Fixture port bind failed (EADDRINUSE)');
  assert.equal(server.listening, true);
  const socket = net.connect({ host: '127.0.0.1', port });
  await once(socket, 'connect');
  socket.destroy();
});

test('fixture port check rejects invalid input before probing', async t => {
  assert.equal(typeof helper?.verifyFixturePortsReleased, 'function', 'Fixture port release verification is missing');
  const server = await listeningServer(t);
  const port = server.address().port;
  for (const ports of [[port, 0], [-1], [65536], [port, port], ['5000'], null]) {
    await assert.rejects(() => helper.verifyFixturePortsReleased(ports), /Invalid fixture ports/);
  }
  assert.equal(server.listening, true);
});
