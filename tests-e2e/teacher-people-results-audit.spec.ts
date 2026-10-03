import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { login, api, assertIsolatedRuntime, teacherAuditIds as ids } from './teacher-audit-helpers';

// Only real responses/data are used for successful flows. Failure injection is
// explicitly scoped to one endpoint and removed before the real recovery read.
test.beforeEach(async ({ page, baseURL }) => {
  assertIsolatedRuntime();
  expect(baseURL).toBe('http://127.0.0.1:5531');
  await login(page);
});
test.afterEach(async ({ page }, info) => {
  const dir = 'docs/teacher-audit/evidence/people-results';
  mkdirSync(dir, { recursive: true });
  const filename = info.title.replace(/[^a-zA-Z0-9-]+/g, '-');
  await page.screenshot({ path: `${dir}/${filename}.png`, fullPage: true });
});

async function choose(page: Page, selector: string, name: string) {
  await page.locator(selector).click();
  await page.getByRole('option', { name, exact: true }).click();
}

async function exportedRows(page: Page, info: TestInfo): Promise<string[][]> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel', exact: true }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  expect(path).not.toBeNull();
  const bytes = readFileSync(path!);
  if (!download.suggestedFilename().endsWith('.xlsx')) {
    const text = bytes.toString('utf8');
    expect(text).toContain('sep=;');
    return text.split(/\r?\n/).map(line => line.split(';').map(cell => cell.replace(/^"|"$/g, '')));
  }
  // Production exports use ZIP-stored XML. Support deflate as well, without
  // requiring another dependency or reading a source database.
  let offset = 0;
  let sheet = '';
  while (offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const method = bytes.readUInt16LE(offset + 8);
    const length = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const name = bytes.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const start = offset + 30 + nameLength + extraLength;
    if (name === 'xl/worksheets/sheet1.xml') {
      const compressed = bytes.subarray(start, start + length);
      sheet = (method === 0 ? compressed : inflateRawSync(compressed)).toString('utf8');
    }
    offset = start + length;
  }
  expect(sheet).toContain('<sheetData>');
  const rows = await page.evaluate(xml => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror, f')) throw new Error('Malformed worksheet or executable formula');
    return [...doc.querySelectorAll('sheetData > row')].map(row =>
      [...row.querySelectorAll('c')].map(cell => cell.querySelector('t, v')?.textContent || ''));
  }, sheet);
  await info.attach('export-validation', { body: JSON.stringify({ filename: download.suggestedFilename(), rows: rows.length }), contentType: 'application/json' });
  return rows;
}

test('students filter export and detail navigation respect teacher scope', async ({ page }, info) => {
  const users = await api(page, '/users');
  expect(users.status).toBe(200);
  expect(users.body.users.some((u: any) => u.id === 'teacher-audit-other-student')).toBe(false);
  await page.goto('/students');
  await expect(page.getByRole('row').filter({ hasText: 'Teacher Audit Student 00' })).toBeVisible();
  await expect(page.getByText('Private Other Student', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Yeni Öğrenci' })).toHaveCount(0);
  const search = page.getByRole('textbox', { name: 'Öğrenci ara', exact: true });
  await search.focus();
  await expect(search).toBeFocused();
  await page.keyboard.type('Teacher Audit Student 00');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const rows = await exportedRows(page, info);
  expect(rows.flat()).toContain('Teacher Audit Student 00');
  expect(rows.flat()).not.toContain('Teacher Audit Student 01');
  expect(rows.flat()).not.toContain('Private Other Student');
  await search.fill('no-owned-student-matches');
  await expect(page.getByText('Teacher Audit Student 00', { exact: true })).toHaveCount(0);
  await search.fill('Teacher Audit Student 00');
  const row = page.getByRole('row').filter({ hasText: 'Teacher Audit Student 00' });
  // The table's accessible detail action leads to the actual student report.
  await row.getByRole('button', { name: 'Detaylar', exact: true }).click();
  await expect(page).toHaveURL(/\/student\/results\?studentId=teacher-audit-student$/);
  await expect(page.getByRole('heading', { name: 'Öğrenci Analizi', exact: true })).toBeVisible();
});

test('classes filter detail export and keyboard return show only assigned class', async ({ page }, info) => {
  const response = await api(page, '/classes');
  expect(response.status).toBe(200);
  expect(response.body.classes.map((c: any) => c.id)).toContain(ids.class);
  expect(response.body.classes.map((c: any) => c.id)).not.toContain(ids.otherClass);
  await page.goto('/classlist');
  await expect(page.getByRole('row').filter({ hasText: 'Teacher Audit 7A' })).toBeVisible();
  await expect(page.getByText('Private Other 7B', { exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Sınıf ara', exact: true }).fill('Teacher Audit 7A');
  expect((await exportedRows(page, info)).flat()).toContain('Teacher Audit 7A');
  await page.getByRole('link', { name: /Detay/ }).click();
  await expect(page).toHaveURL(new RegExp(`/classes/${ids.class}$`));
  await expect(page.getByRole('heading', { name: 'Teacher Audit 7A', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Sınıf öğrencilerini ara' }).fill('Teacher Audit Student 00');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const rows = (await exportedRows(page, info)).flat();
  expect(rows).toContain('Teacher Audit Student 00');
  expect(rows).not.toContain('Teacher Audit Student 01');
  const back = page.getByRole('link', { name: 'Sınıf listesine dön' });
  await back.focus(); await expect(back).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/classlist$/);
});

test('foreign class student result and analytics requests are denied', async ({ page }) => {
  for (const path of [`/classes/${ids.otherClass}`, `/classes/${ids.otherClass}/students`,
    '/users/teacher-audit-other-student', '/student/results?studentId=teacher-audit-other-student',
    '/student/results/teacher-audit-private-result', `/analytics/classes?classId=${ids.otherClass}`]) {
    expect((await api(page, path)).status, path).toBe(403);
  }
  await page.goto(`/classes/${ids.otherClass}`);
  await expect(page.getByText('Private Other Student', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Private Other 7B', exact: true })).toHaveCount(0);
  await page.goto('/student/result/teacher-audit-private-result');
  await expect(page.getByText('Hata Oluştu', { exact: true })).toBeVisible();
  await expect(page.getByText('Private Other Exam', { exact: true })).toHaveCount(0);
});

test('results filters reports keyboard tabs and export preserve zero score', async ({ page }, info) => {
  const response = await api(page, '/results');
  expect(response.status).toBe(200);
  await page.goto('/results');
  await expect(page.locator('#results-student')).toBeVisible();
  await choose(page, '#results-student', 'Teacher Audit Student 00');
  const rows = await exportedRows(page, info);
  expect(rows.flat()).toContain('Teacher Audit Student 00');
  expect(rows.flat()).not.toContain('Teacher Audit Student 01');
  expect(rows.flat()).not.toContain('Private Other Student');
  expect(rows.some(row => row.includes('Teacher Audit Student 00') && row.includes('0'))).toBe(true);
  const tabs = page.getByRole('tab');
  await tabs.first().focus(); await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  const reportRow = page.getByRole('row').filter({ hasText: 'Teacher Audit Student 00' });
  await expect(reportRow).toBeVisible();
  await expect(reportRow).toContainText('0%');
  await page.reload();
  await expect(page.getByRole('tab').first()).toBeVisible();
});

test('student report score filters empty reset and individual answer details', async ({ page }, info) => {
  await page.goto('/student/results?studentId=teacher-audit-student');
  await expect(page.getByRole('heading', { name: 'Öğrenci Analizi', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Öğrenci Bilgileri|Veli Bilgileri/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'İncele', exact: true })).toHaveCount(1);
  await choose(page, '#student-results-score', 'Pekiyi (90-100)');
  await expect(page.getByRole('button', { name: 'İncele', exact: true })).toHaveCount(0);
  await choose(page, '#student-results-score', 'Geliştirilmeli (0-69)');
  await expect(page.getByRole('button', { name: 'İncele', exact: true })).toHaveCount(1);
  const search = page.getByPlaceholder('Başlık ile ara...');
  await search.fill('no-owned-exam-matches');
  await expect(page.getByRole('button', { name: 'İncele', exact: true })).toHaveCount(0);
  await search.fill('');
  await expect(page.getByRole('button', { name: 'İncele', exact: true })).toHaveCount(1);
  expect((await exportedRows(page, info)).flat()).toContain('Teacher Audit Exam');
  await page.getByRole('button', { name: 'İncele', exact: true }).click();
  await expect(page).toHaveURL(/\/student\/result\/teacher-audit-result$/);
  await expect(page.getByText('Teacher audit question?', { exact: true })).toBeVisible();
  const detail = await api(page, '/student/results/teacher-audit-result');
  expect(detail.status).toBe(200);
  expect(detail.body.result.score).toBe(0);
  expect(detail.body.questions[0].studentAnswer).toBe('B');
  expect(detail.body.questions[0].correctAnswer).toBe('A');
  const exported = (await exportedRows(page, info)).flat();
  expect(exported).toContain('Teacher audit question?');
  await page.reload();
  await expect(page.getByText('Teacher audit question?', { exact: true })).toBeVisible();
});

test('statistics class filter matches API participation average and export', async ({ page }, info) => {
  const response = await api(page, `/analytics/classes?classId=${ids.class}`);
  expect(response.status).toBe(200);
  const expected = response.body.classes.find((c: any) => c.classId === ids.class);
  expect(expected).toBeTruthy();
  await page.goto('/statistics');
  await page.getByRole('combobox', { name: 'Sınıf Seçimi' }).click();
  await page.getByRole('option', { name: 'Teacher Audit 7A', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'Teacher Audit 7A' });
  await expect(row).toBeVisible();
  await expect(row).toContainText(`%${expected.participationRate}`);
  await expect(row).toContainText(`%${expected.averageScore}`);
  const rows = (await exportedRows(page, info)).flat();
  expect(rows).toContain('Teacher Audit 7A');
  expect(rows).not.toContain('Private Other 7B');
  await expect(page.locator('#stats-start')).toHaveAttribute('max', await page.locator('#stats-end').inputValue());
});

test('survey results filters show real response and export owned survey only', async ({ page }, info) => {
  await page.goto('/survey-results');
  await expect(page.locator('main').getByText('Teacher audit response', { exact: true })).toBeVisible();
  await choose(page, '#survey-results-survey', 'Teacher Audit Survey');
  const rows = (await exportedRows(page, info)).flat();
  expect(rows).toContain('Teacher Audit Survey');
  expect(rows.some(value => value.includes('Teacher audit response'))).toBe(true);
  const response = await api(page, '/surveys/results?surveyId=55555555-5555-4555-8555-555555555555');
  expect(response.status).toBe(200);
  await page.locator('#survey-results-start').fill('2020-01-01');
  await page.locator('#survey-results-end').fill('2020-01-02');
  await expect(page.locator('main').getByText('Teacher audit response', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sıfırla', exact: true }).click();
  await expect(page.locator('main').getByText('Teacher audit response', { exact: true })).toBeVisible();
});

test('students delayed real response loading and retry after injected error', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/users', async route => { await gate; await route.continue(); });
  await page.goto('/students');
  try { await expect(page.getByRole('status').filter({ hasText: 'Veriler yükleniyor' })).toBeVisible(); }
  finally { release(); }
  await expect(page.getByRole('row').filter({ hasText: 'Teacher Audit Student 00' })).toBeVisible();
  await page.unroute('**/api/users');
  await page.route('**/api/users', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Controlled audit failure' }) }));
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'Veriler yüklenemedi' })).toBeVisible();
  await page.unroute('**/api/users');
  await page.getByRole('button', { name: 'Tekrar Dene', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Teacher Audit Student 00' })).toBeVisible();
});

test('statistics injected error is visible then real retry restores report', async ({ page }) => {
  await page.route('**/api/analytics/classes*', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Controlled analytics failure' }) }));
  await page.goto('/statistics');
  await expect(page.getByRole('alert').filter({ hasText: 'İstatistikler yüklenemedi' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Excel', exact: true })).toBeDisabled();
  await page.unroute('**/api/analytics/classes*');
  await page.getByRole('button', { name: 'Yeniden dene', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Teacher Audit 7A' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Excel', exact: true })).toBeEnabled();
});

test('survey injected error is explicit and real retry restores answers', async ({ page }) => {
  await page.route('**/api/surveys/results*', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Controlled survey failure' }) }));
  await page.goto('/survey-results');
  await expect(page.getByText('Anket sonuçları alınamadı', { exact: true })).toBeVisible();
  await page.unroute('**/api/surveys/results*');
  await page.getByRole('button', { name: 'Tekrar Dene', exact: true }).click();
  await expect(page.locator('main').getByText('Teacher audit response', { exact: true })).toBeVisible();
});
