import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { login, api, prisma } from './parent-audit-helpers';

const parentId = 'parent-audit-parent';
const childId = 'parent-audit-student';
const ownResultId = 'parent-audit-result';
const privateChildId = 'parent-audit-other-student';
const privateResultId = 'parent-audit-private-result';

async function fixtureEmail(id: string) {
  const db = prisma();
  try { return (await db.user.findUniqueOrThrow({ where: { id } })).email; }
  finally { await db.$disconnect(); }
}

async function roleEmail(role: string) {
  const db = prisma();
  try { return (await db.user.findFirstOrThrow({ where: { role } })).email; }
  finally { await db.$disconnect(); }
}

function noSecrets(value: unknown) {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    expect(['password', 'resetToken', 'resetTokenExpiry', 'emailVerificationToken', 'sessionVersion'], `secret response field ${key}`).not.toContain(key);
    noSecrets(nested);
  }
}

async function screenshot(page: Page, name: string) {
  mkdirSync('tests/denetim-kanitlari/veli/screenshots', { recursive: true });
  await page.screenshot({ path: `tests/denetim-kanitlari/veli/screenshots/security-${name}.png`, fullPage: true });
}

test.describe('Parent real API access boundaries', () => {
  test('anonymous reads return 401 and student sessions cannot enter parent routes', async ({ page }) => {
    for (const url of ['/parents/students', `/parents/students/${childId}/overview`, `/parents/results/${ownResultId}`]) {
      expect((await page.request.get('/api' + url)).status(), url).toBe(401);
    }
    await page.goto('/parent/dashboard');
    await expect(page).toHaveURL(/\/auth(?:\?|$)/);
    await login(page, await fixtureEmail(childId));
    for (const url of ['/parents/students', `/parents/students/${childId}/overview`, `/parents/results/${ownResultId}`]) {
      expect((await api(page, 'GET', url)).status(), url).toBe(403);
    }
    await page.goto('/parent/results');
    await expect(page).toHaveURL(/\/$/);
    await screenshot(page, 'wrong-role');
  });

  test('linked students and completed answers are visible without authentication secrets or foreign results', async ({ page }) => {
    await login(page);
    const students = await api(page, 'GET', '/parents/students');
    expect(students.status()).toBe(200);
    const studentsBody = await students.json();
    noSecrets(studentsBody);
    expect(studentsBody.students.map((s: any) => s.id)).toEqual(expect.arrayContaining([childId, 'parent-audit-empty']));
    expect(studentsBody.students.map((s: any) => s.id)).not.toContain(privateChildId);
    const overview = await api(page, 'GET', `/parents/students/${childId}/overview`);
    expect(overview.status()).toBe(200);
    const body = await overview.json();
    noSecrets(body);
    expect(body.student.id).toBe(childId);
    expect(body.results.map((r: any) => r.id)).toContain(ownResultId);
    for (const result of body.results) expect(result).toMatchObject({ studentId: childId, status: 'completed' });
    const detail = await api(page, 'GET', `/parents/results/${ownResultId}`);
    expect(detail.status()).toBe(200);
    const detailBody = await detail.json();
    noSecrets(detailBody);
    expect(detailBody.result.studentId).toBe(childId);
    expect(detailBody.questions.length).toBeGreaterThan(0);
    for (const question of detailBody.questions) {
      expect(question).toHaveProperty('correctAnswer');
      expect(question).toHaveProperty('studentAnswer');
      expect(question).toHaveProperty('isCorrect');
    }
    expect((await api(page, 'GET', `/parents/students/${privateChildId}/overview`)).status()).toBe(403);
    expect((await api(page, 'GET', `/parents/results/${privateResultId}`)).status()).toBe(403);
    expect((await api(page, 'GET', '/parents/results/parent-audit-missing-result')).status()).toBe(404);
    const noLinksEmail = await fixtureEmail('parent-audit-no-links');
    await login(page, noLinksEmail);
    expect((await (await api(page, 'GET', '/parents/students')).json()).students).toEqual([]);
    expect((await api(page, 'GET', `/parents/students/${childId}/overview`)).status()).toBe(403);
  });

  test('parent cannot start exams, mutate child records, manage guardian links or archive data', async ({ page }) => {
    await login(page);
    const denied = [
      ['GET', '/student/quizzes', undefined],
      ['GET', '/student/results', undefined],
      ['POST', '/student/quiz/parent-audit-completed-exam/start', {}],
      ['POST', `/student/quiz/${ownResultId}/answer`, { questionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', selectedOption: 'A' }],
      ['POST', `/student/quiz/${ownResultId}/submit`, { answers: {} }],
      ['PATCH', `/users/${childId}`, { name: 'Unauthorized parent edit' }],
      ['DELETE', `/users/${childId}`, undefined],
      ['GET', '/parents', undefined],
      ['POST', '/parents', {}],
      ['POST', '/parents/link', { guardianId: parentId, studentId: privateChildId, relation: 'Anne' }],
      ['PATCH', `/parents/link/${parentId}/${childId}`, { relation: 'Baba' }],
      ['DELETE', `/parents/link/${parentId}/${childId}`, undefined],
      ['PUT', `/parents/guardian/${parentId}/students`, { studentIds: [] }],
      ['PATCH', `/parents/guardian/${parentId}`, { name: 'Unauthorized admin edit' }],
      ['POST', '/admin/archive', { academicYear: 'ParentAuditUnauthorized2026' }],
      ['POST', '/admin/purge', { academicYear: 'ParentAuditUnauthorized2026' }],
      ['POST', '/announcements', { title: 'Parent unauthorized announcement', content: 'Denied', targetRole: 'all' }],
    ] as const;
    for (const [method, url, data] of denied) {
      const response = await api(page, method, url, data);
      expect(response.status(), `${method} ${url}`).toBe(403);
      noSecrets(await response.json());
    }
    const db = prisma();
    try {
      expect(await db.guardianStudent.findUnique({ where: { guardianId_studentId: { guardianId: parentId, studentId: childId } } })).not.toBeNull();
      expect((await db.user.findUniqueOrThrow({ where: { id: childId } })).name).not.toBe('Unauthorized parent edit');
      expect((await db.studentResult.findUniqueOrThrow({ where: { id: ownResultId } })).status).toBe('completed');
    } finally { await db.$disconnect(); }
  });

  test('parent cannot answer a legacy in-progress attempt owned by their former student identity', async ({ page }) => {
    const id = 'parent-audit-security-legacy-attempt-' + randomUUID();
    const db = prisma();
    try {
      // Role changes preserve historical StudentResult rows; ownership must not bypass the parent read-only role.
      await db.studentResult.create({ data: { id, studentId: parentId, quizId: 'parent-audit-exam', status: 'in_progress', answers: '{}', totalQuestions: 2 } });
      await login(page);
      const response = await api(page, 'POST', `/student/quiz/${id}/answer`, {
        questionId: '66666666-6666-4666-8666-666666666661', selectedOption: 'A',
      });
      mkdirSync('tests/denetim-kanitlari/veli', { recursive: true });
      const after = await db.studentResult.findUniqueOrThrow({ where: { id } });
      writeFileSync('tests/denetim-kanitlari/veli/legacy-answer-observation.json', JSON.stringify({ status: response.status(), role: 'parent', priorAnswers: {}, storedAnswers: JSON.parse(after.answers || '{}'), isolatedSyntheticAttempt: true }, null, 2));
      expect(response.status(), 'Parent role must be denied even when a retained attempt belongs to the same user ID').toBe(403);
      expect((await db.studentResult.findUniqueOrThrow({ where: { id } })).answers).toBe('{}');
    } finally {
      await db.studentResult.deleteMany({ where: { id, studentId: parentId, quizId: 'parent-audit-exam' } });
      await db.$disconnect();
    }
  });

  test('unfinished child results are absent from overview and cannot expose the answer key', async ({ page }) => {
    const id = 'parent-audit-security-in-progress-' + randomUUID();
    const db = prisma();
    try {
      const source = await db.studentResult.findUniqueOrThrow({ where: { id: ownResultId } });
      await db.studentResult.create({ data: { id, studentId: childId, quizId: source.quizId, status: 'in_progress', answers: '{}', totalQuestions: source.totalQuestions } });
      await login(page);
      expect((await api(page, 'GET', `/parents/results/${id}`)).status()).toBe(404);
      const overview = await api(page, 'GET', `/parents/students/${childId}/overview`);
      expect(overview.status()).toBe(200);
      expect((await overview.json()).results.map((r: any) => r.id)).not.toContain(id);
    } finally {
      await db.studentResult.deleteMany({ where: { id, studentId: childId } });
      await db.$disconnect();
    }
  });

  test('removing a guardian link revokes overview and result access in the existing session', async ({ page }) => {
    const db = prisma();
    const key = { guardianId_studentId: { guardianId: parentId, studentId: childId } };
    const saved = await db.guardianStudent.findUniqueOrThrow({ where: key });
    try {
      await login(page);
      expect((await api(page, 'GET', `/parents/results/${ownResultId}`)).status()).toBe(200);
      await db.guardianStudent.delete({ where: key });
      const listed = await api(page, 'GET', '/parents/students');
      expect(listed.status()).toBe(200);
      expect((await listed.json()).students.map((s: any) => s.id)).not.toContain(childId);
      expect((await api(page, 'GET', `/parents/students/${childId}/overview`)).status()).toBe(403);
      expect((await api(page, 'GET', `/parents/results/${ownResultId}`)).status()).toBe(403);
    } finally {
      await db.guardianStudent.upsert({ where: key, create: saved, update: { relation: saved.relation } });
      await db.$disconnect();
    }
  });

  test('deactivating the linked student hides the child and denies previously authorized results', async ({ page }) => {
    const db = prisma();
    const saved = await db.user.findUniqueOrThrow({ where: { id: childId } });
    try {
      await login(page);
      await db.user.update({ where: { id: childId }, data: { isActive: false, deactivatedAt: new Date() } });
      const listed = await api(page, 'GET', '/parents/students');
      expect(listed.status()).toBe(200);
      expect((await listed.json()).students.map((s: any) => s.id)).not.toContain(childId);
      expect((await api(page, 'GET', `/parents/students/${childId}/overview`)).status()).toBe(403);
      expect((await api(page, 'GET', `/parents/results/${ownResultId}`)).status()).toBe(403);
    } finally {
      await db.user.update({ where: { id: childId }, data: { isActive: saved.isActive, deactivatedAt: saved.deactivatedAt } });
      await db.$disconnect();
    }
  });

  test('server-side parent session revocation returns 401 and protected page reload requires login', async ({ page }) => {
    const id = 'parent-audit-security';
    const db = prisma();
    const saved = await db.user.findUniqueOrThrow({ where: { id } });
    try {
      await login(page, saved.email);
      expect((await api(page, 'GET', '/parents/students')).status()).toBe(200);
      await db.user.update({ where: { id }, data: { sessionVersion: saved.sessionVersion + 1 } });
      expect((await api(page, 'GET', '/parents/students')).status()).toBe(401);
      expect((await api(page, 'GET', '/auth/me')).status()).toBe(401);
      await page.goto('/parent/dashboard');
      await expect(page).toHaveURL(/\/auth(?:\?|$)/);
      await screenshot(page, 'session-revoked');
    } finally {
      await db.user.update({ where: { id }, data: { sessionVersion: saved.sessionVersion } });
      await db.$disconnect();
    }
  });

  test('classless child assigned exams match the exams visible in the child account', async ({ page }) => {
    await login(page, await fixtureEmail('parent-audit-empty'));
    const child = await api(page, 'GET', '/student/quizzes');
    expect(child.status()).toBe(200);
    const childIds = (await child.json()).quizzes.map((q: any) => q.id).sort();
    expect(childIds.length, 'Fixture must contain an unassigned published exam for this comparison').toBeGreaterThan(0);
    await login(page);
    const overview = await api(page, 'GET', '/parents/students/parent-audit-empty/overview');
    expect(overview.status()).toBe(200);
    const parentIds = (await overview.json()).quizzes.map((q: any) => q.id).sort();
    mkdirSync('tests/denetim-kanitlari/veli', { recursive: true });
    writeFileSync('tests/denetim-kanitlari/veli/classless-exams-observation.json', JSON.stringify({ childIds, parentIds, status: overview.status() }, null, 2));
    expect(parentIds).toEqual(childIds);
  });

  test('class-targeted parent announcement creates a real notification for the linked parent', async ({ page }) => {
    const title = 'Parent audit class notice ' + randomUUID();
    const db = prisma();
    let announcementId: string | undefined;
    try {
      await login(page, await roleEmail('admin'));
      const created = await api(page, 'POST', '/announcements', { title, content: 'Synthetic parent audience notification', targetRole: 'parent', targetClassId: '11111111-1111-4111-8111-111111111111' });
      expect(created.status()).toBe(201);
      announcementId = (await created.json()).id;
      await login(page);
      const list = await api(page, 'GET', '/announcements');
      expect(list.status()).toBe(200);
      expect((await list.json()).announcements.map((a: any) => a.id)).toContain(announcementId);
      const notifications = await api(page, 'GET', '/notifications?limit=100');
      expect(notifications.status()).toBe(200);
      mkdirSync('tests/denetim-kanitlari/veli', { recursive: true });
      writeFileSync('tests/denetim-kanitlari/veli/class-announcement-observation.json', JSON.stringify({ createdStatus: created.status(), parentListIncludes: true, parentNotificationCount: await db.notification.count({ where: { userId: parentId, title } }), foreignNotificationCount: await db.notification.count({ where: { userId: privateChildId, title } }) }, null, 2));
      expect((await notifications.json()).notifications.map((n: any) => n.title)).toContain(title);
      expect(await db.notification.count({ where: { userId: parentId, title } })).toBe(1);
      expect(await db.notification.count({ where: { userId: privateChildId, title } })).toBe(0);
    } finally {
      await db.notification.deleteMany({ where: { title } });
      if (announcementId) await db.announcement.deleteMany({ where: { id: announcementId, title } });
      await db.$disconnect();
    }
  });
});
