import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import userRouter from '../../api-routes/user';
import parentRouter from '../../api-routes/parent';
import { apiErrorHandler } from '../../middleware/error-handler';
import { storage } from '../../storage';

vi.mock('../../socket', () => ({
  disconnectUserSockets: vi.fn(),
  disconnectSessionSockets: vi.fn(),
}));

vi.mock('../../utils/email', () => ({
  sendRegistrationSuccessEmail: vi.fn(async () => ({ id: 'email-1' })),
}));

vi.mock('../../storage', () => ({
  storage: {
    getUser: vi.fn(),
    updateUserRole: vi.fn(),
    getGuardianStudents: vi.fn(),
  },
}));

const createTestApp = (userId: string) => {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
  app.use((req, _res, next) => {
    (req as any).session.userId = userId;
    next();
  });
  app.use('/api/users', userRouter);
  app.use('/api/parents', parentRouter);
  app.use(apiErrorHandler);
  return app;
};

describe('async rota hataları küresel hata işleyicisine düşer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('var olmayan kullanıcının rolü değiştirilirse 404 döner', async () => {
    const admin = { id: 'admin-1', role: 'admin', isActive: true };
    vi.mocked(storage.getUser).mockImplementation(async (id: string) => (id === 'admin-1' ? admin : undefined) as any);

    const res = await request(createTestApp('admin-1'))
      .patch('/api/users/yok/role')
      .send({ role: 'teacher' })
      .timeout(5000);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Kullanıcı bulunamadı.');
  });

  it('storage hatası 500 ve genel ileti döner, iç hata sızmaz', async () => {
    const admin = { id: 'admin-1', role: 'admin', isActive: true };
    vi.mocked(storage.getUser).mockImplementation(async (id: string) => ({ ...admin, id, role: id === 'admin-1' ? 'admin' : 'student' }) as any);
    vi.mocked(storage.updateUserRole).mockRejectedValue(new Error('P2025 Record to update not found'));

    const res = await request(createTestApp('admin-1'))
      .patch('/api/users/u1/role')
      .send({ role: 'teacher' })
      .timeout(5000);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'Dahili Sunucu Hatası' });
    expect(JSON.stringify(res.body)).not.toContain('P2025');
  });

  it('veli rotasında storage hatası 500 JSON döner', async () => {
    vi.mocked(storage.getUser).mockResolvedValue({ id: 'parent-1', role: 'parent', isActive: true } as any);
    vi.mocked(storage.getGuardianStudents).mockRejectedValue(new Error('db kapalı'));

    const res = await request(createTestApp('parent-1'))
      .get('/api/parents/students')
      .timeout(5000);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'Dahili Sunucu Hatası' });
  });
});
