import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.restoreAllMocks(); vi.resetModules(); });
describe('Atomic content transport', () => {
  it.each(['exam', 'survey'] as const)('sends %s content in one authenticated PUT with the CSRF token', async (type) => {
    const fetch = vi.spyOn(window, 'fetch').mockImplementation(async (url) => {
      if (String(url).endsWith('/csrf-token')) return new Response(JSON.stringify({ csrfToken: 'atomic-token' }), { status: 200 });
      return new Response(JSON.stringify({ [type === 'exam' ? 'quiz' : 'survey']: { id: 'stable-id' }, questions: [] }), { status: 200 });
    });
    const { contentSaveApi } = await import('@/lib/content-save');
    const payload = { title: 'Atomic', questions: [], status: 'draft', description: null, timeLimit: null };
    await contentSaveApi.save(type, 'stable-id', payload);
    expect(fetch).toHaveBeenCalledWith(`/api/${type === 'exam' ? 'quizzes' : 'surveys'}/stable-id/content`, expect.objectContaining({
      method: 'PUT', credentials: 'include', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'atomic-token' },
    }));
    expect(fetch.mock.calls.filter(([url]) => !String(url).endsWith('/csrf-token'))).toHaveLength(1);
  });
  it('preserves the error status and message when content cannot be saved', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(async (url) => String(url).endsWith('/csrf-token')
      ? new Response(JSON.stringify({ csrfToken: 'atomic-token' }), { status: 200 })
      : new Response(JSON.stringify({ message: 'Participation started' }), { status: 409 }));
    const { contentSaveApi } = await import('@/lib/content-save');
    await expect(contentSaveApi.save('exam', 'stable-id', {})).rejects.toMatchObject({ status: 409, message: 'Participation started' });
  });
});
