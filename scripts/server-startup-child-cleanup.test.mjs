// Focused unit regression: controlled owned-child events only, no process spawned/killed.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { cleanupStartupChild } from './server-startup-child-cleanup.mjs';

function fixture() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.unrefCalls = 0;
  child.unref = () => { child.unrefCalls++; };
  return { child, lifecycle: { spawned: true, closed: false } };
}

test('termination failure releases pipe/child handles without claiming stop or fixture deletion safety', async () => {
  const { child, lifecycle } = fixture();
  let result;
  try { result = await cleanupStartupChild(child, lifecycle, async () => { throw new Error('controlled termination failure'); }, 10); }
  catch {}
  assert.equal(child.stdout.destroyed, true, 'stdout handle must release even when terminator throws');
  assert.equal(child.stderr.destroyed, true, 'stderr handle must release even when terminator throws');
  assert.equal(child.unrefCalls, 1);
  assert.equal(result.stopProven, false);
  assert.equal(result.handlesReleased, true);
  assert.equal(result.error, 'Owned child termination failed');
});

test('an exited parent with inherited pipes still open cannot authorize fixture removal', async () => {
  const { child, lifecycle } = fixture();
  child.exitCode = 1;
  let calls = 0;
  const result = await cleanupStartupChild(child, lifecycle, async () => { calls++; }, 10);
  assert.equal(calls, 0, 'Do not terminate an exited/reusable PID');
  assert.equal(result.stopProven, false);
  assert.equal(child.stdout.destroyed, true);
  assert.equal(child.stderr.destroyed, true);
  assert.equal(child.unrefCalls, 1);
  assert.equal(result.handlesReleased, true);
});

test('subprocess failure diagnostics exclude output and arbitrary error values', async () => {
  const { child, lifecycle } = fixture();
  const sentinel = 'private-output-sentinel';
  const result = await cleanupStartupChild(child, lifecycle, async () => {
    const error = new Error(`Command failed: ${sentinel}`);
    error.status = 1;
    error.stdout = sentinel;
    error.stderr = sentinel;
    throw error;
  }, 10);
  assert.equal(result.stopProven, false);
  assert.equal(result.handlesReleased, true);
  assert.equal(result.error, 'Owned child termination failed (status 1)');
  assert.equal(JSON.stringify(result).includes(sentinel), false);
});

test('successful owned-tree termination requires close before releasing handles and proving stop', async () => {
  const { child, lifecycle } = fixture();
  const result = await cleanupStartupChild(child, lifecycle, async () => {
    lifecycle.closed = true;
    child.emit('close', 0);
  }, 10);
  assert.equal(result.stopProven, true);
  assert.equal(result.handlesReleased, true);
  assert.equal(child.stdout.destroyed, true);
  assert.equal(child.stderr.destroyed, true);
  assert.equal(child.unrefCalls, 1);
});
