import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';

vi.mock('../../storage', () => {
  const fns: Record<string, any> = {};
  return { storage: new Proxy(fns, { get: (target, key: string | symbol) => (typeof key === 'symbol' || key === 'then' ? undefined : (target[key] ??= vi.fn())) }) };
});
vi.mock('../../middleware/archive-readonly', () => ({
  archiveContentGuard: (_req: any, _res: any, next: any) => next(),
  archiveResultGuard: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../socket', () => ({
  getIO: () => ({ to: () => ({ emit: () => undefined }) }),
  disconnectUserSockets: () => undefined,
  disconnectSessionSockets: () => undefined,
}));
vi.mock('../../utils/email', () => ({ sendRegistrationSuccessEmail: vi.fn(async () => ({ id: 'email-1' })) }));

import { storage } from '../../storage';
import authRouter from '../../api-routes/auth';
import userRouter from '../../api-routes/user';
import parentRouter from '../../api-routes/parent';
import { apiErrorHandler } from '../../middleware/error-handler';

// S-04: tüm parola belirleme yolları en az 8 karakter istemeli.
const s = storage as any;
const uuid = '11111111-1111-4111-8111-111111111111';
const short = 'Abc1234'; // 7 karakter
const ok = 'Abc12345'; // 8 karakter
const admin = { id: 'admin-1', role: 'admin', isActive: true, sessionVersion: 0, password: 'x' };

function app() {
  const a = express();
  a.use(express.json());
  a.use(session({ secret: 's04-test', resave: false, saveUninitialized: false }));
  a.use((req, _res, next) => { req.session.userId = 'admin-1'; next(); });
  a.use('/api/auth', authRouter);
  a.use('/api/users', userRouter);
  a.use('/api/parents', parentRouter);
  a.use(apiErrorHandler);
  return a;
}

beforeEach(() => {
  vi.clearAllMocks();
  s.getUser.mockImplementation(async (id: string) => (id === 'admin-1' ? admin : id === 'student-1' ? { id, role: 'student', isActive: true, password: 'x' } : undefined));
  s.getUserByEmail.mockResolvedValue(undefined);
  s.createUser.mockImplementation(async (d: any) => ({ id: 'new', createdAt: new Date(), isActive: true, ...d }));
  s.getAllUsers.mockResolvedValue([]);
  s.createLog.mockResolvedValue(undefined);
});

describe('S-04: parola alt sınırı 8', () => {
  it('kayıt: 7 karakter reddedilir', async () => {
    const res = await request(app()).post('/api/auth/register').send({ name: 'Öğrenci', email: 'a@example.com', password: short }).timeout(5000);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8/);
    expect(s.createUser).not.toHaveBeenCalled();
  });

  it('kayıt: 8 karakter kabul edilir', async () => {
    const res = await request(app()).post('/api/auth/register').send({ name: 'Öğrenci', email: 'a@example.com', password: ok }).timeout(5000);
    expect(res.status).toBe(200);
  });

  it('parola değiştirme: yeni parola 7 karakter reddedilir', async () => {
    const res = await request(app()).post('/api/auth/change-password').send({ currentPassword: 'eski', newPassword: short }).timeout(5000);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8/);
  });

  it('sıfırlama: 7 karakter reddedilir', async () => {
    const res = await request(app()).post('/api/auth/reset-password').send({ token: 't', password: short }).timeout(5000);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8/);
  });

  it('yönetici kullanıcı oluştururken 7 karakter reddedilir', async () => {
    const res = await request(app()).post('/api/users').send({ name: 'Yeni', email: 'b@example.com', password: short, role: 'student' }).timeout(5000);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8/);
    expect(s.createUser).not.toHaveBeenCalled();
  });

  it('kullanıcı güncellerken 7 karakterlik parola reddedilir', async () => {
    const res = await request(app()).patch('/api/users/student-1').send({ password: short }).timeout(5000);
    expect(res.status).toBe(400);
    expect(s.updateUser).not.toHaveBeenCalled();
  });

  it('veli hesabı oluştururken 7 karakter reddedilir', async () => {
    const res = await request(app()).post('/api/parents').send({
      name: 'Veli', email: 'veli@example.com', password: short, phoneNumber: '5551112233', address: 'Adres satırı', studentId: uuid, relationship: 'Anne',
    }).timeout(5000);
    expect(res.status).toBe(400);
    expect(s.createUser).not.toHaveBeenCalled();
  });
});
