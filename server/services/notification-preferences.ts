export interface NotificationPreferences { muted: boolean; revision: number }
export interface NotificationPreferencesDatabase {
  user: {
    findUnique(args: { where: { id: string }; select: { notificationMuted: true; notificationRevision: true } }): Promise<{ notificationMuted: boolean; notificationRevision: number } | null>;
    updateMany(args: { where: { id: string; notificationRevision: number }; data: { notificationMuted: boolean; notificationRevision: { increment: number } } }): Promise<{ count: number }>;
  };
}

export class NotificationPreferenceConflict extends Error {
  constructor() { super('Bildirim tercihi değişti. Lütfen yeniden deneyin.'); this.name = 'NotificationPreferenceConflict'; }
}

const transientCodes = new Set(['P1008', 'P2028', 'P2034']);
async function retryTransient<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (attempt >= 2 || typeof code !== 'string' || !transientCodes.has(code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}

export async function readNotificationPreferences(db: NotificationPreferencesDatabase, userId: string): Promise<NotificationPreferences> {
  const user = await retryTransient(() => db.user.findUnique({ where: { id: userId }, select: { notificationMuted: true, notificationRevision: true } }));
  if (!user) throw new Error('Kullanıcı bulunamadı.');
  return { muted: user.notificationMuted, revision: user.notificationRevision };
}

export async function writeNotificationPreferences(db: NotificationPreferencesDatabase, userId: string, muted: boolean, expectedRevision?: number): Promise<NotificationPreferences> {
  // Capture once: rebasing a delayed command would overwrite a newer user's choice.
  const revision = expectedRevision ?? (await readNotificationPreferences(db, userId)).revision;
  if (!Number.isSafeInteger(revision) || revision < 0 || revision >= 2147483647) throw new NotificationPreferenceConflict();
  const result = await retryTransient(() => db.user.updateMany({
    where: { id: userId, notificationRevision: revision },
    data: { notificationMuted: muted, notificationRevision: { increment: 1 } },
  }));
  // A timeout may have committed; equal value/revision is also possible from another client.
  // Return conflict rather than claiming that client's command as our own success.
  if (result.count !== 1) throw new NotificationPreferenceConflict();
  return { muted, revision: revision + 1 };
}
