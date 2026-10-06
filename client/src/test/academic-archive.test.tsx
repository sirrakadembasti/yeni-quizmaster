import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ArchivePage from '@/pages/admin/archive';
const mocks = vi.hoisted(() => ({ years: vi.fn(), create: vi.fn(), close: vi.fn(), save: vi.fn(), authorize: vi.fn(), download: vi.fn(), retry: vi.fn(), cancel: vi.fn(), jobs: vi.fn(), job: vi.fn(), rules: vi.fn() }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => children }));
vi.mock('@/lib/api', () => ({ classApi: { getAllClasses: async () => ({ classes: [{ id: 'c1', name: '9-A', _count: { students: 3 } }, { id: 'c2', name: '10-A', _count: { students: 2 } }] }) }, quizApi: { getAllAdminQuizzes: async () => ({ quizzes: [{ id: 'q1', title: 'Matematik', status: 'published', contentType: 'exam' }, { id: 'q2', title: 'Görüş anketi', status: 'published', contentType: 'survey' }, { id: 'old', title: 'Geçmiş içerik', status: 'archived' }] }) }, adminApi: { getArchiveCandidates: async () => ({ quizzes: 2, results: 7 }) } }));
vi.mock('@/lib/archive-api', () => ({ archiveApi: { years: mocks.years, jobs: mocks.jobs, job: mocks.job, rules: mocks.rules, saveRules: mocks.save, preview: async (ids: string[]) => ({ quizzes: ids.length, results: ids.length * 3, surveySubmissions: 0 }), create: mocks.create, closeYear: mocks.close, retry: mocks.retry, cancel: mocks.cancel, authorizeDownload: mocks.authorize, download: mocks.download, logs: async () => ({ logs: [] }) } }));
let client: QueryClient;
const activeYear = { id: 'y1', label: '2026-2027', status: 'active', scheduledCloseAt: '2027-07-14T21:05:00.000Z', canClose: false };
const savedRules = { rules: [{ fromClassId: 'c1', toClassId: 'c2', graduate: false }, { fromClassId: 'c2', toClassId: null, graduate: true }] };
beforeEach(() => { vi.clearAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); mocks.years.mockResolvedValue({ years: [activeYear], serverNow: '2026-10-05T00:00:00Z' }); mocks.jobs.mockResolvedValue({ jobs: [] }); mocks.job.mockResolvedValue({ job: { id: 'job', label: '2026-2027', status: 'completed', mode: 'manual' } }); mocks.rules.mockResolvedValue({ rules: [] }); mocks.create.mockResolvedValue({ job: { id: 'job', label: '2026-2027', status: 'queued', mode: 'manual' } }); });
afterEach(() => { cleanup(); client.clear(); });
function mount() { render(<QueryClientProvider client={client}><ArchivePage /></QueryClientProvider>); }
it('archives only explicitly selected active content after scoped preview', async () => {
  mount(); const select = await screen.findByRole('checkbox', { name: /Matematik/ });
  expect(screen.queryByRole('checkbox', { name: /Geçmiş içerik/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Seçilenleri Arşivle' })).toBeDisabled();
  await userEvent.click(select);
  expect(await screen.findByText(/1 içerik, 3 sınav sonucu/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Seçilenleri Arşivle' }));
  await vi.waitFor(() => expect(mocks.create).toHaveBeenCalledWith(['q1'], 'y1'));
  expect(await screen.findByText(/kuyruğa alındı/)).toBeInTheDocument();
});
it('blocks early annual closure and requires explicit saved transition rules', async () => {
  mount(); await screen.findByRole('checkbox', { name: /Matematik/ });
  await userEvent.click(screen.getByRole('tab', { name: 'Yıl Sonu' }));
  expect(screen.getByRole('button', { name: 'Yılı Kapat' })).toBeDisabled();
  expect(screen.getByText(/15 Temmuz/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'Sınıf Geçişi' }));
  expect(screen.getByRole('button', { name: 'Geçiş Kurallarını Kaydet' })).toBeDisabled();
  await userEvent.selectOptions(screen.getByLabelText('9-A hedefi'), 'c2');
  await userEvent.selectOptions(screen.getByLabelText('10-A hedefi'), 'graduate');
  await userEvent.click(screen.getByRole('button', { name: 'Geçiş Kurallarını Kaydet' }));
  await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledWith('y1', [{ fromClassId: 'c1', toClassId: 'c2', graduate: false }, { fromClassId: 'c2', toClassId: null, graduate: true }]));
});
it('restores persisted transition targets when the page opens with cached year and rule data', async () => {
  client.setQueryData(['archive-years'], { years: [{ id: 'y1', label: '2026-2027', status: 'active', scheduledCloseAt: '2027-07-14T21:05:00.000Z' }] });
  const saved = { rules: [{ fromClassId: 'c1', toClassId: 'c2', graduate: false }, { fromClassId: 'c2', toClassId: null, graduate: true }] };
  mocks.rules.mockResolvedValue(saved);
  client.setQueryData(['archive-rules', 'y1'], saved);
  mount(); await screen.findByRole('checkbox', { name: /Matematik/ });
  await userEvent.click(screen.getByRole('tab', { name: 'Sınıf Geçişi' }));
  expect(screen.getByLabelText('9-A hedefi')).toHaveValue('c2');
  expect(screen.getByLabelText('10-A hedefi')).toHaveValue('graduate');
});
it('exposes downloads only for completed jobs and requires password authorization first', async () => {
  mocks.jobs.mockResolvedValue({ jobs: [{ id: 'done', label: '2025-2026', mode: 'annual', status: 'completed', attempts: 1 }, { id: 'working', label: '2026-2027', mode: 'manual', status: 'capturing', attempts: 1 }] });
  mount(); await screen.findByRole('checkbox', { name: /Matematik/ }); await userEvent.click(screen.getByRole('tab', { name: 'Geçmiş ve İşler' }));
  expect(screen.getAllByRole('button', { name: 'Arşivi İndir' })).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Arşivi İndir' }));
  await userEvent.type(screen.getByLabelText('Yönetici şifresi'), 'secret');
  await userEvent.click(screen.getByRole('button', { name: 'Şifreyi Doğrula ve İndir' }));
  await vi.waitFor(() => expect(mocks.download).toHaveBeenCalledWith('done'));
  expect(mocks.authorize).toHaveBeenCalledWith('done', 'secret');
});
it('shows archive request errors as accessible feedback and preserves the selection for retry', async () => {
  mocks.create.mockRejectedValueOnce(new Error('Seçilen içerik için devam eden arşiv var.'));
  mount(); await userEvent.click(await screen.findByRole('checkbox', { name: /Matematik/ }));
  await screen.findByText(/1 içerik, 3 sınav sonucu/);
  await userEvent.click(screen.getByRole('button', { name: 'Seçilenleri Arşivle' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Seçilen içerik için devam eden arşiv var.');
  expect(screen.getByRole('checkbox', { name: /Matematik/ })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Seçilenleri Arşivle' })).toBeEnabled();
});
it('uses server closure eligibility even when the local clock says the year is already due', async () => {
  mocks.years.mockResolvedValue({ years: [{ ...activeYear, scheduledCloseAt: '2020-07-14T21:05:00Z', canClose: false }], serverNow: '2020-07-14T20:00:00Z' });
  mocks.rules.mockResolvedValue(savedRules);
  mount(); await screen.findByRole('checkbox', { name: /Matematik/ }); await userEvent.click(screen.getByRole('tab', { name: 'Yıl Sonu' }));
  expect(screen.getByRole('button', { name: 'Yılı Kapat' })).toBeDisabled();
});
it('enables server-approved closure even when the local clock sees a future boundary', async () => {
  mocks.years.mockResolvedValue({ years: [{ ...activeYear, scheduledCloseAt: '2090-07-14T21:05:00Z', canClose: true }], serverNow: '2090-07-15T00:00:00Z' });
  mocks.rules.mockResolvedValue(savedRules);
  mount(); await screen.findByRole('checkbox', { name: /Matematik/ }); await userEvent.click(screen.getByRole('tab', { name: 'Yıl Sonu' }));
  expect(screen.getByRole('button', { name: 'Yılı Kapat' })).toBeEnabled();
});
it('refreshes the active year and shared context when an unselected resumed job completes', async () => {
  const resumed = { id: 'resumed', academicYearId: 'y1', label: '2026-2027', mode: 'annual', status: 'capturing', attempts: 2 };
  mocks.jobs.mockResolvedValue({ jobs: [resumed] });
  client.setQueryData(['academic-year-context'], { years: [activeYear] });
  mount(); await screen.findByRole('checkbox', { name: /Matematik/ });
  const next = { ...activeYear, id: 'y2', label: '2027-2028' };
  mocks.years.mockResolvedValue({ years: [{ ...activeYear, status: 'closed' }, next], serverNow: '2027-07-15T00:00:00Z' });
  const completed = { ...resumed, status: 'completed' };
  mocks.jobs.mockResolvedValue({ jobs: [completed] });
  await act(async () => { client.setQueryData(['archive-jobs'], { jobs: [completed] }); });
  expect(await screen.findByText(/Aktif eğitim yılı: 2027-2028/)).toBeInTheDocument();
  expect(client.getQueryState(['academic-year-context'])?.isInvalidated).toBe(true);
});
it.each(['queued', 'retry_wait', 'failed'])('allows repairing transition rules while the annual job is %s', async status => {
  mocks.jobs.mockResolvedValue({ jobs: [{ id: 'annual', academicYearId: 'y1', label: '2026-2027', mode: 'annual', status, attempts: 1 }] });
  mount(); await screen.findByRole('checkbox', { name: /Matematik/ }); await userEvent.click(screen.getByRole('tab', { name: 'Sınıf Geçişi' }));
  expect(screen.getByLabelText('9-A hedefi')).toBeEnabled();
  await userEvent.selectOptions(screen.getByLabelText('9-A hedefi'), 'c2');
  await userEvent.selectOptions(screen.getByLabelText('10-A hedefi'), 'graduate');
  expect(screen.getByRole('button', { name: 'Geçiş Kurallarını Kaydet' })).toBeEnabled();
});

it('keeps manual recovery available after twenty attempts and explains the annual blocker', async () => {
  const blocker = { id: 'failed-manual', status: 'failed', reason: 'Manuel arşiv başarısız.', remedy: 'Yeniden Dene ile aynı verileri kurtarın.' };
  mocks.jobs.mockResolvedValue({ jobs: [{ id: blocker.id, academicYearId: 'y1', label: '2026-2027', mode: 'manual', status: 'failed', attempts: 20 }, { id: 'annual', academicYearId: 'y1', label: '2026-2027', mode: 'annual', status: 'queued', attempts: 0, blockers: [blocker] }] });
  mocks.retry.mockResolvedValue({ job: { id: blocker.id, status: 'retry_wait' } });
  mount(); await screen.findByRole('checkbox', { name: /Matematik/ });
  await userEvent.click(screen.getByRole('tab', { name: 'Yıl Sonu' }));
  expect(screen.getByText(/failed-manual/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'Geçmiş ve İşler' }));
  const recover = screen.getByRole('button', { name: 'Yeniden Dene' });
  expect(recover).toBeEnabled();
  await userEvent.click(recover);
  await vi.waitFor(() => expect(mocks.retry).toHaveBeenCalledWith('failed-manual'));
});

it('enables the recovery button after twenty failed attempts', async () => {
  mocks.jobs.mockResolvedValue({ jobs: [{ id: 'exhausted', academicYearId: 'y1', label: '2026-2027', mode: 'manual', status: 'failed', attempts: 20 }] });
  mount(); await screen.findByRole('checkbox', { name: /Matematik/ });
  await userEvent.click(screen.getByRole('tab', { name: 'Geçmiş ve İşler' }));
  expect(screen.getByRole('button', { name: 'Yeniden Dene' })).toBeEnabled();
});

it('offers explicit cancellation only when the server confirms no data was captured', async () => {
  mocks.cancel.mockResolvedValue({ job: { id: 'empty', status: 'cancelled' } });
  mocks.jobs.mockResolvedValue({ jobs: [{ id: 'empty', academicYearId: 'y1', label: '2026-2027', mode: 'manual', status: 'failed', attempts: 20, canCancel: true }, { id: 'captured', academicYearId: 'y1', label: '2026-2027', mode: 'manual', status: 'failed', attempts: 20, canCancel: false }] });
  mount(); await screen.findByRole('checkbox', { name: /Matematik/ });
  await userEvent.click(screen.getByRole('tab', { name: 'Geçmiş ve İşler' }));
  expect(screen.getAllByRole('button', { name: 'Kopyalama başlamadan iptal' })).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Kopyalama başlamadan iptal' }));
  expect(await screen.findByText(/Kopyalama başlamadan arşiv iptal edildi/)).toBeInTheDocument();
  expect(mocks.cancel.mock.calls[0][0]).toBe('empty');
});

it.each([false, true])('opens and recovers an old blocker outside the visible history page (canCancel=%s)', async canCancel => {
  const old = { id: 'old-blocker', academicYearId: 'y1', label: '2026-2027', mode: 'manual', status: 'failed', attempts: 20, canCancel };
  const annual = { id: 'annual', academicYearId: 'y1', label: '2026-2027', mode: 'annual', status: 'queued', attempts: 0, blockers: [{ id: old.id, status: old.status, reason: 'Eski manuel iş başarısız.', remedy: 'Yeniden Dene ile kurtarın.' }] };
  const history = Array.from({ length: 21 }, (_, index) => ({ id: 'completed-' + index, academicYearId: 'y1', label: '2026-2027', mode: 'manual', status: 'completed', attempts: 1 }));
  // One case is absent from the response; the other is present beyond page one.
  mocks.jobs.mockResolvedValue({ jobs: [annual, ...history, ...(canCancel ? [old] : [])] });
  mocks.job.mockResolvedValue({ job: old });
  mocks.retry.mockResolvedValue({ job: { ...old, status: 'retry_wait' } });
  mocks.cancel.mockResolvedValue({ job: { ...old, status: 'cancelled' } });
  mount(); await screen.findByRole('checkbox', { name: /Matematik/ });
  await userEvent.click(screen.getByRole('tab', { name: 'Yıl Sonu' }));
  await userEvent.click(screen.getByRole('button', { name: 'İşi Aç: old-blocker' }));
  const detail = await screen.findByRole('region', { name: 'Seçilen arşiv işi' });
  expect(mocks.job.mock.calls[0][0]).toBe(old.id);
  expect(await within(detail).findByText(/old-blocker/)).toBeInTheDocument();
  if (canCancel) {
    await userEvent.click(await within(detail).findByRole('button', { name: 'Kopyalama başlamadan iptal: old-blocker' }));
    expect(await screen.findByText(/Kopyalama başlamadan arşiv iptal edildi/)).toBeInTheDocument();
    expect(mocks.cancel.mock.calls[0][0]).toBe(old.id);
  } else {
    expect(within(detail).queryByRole('button', { name: 'Kopyalama başlamadan iptal' })).not.toBeInTheDocument();
    await userEvent.click(await within(detail).findByRole('button', { name: 'Yeniden Dene: old-blocker' }));
    expect(await screen.findByText(/kuyruğa alındı/)).toBeInTheDocument();
    expect(mocks.retry.mock.calls[0][0]).toBe(old.id);
  }
});
