import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createRequire } from 'node:module';
export function assertIsolatedRuntime() {
  if (test.info().project.use.baseURL !== 'http://127.0.0.1:5561') throw new Error('Use playwright.parent-audit.config.ts; parent audit must not target another application.');
  const runtime = JSON.parse(readFileSync('tests/denetim-kanitlari/veli/runtime.json', 'utf8'));
  const root = resolve(runtime.root);
  if (dirname(root) !== resolve('server/data') || !/^quizmaster-test-parent-audit-/.test(root.split(/[\\/]/).at(-1)!) || resolve(runtime.database) !== join(root, 'server/data/audit.db') || JSON.stringify(runtime.ports) !== '[5560,5561]') throw new Error('Parent audit requires isolated fixture');
  return runtime;
}
export function prisma() {
  const runtime = assertIsolatedRuntime();
  const require = createRequire(resolve('server/package.json'));
  const { PrismaClient } = require('@prisma/client');
  return new PrismaClient({ datasources: { db: { url: 'file:' + runtime.database.replaceAll('\\', '/') } } });
}
const cached = new Map<string, Awaited<ReturnType<BrowserContext['cookies']>>>();
export const forgetCachedLogin = (email = 'parent-audit@example.test') => cached.delete(email);
export async function login(page: Page, email = 'parent-audit@example.test') {
  assertIsolatedRuntime();
  await page.context().clearCookies();
  const previous = cached.get(email);
  if (previous) {
    await page.context().addCookies(previous);
    const current = await page.request.get('/api/auth/me');
    if (current.status() === 200) {
      expect((await current.json()).user.email).toBe(email);
      cached.set(email, await page.context().cookies());
      return;
    }
    expect(current.status(), 'cached session validation').toBe(401);
    cached.delete(email);
    await page.context().clearCookies();
  }
  const csrf = await (await page.request.get('/api/csrf-token')).json();
  const response = await page.request.post('/api/auth/login', { data: { email, password: 'StudentAuditOnly2026!' }, headers: { 'x-csrf-token': csrf.csrfToken } });
  expect(response.status()).toBe(200);
  cached.set(email, await page.context().cookies());
}
export async function api(page: Page, method: string, url: string, data?: unknown) {
  assertIsolatedRuntime();
  const csrf = await (await page.request.get('/api/csrf-token')).json();
  return page.request.fetch(url.startsWith('/api/') ? url : '/api' + url, { method, headers: { 'x-csrf-token': csrf.csrfToken }, ...(data === undefined ? {} : { data }) });
}
