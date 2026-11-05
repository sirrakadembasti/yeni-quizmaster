import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SessionData } from 'express-session';
import { createSessionStore } from '../../utils/session-store';

const stores: { store: ReturnType<typeof createSessionStore>; directory: string }[] = [];
function fixture() {
  const directory = mkdtempSync(join(dirname(fileURLToPath(import.meta.url)), '../../data/quizmaster-test-session-store-'));
  const store = createSessionStore(directory);
  stores.push({ store, directory });
  return store;
}
const invoke = (store: any, method: string, ...args: any[]) => new Promise<any>((resolve, reject) =>
  store[method](...args, (error: any, value: any) => error ? reject(error) : resolve(value)));
const data = (expires = new Date(Date.now() + 60000)) => ({ userId: 'isolated-user', sessionVersion: 3,
  cookie: { expires, maxAge: 60000, originalMaxAge: 60000, httpOnly: true } }) as SessionData;

afterEach(async () => {
  for (const { store, directory } of stores.splice(0)) {
    (store as any).close();
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

describe('SQLite session store', () => {
  it('uses WAL to avoid rollback journal writes on every parallel session touch', async () => {
    const store = fixture();
    expect((store as any).db.pragma('journal_mode', { simple: true })).toBe('wal');
  });
  it('preserves session identity/version across concurrent reads and touches then revokes it', async () => {
    const store = fixture(), payload = data();
    await invoke(store, 'set', 'isolated-session', payload);
    await Promise.all(Array.from({ length: 30 }, async () => {
      await invoke(store, 'touch', 'isolated-session', payload);
      const current = await invoke(store, 'get', 'isolated-session');
      expect(current.userId).toBe('isolated-user');
      expect(current.sessionVersion).toBe(3);
    }));
    await invoke(store, 'destroy', 'isolated-session');
    expect(await invoke(store, 'get', 'isolated-session')).toBeUndefined();
  });
  it('does not return an expired session', async () => {
    const store = fixture();
    const payload = data(new Date(Date.now() - 1000));
    payload.cookie.maxAge = -1000;
    await invoke(store, 'set', 'expired-session', payload);
    expect(await invoke(store, 'get', 'expired-session')).toBeUndefined();
  });
});
