import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ArchivePage from '@/pages/admin/archive';
import ServerSetupPage from '@/pages/server-setup';
import ManagementPage from '@/pages/admin-management';
const mocks = vi.hoisted(() => ({ status: vi.fn(), logs: vi.fn(), retention: vi.fn(), confirm: vi.fn(() => true) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => children }));
vi.mock('@/lib/archive-api', () => ({ archiveApi: {
  years: async () => ({ years: [{ id: 'year', label: '2026-2027', status: 'active', scheduledCloseAt: '2027-07-14T21:05:00Z' }] }),
  jobs: async () => ({ jobs: Array.from({ length: 21 }, (_, i) => ({ id: String(i), label: `Archived exam ${i}`, status: 'completed', mode: 'manual', attempts: 1 })) }),
  rules: async () => ({ rules: [] }), preview: async () => ({ quizzes: 1, results: 7, surveySubmissions: 0, questions: 2 }),
} }));
vi.mock('@/lib/api', () => ({
  classApi: { getAllClasses: async () => ({ classes: [] }) }, userApi: { getAllUsers: async () => ({ users: [] }) }, categoryApi: { getAllCategories: async () => [] },
  quizApi: { getAllAdminQuizzes: async () => ({ quizzes: [{ id: 'q1', title: 'Selected exam', status: 'published', contentType: 'exam' }] }) },
  adminApi: { getArchiveCandidates: async () => ({ quizzes: 2, results: 7 }), archiveYear: vi.fn(), getLogs: mocks.logs },
  deploymentApi: { getStatus: mocks.status, runRetention: mocks.retention },
}));
let client: QueryClient;
const config = { mode: 'subdomain', publicUrl: 'https://school.example.test', basePath: '/', allowedOrigins: ['https://school.example.test'], trustProxyHops: 1, retention: { enabled: false, actionLogDays: 365, readNotificationDays: 180, emailLogDays: 90, passwordResetDays: 90 } };
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('confirm', mocks.confirm);
  mocks.logs.mockImplementation(async ({ page = 1 } = {}) => ({ logs: [{ id: String(page), action: 'LOGIN', details: `Action page ${page}`, user: { name: 'Admin', role: 'admin' }, timestamp: new Date().toISOString() }], pagination: { page, limit: 50, total: 51, totalPages: 2 } }));
  mocks.status.mockResolvedValue({ config, runtimeChangesAllowed: true, checks: { email: {} }, detected: {}, artifacts: {} });
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); });
function mount(component: any) { render(<QueryClientProvider client={client}>{component}</QueryClientProvider>); }
it('archive history exposes the twenty-first record', async () => {
  mount(<ArchivePage />);
  await screen.findByRole('tab', { name: 'Geçmiş ve İşler' });
  await userEvent.click(screen.getByRole('tab', { name: 'Geçmiş ve İşler' }));
  await screen.findByText(/Archived exam 0/);
  await userEvent.click(screen.getByRole('button', { name: 'Sonraki' }));
  expect(await screen.findByText(/Archived exam 20/)).toBeInTheDocument();
});
it('archive preview shows only selected content and result counts', async () => {
  mount(<ArchivePage />);
  await userEvent.click(await screen.findByRole('checkbox', { name: /Selected exam/ }));
  expect(await screen.findByText(/1 içerik, 7 sınav sonucu/)).toBeInTheDocument();
});
it('server refresh preserves unsaved profile edits', async () => {
  mount(<ServerSetupPage />);
  const input = (await screen.findAllByDisplayValue(config.publicUrl))[0];
  await userEvent.clear(input); await userEvent.type(input, 'https://new.example.test');
  mocks.status.mockResolvedValue({ config: { ...config, publicUrl: 'https://different.example.test' }, runtimeChangesAllowed: true, checks: { email: {} }, detected: {}, artifacts: {} });
  await userEvent.click(screen.getByRole('button', { name: 'Sunucuyu Yeniden Algıla' }));
  await vi.waitFor(() => expect(mocks.status).toHaveBeenCalledTimes(2));
  expect(input).toHaveValue('https://new.example.test');
});
it('retention cleanup waits for the edited policy to be saved', async () => {
  mount(<ServerSetupPage />);
  await screen.findAllByDisplayValue(config.publicUrl);
  await userEvent.click(screen.getByRole('switch'));
  expect(screen.getByRole('button', { name: 'Şimdi Temizle' })).toBeDisabled();
});
it('server status errors offer a retry instead of showing default configuration as loaded', async () => {
  mocks.status.mockRejectedValueOnce(new Error('Server unavailable'));
  mount(<ServerSetupPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent(/yüklenemedi/);
  await userEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }));
  expect((await screen.findAllByDisplayValue(config.publicUrl))[0]).toBeInTheDocument();
});
it('cleanup stays blocked if a refreshed saved policy differs from the displayed policy', async () => {
  const initial = { ...config, retention: { ...config.retention, enabled: true } };
  mocks.status.mockResolvedValue({ config: initial, runtimeChangesAllowed: true, checks: { email: {} }, detected: {} });
  mount(<ServerSetupPage />);
  const input = (await screen.findAllByDisplayValue(config.publicUrl))[0];
  await userEvent.clear(input); await userEvent.type(input, 'https://new.example.test');
  mocks.status.mockResolvedValue({ config: { ...initial, retention: { ...initial.retention, actionLogDays: 30 } }, runtimeChangesAllowed: true, checks: { email: {} }, detected: {} });
  await userEvent.click(screen.getByRole('button', { name: 'Sunucuyu Yeniden Algıla' }));
  await vi.waitFor(() => expect(mocks.status).toHaveBeenCalledTimes(2));
  await userEvent.clear(input); await userEvent.type(input, config.publicUrl);
  expect(screen.getByRole('button', { name: 'Şimdi Temizle' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Kaydedilen Profili Yükle' }));
  expect(screen.getByDisplayValue('30')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Şimdi Temizle' })).toBeEnabled();
});
it('admin action history can navigate to the next server page', async () => {
  mount(<ManagementPage />);
  await userEvent.click(screen.getByRole('tab', { name: /Log/ }));
  await screen.findByText('Action page 1');
  await userEvent.click(screen.getByRole('button', { name: 'Sonraki' }));
  expect(await screen.findByText('Action page 2')).toBeInTheDocument();
});
