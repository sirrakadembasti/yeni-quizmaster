import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import adminRouter from '../../api-routes/admin';
import { storage } from '../../storage';
import { issuePasswordReset, issueOfflinePasswordReset } from '../../services/password-reset';

vi.mock('../../storage', () => ({ storage: {
  getUser: vi.fn(), getUserByEmail: vi.fn(), getPasswordResetRequests: vi.fn(), getPasswordResetRequest: vi.fn(),
  updatePasswordResetRequest: vi.fn(), updateUser: vi.fn(), createLog: vi.fn(), getEmailLogs: vi.fn(),
} }));
vi.mock('../../services/password-reset', () => ({
  issuePasswordReset: vi.fn(),
  issueOfflinePasswordReset: vi.fn(),
}));

function appForAdmin() {
  const app = express(); app.use(express.json());
  app.use(session({ secret: 'admin-reset', resave: false, saveUninitialized: false }));
  app.use((req, _res, next) => { (req.session as any).userId = 'admin-1'; next(); });
  vi.mocked(storage.getUser).mockResolvedValue({ id: 'admin-1', role: 'admin', email: 'admin@example.com' } as any);
  app.use('/api/admin', adminRouter); return app;
}

describe('Admin password reset requests API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists tracked requests without exposing token values', async () => {
    vi.mocked(storage.getPasswordResetRequests).mockResolvedValue({ data: [{ id: 'r1', email: 'u@example.com', status: 'pending' }], total: 1, counts: { pending: 1 } });
    const response = await request(appForAdmin()).get('/api/admin/password-reset-requests');
    expect(response.status).toBe(200);
    expect(response.body.requests[0].token).toBeUndefined();
  });

  it('lets an admin initiate a reset for an existing user', async () => {
    const admin = { id: 'admin-1', role: 'admin', email: 'admin@example.com' };
    const target = { id: 'user-1', role: 'student', email: 'user@example.com' };
    vi.mocked(storage.getUser).mockResolvedValue(admin as any);
    vi.mocked(storage.getUserByEmail).mockResolvedValue(target as any);
    vi.mocked(issuePasswordReset).mockResolvedValue({ id: 'r1', status: 'pending' } as any);
    vi.mocked(storage.createLog).mockResolvedValue({} as any);
    const response = await request(appForAdmin()).post('/api/admin/password-reset-requests').send({ email: target.email });
    expect(response.status).toBe(201);
    expect(issuePasswordReset).toHaveBeenCalledWith(target, expect.objectContaining({ requestedBy: admin.id }));
  });

  it('never returns token-bearing email bodies in the monitoring API', async () => {
    vi.mocked(storage.getEmailLogs).mockResolvedValue({
      data: [{ id: 'mail-1', to: 'user@example.com', subject: 'Reset', body: '<a href="?token=secret">reset</a>', status: 'sent' }],
      total: 1, counts: { total: 1, sent: 1, pending: 0, failed: 0 },
    } as any);
    const response = await request(appForAdmin()).get('/api/admin/logs/emails');
    expect(response.status).toBe(200);
    expect(response.body.emails[0].body).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('token=secret');
  });

  it('lets an admin generate an offline one-time reset link by email without SMTP', async () => {
    const admin = { id: 'admin-1', role: 'admin', email: 'admin@example.com' };
    const target = { id: 'user-1', role: 'student', email: 'user@example.com' };
    const expiresAt = new Date('2026-11-05T12:00:00.000Z');
    vi.mocked(storage.getUser).mockResolvedValue(admin as any);
    vi.mocked(storage.getUserByEmail).mockResolvedValue(target as any);
    vi.mocked(issueOfflinePasswordReset).mockResolvedValue({
      request: { id: 'r-offline-1', status: 'pending', email: target.email } as any,
      rawToken: 'abc123token',
      resetUrl: 'http://localhost:5000/reset-password?token=abc123token',
      expiresAt,
    });
    vi.mocked(storage.createLog).mockResolvedValue({} as any);

    const response = await request(appForAdmin())
      .post('/api/admin/password-reset-requests/offline-link')
      .send({ email: target.email });

    expect(response.status).toBe(201);
    expect(issueOfflinePasswordReset).toHaveBeenCalledWith(target, expect.objectContaining({ requestedBy: admin.id }));
    expect(response.body.resetUrl).toBe('http://localhost:5000/reset-password?token=abc123token');
    expect(response.body.request.id).toBe('r-offline-1');
  });

  it('lets an admin regenerate an offline one-time reset link from an existing request row', async () => {
    const admin = { id: 'admin-1', role: 'admin', email: 'admin@example.com' };
    const target = { id: 'user-1', role: 'student', email: 'user@example.com' };
    const expiresAt = new Date('2026-11-05T12:00:00.000Z');
    vi.mocked(storage.getUser)
      .mockResolvedValueOnce(admin as any)
      .mockResolvedValueOnce(target as any);
    vi.mocked(storage.getPasswordResetRequest).mockResolvedValue({
      id: 'r-old',
      userId: target.id,
      email: target.email,
      status: 'pending',
    } as any);
    vi.mocked(issueOfflinePasswordReset).mockResolvedValue({
      request: { id: 'r-offline-2', status: 'pending', email: target.email } as any,
      rawToken: 'xyz789token',
      resetUrl: 'http://localhost:5000/reset-password?token=xyz789token',
      expiresAt,
    });
    vi.mocked(storage.createLog).mockResolvedValue({} as any);

    const response = await request(appForAdmin())
      .post('/api/admin/password-reset-requests/r-old/offline-link');

    expect(response.status).toBe(200);
    expect(issueOfflinePasswordReset).toHaveBeenCalledWith(target, expect.objectContaining({ requestedBy: admin.id }));
    expect(response.body.resetUrl).toBe('http://localhost:5000/reset-password?token=xyz789token');
    expect(response.body.request.id).toBe('r-offline-2');
  });
});
