import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { archiveContentGuard } from '../../middleware/archive-readonly';
import { closeArchiveDb } from '../../services/archive-db';

const db = new PrismaClient();
let actorId: string, quizId: string, questionId: string, resultId: string;
beforeAll(async () => {
  actorId = randomUUID(); quizId = randomUUID(); questionId = randomUUID(); resultId = randomUUID();
  await db.user.create({ data: { id: actorId, name: 'Archive guard actor', email: actorId+'@example.test', password: 'isolated', role: 'admin' } });
  await db.quiz.create({ data: { id: quizId, title: 'Frozen content', createdBy: actorId, status: 'published' } });
  await db.question.create({ data: { id: questionId, quizId, text: 'Original', type: 'short-answer', order: 0 } });
  await db.studentResult.create({ data: { id: resultId, quizId, studentId: actorId, status: 'completed', score: 75 } });
  await db.quiz.update({ where: { id: quizId }, data: { status: 'archived', academicYear: '2025-2026' } });
});
afterAll(async () => { await db.$disconnect(); await closeArchiveDb(); });

it('blocks archived metadata, status, delete and dependent writes at SQLite boundary', async () => {
  for (const operation of [
    () => db.quiz.update({ where: { id: quizId }, data: { title: 'Changed' } }),
    () => db.quiz.update({ where: { id: quizId }, data: { status: 'published' } }),
    () => db.quiz.delete({ where: { id: quizId } }),
    () => db.question.update({ where: { id: questionId }, data: { text: 'Changed' } }),
    () => db.question.delete({ where: { id: questionId } }),
    () => db.question.create({ data: { quizId, text: 'Added', type: 'short-answer', order: 1 } }),
    () => db.studentResult.update({ where: { id: resultId }, data: { score: 100 } }),
    () => db.studentResult.delete({ where: { id: resultId } }),
    () => db.user.delete({ where: { id: actorId } }),
  ]) await expect(operation()).rejects.toThrow();
  expect((await db.quiz.findUniqueOrThrow({ where: { id: quizId } })).title).toBe('Frozen content');
  expect((await db.studentResult.findUniqueOrThrow({ where: { id: resultId } })).score).toBe(75);
});

it('rejects archived API writes with403 and records the denial', async () => {
  const app = express();
  app.use((req: any, _res, next) => { req.user = { id: actorId, role: 'admin' }; next(); });
  app.patch('/:id', archiveContentGuard, (_req, res) => res.json({ incorrectlyAllowed: true }));
  expect((await request(app).patch('/'+quizId)).status).toBe(403);
  expect(await db.actionLog.count({ where: { userId: actorId, action: 'ARCHIVE_WRITE_DENIED' } })).toBe(1);
});

it('does not block ordinary active content edits', async () => {
  const quiz = await db.quiz.create({ data: { title: 'Active', createdBy: actorId } });
  expect((await db.quiz.update({ where: { id: quiz.id }, data: { title: 'Active changed' } })).title).toBe('Active changed');
});

it('blocks moving an active result into an archived quiz', async () => {
  const active = await db.quiz.create({ data: { title: 'Active result parent', createdBy: actorId } });
  const result = await db.studentResult.create({ data: { quizId: active.id, studentId: actorId } });
  await expect(db.studentResult.update({ where: { id: result.id }, data: { quizId } })).rejects.toThrow();
});
