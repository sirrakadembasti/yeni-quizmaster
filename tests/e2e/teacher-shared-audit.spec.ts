import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { login, api, assertIsolatedRuntime, teacherAuditIds, forgetCachedLogin } from './teacher-audit-helpers';

// Real isolated APIs and UI. No intercepted errors or external AI/SMTP requests.
// No question-bank page/form exists; its existing endpoints are audited below.
test.describe('Teacher audit: shared functions', () => {
  test.beforeAll(() => { assertIsolatedRuntime(); });
  test.beforeEach(async ({ page }) => { await login(page); });

  test('notification preferences persist across reload and bell/settings agree', async ({ page }) => {
    const before = await api(page, '/notifications/preferences');
    expect(before.status).toBe(200);
    try {
      await page.goto('/settings?tab=notifications');
      const sound = page.getByRole('switch', { name: 'Bildirim sesini aç veya kapat', exact: true });
      await expect(sound).toHaveAttribute('aria-checked', String(!before.body.muted));
      await sound.click();
      await expect(sound).toHaveAttribute('aria-checked', String(before.body.muted));
      await page.reload();
      await expect(sound).toHaveAttribute('aria-checked', String(before.body.muted));
      expect((await api(page, '/notifications/preferences')).body.muted).toBe(!before.body.muted);
      await page.getByRole('button', { name: 'Bildirimleri aç', exact: true }).click();
      const toggle = page.getByRole('button', { name: !before.body.muted ? 'Bildirimlerin sesini aç' : 'Bildirimleri sessize al', exact: true });
      await toggle.click();
      await expect(sound).toHaveAttribute('aria-checked', String(!before.body.muted));
    } finally {
      expect((await api(page, '/notifications/preferences', 'PATCH', { muted: before.body.muted })).status).toBe(200);
    }
  });

  test('notification pagination, mark-read and delete synchronize bell and settings', async ({ page }) => {
    const list = await api(page, '/notifications?limit=100');
    expect(list.status).toBe(200);
    expect(list.body.pagination.total).toBeGreaterThan(20);
    const owned = list.body.notifications;
    expect(owned.every((n: any) => n.userId === 'teacher-audit-teacher')).toBe(true);
    await page.goto('/settings?tab=notifications');
    await expect(page.getByRole('button', { name: 'Bildirimi sil', exact: true })).toHaveCount(20);
    await expect(page.getByRole('button', { name: 'Önceki', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Sonraki', exact: true }).click();
    await expect(page.getByText(/Sayfa 2 \/ /)).toBeVisible();
    await page.getByRole('button', { name: 'Önceki', exact: true }).click();
    await page.getByRole('button', { name: 'Tümünü Okundu İşaretle', exact: true }).click();
    await expect.poll(async () => (await api(page, '/notifications?limit=100')).body.pagination.unread).toBe(0);
    await page.getByRole('button', { name: 'Bildirimleri aç', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Hepsini Oku', exact: true })).toHaveCount(0);
    const first = (await api(page, '/notifications?limit=5')).body.notifications[0];
    // Scope to the bell row, preserving every other seeded record.
    const bellText = page.getByText(first.title, { exact: true }).last();
    const bellRow = bellText.locator('xpath=ancestor::div[contains(@class,"p-4")][1]');
    await bellRow.getByRole('button', { name: 'Bildirimi sil', exact: true }).click();
    await expect.poll(async () => (await api(page, '/notifications?limit=100')).body.notifications.some((n: any) => n.id === first.id)).toBe(false);
    await page.getByRole('link', { name: 'Tüm Bildirimleri Gör', exact: true }).click();
    await expect(page).toHaveURL(/\/settings\?tab=notifications$/);
    await page.reload();
    await expect(page.getByText(first.title, { exact: true })).toHaveCount(0);
  });

  test('foreign notification deletion is denied without altering foreign list', async ({ page, browser }) => {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5531' });
    const other = await context.newPage();
    try {
      await login(other, 'teacher-audit-other@example.test');
      const before = await api(other, '/notifications?limit=100');
      expect(before.status).toBe(200);
      expect(before.body.notifications.length).toBeGreaterThan(0);
      const id = before.body.notifications[0].id;
      expect((await api(page, `/notifications/${id}`, 'DELETE')).status).toBe(404);
      expect((await api(other, '/notifications?limit=100')).body.notifications.some((n: any) => n.id === id)).toBe(true);
    } finally { await context.close(); }
  });

  test('own operation history paginates and excludes other teacher history', async ({ page }) => {
    const response = await api(page, '/admin/logs/me?page=1&limit=50');
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.pagination.total).toBeGreaterThan(50);
    expect(response.body.logs.every((log: any) => log.userId === 'teacher-audit-teacher')).toBe(true);
    await page.goto('/settings?tab=logs');
    await expect(page.locator('tbody tr')).toHaveCount(50);
    const firstDetails = await page.locator('tbody tr td:nth-child(2)').allTextContents();
    await page.getByRole('button', { name: 'Sonraki', exact: true }).click();
    await expect(page.getByText(/Sayfa 2 \/ /)).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible();
    const secondDetails = await page.locator('tbody tr td:nth-child(2)').allTextContents();
    expect(secondDetails.every(details => !firstDetails.includes(details))).toBe(true);
    await page.reload();
    await expect(page.getByRole('tab', { name: 'İşlem Geçmişi', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/Sayfa 1 \/ /)).toBeVisible();
  });

  test('security form rejects mismatch and wrong current password', async ({ page }) => {
    await page.goto('/settings?tab=security');
    await expect(page.getByRole('button', { name: 'Şifreyi Güncelle', exact: true })).toBeDisabled();
    await page.getByLabel('Mevcut Şifre', { exact: true }).fill('IncorrectAuditPassword!');
    await page.getByLabel('Yeni Şifre', { exact: true }).fill('TemporaryAuditPassword2026!');
    await page.getByLabel('Yeni Şifre (Tekrar)', { exact: true }).fill('MismatchAuditPassword2026!');
    await page.getByRole('button', { name: 'Şifreyi Güncelle', exact: true }).click();
    await expect(page.getByText('Yeni şifreler uyuşmuyor.', { exact: true })).toBeVisible();
    await page.getByLabel('Yeni Şifre (Tekrar)', { exact: true }).fill('TemporaryAuditPassword2026!');
    const pending = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/change-password' && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Şifreyi Güncelle', exact: true }).click();
    expect((await pending).status()).toBe(400);
    await expect(page.getByText('Mevcut şifreniz yanlış.', { exact: true })).toBeVisible();
    expect((await api(page, '/auth/me')).status).toBe(200);
  });

  test('password change regenerates own session, permits new login and restores password', async ({ page }) => {
    const original = 'TeacherAuditOnly2026!';
    const temporary = 'TeacherAuditTemporary2026!';
    let changed = false;
    const oldCookie = (await page.context().cookies()).find(c => c.name === 'quizmaster.sid');
    try {
      await page.goto('/settings?tab=security');
      await page.getByLabel('Mevcut Şifre', { exact: true }).fill(original);
      await page.getByLabel('Yeni Şifre', { exact: true }).fill(temporary);
      await page.getByLabel('Yeni Şifre (Tekrar)', { exact: true }).fill(temporary);
      const pending = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/change-password' && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Şifreyi Güncelle', exact: true }).click();
      const response = await pending;
      changed = response.status() === 200;
      expect(response.status()).toBe(200);
      await expect(page.getByText('Şifreniz değiştirildi.', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Yeni Şifre', { exact: true })).toHaveValue('');
      expect((await page.context().cookies()).find(c => c.name === 'quizmaster.sid')?.value).not.toBe(oldCookie?.value);
      await page.context().clearCookies();
      expect((await api(page, '/auth/login', 'POST', { email: 'teacher-audit@example.test', password: temporary })).status).toBe(200);
      await page.goto('/settings?tab=security');
      await expect(page.getByLabel('Mevcut Şifre', { exact: true })).toBeVisible();
    } finally {
      if (changed) {
        // Recover a fresh session even if an earlier UI assertion failed.
        expect((await api(page, '/auth/login', 'POST', { email: 'teacher-audit@example.test', password: temporary })).status).toBe(200);
        expect((await api(page, '/auth/change-password', 'POST', { currentPassword: temporary, newPassword: original })).status).toBe(200);
      }
      forgetCachedLogin();
    }
  });

  test('teacher announcement GUI requires own class and teacher cannot delete', async ({ page, browser }) => {
    const title = `TEACHER AUDIT ANNOUNCEMENT ${Date.now()}`;
    let createdId: string | undefined;
    try {
      await page.goto('/announcements');
      await page.getByRole('button', { name: 'Yeni Duyuru', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('button', { name: 'Duyuruyu Yayınla', exact: true })).toBeDisabled();
      await dialog.getByPlaceholder('ÖRN: SINAV TAKVİMİ GÜNCELLEMESİ').fill(title);
      await dialog.getByPlaceholder('Duyuru detaylarını buraya yazın...').fill('Isolated teacher audit announcement content');
      await expect(dialog.getByRole('combobox').first()).toBeDisabled();
      await expect(dialog.getByRole('combobox').first()).toContainText('Öğrenciler');
      await expect(dialog.getByRole('button', { name: 'Duyuruyu Yayınla', exact: true })).toBeDisabled();
      await dialog.getByRole('combobox').nth(1).click();
      await expect(page.getByRole('option', { name: 'Private Other 7B', exact: true })).toHaveCount(0);
      await page.getByRole('option', { name: 'Teacher Audit 7A', exact: true }).click();
      const pending = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/announcements');
      await dialog.getByRole('button', { name: 'Duyuruyu Yayınla', exact: true }).click();
      const response = await pending;
      const body = await response.json();
      createdId = body.id;
      expect(response.status(), JSON.stringify(body)).toBe(201);
      expect(createdId).toBeTruthy();
      expect(body.targetRole).toBe('student');
      expect(body.targetClassId).toBe(teacherAuditIds.class);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Duyuruyu sil', exact: true })).toHaveCount(0);
      expect((await api(page, `/announcements/${createdId}`, 'DELETE')).status).toBe(403);
      expect((await api(page, '/announcements', 'POST', { title, content: 'Forbidden target', targetRole: 'all' })).status).toBe(403);
      expect((await api(page, '/announcements', 'POST', { title, content: 'Forbidden class', targetRole: 'student', targetClassId: teacherAuditIds.otherClass })).status).toBe(403);
      await page.reload();
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    } finally {
      if (createdId) {
        const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5531' });
        try {
          const admin = await context.newPage();
          await login(admin, 'teacher-audit-admin@example.test');
          expect((await api(admin, `/announcements/${createdId}`, 'DELETE')).status).toBe(200);
        } finally { await context.close(); }
      }
    }
  });

  test('mobile menu traps focus, closes with Escape/backdrop and follows links', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/quizzes');
    const trigger = page.getByRole('button', { name: 'Menüyü aç', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Ana menü', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Menüyü kapat', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('link', { name: 'Ayarlar', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Menüyü kapat', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole('button', { name: 'Menüyü kapat', exact: true }).first().click({ position: { x: 380, y: 100 } });
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await dialog.getByRole('link', { name: 'Duyurular', exact: true }).click();
    await expect(page).toHaveURL(/\/announcements$/);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Duyuru Merkezi', exact: true })).toBeVisible();
  });

  test('theme toggles and persists across reload', async ({ page }) => {
    await page.goto('/quizzes');
    const dark = page.getByTitle('Karanlık Moda Geç', { exact: true });
    const light = page.getByTitle('Aydınlık Moda Geç', { exact: true });
    if (await light.count()) await light.click();
    await dark.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await light.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('question bank API creates, lists and deletes only this teacher item', async ({ page }) => {
    let id: string | undefined;
    const text = `Teacher audit new bank question ${Date.now()}?`;
    try {
      const invalid = await api(page, '/question-bank', 'POST', { text: '', options: [] });
      expect(invalid.status).toBe(400);
      const created = await api(page, '/question-bank', 'POST', { text, options: ['One', 'Two'], correctAnswer: 'Two', categoryId: teacherAuditIds.category });
      id = created.body.question?.id;
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      expect(id).toBeTruthy();
      const list = await api(page, '/question-bank');
      expect(list.status).toBe(200);
      expect(list.body.questions.some((q: any) => q.id === id && q.text === text)).toBe(true);
      expect(list.body.questions.every((q: any) => q.teacherId === 'teacher-audit-teacher')).toBe(true);
    } finally {
      if (id) {
        expect((await api(page, `/question-bank/${id}`, 'DELETE')).status).toBe(200);
        expect((await api(page, '/question-bank')).body.questions.some((q: any) => q.id === id)).toBe(false);
      }
    }
  });

  test('image upload API rejects invalid type and over 5MB without creating an asset', async ({ page }) => {
    for (const fixture of [
      { name: 'audit.txt', mimeType: 'text/plain', buffer: Buffer.from('audit invalid file'), message: 'Yalnızca JPEG, PNG veya WEBP görselleri yüklenebilir.' },
      { name: 'audit-too-large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1), message: 'Dosya boyutu çok büyük. Maksimum 5MB yüklenebilir.' },
    ]) {
      const csrf = await (await page.request.get('/api/csrf-token')).json();
      const response = await page.request.post('/api/upload', { headers: { 'x-csrf-token': csrf.csrfToken }, multipart: { image: { name: fixture.name, mimeType: fixture.mimeType, buffer: fixture.buffer } } });
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.message).toBe(fixture.message);
      expect(body.imageUrl).toBeUndefined();
    }
  });

  test('AI dialog requires a topic and custom provider without key fails locally', async ({ page }) => {
    await page.goto('/create-quiz');
    await page.getByRole('button', { name: 'AI ile Soruları Üret', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sınav Sorularını Üret', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'İptal', exact: true }).click();
    // A custom HTTPS provider with no key returns before safeExternalFetch;
    // therefore no credentials/configuration or provider network is required.
    const missing = await api(page, '/ai/generate-questions', 'POST', { topic: 'Isolated audit topic', customBaseUrl: 'https://example.com/', count: 1 });
    expect(missing.status).toBe(500);
    expect(missing.body.message).toBe('Özel URL kullanıldığında API anahtarı zorunludur.');
    const unsafe = await api(page, '/ai/generate-questions', 'POST', { topic: 'Isolated audit topic', customBaseUrl: 'http://127.0.0.1/' });
    expect(unsafe.status).toBe(400);
    expect(unsafe.body.message).toContain('Geçersiz URL');
  });

  test('expired own server session retains cookie, rejects API and redirects teacher', async ({ page }) => {
    const runtime = assertIsolatedRuntime();
    const sessionFile = join(resolve(runtime.root), 'server', 'data', 'sessions.db');
    const serverRequire = createRequire(resolve('server/package.json'));
    const sqlite = createRequire(serverRequire.resolve('connect-sqlite3'))('sqlite3');
    const cookie = (await page.context().cookies()).find(c => c.name === 'quizmaster.sid');
    expect(cookie).toBeTruthy();
    const signed = decodeURIComponent(cookie!.value);
    expect(signed.startsWith('s:')).toBe(true);
    const sid = signed.slice(2, signed.lastIndexOf('.'));
    const db = new sqlite.Database(sessionFile, sqlite.OPEN_READWRITE);
    const run = (sql: string, values: unknown[]) => new Promise<number>((done, reject) => db.run(sql, values, function(this: { changes: number }, error: Error | null) { if (error) reject(error); else done(this.changes); }));
    try {
      expect(await run('UPDATE sessions SET expired = ? WHERE sid = ?', [Date.now() - 1000, sid])).toBe(1);
      expect((await page.context().cookies()).some(c => c.name === cookie!.name && c.value === cookie!.value)).toBe(true);
      expect((await page.request.get('/api/quizzes')).status()).toBe(401);
      await page.goto('/quizzes');
      await expect(page).toHaveURL(/\/auth$/);
      await expect(page.getByLabel('E-posta', { exact: true })).toBeVisible();
      await expect(page.locator('[data-dashboard-shell]')).toHaveCount(0);
    } finally {
      await run('DELETE FROM sessions WHERE sid = ?', [sid]);
      await new Promise<void>((done, reject) => db.close((error: Error | null) => error ? reject(error) : done()));
      forgetCachedLogin();
    }
  });
});
