import { describe, expect, it } from 'vitest';
import { readNotificationPreferences, writeNotificationPreferences, NotificationPreferenceConflict } from '../../services/notification-preferences';

function database() {
  const state = { notificationMuted: false, notificationRevision: 0 };
  let calls = 0;
  const db = { user: {
    findUnique: async () => ({ ...state }),
    updateMany: async (args: any) => {
      calls++;
      if (args.where.notificationRevision !== state.notificationRevision) return { count: 0 };
      state.notificationMuted = args.data.notificationMuted;
      state.notificationRevision++;
      return { count: 1 };
    },
  } };
  return { db, state, calls: () => calls };
}

describe('versioned notification preferences', () => {
  it('reads persisted state and increments the revision atomically', async () => {
    const { db } = database();
    expect(await readNotificationPreferences(db, 'u')).toEqual({ muted: false, revision: 0 });
    expect(await writeNotificationPreferences(db, 'u', true, 0)).toEqual({ muted: true, revision: 1 });
  });
  it('rejects stale commands even if their value matches another client write', async () => {
    const { db, state } = database();
    await writeNotificationPreferences(db, 'u', true, 0);
    await expect(writeNotificationPreferences(db, 'u', true, 0)).rejects.toBeInstanceOf(NotificationPreferenceConflict);
    expect(state.notificationRevision).toBe(1);
    await writeNotificationPreferences(db, 'u', false, 1);
    await expect(writeNotificationPreferences(db, 'u', true, 0)).rejects.toBeInstanceOf(NotificationPreferenceConflict);
    expect(state.notificationMuted).toBe(false);
  });
  it.each(['P1008', 'P2028', 'P2034'])('bounds retries for %s', async code => {
    const { db } = database();
    let calls = 0;
    db.user.updateMany = async () => { calls++; throw { code }; };
    await expect(writeNotificationPreferences(db, 'u', true, 0)).rejects.toEqual({ code });
    expect(calls).toBe(3);
  });
  it('does not retry nontransient errors', async () => {
    const { db } = database(); let calls = 0;
    db.user.updateMany = async () => { calls++; throw { code: 'P2002' }; };
    await expect(writeNotificationPreferences(db, 'u', true, 0)).rejects.toEqual({ code: 'P2002' });
    expect(calls).toBe(1);
  });
  it('never rebases a legacy command after a timeout and concurrent newer write', async () => {
    const { db, state } = database(); let calls = 0;
    const update = db.user.updateMany;
    db.user.updateMany = async args => {
      calls++;
      if (calls === 1) { state.notificationRevision = 2; state.notificationMuted = false; throw { code: 'P1008' }; }
      return update(args);
    };
    await expect(writeNotificationPreferences(db, 'u', true)).rejects.toBeInstanceOf(NotificationPreferenceConflict);
    expect(state).toEqual({ notificationMuted: false, notificationRevision: 2 });
  });
  it('does not repeat an ambiguously committed operation', async () => {
    const { db, state } = database(); const update = db.user.updateMany;
    let first = true;
    db.user.updateMany = async args => {
      const result = await update(args);
      if (first) { first = false; throw { code: 'P2028' }; }
      return result;
    };
    await expect(writeNotificationPreferences(db, 'u', true, 0)).rejects.toBeInstanceOf(NotificationPreferenceConflict);
    expect(state).toEqual({ notificationMuted: true, notificationRevision: 1 });
  });
});
