import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import App from '@/App';
vi.mock('@/context/auth-context', () => ({ AuthProvider: ({ children }: any) => children, useAuth: () => ({ user: null, isAuthenticated: false, loading: false }) }));
vi.mock('@/components/NotificationListener', () => ({ NotificationListener: () => null }));
vi.mock('@/pages/home', () => ({ default: () => <div>Home</div> }));
beforeEach(() => { vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })); });
afterEach(() => { toast.dismiss(); cleanup(); vi.unstubAllGlobals(); });
it('application renders Sonner success and error feedback', async () => {
  window.history.replaceState({}, '', '/');
  render(<App />);
  act(() => { toast.success('Profile saved'); toast.error('Request failed'); });
  expect(await screen.findByText('Profile saved')).toBeInTheDocument();
  expect(await screen.findByText('Request failed')).toBeInTheDocument();
});
