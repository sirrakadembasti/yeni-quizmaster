// Releasing handles is not proof that an owned process tree stopped.
export async function cleanupStartupChild(child, lifecycle, terminateTree, timeoutMs = 10000) {
  const result = { stopProven: false, handlesReleased: false };
  let timer, onClose;
  try {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = new Promise(resolve => {
        onClose = resolve;
        child.once('close', onClose);
      });
      await terminateTree();
      await Promise.race([closed, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Owned API child did not close')), timeoutMs);
      })]);
      result.stopProven = true;
    } else {
      // Never target an exited, potentially reused PID or delete its fixture.
      result.error = 'Owned process-tree stop is unproven after parent exit';
    }
  } catch (error) {
    // Do not expose subprocess stdout/stderr or spawn environment.
    result.error = Number.isInteger(error?.status)
      ? `Owned child termination failed (status ${error.status})`
      : 'Owned child termination failed';
  } finally {
    clearTimeout(timer);
    if (onClose) child.removeListener('close', onClose);
    let released = true;
    for (const stream of [child.stdout, child.stderr]) {
      try { stream?.destroy(); } catch { released = false; }
    }
    try { child.unref(); } catch { released = false; }
    result.handlesReleased = released;
  }
  return result;
}
