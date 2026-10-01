import { test, expect, request as requestFactory } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const runtime = JSON.parse(readFileSync('docs/admin-audit/runtime.json', 'utf8'));
const root = resolve(runtime.root);
if (dirname(root) !== resolve('server/data') || !basename(root).startsWith('quizmaster-test-admin-audit-') || resolve(runtime.database) !== join(root, 'server', 'data', 'audit.db') || JSON.stringify(runtime.ports) !== '[5510,5511]') throw new Error('Disposable audit database required');
const { PrismaClient } = createRequire(resolve('server/package.json'))('@prisma/client');
const db = new PrismaClient({ datasources: { db: { url: `file:${runtime.database.replaceAll('\\', '/')}` } } });
test.setTimeout(360000);
async function authenticate(context: any, email: string) {
  const token = (await (await context.get('http://127.0.0.1:5511/api/csrf-token')).json()).csrfToken;
  expect((await context.post('http://127.0.0.1:5511/api/auth/login', { data: { email, password: 'AuditOnly2026!' }, headers: { 'x-csrf-token': token } })).status()).toBe(200);
}
test.afterAll(async () => { await db.$disconnect(); });
test('responsible teacher removal revokes legacy access and preserves independent course access after reload', async ({ page, baseURL }, info) => {
  expect(baseURL).toBe('http://127.0.0.1:5511');
  const template = await db.user.findUniqueOrThrow({ where: { id: 'audit-teacher' } });
  const teacher = await db.user.create({ data: { name: 'Access regression teacher', email: randomUUID()+'@example.test', password: template.password, role: 'teacher' } });
  const category = await db.category.create({ data: { name: 'Access regression course '+randomUUID() } });
  const classrooms: any[] = [];
  const teacherRequest = await requestFactory.newContext();
  let primaryError: unknown;
  try {
    await authenticate(page.request, 'audit-admin@example.test');
    await authenticate(teacherRequest, teacher.email);
    for (const withCourse of [false, true]) {
      const cls = await db.class.create({ data: { name: 'Access regression '+randomUUID(), classTeacherId: teacher.id, teachers: { connect: { id: teacher.id } }, ...(withCourse ? { teacherAssignments: { create: { teacherId: teacher.id, categoryId: category.id } } } : {}) } });
      classrooms.push(cls);
      expect((await teacherRequest.get(baseURL+'/api/classes/'+cls.id+'/students')).status()).toBe(200);
      await page.goto('/admin/classes/'+cls.id, { waitUntil: 'domcontentloaded' });
      // Cold Vite loading exceeded the global 20s expect timeout in the trace;
      // the exact heading appeared in a later DOM snapshot.
      await expect(page.getByRole('heading', { name: 'Sınıf Yönetimi: '+cls.name })).toBeVisible({ timeout: 120000 });
      if (withCourse) await expect(page.getByText('Kalan dersler: '+category.name)).toBeVisible();
      const card = page.locator('[data-slot="card"]').filter({ hasText: 'Sorumlu Öğretmen' });
      await card.getByRole('combobox').click();
      await page.getByRole('option', { name: '— Atamayı Kaldır —', exact: true }).click();
      await card.getByRole('button', { name: 'Kaydet', exact: true }).click();
      await expect(card.getByText('Atanmamış', { exact: true })).toBeVisible();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Sınıf Yönetimi: '+cls.name })).toBeVisible({ timeout: 120000 });
      const stored = await db.class.findUniqueOrThrow({ where: { id: cls.id }, include: { teachers: true, teacherAssignments: true } });
      expect(stored.classTeacherId).toBeNull(); expect(stored.teachers).toHaveLength(0);
      expect((await teacherRequest.get(baseURL+'/api/classes/'+cls.id+'/students')).status()).toBe(withCourse ? 200 : 403);
      if (withCourse) {
        expect(stored.teacherAssignments).toHaveLength(1);
        await page.getByRole('button', { name: `${teacher.name} öğretmeninin ${category.name} atamasını kaldır` }).click();
        await expect(page.getByRole('button', { name: `${teacher.name} öğretmeninin ${category.name} atamasını kaldır` })).toHaveCount(0);
        expect((await teacherRequest.get(baseURL+'/api/classes/'+cls.id+'/students')).status()).toBe(403);
      }
      await info.attach('access-'+String(withCourse), { body: JSON.stringify(stored), contentType: 'application/json' });
    }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await db.$transaction(async (tx: any) => {
        // Only these UUID fixtures are touched. Disconnect implicit relation
        // tables explicitly before deleting their endpoints.
        await tx.user.update({ where: { id: teacher.id }, data: { assignedCategories: { set: [] }, managedClasses: { set: [] } } });
        await tx.category.update({ where: { id: category.id }, data: { teachers: { set: [] }, classes: { set: [] } } });
        await tx.classTeacherCourse.deleteMany({ where: { OR: [{ teacherId: teacher.id }, { categoryId: category.id }] } });
        await tx.class.deleteMany({ where: { id: { in: classrooms.map(cls => cls.id) } } });
        // Authentication writes logs; these User FKs are restrictive.
        await tx.actionLog.deleteMany({ where: { userId: teacher.id } });
        await tx.notification.deleteMany({ where: { userId: teacher.id } });
        await tx.user.delete({ where: { id: teacher.id } });
        await tx.category.delete({ where: { id: category.id } });
      }, { maxWait: 30000, timeout: 60000 });
    } catch (cleanupError) {
      if (!primaryError) throw cleanupError;
      await info.attach('fixture-cleanup-error', { body: cleanupError instanceof Error ? cleanupError.stack || cleanupError.message : String(cleanupError), contentType: 'text/plain' });
    } finally {
      await teacherRequest.dispose();
    }
  }
});

test('archive failure rolls back data; retry records one complete archive and survives reload', async ({ page, baseURL }, info) => {
  expect(baseURL).toBe('http://127.0.0.1:5511');
  const year = 'E2E-'+randomUUID();
  const beforeQuizzes = await db.quiz.findMany({ select: { id: true, status: true, academicYear: true } });
  const beforeResults = await db.studentResult.findMany({ select: { id: true, academicYear: true } });
  const quiz = await db.quiz.create({ data: { title: 'Archive retry '+randomUUID(), createdBy: 'audit-admin', status: 'published' } });
  const result = await db.studentResult.create({ data: { quizId: quiz.id, studentId: 'audit-student', status: 'completed', score: 100 } });
  try {
    await authenticate(page.request, 'audit-admin@example.test');
    await page.goto('/archive', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('Örn: 2025-2026 Eğitim Yılı').fill(year);
    await page.getByRole('button', { name: 'Sistemi Arşivle' }).click();
    await expect(page.getByRole('dialog')).toContainText(/içerik ve .* sonuç/);
    await db.$executeRawUnsafe("CREATE TRIGGER e2e_archive_failure BEFORE UPDATE ON StudentResult BEGIN SELECT RAISE(ABORT, 'Injected archive failure'); END");
    await page.getByRole('button', { name: 'Evet, Arşivle' }).click();
    await expect(page.getByText('Arşivleme işlemi başarısız oldu.', { exact: true })).toBeVisible();
    expect(await db.quiz.findUnique({ where: { id: quiz.id } })).toMatchObject({ status: 'published', academicYear: null });
    expect(await db.studentResult.findUnique({ where: { id: result.id } })).toMatchObject({ academicYear: null });
    await db.$executeRawUnsafe('DROP TRIGGER e2e_archive_failure');
    await page.getByRole('button', { name: 'Evet, Arşivle' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('row').filter({ hasText: quiz.title })).toBeVisible();
    expect(await db.quiz.findUnique({ where: { id: quiz.id } })).toMatchObject({ status: 'archived', academicYear: year });
    expect(await db.studentResult.findUnique({ where: { id: result.id } })).toMatchObject({ academicYear: year });
    expect(await db.actionLog.count({ where: { action: 'ARCHIVE_YEAR', details: { contains: year } } })).toBe(1);
    await info.attach('archive-retry', { body: JSON.stringify({ quizId: quiz.id, year }), contentType: 'application/json' });
  } finally {
    await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS e2e_archive_failure');
    for (const q of beforeQuizzes) await db.quiz.update({ where: { id: q.id }, data: { status: q.status, academicYear: q.academicYear } });
    for (const r of beforeResults) await db.studentResult.update({ where: { id: r.id }, data: { academicYear: r.academicYear } });
    await db.quiz.delete({ where: { id: quiz.id } });
    await db.actionLog.deleteMany({ where: { action: 'ARCHIVE_YEAR', details: { contains: year } } });
  }
});
