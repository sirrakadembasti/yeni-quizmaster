import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { login, api, assertIsolatedRuntime, teacherAuditIds as ids } from './teacher-audit-helpers';

// These are Chromium's real A4 PDF artifacts. They verify the rendered print
// report, not a simulated window.print call or a physical printer installation.
const output = 'tests/denetim-kanitlari/ogretmen/evidence/print';
const ownedNames = Array.from({ length: 14 }, (_, i) => `Teacher Audit Student ${String(i).padStart(2, '0')}`);

test.beforeEach(async ({ page, baseURL }) => {
  assertIsolatedRuntime();
  expect(baseURL).toBe('http://127.0.0.1:5531');
  await login(page);
});

async function pdfReport(page: Page, info: TestInfo, name: string, title: string,
  required: string[], forbidden = ['Private Other Student', 'Private Other Exam', 'Private Other 7B']) {
  mkdirSync(output, { recursive: true });
  await page.emulateMedia({ media: 'print' });
  // A4 printable width with the application's 10 mm side margins.
  await page.setViewportSize({ width: 718, height: 1123 });
  await page.evaluate(async () => { await document.fonts.ready; });
  // Print after real entrance animations finish; Chromium may rasterize a
  // composited fading panel, making otherwise visible report text unextractable.
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter(animation => Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)))
      .map(animation => animation.finished.catch(() => undefined)));
  });
  // Recharts animates SVG through requestAnimationFrame, outside Web Animations.
  // Observe actual geometry after resize instead of changing production styles.
  let previousGeometry = ''; let stableSamples = 0;
  await expect.poll(async () => {
    const geometry = await page.locator('.recharts-surface').evaluateAll(charts => charts.map(chart => chart.innerHTML).join('\n'));
    stableSamples = geometry === previousGeometry ? stableSamples + 1 : 0;
    previousGeometry = geometry;
    return stableSamples;
  }, { timeout: 15000, intervals: [250] }).toBeGreaterThanOrEqual(4);
  const file = `${output}/${name}.pdf`;
  const buffer = await page.pdf({ path: file, format: 'A4', preferCSSPageSize: true,
    printBackground: true, displayHeaderFooter: false });
  expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  expect(buffer.length).toBeGreaterThan(3000);
  await info.attach(`${name}-real-pdf`, { path: file, contentType: 'application/pdf' });
  // Save expected text alongside the artifact for the coordinator's independent
  // PDF text extraction and page rendering. No session or source DB is saved.
  writeFileSync(`${output}/${name}-expected.json`, JSON.stringify({ title, required, forbidden,
    format: 'A4', bytes: buffer.length, source: 'Chromium page.pdf with production print CSS' }, null, 2));
  await page.screenshot({ path: `${output}/${name}-print-dom.png`, fullPage: true });

  const metadata = page.locator('.print-report-meta');
  await expect(metadata).toBeVisible();
  await expect(metadata.locator('h1')).toHaveText(title);
  await expect(page.locator('.print-masthead')).toBeVisible();
  await expect(page.locator('.print-masthead')).toContainText('Teacher Audit Teacher');
  const main = page.locator('[data-dashboard-main]');
  const snapshot = await main.evaluate((element, expectations) => {
    const visible = (node: Element) => {
      const box = node.getBoundingClientRect();
      const css = getComputedStyle(node);
      return box.width > 0 && box.height > 0 && css.visibility !== 'hidden' && css.display !== 'none';
    };
    const text = (element as HTMLElement).innerText;
    const controls = [...element.querySelectorAll('button,input,textarea,[role="combobox"],[role="tablist"]')].filter(visible);
    const tables = [...element.querySelectorAll('table')].filter(visible).map(table => {
      const rect = table.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, rows: table.querySelectorAll('tbody tr').length };
    });
    return { required: expectations.required.map(value => ({ value, present: text.includes(value) })),
      forbidden: expectations.forbidden.filter(value => text.includes(value)), controls: controls.length,
      tables, viewport: innerWidth,
      overflowingRows: [...element.querySelectorAll('tbody tr')].filter(visible).filter(row => {
        const rect = row.getBoundingClientRect(); return rect.left < -1 || rect.right > innerWidth + 1;
      }).length };
  }, { required, forbidden });
  writeFileSync(`${output}/${name}-dom-validation.json`, JSON.stringify(snapshot, null, 2));
  expect(snapshot.required.filter(item => !item.present)).toEqual([]);
  expect(snapshot.forbidden).toEqual([]);
  expect(snapshot.controls).toBe(0);
  expect(snapshot.overflowingRows).toBe(0);
  await expect(page.locator('[data-dashboard-main] > header')).toBeHidden();
  await expect(page.locator('aside')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
}

test('teacher results PDF includes all fourteen report rows then selected zero-score row', async ({ page }, info) => {
  await page.goto('/results');
  await expect(page.locator('#results-student')).toBeVisible();
  await page.getByRole('tab', { name: /Raporlar/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(14);
  await expect(page.getByRole('row').filter({ hasText: ownedNames[0] })).toContainText('0%');
  await pdfReport(page, info, 'teacher-results-all', 'Sınav Sonuçları',
    [...ownedNames, 'Teacher Audit Exam', '14 Toplam Sonuç', '0%']);
  // Reopen overview to change the real filters, then print the actual reports tab.
  await page.getByRole('tab').first().click();
  await page.locator('#results-student').click();
  await page.getByRole('option', { name: ownedNames[0], exact: true }).click();
  await page.getByRole('tab', { name: /Raporlar/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await pdfReport(page, info, 'teacher-results-zero-filter', 'Sınav Sonuçları',
    [ownedNames[0], 'Teacher Audit Exam', '0%', '1 Toplam Sonuç'],
    [...ownedNames.slice(1), 'Private Other Student']);
});

test('teacher class PDF includes fourteen students and filter metadata without unselected rows', async ({ page }, info) => {
  await page.goto(`/classes/${ids.class}`);
  await expect(page.getByRole('heading', { name: 'Teacher Audit 7A', exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(14);
  await pdfReport(page, info, 'teacher-class-all', 'Sınıf Öğrenci Listesi',
    [...ownedNames, 'Teacher Audit 7A', 'Sorumlu öğretmen', 'Öğrenci sayısı', '14']);
  await page.getByRole('textbox', { name: 'Sınıf öğrencilerini ara' }).fill(ownedNames[0]);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await pdfReport(page, info, 'teacher-class-filter', 'Sınıf Öğrenci Listesi',
    [ownedNames[0], 'Teacher Audit 7A', 'Arama', 'Öğrenci sayısı', '1'], ownedNames.slice(1));
});

test('teacher student-analysis PDF preserves zero-score report and student identity', async ({ page }, info) => {
  await page.goto('/student/results?studentId=teacher-audit-student');
  await expect(page.getByRole('button', { name: 'İncele', exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByPlaceholder('Başlık ile ara...').fill('Teacher Audit Exam');
  const result = await api(page, '/student/results/teacher-audit-result');
  expect(result.status).toBe(200);
  expect(result.body.result.score).toBe(0);
  await expect(page.locator('tbody tr')).toContainText('0');
  await pdfReport(page, info, 'teacher-student-zero', 'Öğrenci Analizi',
    [ownedNames[0], 'Teacher Audit Exam', 'Arama', 'Teacher Audit Mathematics', '0'],
    [...ownedNames.slice(1), 'Private Other Student']);
});

test('teacher statistics PDF reports assigned class participation and average matching real API', async ({ page }, info) => {
  const response = await api(page, `/analytics/classes?classId=${ids.class}`);
  expect(response.status).toBe(200);
  const expected = response.body.classes.find((item: any) => item.classId === ids.class);
  expect(expected).toBeTruthy();
  await page.goto('/statistics');
  await page.getByRole('combobox', { name: 'Sınıf Seçimi' }).click();
  await page.getByRole('option', { name: 'Teacher Audit 7A', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'Teacher Audit 7A' });
  await expect(row).toContainText(`%${expected.participationRate}`);
  await expect(row).toContainText(`%${expected.averageScore}`);
  await pdfReport(page, info, 'teacher-statistics', 'Sınıf İstatistikleri',
    ['Teacher Audit 7A', 'Sınıf Bazında Ayrıntılı Sonuçlar', `%${expected.participationRate}`,
      `%${expected.averageScore}`, '14']);
});
