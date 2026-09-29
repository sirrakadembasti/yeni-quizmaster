import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import authRouter from '../api-routes/auth';
import { storage } from '../storage';
import bcrypt from 'bcryptjs';

// Mock storage
vi.mock('../storage', () => ({
  storage: {
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getAllUsers: vi.fn(),
    createUser: vi.fn(),
    createNotification: vi.fn(),
    updateUser: vi.fn(),
    createLog: vi.fn()
  }
}));

const app = express();
app.use(express.json());
app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));

// Mock auth middleware to simulate logged in user
app.use((req, res, next) => {
  (req as any).session.userId = 'test-user-id';
  (req as any).user = { id: 'test-user-id', email: 'test@example.com', password: 'hashed-old-password' };
  next();
});

app.use('/auth', authRouter);

describe('Auth Routes - Change Password', () => {
  it('should hash the new password before saving', async () => {
    // Setup mock
    vi.mocked(storage.getUser).mockResolvedValue({
      id: 'test-user-id',
      password: await bcrypt.hash('oldPassword123', 10)
    } as any);
    
    vi.mocked(storage.updateUser).mockResolvedValue({
      id: 'test-user-id',
      password: 'new-hashed-password' // mock return
    } as any);

    const response = await request(app)
      .post('/auth/change-password')
      .send({
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword123'
      });

    // Endpoint should exist and return success
    expect(response.status).toBe(200);
    
    // storage.updateUser should be called with hashed password, not plain text
    expect(storage.updateUser).toHaveBeenCalled();
    const updateCallArg = vi.mocked(storage.updateUser).mock.calls[0][1];
    
    // Expect the passed password to NOT be the plain text password
    expect(updateCallArg.password).not.toBe('newPassword123');
    
    // Verify it is a bcrypt hash
    const isHashed = await bcrypt.compare('newPassword123', updateCallArg.password as string);
    expect(isHashed).toBe(true);
  });
});

describe('Auth Routes - Registration notifications', () => {
  it('creates an admin notification after a new registration', async () => {
    vi.mocked(storage.getUserByEmail).mockResolvedValue(undefined);
    vi.mocked(storage.createUser).mockImplementation(async (data: any) => ({ id: 'new-student', createdAt: new Date(), isActive: true, ...data }) as any);
    vi.mocked(storage.getAllUsers).mockResolvedValue([{ id: 'admin-1', role: 'admin' }] as any);
    vi.mocked(storage.createNotification).mockResolvedValue({ id: 'notification-1' } as any);
    vi.mocked(storage.createLog).mockResolvedValue({} as any);

    const response = await request(app).post('/auth/register').send({ name: 'Yeni Öğrenci', email: 'yeni@example.com', password: 'Parola123' });
    expect(response.status).toBe(200);
    expect(storage.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'admin-1', type: 'registration', title: 'Yeni Üye Kaydı' }));
  });
});
