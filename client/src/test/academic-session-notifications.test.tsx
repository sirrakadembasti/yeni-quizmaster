import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { NotificationListener } from '@/components/NotificationListener';

const mocks = vi.hoisted(() => ({ list: vi.fn(), preferences: vi.fn(), mark: vi.fn(), remove: vi.fn(), mute: vi.fn(), toast: vi.fn(), handlers: new Map<string, (...args: any[]) => void>(), io: vi.fn(), disconnect: vi.fn(), emit: vi.fn(), context: { year: { id: 'past', label: '2025-2026', status: 'closed' }, pending: false, error: '', years: [], selectYear: vi.fn(), reload: vi.fn() } }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'admin-notifications', name: 'Admin', email: 'admin@example.test' }, role: 'admin', isAuthenticated: true, logout: vi.fn() }) }));
vi.mock('@/context/academic-year-context', () => ({ useAcademicYear: () => mocks.context }));
vi.mock('@/components/academic-history/HistoricalWorkspace', () => ({ HistoricalWorkspace: () => <p>Frozen business workspace</p> }));
vi.mock('@/components/layout/ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/lib/api', () => ({ notificationApi: { getUserNotifications: mocks.list, getPreferences: mocks.preferences, markAllAsRead: mocks.mark, deleteNotification: mocks.remove, updatePreferences: mocks.mute } }));
vi.mock('@/lib/versioned-notification-preferences', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/versioned-notification-preferences')>(),
  getVersionedNotificationPreferences: async () => ({ ...await mocks.preferences(), revision: 0 }),
  saveVersionedNotificationPreferences: async (muted: boolean) => ({ preferences: { ...await mocks.mute(muted), revision: 1 }, saved: true }),
}));
vi.mock('socket.io-client', () => ({ io: mocks.io }));
vi.mock('sonner', () => ({ toast: { info: mocks.toast, success: mocks.toast, error: mocks.toast } }));
let client: QueryClient;
const notice = { id: 'current-notice', title: 'Current session announcement', message: 'Current operational notification', type: 'announcement', createdAt: '2026-10-06T10:00:00Z', isRead: false };
beforeEach(() => {
  vi.clearAllMocks(); mocks.handlers.clear(); mocks.context.year.status = 'closed';
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mocks.list.mockResolvedValue({ notifications: [notice], pagination: { unread: 1 } }); mocks.preferences.mockResolvedValue({ muted: false }); mocks.mark.mockResolvedValue({}); mocks.remove.mockResolvedValue({}); mocks.mute.mockResolvedValue({ muted: true });
  mocks.io.mockImplementation(() => ({ on: (event: string, callback: (...args: any[]) => void) => mocks.handlers.set(event, callback), emit: mocks.emit, disconnect: mocks.disconnect }));
});
afterEach(() => { cleanup(); client.clear(); });
function mount(children: React.ReactNode) { render(<QueryClientProvider client={client}>{children}</QueryClientProvider>); }

it('shows explicitly labeled current-session notifications and operational controls while historical business is read only', async () => {
  mount(<DashboardLayout>Live business screen</DashboardLayout>);
  fireEvent.click(screen.getByRole('button', { name: 'Bildirimleri aç' }));
  const panel = screen.getByRole('dialog');
  expect(await within(panel).findByText('Current session announcement')).toBeVisible();
  expect(panel).toHaveTextContent('Mevcut oturum bildirimleri'); expect(screen.getByText('Frozen business workspace')).toBeInTheDocument(); expect(screen.queryByText('Live business screen')).not.toBeInTheDocument();
  expect(within(panel).queryByRole('link', { name: /Detay/ })).not.toBeInTheDocument(); expect(within(panel).queryByRole('link', { name: 'Tüm Bildirimleri Gör' })).not.toBeInTheDocument();
  fireEvent.click(within(panel).getByRole('button', { name: 'Hepsini Oku' })); await waitFor(() => expect(mocks.mark).toHaveBeenCalledTimes(1));
  fireEvent.click(within(panel).getByRole('button', { name: 'Bildirimleri sessize al' })); await waitFor(() => expect(mocks.mute).toHaveBeenCalledWith(true));
  fireEvent.click(within(panel).getByRole('button', { name: 'Bildirimi sil' })); await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('current-notice'));
});
it('keeps notification socket/cache updates in historical mode while suppressing generic business toasts', async () => {
  client.setQueryData(['notifications', 'nav'], { notifications: [], pagination: { page: 1, limit: 5, total: 0, unread: 0, totalPages: 1 } });
  mount(<NotificationListener />); await waitFor(() => expect(mocks.handlers.has('notification')).toBe(true));
  await waitFor(() => expect(client.getQueryData(['notifications', 'preferences', 'versioned', 'admin-notifications'])).toEqual({ muted: false, revision: 0 }));
  await act(async () => { mocks.handlers.get('connect')!(); mocks.handlers.get('notification')!(notice); });
  expect(mocks.emit).toHaveBeenCalledWith('joinUserRoom', 'admin-notifications'); expect(client.getQueryData<any>(['notifications', 'nav']).notifications[0].id).toBe('current-notice');
  expect(mocks.toast).not.toHaveBeenCalled(); expect([...mocks.handlers.keys()]).toEqual(['connect', 'notification']);
});
it('retains generic notification toast behavior in active context', async () => {
  mocks.context.year.status = 'active'; mount(<NotificationListener />);
  await waitFor(() => expect(client.getQueryData(['notifications', 'preferences', 'versioned', 'admin-notifications'])).toEqual({ muted: false, revision: 0 }));
  await act(async () => mocks.handlers.get('notification')!({ ...notice, type: 'success' }));
  expect(mocks.toast).toHaveBeenCalledWith(notice.title, { description: notice.message });
});
