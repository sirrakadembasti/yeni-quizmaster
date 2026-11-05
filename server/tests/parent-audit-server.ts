import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const require = createRequire(import.meta.url), repo = resolve(import.meta.dirname, '../..');
const root = mkdtempSync(join(repo, 'server/data/quizmaster-test-parent-audit-'));
for (const dir of ['server/data', 'server/uploads', 'client']) mkdirSync(join(root, dir), { recursive: true });
for (const dir of ['server', 'client']) writeFileSync(join(root, dir, 'package.json'), '{}');
const database = join(root, 'server/data/audit.db');
writeFileSync(database, '');
Object.assign(process.env, { DATABASE_URL: 'file:' + database.replaceAll('\\', '/'), SESSION_SECRET: 'isolated-parent-audit-only-secret', PORT: '5560', HOST: '127.0.0.1', FRONTEND_URL: 'http://127.0.0.1:5561', ALLOWED_ORIGINS: 'http://127.0.0.1:5561', NODE_ENV: 'development' });
for (const key of ['EMAIL_USER','EMAIL_PASS','EMAIL_FROM','GEMINI_API_KEY','OPENAI_API_KEY','APP_BASE_PATH','FORCE_SECURE_COOKIES','DEPLOYMENT_CONFIG_PATH']) delete process.env[key];
execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', join(repo, 'server/prisma/schema.prisma')], { env: process.env, stdio: 'pipe' });
const p = new PrismaClient(), password = await bcrypt.hash('StudentAuditOnly2026!', 10);
const ownClass = '11111111-1111-4111-8111-111111111111', otherClass = '22222222-2222-4222-8222-222222222222', category = '33333333-3333-4333-8333-333333333333';
await p.user.createMany({ data: [
  { id: 'parent-audit-admin', name: 'Parent Audit Admin', email: 'parent-audit-admin@example.test', password, role: 'admin' },
  { id: 'parent-audit-teacher', name: 'Parent Audit Teacher', email: 'parent-audit-teacher@example.test', password, role: 'teacher' },
] });
await p.category.create({ data: { id: category, name: 'Audit Mathematics' } });
await p.category.create({ data: { id: '44444444-4444-4444-8444-444444444444', name: 'Audit Empty Subject' } });
for (const [id, name] of [[ownClass, 'Parent Audit 7A'], [otherClass, 'Private Other 7B']]) await p.class.create({ data: { id, name, classTeacher: { connect: { id: 'parent-audit-teacher' } }, teachers: { connect: { id: 'parent-audit-teacher' } }, assignedCategories: { connect: { id: category } } } });
await p.class.update({ where: { id: ownClass }, data: { assignedCategories: { connect: { id: '44444444-4444-4444-8444-444444444444' } } } });
for (const [id, email, cls, name] of [
  ['parent-audit-student', 'parent-audit-child@example.test', ownClass, 'Ada Audit Child'],
  ['parent-audit-other-student', 'parent-audit-other@example.test', otherClass, 'Private Other Learner'],
  ['parent-audit-empty', 'parent-audit-empty@example.test', null, 'Beren Audit Child'],
]) await p.user.create({ data: { id, name: name!, email: email!, password, role: 'student', classId: cls, studentNo: cls ? 1 : null } });
for (const [id, title, status, cls, limit] of [
  ['parent-audit-exam', 'Parent Audit Exam', 'published', ownClass, null],
  ['parent-audit-completed-exam', 'Parent Audit Completed Exam', 'published', ownClass, null],
  ['parent-audit-draft', 'Parent Audit Draft', 'draft', ownClass, null],
  ['parent-audit-other-exam', 'Private Other Exam', 'published', otherClass, null],
  ['parent-audit-timed', 'Parent Audit Timed Exam', 'published', ownClass, 1],
  ['parent-audit-unassigned-exam', 'Parent Audit Unassigned Exam', 'published', null, null],
  ['parent-audit-offline', 'Parent Audit Offline Exam', 'published', ownClass, null],
] as const) await p.quiz.create({ data: { id, title, status, timeLimit: limit, contentType: 'exam', createdBy: 'parent-audit-teacher', categoryId: category, assignedClasses: cls ? { connect: { id: cls } } : undefined, questions: { create: [1, 2].map((n) => ({ id: id === 'parent-audit-exam' ? n === 1 ? '66666666-6666-4666-8666-666666666661' : '66666666-6666-4666-8666-666666666662' : id === 'parent-audit-other-exam' ? (n === 1 ? '77777777-7777-4777-8777-777777777771' : '77777777-7777-4777-8777-777777777772') : `${id}-q${n}`, text: `Audit question ${n}?`, type: 'multiple-choice', options: JSON.stringify(['A','B','C','D']), correctAnswer: 'A', order: n-1 })) } } });
for (const [id, studentId, quizId] of [['parent-audit-result','parent-audit-student','parent-audit-completed-exam'],['parent-audit-private-result','parent-audit-other-student','parent-audit-other-exam']]) await p.studentResult.create({ data: { id, studentId, quizId, status: 'completed', score: 0, totalQuestions: 2, correctAnswersCount: 0, completedAt: new Date(), submittedAt: new Date(), answers: JSON.stringify({ [`${quizId}-q1`]: 'B', [`${quizId}-q2`]: 'B' }) } });
await p.quiz.create({ data: { id: '55555555-5555-4555-8555-555555555555', title: 'Parent Audit Survey', status: 'published', contentType: 'survey', createdBy: 'parent-audit-teacher', assignedClasses: { connect: { id: ownClass } }, questions: { create: [
  { id: 'survey-q1', text: 'Audit open response', type: 'open-text', order: 0 },
  { id: 'survey-q2', text: 'Audit rating', type: 'rating', config: JSON.stringify({max:5}), order: 1 },
  { id: 'survey-q3', text: 'Audit single choice', type: 'single-choice', options: JSON.stringify(['A','B','C']), order: 2 },
  { id: 'survey-q4', text: 'Audit multiple choice', type: 'multiple-choice', options: JSON.stringify(['A','B','C']), order: 3 },
  { id: 'survey-q5', text: 'Audit likert', type: 'likert', options: JSON.stringify(['Katılmıyorum','Kararsızım','Katılıyorum']), order: 4 },
] } } });
await p.announcement.create({ data: { id: 'parent-audit-announcement', title: 'Parent Audit Announcement', content: 'Isolated parent audit content', createdBy: 'parent-audit-admin', targetRole: 'student' } });
await p.announcement.create({ data: { id: 'parent-audit-private-announcement', title: 'Private Teacher Announcement', content: 'Teachers only', createdBy: 'parent-audit-admin', targetRole: 'teacher' } });
await p.notification.create({ data: { userId: 'parent-audit-student', title: 'Parent Audit Notification', message: 'Isolated notification' } });
await p.user.createMany({ data: [
{id: "parent-audit-parent",name:"Parent Audit Guardian",email:"parent-audit@example.test",phoneNumber:"05550001122",address:"Parent audit fixture address",password,role:"parent"},
{id: "parent-audit-no-links",name:"Empty Audit Guardian",email:"parent-audit-no-links@example.test",password,role:"parent"},
{id: "parent-audit-security",name:"Security Audit Guardian",email:"parent-audit-security@example.test",password,role:"parent"}
] });
await p.guardianStudent.createMany({data:[{id:"parent-audit-link-one",guardianId:"parent-audit-parent",studentId:"parent-audit-student",relation:"Anne"},{id:"parent-audit-link-two",guardianId:"parent-audit-parent",studentId:"parent-audit-empty",relation:"Anne"}]});
await p.studentResult.create({data:{id:"parent-audit-second-result",studentId:"parent-audit-empty",quizId:"parent-audit-completed-exam",status:"completed",score:50,totalQuestions:2,correctAnswersCount:1,submittedAt:new Date(),completedAt:new Date(),answers:JSON.stringify({"parent-audit-completed-exam-q1":"A","parent-audit-completed-exam-q2":"B"})}});
for(const [id,title,targetRole] of [["parent-audit-parent-announcement","Parent Audit Parent Announcement","parent"],["parent-audit-all-announcement","Parent Audit All Announcement","all"]]) await p.announcement.create({data:{id,title,content:"Isolated parent announcement",createdBy:"parent-audit-admin",targetRole}});
for(let i=0;i<23;i++) await p.notification.create({data:{id:"parent-audit-notification-"+i,userId:"parent-audit-parent",title:"Parent Audit Notification "+i,message:"Isolated parent notification",createdAt:new Date(Date.now()-i*1000)}});
for(let i=0;i<55;i++) await p.actionLog.create({data:{userId:"parent-audit-parent",action:"PARENT_AUDIT",details:"Parent audit action "+i,createdAt:new Date(Date.now()-i*1000)}});
await p.actionLog.create({data:{userId:"parent-audit-other-student",action:"PRIVATE_AUDIT",details:"Private foreign audit action"}});
await p.actionLog.create({data:{userId:"parent-audit-parent",action:"OLD_AUDIT",details:"Old parent audit action",createdAt:new Date("2020-01-01")}});
await p.$disconnect();
mkdirSync(join(repo, 'docs/parent-audit'), { recursive: true });
writeFileSync(join(repo, 'docs/parent-audit/runtime.json'), JSON.stringify({ root, database, ports: [5560,5561] }, null, 2));
process.chdir(root);
console.log('Disposable student fixture ready');
if (process.env.INTEGRATION_AUDIT_ID) {
  const { installIntegrationAuditIdentity } = await import('./integration-audit-identity');
  installIntegrationAuditIdentity();
}
await import('../index');
