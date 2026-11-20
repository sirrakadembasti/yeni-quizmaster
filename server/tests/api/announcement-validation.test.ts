import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';

vi.mock('../../storage', () => {
  const fns: Record<string, any> = {};
  return { storage: new Proxy(fns, { get: (target, key: string | symbol) => (typeof key === 'symbol' || key === 'then' ? undefined : (target[key] ??= vi.fn())) }) };
});
vi.mock('../../socket', () => ({ getIO: () => ({ to: () => ({ emit: () => undefined }) }) }));
vi.mock('../../utils/class-authorization', () => ({ canAssignClasses: vi.fn(async () => true) }));

import { storage } from '../../storage';
import announcementRouter from '../../api-routes/announcement';
import { apiErrorHandler } from '../../middleware/error-handler';

const s = storage as any;
const classId = '11111111-1111-4111-8111-111111111111';
const users: Record<string, any> = {
  'admin-1': { id: 'admin-1', role: 'admin', isActive: true, sessionVersion: 0 },
  'teacher-1': { id: 'teacher-1', role: 'teacher', isActive: true, sessionVersion: 0 },
  'teacher-2': { id: 'teacher-2', role: 'teacher', isActive: true, sessionVersion: 0 },
};

function app(userId: string) {
  const a = express();
  a.use(express.json());
  a.use(session({ secret: 's07-test', resave: false, saveUninitialized: false }));
  a.use((req, _res, next) => { req.session.userId = userId; next(); });
  a.use('/api/announcements', announcementRouter);
  a.use(apiErrorHandler);
  return a;
}

beforeEach(() => {
  vi.clearAllMocks();
  s.getUser.mockImplementation(async (id: string) => users[id]);
  s.createAnnouncement.mockImplementation(async (d: any) => ({ id: 'a1', ...d }));
  s.getAllUsers.mockResolvedValue([]);
  s.createLog.mockResolvedValue(undefined);
});

describe('S-07: duyuru oluşturma doğrulaması', () => {
  const post = (body: any, userId = 'admin-1') => request(app(userId)).post('/api/announcements').send(body).timeout(5000);

  it('content nesne ise 400', async () => {
    const res = await post({ title: 'Başlık', content: { a: 1 } });
    expect(res.status).toBe(400);
    expect(s.createAnnouncement).not.toHaveBeenCalled();
  });

  it('6000 karakterlik içerik 400', async () => {
    const res = await post({ title: 'Başlık', content: 'x'.repeat(6000) });
    expect(res.status).toBe(400);
  });

  it('çok kısa ya da çok uzun başlık 400', async () => {
    expect((await post({ title: 'ab', content: 'İçerik' })).status).toBe(400);
    expect((await post({ title: 'x'.repeat(151), content: 'İçerik' })).status).toBe(400);
  });

  it('geçersiz targetRole yönetici için de 400', async () => {
    const res = await post({ title: 'Başlık', content: 'İçerik', targetRole: 'hacker' });
    expect(res.status).toBe(400);
  });

  it('geçersiz targetClassId 400', async () => {
    const res = await post({ title: 'Başlık', content: 'İçerik', targetClassId: 'x' });
    expect(res.status).toBe(400);
  });

  it('geçerli duyuru 201 döner', async () => {
    const res = await post({ title: 'Başlık', content: 'İçerik', targetRole: 'all' });
    expect(res.status).toBe(201);
  });

  it('bildirim iletisi 500 karaktere kısaltılır', async () => {
    s.getAllUsers.mockResolvedValue([{ id: 'u1', role: 'student', isActive: true, classId: null }]);
    s.createNotification.mockImplementation(async (d: any) => d);
    const res = await post({ title: 'Başlık', content: 'y'.repeat(4000), targetRole: 'all' });
    expect(res.status).toBe(201);
    expect(s.createNotification).toHaveBeenCalled();
    expect(s.createNotification.mock.calls[0][0].message.length).toBeLessThanOrEqual(500);
  });
});

describe('S-07: duyuru silme', () => {
  const del = (userId: string) => request(app(userId)).delete('/api/announcements/a1').timeout(5000);

  it('öğretmen kendi duyurusunu siler → 200', async () => {
    s.getAnnouncement.mockResolvedValue({ id: 'a1', createdBy: 'teacher-1' });
    s.deleteAnnouncement.mockResolvedValue(undefined);
    const res = await del('teacher-1');
    expect(res.status).toBe(200);
    expect(s.deleteAnnouncement).toHaveBeenCalledWith('a1');
  });

  it('öğretmen başkasının duyurusunu silemez → 403', async () => {
    s.getAnnouncement.mockResolvedValue({ id: 'a1', createdBy: 'teacher-2' });
    const res = await del('teacher-1');
    expect(res.status).toBe(403);
    expect(s.deleteAnnouncement).not.toHaveBeenCalled();
  });

  it('yönetici herhangi birini siler → 200', async () => {
    s.getAnnouncement.mockResolvedValue({ id: 'a1', createdBy: 'teacher-2' });
    s.deleteAnnouncement.mockResolvedValue(undefined);
    expect((await del('admin-1')).status).toBe(200);
  });

  it('olmayan duyuru → 404', async () => {
    s.getAnnouncement.mockResolvedValue(undefined);
    expect((await del('admin-1')).status).toBe(404);
  });
});
