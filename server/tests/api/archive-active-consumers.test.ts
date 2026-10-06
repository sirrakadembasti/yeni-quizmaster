import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import request from 'supertest';

const auth = vi.hoisted(() => ({ user: {} as any }));
vi.mock('../../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.user = auth.user; next(); },
  requireRole: (roles: string[]) => (req: any, res: any, next: any) => roles.includes(req.user.role) ? next() : res.sendStatus(403),
}));
const templateUrl = process.env.DATABASE_URL ?? '';
if (!templateUrl.startsWith('file:') || !path.basename(path.dirname(templateUrl.slice(5))).startsWith('quizmaster-test-')) throw new Error('Disposable active-consumer datasource required');
let db: PrismaClient, storage: typeof import('../../storage').storage, closeStorage: () => Promise<void>, closeArchiveDb: () => Promise<void>, app: express.Express;
let admin: any, teacher: any, student: any, parent: any, classroom: any, exam: any, survey: any, archivedExam: any, activeResult: any, archivedResult: any;
beforeAll(async () => {
  const file = path.join(path.dirname(templateUrl.slice(5)), 'active-consumers-' + randomUUID() + '.db');
  await copyFile(templateUrl.slice(5), file);
  const url = 'file:' + file.split('\\').join('/');
  db = new PrismaClient({ datasources: { db: { url } } });
  vi.resetModules(); vi.stubEnv('DATABASE_URL', url);
  ({ storage, closeStorage } = await import('../../storage'));
  ({ closeArchiveDb } = await import('../../services/archive-db'));
  const account = (role: string, extra: any = {}) => db.user.create({ data: { name: 'Synthetic ' + role, email: randomUUID() + '@example.test', password: 'synthetic', role, ...extra } });
  admin = await account('admin'); teacher = await account('teacher'); parent = await account('parent');
  classroom = await db.class.create({ data: { name: 'Synthetic class', teachers: { connect: { id: teacher.id } } } });
  student = await account('student', { classId: classroom.id, studentNo: 1 });
  await db.guardianStudent.create({ data: { guardianId: parent.id, studentId: student.id, relation: 'Diğer' } });
  const content = (title: string, contentType = 'exam') => db.quiz.create({ data: { title, contentType, status: 'published', createdBy: teacher.id, assignedClasses: { connect: { id: classroom.id } } } });
  exam = await content('Current exam'); survey = await content('Current survey', 'survey');
  archivedExam = await content('Closed exam'); const archivedSurvey = await content('Closed survey', 'survey');
  const legacy = await content('Year-marked published exam');
  const result = (quizId: string, score: number) => db.studentResult.create({ data: { studentId: student.id, quizId, status: 'completed', score, submittedAt: new Date(), answers: '{}' } });
  activeResult = await result(exam.id, 50); archivedResult = await result(archivedExam.id, 100); await result(legacy.id, 100);
  const legacyStudent = await account('student', { classId: classroom.id, studentNo: 2, isActive: false });
  await db.studentResult.create({ data: { studentId: legacyStudent.id, quizId: exam.id, status: 'completed', score: 100, submittedAt: new Date(), academicYear: '2024-2025' } });
  await db.surveySubmission.create({ data: { surveyId: survey.id, studentId: student.id } });
  await db.surveySubmission.create({ data: { surveyId: archivedSurvey.id, studentId: student.id } });
  await db.quiz.updateMany({ where: { id: { in: [archivedExam.id, archivedSurvey.id] } }, data: { status: 'archived', academicYear: '2024-2025' } });
  await db.quiz.update({ where: { id: legacy.id }, data: { academicYear: '2024-2025' } });
  const [quizzes, surveys, students, parents, results, dashboard] = await Promise.all([
    import('../../api-routes/quiz'), import('../../api-routes/survey'), import('../../api-routes/student'), import('../../api-routes/parent'), import('../../api-routes/result'), import('../../api-routes/dashboard'),
  ]);
  app = express(); app.use(express.json());
  app.use('/quizzes', quizzes.default); app.use('/surveys', surveys.default); app.use('/student', students.default); app.use('/parent', parents.default); app.use('/results', results.default); app.use('/dashboard', dashboard.default);
});
afterAll(async () => {
  try { await Promise.all([db.$disconnect(), closeStorage?.(), closeArchiveDb?.()]); } finally { vi.unstubAllEnvs(); }
});

it.each(['admin', 'teacher'])('keeps closed exams, surveys and results out of the %s active lists and statistics', async role => {
  auth.user = role === 'admin' ? admin : teacher;
  const exams = await request(app).get('/quizzes/admin/quizzes');
  expect(exams.status).toBe(200); expect(exams.body.quizzes.map((item: any) => item.id)).toEqual([exam.id]);
  expect(exams.body.quizzes[0].participantCount).toBe(1);
  const surveys = await request(app).get('/surveys');
  expect(surveys.status).toBe(200); expect(surveys.body.surveys.map((item: any) => item.id)).toEqual([survey.id]);
  const results = await request(app).get('/results');
  expect(results.status).toBe(200); expect(results.body.results.map((item: any) => item.id)).toEqual([activeResult.id]);
  const stats = await request(app).get('/dashboard/stats');
  expect(stats.status).toBe(200); expect(stats.body.stats).toMatchObject({ totalQuizzes: 2, totalResults: 1, averageStudentScore: 50 });
  const overview = await request(app).get('/dashboard/overview');
  expect(overview.status).toBe(200); expect(overview.body.recentQuizzes.map((item: any) => item.id)).toEqual([exam.id]);
  expect(overview.body.recentQuizzes[0].participants).toBe(1);
});

it('student and linked parent active views omit closed results without deleting authorized archived detail', async () => {
  auth.user = student;
  const quizzes = await request(app).get('/student/quizzes');
  expect(quizzes.status).toBe(200); expect(quizzes.body.quizzes.map((item: any) => item.id)).toEqual([exam.id]);
  const results = await request(app).get('/student/results');
  expect(results.status).toBe(200); expect(results.body.results.map((item: any) => item.id)).toEqual([activeResult.id]);
  auth.user = parent;
  const overview = await request(app).get(`/parent/students/${student.id}/overview`);
  expect(overview.status).toBe(200); expect(overview.body.results.map((item: any) => item.id)).toEqual([activeResult.id]);
  expect(overview.body.quizzes.map((item: any) => item.id)).toEqual([exam.id]);
  const detail = await request(app).get(`/parent/results/${archivedResult.id}`);
  expect(detail.status).toBe(200); expect(detail.body.result.id).toBe(archivedResult.id);
  auth.user = teacher;
  const archivedExport = await request(app).get(`/results/quiz/${archivedExam.id}/export`);
  expect(archivedExport.status).toBe(200); expect(archivedExport.text).toContain('100');
});

it('class analytics counts current exam scores and retains the closed records physically', async () => {
  expect(await storage.getClassAnalytics([classroom.id], new Date('2000-01-01'), new Date('2100-01-01'))).toEqual([expect.objectContaining({ completedCount: 1, participantCount: 1, averageScore: 50 })]);
  expect(await db.quiz.count()).toBe(5); expect(await db.studentResult.count()).toBe(4);
  expect(await db.surveySubmission.count()).toBe(2);
});

it.each(['admin', 'teacher'])('excludes a year-marked child of an active quiz from the %s dashboard while preserving specific result access', async role => {
  auth.user = role === 'admin' ? admin : teacher;
  const stats = await request(app).get('/dashboard/stats');
  expect(stats.status).toBe(200); expect(stats.body.stats).toMatchObject({ totalResults: 1, averageStudentScore: 50 });
  const overview = await request(app).get('/dashboard/overview');
  expect(overview.status).toBe(200);
  expect(overview.body.recentQuizzes[0]).toMatchObject({ id: exam.id, participants: 1 });
  expect((await storage.getResultsByQuiz(exam.id)).map(item => item.score)).toEqual([100, 50]);
});
