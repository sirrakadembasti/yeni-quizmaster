import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const require = createRequire(import.meta.url);
const repo = resolve(import.meta.dirname, '../..');
const root = mkdtempSync(join(repo, 'server/data/quizmaster-test-teacher-audit-'));
for (const dir of ['server/data', 'server/uploads', 'client']) mkdirSync(join(root, dir), { recursive: true });
for (const dir of ['server', 'client']) writeFileSync(join(root, dir, 'package.json'), '{}');
const database = join(root, 'server/data/audit.db');
writeFileSync(database, '');
process.env.DATABASE_URL = 'file:' + database.replaceAll('\\', '/');
process.env.SESSION_SECRET = 'isolated-teacher-audit-only-secret';
process.env.PORT = '5530'; process.env.HOST = '127.0.0.1';
process.env.FRONTEND_URL = 'http://127.0.0.1:5531';
process.env.ALLOWED_ORIGINS = 'http://127.0.0.1:5531';
process.env.NODE_ENV = 'development';
for (const key of ['EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM', 'GEMINI_API_KEY', 'OPENAI_API_KEY',
  'APP_BASE_PATH', 'FORCE_SECURE_COOKIES', 'DEPLOYMENT_CONFIG_PATH']) delete process.env[key];
execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy',
  '--schema', join(repo, 'server/prisma/schema.prisma')], { env: process.env, stdio: 'pipe' });
const p = new PrismaClient();
const password = await bcrypt.hash('TeacherAuditOnly2026!', 10);
await p.user.createMany({ data: [
  { id: 'teacher-audit-admin', name: 'Teacher Audit Admin', email: 'teacher-audit-admin@example.test', password, role: 'admin' },
  { id: 'teacher-audit-teacher', name: 'Teacher Audit Teacher', email: 'teacher-audit@example.test', password, role: 'teacher' },
  { id: 'teacher-audit-other', name: 'Private Other Teacher', email: 'teacher-audit-other@example.test', password, role: 'teacher' },
] });
await p.category.create({ data: { id: '33333333-3333-4333-8333-333333333333', name: 'Teacher Audit Mathematics' } });
await p.category.create({ data: { id: '44444444-4444-4444-8444-444444444444', name: 'Private Other Course' } });
for (const [id, name, teacher, category] of [
  ['11111111-1111-4111-8111-111111111111', 'Teacher Audit 7A', 'teacher-audit-teacher', '33333333-3333-4333-8333-333333333333'],
  ['22222222-2222-4222-8222-222222222222', 'Private Other 7B', 'teacher-audit-other', '44444444-4444-4444-8444-444444444444'],
]) await p.class.create({ data: { id, name, classTeacher: { connect: { id: teacher } },
  teachers: { connect: { id: teacher } }, assignedCategories: { connect: { id: category } } } });
for (let i = 0; i < 14; i++) await p.user.create({ data: {
  id: i === 0 ? 'teacher-audit-student' : `teacher-audit-student-${i}`, name: `Teacher Audit Student ${String(i).padStart(2, '0')}`,
  email: `teacher-audit-student-${i}@example.test`, password, role: 'student', classId: '11111111-1111-4111-8111-111111111111', studentNo: i + 1,
} });
await p.user.create({ data: { id: 'teacher-audit-other-student', name: 'Private Other Student',
  email: 'teacher-audit-other-student@example.test', password, role: 'student', classId: '22222222-2222-4222-8222-222222222222', studentNo: 1 } });
const content = [
  ['teacher-audit-exam', 'Teacher Audit Exam', 'exam', 'published', 'teacher-audit-teacher'],
  ['teacher-audit-draft', 'Teacher Audit Draft', 'exam', 'draft', 'teacher-audit-teacher'],
  ['55555555-5555-4555-8555-555555555555', 'Teacher Audit Survey', 'survey', 'published', 'teacher-audit-teacher'],
  ['teacher-audit-material', 'Teacher Audit Material', 'material', 'published', 'teacher-audit-teacher'],
  ['teacher-audit-other-exam', 'Private Other Exam', 'exam', 'published', 'teacher-audit-other'],
  ...Array.from({ length: 12 }, (_, i) => [`teacher-audit-exam-${i}`, `Teacher Audit Exam ${String(i).padStart(2, '0')}`, 'exam', 'published', 'teacher-audit-teacher']),
];
for (const [id, title, type, status, creator] of content) {
  const other = creator === 'teacher-audit-other';
  await p.quiz.create({ data: { id, title, contentType: type, status, createdBy: creator,
    categoryId: other ? '44444444-4444-4444-8444-444444444444' : '33333333-3333-4333-8333-333333333333',
    assignedClasses: { connect: { id: other ? '22222222-2222-4222-8222-222222222222' : '11111111-1111-4111-8111-111111111111' } },
    ...(type === 'material' ? {} : { questions: { create: { id: `${id}-q`, text: 'Teacher audit question?',
      type: type === 'survey' ? 'open-text' : 'multiple-choice', options: type === 'survey' ? null : JSON.stringify(['A', 'B', 'C', 'D']),
      correctAnswer: type === 'survey' ? null : 'A', order: 0 } } }),
  } });
}
for (let i = 0; i < 14; i++) await p.studentResult.create({ data: {
  id: i === 0 ? 'teacher-audit-result' : `teacher-audit-result-${i}`,
  studentId: i === 0 ? 'teacher-audit-student' : `teacher-audit-student-${i}`, quizId: 'teacher-audit-exam', status: 'completed',
  score: i === 0 ? 0 : 100, totalQuestions: 1, correctAnswersCount: i === 0 ? 0 : 1,
  completedAt: new Date(), submittedAt: new Date(), answers: JSON.stringify({ 'teacher-audit-exam-q': i === 0 ? 'B' : 'A' }),
} });
await p.studentResult.create({ data: { id: 'teacher-audit-private-result', studentId: 'teacher-audit-other-student',
  quizId: 'teacher-audit-other-exam', status: 'completed', score: 100, totalQuestions: 1, correctAnswersCount: 1,
  completedAt: new Date(), submittedAt: new Date(), answers: '{}' } });
await p.surveySubmission.create({ data: { surveyId: '55555555-5555-4555-8555-555555555555', studentId: 'teacher-audit-student',
  answers: { create: { questionId: '55555555-5555-4555-8555-555555555555-q', value: 'Teacher audit response' } } } });
await p.announcement.create({ data: { id: 'teacher-audit-announcement', title: 'Teacher Audit Announcement',
  content: 'Isolated teacher audit content', createdBy: 'teacher-audit-admin', targetRole: 'all' } });
await p.notification.createMany({ data: Array.from({ length: 26 }, (_, i) => ({ userId: 'teacher-audit-teacher',
  title: `Teacher Audit Notification ${String(i).padStart(2, '0')}`, message: 'Isolated notification', isRead: i % 2 === 0 })) });
await p.notification.create({ data: { userId: 'teacher-audit-other', title: 'Private Other Notification', message: 'Private isolated notification' } });
await p.actionLog.createMany({ data: Array.from({ length: 55 }, (_, i) => ({ userId: 'teacher-audit-teacher',
  action: i % 2 ? 'LOGIN' : 'CREATE_QUIZ', details: `Teacher audit action ${String(i).padStart(2, '0')}` })) });
await p.actionLog.create({ data: { userId: 'teacher-audit-other', action: 'LOGIN', details: 'Private other action' } });
await p.questionBank.create({ data: { teacherId: 'teacher-audit-teacher', categoryId: '33333333-3333-4333-8333-333333333333',
  text: 'Teacher Audit Bank Question?', type: 'multiple-choice', options: JSON.stringify(['A', 'B', 'C', 'D']), correctAnswer: 'A' } });
await p.$disconnect();
mkdirSync(join(repo, 'docs/teacher-audit'), { recursive: true });
writeFileSync(join(repo, 'docs/teacher-audit/runtime.json'), JSON.stringify({ root, database, ports: [5530, 5531] }, null, 2));
process.chdir(root);
console.log('ISOLATED TEACHER AUDIT ROOT ' + root);
await import('../index');
