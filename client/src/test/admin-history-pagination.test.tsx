import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SettingsPage from '@/pages/settings';
import DashboardPage from '@/pages/dashboard';
const fixture = vi.hoisted(() => ({ user: { id: 'admin', name: 'Admin', email: 'admin@test.com', role: 'admin' } }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ role: 'admin', user: fixture.user }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => children }));
vi.mock('@/lib/api', () => ({
  authApi: {}, classApi: {},
  notificationApi: { getUserNotifications: async () => ({ notifications: [] }), getPreferences: async () => ({ muted: false }) },
  dashboardApi: { getAdminStats: async () => ({ stats: { totalQuizzes: 3, totalStudents: 1, totalResults: 2, totalTeachers: 1 } }), getOverview: async () => ({ recentQuizzes: [] }) },
  adminApi: {
    getLogs: async () => ({ logs: [] }),
    getLogsMe: async ({ page = 1, limit = 50, startDate }: { page?: number; limit?: number; startDate?: string } = {}) => {
      const firstPage = Array.from({ length: 50 }, (_, i) => ({ id: String(i), action: 'LOGIN', details: `Recent action ${i}`, createdAt: new Date().toISOString() }));
      // Mirrors the server contract: cutoff must be explicitly requested and applied before paging.
      if (!startDate) return { logs: firstPage, pagination: { page: 1, limit, total: 52, totalPages: 2 } };
      return { logs: page === 1 ? firstPage : [{ id: 'oldest', action: 'LOGIN', details: 'Oldest in-range action', createdAt: new Date().toISOString() }], pagination: { page, limit, total: 51, totalPages: 2 } };
    },
  },
}));
let client: QueryClient;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  window.history.replaceState({}, '', '/settings?tab=logs'); client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); });

it('personal history requests the six-month range and exposes the 51st action through paging', async () => {
  render(<QueryClientProvider client={client}><SettingsPage /></QueryClientProvider>);
  await screen.findByText('Recent action 0');
  expect(screen.getByText('51 İşlem')).toBeInTheDocument();
  expect(screen.getByText('Sayfa 1 / 2')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Sonraki' }));
  expect(await screen.findByText('Oldest in-range action')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sonraki' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Önceki' }));
  expect(await screen.findByText('Recent action 0')).toBeInTheDocument();
});

it('dashboard labels the combined exam/material/survey count as total content', async () => {
  render(<QueryClientProvider client={client}><DashboardPage /></QueryClientProvider>);
  const label = await screen.findByText('Toplam İçerik');
  expect(within(label.closest('[data-slot="card"]') || label.parentElement!.parentElement!).getByText('3')).toBeInTheDocument();
});
