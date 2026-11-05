import { describe, it, expect, vi } from 'vitest';
const fake = vi.hoisted(() => ({
  sendMail: vi.fn(async () => { throw new Error('temporary SMTP failure'); }),
  claim: vi.fn(), update: vi.fn(async () => null),
}));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: fake.sendMail }) } }));
vi.mock('../../storage', () => ({ storage: { claimPendingEmails: fake.claim, updateEmailStatus: fake.update } }));
import { processEmailQueue } from '../../utils/email';
describe('email worker retries', () => {
  it('attempts a failing message only once per worker pass and retries next pass', async () => {
    process.env.EMAIL_USER = 'test@gmail.com';
    process.env.EMAIL_PASS = 'test-only';
    const message = { id: 'email-1', to: 'recipient@example.com', subject: 'test', body: 'test',
      attempts: 0, maxAttempts: 3, processingUntil: new Date() };
    fake.claim.mockImplementation(async (_limit, excluded: string[] = []) => excluded.includes(message.id) ? [] : [message]);
    await processEmailQueue();
    expect(fake.sendMail).toHaveBeenCalledTimes(1);
    expect(fake.update).toHaveBeenCalledWith(message.id, 'pending', 'temporary SMTP failure', message.processingUntil);
    await processEmailQueue();
    expect(fake.sendMail).toHaveBeenCalledTimes(2);
  });
});
