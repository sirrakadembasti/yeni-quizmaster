import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launchOwned, cleanupOwned } from './academic-owned-process.mjs';

async function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'academic-owned-probe-'));
  const pidFile = path.join(root, 'descendant.pid');
  const grandchild = path.join(root, 'descendant.cjs');
  const parent = path.join(root, 'parent.cjs');
  fs.writeFileSync(grandchild, `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);`);
  // Windows libuv auto-kills ordinary child launches on parent exit. Detached
  // reproduces the review's orphan case while still inheriting our outer job.
  fs.writeFileSync(parent, `const {spawn}=require('child_process'); const fs=require('fs'); spawn(process.execPath,[${JSON.stringify(grandchild)}],{stdio:'ignore',detached:${process.platform === 'win32'}}).unref(); const t=setInterval(()=>{ if(fs.existsSync(${JSON.stringify(pidFile)})){ clearInterval(t); setTimeout(()=>process.exit(0),200); } },10);`);
  const state = await launchOwned([parent], { cwd: root, env: process.env, onOutput: () => {} });
  return { root, pidFile, state };
}
const exists = pid => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
async function awaitAbsent(pid) {
  const deadline = Date.now() + 3000;
  while (exists(pid) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(exists(pid), false, 'Non-listening descendant must be gone');
}
test('cleans non-listening descendant after payload parent exits (including SIGTERM refusal on Unix)', { timeout: 20000 }, async () => {
  const { root, pidFile, state } = await fixture();
  try {
    assert.equal(await state.finished, 0);
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.equal(exists(pid), true, 'Regression must reproduce surviving descendant');
    const proof = await cleanupOwned(state);
    assert.equal(proof.stopped, true);
    if (process.platform === 'win32') { assert.equal(proof.activeProcesses, 0); assert.ok(proof.totalProcesses >= 2); }
    else assert.ok(proof.outcomes.some(row => row.signal === 'SIGKILL'));
    await awaitAbsent(pid);
  } finally {
    await cleanupOwned(state);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test('Windows job kills descendants when its supervisor exits unexpectedly and cleanup fails closed', { skip: process.platform !== 'win32', timeout: 20000 }, async () => {
  const { root, pidFile, state } = await fixture();
  try {
    assert.equal(await state.finished, 0);
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.equal(exists(pid), true);
    const closed = new Promise(resolve => state.child.once('close', resolve));
    state.child.kill('SIGKILL');
    await closed;
    await awaitAbsent(pid);
    await assert.rejects(cleanupOwned(state), /supervisor exited before cleanup proof/);
  } finally {
    if (state.child.exitCode === null && state.child.signalCode === null) await cleanupOwned(state);
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
test('cleanup of a running payload resolves completion for cancellation', { timeout: 20000 }, async () => {
  const state = await launchOwned(['-e', 'setInterval(() => {}, 1000)'], { env: process.env, onOutput: () => {} });
  try {
    const proof = await cleanupOwned(state);
    assert.equal(proof.stopped, true);
    assert.equal(await state.finished, 1, 'Cancelled payload completion must settle');
  } finally { await cleanupOwned(state); }
});
