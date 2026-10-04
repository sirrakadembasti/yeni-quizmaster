import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { login, prisma } from './parent-audit-helpers';

test('P-A03 results student selector independently exposes a purpose label', async ({ page }) => {
  await login(page); await page.goto('/parent/results');
  await expect(page.getByRole('combobox')).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveAccessibleName(/öğrenci seç/i);
});

for (const [id, tab, pattern, ready] of [
  ['P-D01', 'notifications', '**/api/notifications?*', 'Parent Audit Notification'],
  ['P-D02', 'logs', '**/api/admin/logs/me?*', 'Parent audit action'],
]) {
  test(`${id} settings ${tab} controlled API500 and real recovery`, async ({ page }) => {
    await login(page); await page.route(pattern, r => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Controlled parent settings failure' }) }));
    await page.goto(`/settings?tab=${tab}`);
    await expect(page.getByRole('alert')).toContainText(/yüklenemedi/i, { timeout: 30000 });
    mkdirSync('docs/parent-audit/screenshots', { recursive: true });
    await page.screenshot({ path: `docs/parent-audit/screenshots/${id}-settings-failure.png`, fullPage: true });
    await page.unroute(pattern); await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click();
    await expect(page.locator('main')).toContainText(ready, { timeout: 30000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

test('P-A02 long valid child name and email remain inside mobile document', async ({ page }) => {
  const db = prisma(), id = 'parent-audit-student';
  const saved = await db.user.findUniqueOrThrow({ where: { id } });
  try {
    await db.user.update({ where: { id }, data: { name: 'Ada ' + 'Uzun Öğrenci Adı '.repeat(5), email: 'a'.repeat(60) + '@' + 'd'.repeat(40) + '.example.test' } });
    await login(page); await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/parent/dashboard');
    await expect(page.getByText('Parent Audit Completed Exam', { exact: true }).first()).toBeVisible();
    mkdirSync('docs/parent-audit/screenshots', { recursive: true });
    await page.screenshot({ path: 'docs/parent-audit/screenshots/long-child-mobile.png', fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await db.user.update({ where: { id }, data: { name: saved.name, email: saved.email } }); await db.$disconnect(); }
});
