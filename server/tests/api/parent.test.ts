import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import parentRouter from '../../api-routes/parent';
import { storage } from '../../storage';

vi.mock('../../storage', () => ({
  storage: {
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getGuardianStudents: vi.fn(),
    getStudentGuardians: vi.fn(),
    getResultsByStudent: vi.fn(),
    getAllQuizzes: vi.fn(),
    getAllUsers: vi.fn(),
    createUser: vi.fn(),
    linkGuardianStudent: vi.fn(),
    unlinkGuardianStudent: vi.fn(),
    createLog: vi.fn(),
  },
}));

const parentId = '11111111-1111-4111-8111-111111111111';
const studentId = '22222222-2222-4222-8222-222222222222';
const adminId = '33333333-3333-4333-8333-333333333333';

function createApp(user: { id: string; role: string }) {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'parent-test', resave: false, saveUninitialized: false }));
  app.use((req, _res, next) => { (req.session as any).userId = user.id; next(); });
  vi.mocked(storage.getUser).mockImplementation(async (id) => id === user.id ? user as any : undefined);
  app.use('/api/parents', parentRouter);
  return app;
}

describe('Parent API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only students linked to the signed-in parent', async () => {
    vi.mocked(storage.getGuardianStudents).mockResolvedValue([{ studentId, relation: 'Anne', student: { id: studentId, name: 'Ada', role: 'student' } }] as any);
    const response = await request(createApp({ id: parentId, role: 'parent' })).get('/api/parents/students');
    expect(response.status).toBe(200);
    expect(storage.getGuardianStudents).toHaveBeenCalledWith(parentId);
    expect(response.body.students).toEqual([{ id: studentId, name: 'Ada', role: 'student', relation: 'Anne' }]);
  });

  it('blocks a parent from opening an unlinked student overview', async () => {
    vi.mocked(storage.getGuardianStudents).mockResolvedValue([]);
    const response = await request(createApp({ id: parentId, role: 'parent' })).get(`/api/parents/students/${studentId}/overview`);
    expect(response.status).toBe(403);
    expect(storage.getResultsByStudent).not.toHaveBeenCalled();
  });

  it('creates a parent account with a hashed password and links the student', async () => {
    const admin = { id: adminId, role: 'admin' };
    const student = { id: studentId, role: 'student' };
    const app = createApp(admin);
    vi.mocked(storage.getUser).mockImplementation(async (id) => id === adminId ? admin as any : id === studentId ? student as any : undefined);
    vi.mocked(storage.getUserByEmail).mockResolvedValue(undefined);
    vi.mocked(storage.createUser).mockImplementation(async (data: any) => ({ id: parentId, createdAt: new Date(), ...data }) as any);
    vi.mocked(storage.linkGuardianStudent).mockResolvedValue({ guardianId: parentId, studentId } as any);
    vi.mocked(storage.createLog).mockResolvedValue({} as any);

    const response = await request(app).post('/api/parents').send({
      name: 'Ayşe Veli', email: 'veli@example.com', password: 'Parola123', studentId, relation: 'Anne',
    });
    expect(response.status).toBe(201);
    const created = vi.mocked(storage.createUser).mock.calls[0][0] as any;
    expect(created.role).toBe('parent');
    expect(created.password).not.toBe('Parola123');
    expect(response.body.parent.password).toBeUndefined();
    expect(storage.linkGuardianStudent).toHaveBeenCalledWith(parentId, studentId, 'Anne');
  });
});
