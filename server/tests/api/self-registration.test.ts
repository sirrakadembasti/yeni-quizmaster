import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';

vi.mock('../../storage', () => {
  const fns: Record<string, any> = {};
  return { storage: new Proxy(fns, { get: (target, key: string | symbol) => (typeof key === 'symbol' || key === 'then' ? undefined : (target[key] ??= vi.fn())) }) };
});
vi.mock('../../utils/email', () => ({ sendRegistrationSuccessEmail: vi.fn(async () => ({ id: 'email-1' })) }));

import { storage } from '../../storage';
import authRouter from '../../api-routes/auth';
import { createRegisterLimiter } from '../../middleware/register-limiter';
import { apiErrorHandler } from '../../middleware/error-handler';

const s = storage as any;

function app(withLimiter = false) {
  const a = express();
  a.use(express.json());
  a.use(session({ secret: 's03-test', resave: false, saveUninitialized: false }));
  if (withLimiter) a.use('/api/auth/register', createRegisterLimiter());
  a.use('/api/auth', authRouter);
  a.use(apiErrorHandler);
  return a;
}

const body = (n: number) => ({ name: `Öğrenci ${n}`, email: `ogrenci${n}@example.com`, password: 'Parola123' });
const original = process.env.ALLOW_SELF_REGISTRATION;

beforeEach(() => {
  vi.clearAllMocks();
  s.getUserByEmail.mockResolvedValue(undefined);
  s.createUser.mockImplementation(async (d: any) => ({ id: 'new', createdAt: new Date(), isActive: true, ...d }));
  s.getAllUsers.mockResolvedValue([]);
  s.createLog.mockResolvedValue(undefined);
});
afterEach(() => {
  if (original === undefined) delete process.env.ALLOW_SELF_REGISTRATION;
  else process.env.ALLOW_SELF_REGISTRATION = original;
});

describe('S-03: ALLOW_SELF_REGISTRATION', () => {
  it('false iken register → 403 ve kullanıcı oluşturulmaz', async () => {
    process.env.ALLOW_SELF_REGISTRATION = 'false';
    const res = await request(app()).post('/api/auth/register').send(body(1)).timeout(5000);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Kayıt kapalı. Hesabınızı okul yönetimi oluşturur.');
    expect(s.createUser).not.toHaveBeenCalled();
  });

  it('tanımsızken mevcut davranış korunur (kayıt açık)', async () => {
    delete process.env.ALLOW_SELF_REGISTRATION;
    const res = await request(app()).post('/api/auth/register').send(body(1)).timeout(5000);
    expect(res.status).toBe(200);
    expect(s.createUser).toHaveBeenCalled();
  });

  it('registration-info bayrağı yansıtır', async () => {
    delete process.env.ALLOW_SELF_REGISTRATION;
    expect((await request(app()).get('/api/auth/registration-info').timeout(5000)).body).toEqual({ enabled: true });
    process.env.ALLOW_SELF_REGISTRATION = 'false';
    expect((await request(app()).get('/api/auth/registration-info').timeout(5000)).body).toEqual({ enabled: false });
  });
});

describe('S-03: register için IP sınırlayıcı', () => {
  it('aynı IP farklı e-postalarla 10 denemeden sonra 429 alır', async () => {
    const a = app(true);
    const statuses: number[] = [];
    for (let n = 1; n <= 11; n++) {
      statuses.push((await request(a).post('/api/auth/register').send(body(n)).timeout(5000)).status);
    }
    expect(statuses.slice(0, 10).every(code => code !== 429)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe('S-03: register sınırlayıcısı ve proxy / X-Forwarded-For', () => {
  const attempts = async (a: express.Express, header: (n: number) => string | undefined, count: number) => {
    const statuses: number[] = [];
    for (let n = 1; n <= count; n++) {
      const req = request(a).post('/api/auth/register').send(body(n)).timeout(5000);
      const xff = header(n);
      if (xff) req.set('X-Forwarded-For', xff);
      statuses.push((await req).status);
    }
    return statuses;
  };

  it('güvenilir proxy yokken sahte X-Forwarded-For sınırı aşmaya yaramaz', async () => {
    const a = app(true);
    const statuses = await attempts(a, n => `203.0.113.${n}`, 11);
    expect(statuses[10]).toBe(429);
  });

  it('güvenilir proxy varken farklı istemci IP\'leri ayrı sayılır', async () => {
    const a = app(true);
    a.set('trust proxy', 1);
    const statuses = await attempts(a, n => `203.0.113.${n}`, 11);
    expect(statuses.every(code => code !== 429)).toBe(true);
  });

  it('güvenilir proxy varken aynı istemci IP\'si 10 denemeden sonra 429 alır', async () => {
    const a = app(true);
    a.set('trust proxy', 1);
    const statuses = await attempts(a, () => '203.0.113.9', 11);
    expect(statuses[10]).toBe(429);
  });
});
