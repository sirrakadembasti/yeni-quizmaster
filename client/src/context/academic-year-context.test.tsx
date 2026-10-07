import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { AcademicYearProvider, useAcademicYear } from './academic-year-context';
import { AcademicYearSelector } from '@/components/academic-history/AcademicYearSelector';
import { AcademicRouteBoundary } from '@/components/academic-history/AcademicRouteBoundary';

const mocks = vi.hoisted(() => ({ request: vi.fn(), context: {} as any, user: { id: 'context-admin', role: 'admin' }, route: '/management' }));
vi.mock('./auth-context', () => ({ useAuth: () => ({ user: mocks.user, role: 'admin' }) }));
vi.mock('@/lib/api', () => ({ apiFetch: mocks.request, handleResponse: async (response: any) => { if (response.status >= 400) throw new Error('Context rejected'); return response.json(); } }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: () => <p>Protected year boundary</p> }));
vi.mock('wouter', () => ({ useLocation: () => [mocks.route, vi.fn()] }));
const active = { id: 'active', label: '2026-2027', status: 'active' };
const past = { id: 'past', label: '2025-2026', status: 'closed', snapshotId: 'annual-past' };
const next = { id: 'next', label: '2027-2028', status: 'active' };
let client: QueryClient;
function response(data: unknown, status = 200) { return { status, json: async () => data }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function Probe() {
  const context = useAcademicYear()!;
  return <><AcademicYearSelector /><p role="status">{context.pending ? 'Pending' : `${context.year?.id ?? 'No year'}:${context.year?.status}`}</p>{context.error && <p role="alert">{context.error}</p>}<button onClick={context.reload}>Reload context</button><button onClick={() => void context.selectYear('past')}>Select past</button><button onClick={() => void context.selectYear('active')}>Select active</button></>;
}
function mount(children = <p>Business screen</p>) { return render(<QueryClientProvider client={client}><AcademicYearProvider><Probe /><AcademicRouteBoundary>{children}</AcademicRouteBoundary></AcademicYearProvider></QueryClientProvider>); }
const gets = () => mocks.request.mock.calls.filter(([, options]) => options.method === 'GET');
const posts = () => mocks.request.mock.calls.filter(([, options]) => options.method === 'POST');
beforeEach(() => {
  vi.clearAllMocks(); mocks.request.mockReset(); localStorage.clear(); mocks.route = '/management'; mocks.context = { years: [past, active], academicYearId: active.id };
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mocks.request.mockImplementation(async (_path: string, options: RequestInit) => {
    if (options.method === 'POST') mocks.context = { ...mocks.context, academicYearId: JSON.parse(options.body as string).academicYearId };
    return response(mocks.context);
  });
});
afterEach(() => { cleanup(); client.clear(); localStorage.clear(); vi.useRealTimers(); });

it('takes a new login active year from GET and ignores a saved past preference without posting it', async () => {
  localStorage.setItem('academic-year:context-admin', 'past'); localStorage.setItem('academic-year-mode:context-admin', 'historical');
  mount(); await screen.findByText('active:active');
  expect(posts()).toHaveLength(0); expect(screen.getAllByRole('option').map(option => option.getAttribute('value'))).toEqual(['active', 'past']);
  expect(screen.getByText('Business screen')).toBeInTheDocument();
});
it('retains a deliberate same-session server past selection on refresh without an implicit POST', async () => {
  mocks.context.academicYearId = 'past'; mount(); await screen.findByText('past:closed');
  expect(posts()).toHaveLength(0); expect(screen.queryByText('Business screen')).not.toBeInTheDocument();
});
it('keeps invalid selected history behind an error boundary and offers active recovery', async () => {
  mocks.context = { years: [active], academicYearId: 'past', invalidSelection: true };
  mount(); await screen.findByRole('alert');
  expect(screen.queryByText('Business screen')).not.toBeInTheDocument(); expect(screen.getByRole('option', { name: /Aktif/ })).toHaveValue('active');
  fireEvent.click(screen.getByRole('button', { name: 'Select active' }));
  mocks.context = { years: [active], academicYearId: 'active' };
  await screen.findByText('active:active'); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('refreshes rollover centrally on focus while another business page is open', async () => {
  mount(); await screen.findByText('active:active'); client.setQueryData(['business'], 'old-year');
  mocks.context = { years: [past, { ...active, status: 'closed', snapshotId: 'annual-active' }, next], academicYearId: 'next' };
  fireEvent(window, new Event('focus')); await screen.findByText('next:active');
  expect(posts()).toHaveLength(0); expect(client.getQueryData(['business'])).toBeUndefined();
});
it('keeps deliberately selected past history on a focus refresh after rollover', async () => {
  mocks.context.academicYearId = 'past'; mount(); await screen.findByText('past:closed');
  mocks.context = { years: [next, past], academicYearId: 'past' };
  fireEvent(window, new Event('focus')); await waitFor(() => expect(gets()).toHaveLength(2));
  expect(screen.getByText('past:closed')).toBeInTheDocument(); expect(posts()).toHaveLength(0);
});
it('polls context at a bounded rate and follows the new active year without focus', async () => {
  vi.useFakeTimers(); mount(); await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  mocks.context = { years: [next, past], academicYearId: 'next' };
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(screen.getByText('next:active')).toBeInTheDocument(); expect(gets().length).toBeGreaterThan(1); expect(gets().length).toBeLessThanOrEqual(6); expect(posts()).toHaveLength(0);
});
it('preserves populated business cache when repeated context GET has the same effective year', async () => {
  mount(); await screen.findByText('active:active'); client.setQueryData(['business'], 'same-year'); client.setQueryData(['notifications', 'nav'], 'session-notifications');
  fireEvent.click(screen.getByRole('button', { name: 'Reload context' })); await waitFor(() => expect(gets()).toHaveLength(2));
  expect(client.getQueryData(['business'])).toBe('same-year'); expect(client.getQueryData(['notifications', 'nav'])).toBe('session-notifications'); expect(posts()).toHaveLength(0);
});
it('ignores a deferred initial GET that finishes after an explicit selection committed', async () => {
  const old = deferred<any>(); mocks.request.mockImplementationOnce(() => old.promise);
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Select past' })); await screen.findByText('past:closed');
  await act(async () => old.resolve(response({ years: [active, past], academicYearId: 'active' })));
  expect(screen.getByText('past:closed')).toBeInTheDocument(); expect(posts()).toHaveLength(1);
});
it('uses GET authority after POST rather than a stale origin selection response', async () => {
  mount(); await screen.findByText('active:active');
  mocks.request.mockImplementation(async (_path: string, options: RequestInit) => response(options.method === 'POST' ? { academicYearId: 'past' } : { years: [active, past], academicYearId: 'active' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select past' })); await waitFor(() => expect(gets()).toHaveLength(2));
  expect(screen.getByText('active:active')).toBeInTheDocument();
});
it('puts the other tab behind pending immediately and reconciles only the committed server context', async () => {
  mount(); await screen.findByText('active:active'); client.setQueryData(['business'], 'old-year');
  const pending = deferred<any>(); mocks.request.mockImplementationOnce(() => pending.promise);
  fireEvent(window, new StorageEvent('storage', { key: 'quizmaster:academic-context', newValue: JSON.stringify({ userId: mocks.user.id, phase: 'pending', nonce: 'other-tab-1' }) }));
  expect(screen.getByRole('status')).toHaveTextContent('Pending'); expect(screen.queryByText('Business screen')).not.toBeInTheDocument();
  mocks.context.academicYearId = 'past';
  fireEvent(window, new StorageEvent('storage', { key: 'quizmaster:academic-context', newValue: JSON.stringify({ userId: mocks.user.id, phase: 'settled', nonce: 'other-tab-1' }) }));
  await screen.findByText('past:closed'); expect(client.getQueryData(['business'])).toBeUndefined();
  await act(async () => pending.resolve(response({ years: [active, past], academicYearId: 'active' })));
  expect(screen.getByText('past:closed')).toBeInTheDocument();
});
it('ignores another users cross-tab signal', async () => {
  mount(); await screen.findByText('active:active');
  fireEvent(window, new StorageEvent('storage', { key: 'quizmaster:academic-context', newValue: JSON.stringify({ userId: 'someone-else', phase: 'pending', nonce: 'other-user' }) }));
  expect(screen.getByText('Business screen')).toBeInTheDocument(); expect(gets()).toHaveLength(1);
});
it('keeps the other tab pending when a fast GET still reports old active context before the selection commit signal', async () => {
  mount(); await screen.findByText('active:active');
  fireEvent(window, new StorageEvent('storage', { key: 'quizmaster:academic-context', newValue: JSON.stringify({ userId: mocks.user.id, phase: 'pending', nonce: 'inflight-tab' }) }));
  await act(async () => {});
  expect(screen.getByRole('status')).toHaveTextContent('Pending'); expect(screen.queryByText('Business screen')).not.toBeInTheDocument();
  mocks.context.academicYearId = 'past';
  fireEvent(window, new StorageEvent('storage', { key: 'quizmaster:academic-context', newValue: JSON.stringify({ userId: mocks.user.id, phase: 'settled', nonce: 'inflight-tab' }) }));
  await screen.findByText('past:closed'); expect(screen.queryByText('Business screen')).not.toBeInTheDocument();
});
it('reconciles a failed selection and allows explicit active recovery without leaking business children', async () => {
  mocks.context.academicYearId = 'past'; mount(); await screen.findByText('past:closed');
  mocks.request.mockImplementationOnce(async () => response({ message: 'Rejected selection' }, 409));
  fireEvent.click(screen.getByRole('button', { name: 'Select active' })); await screen.findByRole('alert');
  expect(screen.queryByText('Business screen')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Select active' })); await screen.findByText('active:active');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(screen.getByText('Business screen')).toBeInTheDocument();
});
it('cancels in-flight old business requests on an effective context change before their late response', async () => {
  const late = deferred<string>();
  function BusinessQuery() { const query = useQuery({ queryKey: ['business-live'], queryFn: () => late.promise }); return <p>{query.data ?? 'Business loading'}</p>; }
  mount(<BusinessQuery />); await screen.findByText('Business loading');
  fireEvent.click(screen.getByRole('button', { name: 'Select past' })); await screen.findByText('past:closed');
  await act(async () => late.resolve('old live response'));
  expect(client.getQueryData(['business-live'])).toBeUndefined(); expect(screen.queryByText('old live response')).not.toBeInTheDocument();
});
it('allows the operational reset-password route in a past session', async () => {
  mocks.route = '/reset-password'; mocks.context.academicYearId = 'past';
  mount(<p>Operational reset form</p>); await screen.findByText('past:closed');
  expect(screen.getByText('Operational reset form')).toBeInTheDocument();
});
it('offers explicit fail-closed recovery when another tab becomes pending before bootstrap metadata is ready', async () => {
  vi.useFakeTimers();
  const initial = deferred<any>(); mocks.request.mockImplementationOnce(() => initial.promise);
  mount();
  fireEvent(window, new StorageEvent('storage', { key: 'quizmaster:academic-context', newValue: JSON.stringify({ userId: mocks.user.id, phase: 'pending', nonce: 'bootstrap-remote' }) }));
  await act(async () => { initial.resolve(response({ years: [active, past], academicYearId: 'active' })); await vi.advanceTimersByTimeAsync(30000); });
  expect(screen.queryByText('Business screen')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toBeVisible();
  expect(screen.getByRole('status')).not.toHaveTextContent('Pending');
  expect(screen.getByRole('option', { name: /Aktif/ })).toHaveValue('active');
  // The vanished tab never silently restores a live screen; the user rechecks.
  fireEvent.click(screen.getByRole('button', { name: 'Reload context' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(screen.getByText('active:active')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('Business screen')).toBeInTheDocument();
});
it.each(['rejects', 'never resolves'])('offers explicit fail-closed recovery when bootstrap context GET %s during another tab selection', async failure => {
  vi.useFakeTimers();
  const initial = deferred<any>();
  mocks.request.mockImplementation(() => failure === 'rejects' ? Promise.resolve(response({}, 503)) : new Promise(() => {}));
  mocks.request.mockImplementationOnce(() => initial.promise);
  mount();
  fireEvent(window, new StorageEvent('storage', { key: 'quizmaster:academic-context', newValue: JSON.stringify({ userId: mocks.user.id, phase: 'pending', nonce: `bootstrap-${failure}` }) }));
  await act(async () => { initial.resolve(response({}, 503)); await vi.advanceTimersByTimeAsync(30000); });
  expect(screen.queryByText('Business screen')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toBeVisible();
  expect(screen.getByRole('status')).not.toHaveTextContent('Pending');
  expect(screen.getByRole('button', { name: 'Reload context' })).toBeEnabled();
  // No year metadata is fabricated. Explicit recheck fetches recovery choices.
  expect(screen.queryByRole('option', { name: /Aktif/ })).not.toBeInTheDocument();
  mocks.request.mockResolvedValue(response({ years: [active, past], academicYearId: 'active' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reload context' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(screen.getByText('active:active')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('Business screen')).toBeInTheDocument();
});
