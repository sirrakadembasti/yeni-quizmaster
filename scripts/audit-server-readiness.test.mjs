import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { waitForAuditServer } from './audit-server-readiness.mjs';
const live = () => ({ child: { exitCode: null, signalCode: null }, errorCode: null });
async function endpoint(t, handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}/health`;
}
test('real HTTP 200 with native Fetch Response establishes readiness', async t => {
  const url = await endpoint(t, (_req, res) => { res.writeHead(200); res.end('ready'); });
  await waitForAuditServer(url, live(), { timeoutMs: 300, intervalMs: 10 });
});
test('real non-OK response is retried until the next HTTP 200', async t => {
  let requests = 0;
  const url = await endpoint(t, (_req, res) => { res.writeHead(++requests === 1 ? 503 : 200); res.end(); });
  await waitForAuditServer(url, live(), { timeoutMs: 300, intervalMs: 10 });
  assert.equal(requests, 2);
});
test('an owned process signal exit rejects before contacting a server', async () => {
  await assert.rejects(waitForAuditServer('http://127.0.0.1:1', { child: { exitCode: null, signalCode: 'SIGTERM' } }), /did not start/);
});
