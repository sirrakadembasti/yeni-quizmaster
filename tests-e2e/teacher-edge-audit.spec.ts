import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { login, api, assertIsolatedRuntime } from './teacher-audit-helpers';
const out = 'tests/denetim-kanitlari/ogretmen/evidence/edge';
mkdirSync(out, { recursive: true });
test.beforeEach(() => { assertIsolatedRuntime(); });

test('teacher settings invalid tab and browser history preserve active section', async ({ page }) => {
  await login(page); await page.goto('/settings?tab=invalid');
  await expect(page.getByRole('tab', { name: 'Profil Bilgileri' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Güvenlik' }).click();
  await expect(page).toHaveURL(/tab=security/);
  await page.getByRole('tab', { name: 'Bildirimler' }).click();
  await page.goBack(); await expect(page.getByRole('tab', { name: 'Güvenlik' })).toHaveAttribute('aria-selected', 'true');
  await page.goForward(); await expect(page.getByRole('tab', { name: 'Bildirimler' })).toHaveAttribute('aria-selected', 'true');
});

test('teacher login wrong password and missing or invalid reset token fail safely', async ({ page }) => {
  await page.goto('/auth'); await page.locator('#email').fill('teacher-audit@example.test');
  await page.locator('#password').fill('WrongAuditPassword!');
  const loginResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/login' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click();
  expect((await loginResponse).status()).toBe(401); await expect(page).toHaveURL(/\/auth$/);
  expect((await api(page, '/auth/me')).status).toBe(401);
  await page.goto('/reset-password'); await expect(page).toHaveURL(/\/auth$/);
  await page.goto('/reset-password?token=invalid-synthetic-audit-token');
  await page.getByLabel('Yeni Şifre', { exact: true }).fill('UnusedAuditPassword2026!');
  await page.getByLabel('Şifreyi Onayla', { exact: true }).fill('UnusedAuditPassword2026!');
  const resetResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/reset-password');
  await page.getByRole('button', { name: 'Şifreyi Güncelle', exact: true }).click();
  expect((await resetResponse).status()).toBe(400);
  await expect(page.getByText('Şifre Sıfırlandı', { exact: true })).toHaveCount(0);
  await login(page); expect((await api(page, '/auth/me')).status).toBe(200);
});

test('teacher results search and labelled assignment checkbox accessibility evidence', async ({ page }) => {
  await login(page); await page.goto('/results');
  const search = page.getByPlaceholder('Sınav veya ders ara...'); await expect(search).toBeVisible();
  const searchAccessibility = await search.ariaSnapshot();
  await search.fill('Teacher Audit');
  await page.goto('/create-quiz');
  const checkbox = page.getByRole('checkbox', { name: 'Teacher Audit 7A', exact: true });
  await expect(checkbox).toBeVisible();
  writeFileSync(`${out}/accessible-names.json`, JSON.stringify({ searchAccessibility, assignmentCheckbox: await checkbox.ariaSnapshot(),
    note: 'Placeholder fallback is present; source lacks persistent search label. Labelled checkbox is not unnamed.' }, null, 2));
});

test('password reset pending request disables duplicate submission', async ({ page }) => {
  const pendingOut = 'tests/denetim-kanitlari/ogretmen/evidence/defect-repairs';
  mkdirSync(pendingOut, { recursive: true });
  let release!: () => void; let observed!: () => void;
  let requestCount = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { observed = resolve; });
  await page.route('**/api/auth/reset-password', async route => { requestCount++; observed(); await gate; await route.continue(); });
  await page.goto('/reset-password?token=invalid-synthetic-audit-token');
  await page.getByLabel('Yeni Şifre', { exact: true }).fill('UnusedAuditPassword2026!');
  await page.getByLabel('Şifreyi Onayla', { exact: true }).fill('UnusedAuditPassword2026!');
  const button = page.locator('form button[type="submit"]');
  try {
    await button.click(); await started;
    await expect(button).toBeDisabled();
    await expect(button).toContainText('Güncelleniyor');
    await page.locator('form').evaluate(form => {
      (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit();
    });
    expect(requestCount).toBe(1);
    const disabled = await button.isDisabled();
    writeFileSync(`${pendingOut}/reset-pending.json`, JSON.stringify({ requestObserved: true, requestReleased: false, disabled, text: await button.textContent() }, null, 2));
    await page.screenshot({ path: `${pendingOut}/reset-pending.png`, fullPage: true });
    expect(disabled).toBe(true);
    const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/reset-password');
    release();
    expect((await response).status()).toBe(400);
    await expect(button).toBeEnabled();
    await expect(button).toHaveText('Şifreyi Güncelle');
    await expect(page.getByLabel('Yeni Şifre', { exact: true })).toHaveValue('UnusedAuditPassword2026!');
    const retry = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/reset-password');
    await button.click();
    expect((await retry).status()).toBe(400);
    expect(requestCount).toBe(2);
    await expect(button).toBeEnabled();
    writeFileSync(`${pendingOut}/reset-pending-retry.json`, JSON.stringify({ requestCount, pendingDisabled: disabled,
      rejectedStatus: 400, retryStatus: 400, retryEnabled: true, passwordPreserved: true }, null, 2));
  } finally { release(); }
});
