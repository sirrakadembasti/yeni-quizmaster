import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '..'), out = path.join(root, 'tests/denetim-kanitlari/entegrasyon');
const runtime = JSON.parse(fs.readFileSync(path.join(root, 'tests/denetim-kanitlari/veli/runtime.json')));
assert.equal(path.dirname(path.resolve(runtime.root)), path.join(root, 'server/data'));
assert(path.basename(runtime.root).startsWith('quizmaster-test-parent-audit-'));
const { chromium, request } = createRequire(path.join(root, 'package.json'))('playwright');
const proof = await fetch('http://127.0.0.1:5560/api/csrf-token');
assert(runtime.integrationIdentity && proof.headers.get('x-quizmaster-audit-fixture') === runtime.integrationIdentity, 'Running service is not the disposable fixture');
await proof.body.cancel();
const browser = await chromium.launch({ headless: true });
const contexts = [], report = { startedAt: new Date().toISOString(), checks: [] };
let activeCheck = 'S-U06';
async function pageFor(role) {
  const api = await request.newContext({ baseURL: 'http://127.0.0.1:5560' });
  const token = (await (await api.get('/api/csrf-token')).json()).csrfToken;
  const response = await api.post('/api/auth/login', { data: { email: role === 'student' ? 'parent-audit-child@example.test' : 'parent-audit-admin@example.test', password: 'StudentAuditOnly2026!' }, headers: { 'x-csrf-token': token } });
  assert.equal(response.status(), 200);
  const context = await browser.newContext({ storageState: await api.storageState(), viewport: { width: 1280, height: 800 } });
  contexts.push(context); await api.dispose(); const page = await context.newPage(); page.setDefaultTimeout(30000); return page;
}
try {
  const student = await pageFor('student');
  await student.goto('http://127.0.0.1:5561/student/quizzes');
  await student.getByText('Parent Audit Completed Exam', { exact: true }).waitFor();
  const onlineRow = await student.getByText('Parent Audit Completed Exam', { exact: true }).locator('xpath=ancestor::tr').innerText();
  assert.match(onlineRow, /Tamamlandı/, 'Fixture must be completed before the transport failure');
  await student.route('**/api/student/quizzes', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Controlled offline failure' }) }));
  await student.route('**/api/student/results', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Controlled offline failure' }) }));
  await student.reload(); await student.getByText('Çevrimdışısınız.', { exact: false }).waitFor();
  const offlineRow = await student.getByText('Parent Audit Completed Exam', { exact: true }).locator('xpath=ancestor::tr').innerText();
  assert.match(offlineRow, /Tamamlandı/, 'Completed cached result must stay completed');
  assert(!offlineRow.includes('Yapılacak'), 'Offline fallback must not turn a completed exam into pending work');
  await student.screenshot({ path: path.join(out, 'ux-extra-offline.png'), fullPage: true });
  report.checks.push({ id: 'S-U06', status: 'passed', onlineRow, offlineRow, completedBecomesPending: false, scope: 'Controlled503 triggers actual cached-list fallback; no DB writes' });
  activeCheck = 'A-U02';
  const admin = await pageFor('admin');
  await admin.route('**/api/student/results?studentId=parent-audit-student', async route => {
    const response = await route.fetch(), body = await response.json(), base = body.results[0];
    assert(base);
    const results = Array.from({ length: 60 }, (_, i) => {
      const title = `LargeAuditRow-${String(i).padStart(2, '0')} ` + 'Long report content testing readable wrapping '.repeat(6) + ` END-${String(i).padStart(2, '0')}`;
      return { ...base, id: `large-audit-result-${i}`, quizId: `large-audit-quiz-${i}`, score: i === 0 ? 0 : 70,
        quizTitle: title, quiz: { ...base.quiz, id: `large-audit-quiz-${i}`, title } };
    });
    await route.fulfill({ response, json: { ...body, results } });
  });
  await admin.goto('http://127.0.0.1:5561/student/results?studentId=parent-audit-student');
  await admin.getByText(/^LargeAuditRow-59 /).waitFor();
  const rows = await admin.getByText(/^LargeAuditRow-\d\d /).count();
  assert.equal(rows, 60, 'Every long fixture result must render');
  const firstRow = admin.getByText(/^LargeAuditRow-00 /).locator('xpath=ancestor::tr');
  assert.equal((await firstRow.locator('td').nth(4).innerText()).trim(), '0', 'A zero score must remain zero');
  const code = await admin.getByText('Öğrenci Kodu', { exact: true }).locator('..').innerText();
  assert(code.includes('parent-audit-student'), 'Student identifier must be complete');
  const actionHeader = admin.getByRole('columnheader', { name: 'Eylem', exact: true, includeHidden: true });
  await actionHeader.waitFor();
  await admin.emulateMedia({ media: 'print' });
  const printActionCells = await actionHeader.evaluate(th => {
    const index = [...th.parentElement.children].indexOf(th);
    return [th, ...[...th.closest('table').querySelectorAll('tbody tr')].map(row => row.children[index])]
      .map(cell => ({ tag: cell.tagName, display: getComputedStyle(cell).display }));
  });
  assert.equal(printActionCells.length, 61, 'Must check all sixty action cells and their header');
  assert(printActionCells.every(cell => cell.display === 'none'), 'Print must hide every action header and cell');
  await admin.pdf({ path: path.join(out, 'ux-extra-large-report.pdf'), format: 'A4', printBackground: true });
  await admin.emulateMedia({ media: 'screen' });
  await admin.screenshot({ path: path.join(out, 'ux-extra-large-report.png'), fullPage: true });
  report.checks.push({ id: 'A-U02', status: 'passed', sourceRows: 60, domRows: rows, zeroScoreIncluded: true, printActionCells,
    pdf: 'ux-extra-large-report.pdf', scope: '60 controlled real-shaped result records, long titles; PDF text/render assessed separately' });
  assert.equal(report.checks.length, 2);
  assert(report.checks.every(check => check.status === 'passed'));
} catch (error) { report.checks.push({ id: activeCheck, status: 'failed', reason: error.name + ': ' + error.message.slice(0, 300) }); report.error = error.name + ': ' + error.message.slice(0, 300); process.exitCode = 1; }
finally {
  for (const context of contexts) await context.close(); await browser.close();
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(out, 'ux-extra-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
