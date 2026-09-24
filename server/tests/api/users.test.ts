import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import userRouter from '../../api-routes/user';
import { storage } from '../../storage';
import bcrypt from 'bcryptjs';

vi.mock('../../storage', () => ({
  storage: {
    getAllUsers: vi.fn(),
    getClassesByTeacher: vi.fn(),
    getStudentsByClass: vi.fn(),
    getStudentsByTeacher: vi.fn(),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    getUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    updateUserRole: vi.fn(),
  }
}));

const createTestApp = (user: { id: string, role: string, email?: string }) => {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));

  // Mock session middleware
  app.use((req, res, next) => {
    (req as any).session.userId = user.id;
    next();
  });

  app.use('/api/users', userRouter);
  return app;
};

describe('Users API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/users', () => {
    it('should return all users for admin', async () => {
      const adminUser = { id: 'admin-1', role: 'admin' };
      const app = createTestApp(adminUser);
      
      // Mock requireAuth storage.getUser
      vi.mocked(storage.getUser).mockResolvedValue(adminUser as any);
      
      const mockUsers = [
        { id: '1', name: 'User 1', role: 'student', password: 'hashed' },
        { id: '2', name: 'User 2', role: 'teacher', password: 'hashed' }
      ];
      vi.mocked(storage.getAllUsers).mockResolvedValue(mockUsers as any);

      const res = await request(app).get('/api/users');

      expect(res.status).toBe(200);
      expect(storage.getAllUsers).toHaveBeenCalled();
      // Passwords should be sanitized
      expect(res.body.users).toHaveLength(2);
      expect(res.body.users[0].password).toBeUndefined();
    });

    it('should return teacher and their students for teacher', async () => {
      const teacherUser = { id: 'teacher-1', role: 'teacher' };
      const app = createTestApp(teacherUser);
      
      vi.mocked(storage.getUser).mockResolvedValue(teacherUser as any);
      
      const mockStudents = [{ id: 'student-1', role: 'student', password: 'hashed' }];
      vi.mocked(storage.getStudentsByTeacher).mockResolvedValue(mockStudents as any);

      const res = await request(app).get('/api/users');

      expect(res.status).toBe(200);
      expect(storage.getStudentsByTeacher).toHaveBeenCalledWith('teacher-1');
      expect(res.body.users).toHaveLength(2); // Teacher + 1 Student
    });

    it('should return 403 for student', async () => {
      const studentUser = { id: 'student-1', role: 'student' };
      const app = createTestApp(studentUser);
      
      vi.mocked(storage.getUser).mockResolvedValue(studentUser as any);

      const res = await request(app).get('/api/users');

      expect(res.status).toBe(403); // requireRole(["admin", "teacher"]) should block
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('persists teacher course and class assignments, including explicit empty lists', async () => {
      const admin = { id: 'admin-1', role: 'admin' };
      const teacher = { id: 'teacher-1', role: 'teacher', email: 'teacher@example.com' };
      const app = createTestApp(admin);
      vi.mocked(storage.getUser).mockImplementation(async (id) => id === admin.id ? admin as any : teacher as any);
      vi.mocked(storage.updateUser).mockResolvedValue(teacher as any);

      const response = await request(app).patch('/api/users/teacher-1').send({ assignedCategoryIds: [], classIds: [] });

      expect(response.status).toBe(200);
      expect(storage.updateUser).toHaveBeenCalledWith('teacher-1', expect.objectContaining({ assignedCategoryIds: [], classIds: [] }));
    });

    it('should allow student to update their own profile', async () => {
      const studentUser = { id: 'student-1', role: 'student' };
      const app = createTestApp(studentUser);
      
      vi.mocked(storage.getUser).mockImplementation(async (id) => {
        if (id === 'student-1') return studentUser as any;
        return null;
      });
      
      vi.mocked(storage.updateUser).mockResolvedValue({ ...studentUser, name: 'New Name' } as any);

      const res = await request(app)
        .patch('/api/users/student-1')
        .send({ name: 'New Name', role: 'admin' }); // trying to escalate role

      expect(res.status).toBe(200);
      expect(storage.updateUser).toHaveBeenCalled();
      
      const updateArg = vi.mocked(storage.updateUser).mock.calls[0][1];
      expect(updateArg.name).toBe('New Name');
      expect(updateArg.role).toBeUndefined(); // Escapation should be blocked
    });

    it('should block student from updating another user', async () => {
      const studentUser = { id: 'student-1', role: 'student' };
      const app = createTestApp(studentUser);
      
      const targetUser = { id: 'student-2', role: 'student' };
      
      vi.mocked(storage.getUser).mockImplementation(async (id) => {
        if (id === 'student-1') return studentUser as any;
        if (id === 'student-2') return targetUser as any;
        return null;
      });

      const res = await request(app)
        .patch('/api/users/student-2')
        .send({ name: 'New Name' });

      expect(res.status).toBe(403);
    });
  });
});

describe('Admin student and parent data updates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes parent fields through the API when an admin updates a student', async () => {
    const admin = { id: 'admin-1', role: 'admin', email: 'admin@example.com' };
    const student = { id: 'student-1', role: 'student', email: 'student@example.com' };
    const app = createTestApp(admin);
    vi.mocked(storage.getUser).mockImplementation(async (id) => id === admin.id ? admin as any : student as any);
    vi.mocked(storage.updateUser).mockImplementation(async (_id, data) => ({ ...student, ...data }) as any);

    const payload = {
      name: 'Updated Student',
      parentName: 'Ayşe Veli',
      parentRelation: 'Anne',
      parentPhone: '05550000000',
      parentEmail: 'veli@example.com',
      parentAddress: 'Test adresi',
    };
    const response = await request(app).patch('/api/users/student-1').send(payload);

    expect(response.status).toBe(200);
    expect(storage.updateUser).toHaveBeenCalledWith('student-1', expect.objectContaining(payload));
    expect(response.body.user.parentName).toBe('Ayşe Veli');
  });
});
