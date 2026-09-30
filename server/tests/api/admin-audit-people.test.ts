import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { storage, closeStorage } from '../../storage';
import classRouter from '../../api-routes/class';
import parentRouter from '../../api-routes/parent';
import userRouter from '../../api-routes/user';
import { secureJsonReplacer } from '../../utils/json-security';

vi.mock('../../socket', () => ({ disconnectUserSockets: vi.fn() }));

// Existing Vitest config supplies a migrated, disposable quizmaster-test-* database.
// Characterization assertions below prove current defects; they are not acceptance assertions.
let admin: any, teacher: any, student: any, guardian: any, cls: any, category: any;
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
function appFor(user: any) {
  const app = express();
  app.set('json replacer', secureJsonReplacer);
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { userId: user.id, sessionVersion: 0, destroy: () => undefined };
    next();
  });
  app.use('/api/classes', classRouter);
  app.use('/api/parents', parentRouter);
  app.use('/api/users', userRouter);
  return app;
}

beforeAll(async () => {
  const base = { password: 'audit-password-hash' };
  admin = await storage.createUser({ ...base, name: 'Audit Admin', email: `admin-${suffix}@test.invalid`, role: 'admin' });
  teacher = await storage.createUser({ ...base, name: 'Audit Teacher', email: `teacher-${suffix}@test.invalid`, role: 'teacher' });
  cls = await storage.createClass({ name: `Audit-${suffix}`, classTeacherId: teacher.id, maxStudents: 1 });
  student = await storage.createUser({ ...base, name: 'Audit Student', email: `student-${suffix}@test.invalid`, role: 'student', classId: cls.id });
  await storage.updateUser(student.id, { resetToken: 'audit-reset-token', resetTokenExpiry: new Date(Date.now() + 600000) });
  guardian = await storage.createUser({ ...base, name: 'Audit Parent', email: `parent-${suffix}@test.invalid`, role: 'parent', phoneNumber: '05551112233', address: 'Audit address' });
  category = await storage.createCategory({ name: `Audit course ${suffix}` });
  await storage.linkGuardianStudent(guardian.id, student.id, 'Anne');
});
afterAll(async () => { await closeStorage(); });

describe('Admin people audit: isolated current-behavior evidence', () => {
  it('production serializer strips class detail student and nested teacher secrets', async () => {
    const res = await request(appFor(admin)).get(`/api/classes/${cls.id}`);
    expect(res.status).toBe(200);
    expect(res.body.students[0]).not.toHaveProperty('password');
    expect(res.body.students[0]).not.toHaveProperty('resetToken');
    expect(res.body.class.classTeacher).not.toHaveProperty('password');
  });
  it('production serializer strips assigned teacher class-student read secrets', async () => {
    const res = await request(appFor(teacher)).get(`/api/classes/${cls.id}/students`);
    expect(res.status).toBe(200);
    expect(res.body.students[0]).not.toHaveProperty('password');
    expect(res.body.students[0]).not.toHaveProperty('resetToken');
  });
  it('production serializer strips guardian-management nested student secrets', async () => {
    const res = await request(appFor(admin)).get(`/api/parents/guardian/${guardian.id}/students`);
    expect(res.status).toBe(200);
    expect(res.body.students[0].student).not.toHaveProperty('password');
    expect(res.body.students[0].student).not.toHaveProperty('resetToken');
  });
  it('teacher create persists selected courses and classes', async () => {
    const res = await request(appFor(admin)).post('/api/users').send({ name: 'New Teacher', email: `newteacher-${suffix}@test.invalid`, password: 'secret123', role: 'teacher', assignedCategoryIds: [category.id], classIds: [cls.id] });
    expect(res.status).toBe(201);
    const created: any = await storage.getUser(res.body.user.id);
    expect(created.assignedCategories.map((item: any) => item.id)).toContain(category.id);
    expect(created.managedClasses.map((item: any) => item.id)).toContain(cls.id);
  });
  it('invalid teacher assignment rejects the request without creating an account', async () => {
    const email = `invalidteacher-${suffix}@test.invalid`;
    const res = await request(appFor(admin)).post('/api/users').send({ name: 'Invalid Teacher', email, password: 'secret123', role: 'teacher', assignedCategoryIds: [category.id], classIds: ['not-a-class'] });
    expect(res.status).toBe(400);
    expect(await storage.getUserByEmail(email)).toBeUndefined();
  });
  it('class course assignment accepts a student as teacher', async () => {
    const res = await request(appFor(admin)).post(`/api/classes/${cls.id}/teachers-with-course`).send({ teacherId: student.id, categoryId: category.id });
    expect(res.status).toBe(200);
    const loaded: any = await storage.getClass(cls.id);
    expect(loaded.teacherAssignments.some((a: any) => a.teacherId === student.id && a.teacher.role === 'student')).toBe(true);
  });
  it('class enrollment ignores maxStudents capacity', async () => {
    const second = await storage.createUser({ name: 'Second Student', email: `second-${suffix}@test.invalid`, password: 'audit-hash', role: 'student' });
    const res = await request(appFor(admin)).post(`/api/classes/${cls.id}/students`).send({ studentId: second.id });
    expect(res.status).toBe(200);
    expect(await storage.getStudentsByClass(cls.id)).toHaveLength(2);
  });
  it('non-admin roles cannot use people mutation APIs', async () => {
    const res = await request(appFor(teacher)).post(`/api/classes/${cls.id}/teachers-with-course`).send({ teacherId: teacher.id, categoryId: category.id });
    expect(res.status).toBe(403);
    const link = await request(appFor(student)).post('/api/parents/link').send({ guardianId: guardian.id, studentId: student.id, relation: 'Anne' });
    expect(link.status).toBe(403);
  });
  it('removing responsible teacher retains legacy class access created with the class', async () => {
    const res = await request(appFor(admin)).patch(`/api/classes/${cls.id}`).send({ classTeacherId: null });
    expect(res.status).toBe(200);
    const remaining: any = await storage.getClass(cls.id);
    expect(remaining.classTeacherId).toBeNull();
    expect(remaining.teachers.some((t: any) => t.id === teacher.id)).toBe(true);
    const accessible = await storage.getClassesByTeacher(teacher.id);
    expect(accessible.some((c) => c.id === cls.id)).toBe(true);
  });
});
