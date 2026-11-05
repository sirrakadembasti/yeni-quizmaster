import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { login, api, prisma } from './parent-audit-helpers';

const parentId = 'parent-audit-parent';
const foreignId = 'parent-audit-other-student';
const securityId = 'parent-audit-security';
const securityEmail = 'parent-audit-security@example.test';
const originalPassword = 'StudentAuditOnly2026!';
const temporaryPassword = 'ParentAuditTemporary2026!';

async function securityReady(page: Page) {
  await page.goto('/settings?tab=security');
  await expect(page.getByLabel('Mevcut Şifre', { exact: true })).toBeVisible({ timeout: 30000 });
}

test.describe('Parent audit: shared settings and announcements', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('P-S01 parent edits own profile through GUI and reload persists actual DB values', async ({ page }) => {
    const db = prisma();
    const original = await db.user.findUniqueOrThrow({ where: { id: parentId } });
    const changed = { name: `Parent profile audit ${randomUUID()}`, phoneNumber: '05550001122', address: 'Parent audit fixture address' };
    try {
      await page.goto('/settings?tab=profile');
      await expect(page.getByLabel('Ad Soyad', { exact: true })).toHaveValue(original.name, { timeout: 30000 });
      for (const name of ['Ad Soyad', 'E-posta', 'Telefon', 'Adres']) await expect(page.getByLabel(name, { exact: true })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Değişiklikleri Kaydet', exact: true })).toBeDisabled();
      await page.getByLabel('Ad Soyad', { exact: true }).fill(changed.name);
      await page.getByLabel('Telefon', { exact: true }).fill(changed.phoneNumber);
      await page.getByLabel('Adres', { exact: true }).fill(changed.address);
      const saved = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/me' && r.request().method() === 'PATCH');
      await page.getByRole('button', { name: 'Değişiklikleri Kaydet', exact: true }).click();
      expect((await saved).status()).toBe(200);
      await expect(page.getByText('Profil bilgileriniz güncellendi.', { exact: true })).toBeVisible();
      expect(await db.user.findUniqueOrThrow({ where: { id: parentId } })).toMatchObject({ ...changed, role: 'parent', email: original.email });
      await page.reload();
      await expect(page.getByLabel('Ad Soyad', { exact: true })).toHaveValue(changed.name, { timeout: 30000 });
      await expect(page.getByLabel('Telefon', { exact: true })).toHaveValue(changed.phoneNumber);
      await expect(page.getByLabel('Adres', { exact: true })).toHaveValue(changed.address);
    } finally {
      try { await db.user.update({ where: { id: parentId }, data: { name: original.name, phoneNumber: original.phoneNumber, address: original.address } }); }
      finally { await db.$disconnect(); }
    }
  });

  test('P-S02 notification GUI paginates, marks read, deletes own record and rejects foreign deletion', async ({ page }) => {
    test.setTimeout(180000);
    const db = prisma(), prefix = `Parent notifications ${randomUUID()}`;
    const ids: string[] = [];
    const originalRead = await db.notification.findMany({ where: { userId: parentId }, select: { id: true, isRead: true } });
    try {
      for (let n = 0; n < 25; n++) {
        const record = await db.notification.create({ data: { id: randomUUID(), userId: parentId, title: `${prefix} ${String(n).padStart(2, '0')}`, message: 'Disposable parent audit notification', isRead: false, createdAt: new Date(Date.now() + 60000 + n * 1000) } });
        ids.push(record.id);
      }
      const foreign = await db.notification.create({ data: { id: randomUUID(), userId: foreignId, title: `${prefix} foreign`, message: 'Private other user fixture', isRead: false } });
      ids.push(foreign.id);
      const own = await api(page, 'GET', '/api/notifications?limit=100');
      expect(own.status()).toBe(200);
      const ownBody = await own.json();
      expect(ownBody.notifications.filter((record: any) => ids.slice(0, 25).includes(record.id))).toHaveLength(25);
      expect(ownBody.notifications.some((record: any) => record.id === foreign.id)).toBe(false);
      await page.goto('/settings?tab=notifications');
      await expect(page.getByRole('button', { name: 'Bildirimi sil', exact: true })).toHaveCount(20, { timeout: 30000 });
      await expect(page.getByRole('button', { name: 'Önceki', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Sonraki', exact: true }).click();
      await expect(page.getByText(/Sayfa 2 \/ /)).toBeVisible();
      await expect(page.getByText(`${prefix} 00`, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Önceki', exact: true }).click();
      await expect(page.getByText(`${prefix} 24`, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Tümünü Okundu İşaretle', exact: true }).click();
      await expect.poll(async () => db.notification.count({ where: { id: { in: ids.slice(0, 25) }, isRead: false } })).toBe(0);
      const row = page.getByText(`${prefix} 24`, { exact: true }).locator('xpath=ancestor::div[contains(@class,"p-4")][1]');
      await row.getByRole('button', { name: 'Bildirimi sil', exact: true }).click();
      await expect(page.getByText(`${prefix} 24`, { exact: true })).toHaveCount(0);
      await expect.poll(async () => db.notification.count({ where: { id: ids[24] } })).toBe(0);
      await page.reload();
      await expect(page.getByText(`${prefix} 23`, { exact: true })).toBeVisible({ timeout: 30000 });
      await expect(page.getByText(`${prefix} 24`, { exact: true })).toHaveCount(0);
      expect((await api(page, 'DELETE', `/api/notifications/${foreign.id}`)).status()).toBe(404);
      expect(await db.notification.findUniqueOrThrow({ where: { id: foreign.id } })).toMatchObject({ userId: foreignId, isRead: false });
    } finally {
      try {
        await db.notification.deleteMany({ where: { id: { in: ids } } });
        for (const record of originalRead) await db.notification.updateMany({ where: { id: record.id, userId: parentId }, data: { isRead: record.isRead } });
      } finally { await db.$disconnect(); }
    }
  });

  test('P-S03 notification sound preference persists after reload and is restored', async ({ page }) => {
    const response = await api(page, 'GET', '/api/notifications/preferences');
    expect(response.status()).toBe(200);
    const before = await response.json();
    try {
      await page.goto('/settings?tab=notifications');
      const sound = page.getByRole('switch', { name: 'Bildirim sesini aç veya kapat', exact: true });
      await expect(sound).toHaveAttribute('aria-checked', String(!before.muted), { timeout: 30000 });
      const changed = page.waitForResponse(r => new URL(r.url()).pathname === '/api/notifications/preferences' && r.request().method() === 'PATCH');
      await sound.click();
      expect((await changed).status()).toBe(200);
      await page.reload();
      await expect(sound).toHaveAttribute('aria-checked', String(before.muted), { timeout: 30000 });
      expect((await (await api(page, 'GET', '/api/notifications/preferences')).json()).muted).toBe(!before.muted);
    } finally { expect((await api(page, 'PATCH', '/api/notifications/preferences', { muted: before.muted })).status()).toBe(200); }
  });

  test('P-S04 own operation history paginates and excludes old and foreign entries', async ({ page }) => {
    test.setTimeout(180000);
    const db = prisma(), prefix = `Parent history ${randomUUID()}`, ids: string[] = [];
    try {
      for (let n = 0; n < 55; n++) {
        const record = await db.actionLog.create({ data: { id: randomUUID(), userId: parentId, action: 'LOGIN', details: `${prefix} ${String(n).padStart(2, '0')}`, createdAt: new Date(Date.now() + 60000 + n * 1000) } });
        ids.push(record.id);
      }
      const oldDate = new Date(); oldDate.setMonth(oldDate.getMonth() - 7);
      const old = await db.actionLog.create({ data: { id: randomUUID(), userId: parentId, action: 'LOGIN', details: `${prefix} old`, createdAt: oldDate } });
      ids.push(old.id);
      const foreign = await db.actionLog.create({ data: { id: randomUUID(), userId: foreignId, action: 'LOGIN', details: `${prefix} foreign` } });
      ids.push(foreign.id);
      const cutoff = new Date(Date.now() - 86400000).toISOString();
      const response = await api(page, 'GET', `/api/admin/logs/me?limit=100&startDate=${encodeURIComponent(cutoff)}`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.logs.filter((record: any) => ids.includes(record.id))).toHaveLength(55);
      expect(body.logs.every((record: any) => record.userId === parentId && new Date(record.createdAt).getTime() >= new Date(cutoff).getTime())).toBe(true);
      expect(body.logs.some((record: any) => record.id === old.id || record.id === foreign.id)).toBe(false);
      await page.goto('/settings?tab=logs');
      await expect(page.locator('main tbody tr')).toHaveCount(50, { timeout: 30000 });
      await expect(page.getByText(`${prefix} 54`, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Önceki', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Sonraki', exact: true }).click();
      await expect(page.getByText(/Sayfa 2 \/ /)).toBeVisible();
      await expect(page.getByText(`${prefix} 00`, { exact: true })).toBeVisible();
      await expect(page.getByText(`${prefix} old`, { exact: true })).toHaveCount(0);
      await expect(page.getByText(`${prefix} foreign`, { exact: true })).toHaveCount(0);
      expect((await api(page, 'GET', '/api/admin/logs')).status()).toBe(403);
    } finally {
      try { await db.actionLog.deleteMany({ where: { id: { in: ids } } }); }
      finally { await db.$disconnect(); }
    }
  });

  test('P-S05 security form rejects mismatch and incorrect current password without changing password', async ({ page }) => {
    const db = prisma();
    const before = await db.user.findUniqueOrThrow({ where: { id: parentId } });
    try {
      await securityReady(page);
      await expect(page.getByRole('button', { name: 'Şifreyi Güncelle', exact: true })).toBeDisabled();
      await page.getByLabel('Mevcut Şifre', { exact: true }).fill('WrongParentAuditPassword!');
      await page.getByLabel('Yeni Şifre', { exact: true }).fill(temporaryPassword);
      await page.getByLabel('Yeni Şifre (Tekrar)', { exact: true }).fill('MismatchParentAuditPassword!');
      await page.getByRole('button', { name: 'Şifreyi Güncelle', exact: true }).click();
      await expect(page.getByText('Yeni şifreler uyuşmuyor.', { exact: true })).toBeVisible();
      await page.getByLabel('Yeni Şifre (Tekrar)', { exact: true }).fill(temporaryPassword);
      const rejected = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/change-password' && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Şifreyi Güncelle', exact: true }).click();
      expect((await rejected).status()).toBe(400);
      await expect(page.getByText('Mevcut şifreniz yanlış.', { exact: true })).toBeVisible();
      expect((await db.user.findUniqueOrThrow({ where: { id: parentId } })).password).toBe(before.password);
    } finally {
      try { await db.user.update({ where: { id: parentId }, data: { password: before.password } }); }
      finally { await db.$disconnect(); }
    }
  });

  test('P-S06 dedicated parent changes password, revokes other session and new login works', async ({ page, browser }) => {
    test.setTimeout(180000);
    const db = prisma();
    const original = await db.user.findUniqueOrThrow({ where: { id: securityId } });
    const secondContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5561' });
    const second = await secondContext.newPage();
    try {
      await login(page, securityEmail);
      // Direct login creates a separate server session, even if helper login is cached.
      expect((await api(second, 'POST', '/api/auth/login', { email: securityEmail, password: originalPassword })).status()).toBe(200);
      expect((await api(second, 'GET', '/api/auth/me')).status()).toBe(200);
      await securityReady(page);
      await page.getByLabel('Mevcut Şifre', { exact: true }).fill(originalPassword);
      await page.getByLabel('Yeni Şifre', { exact: true }).fill(temporaryPassword);
      await page.getByLabel('Yeni Şifre (Tekrar)', { exact: true }).fill(temporaryPassword);
      const saved = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/change-password' && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Şifreyi Güncelle', exact: true }).click();
      expect((await saved).status()).toBe(200);
      await expect(page.getByText('Şifreniz değiştirildi.', { exact: true })).toBeVisible();
      for (const name of ['Mevcut Şifre', 'Yeni Şifre', 'Yeni Şifre (Tekrar)']) await expect(page.getByLabel(name, { exact: true })).toHaveValue('');
      expect((await db.user.findUniqueOrThrow({ where: { id: securityId } })).password).not.toBe(original.password);
      expect((await api(second, 'GET', '/api/auth/me')).status()).toBe(401);
      expect((await api(second, 'POST', '/api/auth/login', { email: securityEmail, password: originalPassword })).status()).toBe(401);
      expect((await api(second, 'POST', '/api/auth/login', { email: securityEmail, password: temporaryPassword })).status()).toBe(200);
      expect((await (await api(second, 'GET', '/api/auth/me')).json()).user.id).toBe(securityId);
    } finally {
      try { await db.user.update({ where: { id: securityId }, data: { password: original.password } }); }
      finally { await db.$disconnect(); await secondContext.close(); }
    }
  });

  test('P-S07 parent sees intended announcements and cannot create or delete', async ({ page }) => {
    const db = prisma();
    const original = await db.announcement.findUniqueOrThrow({ where: { id: 'parent-audit-parent-announcement' } });
    const privateAnnouncement = await db.announcement.findUniqueOrThrow({ where: { id: 'parent-audit-private-announcement' } });
    let accidentalCreatedId: string | undefined;
    try {
      const response = await api(page, 'GET', '/api/announcements');
      expect(response.status()).toBe(200);
      const records = (await response.json()).announcements;
      for (const id of ['parent-audit-parent-announcement', 'parent-audit-all-announcement']) expect(records.some((record: any) => record.id === id)).toBe(true);
      expect(records.some((record: any) => record.id === 'parent-audit-private-announcement')).toBe(false);
      await page.goto('/announcements');
      await expect(page.getByRole('heading', { name: 'Parent Audit Parent Announcement', exact: true })).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole('heading', { name: 'Parent Audit All Announcement', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: privateAnnouncement.title, exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Yeni Duyuru', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Duyuruyu sil', exact: true })).toHaveCount(0);
      const created = await api(page, 'POST', '/api/announcements', { title: `Forbidden parent audit ${randomUUID()}`, content: 'Audit unauthorized creation', targetRole: 'all' });
      if (created.ok()) accidentalCreatedId = (await created.json()).announcement?.id;
      expect(created.status()).toBe(403);
      expect((await api(page, 'DELETE', '/api/announcements/parent-audit-parent-announcement')).status()).toBe(403);
      expect(await db.announcement.findUnique({ where: { id: original.id } })).not.toBeNull();
    } finally {
      try {
        if (accidentalCreatedId) await db.announcement.deleteMany({ where: { id: accidentalCreatedId } });
        if (!await db.announcement.findUnique({ where: { id: original.id } })) await db.announcement.create({ data: original });
      } finally { await db.$disconnect(); }
    }
  });

  test('P-S08 announcement API error shows retry and recovers from the real server', async ({ page }) => {
    await page.route('**/api/announcements', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Controlled parent announcement failure' }) }));
    await page.goto('/announcements');
    await expect(page.getByRole('alert')).toContainText('Duyurular yüklenemedi', { timeout: 30000 });
    await expect(page.getByText('Henüz bir duyuru yayınlanmamış.', { exact: true })).toHaveCount(0);
    await page.unroute('**/api/announcements');
    const recovered = page.waitForResponse(r => new URL(r.url()).pathname === '/api/announcements' && r.status() === 200);
    await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click();
    await recovered;
    await expect(page.getByRole('heading', { name: 'Parent Audit Parent Announcement', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('P-S09 mobile settings tabs work with keyboard and preserve query navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/settings?tab=profile');
    await expect(page.getByLabel('Ad Soyad', { exact: true })).toBeVisible({ timeout: 30000 });
    const profile = page.getByRole('tab', { name: 'Profil Bilgileri', exact: true });
    await profile.focus();
    await page.keyboard.press('ArrowRight');
    const notifications = page.getByRole('tab', { name: 'Bildirimler', exact: true });
    await expect(notifications).toBeFocused();
    await expect(notifications).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/\/settings\?tab=notifications$/);
    await page.keyboard.press('ArrowRight');
    const history = page.getByRole('tab', { name: 'İşlem Geçmişi', exact: true });
    await expect(history).toBeFocused();
    await expect(history).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/\/settings\?tab=logs$/);
    await page.keyboard.press('ArrowRight');
    const security = page.getByRole('tab', { name: 'Güvenlik', exact: true });
    await expect(security).toBeFocused();
    await expect(page.getByLabel('Mevcut Şifre', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/settings\?tab=security$/);
    await page.reload();
    await expect(security).toHaveAttribute('aria-selected', 'true', { timeout: 30000 });
    await expect(page.getByLabel('Mevcut Şifre', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
