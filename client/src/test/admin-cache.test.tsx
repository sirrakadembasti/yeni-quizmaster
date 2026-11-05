import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useUserManagement } from '@/hooks/use-user-management';

vi.mock('@/lib/api', () => ({ userApi: { createUser: async () => ({ user: { id: 'new' } }) } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
afterEach(cleanup);

it('a successful user mutation refreshes active class relations and invalidates every cached user/class view', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  const keys = [['users'], ['/api/users'], ['users', 'guardian-management'], ['classes'], ['classes', 'id'], ['/api/classes'], ['teacher-classes'], ['statistics-classes'], ['class-analytics']];
  keys.forEach(key => client.setQueryData(key, { version: 'before' }));
  client.setQueryData(['unrelated'], 'keep');
  const observer = new QueryObserver(client, { queryKey: ['/api/classes'], queryFn: async () => ({ version: 'after' }) });
  const stop = observer.subscribe(() => {});
  const { result } = renderHook(() => useUserManagement('teacher'), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
  await act(async () => { await result.current.createMutation.mutateAsync({ name: 'New teacher' }); });
  expect(client.getQueryData(['/api/classes'])).toEqual({ version: 'after' });
  keys.filter(key => key[0] !== '/api/classes').forEach(key => expect(client.getQueryState(key)?.isInvalidated, key.join('/')).toBe(true));
  expect(client.getQueryState(['unrelated'])?.isInvalidated).toBe(false);
  stop();
  client.clear();
});
