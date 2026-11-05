import { test, expect } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { assertIsolatedRuntime, prisma, login, api } from './academic-archive-helpers';
import { captureArchive } from '../../server/services/archive-capture';

test('authenticated business writes freeze while login, logout, password reset and notification preferences remain usable', async ({ page }) => {
  test.setTimeout(120000);
  assertIsolatedRuntime();
  const db = prisma(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const admin = await db.user.findUniqueOrThrow({ where: { email: 'academic-admin@example.test' } });
    const active = await db.academicYear.findFirstOrThrow({ where: { status: 'active' } });
    const year = await db.academicYear.update({ where: { id: active.id }, data: { label: '2025-2026', opensAt: new Date('2025-09-01'), scheduledCloseAt: new Date('2099-07-14T21:05:00Z') } });
    const cls = await db.class.create({ data: { name: 'Boundary frozen class' } });
    const student = await db.user.create({ data: { name: 'Boundary frozen student', email: randomUUID() + '@example.test', password: 'synthetic', classId: cls.id } });
    const quiz = await db.quiz.create({ data: { title: 'Boundary frozen exam', createdBy: admin.id } });
    await db.academicTransitionRule.create({ data: { yearId: year.id, fromClassId: cls.id, graduate: true } });
    const owner = 'boundary-fixture-' + randomUUID();
    const snapshot = await db.archiveSnapshot.create({ data: { academicYearId: year.id, label: year.label, mode: 'annual', annualKey: year.label, scopeJson: '{}', initiatedBy: admin.id, leaseOwner: owner, leaseExpiresAt: new Date(Date.now() + 180000) } });
    await db.academicYear.update({ where: { id: year.id }, data: { scheduledCloseAt: new Date('2026-07-14T21:05:00Z') } });
    await captureArchive(db, snapshot.id, { owner, now: () => new Date() });
    await login(page);
    expect((await api(page, 'GET', '/auth/me')).status()).toBe(200);
    for (const [method, route, body] of [
      ['PATCH', '/auth/me', { name: 'Illegal changed admin' }],
      ['POST', '/auth/register', { name: 'Illegal new student', email: 'boundary-register@example.test', password: 'Synthetic2026!' }],
      ['PATCH', `/classes/${cls.id}`, { name: 'Illegal changed class' }],
      ['PATCH', `/quizzes/${quiz.id}`, { title: 'Illegal changed exam' }],
    ] as const) {
      const response = await api(page, method, route, body);
      expect(response.status()).toBe(423);
      expect((await response.json()).code).toBe('ANNUAL_CAPTURE_FROZEN');
    }
    expect(await db.actionLog.count({ where: { userId: admin.id, action: 'ARCHIVE_WRITE_DENIED', details: { contains: snapshot.id } } })).toBe(4);
    expect((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).name).toBe(admin.name);
    expect((await db.class.findUniqueOrThrow({ where: { id: cls.id } })).name).toBe('Boundary frozen class');
    expect((await api(page, 'PATCH', '/notifications/preferences', { muted: true })).status()).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).notificationMuted).toBe(true);
    const created = await api(page, 'POST', '/admin/password-reset-requests', { email: student.email });
    expect(created.status()).toBe(201);
    const createdRequest = (await created.json()).request;
    expect(createdRequest).toMatchObject({ userId: student.id, status: 'pending' });
    const resent = await api(page, 'POST', `/admin/password-reset-requests/${createdRequest.id}/resend`);
    expect(resent.status()).toBe(200);
    const resentRequest = (await resent.json()).request;
    expect(resentRequest.id).not.toBe(createdRequest.id);
    expect((await db.passwordResetRequest.findUniqueOrThrow({ where: { id: createdRequest.id } })).status).toBe('cancelled');
    expect((await api(page, 'POST', `/admin/password-reset-requests/${resentRequest.id}/cancel`)).status()).toBe(200);
    expect((await db.passwordResetRequest.findUniqueOrThrow({ where: { id: resentRequest.id } })).status).toBe('cancelled');
    expect((await db.user.findUniqueOrThrow({ where: { id: student.id } })).resetToken).toBeNull();
    expect(await db.emailQueue.count({ where: { to: student.email, type: 'password_reset' } })).toBe(2);
    await expect.poll(async () => await db.emailQueue.count({ where: { to: student.email, errorMessage: { contains: 'Academic fixture delivery disabled' } } })).toBeGreaterThan(0);
    expect((await api(page, 'POST', '/auth/logout')).status()).toBe(200);
    await login(page);
    // A synthetic reset request exercises the actual reset endpoint without SMTP.
    const token = randomUUID();
    const reset = await db.passwordResetRequest.create({ data: { userId: admin.id, email: admin.email, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 180000) } });
    expect((await api(page, 'POST', '/auth/reset-password', { token, password: 'AcademicFixtureOnly2026!' })).status()).toBe(200);
    expect((await db.passwordResetRequest.findUniqueOrThrow({ where: { id: reset.id } })).status).toBe('completed');
    await login(page);
    // Release fixture ownership; the running production worker verifies a real
    // Chromium PDF/ZIP before promotion and year closure, with no fake completion.
    await db.archiveSnapshot.update({ where: { id: snapshot.id }, data: { leaseOwner: null, leaseExpiresAt: null } });
    await expect.poll(async () => (await db.archiveSnapshot.findUniqueOrThrow({ where: { id: snapshot.id } })).status, { timeout: 60000 }).toBe('completed');
    expect((await db.academicYear.findUniqueOrThrow({ where: { id: year.id } })).status).toBe('closed');
    expect(await db.$queryRawUnsafe('SELECT * FROM ArchiveFinalizationPermit')).toEqual([]);
    expect(errors).toEqual([]);
  } finally { await db.$disconnect(); }
});
