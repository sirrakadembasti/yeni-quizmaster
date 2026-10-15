import { apiFetch } from './api';
import { ApiError } from './http-error';
export interface VersionedNotificationPreferences { muted: boolean; revision: number }
const endpoint = '/api/notifications/preferences';
async function parsePreferences(response: Response): Promise<VersionedNotificationPreferences> {
  if (!response.ok) throw new ApiError('Bildirim tercihleri güncellenemedi.', response.status);
  const body = await response.json();
  const etag = response.headers.get('ETag');
  const revision = etag && /^"(0|[1-9]\d*)"$/.test(etag) ? Number(etag.slice(1, -1)) : NaN;
  if (typeof body?.muted !== 'boolean' || !Number.isSafeInteger(revision) || revision < 0) throw new Error('Bildirim tercihleri doğrulanamadı.');
  return { muted: body.muted, revision };
}
export async function getVersionedNotificationPreferences(): Promise<VersionedNotificationPreferences> {
  return parsePreferences(await apiFetch(endpoint, { credentials: 'include', cache: 'no-store' }));
}
export async function saveVersionedNotificationPreferences(muted: boolean, revision: number): Promise<{ preferences: VersionedNotificationPreferences; saved: boolean }> {
  try {
    const response = await apiFetch(endpoint, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json', 'If-Match': `"${revision}"` }, body: JSON.stringify({ muted }) });
    const preferences = await parsePreferences(response);
    if (preferences.revision !== revision + 1 || preferences.muted !== muted) throw new Error('Bildirim tercihi doğrulanamadı.');
    return { preferences, saved: true };
  } catch (error) {
    // A failed response does not prove the write rolled back. Read durable state once.
    try { return { preferences: await getVersionedNotificationPreferences(), saved: false }; }
    catch { throw error; }
  }
}
export function newerNotificationPreferences(previous: VersionedNotificationPreferences | undefined, incoming: VersionedNotificationPreferences): VersionedNotificationPreferences {
  return previous && previous.revision > incoming.revision ? previous : incoming;
}
