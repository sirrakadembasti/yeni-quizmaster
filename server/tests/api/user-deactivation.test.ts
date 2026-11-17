import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { storage, closeStorage } from '../../storage';
import userRouter from '../../api-routes/user';
import authRouter from '../../api-routes/auth';

vi.mock('../../socket', () => ({
  getIO: () => ({ to: () => ({ emit: () => undefined }) }),
  disconnectUserSockets: () => undefined,
  disconnectSessionSockets: () => undefined,
}));
vi.mock('../../utils/email', () => ({
  sendRegistrationSuccessEmail: vi.fn(async () => ({ id: 'email-1' })),
  sendResetPasswordEmail: vi.fn(async () => ({ id: 'email-2' })),
}));

function app(userId?: string) {
  const a = express();
  a.use(express.json());
  a.use(session({ secret: 'g03-test', resave: false, saveUninitialized: false }));
  a.use((req, _res, next) => { if (userId) req.session.userId = userId; next(); });
  a.use('/api/users', userRouter);
  a.use('/api/auth', authRouter);
  return a;
}

let admin: any, teacher: any, parent: any, student: any, cls: any;

beforeAll(async () => {
  admin = await storage.createUser({ name: 'G03 Admin', email: 'g03-admin@test.local', password: await bcrypt.hash('Password123', 4), role: 'admin' } as any);
  teacher = await storage.createUser({ name: 'G03 Teacher', email: 'g03-teacher@test.local', password: await bcrypt.hash('Password123', 4), role: 'teacher' } as any);
  cls = await storage.createClass({ name: 'G03 class', classTeacherId: teacher.id });
  await storage.createLog(teacher.id, 'LOGIN', 'x');
  student = await storage.createUser({ name: 'G03 Student', email: 'g03-student@test.local', password: 'hash', role: 'student', classId: cls.id } as any);
  parent = await storage.createUser({ name: 'G03 Parent', email: 'g03-parent@test.local', password: await bcrypt.hash('Password123', 4), role: 'parent', phoneNumber: '05550000000', address: 'Test adres' } as any);
  await storage.linkGuardianStudent(parent.id, student.id, 'Anne');
  await storage.createLog(parent.id, 'LOGIN', 'x');
}, 30000);

afterAll(async () => { await closeStorage(); });

describe('G-03: öğrenci dışı kullanıcılar pasife alınır', () => {
  it('giriş kaydı olan öğretmen pasife alınır, geçmişi korunur', async () => {
    const res = await request(app(admin.id)).delete(`/api/users/${teacher.id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Kullanıcı pasife alındı; geçmiş kayıtları korundu.');

    expect((await storage.getUser(teacher.id))?.isActive).toBe(false);
    expect((await storage.getClass(cls.id) as any).classTeacherId).toBeNull();
    const logs = await storage.getLogs({ userId: teacher.id });
    expect(logs.data.some((log) => log.action === 'LOGIN')).toBe(true);

    const login = await request(app()).post('/api/auth/login').send({ email: 'g03-teacher@test.local', password: 'Password123' });
    expect(login.status).toBe(401);
    expect((await storage.getAllUsers()).some((u) => u.id === teacher.id)).toBe(false);
  });

  it('veli pasife alınır ve öğrenci bağları temizlenir', async () => {
    const res = await request(app(admin.id)).delete(`/api/users/${parent.id}`);
    expect(res.status).toBe(200);
    expect((await storage.getUser(parent.id))?.isActive).toBe(false);
    expect(await storage.getGuardianStudents(parent.id)).toEqual([]);
  });
});
