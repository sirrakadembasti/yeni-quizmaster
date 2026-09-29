import { afterEach, describe, expect, it } from 'vitest';
import { getEmailConfiguration, getEmailStatus } from '../utils/email';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('SMTP configuration', () => {
  it('reads Gmail settings lazily after module import', () => {
    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_SECURE = 'false';
    process.env.EMAIL_USER = 'quizmaster@gmail.com';
    process.env.EMAIL_PASS = 'app-password';
    process.env.EMAIL_FROM = 'quizmaster@gmail.com';
    process.env.EMAIL_FROM_NAME = 'QuizMaster Okul';

    const config = getEmailConfiguration();
    expect(config).toMatchObject({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: 'quizmaster@gmail.com',
      fromEmail: 'quizmaster@gmail.com',
      fromName: 'QuizMaster Okul',
      authConfigured: true,
    });
    expect(getEmailStatus()).toMatchObject({ provider: 'gmail', authConfigured: true });
    expect(getEmailStatus()).not.toHaveProperty('password');
  });

  it('uses port 465 as secure transport automatically', () => {
    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_PORT = '465';
    process.env.EMAIL_SECURE = 'false';
    expect(getEmailConfiguration().secure).toBe(true);
  });
});