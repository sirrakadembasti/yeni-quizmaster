import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEmailConfiguration, getEmailStatus, sendRegistrationSuccessEmail, verifyEmailTransport } from '../../utils/email';
import { storage } from '../../storage';

vi.mock('../../storage', () => ({
  storage: {
    enqueueEmail: vi.fn(async (data) => ({ id: 'queued-1', status: 'pending', attempts: 0, ...data })),
    claimPendingEmails: vi.fn(async () => []),
  },
}));

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; });

describe('Gmail-only email configuration', () => {
  it('ignores alternative SMTP host, port and secure settings', () => {
    process.env.EMAIL_HOST = 'smtp.other-provider.example';
    process.env.EMAIL_PORT = '2525';
    process.env.EMAIL_SECURE = 'true';
    process.env.EMAIL_USER = 'quizmaster@gmail.com';
    process.env.EMAIL_PASS = 'app-password';
    const config = getEmailConfiguration();
    expect(config.host).toBe('smtp.gmail.com');
    expect(config.port).toBe(587);
    expect(config.secure).toBe(false);
    expect(getEmailStatus().provider).toBe('gmail');
  });

  it('allows only Gmail submission ports 587 and 465', () => {
    process.env.EMAIL_PORT = '465';
    expect(getEmailConfiguration()).toMatchObject({ host: 'smtp.gmail.com', port: 465, secure: true });
    process.env.EMAIL_PORT = '25';
    expect(getEmailConfiguration()).toMatchObject({ host: 'smtp.gmail.com', port: 587, secure: false });
  });

  it('fails explicitly when Gmail credentials are missing', async () => {
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    await expect(verifyEmailTransport()).rejects.toMatchObject({ code: 'GMAIL_NOT_CONFIGURED' });
  });

  it('queues a registration confirmation email with escaped user name and login link', async () => {
    const queued = await sendRegistrationSuccessEmail('ogrenci@quizmaster.com', 'Ali <Yılmaz>');
    expect(storage.enqueueEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'ogrenci@quizmaster.com',
      subject: 'QuizMaster - Kayıt İşleminiz Başarıyla Gerçekleştirildi',
      type: 'registration_welcome',
    }));
    expect(queued.body).toContain('Ali &lt;Yılmaz&gt;');
    expect(queued.body).toContain('kayıt işleminiz başarıyla gerçekleştirilmiştir');
    expect(queued.body).toContain('/auth');
  });
});
