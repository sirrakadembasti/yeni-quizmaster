import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';

vi.mock('../../storage', () => {
  const fns: Record<string, any> = {};
  return { storage: new Proxy(fns, { get: (target, key: string | symbol) => (typeof key === 'symbol' || key === 'then' ? undefined : (target[key] ??= vi.fn())) }) };
});

import { storage } from '../../storage';
import resultRouter from '../../api-routes/result';

// T-01: istemcinin kullanmadığı CSV dışa aktarma ve canlı sonuç rotaları kaldırıldı.
const s = storage as any;

function app() {
  const a = express();
  a.use(session({ secret: 't01-test', resave: false, saveUninitialized: false }));
  a.use((req, _res, next) => { req.session.userId = 'admin-1'; next(); });
  a.use('/api/results', resultRouter);
  return a;
}

beforeEach(() => {
  vi.clearAllMocks();
  s.getUser.mockResolvedValue({ id: 'admin-1', role: 'admin', isActive: true, sessionVersion: 0 });
  s.getQuiz.mockResolvedValue({ id: 'q1', title: 'Deneme', createdBy: 'admin-1' });
  s.getResultsByQuiz.mockResolvedValue([]);
  s.getLiveResults.mockResolvedValue([]);
});

describe('T-01: kaldırılan sonuç rotaları', () => {
  it('CSV dışa aktarma rotası artık yok (404)', async () => {
    expect((await request(app()).get('/api/results/quiz/q1/export').timeout(5000)).status).toBe(404);
  });
  it('canlı sonuç rotası artık yok (404)', async () => {
    expect((await request(app()).get('/api/results/quiz/q1/live').timeout(5000)).status).toBe(404);
  });
  it('kullanılan sonuç listesi rotası çalışmaya devam eder', async () => {
    expect((await request(app()).get('/api/results/quiz/q1').timeout(5000)).status).toBe(200);
  });
});
