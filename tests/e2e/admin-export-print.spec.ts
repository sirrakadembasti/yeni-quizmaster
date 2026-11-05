import { test, expect, type Page, type TestInfo, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';

// Never seed or clean up a user's database. These guards precede Prisma creation.
const runtime = JSON.parse(readFileSync('tests/denetim-kanitlari/yonetici/runtime.json', 'utf8'));
const isolatedRoot = resolve(runtime.root);
if (dirname(isolatedRoot) !== resolve('server/data') || !basename(isolatedRoot).startsWith('quizmaster-test-admin-audit-') ||
    resolve(runtime.database) !== join(isolatedRoot, 'server', 'data', 'audit.db') || JSON.stringify(runtime.ports) !== '[5510,5511]') {
  throw new Error('Export/print closure requires the disposable audit database on 5510/5511.');
}
const { PrismaClient } = createRequire(resolve('server/package.json'))('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${runtime.database.replaceAll('\\', '/')}` } } });
const suffix = randomUUID().slice(0, 8);
const ids = { teacher: randomUUID(), student: randomUUID(), other: randomUUID(), cls: randomUUID(), category: randomUUID(), exam: randomUUID(), survey: randomUUID(), result: randomUUID(), question: randomUUID(), surveyQuestion: randomUUID() };
const fixture = {
  teacher: `Şule İğde ${suffix}`, student: `Çağrı Işık ${suffix}`, other: `Dışarıdaki Öğrenci ${suffix}`,
  cls: `1-Çığ ${suffix}`, category: `Türkçe ${suffix}`, exam: `Sıfır Puanlı Sınav ${suffix}`, survey: `Görüş Anketi ${suffix}`,
  question: 'İstanbul & İzmir: hangisi? <A>', answer: '=HYPERLINK("https://example.test","Şüpheli")',
};

let auditCookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];
test.beforeAll(async ({ request, baseURL }) => {
  expect(baseURL).toBe('http://127.0.0.1:5511');
  const csrf = await request.get('/api/csrf-token');
  expect(csrf.status()).toBe(200);
  const token = (await csrf.json()).csrfToken;
  expect((await request.post('/api/auth/login', { data: { email: 'audit-admin@example.test', password: 'AuditOnly2026!' }, headers: { 'x-csrf-token': token } })).status()).toBe(200);
  auditCookies = (await request.storageState()).cookies;
  await prisma.user.create({ data: { id: ids.teacher, name: fixture.teacher, email: `teacher-${suffix}@example.test`, password: 'unused-isolated-fixture', role: 'teacher', phoneNumber: '05320000001' } });
  await prisma.category.create({ data: { id: ids.category, name: fixture.category, teachers: { connect: { id: ids.teacher } } } });
  await prisma.class.create({ data: { id: ids.cls, name: fixture.cls, description: 'Çığ & Şelale <A>', classTeacherId: ids.teacher, assignedCategories: { connect: { id: ids.category } }, teachers: { connect: { id: ids.teacher } } } });
  await prisma.user.createMany({ data: [
    { id: ids.student, name: fixture.student, email: `student-${suffix}@example.test`, password: 'unused-isolated-fixture', role: 'student', classId: ids.cls, studentNo: 7, parentName: 'Ayşe "Anne"', parentRelation: 'Anne', parentPhone: '05320000002', parentEmail: `parent-${suffix}@example.test`, parentAddress: 'Üsküdar & Çengelköy <ev>' },
    { id: ids.other, name: fixture.other, email: `other-${suffix}@example.test`, password: 'unused-isolated-fixture', role: 'student', classId: ids.cls, studentNo: 8 },
  ] });
  await prisma.quiz.create({ data: { id: ids.exam, title: fixture.exam, createdBy: ids.teacher, categoryId: ids.category, status: 'published', contentType: 'exam', assignedClasses: { connect: { id: ids.cls } }, questions: { create: { id: ids.question, text: fixture.question, type: 'multiple-choice', options: JSON.stringify(['A', 'B']), correctAnswer: 'A', order: 0 } } } });
  await prisma.studentResult.create({ data: { id: ids.result, studentId: ids.student, quizId: ids.exam, status: 'completed', score: 0, correctAnswersCount: 0, totalQuestions: 1, timeTaken: 120, answers: JSON.stringify({ [ids.question]: 'B' }), submittedAt: new Date(), completedAt: new Date() } });
  await prisma.studentResult.create({ data: { studentId: ids.other, quizId: ids.exam, status: 'in_progress', score: null, totalQuestions: 1 } });
  await prisma.quiz.create({ data: { id: ids.survey, title: fixture.survey, createdBy: ids.teacher, categoryId: ids.category, status: 'published', contentType: 'survey', publishedAt: new Date(), audienceSize: 2, assignedClasses: { connect: { id: ids.cls } }, questions: { create: { id: ids.surveyQuestion, text: 'Açık görüşünüz & öneriniz?', type: 'open-text', order: 0 } } } });
  await prisma.surveySubmission.create({ data: { surveyId: ids.survey, studentId: ids.student, answers: { create: { questionId: ids.surveyQuestion, value: JSON.stringify(fixture.answer) } } } });
});

test.afterAll(async () => {
  try {
    await prisma.quiz.deleteMany({ where: { id: { in: [ids.exam, ids.survey] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.student, ids.other] } } });
    await prisma.class.deleteMany({ where: { id: ids.cls } });
    await prisma.category.deleteMany({ where: { id: ids.category } });
    await prisma.user.deleteMany({ where: { id: ids.teacher } });
  } finally { await prisma.$disconnect(); }
});

test.beforeEach(async ({ page, baseURL }) => {
  test.setTimeout(180000);
  expect(baseURL).toBe('http://127.0.0.1:5511');
  await page.context().addCookies(auditCookies);
});

// Independently read the ZIP central directory; do not import the application's exporter.
function unzip(bytes: Buffer) {
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(end, 'Workbook ZIP must have an end-of-central-directory record').toBeGreaterThanOrEqual(0);
  let offset = bytes.readUInt32LE(end + 16);
  const entries: Record<string, string> = {};
  for (let i = 0; i < bytes.readUInt16LE(end + 10); i++) {
    expect(bytes.readUInt32LE(offset)).toBe(0x02014b50);
    const method = bytes.readUInt16LE(offset + 10), size = bytes.readUInt32LE(offset + 20);
    const nameLength = bytes.readUInt16LE(offset + 28), extraLength = bytes.readUInt16LE(offset + 30), commentLength = bytes.readUInt16LE(offset + 32);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    const local = bytes.readUInt32LE(offset + 42);
    expect(bytes.readUInt32LE(local)).toBe(0x04034b50);
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    expect([0, 8]).toContain(method);
    const data = bytes.subarray(start, start + size);
    entries[name] = (method === 8 ? inflateRawSync(data) : data).toString('utf8');
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function workbook(page: Page, info: TestInfo) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const path = info.outputPath(download.suggestedFilename().replace(/[<>:"/\\|?*]/g, '_'));
  await download.saveAs(path);
  expect(await download.failure()).toBeNull();
  await info.attach('downloaded-workbook', { path, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const entries = unzip(readFileSync(path));
  expect(entries['[Content_Types].xml']).toContain('spreadsheetml.sheet.main+xml');
  expect(entries['xl/workbook.xml']).toContain('<sheet');
  const sheet = entries['xl/worksheets/sheet1.xml'];
  expect(sheet).toBeTruthy();
  const rows = await page.evaluate(xml => {
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    if (document.querySelector('parsererror')) throw new Error('Downloaded worksheet is malformed XML');
    if (document.querySelector('f')) throw new Error('Untrusted exported values became executable spreadsheet formulas');
    return [...document.querySelectorAll('sheetData > row')].map(row => [...row.querySelectorAll('c')].map(cell => ({
      value: cell.querySelector('t, v')?.textContent || '', numeric: !cell.hasAttribute('t'),
    })));
  }, sheet);
  const data = (header: string) => {
    // Report metadata can share the first data header (e.g. Sınıf or Anket).
    // The final matching header is the table header after the metadata block.
    const index = rows.findLastIndex(row => row[0]?.value === header);
    expect(index, `Missing data header ${header}`).toBeGreaterThanOrEqual(0);
    return rows.slice(index + 1).map(row => row.map(cell => cell.value));
  };
  return { rows, data, values: rows.flat().map(cell => cell.value) };
}

async function printReport(page: Page, info: TestInfo, requiredText: string, meta = true, landscape = false) {
  // Avoid OS dialogs but exercise the real button before rendering with Chromium's print engine.
  await page.evaluate(() => { (window as any).__auditPrintCalls = 0; window.print = () => { (window as any).__auditPrintCalls++; }; });
  await page.getByRole('button', { name: /^(Yazdır|Yazdır \/ PDF|PDF)$/ }).click();
  expect(await page.evaluate(() => (window as any).__auditPrintCalls)).toBe(1);
  await page.emulateMedia({ media: 'print' });
  // A4 content width after the production @page 10mm side margins.
  await page.setViewportSize({ width: landscape ? 1047 : 718, height: 1123 });
  const main = page.locator('[data-dashboard-main]');
  await expect(main).toBeVisible();
  if (meta) await expect(page.locator('.print-report-meta')).toBeVisible();
  const layout = await page.evaluate(required => {
    const visible = (element: Element) => { const box = element.getBoundingClientRect(); const style = getComputedStyle(element); return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'; };
    const main = document.querySelector('[data-dashboard-main]')!;
    const mainBox = main.getBoundingClientRect();
    return {
      hasRequiredText: [...main.querySelectorAll('*')].some(element => visible(element) && [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.includes(required))),
      chrome: [...document.querySelectorAll('aside, nav, [data-dashboard-shell] > header')].filter(visible).map(element => element.tagName),
      controls: [...main.querySelectorAll('button, input, textarea, [role="combobox"], [role="tablist"]')].filter(visible).map(element => element.textContent),
      clippedTables: [...main.querySelectorAll('table')].filter(visible).filter(table => table.getBoundingClientRect().right > mainBox.right + 2 || table.scrollWidth > table.clientWidth + 2).map(table => table.textContent?.slice(0, 80)),
      repeatedHeaders: [...main.querySelectorAll('thead')].filter(visible).every(head => getComputedStyle(head).display === 'table-header-group'),
    };
  }, requiredText);
  await info.attach('print-layout', { body: JSON.stringify(layout, null, 2), contentType: 'application/json' });
  await page.screenshot({ path: info.outputPath('print-media.png'), fullPage: true });
  const pdfPath = info.outputPath('printed-report.pdf');
  const pdf = await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
  await info.attach('printed-report', { path: pdfPath, contentType: 'application/pdf' });
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  const mediaBoxes = [...pdf.toString('latin1').matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
  expect(mediaBoxes.length, 'Generated PDF must contain page dimensions').toBeGreaterThan(0);
  for (const box of mediaBoxes) expect(Number(box[1]) > Number(box[2])).toBe(landscape);
  expect(layout.hasRequiredText).toBe(true);
  expect(layout.chrome).toEqual([]);
  expect(layout.controls).toEqual([]);
  expect(layout.clippedTables, 'Report tables must fit the printable content width').toEqual([]);
  expect(layout.repeatedHeaders).toBe(true);
  return pdfPath;
}

test('teacher list workbook exports only matching rows and preserves Turkish relationships', async ({ page }, info) => {
  await page.goto('/teachers');
  await page.getByRole('textbox', { name: 'Öğretmen ara' }).fill(fixture.teacher);
  await expect(page.getByRole('row').filter({ hasText: fixture.teacher })).toHaveCount(1);
  const xlsx = await workbook(page, info);
  expect(xlsx.data('Ad Soyad')).toEqual([[fixture.teacher, `teacher-${suffix}@example.test`, '05320000001', fixture.category, fixture.cls, fixture.cls]]);
  expect(xlsx.values).toContain(fixture.teacher);
  await printReport(page, info, fixture.teacher);
});

test('student list workbook keeps selected row and admin parent/contact fields', async ({ page }, info) => {
  await page.goto('/students');
  await page.getByRole('textbox', { name: 'Öğrenci ara', exact: true }).fill(fixture.student);
  await expect(page.getByRole('row').filter({ hasText: fixture.student })).toHaveCount(1);
  const xlsx = await workbook(page, info);
  expect(xlsx.data('Ad Soyad')).toEqual([[fixture.student, `student-${suffix}@example.test`, fixture.cls, '7', '', '', 'Ayşe "Anne"', 'Anne', '05320000002', `parent-${suffix}@example.test`, 'Üsküdar & Çengelköy <ev>']]);
  expect(xlsx.values).not.toContain(fixture.other);
  await printReport(page, info, fixture.student);
});

test('class list workbook count and responsible teacher match the isolated class', async ({ page }, info) => {
  await page.goto('/classlist');
  await page.getByRole('textbox', { name: 'Sınıf ara' }).fill(fixture.cls);
  await expect(page.getByRole('row').filter({ hasText: fixture.cls })).toHaveCount(1);
  const xlsx = await workbook(page, info);
  expect(xlsx.data('Sınıf')).toEqual([[fixture.cls, 'Çığ & Şelale <A>', '2', fixture.teacher, `teacher-${suffix}@example.test`]]);
  await printReport(page, info, fixture.cls);
});

for (const admin of [false, true]) test(`${admin ? 'management' : 'read-only'} class detail exports the searched student and prints the roster`, async ({ page }, info) => {
  await page.goto(`${admin ? '/admin/classes/' : '/classes/'}${ids.cls}`);
  await page.getByPlaceholder(admin ? 'Ara...' : 'Öğrenci ismine göre filtrele...').fill(fixture.student);
  await expect(page.getByRole('row').filter({ hasText: fixture.student })).toHaveCount(1);
  const xlsx = await workbook(page, info);
  expect(xlsx.data('Sıra')).toEqual([['1', fixture.student, '7', `student-${suffix}@example.test`]]);
  expect(xlsx.values).not.toContain(fixture.other);
  await printReport(page, info, fixture.student);
  const printMeta = page.locator('.print-report-meta');
  await expect(printMeta.getByText(fixture.cls, { exact: true }), 'The printed roster must identify its class after the interactive header is hidden').toBeVisible();
  await expect(printMeta.getByText('1', { exact: true }), 'Printed student count must match the searched roster').toBeVisible();
});

test('teacher detail workbook contains the teacher class and exam rather than unrelated records', async ({ page }, info) => {
  await page.goto(`/teachers/${ids.teacher}`);
  await expect(page.getByRole('button', { name: 'Excel', exact: true })).toBeVisible();
  const xlsx = await workbook(page, info);
  expect(xlsx.values).toContain(fixture.teacher);
  expect(xlsx.data('Kayıt Türü')).toEqual(expect.arrayContaining([['Sınıf', fixture.cls, 'Sorumlu öğretmen'], ['Sınav', fixture.exam, 'published']]));
  expect(xlsx.data('Kayıt Türü').every(row => [fixture.cls, fixture.exam, fixture.survey].includes(row[1]))).toBe(true);
  await printReport(page, info, fixture.teacher);
});

test('teacher detail prints all 21 quizzes across PDF pages while retaining screen pagination', async ({ page }, info) => {
  const teacherId = randomUUID();
  const quizzes = Array.from({ length: 21 }, (_, index) => ({
    id: randomUUID(), title: `Sayfalı Öğretmen Sınavı ${String(index + 1).padStart(2, '0')} ${suffix}`,
    createdBy: teacherId, categoryId: ids.category, status: 'draft', contentType: 'exam',
  }));
  try {
    await prisma.user.create({ data: { id: teacherId, name: `Sayfalı Öğretmen ${suffix}`, email: `paged-teacher-${suffix}@example.test`, password: 'unused-isolated-fixture', role: 'teacher' } });
    await prisma.quiz.createMany({ data: quizzes });
    await page.goto(`/teachers/${teacherId}`);
    const screenTitles = page.locator('span:visible').filter({ hasText: new RegExp(`^Sayfalı Öğretmen Sınavı \\d{2} ${suffix}$`) });
    await expect(screenTitles).toHaveCount(10);
    const firstPage = await screenTitles.allTextContents();
    await page.getByRole('button', { name: 'Sonraki Sayfa' }).click();
    await expect(screenTitles).toHaveCount(10);
    expect((await screenTitles.allTextContents()).filter(title => firstPage.includes(title))).toEqual([]);
    const xlsx = await workbook(page, info);
    expect(xlsx.data('Kayıt Türü').map(row => row[1]).sort()).toEqual(quizzes.map(quiz => quiz.title).sort());
    const pdfPath = await printReport(page, info, quizzes[20].title);
    for (const quiz of quizzes) await expect(page.getByText(quiz.title, { exact: true })).toBeVisible();
    // Prerequisite: installed pypdf; AUDIT_PDF_PYTHON selects its Python runtime.
    // Assert actual PDF text, not only the print-media DOM or workbook rows.
    let pdfText: string;
    try {
      pdfText = execFileSync(process.env.AUDIT_PDF_PYTHON || 'python', ['-c',
        'import sys; from pypdf import PdfReader; sys.stdout.buffer.write("\\n".join(p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages).encode("utf-8"))', pdfPath],
      { encoding: 'utf8', timeout: 30000 });
    } catch (error) {
      throw new Error('Teacher pagination PDF assertion requires Python with pypdf; set AUDIT_PDF_PYTHON to the installed runtime.', { cause: error });
    }
    await info.attach('teacher-all-quizzes-pdf-text', { body: pdfText, contentType: 'text/plain; charset=utf-8' });
    const normalized = pdfText.replace(/\s/g, '');
    for (const quiz of quizzes) expect(normalized.split(quiz.title.replace(/\s/g, '')).length - 1, `${quiz.title} must appear exactly once in the generated PDF`).toBe(1);
  } finally {
    await prisma.quiz.deleteMany({ where: { id: { in: quizzes.map(quiz => quiz.id) } } });
    await prisma.user.deleteMany({ where: { id: teacherId } });
  }
});

test('results workbook records selected teacher/student provenance and preserves completed zero', async ({ page }, info) => {
  await page.goto('/results');
  await page.getByRole('combobox').nth(3).click();
  await page.getByRole('option', { name: fixture.teacher, exact: true }).click();
  await page.getByRole('combobox').nth(4).click();
  await page.getByRole('option', { name: fixture.student, exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: fixture.exam }).first()).toBeVisible();
  const xlsx = await workbook(page, info);
  expect(xlsx.data('Sınav Adı')).toHaveLength(1);
  expect(xlsx.data('Sınav Adı')[0].slice(0, 10)).toEqual([fixture.exam, fixture.category, fixture.student, `student-${suffix}@example.test`, fixture.cls, 'Tamamlandı', '0', '0', '1', '120']);
  expect(xlsx.rows.find(row => row[0]?.value === fixture.exam)?.[6].numeric, 'Completed zero must remain a numeric score').toBe(true);
  expect.soft(xlsx.rows.some(row => row[0]?.value === 'Öğretmen' && row[1]?.value === fixture.teacher), 'Selected teacher must be recorded in workbook report metadata').toBe(true);
  expect.soft(xlsx.rows.some(row => row[0]?.value === 'Öğrenci' && row[1]?.value === fixture.student), 'Selected student must be recorded in workbook report metadata').toBe(true);
  await printReport(page, info, fixture.exam);
  await expect.soft(page.locator('.print-report-meta')).toContainText(fixture.teacher);
  await expect.soft(page.locator('.print-report-meta')).toContainText(fixture.student);
});

test('admin student analysis workbook keeps the real zero score and selected student identity', async ({ page }, info) => {
  await page.goto(`/student/results?studentId=${ids.student}`);
  await expect(page.getByRole('button', { name: 'Excel', exact: true })).toBeVisible();
  const xlsx = await workbook(page, info);
  expect(xlsx.values).toContain(fixture.student);
  expect(xlsx.data('Sınav')).toHaveLength(1);
  expect(xlsx.data('Sınav')[0].slice(0, 7)).toEqual([fixture.exam, fixture.category, '0', '0', '1', '2', 'Tamamlandı']);
  await printReport(page, info, fixture.student);
});

test('result detail workbook exports question and actual wrong answer, then prints the detail', async ({ page }, info) => {
  await page.goto(`/student/result/${ids.result}`);
  await expect(page.getByRole('button', { name: 'Excel', exact: true })).toBeVisible();
  const xlsx = await workbook(page, info);
  expect(xlsx.data('Soru No')).toEqual([['1', fixture.question, 'multiple-choice', 'B', 'A', 'Yanlış']]);
  await printReport(page, info, fixture.question);
});

test('class analytics workbook matches real participation and zero average and prints its chart/table', async ({ page }, info) => {
  await page.goto('/statistics');
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: fixture.cls, exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: fixture.cls })).toHaveCount(1);
  const xlsx = await workbook(page, info);
  expect(xlsx.data('Sınıf')).toEqual([[fixture.cls, '2', '1', '50', '0']]);
  await printReport(page, info, fixture.cls);
});

test('survey workbook exports real open-text response safely and prints landscape results', async ({ page }, info) => {
  await page.goto('/survey-results');
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: fixture.survey, exact: true }).click();
  await expect(page.getByText(fixture.answer, { exact: true })).toBeVisible();
  const xlsx = await workbook(page, info);
  const rows = xlsx.data('Anket');
  expect(rows).toHaveLength(1);
  expect(rows[0][0]).toBe(fixture.survey);
  expect(rows[0][1]).toBe('Açık görüşünüz & öneriniz?');
  expect(rows[0][3]).toBe(`'${fixture.answer}`);
  expect(rows[0][4]).toBe('1');
  expect(rows[0][7]).toBe(fixture.student);
  await printReport(page, info, fixture.answer, true, true);
});

for (const route of ['/quizzes', '/management', '/announcements', '/settings']) test(`admin ${route} print action produces a portrait report without interactive controls`, async ({ page }, info) => {
  await page.goto(route);
  await expect(page.getByRole('button', { name: 'Yazdır', exact: true })).toBeVisible();
  const text = (await page.locator('[data-dashboard-main] h1').first().innerText()).trim();
  await printReport(page, info, text, false);
});
