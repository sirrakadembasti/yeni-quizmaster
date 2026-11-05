import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';

const runtime = JSON.parse(readFileSync('tests/denetim-kanitlari/yonetici/runtime.json', 'utf8'));
const isolatedRoot = resolve(runtime.root);
if (dirname(isolatedRoot) !== resolve('server/data') || !basename(isolatedRoot).startsWith('quizmaster-test-admin-audit-') ||
    resolve(runtime.database) !== join(isolatedRoot, 'server', 'data', 'audit.db') || JSON.stringify(runtime.ports) !== '[5510,5511]') {
  throw new Error('Inventory repairs require the disposable admin audit database on 5510/5511.');
}

async function login(page: Page, baseURL: string | undefined) {
  expect(baseURL).toBe('http://127.0.0.1:5511');
  const token = (await (await page.request.get('/api/csrf-token')).json()).csrfToken;
  const response = await page.request.post('/api/auth/login', {
    data: { email: 'audit-admin@example.test', password: 'AuditOnly2026!' }, headers: { 'x-csrf-token': token },
  });
  expect(response.status()).toBe(200);
}

async function mutate(page: Page, path: string, method: 'POST' | 'PATCH' | 'DELETE', data?: unknown) {
  const token = (await (await page.request.get('/api/csrf-token')).json()).csrfToken;
  const response = await page.request.fetch('/api' + path, { method, data, headers: { 'x-csrf-token': token } });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

test('settings unknown tab falls back; valid tab links preserve browser back history', async ({ page, baseURL }) => {
  await login(page, baseURL);
  await page.goto('/settings?tab=unknown', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('tab', { name: 'Profil Bilgileri' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toBeVisible();
  await page.getByRole('tab', { name: 'Güvenlik', exact: true }).click();
  await expect(page).toHaveURL(/tab=security$/);
  await page.getByRole('tab', { name: 'İşlem Geçmişi' }).click();
  await expect(page).toHaveURL(/tab=logs$/);
  await page.goBack();
  await expect(page.getByRole('tab', { name: 'Güvenlik', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.goBack();
  await expect(page.getByRole('tab', { name: 'Profil Bilgileri' })).toHaveAttribute('aria-selected', 'true');
});

test('personal history renders persisted LOGIN records with real createdAt dates', async ({ page, baseURL }) => {
  await login(page, baseURL);
  const historyResponse = page.waitForResponse(response => response.url().includes('/api/admin/logs/me?') && response.request().method() === 'GET');
  await page.goto('/settings?tab=logs', { waitUntil: 'domcontentloaded' });
  const response = await historyResponse;
  expect(response.ok()).toBe(true);
  const data = await response.json();
  expect(data.logs.length).toBeGreaterThan(0);
  expect(data.logs[0].createdAt).toBeTruthy();
  const row = page.getByRole('row').filter({ hasText: 'User logged in' }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText(/\d{1,2}\s+\S+\s+\d{4}/);
  await expect(row).toContainText(/\d{2}:\d{2}:\d{2}/);
  await expect(page.getByRole('tab', { name: 'İşlem Geçmişi' })).toHaveAttribute('aria-selected', 'true');
});

test('saved profile updates the header and clean form immediately and survives navigation/reload', async ({ page, baseURL }) => {
  await login(page, baseURL);
  const before = (await (await page.request.get('/api/auth/me')).json()).user;
  const name = `Inventory Admin ${randomUUID().slice(0, 8)}`;
  try {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('Ad Soyad', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Değişiklikleri Kaydet' }).click();
    await expect(page.getByRole('button', { name: 'Değişiklikleri Kaydet' })).toBeDisabled();
    await expect(page.locator('header').getByText(name, { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Duyurular', exact: true }).click();
    await page.getByRole('link', { name: 'Ayarlar', exact: true }).click();
    await expect(page.getByPlaceholder('Ad Soyad', { exact: true })).toHaveValue(name);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByPlaceholder('Ad Soyad', { exact: true })).toHaveValue(name);
  } finally {
    await mutate(page, '/auth/me', 'PATCH', { name: before.name });
  }
});

test('announcement load failure retries; named delete cancel/failure/retry persist correctly', async ({ page, baseURL }) => {
  await login(page, baseURL);
  const title = `Inventory announcement ${randomUUID()}`;
  const created = await mutate(page, '/announcements', 'POST', { title, content: 'Disposable inventory regression', targetRole: 'teacher' });
  let failLoad = true;
  let failDelete = true;
  let deleted = false;
  try {
    await page.route('**/api/announcements', route => route.request().method() === 'GET' && failLoad
      ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Injected announcement load failure' }) }) : route.continue());
    await page.route(`**/api/announcements/${created.id}`, route => route.request().method() === 'DELETE' && failDelete
      ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Injected announcement delete failure' }) }) : route.continue());
    await page.goto('/announcements', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('alert').filter({ hasText: 'Duyurular yüklenemedi' })).toBeVisible();
    await expect(page.getByText('Henüz bir duyuru yayınlanmamış.', { exact: true })).toHaveCount(0);
    failLoad = false;
    await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click();
    const card = page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    await card.getByRole('button', { name: 'Duyuruyu sil' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(title);
    await dialog.getByRole('button', { name: 'İptal', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Duyuruyu sil' }).click();
    await dialog.getByRole('button', { name: 'Sil', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('Injected announcement delete failure');
    // The modal intentionally hides background roles from accessibility queries.
    await expect(page.getByRole('heading', { name: title, exact: true, includeHidden: true })).toBeAttached();
    failDelete = false;
    const deletion = page.waitForResponse(response => response.url().endsWith(`/api/announcements/${created.id}`) && response.request().method() === 'DELETE');
    await dialog.getByRole('button', { name: 'Sil', exact: true }).click();
    expect((await deletion).ok()).toBe(true);
    deleted = true;
    await expect(dialog).toHaveCount(0);
    await expect(card).toHaveCount(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(card).toHaveCount(0);
  } finally {
    await page.unroute(`**/api/announcements/${created.id}`);
    if (!deleted) await mutate(page, `/announcements/${created.id}`, 'DELETE');
  }
});

test('mobile drawer traps keyboard focus, Escape closes it and returns focus', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, baseURL);
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  const trigger = page.getByRole('button', { name: 'Menüyü aç', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Ana menü' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('[data-dashboard-main]')).toHaveAttribute('inert', '');
  await dialog.getByRole('link').last().focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Menüyü kapat' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link').last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('header mute request failure appears in the mounted Sonner renderer', async ({ page, baseURL }) => {
  await login(page, baseURL);
  await page.route('**/api/notifications/preferences', route => route.request().method() === 'PATCH'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Injected preferences failure' }) }) : route.continue());
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Bildirimleri aç' }).click();
  await page.getByRole('button', { name: /Bildirimleri sessize al|Bildirimlerin sesini aç/ }).click();
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Bildirim tercihleri güncellenemedi' })).toBeVisible();
});
