import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/auth-context';
import SettingsPage from '@/pages/settings';
import AnnouncementsPage from '@/pages/announcements';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { saveOfflineUser } from '@/lib/offline-quiz';
vi.mock('@/lib/offline-quiz', async (importOriginal) => ({ ...await importOriginal<any>(), saveOfflineUser: vi.fn() }));

const fixture = vi.hoisted(() => ({
  user: { id: 'admin', role: 'admin', name: 'Original Admin', email: 'admin@test.com' },
  announcements: vi.fn(), deleteAnnouncement: vi.fn(), updateProfile: vi.fn(), notifications: vi.fn(), logs: vi.fn(), updatePreferences: vi.fn(),
}));
vi.mock('@/lib/api', () => ({
  refreshCsrfToken: async () => 'token',
  authApi: { getCurrentUser: async () => ({ user: fixture.user }), updateProfile: fixture.updateProfile },
  notificationApi: { getUserNotifications: fixture.notifications, getPreferences: async () => ({ muted: false }), updatePreferences: fixture.updatePreferences },
  adminApi: { getLogsMe: fixture.logs },
  announcementApi: { getAllAnnouncements: fixture.announcements, deleteAnnouncement: fixture.deleteAnnouncement },
  classApi: { getAllClasses: async () => ({ classes: [] }) },
}));

let client: QueryClient;
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  window.history.replaceState({}, '', '/settings');
  vi.clearAllMocks();
  fixture.announcements.mockResolvedValue({ announcements: [{ id: 'notice', title: 'Audit notice', content: 'Notice body', targetRole: 'all', createdAt: '2026-09-30T12:00:00Z' }] });
  fixture.deleteAnnouncement.mockResolvedValue({});
  fixture.notifications.mockResolvedValue({ notifications: [] });
  fixture.logs.mockResolvedValue({ logs: [] });
  fixture.updatePreferences.mockRejectedValue(new Error('Mute unavailable'));
  fixture.updateProfile.mockImplementation(async (profile) => ({ user: { ...fixture.user, ...profile } }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); });
function mount(component: React.ReactNode) {
  return render(<QueryClientProvider client={client}><AuthProvider>{component}<Toaster /><SonnerToaster /></AuthProvider></QueryClientProvider>);
}

it('profile save synchronizes the header, clean form and offline identity', async () => {
  mount(<SettingsPage />);
  const name = await screen.findByDisplayValue('Original Admin');
  await userEvent.clear(name);
  await userEvent.type(name, 'Updated Admin');
  await userEvent.click(screen.getByRole('button', { name: /Değişiklikleri Kaydet/ }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Değişiklikleri Kaydet/ })).toBeDisabled());
  expect(screen.getAllByText('Updated Admin').length).toBeGreaterThan(0);
  expect(saveOfflineUser).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Updated Admin' }));
});

it('unsupported settings deep links select the profile panel', async () => {
  window.history.replaceState({}, '', '/settings?tab=unknown');
  mount(<SettingsPage />);
  await screen.findByText('Hesap Ayarları');
  expect(screen.getByRole('tabpanel')).toHaveAttribute('data-state', 'active');
  expect(screen.getByRole('tab', { name: 'Profil Bilgileri' })).toHaveAttribute('aria-selected', 'true');
});

it('valid settings deep links follow browser history back to profile', async () => {
  window.history.replaceState({}, '', '/settings?tab=security');
  mount(<SettingsPage />);
  await screen.findByText('Hesap Ayarları');
  expect(screen.getByRole('tab', { name: 'Güvenlik' })).toHaveAttribute('aria-selected', 'true');
  act(() => { window.history.replaceState({}, '', '/settings'); window.dispatchEvent(new PopStateEvent('popstate')); });
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Profil Bilgileri' })).toHaveAttribute('aria-selected', 'true'));
});

it('announcement fetch errors show retry and recover to the real list', async () => {
  fixture.announcements.mockRejectedValueOnce(new Error('Connection unavailable'));
  mount(<AnnouncementsPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection unavailable');
  expect(screen.queryByText('Henüz bir duyuru yayınlanmamış.')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }));
  expect(await screen.findByText('Audit notice')).toBeInTheDocument();
});

it('personal history fetch errors are distinct from empty history and can be retried', async () => {
  window.history.replaceState({}, '', '/settings?tab=logs');
  fixture.logs.mockRejectedValueOnce(new Error('History unavailable'));
  mount(<SettingsPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('History unavailable');
  expect(screen.queryByText('Herhangi bir işlem geçmişi bulunamadı.')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }));
  expect(await screen.findByText('Herhangi bir işlem geçmişi bulunamadı.')).toBeInTheDocument();
});

it('personal notification fetch errors can be retried without presenting an empty list', async () => {
  window.history.replaceState({}, '', '/settings?tab=notifications');
  fixture.notifications.mockRejectedValue(new Error('Notifications unavailable'));
  mount(<SettingsPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Notifications unavailable');
  fixture.notifications.mockResolvedValue({ notifications: [] });
  await userEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

it('header notification mute failures show actionable feedback', async () => {
  mount(<DashboardLayout>Content</DashboardLayout>);
  await screen.findByText('Original Admin');
  await userEvent.click(screen.getByRole('button', { name: 'Bildirimleri aç' }));
  await userEvent.click(screen.getByRole('button', { name: 'Bildirimleri sessize al' }));
  expect(await screen.findByText(/Bildirim tercihleri güncellenemedi/)).toBeInTheDocument();
});

it('pending announcement deletion disables resubmission and refreshes the list on success', async () => {
  let finish!: () => void;
  fixture.deleteAnnouncement.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  mount(<AnnouncementsPage />);
  await screen.findByText('Audit notice');
  await userEvent.click(screen.getByRole('button', { name: 'Duyuruyu sil' }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sil' }));
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: /Sil/ })).toBeDisabled();
  fixture.announcements.mockResolvedValue({ announcements: [] });
  await act(async () => finish());
  await waitFor(() => expect(screen.queryByText('Audit notice')).not.toBeInTheDocument());
  expect(await screen.findByText('Henüz bir duyuru yayınlanmamış.')).toBeInTheDocument();
});

it('announcement delete asks for named confirmation and cancellation preserves the row', async () => {
  mount(<AnnouncementsPage />);
  await screen.findByText('Audit notice');
  await userEvent.click(screen.getByRole('button', { name: 'Duyuruyu sil' }));
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveTextContent('Audit notice');
  await userEvent.click(within(dialog).getByRole('button', { name: 'İptal' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText('Audit notice')).toBeInTheDocument();
});

it('failed announcement deletion retains confirmation and offers visible retry', async () => {
  fixture.deleteAnnouncement.mockRejectedValueOnce(new Error('Delete unavailable'));
  mount(<AnnouncementsPage />);
  await screen.findByText('Audit notice');
  await userEvent.click(screen.getByRole('button', { name: 'Duyuruyu sil' }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sil' }));
  await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Delete unavailable'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sil' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('mobile menu Escape closes the modal and restores trigger focus', async () => {
  mount(<DashboardLayout><button>Page action</button></DashboardLayout>);
  const trigger = screen.getByRole('button', { name: 'Menüyü aç' });
  await userEvent.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Ana menü' })).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('mobile menu keeps Tab focus inside its controls', async () => {
  mount(<DashboardLayout><button>Page action</button></DashboardLayout>);
  await userEvent.click(screen.getByRole('button', { name: 'Menüyü aç' }));
  const dialog = screen.getByRole('dialog', { name: 'Ana menü' });
  const links = within(dialog).getAllByRole('link');
  links.at(-1)!.focus();
  await userEvent.tab();
  expect(dialog.contains(document.activeElement)).toBe(true);
  const close = within(dialog).getByRole('button', { name: 'Menüyü kapat' });
  close.focus();
  await userEvent.tab({ shift: true });
  expect(links.at(-1)).toHaveFocus();
});
