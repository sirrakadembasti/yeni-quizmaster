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
import { apiErrorHandler } from '../../middleware/error-handler';

// P-01 adım 1: doğru sayısı cevap kaydında hesaplanmaz; devam eden sınavın sayısı CSV'de "-" görünür.
const s = storage as any;
const admin = { id: 'admin-1', role: 'admin', isActive: true, sessionVersion: 0 };

function app() {
  const a = express();
  a.use(session({ secret: 'p01-test', resave: false, saveUninitialized: false }));
  a.use((req, _res, next) => { req.session.userId = 'admin-1'; next(); });
  a.use('/api/results', resultRouter);
  a.use(apiErrorHandler);
  return a;
}

beforeEach(() => {
  vi.clearAllMocks();
  s.getUser.mockResolvedValue(admin);
  s.getQuiz.mockResolvedValue({ id: 'q1', title: 'Deneme', createdBy: 'admin-1' });
});

describe('P-01 adım 1: CSV dışa aktarım', () => {
  it('devam eden sınavda doğru sayısı "-", tamamlananda gerçek sayı', async () => {
    s.getResultsByQuiz.mockResolvedValue([
      { status: 'in_progress', score: null, correctAnswersCount: 0, totalQuestions: 5, timeTaken: null, startedAt: new Date(), student: { name: 'Devam', email: 'd@example.com', studentNo: 1 } },
      { status: 'completed', score: 60, correctAnswersCount: 3, totalQuestions: 5, timeTaken: 90, startedAt: new Date(), student: { name: 'Bitti', email: 'b@example.com', studentNo: 2 } },
    ]);
    const res = await request(app()).get('/api/results/quiz/q1/export').buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks).toString('utf8')));
    }).timeout(5000);
    expect(res.status).toBe(200);
    const rows = String(res.body).split('\r\n').map(line => line.split(';').map(cell => cell.replace(/^"|"$/g, '')));
    const inProgress = rows.find(row => row[0] === 'Devam')!;
    const completed = rows.find(row => row[0] === 'Bitti')!;
    // csvCell, '-' ile başlayan hücrelere formül enjeksiyonuna karşı ' ekler (skor sütunundaki '-' ile aynı kural).
    expect(inProgress[5]).toBe("'-");
    expect(completed[5]).toBe('3');
  });
});
