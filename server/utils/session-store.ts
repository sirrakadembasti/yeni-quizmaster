import path from 'node:path';
import session from 'express-session';
import type Database from 'better-sqlite3';
import { openSQLite } from './sqlite-runtime';

type Callback = (error?: any, value?: any) => void;
const oneDay = 86400000;

class SQLiteSessionStore extends session.Store {
  readonly db: Database.Database;
  private readonly cleanup: NodeJS.Timeout;

  constructor(directory: string, private readonly touchIntervalMs: number) {
    super();
    this.db = openSQLite(path.resolve(directory, 'sessions.db'), { fileMustExist: false });
    try {
      // Preserve deployed connect-sqlite3 columns and millisecond expiry values.
      this.db.exec('CREATE TABLE IF NOT EXISTS sessions (sid PRIMARY KEY, expired INTEGER, sess TEXT)');
      this.db.prepare('DELETE FROM sessions WHERE expired < ?').run(Date.now());
    } catch (error) { this.db.close(); throw error; }
    this.cleanup = setInterval(() => {
      if (!this.db.open) { clearInterval(this.cleanup); return; }
      this.perform(() => this.db.prepare('DELETE FROM sessions WHERE expired < ?').run(Date.now()));
    }, oneDay).unref();
  }

  private perform(operation: () => unknown, callback?: Callback): void {
    let error: unknown, value: unknown;
    try { value = operation(); } catch (caught) { error = caught; }
    // Never catch exceptions from callers' callbacks and invoke them twice.
    queueMicrotask(() => {
      if (callback) callback(error, value);
      else if (error) this.emit('error', error);
    });
  }

  private expiry(value: session.SessionData): number {
    const cookie = value.cookie;
    if (cookie?.expires) {
      const expiry = new Date(cookie.expires).getTime();
      if (!Number.isFinite(expiry)) throw new Error('Invalid session cookie expiry');
      return expiry;
    }
    const maxAge = cookie?.maxAge;
    if (maxAge != null && !Number.isFinite(maxAge)) throw new Error('Invalid session cookie maxAge');
    return Date.now() + (maxAge ?? oneDay);
  }

  override get(sid: string, callback: Callback): void {
    this.perform(() => {
      const row = this.db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expired > ?').get(sid, Date.now()) as { sess: string } | undefined;
      return row ? JSON.parse(row.sess) : undefined;
    }, callback);
  }

  override set(sid: string, value: session.SessionData, callback?: Callback): void {
    this.perform(() => {
      const expiry = this.expiry(value);
      const serialized = JSON.stringify(value);
      this.db.prepare('INSERT OR REPLACE INTO sessions (sid, expired, sess) VALUES (?, ?, ?)').run(sid, expiry, serialized);
    }, callback);
  }

  override destroy(sid: string, callback?: Callback): void {
    this.perform(() => { this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid); }, callback);
  }

  override touch(sid: string, value: session.SessionData, callback?: Callback): void {
    this.perform(() => {
      // connect-sqlite3 does not refresh browser-session cookies without expires.
      if (!value?.cookie?.expires) return;
      // A request completing after logout/expiry must never recreate a session.
      const expiry = this.expiry(value);
      // With rolling:false, read requests do not issue a newer browser cookie.
      // Keep the DB lifetime at least as long as that issued cookie, coalescing
      // small read-only extensions. Session mutations still call set immediately.
      this.db.prepare('UPDATE sessions SET expired = ? WHERE sid = ? AND expired > ? AND (expired <= ? OR expired > ?)')
        .run(expiry, sid, Date.now(), expiry - this.touchIntervalMs, expiry);
    }, callback);
  }

  override all(callback: Callback): void {
    this.perform(() => (this.db.prepare('SELECT sess FROM sessions WHERE expired > ?').all(Date.now()) as { sess: string }[]).map(row => JSON.parse(row.sess)), callback);
  }

  override length(callback: Callback): void {
    this.perform(() => (this.db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE expired > ?').get(Date.now()) as { count: number }).count, callback);
  }

  override clear(callback?: Callback): void {
    this.perform(() => { this.db.prepare('DELETE FROM sessions').run(); }, callback);
  }

  close(): void {
    clearInterval(this.cleanup);
    if (this.db.open) this.db.close();
  }
}

/** touchIntervalMs > 0 requires rolling:false; zero retains exact Store touch semantics. */
export function createSessionStore(directory: string, { touchIntervalMs = 0 }: { touchIntervalMs?: number } = {}): session.Store {
  if (!Number.isInteger(touchIntervalMs) || touchIntervalMs < 0 || touchIntervalMs > 60000) throw new Error('Invalid session touch interval');
  return new SQLiteSessionStore(directory, touchIntervalMs);
}
