export async function waitForAuditServer(url, state, { timeoutMs = 120000, intervalMs = 300 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (state.errorCode || state.child.exitCode !== null || state.child.signalCode !== null)
      throw new Error('Owned audit server did not start');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(Math.max(1, Math.min(5000, deadline - Date.now()))) });
      await response.body?.cancel();
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, Math.min(intervalMs, Math.max(0, deadline - Date.now()))));
  }
  throw new Error('Isolated audit server readiness timed out');
}
