import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import quizRouter from '../../api-routes/quiz';
import surveyRouter from '../../api-routes/survey';
import { storage, closeStorage } from '../../storage';

const db = new PrismaClient();
let actor: any;
let admin: any;
let teacher: any;
let student: any;
const app = express();
app.use(express.json());
app.use((req: any, _res, next) => { req.session = { userId: actor.id, sessionVersion: 0 }; next(); });
app.use('/quizzes', quizRouter);
app.use('/surveys', surveyRouter);
const payload = (extra = {}) => ({ title: 'Atomic content', description: null, timeLimit: null,
  status: 'published', assignedClassIds: [], questions: [{ text: 'Choose A', type: 'multiple-choice', options: ['A', 'B'], correctAnswer: 'A', order: 1 }], ...extra });
beforeAll(async () => {
  admin = await storage.createUser({ name: 'Content admin', email: randomUUID()+'@example.com', password: 'hash', role: 'admin' });
  teacher = await storage.createUser({ name: 'Content teacher', email: randomUUID()+'@example.com', password: 'hash', role: 'teacher' });
  student = await storage.createUser({ name: 'Content student', email: randomUUID()+'@example.com', password: 'hash', role: 'student' });
  actor = admin;
});
afterAll(async () => { await db.$disconnect(); await closeStorage(); });
describe('Atomic content API using disposable Prisma database', () => {
  it('counts only active assigned students in the publication audience', async () => {
    actor = admin;
    const classroom = await db.class.create({ data: { name: 'Audience class' } });
    await db.user.create({ data: { name: 'Active audience', email: randomUUID() + '@example.com', password: 'hash', role: 'student', classId: classroom.id, isActive: true } });
    await db.user.create({ data: { name: 'Inactive audience', email: randomUUID() + '@example.com', password: 'hash', role: 'student', classId: classroom.id, isActive: false } });
    const response = await request(app).put(`/quizzes/${randomUUID()}/content`).send(payload({ assignedClassIds: [classroom.id] }));
    expect(response.status).toBe(200);
    expect(response.body.quiz.audienceSize).toBe(1);
  });
  it('saves and retries the same UUID without duplicating content', async () => {
    actor = admin;
    const id = randomUUID();
    const first = await request(app).put(`/quizzes/${id}/content`).send(payload());
    expect(first.status).toBe(200);
    const retry = await request(app).put(`/quizzes/${id}/content`).send(payload());
    expect(retry.status).toBe(200);
    expect(await db.quiz.count({ where: { id } })).toBe(1);
    expect(await db.question.count({ where: { quizId: id } })).toBe(1);
    expect(retry.body.quiz.status).toBe('published');
  });
  it('rolls metadata and creation back when a foreign question ID is sent', async () => {
    actor = admin;
    const foreign = await storage.createQuiz({ title: 'Foreign', createdBy: admin.id });
    const q = await storage.createQuestion({ quizId: foreign.id, type: 'multiple-choice', text: 'Foreign question', options: ['A','B'], correctAnswer: 'A', order: 1 });
    const id = randomUUID();
    const invalid = payload({ questions: [{ id: q.id, text: 'Changed', options: ['A','B'], correctAnswer: 'A' }] });
    expect((await request(app).put(`/quizzes/${id}/content`).send(invalid)).status).toBe(400);
    expect(await storage.getQuiz(id)).toBeUndefined();
    await request(app).put(`/quizzes/${id}/content`).send(payload());
    expect((await request(app).put(`/quizzes/${id}/content`).send({ ...invalid, title: 'Must rollback' })).status).toBe(400);
    expect((await storage.getQuiz(id))?.title).toBe('Atomic content');
  });
  it('rejects question changes after participation and rolls metadata back', async () => {
    actor = admin;
    const id = randomUUID();
    const saved = await request(app).put(`/quizzes/${id}/content`).send(payload());
    expect(saved.status).toBe(200);
    await db.studentResult.create({ data: { quizId: id, studentId: student.id } });
    const changed = payload({ title: 'Must rollback', questions: [{ ...payload().questions[0], id: saved.body.questions[0].id, text: 'Changed' }] });
    expect((await request(app).put(`/quizzes/${id}/content`).send(changed)).status).toBe(409);
    expect((await storage.getQuiz(id))?.title).toBe('Atomic content');
  });
  it('enforces ownership and teacher class assignment', async () => {
    actor = admin;
    const id = randomUUID();
    expect((await request(app).put(`/quizzes/${id}/content`).send(payload())).status).toBe(200);
    actor = teacher;
    expect((await request(app).put(`/quizzes/${id}/content`).send(payload())).status).toBe(403);
    expect((await request(app).put(`/quizzes/${randomUUID()}/content`).send(payload({ assignedClassIds: [randomUUID()] }))).status).toBe(403);
  });
  it('validates exam answers and preserves open text survey questions', async () => {
    actor = admin;
    const id = randomUUID();
    expect((await request(app).put(`/quizzes/${id}/content`).send(payload({ questions: [{ ...payload().questions[0], correctAnswer: 'C' }] }))).status).toBe(400);
    expect((await request(app).put(`/quizzes/${id}/content`).send(payload({ questions: [] }))).status).toBe(400);
    const survey = await request(app).put(`/surveys/${id}/content`).send(payload({ questions: [{ text: 'Tell us', type: 'open-text', options: [], order: 1 }] }));
    expect(survey.status).toBe(200);
    expect(survey.body.questions[0].type).toBe('open-text');
    expect(survey.body.questions[0].correctAnswer).toBeNull();
  });
  it('rejects duplicate selectable options without saving content', async () => {
    actor = admin;
    const id = randomUUID();
    const response = await request(app).put(`/quizzes/${id}/content`).send(payload({ questions: [{ ...payload().questions[0], options: ['A', 'A'] }] }));
    expect(response.status).toBe(400);
    expect(await storage.getQuiz(id)).toBeUndefined();
  });
  it('clears metadata and keeps unchanged question IDs on response-lost retry after participation', async () => {
    actor = admin;
    const id = randomUUID();
    const first = await request(app).put(`/quizzes/${id}/content`).send(payload({ description: 'Before', timeLimit: 10 }));
    expect(first.status).toBe(200);
    await db.studentResult.create({ data: { quizId: id, studentId: student.id } });
    const retry = await request(app).put(`/quizzes/${id}/content`).send(payload());
    expect(retry.status).toBe(200);
    expect(retry.body.questions[0].id).toBe(first.body.questions[0].id);
    expect(retry.body.quiz.description).toBeNull();
    expect(retry.body.quiz.timeLimit).toBeNull();
  });
  it('does not report committed content as failed when publication notifications fail', async () => {
    actor = teacher;
    const notification = vi.spyOn(storage, 'createNotification').mockRejectedValueOnce(new Error('Injected delivery failure'));
    try {
      const id = randomUUID();
      const response = await request(app).put(`/quizzes/${id}/content`).send(payload());
      expect(response.status).toBe(200);
      expect((await storage.getQuiz(id))?.status).toBe('published');
    } finally { notification.mockRestore(); }
  });
  it('preserves existing legacy content and question IDs while requiring UUID for creation', async () => {
    actor = admin;
    const id = 'legacy-content-' + Date.now();
    await db.quiz.create({ data: { id, title: 'Legacy content', createdBy: admin.id } });
    await db.question.create({ data: { id: 'legacy-question', quizId: id, text: 'Choose A', type: 'multiple-choice', options: '["A","B"]', correctAnswer: 'A', order: 1 } });
    const response = await request(app).put(`/quizzes/${id}/content`).send(payload({ questions: [{ ...payload().questions[0], id: 'legacy-question' }] }));
    expect(response.status).toBe(200);
    expect(response.body.questions[0].id).toBe('legacy-question');
    expect((await request(app).put('/quizzes/not-a-uuid/content').send(payload())).status).toBe(400);
  });
  it('rolls settings and question replacement back after an injected database write failure', async () => {
    actor = admin;
    const id = randomUUID();
    const first = await request(app).put(`/quizzes/${id}/content`).send(payload());
    expect(first.status).toBe(200);
    await db.$executeRawUnsafe(`CREATE TRIGGER content_save_failure BEFORE INSERT ON Question WHEN NEW.text = 'Injected failure' BEGIN SELECT RAISE(ABORT, 'Injected question write failure'); END`);
    try {
      const response = await request(app).put(`/quizzes/${id}/content`).send(payload({ title: 'Must rollback', questions: [{ ...payload().questions[0], text: 'Injected failure' }] }));
      expect(response.status).toBe(500);
      expect((await storage.getQuiz(id))?.title).toBe('Atomic content');
      expect((await storage.getQuestionsByQuiz(id))[0].id).toBe(first.body.questions[0].id);
      expect((await storage.getQuestionsByQuiz(id))[0].text).toBe('Choose A');
      const newId = randomUUID();
      expect((await request(app).put(`/quizzes/${newId}/content`).send(payload({ questions: [{ ...payload().questions[0], text: 'Injected failure' }] }))).status).toBe(500);
      expect(await storage.getQuiz(newId)).toBeUndefined();
    } finally { await db.$executeRawUnsafe('DROP TRIGGER content_save_failure'); }
  });
});
