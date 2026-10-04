import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';

test('unidentified service is rejected before any fixture login', async () => {
  let writes = 0;
  const server = createServer((req, res) => {
    if (req.method !== 'GET') writes++;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ csrfToken: 'not-the-audit-service' }));
  });
  // Refuse occupied test ports; never terminate someone else's service.
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(5560, '127.0.0.1', resolve); });
  try {
    const child = spawn(process.execPath, ['scripts/integration-load-diagnostic.mjs'], {
      cwd: path.resolve(import.meta.dirname, '..'), windowsHide: true, stdio: 'ignore', timeout: 15000,
    });
    const [code] = await once(child, 'exit');
    assert.equal(code, 1);
    assert.equal(writes, 0, 'Unknown service received a login or mutation');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
