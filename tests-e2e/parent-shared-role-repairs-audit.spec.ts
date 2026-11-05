import { test, expect } from '@playwright/test';
import { login } from './parent-audit-helpers';

for (const [role, email] of [
  ['admin', 'parent-audit-admin@example.test'],
  ['teacher', 'parent-audit-teacher@example.test'],
  ['student', 'parent-audit-child@example.test'],
]) {
  test(`P-R shared settings print preserves ${role} profile and security screen`, async ({ page }) => {
    await login(page, email);
    await page.goto('/settings?tab=profile');
    await expect(page.getByRole('button', { name: 'Yazdır', exact: true })).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('main')).toContainText(email);
    await expect(page.locator('main input:visible')).toHaveCount(0);
    await page.emulateMedia({ media: 'screen' });
    await page.goto('/settings?tab=security');
    await expect(page.getByLabel('Mevcut Şifre', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Yazdır', exact: true })).toHaveCount(0);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('main')).toContainText('Güvenlik Bilgileri');
    await expect(page.getByLabel('Mevcut Şifre', { exact: true })).toBeHidden();
  });
}
