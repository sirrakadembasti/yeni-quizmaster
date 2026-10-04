import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { login, api, prisma } from './parent-audit-helpers';

const out = 'docs/parent-audit';
test.beforeEach(() => mkdirSync(out + '/screenshots', { recursive: true }));
async function selectChild(page: any, name: string) {
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: new RegExp(name) }).click();
}
const failure = (message: string) => ({ status: 500, contentType: 'application/json', body: JSON.stringify({ message }) });
async function shot(page: any, name: string) {
  await page.screenshot({ path: `${out}/screenshots/${name}.png`, fullPage: true });
  writeFileSync(`${out}/screenshots/${name}-accessible.txt`, await page.locator('main').ariaSnapshot());
}

test('P-N01 dashboard, home alias and results direct URLs, reload, mobile, keyboard and real network', async ({ page }) => {
  await login(page);
  const errors: string[] = [], failed: string[] = [], observations: any[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (new URL(r.url()).pathname.startsWith('/api/') && r.status() >= 400) failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  try {
    for (const route of ['/', '/parent/dashboard', '/parent/results']) {
      await page.goto(route);
      await expect(page.getByText('Parent Audit Completed Exam', { exact: true }).first()).toBeVisible({ timeout: 30000 });
      await page.reload();
      await expect(page.getByText('Parent Audit Completed Exam', { exact: true }).first()).toBeVisible({ timeout: 30000 });
      await page.setViewportSize({ width: 390, height: 844 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      observations.push({ route, overflow, text: (await page.locator('main').innerText()).slice(0, 1500) });
      await shot(page, route === '/' ? 'home-mobile' : route.endsWith('results') ? 'results-mobile' : 'dashboard-mobile');
      expect(overflow).toBe(false);
      await page.getByRole('combobox').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('option').first()).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('combobox')).toBeFocused();
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    expect(errors).toEqual([]); expect(failed).toEqual([]);
  } finally { writeFileSync(`${out}/navigation-observations.json`, JSON.stringify({ observations, errors, failed }, null, 2)); }
});

test('P-F01 dashboard metrics, assigned exams and switching both linked students use real records', async ({ page }) => {
  await login(page); await page.goto('/parent/dashboard');
  await selectChild(page, 'Ada Audit Child');
  await expect(page.getByRole('heading', { name: 'Ada Audit Child' })).toBeVisible();
  const overview = await (await api(page, 'GET', '/parents/students/parent-audit-student/overview')).json();
  expect(overview.student.id).toBe('parent-audit-student');
  expect(overview.results.length).toBe(1); expect(overview.results[0].score).toBe(0);
  expect(overview.quizzes.some((q: any) => q.id === 'parent-audit-draft')).toBe(false);
  expect(overview.quizzes.some((q: any) => q.id === 'parent-audit-other-exam')).toBe(false);
  await expect(page.getByText('Ortalama Başarı').locator('..')).toContainText('%0');
  await expect(page.getByText('Tamamlanan Sınav', { exact: true }).locator('..')).toContainText('1');
  await expect(page.getByText('Bekleyen Sınav', { exact: true }).locator('..')).toContainText(String(overview.quizzes.filter((q: any) => !q.completed).length));
  await selectChild(page, 'Beren Audit Child');
  await expect(page.getByRole('heading', { name: 'Beren Audit Child' })).toBeVisible();
  await expect(page.getByText('Ortalama Başarı').locator('..')).toContainText('%50');
  await shot(page, 'dashboard-second-child');
});

test('P-F02 results detail, correct and incorrect answers, back and child change', async ({ page }) => {
  await login(page); await page.goto('/parent/results'); await selectChild(page, 'Ada Audit Child');
  await page.getByRole('button', { name: 'Detay', exact: true }).click();
  await expect(page.getByText('Doğru: 0/2', { exact: true })).toBeVisible();
  await expect(page.getByText('Öğrencinin cevabı:').first().locator('..')).toContainText('B');
  const detail = await (await api(page, 'GET', '/parents/results/parent-audit-result')).json();
  expect(detail.result.studentId).toBe('parent-audit-student'); expect(detail.questions.every((q: any) => q.isCorrect === false)).toBe(true);
  await shot(page, 'result-detail-ada');
  await page.getByRole('button', { name: 'Sonuç listesine dön' }).click();
  await expect(page.getByRole('button', { name: 'Detay', exact: true })).toBeVisible();
  await selectChild(page, 'Beren Audit Child'); await page.getByRole('button', { name: 'Detay', exact: true }).click();
  await expect(page.getByText('Doğru: 1/2', { exact: true })).toBeVisible();
  await selectChild(page, 'Ada Audit Child');
  await expect(page.getByRole('button', { name: 'Sonuç listesine dön' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Detay', exact: true })).toBeVisible();
});

test('P-F03 results link preserves dashboard selected child', async ({ page }) => {
  await login(page); await page.goto('/parent/dashboard'); await selectChild(page, 'Beren Audit Child');
  await expect(page.getByRole('heading', { name: 'Beren Audit Child' })).toBeVisible();
  await page.getByRole('link', { name: 'Tümünü ve detayları gör' }).click();
  await expect(page.getByRole('button', { name: 'Detay', exact: true })).toBeVisible();
  await shot(page, 'results-context-after-dashboard');
  await expect(page.getByRole('combobox')).toContainText('Beren Audit Child');
});

test('P-E01 genuinely unlinked parent empty dashboard and results', async ({ page }) => {
  await login(page, 'parent-audit-no-links@example.test'); await page.goto('/parent/dashboard');
  await expect(page.getByText('Hesabınıza bağlı öğrenci bulunmuyor')).toBeVisible();
  expect((await (await api(page, 'GET', '/parents/students')).json()).students).toEqual([]);
  await page.goto('/parent/results');
  await shot(page, 'results-no-linked-students');
  await expect(page.getByText('Hesabınıza bağlı öğrenci bulunmuyor')).toBeVisible();
});

for (const [id, route] of [['P-E02', '/parent/dashboard'], ['P-E03', '/parent/results']]) {
  test(`${id} students API500 distinguishes failure from empty and retries real API`, async ({ page }) => {
    await login(page); await page.route('**/api/parents/students', r => r.fulfill(failure('Controlled parent students failure')));
    const failed = page.waitForResponse(r => new URL(r.url()).pathname === '/api/parents/students' && r.status() === 500);
    await page.goto(route); await failed;
    await shot(page, `${id}-students-failure`);
    await expect(page.locator('main')).toContainText(/Controlled parent students failure|hata|getirilemedi/i);
    await expect(page.getByText('Hesabınıza bağlı öğrenci bulunmuyor')).toHaveCount(0);
    await page.unroute('**/api/parents/students');
    const loaded = page.waitForResponse(r => new URL(r.url()).pathname === '/api/parents/students' && r.status() === 200);
    await page.getByRole('button', { name: 'Tekrar dene' }).click(); await loaded;
    await expect(page.getByRole('combobox')).toBeVisible();
  });
}

for (const [id, route] of [['P-E04', '/parent/dashboard'], ['P-E05', '/parent/results']]) {
  test(`${id} overview API500 displays failure and real retry`, async ({ page }) => {
    await login(page); await page.route('**/api/parents/students/*/overview', r => r.fulfill(failure('Controlled parent overview failure')));
    const failed = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/overview') && r.status() === 500);
    await page.goto(route); await expect(page.getByRole('combobox')).toBeVisible(); await failed;
    await shot(page, `${id}-overview-failure`);
    await expect(page.locator('main')).toContainText(/Controlled parent overview failure|hata|getirilemedi/i);
    await page.unroute('**/api/parents/students/*/overview');
    await page.getByRole('button', { name: 'Tekrar dene' }).click();
    await expect(page.getByText('Parent Audit Completed Exam', { exact: true }).first()).toBeVisible();
  });
}

test('P-E06 result detail API500 is visible and retry recovers', async ({ page }) => {
  await login(page); await page.goto('/parent/results');
  await expect(page.getByRole('button', { name: 'Detay', exact: true })).toBeVisible();
  await page.route('**/api/parents/results/*', r => r.fulfill(failure('Controlled parent detail failure')));
  const failed = page.waitForResponse(r => new URL(r.url()).pathname.includes('/parents/results/') && r.status() === 500);
  await page.getByRole('button', { name: 'Detay', exact: true }).click(); await failed;
  await shot(page, 'detail-failure');
  await expect(page.locator('main')).toContainText(/Controlled parent detail failure|hata|getirilemedi/i);
  await page.unroute('**/api/parents/results/*'); await page.getByRole('button', { name: 'Tekrar dene' }).click();
  await expect(page.getByRole('button', { name: 'Sonuç listesine dön' })).toBeVisible();
});

test('P-E07 delayed overview advertises loading rather than empty', async ({ page }) => {
  await login(page); let release: () => void = () => {}; const gate = new Promise<void>(r => release = r);
  const handlers: Promise<void>[] = [];
  await page.route('**/api/parents/students/*/overview', r => { const work = gate.then(() => r.continue()); handlers.push(work); return work; });
  try {
    await page.goto('/parent/results'); await expect(page.getByRole('combobox')).toBeVisible();
    await shot(page, 'results-delayed-overview');
    await expect(page.locator('main')).toContainText(/yükleniyor/i);
    await expect(page.getByText('Tamamlanmış sınav bulunmuyor.')).toHaveCount(0);
  } finally { release(); await Promise.all(handlers); await page.unroute('**/api/parents/students/*/overview'); }
});

test('P-A01 both student selectors expose a purpose label', async ({ page }) => {
  await login(page);
  for (const route of ['/parent/dashboard', '/parent/results']) {
    await page.goto(route); await expect(page.getByRole('combobox')).toBeVisible();
    await expect(page.getByRole('combobox')).toHaveAccessibleName(/öğrenci seç/i);
  }
});

test('P-F04 a question image is available in parent result detail', async ({ page }) => {
  const p = prisma(), id = 'parent-audit-completed-exam-q1';
  const original = await p.question.findUniqueOrThrow({ where: { id } });
  try {
    await p.question.update({ where: { id }, data: { imageUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22%3E%3Crect width=%2220%22 height=%2220%22 fill=%22blue%22/%3E%3C/svg%3E' } });
    await login(page); await page.goto('/parent/results'); await page.getByRole('button', { name: 'Detay', exact: true }).click();
    await expect(page.getByText('Doğru: 0/2', { exact: true })).toBeVisible();
    const detail = await (await api(page, 'GET', '/parents/results/parent-audit-result')).json();
    expect(detail.questions.find((q: any) => q.id === id).imageUrl).toBeTruthy();
    await shot(page, 'image-result-detail'); await expect(page.locator('main img')).toHaveCount(1);
  } finally { await p.question.update({ where: { id }, data: { imageUrl: original.imageUrl } }); await p.$disconnect(); }
});
