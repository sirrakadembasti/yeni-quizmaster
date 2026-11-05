import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { storage, closeStorage } from '../../storage';
import studentRouter from '../../api-routes/student';
import quizRouter from '../../api-routes/quiz';
import surveyRouter from '../../api-routes/survey';
import classRouter from '../../api-routes/class';
import userRouter from '../../api-routes/user';
import announcementRouter from '../../api-routes/announcement';
vi.mock('../../socket',()=>({getIO:()=>({to:()=>({emit:()=>undefined})}),disconnectUserSockets:()=>undefined}));
const db = new PrismaClient();
let teacher: any, parent: any, student: any, other: any, cls: any, foreign: any, quiz: any, questions: any[], result: any;
function app(user: any) {
 const app = express(); app.use(express.json());
 app.use(session({secret:'regression-test',resave:false,saveUninitialized:false}));
 app.use((req, _res, next) => { req.session.userId=user.id; next(); });
 app.use('/quizzes',quizRouter); app.use('/surveys',surveyRouter); app.use('/student',studentRouter); app.use('/classes',classRouter);
 app.use('/users',userRouter); app.use('/announcements',announcementRouter);
 return app;
}
beforeAll(async () => {
 teacher=await storage.createUser({name:'Teacher',email:'security-teacher@test.local',password:await bcrypt.hash('Password123',4),role:'teacher'});
 parent=await storage.createUser({name:'Parent',email:'security-parent@test.local',password:'hash',role:'parent',phoneNumber:'05550000000',address:'Test address'});
 cls=await storage.createClass({name:'Security class',classTeacherId:teacher.id});
 foreign=await storage.createClass({name:'Foreign class'});
 await storage.assignTeacherToClass(teacher.id,cls.id);
 student=await storage.createUser({name:'Student',email:'security-student@test.local',password:'hash',role:'student',classId:cls.id});
 other=await storage.createUser({name:'Other',email:'security-other@test.local',password:'hash',role:'student',classId:foreign.id});
 await storage.linkGuardianStudent(parent.id,student.id,'Anne');
 quiz=await storage.createQuiz({title:'Security exam',createdBy:teacher.id,status:'published',assignedClassIds:[cls.id]});
 questions=await storage.syncQuestions(quiz.id,[{quizId:quiz.id,text:'One',type:'multiple-choice',options:['A','B'],correctAnswer:'A',imageUrl:'/uploads/test.webp',order:0},{quizId:quiz.id,text:'Two',type:'multiple-choice',options:['A','B'],correctAnswer:'B',order:1}] as any);
 result=await storage.createResult({studentId:student.id,quizId:quiz.id,answers:{},totalQuestions:2} as any);
},30000);
afterAll(async()=>{ await db.$disconnect(); await closeStorage(); });
describe('Security regressions with isolated SQLite',()=>{
 it('preserves guardian links on profile and reset-token updates',async()=>{
  await storage.updateUser(student.id,{resetToken:'token',resetTokenExpiry:new Date()});
  await storage.updateUser(parent.id,{name:'Parent updated'});
  expect((await storage.getGuardianStudents(parent.id)).map(x=>x.studentId)).toContain(student.id);
 });
 it('preserves teacher assignments when role is omitted',async()=>{
  await storage.updateUser(teacher.id,{name:'Teacher updated'});
  expect((await storage.getClassesByTeacher(teacher.id)).map(x=>x.id)).toContain(cls.id);
  expect((await storage.getClass(cls.id) as any).classTeacherId).toBe(teacher.id);
 });
 it('blocks parent access through generic result, class and quiz routes',async()=>{
  const client=request(app(parent));
  for (const path of ['/student/results/'+result.id,'/classes/'+foreign.id,'/classes/'+foreign.id+'/students']) expect((await client.get(path)).status).toBe(403);
  expect((await client.post('/student/quiz/'+quiz.id+'/start')).status).toBe(403);
 });
 it('filters parent announcements to explicit parent/all audiences',async()=>{
  await storage.createAnnouncement({title:'Teacher-only',content:'Secret',createdBy:teacher.id,targetRole:'teacher'});
  expect((await request(app(parent)).get('/announcements')).body.announcements).toEqual([]);
 });
 it('blocks moving a student from an unauthorized source class',async()=>{
  expect((await request(app(teacher)).post('/classes/'+cls.id+'/students').send({studentId:other.id})).status).toBe(403);
  expect((await storage.getUser(other.id))!.classId).toBe(foreign.id);
 });
 it('blocks removing a student who is not in the URL class',async()=>{
  expect((await request(app(teacher)).delete('/classes/'+cls.id+'/students/'+other.id)).status).toBe(403);
  expect((await storage.getUser(other.id))!.classId).toBe(foreign.id);
 });
 it('hides correctness counters while exam is in progress',async()=>{
  await storage.updateResult(result.id,{correctAnswersCount:1,score:50});
  const response=await request(app(student)).get('/student/results');
  expect(response.status).toBe(200);
  const row=response.body.results.find((r:any)=>r.id===result.id);
  expect(row.correctAnswersCount).toBeUndefined(); expect(row.score).toBeUndefined();
 });
 it('protects student profile from alternative PATCH route',async()=>{
  expect((await request(app(student)).patch('/users/'+student.id).send({name:'Changed'})).status).toBe(403);
  expect((await storage.getUser(student.id))!.name).toBe('Student');
 });
 it('requires current password for self password changes',async()=>{
  expect((await request(app(teacher)).patch('/users/'+teacher.id).send({password:'Password456'})).status).toBe(400);
  expect(await bcrypt.compare('Password123',(await storage.getUser(teacher.id))!.password)).toBe(true);
 });
 it('preserves question IDs on draft resynchronization',async()=>{
  const draft=await storage.createQuiz({title:'Draft',createdBy:teacher.id});
  const rows=await storage.syncQuestions(draft.id,[{quizId:draft.id,text:'Draft Q',type:'multiple-choice',options:['A','B'],correctAnswer:'A',order:0}] as any);
  const updated=await storage.syncQuestions(draft.id,rows.map(q=>({...q,text:'Updated'})) as any);
  expect(updated[0].id).toBe(rows[0].id);
 });
 it('rejects changing questions after exam participation',async()=>{
  await expect(storage.syncQuestions(quiz.id,questions.map(q=>({...q,text:q.text+' changed'})) as any)).rejects.toThrow('CONTENT_HAS_RESPONSES');
  expect((await storage.getQuestionsByQuiz(quiz.id)).map(q=>q.id)).toEqual(questions.map(q=>q.id));
 });
 it('accepts unchanged participated questions when only metadata is saved',async()=>{
  await storage.updateQuiz(quiz.id,{title:'Renamed exam'});
  const synced=await storage.syncQuestions(quiz.id,questions as any);
  expect(synced.map(q=>q.id)).toEqual(questions.map(q=>q.id));
  expect((await storage.getQuiz(quiz.id))!.title).toBe('Renamed exam');
 });
 it.each(['exam','survey'])('saves uploaded image paths in %s questions',async contentType=>{
  const draft=await storage.createQuiz({title:'Image draft',createdBy:teacher.id,contentType});
  const route=contentType==='survey'?'/surveys/':'/quizzes/';
  const payload=[{text:'Image question',type:contentType==='survey'?'single-choice':'multiple-choice',options:['A','B'],correctAnswer:'A',imageUrl:'/uploads/test.webp',order:1}];
  const response=await request(app(teacher)).post(route+draft.id+'/questions').send(payload);
  expect(response.status).toBe(201);
  expect(response.body.questions[0].imageUrl).toBe('/uploads/test.webp');
  const invalid=await request(app(teacher)).post(route+draft.id+'/questions').send([{...payload[0],imageUrl:'/uploads/../.env'}]);
  expect(invalid.status).toBe(400);
 });
 it('retains question images in exam payload',async()=>{
  const response=await request(app(student)).post('/student/quiz/'+quiz.id+'/start');
  expect(response.status).toBe(200); expect(response.body.questions[0].imageUrl).toBe('/uploads/test.webp');
 });
 it('reuses one result for concurrent start requests',async()=>{
  const exam=await storage.createQuiz({title:'Concurrent',createdBy:teacher.id,status:'published',assignedClassIds:[cls.id]});
  const responses=await Promise.all([request(app(student)).post('/student/quiz/'+exam.id+'/start'),request(app(student)).post('/student/quiz/'+exam.id+'/start')]);
  expect(responses.map(r=>r.status)).toEqual([200,200]);
  expect(responses[0].body.resultId).toBe(responses[1].body.resultId);
  expect(await db.studentResult.count({where:{quizId:exam.id,studentId:student.id}})).toBe(1);
 });
 it('merges concurrent answer saves without dropping answers',async()=>{
  const responses=await Promise.all(questions.map((q,i)=>request(app(student)).post('/student/quiz/'+result.id+'/answer').send({questionId:q.id,selectedOption:i===0?'A':'B'})));
  expect(responses.map(r=>r.status)).toEqual([200,200]);
  expect((await storage.getResult(result.id) as any).answers).toEqual({[questions[0].id]:'A',[questions[1].id]:'B'});
 });
 it('makes repeated submission idempotent',async()=>{
  const client=request(app(student));
  const first=await client.post('/student/quiz/'+result.id+'/submit').send({});
  const again=await client.post('/student/quiz/'+result.id+'/submit').send({});
  expect(first.status).toBe(200);expect(again.status).toBe(200);
  expect(again.body.score).toBe(first.body.score);
 });
 it('renumbers promoted students without collisions in target class',async()=>{
  const source=await storage.createClass({name:'Promotion source'});
  const target=await storage.createClass({name:'Promotion target'});
  const a=await storage.createUser({name:'Promote A',email:'promote-a@test.local',password:'hash',role:'student',classId:source.id});
  await storage.createUser({name:'Promote B',email:'promote-b@test.local',password:'hash',role:'student',classId:target.id});
  await expect(storage.promoteStudents(source.id,target.id,'2025-2026')).resolves.toBe(1);
  const moved=await storage.getUser(a.id);expect(moved!.classId).toBe(target.id);expect(moved!.studentNo).toBe(2);
 });

 it('claims an email once across simultaneous workers',async()=>{
  await storage.enqueueEmail({to:'claim@test.local',subject:'Claim',body:'test'});
  const batches=await Promise.all([storage.claimPendingEmails(1),storage.claimPendingEmails(1)]);
  const ids=batches.flat().map(email=>email.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toHaveLength(1);
 });
});
