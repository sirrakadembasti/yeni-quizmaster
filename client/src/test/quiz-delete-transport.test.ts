import { afterEach, expect, it, vi } from 'vitest';
import { deleteQuizWithReason } from '@/lib/quiz-delete';
afterEach(() => vi.restoreAllMocks());
it('transports the reason in a CSRF protected DELETE request', async () => {
 const fetch = vi.spyOn(window, 'fetch').mockImplementation(async (url) => new Response(JSON.stringify(String(url).includes('csrf-token') ? {csrfToken:'token'} : {message:'deleted'}), {status:200, headers:{'Content-Type':'application/json'}}));
 await deleteQuizWithReason('exam', 'Duplicate exam');
 const [, options] = fetch.mock.calls.find(([, options]) => options?.method === 'DELETE')!;
 expect(options?.body).toBe(JSON.stringify({reason:'Duplicate exam'}));
 expect(options?.headers).toEqual(expect.objectContaining({'x-csrf-token':'token'}));
});
