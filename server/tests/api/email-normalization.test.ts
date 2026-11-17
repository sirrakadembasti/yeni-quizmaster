import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createRuntimePrismaClient } from '../../utils/sqlite-runtime';
import { storage, closeStorage } from '../../storage';
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

const db = createRuntimePrismaClient();

function app() {
  const a = express();
  a.use(express.json());
  a.use(session({ secret: 'g05-test', resave: false, saveUninitialized: false }));
  a.use('/api/auth', authRouter);
  return a;
}

beforeAll(async () => {
  await storage.createUser({ name: 'Karma', email: 'karma.harf@example.com', password: await bcrypt.hash('Password123', 4), role: 'teacher' } as any);
}, 30000);

afterAll(async () => { await db.$disconnect(); await closeStorage(); });

describe('G-05: e-posta büyük/küçük harf normalizasyonu', () => {
  it('küçük harfle saklanan hesaba farklı yazımla giriş yapılır', async () => {
    const res = await request(app()).post('/api/auth/login').send({ email: 'Karma.Harf@Example.com', password: 'Password123' });
    expect(res.status).toBe(200);
  });

  it('forgot-password farklı yazımla talep oluşturur', async () => {
    const user = await storage.getUserByEmail('karma.harf@example.com');
    const res = await request(app()).post('/api/auth/forgot-password').send({ email: 'KARMA.harf@example.com' });
    expect(res.status).toBe(200);
    const requests = await db.passwordResetRequest.findMany({ where: { userId: user!.id } });
    expect(requests.length).toBeGreaterThan(0);
  });

  it('register e-postayı küçültür ve farklı yazımla ikinci kayıt reddedilir', async () => {
    const first = await request(app()).post('/api/auth/register').send({ name: 'Ali Veli', email: 'ALI@x.com', password: 'Password123' });
    expect(first.status).toBe(200);
    expect((await storage.getUserByEmail('ali@x.com'))?.email).toBe('ali@x.com');
    const second = await request(app()).post('/api/auth/register').send({ name: 'Ali Veli', email: 'ali@X.com', password: 'Password123' });
    expect(second.status).toBe(400);
  });

  it('migration SQL çakışmayan büyük harfli e-postaları küçültür, çakışanları bırakır', async () => {
    const pw = 'hash';
    for (const email of ['Veli@Okul.com', 'veli@okul.com', 'Tek@Okul.com']) {
      await storage.createUser({ name: 'M', email, password: pw, role: 'teacher' } as any);
    }
    const sql = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261118090000_normalize_user_email/migration.sql'), 'utf-8')
      .split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
    await db.$executeRawUnsafe(sql);
    const emails = (await db.user.findMany({ select: { email: true } })).map((u) => u.email);
    expect(emails).toContain('tek@okul.com');
    expect(emails).not.toContain('Tek@Okul.com');
    expect(emails).toContain('Veli@Okul.com');
    expect(emails).toContain('veli@okul.com');
  });
});
