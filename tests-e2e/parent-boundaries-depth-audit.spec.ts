import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { login, api, prisma, assertIsolatedRuntime } from './parent-audit-helpers';

async function identity(id: string) {
  const db = prisma();
  try { return await db.user.findUniqueOrThrow({ where: { id }, select: { id: true, name: true, email: true } }); }
  finally { await db.$disconnect(); }
}

async function guiLogin(page: Page, email: string) {
  assertIsolatedRuntime();
  await page.getByLabel('E-posta', { exact: true }).fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill('StudentAuditOnly2026!');
  const signedIn = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/login' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click();
  expect((await signedIn).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Öğrenci Takibi', exact: true })).toBeVisible();
}

async function guiLogout(page: Page, name: string) {
  await page.locator('header').getByRole('button').filter({ hasText: name }).click();
  const signedOut = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/logout' && r.request().method() === 'POST');
  await page.getByRole('menuitem', { name: 'Güvenli Çıkış', exact: true }).click();
  expect((await signedOut).status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
}

async function shot(page: Page, suffix: string) {
  mkdirSync('docs/parent-audit/screenshots', { recursive: true });
  await page.screenshot({ path: `docs/parent-audit/screenshots/boundaries-depth-${suffix}.png`, fullPage: true });
}

test('linked completed result permission and foreign overview/result rejection are checked independently of secret-field assertions', async ({ page }) => {
  await login(page);
  const linked = await api(page, 'GET', '/parents/results/parent-audit-result');
  expect(linked.status()).toBe(200);
  const detail = await linked.json();
  // Check only necessary fields: never place full User/response objects or secrets into assertion output.
  expect(detail.result.studentId).toBe('parent-audit-student');
  expect(detail.result.status).toBe('completed');
  expect(detail.quiz.id).toBe('parent-audit-completed-exam');
  expect(detail.questions.length).toBeGreaterThan(0);
  for (const question of detail.questions) {
    expect(question.isCorrect).toBe(question.studentAnswer === question.correctAnswer);
  }
  const second = await api(page, 'GET', '/parents/results/parent-audit-second-result');
  expect(second.status()).toBe(200);
  expect((await second.json()).result.studentId).toBe('parent-audit-empty');
  const foreignOverview = await api(page, 'GET', '/parents/students/parent-audit-other-student/overview');
  expect(foreignOverview.status()).toBe(403);
  expect(Object.keys(await foreignOverview.json())).toEqual(['message']);
  const foreignResult = await api(page, 'GET', '/parents/results/parent-audit-private-result');
  expect(foreignResult.status()).toBe(403);
  expect(Object.keys(await foreignResult.json())).toEqual(['message']);
  const missing = await api(page, 'GET', '/parents/results/parent-audit-missing-independent-result');
  expect(missing.status()).toBe(404);
  expect(Object.keys(await missing.json())).toEqual(['message']);
});

test('parent GUI login loads connected children and GUI logout denies a protected page and API', async ({ page, context }) => {
  assertIsolatedRuntime();
  const parent = await identity('parent-audit-parent');
  const child = await identity('parent-audit-student');
  await context.clearCookies();
  await page.goto('/parent/dashboard');
  await expect(page).toHaveURL(/\/auth(?:\?|$)/);
  await guiLogin(page, parent.email);
  await expect(page).toHaveURL(/\/parent\/dashboard$/);
  await expect(page.getByRole('heading', { name: child.name, exact: true })).toBeVisible();
  await expect(page.getByRole('combobox')).toBeVisible();
  const me = await api(page, 'GET', '/auth/me');
  expect(me.status()).toBe(200);
  expect((await me.json()).user.id).toBe(parent.id);
  await shot(page, 'gui-signed-in');
  await guiLogout(page, parent.name);
  expect((await page.request.get('/api/parents/students')).status()).toBe(401);
  await page.goto('/parent/results');
  await expect(page).toHaveURL(/\/auth(?:\?|$)/);
  await shot(page, 'gui-signed-out');
});

test('logging out and signing in as a different parent clears the previous children and result cache', async ({ page, context }) => {
  assertIsolatedRuntime();
  const linkedParent = await identity('parent-audit-parent');
  const emptyParent = await identity('parent-audit-no-links');
  const children = [await identity('parent-audit-student'), await identity('parent-audit-empty')];
  await context.clearCookies();
  await page.goto('/parent/dashboard');
  await expect(page).toHaveURL(/\/auth(?:\?|$)/);
  await guiLogin(page, linkedParent.email);
  await expect(page.getByRole('heading', { name: children[0].name, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Tümünü ve detayları gör', exact: true }).click();
  await expect(page).toHaveURL(/\/parent\/results$/);
  const rows = page.getByRole('row').filter({ hasText: 'Parent Audit Completed Exam' });
  await expect(rows).toHaveCount(1);
  await rows.getByRole('button', { name: 'Detay', exact: true }).click();
  await expect(page.getByText('Öğrencinin cevabı:', { exact: true }).first()).toBeVisible();
  await guiLogout(page, linkedParent.name);
  await page.goto('/parent/dashboard');
  await expect(page).toHaveURL(/\/auth(?:\?|$)/);
  await guiLogin(page, emptyParent.email);
  await expect(page.getByRole('heading', { name: 'Hesabınıza bağlı öğrenci bulunmuyor', exact: true })).toBeVisible();
  for (const child of children) await expect(page.locator('main')).not.toContainText(child.name);
  expect((await api(page, 'GET', '/parents/results/parent-audit-result')).status()).toBe(403);
  await page.goto('/parent/results');
  await expect(page.getByText('Tamamlanmış sınav bulunmuyor.', { exact: true })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('Parent Audit Completed Exam');
  await expect(page.getByText('Öğrencinin cevabı:', { exact: true })).toHaveCount(0);
  await shot(page, 'different-parent-cache');
});
