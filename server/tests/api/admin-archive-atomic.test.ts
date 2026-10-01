import { beforeAll, afterAll, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import adminRouter from '../../api-routes/admin';
import { storage, closeStorage } from '../../storage';

const db = new PrismaClient();
let actor: any, student: any;
const app = express();
app.use(express.json());
app.use((req: any, _res, next) => { req.session = { userId: actor.id, sessionVersion: 0 }; next(); });
app.use('/admin', adminRouter);
beforeAll(async () => {
  actor = await storage.createUser({ name: 'Archive admin', email: randomUUID()+'@example.test', password: 'isolated-hash', role: 'admin' });
  student = await storage.createUser({ name: 'Archive student', email: randomUUID()+'@example.test', password: 'isolated-hash', role: 'student' });
});
afterAll(async () => { await db.$disconnect(); await closeStorage(); });
async function fixture() {
  const quiz = await db.quiz.create({ data: { title: 'Archive fixture', createdBy: actor.id, status: 'published' } });
  const result = await db.studentResult.create({ data: { quizId: quiz.id, studentId: student.id, status: 'completed', score: 100 } });
  return { quiz, result };
}

it('preview counts exactly the eligible archive candidates', async () => {
  await fixture();
  await db.quiz.create({ data: { title: 'Already archived preview', createdBy: actor.id, status: 'archived' } });
  const response = await request(app).get('/admin/archive/preview');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    quizzes: await db.quiz.count({ where: { academicYear: null, status: { not: 'archived' } } }),
    results: await db.studentResult.count({ where: { academicYear: null } }),
  });
});

it('invalid promotion items are rejected before changing enrollment', async () => {
  const cls = await db.class.create({ data: { name: 'Promotion validation '+randomUUID() } });
  await db.user.update({ where: { id: student.id }, data: { classId: cls.id } });
  for (const promotions of [[{ toClassId: null }], [{ fromClassId: cls.id }], [{ fromClassId: 'invalid', toClassId: null }]]) {
    const response = await request(app).post('/admin/promote-students').send({ promotions });
    expect(response.status).toBe(400);
    expect((await db.user.findUniqueOrThrow({ where: { id: student.id } })).classId).toBe(cls.id);
  }
});

it('quiz deletion and its audit log roll back together on a log failure', async () => {
  const { quiz, result } = await fixture();
  const question = await db.question.create({ data: { quizId: quiz.id, text: 'Preserve question', type: 'short-answer', order: 0 } });
  await db.$executeRawUnsafe("CREATE TRIGGER delete_audit_failure BEFORE INSERT ON ActionLog WHEN NEW.action = 'DELETE_QUIZ' BEGIN SELECT RAISE(ABORT, 'Injected delete audit failure'); END");
  try {
    await expect(storage.deleteQuizWithAudit(quiz.id, actor.id, 'Duplicate exam')).rejects.toThrow();
    expect(await db.quiz.findUnique({ where: { id: quiz.id } })).not.toBeNull();
    expect(await db.question.findUnique({ where: { id: question.id } })).not.toBeNull();
    expect(await db.studentResult.findUnique({ where: { id: result.id } })).not.toBeNull();
  } finally { await db.$executeRawUnsafe('DROP TRIGGER delete_audit_failure'); }
  await storage.deleteQuizWithAudit(quiz.id, actor.id, 'Duplicate exam');
  expect(await db.quiz.findUnique({ where: { id: quiz.id } })).toBeNull();
  const log = await db.actionLog.findFirstOrThrow({ where: { userId: actor.id, action: 'DELETE_QUIZ' }, orderBy: { createdAt: 'desc' } });
  expect(JSON.parse(log.details!)).toMatchObject({ quizId: quiz.id, title: quiz.title, reason: 'Duplicate exam', questions: 1, results: 1 });
});

it('rolls quizzes and results back if result archiving fails', async () => {
  const { quiz, result } = await fixture();
  await db.$executeRawUnsafe("CREATE TRIGGER archive_result_failure BEFORE UPDATE ON StudentResult WHEN NEW.academicYear = '2030-2031' BEGIN SELECT RAISE(ABORT, 'Injected archive result failure'); END");
  try {
    const response = await request(app).post('/admin/archive').send({ academicYear: '2030-2031' });
    expect(response.status).toBe(500);
    expect(await db.quiz.findUnique({ where: { id: quiz.id } })).toMatchObject({ status: 'published', academicYear: null });
    expect(await db.studentResult.findUnique({ where: { id: result.id } })).toMatchObject({ academicYear: null });
    expect(await db.actionLog.count({ where: { userId: actor.id, action: 'ARCHIVE_YEAR' } })).toBe(0);
  } finally { await db.$executeRawUnsafe('DROP TRIGGER archive_result_failure'); }
});

it('rolls data back if the archive audit log fails', async () => {
  const { quiz, result } = await fixture();
  await db.$executeRawUnsafe("CREATE TRIGGER archive_log_failure BEFORE INSERT ON ActionLog WHEN NEW.action = 'ARCHIVE_YEAR' BEGIN SELECT RAISE(ABORT, 'Injected archive log failure'); END");
  try {
    expect((await request(app).post('/admin/archive').send({ academicYear: '2031-2032' })).status).toBe(500);
    expect(await db.quiz.findUnique({ where: { id: quiz.id } })).toMatchObject({ status: 'published', academicYear: null });
    expect(await db.studentResult.findUnique({ where: { id: result.id } })).toMatchObject({ academicYear: null });
  } finally { await db.$executeRawUnsafe('DROP TRIGGER archive_log_failure'); }
});

it('archives eligible data once and leaves historical or already archived quizzes unchanged', async () => {
  const { quiz, result } = await fixture();
  const archived = await db.quiz.create({ data: { title: 'Already archived', status: 'archived', createdBy: actor.id } });
  const historical = await db.quiz.create({ data: { title: 'Historical', status: 'published', academicYear: '2028-2029', createdBy: actor.id } });
  const eligible = await db.quiz.count({ where: { academicYear: null, status: { not: 'archived' } } });
  const response = await request(app).post('/admin/archive').send({ academicYear: '2032-2033' });
  expect(response.status).toBe(200);
  expect(response.body.quizzesArchived).toBe(eligible);
  expect(await db.quiz.findUnique({ where: { id: quiz.id } })).toMatchObject({ status: 'archived', academicYear: '2032-2033' });
  expect(await db.studentResult.findUnique({ where: { id: result.id } })).toMatchObject({ academicYear: '2032-2033' });
  expect((await db.quiz.findUnique({ where: { id: archived.id } }))?.academicYear).toBeNull();
  expect((await db.quiz.findUnique({ where: { id: historical.id } }))?.academicYear).toBe('2028-2029');
  const retry = await request(app).post('/admin/archive').send({ academicYear: '2032-2033' });
  expect(retry.status).toBe(200);
  expect(retry.body).toMatchObject({ quizzesArchived: 0, resultsArchived: 0 });
});
