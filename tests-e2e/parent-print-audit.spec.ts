import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { login } from './parent-audit-helpers';

test('P-X01 announcements and all four settings tabs invoke print and render real browser PDF', async ({ page }) => {
  test.setTimeout(180000);
  await login(page); mkdirSync('docs/parent-audit/print', { recursive: true });
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
    await page.getByRole('button', { name: 'Yazdır', exact: true }).click();
    expect(await page.evaluate(() => (window as any).__printCalls)).toBe(1);
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('button', { name: 'Yazdır', exact: true })).toBeHidden();
    await page.pdf({ path: `docs/parent-audit/print/${name}.pdf`, format: 'A4', printBackground: true });
    await page.emulateMedia({ media: 'screen' });
  }
});

test('P-X02 parent announcement audience badge names parents', async ({ page }) => {
  await login(page); await page.goto('/announcements');
  const title = page.getByRole('heading', { name: 'Parent Audit Parent Announcement', exact: true });
  await expect(title).toBeVisible();
  const card = title.locator('xpath=ancestor::div[contains(@class,"group")][1]');
  await page.screenshot({ path: 'docs/parent-audit/screenshots/parent-announcement-audience.png', fullPage: true });
  await expect(card).toContainText(/VELİLERE|VELİLER/);
});
