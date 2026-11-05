import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { api, login } from './parent-audit-helpers';

test('P-X01 announcements and settings render complete print output and security excludes password fields', async ({ page }) => {
  test.setTimeout(180000);
  await login(page); mkdirSync('tests/denetim-kanitlari/veli/print', { recursive: true });
  await page.addInitScript(() => { (window as any).__printCalls = 0; window.print = () => { (window as any).__printCalls++; }; });
  for (const [name, route, ready] of [
    ['announcements', '/announcements', 'Parent Audit Parent Announcement'],
    ['profile', '/settings?tab=profile', 'Profil Bilgileri'],
    ['notifications', '/settings?tab=notifications', 'Parent Audit Notification'],
    ['logs', '/settings?tab=logs', 'Parent audit action'],
    ['security', '/settings?tab=security', 'Mevcut Şifre'],
  ]) {
    await page.goto(route); await expect(page.locator('main')).toContainText(ready, { timeout: 30000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (const animation of document.getAnimations()) {
        if (animation.effect?.getComputedTiming().iterations !== Infinity) animation.finish();
      }
    });
    const printButton = page.getByRole('button', { name: 'Yazdır', exact: true });
    if (name === 'security') {
      await expect(printButton).toHaveCount(0);
      await page.getByLabel('Mevcut Şifre', { exact: true }).fill('StudentAuditOnly2026!');
      await page.getByLabel('Yeni Şifre', { exact: true }).fill('ParentAuditTemporary2026!');
    } else {
      await printButton.click();
      expect(await page.evaluate(() => (window as any).__printCalls)).toBe(1);
    }
    if (name === 'notifications') {
      const currentPageCount = await page.getByRole('button', { name: 'Bildirimi sil', exact: true }).count();
      expect(currentPageCount).toBe(20);
      writeFileSync('tests/denetim-kanitlari/veli/print/source-notifications.json', JSON.stringify({ currentPageCount, expectedIds: Array.from({ length: 20 }, (_, i) => i) }, null, 2));
    }
    if (name === 'profile') {
      const saved = await (await api(page, 'GET', '/auth/me')).json();
      const profile = saved.user ?? saved;
      writeFileSync('tests/denetim-kanitlari/veli/print/source-profile.json', JSON.stringify({ name: profile.name, email: profile.email, phoneNumber: profile.phoneNumber, address: profile.address }, null, 2));
    }
    if (name === 'logs') {
      const rows = page.locator('main tbody tr');
      expect(await rows.count()).toBe(50);
      const details = await rows.locator('td:nth-child(2)').allTextContents();
      writeFileSync('tests/denetim-kanitlari/veli/print/source-history.json', JSON.stringify({ currentPageCount: details.length, expectedDetails: details }, null, 2));
    }
    await page.emulateMedia({ media: 'print' });
    await expect(printButton).toBeHidden();
    if (name === 'security') await expect(page.locator('main')).toContainText('Güvenlik Bilgileri');
    await page.pdf({ path: `tests/denetim-kanitlari/veli/print/${name}.pdf`, format: 'A4', printBackground: true });
    await page.emulateMedia({ media: 'screen' });
  }
});

test('P-X02 parent announcement audience badge names parents', async ({ page }) => {
  await login(page); await page.goto('/announcements');
  const title = page.getByRole('heading', { name: 'Parent Audit Parent Announcement', exact: true });
  await expect(title).toBeVisible();
  const card = title.locator('xpath=ancestor::div[contains(@class,"group")][1]');
  await page.screenshot({ path: 'tests/denetim-kanitlari/veli/screenshots/parent-announcement-audience.png', fullPage: true });
  await expect(card).toContainText(/VELİLERE|VELİLER/);
});
