import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
vi.mock('../../middleware/auth', () => ({ requireAuth: (req: any, _res: any, next: any) => { req.user = { id: actorId, role: 'admin' }; next(); } }));
vi.mock('../../services/archive-db', () => ({ archiveDb: null }));
import { createAnnualCaptureGuard } from '../../middleware/annual-capture-guard';
import { captureArchive } from '../../services/archive-capture';

const template = process.env.DATABASE_URL!.slice(5);
if (!path.basename(path.dirname(template)).startsWith('quizmaster-test-')) throw new Error('Disposable database required');
let db: PrismaClient, actorId: string, ids: Record<string, string>, jobId: string;
beforeEach(async () => {
  const file = path.join(path.dirname(template), randomUUID() + '.db');
  await copyFile(template, file);
  db = new PrismaClient({ datasources: { db: { url: 'file:' + file.split('\\').join('/') } } });
  const user = await db.user.create({ data: { name: 'Frozen teacher', email: randomUUID() + '@example.test', password: 'synthetic', role: 'teacher' } }); actorId = user.id;
  const cls = await db.class.create({ data: { name: 'Frozen class', teachers: { connect: { id: user.id } } } });
  const student = await db.user.create({ data: { name: 'Frozen student', email: randomUUID() + '@example.test', password: 'synthetic', classId: cls.id, studentNo: 1 } });
  const cat = await db.category.create({ data: { name: randomUUID(), teachers: { connect: { id: user.id } }, classes: { connect: { id: cls.id } } } });
  const assignment = await db.classTeacherCourse.create({ data: { classId: cls.id, teacherId: user.id, categoryId: cat.id } });
  const guardian = await db.guardianStudent.create({ data: { guardianId: user.id, studentId: student.id } });
  const announcement = await db.announcement.create({ data: { title: 'Frozen', content: 'Original', createdBy: user.id } });
  const bank = await db.questionBank.create({ data: { teacherId: user.id, text: 'Original', type: 'short-answer', correctAnswer: 'Yes' } });
  const quiz = await db.quiz.create({ data: { title: 'Frozen', createdBy: user.id, assignedClasses: { connect: { id: cls.id } } } });
  const question = await db.question.create({ data: { quizId: quiz.id, text: 'Original', type: 'short-answer', order: 0 } });
  const result = await db.studentResult.create({ data: { quizId: quiz.id, studentId: student.id } });
  const submission = await db.surveySubmission.create({ data: { surveyId: quiz.id, studentId: student.id } });
  const answer = await db.surveyAnswer.create({ data: { submissionId: submission.id, questionId: question.id, value: 'Original' } });
  const year = await db.academicYear.create({ data: { label: '2025-2026', opensAt: new Date('2025-09-01'), scheduledCloseAt: new Date('2026-07-15') } });
  await db.academicTransitionRule.create({ data: { yearId: year.id, fromClassId: cls.id, graduate: true } });
  const job = await db.archiveSnapshot.create({ data: { mode: 'annual', academicYearId: year.id, label: year.label, scopeJson: '{}' } }); jobId = job.id;
  ids = { User: student.id, Class: cls.id, Category: cat.id, ClassTeacherCourse: assignment.id, GuardianStudent: guardian.id, Announcement: announcement.id, QuestionBank: bank.id, Quiz: quiz.id, Question: question.id, StudentResult: result.id, SurveySubmission: submission.id, SurveyAnswer: answer.id };
  await captureArchive(db, job.id);
});
afterEach(async () => { await db.$disconnect(); });

const updates: Record<string, string> = { User: 'name', Class: 'name', Category: 'name', ClassTeacherCourse: 'assignedAt', GuardianStudent: 'relation', Announcement: 'content', QuestionBank: 'text', Quiz: 'title', Question: 'text', StudentResult: 'answers', SurveySubmission: 'submittedAt', SurveyAnswer: 'value' };
it('rejects direct UPDATE and DELETE across every captured business table', async () => {
  for (const [table, id] of Object.entries(ids)) {
    await expect.soft(db.$executeRawUnsafe(`UPDATE "${table}" SET "${updates[table]}"=? WHERE id=?`, 'Changed', id), table + ' UPDATE').rejects.toThrow(/ANNUAL_CAPTURE_FROZEN|ARCHIVE_READ_ONLY/);
    await expect.soft(db.$executeRawUnsafe(`DELETE FROM "${table}" WHERE id=?`, id), table + ' DELETE').rejects.toThrow(/ANNUAL_CAPTURE_FROZEN|ARCHIVE_READ_ONLY/);
  }
});
it('rejects INSERT and all implicit join operations after capture', async () => {
  for (const table of Object.keys(ids)) {
    const columns = await db.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("${table}")`);
    const names = columns.map(c => `"${c.name}"`).join(',');
    const values = columns.map(c => c.name === 'id' ? "lower(hex(randomblob(16)))" : c.name === 'email' || (table === 'Category' && c.name === 'name') ? "lower(hex(randomblob(16)))" : `"${c.name}"`).join(',');
    await expect.soft(db.$executeRawUnsafe(`INSERT INTO "${table}" (${names}) SELECT ${values} FROM "${table}" LIMIT 1`), table + ' INSERT').rejects.toThrow(/ANNUAL_CAPTURE_FROZEN|ARCHIVE_READ_ONLY/);
  }
  for (const table of ['_ClassTeachers', '_TeacherCategories', '_ClassCategories', '_ClassQuizzes']) {
    for (const sql of [`UPDATE "${table}" SET A=A`, `INSERT OR IGNORE INTO "${table}" SELECT A,B FROM "${table}"`, `DELETE FROM "${table}"`]) await expect.soft(db.$executeRawUnsafe(sql), sql).rejects.toThrow(/ANNUAL_CAPTURE_FROZEN|ARCHIVE_READ_ONLY/);
  }
});
it('verified status and artifact metadata alone never authorize direct business writes, even with a live or expired lease', async () => {
  for (const expiry of [new Date(Date.now() + 180000), new Date(Date.now() - 1)]) {
    await db.archiveSnapshot.update({ where: { id: jobId }, data: { status: 'verified', artifactPath: '/synthetic/archive.zip', zipSha256: 'a'.repeat(64), sizeBytes: 100, leaseOwner: 'synthetic-owner', leaseExpiresAt: expiry } });
    await expect.soft(db.$executeRawUnsafe('UPDATE Quiz SET status=\'archived\',academicYear=\'2025-2026\' WHERE id=?', ids.Quiz)).rejects.toThrow(/ANNUAL_CAPTURE_FROZEN|ARCHIVE_READ_ONLY/);
    await expect.soft(db.$executeRawUnsafe('UPDATE StudentResult SET academicYear=\'2025-2026\' WHERE id=?', ids.StudentResult)).rejects.toThrow(/ANNUAL_CAPTURE_FROZEN|ARCHIVE_READ_ONLY/);
    await expect.soft(db.$executeRawUnsafe('UPDATE User SET classId=NULL,isActive=0 WHERE id=?', ids.User)).rejects.toThrow(/ANNUAL_CAPTURE_FROZEN|ARCHIVE_READ_ONLY/);
  }
});
it('a forbidden business mutation rolls back prior operational writes in the same transaction', async () => {
  await expect(db.$transaction(async tx => {
    await tx.user.update({ where: { id: actorId }, data: { password: 'Changed password' } });
    await tx.$executeRawUnsafe('UPDATE Class SET name=\'Changed\' WHERE id=?', ids.Class);
  })).rejects.toThrow(/ANNUAL_CAPTURE_FROZEN/);
  expect((await db.user.findUniqueOrThrow({ where: { id: actorId } })).password).toBe('synthetic');
});
it('cannot disable the fence through snapshot or academic-year lifecycle writes', async () => {
  const job = await db.archiveSnapshot.findUniqueOrThrow({ where: { id: jobId } });
  for (const change of ['capturedAt=NULL', "mode='manual'", "status='completed'"]) await expect.soft(db.$executeRawUnsafe(`UPDATE ArchiveSnapshot SET ${change} WHERE id=?`, jobId)).rejects.toThrow(/ANNUAL_CAPTURE_FROZEN|ARCHIVE_READ_ONLY/);
  await expect.soft(db.$executeRawUnsafe('DELETE FROM ArchiveSnapshot WHERE id=?', jobId)).rejects.toThrow(/ANNUAL_CAPTURE_FROZEN|ARCHIVE_READ_ONLY/);
  await expect.soft(db.$executeRawUnsafe("UPDATE AcademicYear SET status='closed' WHERE id=?", job.academicYearId)).rejects.toThrow(/ANNUAL_CAPTURE_FROZEN/);
  await expect.soft(db.$executeRawUnsafe("UPDATE AcademicYear SET label='other-year' WHERE id=?", job.academicYearId)).rejects.toThrow(/ANNUAL_CAPTURE_FROZEN/);
});
it('HTTP business matrix returns audited423 while operational DB and recovery routes continue', async () => {
  const app = express(); app.use(createAnnualCaptureGuard(db)); app.use((_req, res) => res.json({ allowed: true }));
  const routes = ['/api/auth/me', '/api/auth/register', '/api/users/id', '/api/classes/id', '/api/categories/id', '/api/teacher-assignments/id', '/api/guardians/id', '/api/announcements/id', '/api/question-bank/id', '/api/quizzes/id', '/api/surveys/id', '/api/results/id'];
  for (const route of routes) expect.soft((await request(app).patch(route)).status, route).toBe(423);
  expect(await db.actionLog.count({ where: { action: 'ARCHIVE_WRITE_DENIED' } })).toBe(routes.length);
  for (const route of ['/api/auth/login', '/api/auth/logout', '/api/auth/reset-password', '/api/notifications/preferences', '/api/admin/archive/jobs/id/retry']) expect((await request(app).post(route)).status).toBe(200);
  await db.user.update({ where: { id: actorId }, data: { password: 'reset', sessionVersion: { increment: 1 }, resetToken: 'synthetic-token', resetTokenExpiry: new Date(), notificationMuted: true } });
  await db.notification.create({ data: { userId: actorId, title: 'Operational', message: 'Background delivery' } });
  await db.emailQueue.create({ data: { to: 'synthetic@example.test', subject: 'Operational', body: 'Background delivery' } });
  await db.passwordResetRequest.create({ data: { userId: actorId, email: 'synthetic@example.test', tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 180000) } });
});
it('permit admission rejects expired leases and entities outside the verified capture', async () => {
  const grant = (entityId: string) => db.$executeRawUnsafe("INSERT INTO ArchiveFinalizationPermit VALUES (?,?, 'user',?, '{}','{}')", jobId, 'synthetic-owner', entityId);
  await db.archiveSnapshot.update({ where: { id: jobId }, data: { status: 'verified', artifactPath: '/synthetic/archive.zip', zipSha256: 'a'.repeat(64), sizeBytes: 100, leaseOwner: 'synthetic-owner', leaseExpiresAt: new Date(Date.now() - 1) } });
  await expect(grant(ids.User)).rejects.toThrow(/ARCHIVE_FINALIZATION_NOT_ALLOWED/);
  await db.archiveSnapshot.update({ where: { id: jobId }, data: { leaseExpiresAt: new Date(Date.now() + 180000) } });
  await expect(grant(randomUUID())).rejects.toThrow(/ARCHIVE_FINALIZATION_NOT_ALLOWED/);
  await expect(grant(actorId)).rejects.toThrow(/ARCHIVE_FINALIZATION_NOT_ALLOWED/);
});
it('rule repair remains usable for a dormant failed annual job and freezes again under a live lease', async () => {
  const job = await db.archiveSnapshot.findUniqueOrThrow({ where: { id: jobId } });
  await db.archiveSnapshot.update({ where: { id: jobId }, data: { status: 'failed', leaseOwner: null, leaseExpiresAt: null } });
  await db.academicTransitionRule.deleteMany({ where: { yearId: job.academicYearId } });
  const rule = await db.academicTransitionRule.create({ data: { yearId: job.academicYearId, fromClassId: ids.Class, graduate: true } });
  await db.academicTransitionRule.update({ where: { id: rule.id }, data: { graduate: false, toClassId: ids.Class } });
  await db.archiveSnapshot.update({ where: { id: jobId }, data: { status: 'retry_wait', leaseOwner: 'repair-worker', leaseExpiresAt: new Date(Date.now() + 180000) } });
  await expect(db.$executeRawUnsafe('UPDATE AcademicTransitionRule SET graduate=1 WHERE id=?', rule.id)).rejects.toThrow(/ANNUAL_CAPTURE_FROZEN/);
  await expect(db.$executeRawUnsafe('DELETE FROM AcademicTransitionRule WHERE id=?', rule.id)).rejects.toThrow(/ANNUAL_CAPTURE_FROZEN/);
});
it('cannot append snapshot rows after capture even when status is reset', async () => {
  await db.archiveSnapshot.update({ where: { id: jobId }, data: { status: 'capturing' } });
  await expect(db.$executeRawUnsafe("INSERT INTO ArchiveSnapshotRow(id,snapshotId,entityType,entityId,dataJson) VALUES (?,?, 'user',?,'{}')", randomUUID(), jobId, randomUUID())).rejects.toThrow(/ARCHIVE_READ_ONLY/);
});
