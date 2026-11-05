import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { assertPatchedSQLite, createRuntimePrismaClient, openSQLite, resolveSQLiteDatabasePath } from '../../utils/sqlite-runtime';

const directories: string[] = [];
const require = createRequire(import.meta.url);
const legacySQLite = require(createRequire(require.resolve('connect-sqlite3')).resolve('sqlite3'));
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'quizmaster-test-sqlite-runtime-'));
  directories.push(directory);
  return { directory, file: join(directory, 'fixture.db') };
}
async function existingDatabase(file: string) {
  const db = new legacySQLite.Database(file);
  await new Promise<void>((resolve, reject) => db.exec('CREATE TABLE runtime_probe (id INTEGER PRIMARY KEY, createdAt NUMERIC NOT NULL)', (error: any) => error ? reject(error) : resolve()));
  await new Promise<void>((resolve, reject) => db.close((error: any) => error ? reject(error) : resolve()));
}
afterEach(() => directories.splice(0).forEach(directory => rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));

it('reports an independent SQLite writer lock as P2034 and recovers after release', async () => {
  const { file } = fixture(); await existingDatabase(file);
  const lock = openSQLite(file);
  lock.exec("CREATE TABLE User(id TEXT PRIMARY KEY,studentNo INTEGER); INSERT INTO User VALUES('owned',1);");
  const db = createRuntimePrismaClient({ databaseUrl: 'file:' + file.replaceAll('\\', '/') });
  try {
    await db.$connect();
    lock.exec('BEGIN IMMEDIATE');
    await expect(db.user.update({ where: { id: 'owned' }, data: { studentNo: 2 }, select: { studentNo: true } })).rejects.toMatchObject({ code: 'P2034' });
    lock.exec('ROLLBACK');
    expect(await db.user.update({ where: { id: 'owned' }, data: { studentNo: 3 }, select: { studentNo: true } })).toEqual({ studentNo: 3 });
  } finally {
    if (lock.inTransaction) lock.exec('ROLLBACK');
    await db.$disconnect(); lock.close();
  }
});

it('opens the .env-only configured database before application dotenv initialization without mutating the process environment', async () => {
  const { directory, file } = fixture();
  await existingDatabase(file);
  mkdirSync(join(directory, 'server'));
  writeFileSync(join(directory, '.env'), 'DATABASE_URL=file:./wrong-root.db\nOTHER_SECRET=owned-root-placeholder\n');
  writeFileSync(join(directory, 'server', '.env'), 'DATABASE_URL=file:' + file.replaceAll('\\', '/') + '\nOTHER_SECRET=owned-server-placeholder\n');
  const previous = process.env.DATABASE_URL;
  const previousSecret = process.env.OTHER_SECRET;
  delete process.env.DATABASE_URL;
  try {
    const db = createRuntimePrismaClient({ projectRoot: directory });
    try { expect(await db.$queryRawUnsafe('SELECT sqlite_version() AS version')).toEqual([{ version: '3.51.3' }]); }
    finally { await db.$disconnect(); }
    expect(process.env.DATABASE_URL).toBeUndefined();
    expect(process.env.OTHER_SECRET).toBe(previousSecret);
    expect(existsSync(join(directory, 'server', 'prisma', 'wrong-root.db'))).toBe(false);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

it('resolves legacy schema-relative URLs independently of working directory', () => {
  const { directory } = fixture();
  expect(resolveSQLiteDatabasePath('file:../data/quiz.db', directory)).toBe(join(directory, 'server', 'data', 'quiz.db'));
  const absolute = join(directory, 'synthetic.db');
  expect(resolveSQLiteDatabasePath('file:' + absolute.replaceAll('\\', '/'), directory)).toBe(absolute);
  for (const value of ['postgres://x', 'file:../data/quiz.db?connection_limit=1', 'file:', 'file::memory:']) {
    expect(() => resolveSQLiteDatabasePath(value, directory)).toThrow();
  }
});

it('rejects obsolete and withdrawn engines before permitting WAL', () => {
  for (const version of ['3.44.2', '3.45.0', '3.46.0', '3.51.2', '3.52.0', 'nonsense']) expect(() => assertPatchedSQLite(version)).toThrow();
  for (const version of ['3.44.6', '3.50.7', '3.51.3', '3.53.0']) expect(() => assertPatchedSQLite(version)).not.toThrow();
});

it('refuses a missing or non-SQLite quiz database without creating or overwriting it', () => {
  const { file } = fixture();
  expect(() => openSQLite(file)).toThrow();
  expect(existsSync(file)).toBe(false);
  writeFileSync(file, 'preserve this non-database');
  expect(() => openSQLite(file)).toThrow();
});

it('sets durable WAL and bounded busy waiting on the patched native connection', async () => {
  const { file } = fixture();
  await existingDatabase(file);
  const db = openSQLite(file);
  try {
    expect(db.prepare('SELECT sqlite_version() AS version').get()).toEqual({ version: '3.51.3' });
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('synchronous', { simple: true })).toBe(2);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('busy_timeout', { simple: true })).toBe(50);
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
  } finally { db.close(); }
});

it('opens maintenance sources read-only without changing their journal mode', async () => {
  const { file } = fixture();
  await existingDatabase(file);
  const db = openSQLite(file, { readonly: true });
  try {
    expect(db.pragma('journal_mode', { simple: true })).toBe('delete');
    expect(() => db.prepare('INSERT INTO runtime_probe VALUES (1, 1)').run()).toThrow();
  } finally { db.close(); }
});

it('keeps a readonly Prisma connection in DELETE mode and rejects mutation', async () => {
  const { file } = fixture();
  await existingDatabase(file);
  const reader = createRuntimePrismaClient({ databaseUrl: 'file:' + file.replaceAll('\\', '/'), readonly: true });
  try {
    expect(await reader.$queryRawUnsafe('PRAGMA journal_mode')).toEqual([{ journal_mode: 'delete' }]);
    await expect(reader.$executeRawUnsafe('INSERT INTO runtime_probe VALUES (1, 1)')).rejects.toThrow();
  } finally { await reader.$disconnect(); }
});

it('reads committed WAL data while an independent writer transaction is paused', async () => {
  const { file } = fixture();
  await existingDatabase(file);
  const url = 'file:' + file.replaceAll('\\', '/');
  const writer = createRuntimePrismaClient({ databaseUrl: url });
  const reader = createRuntimePrismaClient({ databaseUrl: url, readonly: true });
  let release!: () => void, signal!: () => void;
  const paused = new Promise<void>(resolve => { release = resolve; });
  const changed = new Promise<void>(resolve => { signal = resolve; });
  let transaction: Promise<unknown> | undefined;
  try {
    await writer.$executeRawUnsafe('INSERT INTO runtime_probe VALUES (1, 1)');
    await reader.$connect();
    transaction = writer.$transaction(async tx => {
      await tx.$executeRawUnsafe('UPDATE runtime_probe SET createdAt=2 WHERE id=1');
      signal();
      await paused;
    }, { timeout: 10000 });
    await changed;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const rows = await Promise.race([
        reader.$queryRawUnsafe('SELECT CAST(createdAt AS TEXT) AS value FROM runtime_probe'),
        new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('Read waited behind writer transaction')), 2000); }),
      ]);
      expect(rows).toEqual([{ value: '1' }]);
    } finally { clearTimeout(deadline); }
    release();
    await transaction;
    expect(await reader.$queryRawUnsafe('SELECT CAST(createdAt AS TEXT) AS value FROM runtime_probe')).toEqual([{ value: '2' }]);
    await expect(reader.$executeRawUnsafe('UPDATE runtime_probe SET createdAt=3')).rejects.toThrow();
  } finally {
    release();
    await transaction?.catch(() => undefined);
    await Promise.all([writer.$disconnect(), reader.$disconnect()]);
  }
});

it.each(['update', 'create'])('does not acknowledge an outside ORM %s inside another transaction that rolls back', async kind => {
  const { file } = fixture();
  await existingDatabase(file);
  const native = openSQLite(file);
  native.exec(`CREATE TABLE User(id TEXT PRIMARY KEY,createdAt DATETIME,isActive BOOLEAN,studentNo INTEGER);
  INSERT INTO User VALUES('transaction',0,1,100),('outside',0,1,103);
  CREATE TABLE StudentResult(id TEXT PRIMARY KEY,studentId TEXT,quizId TEXT,status TEXT,answers TEXT,score INTEGER,correctAnswersCount INTEGER,totalQuestions INTEGER,timeTaken INTEGER,academicYear TEXT,startedAt DATETIME,submittedAt DATETIME,completedAt DATETIME);`);
  native.close();
  const db = createRuntimePrismaClient({ databaseUrl: 'file:' + file.replaceAll('\\', '/') });
  let release!: () => void, entered!: () => void;
  const pause = new Promise<void>(resolve => { release = resolve; });
  const changed = new Promise<void>(resolve => { entered = resolve; });
  let transaction: Promise<unknown> | undefined, outside: Promise<unknown> | undefined;
  try {
    transaction = db.$transaction(async tx => {
      await tx.$executeRawUnsafe('UPDATE User SET studentNo=101 WHERE id=?', 'transaction');
      entered(); await pause; throw new Error('Owned rollback');
    }).catch(error => { if (!error.message.includes('Owned rollback')) throw error; });
    await changed;
    let acknowledged = false;
    const operation = kind === 'update'
      ? db.user.update({ where: { id: 'outside' }, data: { studentNo: 104 }, select: { studentNo: true } })
      : db.studentResult.create({ data: { id: 'created', studentId: 'student', quizId: 'quiz' }, select: { id: true } });
    outside = operation.then(value => { acknowledged = true; return value; });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(acknowledged).toBe(false);
    release(); await transaction; await outside;
    if (kind === 'update') expect(await db.user.findUnique({ where: { id: 'outside' }, select: { studentNo: true } })).toEqual({ studentNo: 104 });
    else expect(await db.studentResult.count({ where: { id: 'created' } })).toBe(1);
  } finally {
    release(); await transaction; await outside; await db.$disconnect();
  }
});

it('rolls back a deferred constraint commit failure before admitting later mutations', async () => {
  const { file } = fixture(); await existingDatabase(file);
  const native = openSQLite(file);
  native.exec('CREATE TABLE Parent(id INTEGER PRIMARY KEY); CREATE TABLE Child(id INTEGER PRIMARY KEY,parentId INTEGER REFERENCES Parent(id) DEFERRABLE INITIALLY DEFERRED);');
  native.close();
  const db = createRuntimePrismaClient({ databaseUrl: 'file:' + file.replaceAll('\\', '/') });
  try {
    await expect(db.$transaction(tx => tx.$executeRawUnsafe('INSERT INTO Child VALUES(1,404)'))).rejects.toThrow();
    expect(await db.$queryRawUnsafe('SELECT CAST(COUNT(*) AS TEXT) AS count FROM Child')).toEqual([{ count: '0' }]);
    await db.$executeRawUnsafe('INSERT INTO Parent VALUES(404)');
    await db.$executeRawUnsafe('INSERT INTO Child VALUES(2,404)');
    expect(await db.$queryRawUnsafe('SELECT CAST(COUNT(*) AS TEXT) AS count FROM Child')).toEqual([{ count: '1' }]);
  } finally { await db.$disconnect(); }
});

it('keeps a queued start pending despite upstream maxWait and safely admits it after settlement', async () => {
  const { file } = fixture(); await existingDatabase(file);
  const db = createRuntimePrismaClient({ databaseUrl: 'file:' + file.replaceAll('\\', '/') });
  let release!: () => void, entered!: () => void;
  const pause = new Promise<void>(resolve => { release = resolve; });
  const changed = new Promise<void>(resolve => { entered = resolve; });
  let first: Promise<unknown> | undefined, second: Promise<unknown> | undefined;
  const within = async <T>(operation: Promise<T>) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Connection remained stuck')), 2000); })]); }
    finally { clearTimeout(timer); }
  };
  try {
    await db.$executeRawUnsafe('INSERT INTO runtime_probe VALUES(1,1)');
    first = db.$transaction(async tx => {
      await tx.$executeRawUnsafe('UPDATE runtime_probe SET createdAt=2');
      entered(); await pause;
    }, { timeout: 10000 });
    await changed;
    let secondCallbackRan = false, secondSettled = false;
    second = db.$transaction(tx => {
      secondCallbackRan = true;
      return tx.$executeRawUnsafe('UPDATE runtime_probe SET createdAt=3');
    }, { maxWait: 30, timeout: 1000 }).finally(() => { secondSettled = true; });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(secondCallbackRan).toBe(false);
    expect(secondSettled).toBe(false);
    release(); await first;
    await within(second);
    expect(secondCallbackRan).toBe(true);
    await within(db.$executeRawUnsafe('UPDATE runtime_probe SET createdAt=4'));
    await within(db.$transaction(tx => tx.$executeRawUnsafe('UPDATE runtime_probe SET createdAt=5')));
    expect(await within(db.$queryRawUnsafe('SELECT CAST(createdAt AS TEXT) AS value FROM runtime_probe'))).toEqual([{ value: '5' }]);
  } finally {
    release(); await first?.catch(() => undefined); await second?.catch(() => undefined); await db.$disconnect();
  }
});

it('rolls back an active transaction timeout before outside writes and rejects its late callback', async () => {
  const { file } = fixture(); await existingDatabase(file);
  const db = createRuntimePrismaClient({ databaseUrl: 'file:' + file.replaceAll('\\', '/') });
  let release!: () => void, entered!: () => void;
  const pause = new Promise<void>(resolve => { release = resolve; });
  const changed = new Promise<void>(resolve => { entered = resolve; });
  let transaction: Promise<unknown> | undefined;
  try {
    await db.$executeRawUnsafe('INSERT INTO runtime_probe VALUES(1,1)');
    transaction = db.$transaction(async tx => {
      await tx.$executeRawUnsafe('UPDATE runtime_probe SET createdAt=2 WHERE id=1');
      entered(); await pause;
      await tx.$executeRawUnsafe('UPDATE runtime_probe SET createdAt=99 WHERE id=1');
    }, { timeout: 50 }).catch(error => error);
    await changed;
    await new Promise(resolve => setTimeout(resolve, 150));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([db.$executeRawUnsafe('UPDATE runtime_probe SET createdAt=3 WHERE id=1'),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out transaction retained the gate')), 2000); })]);
    } finally { clearTimeout(timer); }
    release();
    const error = await transaction;
    expect(error).toMatchObject({ code: 'P2028' });
    expect(await db.$queryRawUnsafe('SELECT CAST(createdAt AS TEXT) AS value FROM runtime_probe')).toEqual([{ value: '3' }]);
  } finally { release(); await transaction; await db.$disconnect(); }
});

it('uses patched SQLite through the default Prisma library engine with millisecond timestamps', async () => {
  const { file } = fixture();
  await existingDatabase(file);
  const db = createRuntimePrismaClient({ databaseUrl: 'file:' + file.replaceAll('\\', '/') });
  try {
    await db.$connect();
    expect(await db.$queryRawUnsafe('SELECT sqlite_version() AS version')).toEqual([{ version: '3.51.3' }]);
    expect(await db.$queryRawUnsafe('PRAGMA journal_mode')).toEqual([{ journal_mode: 'wal' }]);
    expect(await db.$queryRawUnsafe('PRAGMA synchronous')).toEqual([{ synchronous: 2n }]);
    await db.$executeRawUnsafe('INSERT INTO runtime_probe VALUES (?, ?)', 1, new Date('2025-01-02T03:04:05.678Z'));
    expect(await db.$queryRawUnsafe('SELECT CAST(createdAt AS TEXT) AS timestamp FROM runtime_probe')).toEqual([{ timestamp: '1735787045678' }]);
    // Raw parameters arrive as REAL even when called with BigInt through the
    // library bridge. Archive capabilities must match the integer row JSON.
    expect(await db.$queryRawUnsafe("SELECT CAST(json_object('at',CAST(? AS INTEGER))=json_object('at',createdAt) AS TEXT) AS exact FROM runtime_probe", 1735787045678n)).toEqual([{ exact: '1' }]);
    const native = openSQLite(file);
    try { expect(native.prepare('SELECT createdAt FROM runtime_probe').get()).toEqual({ createdAt: 1735787045678 }); }
    finally { native.close(); }
  } finally { await db.$disconnect(); }
});
