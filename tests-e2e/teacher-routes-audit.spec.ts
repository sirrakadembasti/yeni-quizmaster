import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { login, api, assertIsolatedRuntime, teacherAuditIds } from './teacher-audit-helpers';
assertIsolatedRuntime();
const out = 'docs/teacher-audit/evidence/routes'; mkdirSync(out, { recursive: true });
const routes = [ '/', '/quizzes', '/create-quiz', '/quizzes/teacher-audit-draft', '/results', '/statistics',
  '/survey-results', '/students', '/classlist', `/classes/${teacherAuditIds.class}`, '/settings', '/announcements',
  '/student/results?studentId=teacher-audit-student', '/student/results', '/student/result/teacher-audit-result',
  '/student/quiz/teacher-audit-exam', '/student-quizzes/teacher-audit-exam' ];
for (const viewport of ['desktop', 'mobile'] as const) for (const [index, route] of routes.entries()) {
  test(`teacher ${viewport} route ${route}`, async ({ page }) => {
    await login(page);
    if (viewport === 'mobile') await page.setViewportSize({ width: 390, height: 844 });
    const pageErrors: string[] = [], consoleErrors: string[] = [], failures: any[] = [], httpErrors: any[] = [];
    const safe = (value: string) => value.replace(/([?&]token=)[^&\s]+/g, '$1[redacted]').slice(0, 2000);
    const url = (value: string) => { const parsed = new URL(value); return { origin: parsed.origin, pathname: parsed.pathname, queryKeys: [...parsed.searchParams.keys()] }; };
    page.on('pageerror', error => pageErrors.push(safe(error.message)));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(safe(message.text())); });
    page.on('requestfailed', request => failures.push({ ...url(request.url()), error: request.failure()?.errorText }));
    page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).pathname.startsWith('/api/')) httpErrors.push({ ...url(response.url()), status: response.status() }); });
    const tabs: string[] = [];
    const tabStates: any[] = [];
    let ux: any = {};
    try {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-dashboard-shell]')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('main .animate-spin')).toHaveCount(0, { timeout: 30000 });
      const queue = (await page.getByRole('tab').allTextContents()).map(text => text.trim());
      for (let i = 0; i < queue.length && i < 24; i++) {
        const name = queue[i]; if (!name || tabs.includes(name)) continue;
        const tab = page.getByRole('tab', { name, exact: true }).first();
        if (!await tab.isVisible()) continue;
        await tab.click(); await expect(tab).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('main .animate-spin')).toHaveCount(0, { timeout: 30000 });
        tabs.push(name);
        tabStates.push({ name, visiblePanels: await page.getByRole('tabpanel').count() });
        const nested = (await page.getByRole('tab').allTextContents()).map(text => text.trim());
        for (const child of nested) if (!queue.includes(child)) queue.push(child);
        await page.screenshot({ path: `${out}/${index}-${viewport}-tab-${i}.png`, fullPage: true });
      }
      const visibleTabs = page.getByRole('tab');
      if (await visibleTabs.count() > 1) {
        await visibleTabs.first().focus(); await page.keyboard.press('ArrowRight');
        await expect(visibleTabs.nth(1)).toBeFocused();
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-dashboard-shell]')).toBeVisible();
      await expect(page.locator('main .animate-spin')).toHaveCount(0, { timeout: 30000 });
      await page.screenshot({ path: `${out}/${index}-${viewport}.png`, fullPage: true });
      ux = await page.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
        unnamedButtons: [...document.querySelectorAll('button')].filter(button => !button.textContent?.trim()
          && !button.getAttribute('aria-label') && !button.getAttribute('aria-labelledby') && !button.getAttribute('title')).length,
        inputsWithoutLabel: [...document.querySelectorAll('main input:not([type=hidden]),main textarea')].filter(input =>
          !input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby') && !input.closest('label')
          && !(input.id && document.querySelector(`label[for="${input.id}"]`))).map(input => ({ type: input.getAttribute('type'), placeholder: input.getAttribute('placeholder') })) }));
      expect(pageErrors).toEqual([]);
      expect(httpErrors).toEqual([]);
      expect(ux.documentWidth).toBeLessThanOrEqual(ux.viewport + 1);
    } finally {
      writeFileSync(`${out}/${index}-${viewport}.json`, JSON.stringify({ route, viewport, tabs, tabStates, pageErrors,
        consoleErrors, failedRequests: failures, apiHttpErrors: httpErrors, ux }, null, 2));
    }
  });
}
test('teacher real UI login and logout', async ({ page }) => {
  await page.goto('/auth'); await page.locator('#email').fill('teacher-audit@example.test');
  await page.locator('#password').fill('TeacherAuditOnly2026!');
  await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5531/');
  expect((await api(page, '/auth/me')).body.user.role).toBe('teacher');
  await page.getByRole('button', { name: /Teacher Audit Teacher/ }).click();
  const logoutResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/logout' && response.request().method() === 'POST');
  await page.getByRole('menuitem', { name: 'Güvenli Çıkış' }).click();
  expect((await logoutResponse).status()).toBe(200);
  await expect(page).toHaveURL('http://127.0.0.1:5531/');
  expect((await api(page, '/auth/me')).status).toBe(401);
  await page.goto('/results'); await expect(page).toHaveURL(/\/auth$/);
});
test('teacher admin/student/parent routes reject and admin API denies', async ({ page }) => {
  await login(page);
  for (const route of ['/management', '/archive', '/server-setup', '/admin-quizzes', '/teachers', '/guardian-management', '/admin/classes/' + teacherAuditIds.class,
    '/student/dashboard', '/my-stats', '/parent/results']) {
    await page.goto(route); await expect(page).toHaveURL('http://127.0.0.1:5531/');
  }
  for (const endpoint of ['/admin/logs', '/admin/deployment/status']) expect((await api(page, endpoint)).status).toBe(403);
});
test('teacher cleared session redirects protected destination and anonymous API denies', async ({ page }) => {
  await login(page); await page.goto('/results'); await page.context().clearCookies();
  await page.reload(); await expect(page).toHaveURL(/\/auth$/);
  expect((await api(page, '/results')).status).toBe(401);
  expect(await page.evaluate(() => sessionStorage.getItem('returnUrl'))).toBe('/results');
});
test('teacher settings profile save survives navigation and reload', async ({ page }) => {
  await login(page); const original = (await api(page, '/auth/me')).body.user.name;
  try {
    await page.goto('/settings'); await page.getByPlaceholder('Ad Soyad', { exact: true }).fill('Teacher Audit Updated');
    await page.getByRole('button', { name: 'Değişiklikleri Kaydet', exact: true }).click();
    await expect.poll(async () => (await api(page, '/auth/me')).body.user.name).toBe('Teacher Audit Updated');
    await page.goto('/'); await page.goto('/settings'); await expect(page.getByPlaceholder('Ad Soyad', { exact: true })).toHaveValue('Teacher Audit Updated');
    await page.reload(); await expect(page.getByPlaceholder('Ad Soyad', { exact: true })).toHaveValue('Teacher Audit Updated');
  } finally { expect((await api(page, '/auth/me', 'PATCH', { name: original })).status).toBe(200); }
});
test('teacher preview does not submit or change student results', async ({ page }) => {
  await login(page); const before = await api(page, '/results/quiz/teacher-audit-exam'); expect(before.status).toBe(200);
  await page.goto('/student/quiz/teacher-audit-exam');
  await expect(page.getByRole('button', { name: 'Önizlemeyi Bitir', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Önizlemeyi Bitir', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.screenshot({ path: `${out}/preview-confirmation.png`, fullPage: true });
  await page.getByRole('button', { name: 'Evet, Bitir', exact: true }).click();
  await expect(page.getByText('Önizleme Tamamlandı!', { exact: true })).toBeVisible();
  const after = await api(page, '/results/quiz/teacher-audit-exam'); expect(after.status).toBe(200);
  expect(after.body).toEqual(before.body);
});
