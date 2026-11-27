import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';

vi.mock('../../storage', () => {
  const fns: Record<string, any> = {};
  return { storage: new Proxy(fns, { get: (target, key: string | symbol) => (typeof key === 'symbol' || key === 'then' ? undefined : (target[key] ??= vi.fn())) }) };
});
vi.mock('../../utils/class-authorization', () => ({ canAccessClass: vi.fn(async () => true), canAssignClasses: vi.fn(async () => true) }));

import { storage } from '../../storage';
import classRouter from '../../api-routes/class';
import { apiErrorHandler } from '../../middleware/error-handler';

const s = storage as any;
const classId = '11111111-1111-4111-8111-111111111111';

function app() {
  const a = express();
  a.use(express.json());
  a.use(session({ secret: 'class-error-test', resave: false, saveUninitialized: false }));
  a.use((req, _res, next) => { req.session.userId = 'admin-1'; next(); });
  a.use('/api/classes', classRouter);
  a.use(apiErrorHandler);
  return a;
}
const codeError = (code: string, message = code) => Object.assign(new Error(message), { code });

beforeEach(() => {
  vi.clearAllMocks();
  s.getUser.mockResolvedValue({ id: 'admin-1', role: 'admin', isActive: true, sessionVersion: 0 });
});

describe('sınıf rotaları: depodan gelen hata kodları', () => {
  const create = () => request(app()).post('/api/classes').send({ name: 'Yeni Sınıf' }).timeout(5000);
  const update = () => request(app()).patch(`/api/classes/${classId}`).send({ name: 'Yeni Sınıf' }).timeout(5000);
  const remove = () => request(app()).delete(`/api/classes/${classId}`).timeout(5000);

  it.each([['POST', create, 'createClass'], ['PATCH', update, 'updateClass']] as const)('%s: CLASS_EXISTS → 400', async (_name, call, method) => {
    s[method].mockRejectedValue(new Error('CLASS_EXISTS'));
    const res = await call();
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Bu isimde bir sınıf zaten mevcut.');
  });

  it.each([['POST', create, 'createClass'], ['PATCH', update, 'updateClass']] as const)('%s: INVALID_CLASS_TEACHER → 400', async (_name, call, method) => {
    s[method].mockRejectedValue(new Error('INVALID_CLASS_TEACHER'));
    const res = await call();
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Aktif bir öğretmen seçin.');
  });

  it('CLASS_EXISTS, hata kodu `code` alanında gelse de aynı yanıtı verir', async () => {
    s.createClass.mockRejectedValue(codeError('CLASS_EXISTS', 'herhangi bir metin'));
    const res = await create();
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Bu isimde bir sınıf zaten mevcut.');
  });

  it('DELETE: CLASS_NOT_EMPTY → 409 ve depodaki açıklayıcı ileti', async () => {
    s.deleteClass.mockRejectedValue(codeError('CLASS_NOT_EMPTY', 'Önce sınıfı boşaltın.'));
    const res = await remove();
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Önce sınıfı boşaltın.');
  });

  it('DELETE: P2003 → 409', async () => {
    s.deleteClass.mockRejectedValue(codeError('P2003'));
    const res = await remove();
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Sınıf, yıl geçiş kurallarında kullanılıyor.');
  });

  it('DELETE: bilinmeyen hata → 500', async () => {
    s.deleteClass.mockRejectedValue(new Error('beklenmedik'));
    expect((await remove()).status).toBe(500);
  });
});
