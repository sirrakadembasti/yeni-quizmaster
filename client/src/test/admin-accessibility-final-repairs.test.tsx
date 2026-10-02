import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Archive from '@/pages/admin/archive';
import Management from '@/pages/admin-management';
import StudentResults from '@/pages/student-results';

vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ role: 'admin', user: { id: 'admin', name: 'Audit Admin' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/api', () => ({
  categoryApi: { getAllCategories: async () => [{ id: 'course', name: 'Türkçe', description: 'Dil dersi', createdAt: '2026-10-01T00:00:00Z' }] },
  classApi: { getAllClasses: async () => ({ classes: [{ id: 'class-a', name: '1-A' }, { id: 'class-b', name: '2-A' }] }) },
  userApi: { getAllUsers: async () => ({ users: [] }) },
  quizApi: { getAllAdminQuizzes: async () => ({ quizzes: [] }) },
  adminApi: { getArchiveCandidates: async () => ({ quizzes: 2, results: 7 }), getLogs: async () => ({ logs: [] }) },
  resultApi: { getStudentResults: async () => ({ results: [] }) },
}));

let client: QueryClient;
beforeEach(() => {
  window.history.replaceState({}, '', '/student/results');
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); });
function mount(element: React.ReactNode) { render(<QueryClientProvider client={client}>{element}</QueryClientProvider>); }

it('archive year and promotion selectors have meaningful visible-label names', async () => {
  mount(<Archive />);
  const user = userEvent.setup();
  await screen.findByRole('tab', { name: 'Sınav Arşivi' });
  expect.soft(screen.getByPlaceholderText('Örn: 2025-2026 Eğitim Yılı')).toHaveAccessibleName('Eğitim Yılı Etiketi');
  await user.click(screen.getByRole('tab', { name: 'Sınıf Atlatma' }));
  const selectors = screen.getAllByRole('combobox');
  expect(selectors).toHaveLength(2);
  expect.soft(selectors[0]).toHaveAccessibleName('Mevcut Sınıf (Kaynak)');
  expect.soft(selectors[1]).toHaveAccessibleName('Yeni Sınıf (Hedef)');
});

it('student report search and filters expose names independent of their selected values', async () => {
  mount(<StudentResults />);
  await screen.findByRole('button', { name: 'Excel' });
  expect.soft(screen.getByPlaceholderText('Başlık ile ara...')).toHaveAccessibleName('Sınav Adı');
  const selectors = screen.getAllByRole('combobox');
  expect(selectors).toHaveLength(3);
  for (const [index, name] of ['Ders / Kategori', 'Başarı Durumu', 'Sıralama Ölçütü'].entries()) {
    expect.soft(selectors[index]).toHaveAccessibleName(name);
  }
});

it.each([
  { opener: 'Yeni Ders Ekle', dialog: 'Yeni Ders Kaydı' },
  { opener: 'Türkçe dersini düzenle', dialog: 'Dersi Güncelle' },
])('category dialog Escape restores focus to its $opener opener', async ({ opener, dialog }) => {
  mount(<Management />);
  const user = userEvent.setup();
  const trigger = await screen.findByRole('button', { name: opener });
  trigger.focus();
  await user.keyboard('{Enter}');
  const modal = await screen.findByRole('dialog', { name: dialog });
  expect(modal.contains(document.activeElement)).toBe(true);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
});
