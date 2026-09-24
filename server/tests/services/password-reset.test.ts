import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storage } from '../../storage';
import { sendResetPasswordEmail } from '../../utils/email';
import { hashResetToken, issuePasswordReset } from '../../services/password-reset';

vi.mock('../../storage', () => ({ storage: {
  cancelPendingPasswordResetRequests: vi.fn(), updateUser: vi.fn(), createPasswordResetRequest: vi.fn(), updatePasswordResetRequest: vi.fn(),
} }));
vi.mock('../../utils/email', () => ({ sendResetPasswordEmail: vi.fn() }));

describe('Password reset request service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('revokes old requests, stores only a token hash and links the email queue record', async () => {
    const user = { id: 'user-1', email: 'user@example.com' } as any;
    vi.mocked(storage.createPasswordResetRequest).mockImplementation(async (data) => ({ id: 'request-1', ...data }));
    vi.mocked(sendResetPasswordEmail).mockResolvedValue({ id: 'email-1' } as any);
    vi.mocked(storage.updatePasswordResetRequest).mockResolvedValue({ id: 'request-1', emailQueueId: 'email-1' } as any);
    await issuePasswordReset(user, { requestedBy: 'admin-1', requestIp: '127.0.0.1' });
    expect(storage.cancelPendingPasswordResetRequests).toHaveBeenCalledWith(user.id);
    const resetUpdate = vi.mocked(storage.updateUser).mock.calls[0][1] as any;
    expect(resetUpdate.resetToken).toMatch(/^[a-f0-9]{64}$/);
    const rawToken = vi.mocked(sendResetPasswordEmail).mock.calls[0][1];
    expect(hashResetToken(rawToken)).toBe(resetUpdate.resetToken);
    expect(rawToken).not.toBe(resetUpdate.resetToken);
    expect(storage.updatePasswordResetRequest).toHaveBeenCalledWith('request-1', { emailQueueId: 'email-1', status: 'pending' });
  });
});
