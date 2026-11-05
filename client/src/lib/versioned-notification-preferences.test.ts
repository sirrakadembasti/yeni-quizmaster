import { beforeEach, expect, it, vi } from 'vitest';
const transport = vi.hoisted(() => vi.fn());
vi.mock('./api', () => ({ apiFetch: transport }));
import { getVersionedNotificationPreferences, saveVersionedNotificationPreferences, newerNotificationPreferences } from './versioned-notification-preferences';
const response = (muted: boolean, revision: number) => new Response(JSON.stringify({ muted }), { headers: { ETag: `"${revision}"` } });
beforeEach(() => { transport.mockReset(); });
it('reads revision from ETag while preserving the legacy JSON contract', async () => {
  transport.mockResolvedValue(response(false, 2));
  expect(await getVersionedNotificationPreferences()).toEqual({ muted: false, revision: 2 });
});
it('writes the observed revision through If-Match', async () => {
  transport.mockResolvedValue(response(true, 3));
  expect(await saveVersionedNotificationPreferences(true, 2)).toEqual({ preferences: { muted: true, revision: 3 }, saved: true });
  expect(transport).toHaveBeenCalledWith('/api/notifications/preferences', expect.objectContaining({ method: 'PATCH', headers: { 'Content-Type': 'application/json', 'If-Match': '"2"' }, body: '{"muted":true}' }));
});
it.each(['network', 'conflict', 'malformed'])('refetches durable state after an ambiguous %s write', async reason => {
  if (reason === 'network') transport.mockRejectedValueOnce(new Error('disconnected'));
  else if (reason === 'conflict') transport.mockResolvedValueOnce(new Response('{}', { status: 409 }));
  else transport.mockResolvedValueOnce(new Response('{"muted":true}'));
  transport.mockResolvedValueOnce(response(false, 4));
  expect(await saveVersionedNotificationPreferences(true, 2)).toEqual({ preferences: { muted: false, revision: 4 }, saved: false });
  expect(transport).toHaveBeenCalledTimes(2);
});
it('does not claim success if both write and durable read fail', async () => {
  transport.mockRejectedValue(new Error('offline'));
  await expect(saveVersionedNotificationPreferences(true, 2)).rejects.toThrow('offline');
});
it('reconciles a successful response that does not confirm the command revision', async () => {
  transport.mockResolvedValueOnce(response(true, 2)).mockResolvedValueOnce(response(false, 4));
  expect(await saveVersionedNotificationPreferences(true, 2)).toEqual({ preferences: { muted: false, revision: 4 }, saved: false });
});
it('rejects missing revision or malformed body', async () => {
  transport.mockResolvedValue(new Response('{"muted":"yes"}', { headers: { ETag: '"2"' } }));
  await expect(getVersionedNotificationPreferences()).rejects.toThrow();
});
it('keeps newer state when a stale query or callback completes', () => {
  expect(newerNotificationPreferences({ muted: false, revision: 3 }, { muted: true, revision: 2 })).toEqual({ muted: false, revision: 3 });
});
