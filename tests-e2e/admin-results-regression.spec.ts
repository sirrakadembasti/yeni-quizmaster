import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const runtime = JSON.parse(readFileSync('docs/admin-audit/runtime.json', 'utf8'));
const root = resolve(runtime.root);
if (dirname(root) !== resolve('server/data') || !basename(root).startsWith('quizmaster-test-admin-audit-') ||
    resolve(runtime.database) !== join(root, 'server', 'data', 'audit.db') || JSON.stringify(runtime.ports) !== '[5510,5511]') {
  throw new Error('Results regression must use the disposable audit database and ports.');
}
const { PrismaClient } = createRequire(resolve('server/package.json'))('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${runtime.database.replaceAll('\\', '/')}` } } });

test('admin results: unfinished attempts never lower averages; completed zero remains counted after reload', async ({ page, baseURL }, info) => {
  // Trace showed slow local Vite/browser startup consumed the first run's budget.
  test.setTimeout(360000);
  expect(baseURL).toBe('http://127.0.0.1:5511');
  const id = randomUUID();
  const title = `Results regression ${id}`;
  try {
    await prisma.quiz.create({ data: { id, title, createdBy: 'audit-admin', contentType: 'exam', status: 'draft' } });
    await prisma.studentResult.createMany({ data: [
      { studentId: 'audit-student', quizId: id, status: 'completed', score: 100 },
      { studentId: 'audit-student', quizId: id, status: 'in_progress', score: null },
      { studentId: 'audit-student', quizId: id, status: 'completed', score: null },
    ] });
    const csrf = await page.request.get(baseURL + '/api/csrf-token');
    const response = await page.request.post(baseURL + '/api/auth/login', {
      data: { email: 'audit-admin@example.test', password: 'AuditOnly2026!' },
      headers: { 'x-csrf-token': (await csrf.json()).csrfToken },
    });
    expect(response.status()).toBe(200);
    await page.goto('/results', { waitUntil: 'domcontentloaded' });
    const search = page.getByPlaceholder('Sınav veya ders ara...');
    await search.fill(title);
    const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: title, exact: true }) });
    await expect(row.getByRole('cell').nth(2)).toHaveText('3');
    await expect(row.getByRole('cell').nth(3)).toHaveText('1');
    await expect(row.getByRole('cell').last()).toHaveText('%100');
    await prisma.studentResult.create({ data: { studentId: 'audit-student', quizId: id, status: 'completed', score: 0 } });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await search.fill(title);
    await expect(row.getByRole('cell').nth(2)).toHaveText('4');
    await expect(row.getByRole('cell').nth(3)).toHaveText('2');
    await expect(row.getByRole('cell').last()).toHaveText('%50');
    await page.screenshot({ path: info.outputPath('graded-average.png'), fullPage: true, timeout: 10000 });
  } finally {
    await prisma.quiz.deleteMany({ where: { id } });
    await prisma.$disconnect();
  }
});

test('admin cache: returning to a visited class list reflects student removal without page reload', async ({ page, baseURL }) => {
  test.setTimeout(360000);
  expect(baseURL).toBe('http://127.0.0.1:5511');
  const classId = randomUUID();
  const studentId = randomUUID();
  const name = `1-Cache-${classId}`;
  try {
    await prisma.class.create({ data: { id: classId, name } });
    await prisma.user.create({ data: { id: studentId, name: 'Cache student', email: `${studentId}@example.test`, password: 'unused-isolated-fixture', role: 'student', classId } });
    const csrf = await page.request.get(baseURL + '/api/csrf-token');
    const response = await page.request.post(baseURL + '/api/auth/login', {
      data: { email: 'audit-admin@example.test', password: 'AuditOnly2026!' },
      headers: { 'x-csrf-token': (await csrf.json()).csrfToken },
    });
    expect(response.status()).toBe(200);
    await page.goto('/classlist', { waitUntil: 'domcontentloaded' });
    const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name, exact: true }) });
    await expect(row.getByRole('cell').nth(2)).toHaveText('1');
    // Sidebar transitions preserve the same QueryClient (goto/reload would hide the bug).
    await page.locator('nav a[href="/management"]').click();
    await page.getByRole('tab', { name: 'Sınıflar', exact: true }).click();
    await page.getByRole('heading', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/admin/classes/' + classId));
    const studentRow = page.getByRole('row').filter({ hasText: 'Cache student' });
    await studentRow.hover();
    await studentRow.getByRole('button').click();
    await expect(studentRow).toHaveCount(0);
    expect((await prisma.user.findUnique({ where: { id: studentId } })).classId).toBeNull();
    await page.locator('nav a[href="/classlist"]').click();
    await expect(row.getByRole('cell').nth(2)).toHaveText('0');
  } finally {
    await prisma.user.deleteMany({ where: { id: studentId } });
    await prisma.class.deleteMany({ where: { id: classId } });
    await prisma.$disconnect();
  }
});

test('admin content: retry after a lost save response keeps one published exam and its question', async ({ page, baseURL }) => {
  test.setTimeout(360000);
  expect(baseURL).toBe('http://127.0.0.1:5511');
  const title = `Atomic browser ${randomUUID()}`;
  const ids: string[] = [];
  try {
    const csrf = await page.request.get(baseURL + '/api/csrf-token');
    expect((await page.request.post(baseURL + '/api/auth/login', {
      data: { email: 'audit-admin@example.test', password: 'AuditOnly2026!' },
      headers: { 'x-csrf-token': (await csrf.json()).csrfToken },
    })).status()).toBe(200);
    await page.goto('/create-quiz', { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Sınav Başlığı/).fill(title);
    await page.getByRole('tab', { name: /Sorular/ }).click();
    await page.locator('textarea').first().fill('Choose A');
    await page.getByPlaceholder('1. seçenek').fill('A');
    await page.getByPlaceholder('2. seçenek').fill('B');
    await page.route('**/api/quizzes/*/content', async route => {
      ids.push(new URL(route.request().url()).pathname.split('/').at(-2)!);
      if (ids.length === 1) {
        const saved = await route.fetch();
        expect(saved.status()).toBe(200);
        await route.abort('failed'); // Server committed, client never receives the response.
      } else await route.continue();
    });
    await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
    await expect.poll(() => prisma.quiz.count({ where: { title } })).toBe(1);
    await expect(page.getByRole('button', { name: 'Yayınla', exact: true })).toBeEnabled();
    await expect(page).toHaveURL(/create-quiz/);
    await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
    await expect(page).toHaveURL(/\/quizzes$/);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
    expect(await prisma.quiz.count({ where: { title } })).toBe(1);
    const saved = await prisma.quiz.findUnique({ where: { id: ids[0] }, include: { questions: true } });
    expect(saved.status).toBe('published');
    expect(saved.questions).toHaveLength(1);
    expect(saved.questions[0].correctAnswer).toBe('A');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  } finally {
    await prisma.quiz.deleteMany({ where: { title } });
    await prisma.$disconnect();
  }
});
