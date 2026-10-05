import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
export function assertIsolatedRuntime() {
  const file = process.env.ACADEMIC_ARCHIVE_RUNTIME;
  if (!file) throw new Error('Disposable academic runtime required');
  const runtime = JSON.parse(readFileSync(file, 'utf8'));
  const root = path.resolve(runtime.root);
  if (path.dirname(root) !== path.resolve('server/data') || !path.basename(root).startsWith('quizmaster-test-academic-') || path.resolve(runtime.database) !== path.join(root, 'server/data/academic.db') || runtime.baseURL !== `http://127.0.0.1:${runtime.ports[1]}` || test.info().project.use.baseURL !== runtime.baseURL) throw new Error('Unsafe academic runtime');
  return runtime;
}
export function prisma() {
  const runtime = assertIsolatedRuntime();
  const { PrismaClient } = createRequire(path.resolve('server/package.json'))('@prisma/client');
  return new PrismaClient({ datasources: { db: { url: 'file:' + runtime.database.replaceAll('\\', '/') } } });
}
export async function login(page: Page) {
  const runtime = assertIsolatedRuntime();
  await page.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort());
  await page.context().clearCookies();
  const csrf = await (await page.request.get('/api/csrf-token')).json();
  const response = await page.request.post('/api/auth/login', { data: { email: 'academic-admin@example.test', password: 'AcademicFixtureOnly2026!' }, headers: { 'x-csrf-token': csrf.csrfToken } });
  expect(response.status()).toBe(200);
}
export async function api(page: Page, method: string, url: string, data?: unknown) {
  assertIsolatedRuntime();
  const csrf = await (await page.request.get('/api/csrf-token')).json();
  return page.request.fetch(url.startsWith('/api/') ? url : '/api' + url, { method, headers: { 'x-csrf-token': csrf.csrfToken }, ...(data === undefined ? {} : { data }) });
}
