import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPasswordPage from '@/pages/reset-password';

const boundary = vi.hoisted(() => ({ reset: vi.fn(), toast: vi.fn(), navigate: vi.fn() }));
vi.mock('@/lib/api', () => ({ authApi: { resetPassword: (...args: unknown[]) => boundary.reset(...args) } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: boundary.toast }) }));
vi.mock('wouter', () => ({ useLocation: () => ['/reset-password', boundary.navigate] }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('blocks repeated form submits while pending and allows retry after failure', async () => {
  window.history.replaceState({}, '', '/reset-password?token=synthetic-reset-token');
  let rejectRequest!: (error: Error) => void;
  boundary.reset.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject; }));
  render(<ResetPasswordPage />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Yeni Şifre'), 'SyntheticPassword2026!');
  await user.type(screen.getByLabelText('Şifreyi Onayla'), 'SyntheticPassword2026!');
  const button = screen.getByRole('button', { name: 'Şifreyi Güncelle' });
  await user.click(button);
  expect(button).toBeDisabled();
  expect(button).toHaveTextContent('Güncelleniyor');
  // Form submission also covers Enter/programmatic submit, bypassing the button.
  fireEvent.submit(button.closest('form')!);
  expect(boundary.reset).toHaveBeenCalledTimes(1);
  await act(async () => rejectRequest(new Error('Synthetic reset rejection')));
  await waitFor(() => expect(button).toBeEnabled());
  expect(screen.getByLabelText('Yeni Şifre')).toHaveValue('SyntheticPassword2026!');
  expect(boundary.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Synthetic reset rejection' }));
  boundary.reset.mockRejectedValueOnce(new Error('Retry rejection'));
  await user.click(button);
  await waitFor(() => expect(boundary.reset).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(button).toBeEnabled());
});
