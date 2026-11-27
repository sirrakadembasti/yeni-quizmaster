import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/auth-context';
import AnnouncementsPage from '@/pages/announcements';

const fixture = vi.hoisted(() => ({
  user: { id: 'teacher-1', role: 'teacher', name: 'Öğretmen', email: 't@test.com' } as any,
  announcements: vi.fn(),
}));
vi.mock('@/lib/offline-quiz', async (importOriginal) => ({ ...await importOriginal<any>(), saveOfflineUser: vi.fn() }));
vi.mock('@/lib/api', () => ({
  refreshCsrfToken: async () => 'token',
  authApi: { getCurrentUser: async () => ({ user: fixture.user }) },
  notificationApi: { getUserNotifications: async () => ({ notifications: [] }), getPreferences: async () => ({ muted: false }) },
  adminApi: { getLogsMe: async () => ({ logs: [] }) },
  announcementApi: { getAllAnnouncements: fixture.announcements, deleteAnnouncement: vi.fn() },
  classApi: { getAllClasses: async () => ({ classes: [] }) },
}));

const base = { content: 'İçerik', targetRole: 'student', createdAt: '2026-09-30T12:00:00Z', creator: { name: 'X', role: 'teacher' } };
let client: QueryClient;
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  fixture.user = { id: 'teacher-1', role: 'teacher', name: 'Öğretmen', email: 't@test.com' };
  fixture.announcements.mockResolvedValue({ announcements: [
    { ...base, id: 'own', title: 'Benim duyurum', createdBy: 'teacher-1' },
    { ...base, id: 'admin-notice', title: 'Yönetici duyurusu', createdBy: 'admin-1', targetRole: 'all', creator: { name: 'Y', role: 'admin' } },
  ] });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); });

function mount() {
  return render(<QueryClientProvider client={client}><AuthProvider><AnnouncementsPage /></AuthProvider></QueryClientProvider>);
}

it('öğretmen yalnız kendi duyurusunda silme düğmesini görür', async () => {
  mount();
  await screen.findByText('Benim duyurum');
  expect(screen.getAllByRole('button', { name: 'Duyuruyu sil' })).toHaveLength(1);
});

it('yönetici her duyuruda silme düğmesini görür', async () => {
  fixture.user = { id: 'admin-1', role: 'admin', name: 'Yönetici', email: 'a@test.com' };
  mount();
  await screen.findByText('Benim duyurum');
  expect(screen.getAllByRole('button', { name: 'Duyuruyu sil' })).toHaveLength(2);
});
