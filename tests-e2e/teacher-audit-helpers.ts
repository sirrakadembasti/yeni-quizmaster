import { expect, Page, BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
export function assertIsolatedRuntime() {
  const runtime = JSON.parse(readFileSync('docs/teacher-audit/runtime.json', 'utf8'));
  const root = resolve(runtime.root);
  if (dirname(root) !== resolve('server/data') || !/^quizmaster-test-teacher-audit-/.test(root.split(/[\\/]/).at(-1)!)
    || resolve(runtime.database) !== join(root, 'server/data/audit.db') || JSON.stringify(runtime.ports) !== '[5530,5531]')
    throw new Error('Teacher audit requires its isolated database and servers on 5530/5531.');
  return runtime;
}
export const teacherAuditIds = {
  class: '11111111-1111-4111-8111-111111111111', otherClass: '22222222-2222-4222-8222-222222222222',
  category: '33333333-3333-4333-8333-333333333333', otherCategory: '44444444-4444-4444-8444-444444444444',
};
const cached = new Map<string, Awaited<ReturnType<BrowserContext['cookies']>>>();
export const forgetCachedLogin = (email = 'teacher-audit@example.test') => cached.delete(email);
export async function login(page: Page, email = 'teacher-audit@example.test') {
  assertIsolatedRuntime();
  await page.context().clearCookies();
  const previous = cached.get(email);
  if (previous) {
    await page.context().addCookies(previous);
    // Logout/password changes and expiry tests invalidate real server sessions.
    // A saved cookie alone is not evidence that this identity is still signed in.
    const current = await page.request.get('/api/auth/me');
    if (current.status() === 200) {
      const body = await current.json();
      expect(body.user.email).toBe(email);
      cached.set(email, await page.context().cookies());
      return;
    }
    expect(current.status(), 'cached session validation').toBe(401);
    cached.delete(email);
    await page.context().clearCookies();
  }
  const csrf = await (await page.request.get('/api/csrf-token')).json();
  const response = await page.request.post('/api/auth/login', { data: { email, password: 'TeacherAuditOnly2026!' },
    headers: { 'x-csrf-token': csrf.csrfToken } });
  expect(response.status()).toBe(200);
  cached.set(email, await page.context().cookies());
}
export async function api(page: Page, path: string, method = 'GET', data?: unknown) {
  assertIsolatedRuntime();
  const csrf = await (await page.request.get('/api/csrf-token')).json();
  const response = await page.request.fetch('/api' + path, { method,
    headers: { 'x-csrf-token': csrf.csrfToken, 'Content-Type': 'application/json' },
    ...(data === undefined ? {} : { data }) });
  const text = await response.text();
  let body: any; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status(), body };
}
