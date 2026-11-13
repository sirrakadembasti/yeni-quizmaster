import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AcademicYearProvider, useAcademicYear } from '@/context/academic-year-context';
import { AcademicRouteBoundary } from '@/components/academic-history/AcademicRouteBoundary';
import ArchivePage from '@/pages/admin/archive';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), years: vi.fn(), jobs: vi.fn(), historyLoads: 0, allowedLoads: 1, context: {} as any }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'transition-admin' }, role: 'admin' }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => children }));
vi.mock('@/lib/api', () => ({
  apiFetch: mocks.fetch,
  handleResponse: async (response: any) => response.json(),
  classApi: { getAllClasses: async () => ({ classes: [] }) },
  quizApi: { getAllAdminQuizzes: async () => ({ quizzes: [] }) },
}));
vi.mock('@/lib/archive-api', () => ({ archiveApi: {
  years: mocks.years,
  jobs: mocks.jobs,
  rules: async () => ({ rules: [] }),
  transitionPreview: async () => ({ ready: true, source: 'live', issues: [], summary: { promoted: 0, graduated: 0, skippedInactive: 0, skippedGraduated: 0, skippedClassless: 0, transitions: [] } }),
} }));

let client: QueryClient;
const oldYear = { id: 'old', label: '2025-2026', status: 'active', scheduledCloseAt: '2026-07-14T21:05:00.000Z' };
const nextYear = { id: 'next', label: '2026-2027', status: 'active', scheduledCloseAt: '2027-07-14T21:05:00.000Z' };
const completed = { id: 'annual-old', academicYearId: 'old', label: '2025-2026', mode: 'annual', status: 'completed', attempts: 1 };

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); mocks.historyLoads = 0; mocks.allowedLoads = 1;
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mocks.context = { years: [{ ...oldYear, status: 'closed' }, nextYear], academicYearId: nextYear.id };
  mocks.years.mockResolvedValue({ years: mocks.context.years });
  mocks.jobs.mockResolvedValue({ jobs: [completed] });
  mocks.fetch.mockImplementation(async (_path: string, options: RequestInit) => {
    if (options.method === 'GET' && ++mocks.historyLoads > mocks.allowedLoads) {
      // A slow unexpected reload exposes the route boundary's actual unmount.
      return new Promise(() => {});
    }
    return { json: async () => mocks.context };
  });
});
afterEach(() => { cleanup(); client.clear(); localStorage.clear(); });

function ContextStatus() {
  const context = useAcademicYear();
  // Arşiv sayfası zamanlamaya göre kendi role="status" öğelerini de üretir; bu testin öğesi rol yerine
  // benzersiz kimlikle aranır (aksi hâlde "Found multiple elements with the role status" kararsızlığı oluşur).
  return <p role="status" data-testid="context-status">{context?.pending ? 'Validating year' : `Selected year ${context?.year?.label}`}</p>;
}
function mount() {
  render(<QueryClientProvider client={client}><AcademicYearProvider><ContextStatus /><AcademicRouteBoundary><ArchivePage /></AcademicRouteBoundary></AcademicYearProvider></QueryClientProvider>);
}

it('keeps the archive route mounted when an older annual completion is already reflected in the active context', async () => {
  mount();
  await vi.waitFor(() => expect(mocks.jobs).toHaveBeenCalled());
  await act(async () => {});
  expect(mocks.historyLoads).toBe(1);
  await vi.waitFor(() => expect(screen.getByTestId('context-status')).toHaveTextContent('Selected year 2026-2027'));
  await userEvent.click(screen.getByRole('tab', { name: 'Sınıf Geçişi' }));
  expect(screen.getByRole('region', { name: 'Tamamlanan sınıf geçişi' })).toHaveTextContent('2025-2026');
});

it('reloads the selected active year once when its annual job completes and keeps the remounted route usable', async () => {
  mocks.context = { years: [oldYear], academicYearId: oldYear.id };
  mocks.years.mockResolvedValue({ years: [oldYear] });
  mocks.jobs.mockResolvedValue({ jobs: [{ ...completed, status: 'capturing' }] });
  mocks.allowedLoads = 2;
  mount();
  await screen.findByText('Aktif eğitim yılı: 2025-2026. Arşiv PDF ve CSV iş verilerini içerir.');
  mocks.context = { years: [{ ...oldYear, status: 'closed' }, nextYear], academicYearId: nextYear.id };
  mocks.years.mockResolvedValue({ years: mocks.context.years });
  mocks.jobs.mockResolvedValue({ jobs: [completed] });
  await act(async () => { client.setQueryData(['archive-jobs'], { jobs: [completed] }); });
  await vi.waitFor(() => expect(mocks.historyLoads).toBeGreaterThanOrEqual(2));
  await act(async () => {});
  expect(mocks.historyLoads).toBe(2);
  await vi.waitFor(() => expect(screen.getByTestId('context-status')).toHaveTextContent('Selected year 2026-2027'));
  await userEvent.click(screen.getByRole('tab', { name: 'Sınıf Geçişi' }));
  expect(screen.getByRole('region', { name: 'Tamamlanan sınıf geçişi' })).toHaveTextContent('2025-2026');
});
