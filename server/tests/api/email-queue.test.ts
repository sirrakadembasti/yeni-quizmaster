// Integration tests never load real SMTP credentials.

import { describe, it, expect, vi } from 'vitest';
import { storage } from '../../storage';
import { sendResetPasswordEmail } from '../../utils/email';

vi.mock('nodemailer',()=>({default:{createTransport:()=>({sendMail:vi.fn(async()=>({messageId:'test'}))})}}));

describe('Email Queue and Outbox Integration Tests', () => {
  let createdEmailId: string;

  it('enqueues an email into the database with pending status', async () => {
    const queued = await storage.enqueueEmail({
      to: 'test-user@quizmaster.com',
      subject: 'Test Email Subject',
      body: '<p>Test email body</p>',
      type: 'notification',
      maxAttempts: 3,
    });

    expect(queued).toBeDefined();
    expect(queued.id).toBeDefined();
    expect(queued.to).toBe('test-user@quizmaster.com');
    expect(queued.subject).toBe('Test Email Subject');
    expect(queued.status).toBe('pending');
    expect(queued.attempts).toBe(0);

    createdEmailId = queued.id;
  });

  it('retrieves email logs with stats and filtering', async () => {
    const result = await storage.getEmailLogs({
      search: 'test-user@quizmaster.com',
    });

    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.counts).toBeDefined();
    expect(result.counts.total).toBeGreaterThanOrEqual(1);
    expect(result.data[0].to).toBe('test-user@quizmaster.com');
  });

  it('updates email status to failed when delivery fails', async () => {
    const updated = await storage.updateEmailStatus(
      createdEmailId,
      'failed',
      'SMTP connection refused on port 1026'
    );

    expect(updated?.status).toBe('failed');
    expect(updated?.attempts).toBeGreaterThanOrEqual(1);
    expect(updated?.errorMessage).toBe('SMTP connection refused on port 1026');
    expect(updated?.lastAttempt).toBeDefined();
  });

  it('resets email status to pending upon retry request', async () => {
    const retried = await storage.retryEmail(createdEmailId);

    expect(retried).toBeDefined();
    expect(retried?.status).toBe('pending');
    expect(retried?.attempts).toBe(0);
    expect(retried?.errorMessage).toBeNull();
  });

  it('sendResetPasswordEmail pushes a password reset email into the queue', async () => {
    const queued = await sendResetPasswordEmail('student-reset@quizmaster.com', 'sample-random-token-123');

    expect(queued).toBeDefined();
    expect(queued.to).toBe('student-reset@quizmaster.com');
    expect(queued.subject).toContain('Şifre Sıfırlama');
    expect(queued.type).toBe('password_reset');
    expect(queued.body).toContain('sample-random-token-123');

    // Clean up created queue item
    await storage.deleteEmailLog(queued.id);
  });

  it('retrieves system logs accurately', async () => {
    // Create a system log for testing
    const adminUser = await storage.createUser({ name: 'Log test admin', email: 'log-admin@test.local', password: 'hash', role: 'admin' });
    if (adminUser) {
      await storage.createLog(adminUser.id, 'ARCHIVE_YEAR', 'Test Yıl Sonu Arşivi Logu');
    }

    const systemLogs = await storage.getSystemLogs({ search: 'ARCHIVE_YEAR' });
    expect(systemLogs.data).toBeDefined();
    expect(systemLogs.total).toBeGreaterThanOrEqual(1);
    const archiveLog = systemLogs.data.find(l => l.action === 'ARCHIVE_YEAR');
    expect(archiveLog).toBeDefined();
  });

  it('deletes an email log successfully', async () => {
    const success = await storage.deleteEmailLog(createdEmailId);
    expect(success).toBe(true);

    const check = await storage.getEmailLogs({ search: 'test-user@quizmaster.com' });
    const found = check.data.find(e => e.id === createdEmailId);
    expect(found).toBeUndefined();
  });
});
