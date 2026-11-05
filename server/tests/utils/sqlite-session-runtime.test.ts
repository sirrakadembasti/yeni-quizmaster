import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { createSessionStore } from '../../utils/session-store';

const owned: { directory: string; store: any }[] = [];
const require = createRequire(import.meta.url);
const legacySQLite = require(createRequire(require.resolve('connect-sqlite3')).resolve('sqlite3'));
function fixture(options?: any) {
  const directory = mkdtempSync(join(tmpdir(), 'quizmaster-test-session-runtime-'));
  const store = (createSessionStore as any)(directory, options) as any;
  owned.push({ directory, store });
  return store;
}
const invoke = (store: any, method: string, ...args: any[]) => new Promise<any>((resolve, reject) =>
  store[method](...args, (error: any, value: any) => error ? reject(error) : resolve(value)));
const payload = (maxAge: number | null = 60000) => ({ userId: 'owned-user', sessionVersion: 7,
  cookie: { maxAge, expires: maxAge === null ? undefined : new Date(Date.now() + maxAge), originalMaxAge: maxAge, httpOnly: true } });

it('coalesces redundant non-rolling read touches without shortening the issued cookie lifetime or delaying session changes', async () => {
  const store = fixture({ touchIntervalMs: 60000 });
  const session = payload(86400000), expiry = session.cookie.expires!.getTime();
  await invoke(store, 'set', 'owned-session', session);
  const changes = () => store.db.prepare('SELECT total_changes() AS changes').get().changes;
  const before = changes();
  await invoke(store, 'touch', 'owned-session', { ...session, cookie: { ...session.cookie, expires: new Date(expiry + 1000) } });
  expect(changes()).toBe(before);
  expect(store.db.prepare('SELECT expired FROM sessions').get().expired).toBe(expiry);
  expect((await invoke(store, 'get', 'owned-session')).cookie.expires).toBe(new Date(expiry).toISOString());
  await invoke(store, 'touch', 'owned-session', { ...session, cookie: { ...session.cookie, expires: new Date(expiry + 60001) } });
  expect(store.db.prepare('SELECT expired FROM sessions').get().expired).toBe(expiry + 60001);
  await invoke(store, 'set', 'owned-session', { ...session, sessionVersion: 8, cookie: { ...session.cookie, expires: new Date(expiry + 61000) } });
  expect((await invoke(store, 'get', 'owned-session')).sessionVersion).toBe(8);
  expect(store.db.prepare('SELECT expired FROM sessions').get().expired).toBe(expiry + 61000);
  await invoke(store, 'destroy', 'owned-session');
  await invoke(store, 'touch', 'owned-session', session);
  expect(await invoke(store, 'get', 'owned-session')).toBeUndefined();
});

it('persists an explicit expiry reduction immediately even when read touches are coalesced', async () => {
  const store = fixture({ touchIntervalMs: 60000 });
  const session = payload(86400000), expiry = session.cookie.expires!.getTime();
  await invoke(store, 'set', 'owned-session', session);
  await invoke(store, 'touch', 'owned-session', { ...session, cookie: { ...session.cookie, expires: new Date(expiry - 1000) } });
  expect(store.db.prepare('SELECT expired FROM sessions').get().expired).toBe(expiry - 1000);
});
afterEach(async () => {
  for (const { directory, store } of owned.splice(0)) {
    if (typeof store.close === 'function') store.close();
    else await new Promise<void>((resolve, reject) => store.db.close((error: any) => error ? reject(error) : resolve()));
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

it('opens sessions with a SQLite runtime containing the WAL reset fix', async () => {
  const store = fixture();
  let row: any;
  if (typeof store.db.pragma === 'function') row = store.db.prepare('SELECT sqlite_version() AS version').get();
  else row = await new Promise((resolve, reject) => store.db.get('SELECT sqlite_version() AS version', (error: any, value: any) => error ? reject(error) : resolve(value)));
  const [major, minor, patch] = row.version.split('.').map(Number);
  expect(major * 1000000 + minor * 1000 + patch).toBeGreaterThanOrEqual(3051003);
});

it('preserves the existing sid/expired/sess schema and authenticated identity through resave', async () => {
  const store = fixture();
  await invoke(store, 'set', 'owned-session', payload());
  const columns = store.db.pragma('table_info(sessions)').map((column: any) => column.name);
  expect(columns).toEqual(['sid', 'expired', 'sess']);
  expect(await invoke(store, 'get', 'owned-session')).toMatchObject({ userId: 'owned-user', sessionVersion: 7 });
  await invoke(store, 'set', 'owned-session', { ...payload(), sessionVersion: 8 });
  expect(await invoke(store, 'length')).toBe(1);
  expect(await invoke(store, 'get', 'owned-session')).toMatchObject({ sessionVersion: 8 });
  await invoke(store, 'destroy', 'owned-session');
  expect(await invoke(store, 'get', 'owned-session')).toBeUndefined();
});

it('opens an existing connect-sqlite3 session without logging the user out or rewriting its payload', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'quizmaster-test-session-runtime-'));
  const legacy = new legacySQLite.Database(join(directory, 'sessions.db'));
  const serialized = JSON.stringify(payload());
  const expiry = Date.now() + 60000;
  await new Promise<void>((resolve, reject) => legacy.exec('CREATE TABLE sessions (sid PRIMARY KEY, expired, sess)', (error: any) => error ? reject(error) : resolve()));
  await new Promise<void>((resolve, reject) => legacy.run('INSERT INTO sessions VALUES (?, ?, ?)', ['existing', expiry, serialized], (error: any) => error ? reject(error) : resolve()));
  await new Promise<void>((resolve, reject) => legacy.close((error: any) => error ? reject(error) : resolve()));
  const store = createSessionStore(directory) as any;
  owned.push({ directory, store });
  expect(await invoke(store, 'get', 'existing')).toMatchObject({ userId: 'owned-user', sessionVersion: 7 });
  expect(store.db.prepare('SELECT expired, sess FROM sessions WHERE sid=?').get('existing')).toEqual({ expired: expiry, sess: serialized });
});

it('does not resurrect expired or immediately expired cookies with touch', async () => {
  const store = fixture();
  await invoke(store, 'set', 'expired', payload(-1000));
  await invoke(store, 'touch', 'expired', payload());
  expect(await invoke(store, 'get', 'expired')).toBeUndefined();
  await invoke(store, 'set', 'zero', payload(0));
  expect(await invoke(store, 'get', 'zero')).toBeUndefined();
  await invoke(store, 'set', 'browser', payload(null));
  expect(await invoke(store, 'get', 'browser')).toMatchObject({ userId: 'owned-user' });
});

it('touch updates only expiry and retains the persisted session payload', async () => {
  const store = fixture();
  await invoke(store, 'set', 'owned-session', payload());
  const before = store.db.prepare('SELECT expired FROM sessions WHERE sid=?').get('owned-session').expired;
  await invoke(store, 'touch', 'owned-session', { ...payload(120000), userId: 'unpersisted-user' });
  const after = store.db.prepare('SELECT expired FROM sessions WHERE sid=?').get('owned-session').expired;
  expect(after).toBeGreaterThan(before);
  expect(await invoke(store, 'get', 'owned-session')).toMatchObject({ userId: 'owned-user' });
  expect(await invoke(store, 'all')).toHaveLength(1);
  await invoke(store, 'clear');
  expect(await invoke(store, 'length')).toBe(0);
});

it('preserves legacy touch behavior when a browser cookie has no expires value', async () => {
  const store = fixture();
  await invoke(store, 'set', 'browser', payload(null));
  store.db.prepare('UPDATE sessions SET expired=? WHERE sid=?').run(4070908800000, 'browser');
  await invoke(store, 'touch', 'browser', payload(null));
  expect(store.db.prepare('SELECT expired FROM sessions WHERE sid=?').get('browser')).toEqual({ expired: 4070908800000 });
});

it('returns malformed JSON and closed database errors through exactly one callback', async () => {
  const store = fixture();
  store.db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run('malformed', Date.now() + 60000, '{');
  let calls = 0;
  await new Promise<void>(resolve => store.get('malformed', (error: any) => { calls++; expect(error).toBeInstanceOf(Error); resolve(); }));
  await new Promise(resolve => setImmediate(resolve));
  expect(calls).toBe(1);
  store.db.close();
  calls = 0;
  await new Promise<void>(resolve => store.touch('owned-session', payload(), (error: any) => { calls++; expect(error).toBeInstanceOf(Error); resolve(); }));
  await new Promise(resolve => setImmediate(resolve));
  expect(calls).toBe(1);
});

it('emits errors for failed writes without callbacks and rejects invalid cookie expiry', async () => {
  const store = fixture();
  await expect(invoke(store, 'set', 'invalid', { ...payload(), cookie: { expires: 'invalid' } })).rejects.toThrow();
  expect(await invoke(store, 'length')).toBe(0);
  store.db.close();
  const error = new Promise(resolve => store.once('error', resolve));
  store.set('closed', payload());
  expect(await error).toBeInstanceOf(Error);
});
