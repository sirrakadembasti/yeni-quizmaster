import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StudentResults from '@/pages/student-results';

const fixture = vi.hoisted(() => ({ getUser: vi.fn(), getUsers: vi.fn(), options: null as any, bytes: null as Uint8Array | null }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ role: 'admin', user: { id: 'admin', name: 'Audit Admin' } }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/export', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/export')>();
  return { ...actual, downloadCsv: (options: any) => { fixture.options = options; fixture.bytes = actual.createExcelBytes(options); } };
});
vi.mock('@/lib/api', () => ({
  resultApi: { getStudentResults: async () => ({ results: [{ id: 'result', status: 'completed', score: 0, correctAnswersCount: 0, totalQuestions: 1, timeTaken: 120, submittedAt: '2026-10-01T10:00:00Z', quiz: { title: 'Sıfır puanlı sınav', category: 'Türkçe' } }] }) },
  categoryApi: { getAllCategories: async () => [] },
  userApi: { getUser: fixture.getUser, getAllUsers: fixture.getUsers },
  parentApi: { getStudentGuardians: async () => ({ guardians: [] }), getParents: async () => ({ parents: [] }) },
}));

const student = { id: 'student', role: 'student', name: 'Çağrı Işık', email: 'cagri@example.test' };
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/student/results?studentId=student');
  fixture.options = null; fixture.bytes = null;
  fixture.getUser.mockResolvedValue({ user: student });
  fixture.getUsers.mockResolvedValue({ users: [] });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); vi.restoreAllMocks(); });
function mount() { render(<QueryClientProvider client={client}><StudentResults /></QueryClientProvider>); }

it('does not export or print a selected student report until the identity request completes', async () => {
  let resolveIdentity!: (value: { user: typeof student }) => void;
  fixture.getUser.mockImplementation(() => new Promise(resolve => { resolveIdentity = resolve; }));
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  mount();
  const excel = screen.getByRole('button', { name: 'Excel' });
  const printButton = screen.getByRole('button', { name: 'Yazdır' });
  expect(excel).toBeDisabled();
  expect(printButton).toBeDisabled();
  fireEvent.click(excel); fireEvent.click(printButton);
  expect(fixture.options).toBeNull(); expect(print).not.toHaveBeenCalled();
  await waitFor(() => expect(resolveIdentity).toBeTypeOf('function'));
  await act(async () => resolveIdentity({ user: student }));
  await waitFor(() => expect(excel).toBeEnabled());
  expect(printButton).toBeEnabled();
});

it('exports the loaded selected student identity and completed numeric zero rather than the admin identity', async () => {
  mount();
  const excel = screen.getByRole('button', { name: 'Excel' });
  await waitFor(() => expect(excel).toBeEnabled());
  fireEvent.click(excel);
  expect(fixture.options.filters).toContainEqual({ label: 'Öğrenci', value: 'Çağrı Işık' });
  expect(fixture.options.rows).toHaveLength(1);
  const scoreColumn = fixture.options.columns.find((column: any) => column.header === 'Puan');
  expect(scoreColumn.value(fixture.options.rows[0])).toBe(0);
  expect(fixture.bytes?.length).toBeGreaterThan(0);
  const metadata = document.querySelector('.print-report-meta')!;
  expect(metadata).toHaveTextContent('Çağrı Işık');
  expect(metadata).not.toHaveTextContent('Audit Admin');
});

it('keeps reports disabled and shows an identity error when the selected student cannot be resolved', async () => {
  fixture.getUser.mockRejectedValue(new Error('Student unavailable'));
  mount();
  expect(await screen.findByText('Öğrenci bilgileri yüklenemedi.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Excel' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Yazdır' })).toBeDisabled();
  expect(document.querySelector('.print-report-meta')).not.toHaveTextContent('Audit Admin');
});
