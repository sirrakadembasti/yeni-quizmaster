import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { login, api, prisma, assertIsolatedRuntime, forgetCachedLogin } from './student-audit-helpers';

const studentId = 'student-audit-student';
const otherStudentId = 'student-audit-other-student';
const originalPassword = 'StudentAuditOnly2026!';
const temporaryPassword = 'StudentAuditTemporary2026!';

test.describe('Student audit: shared depth', () => {
  test.beforeAll(() => { assertIsolatedRuntime(); });
  test.beforeEach(async ({ page }) => { await login(page); });

  test('GUI password change revokes another live session, validates new login and restores original password', async ({ page, browser }) => {
    test.setTimeout(180000);
    const secondContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5541' });
    const second = await secondContext.newPage();
    let changed = false;
    let originalError: unknown;
    let cleanupError: unknown;
    try {
      forgetCachedLogin(); // The second device must have a distinct server session.
      await login(second);
      expect((await api(second, 'GET', '/api/auth/me')).status()).toBe(200);
      const oldCookie = (await page.context().cookies()).find(cookie => cookie.name === 'quizmaster.sid');
      await page.goto('/settings?tab=security');
      await page.getByLabel('Mevcut Şifre', { exact: true }).fill(originalPassword);
      await page.getByLabel('Yeni Şifre', { exact: true }).fill(temporaryPassword);
      await page.getByLabel('Yeni Şifre (Tekrar)', { exact: true }).fill(temporaryPassword);
      const pending = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/auth/change-password');
      await page.getByRole('button', { name: 'Şifreyi Güncelle', exact: true }).click();
      const response = await pending;
      changed = response.status() === 200;
      expect(response.status()).toBe(200);
      await expect(page.getByText('Şifreniz değiştirildi.', { exact: true })).toBeVisible();
      for (const name of ['Mevcut Şifre', 'Yeni Şifre', 'Yeni Şifre (Tekrar)']) await expect(page.getByLabel(name, { exact: true })).toHaveValue('');
      const newCookie = (await page.context().cookies()).find(cookie => cookie.name === 'quizmaster.sid');
      expect(newCookie?.value).toBeTruthy();
      expect(newCookie?.value).not.toBe(oldCookie?.value);
      expect((await api(page, 'GET', '/api/auth/me')).status()).toBe(200);
      expect((await api(second, 'GET', '/api/auth/me')).status()).toBe(401);
      await second.goto('/settings?tab=security');
      await expect(second).toHaveURL(/\/auth$/);
      expect((await api(second, 'POST', '/api/auth/login', { email: 'student-audit@example.test', password: originalPassword })).status()).toBe(401);
      expect((await api(second, 'POST', '/api/auth/login', { email: 'student-audit@example.test', password: temporaryPassword })).status()).toBe(200);
      const identity = await (await api(second, 'GET', '/api/auth/me')).json();
      expect(identity.user.id).toBe(studentId);
      await second.goto('/student/dashboard');
      await expect(second.locator('[data-dashboard-shell]')).toBeVisible();
    } catch (error) { originalError = error; }
    finally {
      if (changed) {
        try {
          // Normal login obtains a live session even if an earlier assertion failed.
          expect((await api(page, 'POST', '/api/auth/login', { email: 'student-audit@example.test', password: temporaryPassword })).status()).toBe(200);
          expect((await api(page, 'POST', '/api/auth/change-password', { currentPassword: temporaryPassword, newPassword: originalPassword })).status()).toBe(200);
          expect((await api(page, 'POST', '/api/auth/login', { email: 'student-audit@example.test', password: originalPassword })).status()).toBe(200);
        } catch (error) { cleanupError = error; }
      }
      await secondContext.close();
    }
    if (originalError) throw originalError;
    if (cleanupError) throw cleanupError;
  });

  test('notification GUI paginates, marks read, deletes own fixture and denies foreign deletion', async ({ page }) => {
    test.setTimeout(180000);
    const db = prisma();
    const prefix = `Student notification depth ${randomUUID()}`;
    const ownIds: string[] = [];
    let foreignId: string | undefined;
    try {
      for (let index = 0; index < 28; index++) {
        const item = await db.notification.create({ data: {
          id: randomUUID(), userId: studentId, title: `${prefix} ${String(index).padStart(2, '0')}`,
          message: 'Disposable own student notification', type: 'info', isRead: false,
          createdAt: new Date(Date.now() + (index + 1) * 1000),
        } });
        ownIds.push(item.id);
      }
      const foreign = await db.notification.create({ data: { id: randomUUID(), userId: otherStudentId, title: `${prefix} foreign`, message: 'Private foreign student notification', isRead: false } });
      foreignId = foreign.id;
      const beforeResponse = await api(page, 'GET', '/api/notifications?limit=100');
      expect(beforeResponse.status()).toBe(200);
      const before = await beforeResponse.json();
      expect(before.notifications.filter((notification: any) => ownIds.includes(notification.id))).toHaveLength(28);
      expect(before.notifications.some((notification: any) => notification.id === foreignId)).toBe(false);
      await page.goto('/settings?tab=notifications');
      await expect(page.getByRole('button', { name: 'Bildirimi sil', exact: true })).toHaveCount(20);
      await expect(page.getByRole('button', { name: 'Önceki', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Sonraki', exact: true }).click();
      await expect(page.getByText(/Sayfa 2 \/ /)).toBeVisible();
      await expect(page.getByText(`${prefix} 00`, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Önceki', exact: true }).click();
      await page.getByRole('button', { name: 'Tümünü Okundu İşaretle', exact: true }).click();
      await expect.poll(async () => (await (await api(page, 'GET', '/api/notifications?limit=100')).json()).pagination.unread).toBe(0);
      expect(await db.notification.count({ where: { id: { in: ownIds }, isRead: false } })).toBe(0);
      const title = `${prefix} 27`;
      const row = page.getByText(title, { exact: true }).locator('xpath=ancestor::div[contains(@class,"p-4")][1]');
      await row.getByRole('button', { name: 'Bildirimi sil', exact: true }).click();
      await expect(page.getByText(title, { exact: true })).toHaveCount(0);
      await expect.poll(async () => db.notification.count({ where: { id: ownIds[27] } })).toBe(0);
      await page.getByRole('button', { name: 'Bildirimleri aç', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Hepsini Oku', exact: true })).toHaveCount(0);
      await expect(page.getByText(title, { exact: true })).toHaveCount(0);
      await page.getByRole('link', { name: 'Tüm Bildirimleri Gör', exact: true }).click();
      await page.reload();
      await expect(page.getByText(title, { exact: true })).toHaveCount(0);
      const denied = await api(page, 'DELETE', `/api/notifications/${foreignId}`);
      expect(denied.status()).toBe(404);
      const unchanged = await db.notification.findUnique({ where: { id: foreignId } });
      expect(unchanged.userId).toBe(otherStudentId);
      expect(unchanged.isRead).toBe(false);
      expect(await db.notification.count({ where: { id: { in: ownIds } } })).toBe(27);
    } finally {
      await db.notification.deleteMany({ where: { id: { in: [...ownIds, ...(foreignId ? [foreignId] : [])] } } });
      await db.$disconnect();
    }
  });

  test('own history date API filter and GUI pagination exclude old and foreign fixture entries', async ({ page }) => {
    test.setTimeout(180000);
    const db = prisma();
    const prefix = `Student history depth ${randomUUID()}`;
    const ids: string[] = [];
    try {
      for (let index = 0; index < 55; index++) {
        const item = await db.actionLog.create({ data: { id: randomUUID(), userId: studentId, action: 'LOGIN', details: `${prefix} ${String(index).padStart(2, '0')}`, createdAt: new Date(Date.now() + index * 1000) } });
        ids.push(item.id);
      }
      const oldDate = new Date(); oldDate.setMonth(oldDate.getMonth() - 7);
      const old = await db.actionLog.create({ data: { id: randomUUID(), userId: studentId, action: 'LOGIN', details: `${prefix} old`, createdAt: oldDate } });
      ids.push(old.id);
      const foreign = await db.actionLog.create({ data: { id: randomUUID(), userId: otherStudentId, action: 'LOGIN', details: `${prefix} foreign`, createdAt: new Date() } });
      ids.push(foreign.id);
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const response = await api(page, 'GET', `/api/admin/logs/me?limit=100&startDate=${encodeURIComponent(cutoff)}`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.logs.filter((entry: any) => ids.includes(entry.id))).toHaveLength(55);
      expect(body.logs.every((entry: any) => entry.userId === studentId && new Date(entry.createdAt).getTime() >= new Date(cutoff).getTime())).toBe(true);
      expect(body.logs.some((entry: any) => entry.id === old.id || entry.id === foreign.id)).toBe(false);
      const invalid = await api(page, 'GET', '/api/admin/logs/me?startDate=invalid-date');
      expect(invalid.status()).toBe(400);
      await page.goto('/settings?tab=logs');
      await expect(page.locator('tbody tr')).toHaveCount(50);
      await expect(page.getByText(`${prefix} 54`, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Önceki', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Sonraki', exact: true }).click();
      await expect(page.getByText(/Sayfa 2 \/ /)).toBeVisible();
      await expect(page.getByText(`${prefix} 00`, { exact: true })).toBeVisible();
      await expect(page.getByText(`${prefix} old`, { exact: true })).toHaveCount(0);
      await expect(page.getByText(`${prefix} foreign`, { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Önceki', exact: true }).click();
      await expect(page.getByText(`${prefix} 54`, { exact: true })).toBeVisible();
      expect((await api(page, 'GET', '/api/admin/logs')).status()).toBe(403);
    } finally {
      await db.actionLog.deleteMany({ where: { id: { in: ids } } });
      await db.$disconnect();
    }
  });

  test('student theme survives reload and mobile navigation traps focus and closes correctly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/student/dashboard');
    const light = page.getByTitle('Aydınlık Moda Geç', { exact: true });
    const dark = page.getByTitle('Karanlık Moda Geç', { exact: true });
    if (await light.count()) await light.click();
    await dark.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    const trigger = page.getByRole('button', { name: 'Menüyü aç', exact: true });
    await trigger.click();
    const menu = page.getByRole('dialog', { name: 'Ana menü', exact: true });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Menüyü kapat', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(menu.getByRole('link', { name: 'Ayarlar', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menu.getByRole('button', { name: 'Menüyü kapat', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole('button', { name: 'Menüyü kapat', exact: true }).first().click({ position: { x: 380, y: 100 } });
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await menu.getByRole('link', { name: 'Anketlerim', exact: true }).click();
    await expect(page).toHaveURL(/\/student\/surveys$/);
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Anketlerim', exact: true })).toBeVisible();
    await light.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});
