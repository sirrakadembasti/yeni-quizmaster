import session from 'express-session';
import connectSqlite3 from 'connect-sqlite3';

const SQLiteStore = connectSqlite3(session);

export function createSessionStore(directory: string): session.Store {
  // Read-only authenticated requests still touch expiry. WAL prevents each touch
  // from holding a rollback-journal write lock against concurrent session reads.
  // The installed runtime spells this concurrentDb; its external types spell
  // it concurrentDB. Keep the runtime spelling, verified by the PRAGMA test.
  const options = { db: 'sessions.db', dir: directory, concurrentDb: true };
  // Legacy connect-sqlite3 declarations use their own SessionData namespace,
  // which cannot carry express-session's application userId augmentation.
  return new SQLiteStore(options) as unknown as session.Store;
}
