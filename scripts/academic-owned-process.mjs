import path from 'node:path';
import { spawn } from 'node:child_process';
import { captureOwnedLinuxProcesses, cleanupOwnedLinuxProcesses } from './linux-owned-process-cleanup.mjs';
// An enduring session anchor prevents fast payload-parent exit from making its
// non-listening group descendants undiscoverable before the next capture.
const unixSupervisor = `const {spawn}=require('node:child_process');
const payload=spawn(process.execPath,process.argv.slice(1),{stdio:['ignore','inherit','inherit']});
const event=value=>process.stdout.write('\\n@@ACADEMIC_JOB@@'+JSON.stringify(value)+'\\n');
payload.on('error',error=>event({error:error.code}));
payload.once('exit',code=>event({rootExit:code??1}));
setInterval(()=>{},1000); event({ready:true});`;

export async function launchOwned(args, { cwd, env, onState = () => {}, onOutput = text => process.stdout.write(text) } = {}) {
  const windows = process.platform === 'win32';
  const child = spawn(windows ? 'python' : process.execPath,
    windows ? [path.join(import.meta.dirname, 'academic-owned-job.py'), process.execPath, ...args] : ['-e', unixSupervisor, '--', ...args],
    { cwd, env, windowsHide: true, detached: !windows, stdio: ['pipe', 'pipe', 'pipe'] });
  const state = { child, errorCode: null, knownProcesses: new Map(), stopped: false, rootExited: false };
  onState(state);
  let finishRoot, ready, rejectReady;
  state.finished = new Promise(resolve => { finishRoot = resolve; });
  const readiness = new Promise((resolve, reject) => { ready = resolve; rejectReady = reject; });
  const timeout = setTimeout(() => rejectReady(new Error('Owned process supervisor did not establish ownership')), 10000);
  child.on('error', error => { state.errorCode = error.code; rejectReady(error); finishRoot(1); });
  child.once('exit', code => {
    // Cleanup can stop a still-running payload before a rootExit event exists.
    // Resolve its completion too, so cancellation never leaves the runner waiting.
    if (!state.rootExited) finishRoot(1);
    if (!state.stopped && !state.cleanup) { state.errorCode = 'OWNED_JOB_SUPERVISOR_EXITED'; rejectReady(new Error(state.errorCode)); }
  });
  let buffer = '';
  child.stdout.on('data', data => {
    buffer += data.toString();
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, ''); buffer = buffer.slice(newline + 1);
      if (!line.startsWith('@@ACADEMIC_JOB@@')) { onOutput(line + '\n'); continue; }
      const message = JSON.parse(line.slice('@@ACADEMIC_JOB@@'.length));
      if (message.ready) ready();
      if ('rootExit' in message) { state.rootExited = true; state.errorCode = 'PAYLOAD_EXITED'; finishRoot(message.rootExit); }
      if (message.stopped) { state.stopped = true; state.proof = message; }
      if (message.error) { state.errorCode = 'OWNED_JOB_FAILURE'; rejectReady(new Error(message.error)); onOutput('Owned job error: ' + message.error + '\n'); }
    }
  });
  child.stderr.on('data', data => onOutput(data.toString()));
  if (!windows) {
    if (!captureOwnedLinuxProcesses(state)) throw new Error('Unable to capture owned launch identity');
    state.monitor = setInterval(() => { if (!captureOwnedLinuxProcesses(state)) state.errorCode = 'OWNERSHIP_CAPTURE_FAILED'; }, 30);
  }
  try { await readiness; } finally { clearTimeout(timeout); }
  return state;
}

export async function cleanupOwned(state) {
  if (state.cleanup) return state.cleanup;
  state.cleanup = (async () => {
    if (process.platform !== 'win32') {
      clearInterval(state.monitor);
      const proof = await cleanupOwnedLinuxProcesses(state, { timeoutMs: 10000, graceMs: 500 });
      if (!proof.stopped) throw new Error(proof.error);
      state.stopped = true;
      return proof;
    }
    // Stable job handle remains held by supervisor, even if payload root exited.
    if (state.child.exitCode !== null || state.child.signalCode !== null) throw new Error('Owned job supervisor exited before cleanup proof');
    const closed = new Promise(resolve => state.child.once('close', resolve));
    state.child.stdin.end('stop\n');
    let timer;
    try {
      await Promise.race([closed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Owned job cleanup deadline exceeded')), 15000); })]);
    } finally { clearTimeout(timer); }
    if (!state.stopped || state.child.exitCode !== 0) throw new Error('Owned job cleanup was not proved');
    return state.proof;
  })();
  return state.cleanup;
}
