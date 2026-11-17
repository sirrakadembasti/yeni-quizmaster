import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { storage, closeStorage } from '../../storage';
import userRouter from '../../api-routes/user';
import { apiErrorHandler } from '../../middleware/error-handler';

vi.mock('../../socket', () => ({
  getIO: () => ({ to: () => ({ emit: () => undefined }) }),
  disconnectUserSockets: () => undefined,
  disconnectSessionSockets: () => undefined,
}));
vi.mock('../../utils/email', () => ({
  sendRegistrationSuccessEmail: vi.fn(async () => ({ id: 'email-1' })),
}));

function app(userId: string) {
  const a = express();
  a.use(express.json());
  a.use(session({ secret: 'g04-test', resave: false, saveUninitialized: false }));
  a.use((req, _res, next) => { req.session.userId = userId; next(); });
  a.use('/api/users', userRouter);
  a.use(apiErrorHandler);
  return a;
}

let admin1: any, admin2: any;

beforeAll(async () => {
  const hash = await bcrypt.hash('Password123', 4);
  admin1 = await storage.createUser({ name: 'G04 Admin 1', email: 'g04-admin1@test.local', password: hash, role: 'admin' } as any);
}, 30000);

afterAll(async () => { await closeStorage(); });

describe('G-04: son etkin yönetici korunur', () => {
  it('tek etkin yönetici kendi rolünü düşüremez', async () => {
    const res = await request(app(admin1.id)).patch(`/api/users/${admin1.id}/role`).send({ role: 'teacher' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Sistemde en az bir etkin yönetici kalmalıdır.');
    expect((await storage.getUser(admin1.id))?.role).toBe('admin');
  });

  it('tek etkin yönetici PATCH /:id ile rolünü düşüremez', async () => {
    const res = await request(app(admin1.id)).patch(`/api/users/${admin1.id}`).send({ role: 'teacher' });
    expect(res.status).toBe(409);
    expect((await storage.getUser(admin1.id))?.role).toBe('admin');
  });

  it('tek etkin yönetici kendini silemez (pasife alamaz)', async () => {
    const res = await request(app(admin1.id)).delete(`/api/users/${admin1.id}`);
    expect(res.status).toBe(409);
    expect((await storage.getUser(admin1.id))?.isActive).toBe(true);
  });

  it('ikinci etkin yönetici varken rol düşürülebilir', async () => {
    admin2 = await storage.createUser({ name: 'G04 Admin 2', email: 'g04-admin2@test.local', password: await bcrypt.hash('Password123', 4), role: 'admin' } as any);
    const res = await request(app(admin1.id)).patch(`/api/users/${admin2.id}/role`).send({ role: 'teacher' });
    expect(res.status).toBe(200);
    expect((await storage.getUser(admin2.id))?.role).toBe('teacher');
  });
});
