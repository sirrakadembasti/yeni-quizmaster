import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StudentResults from '@/pages/student-results';

const api = vi.hoisted(() => ({ results: vi.fn(), identity: vi.fn(), exported: null as any }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ role: 'admin', user: { id: 'admin', name: 'Audit Admin' } }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/export', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/export')>();
  return { ...actual, downloadCsv: (options: any) => { actual.createExcelBytes(options); api.exported = options; } };
});
vi.mock('@/lib/api', () => ({
  resultApi: { getStudentResults: api.results },
  categoryApi: { getAllCategories: async () => [] },
  userApi: { getUser: api.identity, getAllUsers: async () => ({ users: [] }) },
  parentApi: { getStudentGuardians: async () => ({ guardians: [] }), getParents: async () => ({ parents: [] }) },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(finish => { resolve = finish; });
  return { promise, resolve };
}
const studentA = { id: 'student-a', role: 'student', name: 'Öğrenci A', email: 'a@example.test' };
const studentB = { id: 'student-b', role: 'student', name: 'Öğrenci B', email: 'b@example.test' };
const result = (studentId: string, title: string) => ({
  id: `result-${studentId}`, studentId, status: 'completed', score: 0,
  totalQuestions: 1, correctAnswersCount: 0, timeTaken: 120,
  submittedAt: '2026-10-01T10:00:00Z', quiz: { title, category: 'Türkçe' },
});
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks(); api.exported = null;
  window.history.replaceState({}, '', '/student/results?studentId=student-a');
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); });

it('ignores late student A results when the same mounted page is already resolving student B identity', async () => {
  const lateResultsA = deferred<{ results: ReturnType<typeof result>[] }>();
  const identityB = deferred<{ user: typeof studentB }>();
  const rowB = result('student-b', 'Sınav B');
  api.results.mockImplementation((id: string) => id === 'student-a' ? lateResultsA.promise : Promise.resolve({ results: [rowB] }));
  api.identity.mockImplementation((id: string) => id === 'student-b' ? identityB.promise : Promise.resolve({ user: studentA }));

  const tree = () => <QueryClientProvider client={client}><StudentResults /></QueryClientProvider>;
  const mounted = render(tree());
  await waitFor(() => expect(api.results).toHaveBeenCalledWith('student-a'));
  // Preserve the component instance and React state. The page currently derives
  // studentId from window.location.search, so explicitly rerender after navigation.
  act(() => {
    window.history.replaceState({}, '', '/student/results?studentId=student-b');
    mounted.rerender(tree());
  });
  await waitFor(() => expect(api.identity).toHaveBeenCalledWith('student-b'));

  // B's results have arrived but its identity is pending. Now let the obsolete A
  // request finish. Without effect cleanup it replaces B's rows with A's rows.
  await act(async () => { lateResultsA.resolve({ results: [result('student-a', 'Sınav A')] }); });
  await act(async () => { identityB.resolve({ user: studentB }); });
  const excel = screen.getByRole('button', { name: 'Excel' });
  await waitFor(() => expect(excel).toBeEnabled());
  fireEvent.click(excel);
  expect(api.exported.filters).toContainEqual({ label: 'Öğrenci', value: 'Öğrenci B' });
  expect(api.exported.rows).toEqual([rowB]);
  expect(screen.getByRole('heading', { name: 'Öğrenci B' })).toBeVisible();
  expect(screen.getByText('Sınav B', { exact: true })).toBeVisible();
  expect(screen.queryByText('Sınav A', { exact: true })).not.toBeInTheDocument();
});
