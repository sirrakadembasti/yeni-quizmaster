import { afterEach, describe, expect, it } from 'vitest';
import { getEmailConfiguration, getEmailStatus, verifyEmailTransport } from '../../utils/email';

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
});
