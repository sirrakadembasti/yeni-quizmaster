import { test, expect } from '@playwright/test';
import { login, api, prisma } from './parent-audit-helpers';

test('P-R01 unlinked URL selection falls back safely without requesting foreign overview', async ({ page }) => {
  await login(page);
  const requests: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.includes('/parents/students/') && path.endsWith('/overview')) requests.push(path);
  });
  await page.goto('/parent/results?studentId=parent-audit-other-student');
  await expect(page.getByRole('combobox', { name: 'Öğrenci seçin', exact: true })).toContainText('Ada Audit Child', { timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Detay', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('studentId')).toBe('parent-audit-student');
  expect(requests).not.toContain('/api/parents/students/parent-audit-other-student/overview');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Öğrenci seçin', exact: true })).toContainText('Ada Audit Child', { timeout: 30000 });
});

test('P-R02 selected child survives reload and browser back without showing previous detail', async ({ page }) => {
  await login(page);
  await page.goto('/parent/results?studentId=parent-audit-student');
  await page.getByRole('button', { name: 'Detay', exact: true }).click();
  await expect(page.getByText('Doğru: 0/2', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Öğrenci seçin', exact: true }).click();
  await page.getByRole('option', { name: /Beren Audit Child/ }).click();
  await expect(page.getByRole('button', { name: 'Sonuç listesine dön', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Detay', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('studentId')).toBe('parent-audit-empty');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Öğrenci seçin', exact: true })).toContainText('Beren Audit Child', { timeout: 30000 });
  await expect(page.getByRole('row').filter({ hasText: 'Parent Audit Completed Exam' })).toContainText('%50');
  await page.goBack();
  await expect(page.getByRole('combobox', { name: 'Öğrenci seçin', exact: true })).toContainText('Ada Audit Child', { timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Sonuç listesine dön', exact: true })).toHaveCount(0);
});

test('P-R03 late first-child overview response cannot replace selected second-child data', async ({ page }) => {
  await login(page);
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const work: Promise<void>[] = [];
  await page.route('**/api/parents/students/parent-audit-student/overview', route => {
    const response = gate.then(() => route.continue()); work.push(response); return response;
  });
  try {
    await page.goto('/parent/results?studentId=parent-audit-student');
    const selector = page.getByRole('combobox', { name: 'Öğrenci seçin', exact: true });
    await expect(selector).toBeVisible({ timeout: 30000 });
    await selector.click(); await page.getByRole('option', { name: /Beren Audit Child/ }).click();
    const row = page.getByRole('row').filter({ hasText: 'Parent Audit Completed Exam' });
    await expect(row).toContainText('%50');
    release(); await Promise.all(work);
    await expect(selector).toContainText('Beren Audit Child');
    await expect(row).toContainText('%50');
    await expect(row).not.toContainText('%0');
  } finally { release(); await Promise.all(work); await page.unroute('**/api/parents/students/parent-audit-student/overview'); }
});

test('P-R04 overview 403 shows explicit retry and hides metrics until real recovery', async ({ page }) => {
  await login(page);
  await page.route('**/api/parents/students/*/overview', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Controlled parent overview forbidden' }) }));
  await page.goto('/parent/dashboard');
  await expect(page.getByRole('alert')).toContainText('Controlled parent overview forbidden', { timeout: 30000 });
  await expect(page.getByText('Ortalama Başarı', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Tamamlanmış sınav bulunmuyor.', { exact: true })).toHaveCount(0);
  await page.unroute('**/api/parents/students/*/overview');
  const recovered = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/overview') && response.status() === 200);
  await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click(); await recovered;
  await expect(page.getByRole('heading', { name: 'Ada Audit Child', exact: true })).toBeVisible();
  await expect(page.getByText('Ortalama Başarı', { exact: true })).toBeVisible();
});

test('P-R05 removed linked child is no longer selected or shown after reload', async ({ page }) => {
  const db = prisma();
  const link = await db.guardianStudent.findUniqueOrThrow({ where: { id: 'parent-audit-link-two' } });
  try {
    await login(page);
    await page.goto('/parent/results?studentId=parent-audit-empty');
    await expect(page.getByRole('combobox', { name: 'Öğrenci seçin', exact: true })).toContainText('Beren Audit Child', { timeout: 30000 });
    await db.guardianStudent.delete({ where: { id: link.id } });
    expect((await api(page, 'GET', '/parents/students/parent-audit-empty/overview')).status()).toBe(403);
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Öğrenci seçin', exact: true })).toContainText('Ada Audit Child', { timeout: 30000 });
    expect(new URL(page.url()).searchParams.get('studentId')).toBe('parent-audit-student');
    await expect(page.locator('main')).not.toContainText('Beren Audit Child');
  } finally {
    try { await db.guardianStudent.upsert({ where: { id: link.id }, create: link, update: {} }); }
    finally { await db.$disconnect(); }
  }
});
