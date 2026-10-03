import fs from 'node:fs';
import net from 'node:net';

const positive = value => Number.isSafeInteger(value) && value > 0;
const nonnegative = value => Number.isSafeInteger(value) && value >= 0;
const exited = row => ['Z', 'X', 'x'].includes(row.state);
const validRow = row => row && positive(row.pid) && nonnegative(row.parentPid)
  && nonnegative(row.pgid) && nonnegative(row.sessionId)
  && typeof row.startTicks === 'string' && /^\d+$/.test(row.startTicks)
  && typeof row.state === 'string' && /^[RSDZTtXxKWPI]$/.test(row.state);
const sameIdentity = (left, right) => left.pid === right.pid && left.startTicks === right.startTicks
  && left.pgid === right.pgid && left.sessionId === right.sessionId;
const validSnapshot = snapshot => Array.isArray(snapshot) && snapshot.every(validRow)
  && new Set(snapshot.map(row => row.pid)).size === snapshot.length;
const validKnown = known => known instanceof Map && [...known].every(([pid, row]) => validRow(row) && pid === row.pid);

export function parseLinuxProcessStat(stat, expectedPid) {
  // comm may contain spaces and closing parentheses; fields follow the final ).
  const match = String(stat).match(/^(\d+) \([\s\S]*\) ([\s\S]+)$/);
  if (!match || Number(match[1]) !== expectedPid) return null;
  const fields = match[2].trim().split(/\s+/);
  const row = { pid: expectedPid, parentPid: Number(fields[1]), pgid: Number(fields[2]),
    sessionId: Number(fields[3]), startTicks: fields[19], state: fields[0] };
  return validRow(row) ? row : null;
}

export function linuxProcessSnapshot() {
  try {
    const rows = [];
    for (const name of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(name)) continue;
      let stat;
      try { stat = fs.readFileSync(`/proc/${name}/stat`, 'utf8'); }
      catch (error) {
        // Processes may exit between listing /proc and reading stat. Permission
        // failures and malformed metadata cannot prove ownership or absence.
        if (error.code === 'ENOENT' || error.code === 'ESRCH') continue;
        return null;
      }
      const row = parseLinuxProcessStat(stat, Number(name));
      if (!row) return null;
      rows.push(row);
    }
    return validSnapshot(rows) ? rows : null;
  } catch { return null; }
}

export function captureOwnedLinuxProcesses(state, snapshot = linuxProcessSnapshot()) {
  if (!positive(state?.child?.pid) || !validKnown(state.knownProcesses) || !validSnapshot(snapshot)) return false;
  const rootPid = state.child.pid;
  let rootIdentity = state.knownProcesses.get(rootPid);
  if (!rootIdentity) {
    const root = snapshot.find(row => row.pid === rootPid);
    // Bind the initial identity to the exact still-live ChildProcess handle.
    // An arbitrary PID supplied after its parent exited is never sufficient.
    if (!root || exited(root) || root.parentPid !== process.pid
      || state.child.exitCode !== null || state.child.signalCode !== null) return false;
    state.knownProcesses.set(rootPid, { ...root });
    rootIdentity = root;
  }
  // A still-existing start identity which moved groups is not an absent PID.
  // Fail closed rather than treating that live owned process as a replacement.
  if (snapshot.some(row => {
    const known = state.knownProcesses.get(row.pid);
    return known && known.startTicks === row.startTicks && !sameIdentity(known, row) && !exited(row);
  })) return false;
  const anchors = snapshot.filter(row => {
    const known = state.knownProcesses.get(row.pid);
    return known && sameIdentity(known, row);
  });
  const owned = new Set(anchors.map(row => row.pid));
  // detached:true gives this launch its own session/group. Extend only while
  // a previously captured identity anchors that group; never adopt a reused
  // group number or other members of an ordinary shared runner process group.
  const dedicatedGroup = rootIdentity.pgid === rootPid && rootIdentity.sessionId === rootPid;
  if (dedicatedGroup && anchors.some(row => row.pgid === rootPid && row.sessionId === rootPid)) {
    for (const row of snapshot) {
      if (row.pgid === rootPid && row.sessionId === rootPid) owned.add(row.pid);
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of snapshot) {
      if (owned.has(row.parentPid) && !owned.has(row.pid)) { owned.add(row.pid); changed = true; }
    }
  }
  for (const row of snapshot) {
    if (!owned.has(row.pid)) continue;
    const known = state.knownProcesses.get(row.pid);
    // Never replace an old identity with a different process reusing its PID.
    if (known && !sameIdentity(known, row)) continue;
    state.knownProcesses.set(row.pid, { ...row });
  }
  return true;
}

export async function cleanupOwnedLinuxProcesses(state, {
  timeoutMs = 10000, graceMs = 500,
  snapshot = linuxProcessSnapshot, signal = (pid, name) => process.kill(pid, name),
} = {}) {
  const result = { kind: 'owned-linux-process-tree', pid: state?.child?.pid, stopped: false,
    knownProcessCount: state?.knownProcesses?.size || 0, remainingPids: [], outcomes: [] };
  const fail = message => { result.error = message; return result; };
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(graceMs) || graceMs < 0)
    return fail('Invalid bounded cleanup deadline');
  const deadline = Date.now() + timeoutMs;
  const killAt = Date.now() + Math.min(graceMs, timeoutMs / 2);
  const termSent = new Set(), killSent = new Set();
  const read = () => { try { return snapshot(); } catch { return null; } };
  while (Date.now() < deadline) {
    const current = read();
    if (!captureOwnedLinuxProcesses(state, current)) return fail('Linux launch identity/process metadata unavailable');
    result.knownProcessCount = state.knownProcesses.size;
    const survivors = current.filter(row => {
      const known = state.knownProcesses.get(row.pid);
      return known && sameIdentity(known, row) && !exited(row);
    });
    result.remainingPids = survivors.map(row => row.pid);
    if (!survivors.length) { result.stopped = true; return result; }
    const name = Date.now() >= killAt ? 'SIGKILL' : 'SIGTERM';
    const sent = name === 'SIGKILL' ? killSent : termSent;
    // Descendants before the root helps the parent reap children during grace.
    for (const owned of survivors.sort((a, b) => (a.pid === state.child.pid) - (b.pid === state.child.pid))) {
      if (Date.now() >= deadline) break;
      const key = `${owned.pid}:${owned.startTicks}`;
      if (sent.has(key)) continue;
      // Re-read immediately before every exact-PID signal. Never signal a
      // missing/reused identity, and stop on untrustworthy process metadata.
      const fresh = read();
      if (!validSnapshot(fresh)) return fail('Linux identity snapshot unavailable before signal');
      const target = fresh.find(row => sameIdentity(row, owned));
      if (!target || exited(target)) continue;
      try {
        signal(target.pid, name);
        result.outcomes.push({ pid: target.pid, signal: name });
      } catch (error) {
        result.outcomes.push({ pid: target.pid, signal: name, errorCode: error.code || 'SIGNAL_FAILED' });
        if (error.code !== 'ESRCH') return fail('Owned Linux process signal failed');
      }
      sent.add(key);
    }
    await new Promise(resolve => setTimeout(resolve, Math.min(30, Math.max(0, deadline - Date.now()))));
  }
  return fail('Owned Linux process cleanup deadline exceeded');
}

export async function verifyFixturePortsReleased(ports, { timeoutMs = 2000 } = {}) {
  if (!Array.isArray(ports) || !ports.length || ports.some(port => !positive(port) || port > 65535)
    || new Set(ports).size !== ports.length) throw new TypeError('Invalid fixture ports');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError('Invalid fixture port timeout');
  return Promise.all(ports.map(port => new Promise(resolve => {
    const server = net.createServer();
    let settled = false;
    const finish = (stopped, error) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      resolve({ kind: 'fixture-port', port, stopped, ...(error ? { error } : {}) });
    };
    const close = callback => {
      try { server.close(callback); } catch { callback?.(new Error('Close failed')); }
    };
    const timer = setTimeout(() => {
      close();
      finish(false, 'Fixture port release verification timed out');
    }, timeoutMs);
    // Only sockets accepted by this probe are ours to close.
    server.on('connection', socket => socket.destroy());
    server.on('error', error => {
      close();
      const code = typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : 'BIND_FAILED';
      finish(false, `Fixture port bind failed (${code})`);
    });
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      if (settled) { close(); return; }
      close(error => finish(!error, error ? 'Fixture port probe close failed' : undefined));
    });
  })));
}
