import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { createRequire } from 'node:module';

const runtime = JSON.parse(readFileSync('docs/admin-audit/runtime.json', 'utf8'));
const root = resolve(runtime.root);
if (dirname(root) !== resolve('server/data') || !basename(root).startsWith('quizmaster-test-admin-audit-') ||
    resolve(runtime.database) !== join(root, 'server', 'data', 'audit.db') || JSON.stringify(runtime.ports) !== '[5510,5511]') {
  throw new Error('Session expiry requires the disposable audit runtime.');
}
const sessionFile = join(root, 'server', 'data', 'sessions.db');
if (!existsSync(sessionFile)) throw new Error('Disposable session store missing');
const serverRequire = createRequire(resolve('server/package.json'));
const sqlite = createRequire(serverRequire.resolve('connect-sqlite3'))('sqlite3');

test('expired server session rejects a still-present browser cookie and redirects admin to login', async ({ page, baseURL }) => {
  test.setTimeout(180000);
  expect(baseURL).toBe('http://127.0.0.1:5511');
  const token = (await (await page.request.get('/api/csrf-token')).json()).csrfToken;
  expect((await page.request.post('/api/auth/login', { data: { email: 'audit-admin@example.test', password: 'AuditOnly2026!' }, headers: { 'x-csrf-token': token } })).status()).toBe(200);
  expect((await page.request.get('/api/admin/logs?limit=1')).status()).toBe(200);
  const cookie = (await page.context().cookies()).find(item => item.name === 'quizmaster.sid');
  expect(Boolean(cookie)).toBe(true);
  const signed = decodeURIComponent(cookie!.value);
  expect(signed.startsWith('s:')).toBe(true);
  const sid = signed.slice(2, signed.lastIndexOf('.'));
  const db = new sqlite.Database(sessionFile, sqlite.OPEN_READWRITE);
  const run = (sql: string, values: unknown[]) => new Promise<number>((done, reject) => db.run(sql, values, function(this: { changes: number }, error: Error | null) { if (error) reject(error); else done(this.changes); }));
  try {
    // Exercise the store's real expiration check, without deleting the cookie
    // or touching any other test's session. This does not wait out real TTL.
    expect(await run('UPDATE sessions SET expired = ? WHERE sid = ?', [Date.now() - 1000, sid])).toBe(1);
    expect((await page.context().cookies()).some(item => item.name === cookie!.name && item.value === cookie!.value)).toBe(true);
    expect((await page.request.get('/api/admin/logs?limit=1')).status()).toBe(401);
    await page.goto('/management', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth$/, { timeout: 60000 });
    await expect(page.getByLabel('E-posta', { exact: true })).toBeVisible();
    await expect(page.locator('[data-dashboard-shell]')).toHaveCount(0);
  } finally {
    await run('DELETE FROM sessions WHERE sid = ?', [sid]);
    await new Promise<void>((done, reject) => db.close((error: Error | null) => error ? reject(error) : done()));
  }
});
