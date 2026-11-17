import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { createRuntimePrismaClient } from '../../utils/sqlite-runtime';
import { storage, closeStorage } from '../../storage';
import { issuePasswordReset } from '../../services/password-reset';
import { processEmailQueue } from '../../utils/email';

vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: vi.fn(async () => ({ messageId: 'test' })) }) } }));

const db = createRuntimePrismaClient();
let user: any;

beforeAll(async () => {
  process.env.EMAIL_USER = 'sender@example.com';
  process.env.EMAIL_PASS = 'test-app-password';
  user = await storage.createUser({ name: 'G06 User', email: 'g06-user@test.local', password: await bcrypt.hash('Password123', 4), role: 'teacher' } as any);
}, 30000);

afterAll(async () => {
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_PASS;
  await db.$disconnect();
  await closeStorage();
});

describe('G-06: sıfırlama token\'ı sızıntısı', () => {
  it('yönetici talep listesi token ve e-posta gövdesi içermez', async () => {
    await issuePasswordReset(user, { requestedBy: null });
    const result = await storage.getPasswordResetRequests({});
    const json = JSON.stringify(result);
    expect(json).not.toContain('token=');
    expect(result.data.length).toBeGreaterThan(0);
    for (const item of result.data) expect(item.emailQueue?.body).toBeUndefined();
  });

  it('gönderilen sıfırlama e-postasının gövdesi silinir', async () => {
    const queued = await storage.enqueueEmail({ to: 'g06-user@test.local', subject: 'Sıfırlama', body: '<a href="https://x/reset-password?token=abc123">link</a>', type: 'password_reset' });
    await processEmailQueue();
    const row = await db.emailQueue.findUnique({ where: { id: queued.id } });
    expect(row?.status).toBe('sent');
    expect(row?.body).not.toContain('token=');
  });

  it('sıfırlama dışı e-postanın gövdesi korunur', async () => {
    const queued = await storage.enqueueEmail({ to: 'g06-user@test.local', subject: 'Bilgi', body: '<p>Merhaba g06</p>', type: 'notification' });
    await processEmailQueue();
    const row = await db.emailQueue.findUnique({ where: { id: queued.id } });
    expect(row?.status).toBe('sent');
    expect(row?.body).toContain('Merhaba g06');
  });

  it('sıfırlama e-postası yeniden gönderilemez', async () => {
    const queued = await storage.enqueueEmail({ to: 'g06-user@test.local', subject: 'Sıfırlama', body: '<p>x</p>', type: 'password_reset' });
    expect(await storage.retryEmail(queued.id)).toBeNull();
  });
});
