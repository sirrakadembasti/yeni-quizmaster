import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const require = createRequire(import.meta.url), repo = resolve(import.meta.dirname, '../..');
const root = mkdtempSync(join(repo, 'server/data/quizmaster-test-student-audit-'));
for (const dir of ['server/data', 'server/uploads', 'client']) mkdirSync(join(root, dir), { recursive: true });
for (const dir of ['server', 'client']) writeFileSync(join(root, dir, 'package.json'), '{}');
const database = join(root, 'server/data/audit.db');
writeFileSync(database, '');
Object.assign(process.env, { DATABASE_URL: 'file:' + database.replaceAll('\\', '/'), SESSION_SECRET: 'isolated-student-audit-only-secret', PORT: '5540', HOST: '127.0.0.1', FRONTEND_URL: 'http://127.0.0.1:5541', ALLOWED_ORIGINS: 'http://127.0.0.1:5541', NODE_ENV: 'development' });
for (const key of ['EMAIL_USER','EMAIL_PASS','EMAIL_FROM','GEMINI_API_KEY','OPENAI_API_KEY','APP_BASE_PATH','FORCE_SECURE_COOKIES','DEPLOYMENT_CONFIG_PATH']) delete process.env[key];
execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', join(repo, 'server/prisma/schema.prisma')], { env: process.env, stdio: 'pipe' });
const p = new PrismaClient(), password = await bcrypt.hash('StudentAuditOnly2026!', 10);
const ownClass = '11111111-1111-4111-8111-111111111111', otherClass = '22222222-2222-4222-8222-222222222222', category = '33333333-3333-4333-8333-333333333333';
await p.user.createMany({ data: [
  { id: 'student-audit-admin', name: 'Student Audit Admin', email: 'student-audit-admin@example.test', password, role: 'admin' },
  { id: 'student-audit-teacher', name: 'Student Audit Teacher', email: 'student-audit-teacher@example.test', password, role: 'teacher' },
] });
await p.category.create({ data: { id: category, name: 'Audit Mathematics' } });
for (const [id, name] of [[ownClass, 'Student Audit 7A'], [otherClass, 'Private Other 7B']]) await p.class.create({ data: { id, name, classTeacher: { connect: { id: 'student-audit-teacher' } }, teachers: { connect: { id: 'student-audit-teacher' } }, assignedCategories: { connect: { id: category } } } });
for (const [id, email, cls, name] of [
  ['student-audit-student', 'student-audit@example.test', ownClass, 'Student Audit Learner'],
  ['student-audit-other-student', 'student-audit-other@example.test', otherClass, 'Private Other Learner'],
  ['student-audit-empty', 'student-audit-empty@example.test', null, 'Empty Audit Learner'],
]) await p.user.create({ data: { id, name: name!, email: email!, password, role: 'student', classId: cls, studentNo: cls ? 1 : null } });
for (const [id, title, status, cls, limit] of [
  ['student-audit-exam', 'Student Audit Exam', 'published', ownClass, null],
  ['student-audit-completed-exam', 'Student Audit Completed Exam', 'published', ownClass, null],
  ['student-audit-draft', 'Student Audit Draft', 'draft', ownClass, null],
  ['student-audit-other-exam', 'Private Other Exam', 'published', otherClass, null],
  ['student-audit-timed', 'Student Audit Timed Exam', 'published', ownClass, 1],
  ['student-audit-unassigned-exam', 'Student Audit Unassigned Exam', 'published', null, null],
  ['student-audit-offline', 'Student Audit Offline Exam', 'published', ownClass, null],
] as const) await p.quiz.create({ data: { id, title, status, timeLimit: limit, contentType: 'exam', createdBy: 'student-audit-teacher', categoryId: category, assignedClasses: cls ? { connect: { id: cls } } : undefined, questions: { create: [1, 2].map((n) => ({ id: id === 'student-audit-exam' ? n === 1 ? '66666666-6666-4666-8666-666666666661' : '66666666-6666-4666-8666-666666666662' : id === 'student-audit-other-exam' ? (n === 1 ? '77777777-7777-4777-8777-777777777771' : '77777777-7777-4777-8777-777777777772') : `${id}-q${n}`, text: `Audit question ${n}?`, type: 'multiple-choice', options: JSON.stringify(['A','B','C','D']), correctAnswer: 'A', order: n-1 })) } } });
for (const [id, studentId, quizId] of [['student-audit-result','student-audit-student','student-audit-completed-exam'],['student-audit-private-result','student-audit-other-student','student-audit-other-exam']]) await p.studentResult.create({ data: { id, studentId, quizId, status: 'completed', score: 0, totalQuestions: 2, correctAnswersCount: 0, completedAt: new Date(), submittedAt: new Date(), answers: JSON.stringify({ [`${quizId}-q1`]: 'B', [`${quizId}-q2`]: 'B' }) } });
await p.quiz.create({ data: { id: '55555555-5555-4555-8555-555555555555', title: 'Student Audit Survey', status: 'published', contentType: 'survey', createdBy: 'student-audit-teacher', assignedClasses: { connect: { id: ownClass } }, questions: { create: [
  { id: 'survey-q1', text: 'Audit open response', type: 'open-text', order: 0 },
  { id: 'survey-q2', text: 'Audit rating', type: 'rating', config: JSON.stringify({max:5}), order: 1 },
  { id: 'survey-q3', text: 'Audit single choice', type: 'single-choice', options: JSON.stringify(['A','B','C']), order: 2 },
  { id: 'survey-q4', text: 'Audit multiple choice', type: 'multiple-choice', options: JSON.stringify(['A','B','C']), order: 3 },
  { id: 'survey-q5', text: 'Audit likert', type: 'likert', options: JSON.stringify(['Katılmıyorum','Kararsızım','Katılıyorum']), order: 4 },
] } } });
await p.announcement.create({ data: { id: 'student-audit-announcement', title: 'Student Audit Announcement', content: 'Isolated student audit content', createdBy: 'student-audit-admin', targetRole: 'student' } });
await p.announcement.create({ data: { id: 'student-audit-private-announcement', title: 'Private Teacher Announcement', content: 'Teachers only', createdBy: 'student-audit-admin', targetRole: 'teacher' } });
await p.notification.create({ data: { userId: 'student-audit-student', title: 'Student Audit Notification', message: 'Isolated notification' } });
await p.$disconnect();
mkdirSync(join(repo, 'docs/student-audit'), { recursive: true });
writeFileSync(join(repo, 'docs/student-audit/runtime.json'), JSON.stringify({ root, database, ports: [5540,5541] }, null, 2));
process.chdir(root);
console.log('Disposable student fixture ready');
await import('../index');
