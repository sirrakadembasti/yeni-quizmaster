import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { login, api, assertIsolatedRuntime } from './teacher-audit-helpers';

const out = 'docs/teacher-audit/evidence/defect-repairs';
mkdirSync(out, { recursive: true });

async function excel(page: Page, name: string) {
  // Existing export/filter controls are on General Overview; tabs share filter state.
  await page.getByRole('tab', { name: 'Genel Bakış', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Excel', exact: true })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel', exact: true }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  await download.saveAs(`${out}/${name}.xlsx`);
  await page.getByRole('tab', { name: 'Öğrenci Raporları', exact: true }).click();
  const bytes = readFileSync(`${out}/${name}.xlsx`);
  let offset = 0, sheet = '';
  while (offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const method = bytes.readUInt16LE(offset + 8), length = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26), extraLength = bytes.readUInt16LE(offset + 28);
    const filename = bytes.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const start = offset + 30 + nameLength + extraLength;
    if (filename === 'xl/worksheets/sheet1.xml') {
      const body = bytes.subarray(start, start + length);
      sheet = (method === 0 ? body : inflateRawSync(body)).toString('utf8');
    }
    offset = start + length;
  }
  expect(sheet).toContain('<sheetData>');
  return page.evaluate(xml => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror, f')) throw new Error('Invalid worksheet');
    return [...doc.querySelectorAll('sheetData > row')].map(row => [...row.querySelectorAll('c')]
      .map(cell => cell.querySelector('t, v')?.textContent || ''));
  }, sheet);
}
async function pdf(page: Page, name: string) {
  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({ width: 718, height: 1123 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(a => Number.isFinite(Number(a.effect?.getComputedTiming().endTime)))
      .map(a => a.finished.catch(() => undefined)));
  });
  const file = await page.pdf({ path: `${out}/${name}.pdf`, format: 'A4', preferCSSPageSize: true, printBackground: true });
  expect(file.subarray(0, 5).toString()).toBe('%PDF-');
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  await page.setViewportSize({ width: 1280, height: 720 });
}

test('teacher correct-answer repair persists after reload and matches filtered Excel and PDF', async ({ page }) => {
  assertIsolatedRuntime(); await login(page);
  const response = await api(page, '/results?quizId=teacher-audit-exam');
  expect(response.status).toBe(200);
  const zero = response.body.results.find((r: any) => r.id === 'teacher-audit-result');
  const positive = response.body.results.find((r: any) => r.correctAnswersCount === 1);
  expect(zero.correctAnswersCount).toBe(0); expect(positive.correctAnswersCount).toBe(1);
  await page.goto('/results?tab=reports'); await page.reload();
  await expect(page.locator('tbody tr')).toHaveCount(14);
  await expect(page.getByRole('row').filter({ hasText: zero.student.name }).getByRole('cell').nth(2)).toHaveText('0 / 1');
  await expect(page.getByRole('row').filter({ hasText: positive.student.name }).getByRole('cell').nth(2)).toHaveText('1 / 1');
  const rows = await excel(page, 'report-all');
  const header = rows.find(row => row.includes('Öğrenci') && row.includes('Doğru'))!;
  expect(header).toBeTruthy();
  const nameColumn = header.indexOf('Öğrenci'), correctColumn = header.indexOf('Doğru');
  expect(rows.find(row => row[nameColumn] === zero.student.name)![correctColumn]).toBe('0');
  expect(rows.find(row => row[nameColumn] === positive.student.name)![correctColumn]).toBe('1');
  await pdf(page, 'report-all');
  await page.getByRole('tab', { name: 'Genel Bakış', exact: true }).click();
  await page.getByRole('combobox', { name: 'Öğrenci', exact: true }).click();
  await page.getByRole('option', { name: zero.student.name, exact: true }).click();
  await page.getByRole('tab', { name: 'Öğrenci Raporları', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').getByRole('cell').nth(2)).toHaveText('0 / 1');
  const filtered = await excel(page, 'report-zero');
  expect(filtered.find(row => row[nameColumn] === zero.student.name)![correctColumn]).toBe('0');
  expect(filtered.some(row => row[nameColumn] === positive.student.name)).toBe(false);
  await pdf(page, 'report-zero');
  writeFileSync(`${out}/report-outputs.json`, JSON.stringify({ api: 200, allRows: 14, filteredRows: 1,
    zeroStudent: zero.student.name, positiveStudent: positive.student.name, correctCounts: [0, 1],
    reloadVerified: true, excelVerified: true, pdfGenerated: true }, null, 2));
});
