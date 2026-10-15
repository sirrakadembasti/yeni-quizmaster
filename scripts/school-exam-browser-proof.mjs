import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ownedFile, readPerformanceRuntime } from './production-performance-guard.mjs';

export async function schoolBrowserProof(repo, root, runId, actor, password) {
  const runtime = readPerformanceRuntime(repo, ownedFile(root, 'runtime.json', true), { runId });
  const { origin } = runtime;
  assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  const { chromium } = createRequire(path.join(repo, 'server/package.json'))('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1100 } });
    await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    await context.routeWebSocket('**/*', route => route.url().startsWith(origin.replace('http:', 'ws:') + '/') ? route.connectToServer() : route.close());
    const csrf = await (await context.request.get(origin + '/api/csrf-token')).json();
    const login = await context.request.post(origin + '/api/auth/login', { headers: { 'x-csrf-token': csrf.csrfToken, Origin: origin }, data: { email: actor.email, password } });
    assert.equal(login.status(), 200);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/results', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Sınav Sonuçları', exact: true }).waitFor({ timeout: 60000 });
    await page.getByRole('tab', { name: 'Öğrenci Raporları' }).click();
    const table = page.locator('[role="tabpanel"][data-state="active"] table tbody');
    await page.waitForFunction(() => document.querySelector('[role="tabpanel"][data-state="active"] table tbody')?.children.length === 100);
    await page.getByRole('button', { name: 'Sonraki rapor sayfası' }).click();
    await page.getByText('Sayfa 2 / 3', { exact: true }).waitFor();
    assert.equal(await table.locator('tr').count(), 100);
    await page.screenshot({ path: ownedFile(root, 'artifacts/teacher-report-screen.png'), fullPage: true });
    await page.evaluate(() => window.addEventListener('beforeprint', () => {
      window.__schoolPrintedRows = document.querySelector('[role="tabpanel"][data-state="active"] table tbody')?.children.length;
    }));
    await page.pdf({ path: ownedFile(root, 'artifacts/teacher-report.pdf'), format: 'A4', printBackground: true });
    assert.equal(await page.evaluate(() => window.__schoolPrintedRows), 282);
    await page.waitForFunction(() => document.querySelector('[role="tabpanel"][data-state="active"] table tbody')?.children.length === 100);
    await page.getByRole('tab', { name: 'Genel Bakış' }).click();
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Excel', exact: true }).click();
    const download = await downloaded;
    assert.match(download.suggestedFilename(), /\.xlsx$/);
    const excelFile = ownedFile(root, 'artifacts/teacher-results.xlsx');
    await download.saveAs(excelFile);
    const workbook = fs.readFileSync(excelFile);
    let offset = 0, sheet;
    while (workbook.readUInt32LE(offset) === 0x04034b50) {
      assert.equal(workbook.readUInt16LE(offset + 8), 0, 'Current Excel exporter creates stored ZIP entries');
      const size = workbook.readUInt32LE(offset + 18), nameLength = workbook.readUInt16LE(offset + 26), extraLength = workbook.readUInt16LE(offset + 28);
      const name = workbook.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
      const start = offset + 30 + nameLength + extraLength;
      if (name === 'xl/worksheets/sheet1.xml') { sheet = workbook.subarray(start, start + size).toString('utf8'); break; }
      offset = start + size;
    }
    assert.ok(sheet);
    assert.equal((sheet.match(/Sentetik Öğrenci/g) ?? []).length, 282);
    await page.locator('#results-quiz').click();
    await page.getByRole('option', { name: '80 öğrenci tarih sınavı', exact: true }).click();
    assert.equal(await table.locator('tr').count(), 1);
    assert.match(await table.innerText(), /80 öğrenci tarih sınavı/);
    await page.getByRole('tab', { name: 'Öğrenci Raporları' }).click();
    assert.equal(await table.locator('tr').count(), 82);
    assert.equal(errors.length, 0, errors.join('\n'));
    return { realProductionUI: true, screenRows: 100, printedRows: 282, excelRows: 282, filteredReportRows: 82, pageErrors: errors, browserClosed: true };
  } finally { await browser.close(); }
}
