import { expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, basename, join } from 'node:path';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);

it('retries notification writer contention and creates exactly one durable notification', async () => {
  const root = mkdtempSync(join(tmpdir(), 'quizmaster-test-storage-notification-'));
  const filename = join(root, 'owned.db');
  const Native = req('better-sqlite3');
  const lock = new Native(filename);
  lock.exec('CREATE TABLE Notification(id TEXT PRIMARY KEY,userId TEXT NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,type TEXT NOT NULL,isRead BOOLEAN NOT NULL DEFAULT false,createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'file:' + filename.replaceAll('\\', '/');
  vi.resetModules();
  const { storage, initializeStorage, getStorageDbForTests } = await import('../../storage');
  const writer = getStorageDbForTests();
  let release: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<unknown> | undefined;
  try {
    await initializeStorage();
    lock.exec('BEGIN IMMEDIATE');
    release = setTimeout(() => lock.exec('ROLLBACK'), 180);
    pending = storage.createNotification({ userId: 'owned-user', title: 'Owned title', message: 'Owned message' });
    await expect(pending).resolves.toMatchObject({ userId: 'owned-user', title: 'Owned title' });
    expect(lock.prepare('SELECT COUNT(*) AS count FROM Notification').get()).toEqual({ count: 1 });
  } finally {
    clearTimeout(release);
    if (lock.inTransaction) lock.exec('ROLLBACK');
    await pending?.catch(() => undefined);
    await writer.$disconnect(); lock.close();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    if (dirname(root) !== tmpdir() || !basename(root).startsWith('quizmaster-test-storage-notification-')) throw new Error('Unsafe test cleanup');
    rmSync(root, { recursive: true, force: true });
  }
});

it('reads committed results during a storage writer transaction and teardown closes both clients', async () => {
  const root = mkdtempSync(join(tmpdir(), 'quizmaster-test-storage-read-'));
  const filename = join(root, 'owned.db');
  const Native = req('better-sqlite3');
  const native = new Native(filename);
  native.exec(`CREATE TABLE StudentResult(id TEXT PRIMARY KEY,studentId TEXT,quizId TEXT,status TEXT,answers TEXT,score INTEGER,correctAnswersCount INTEGER,totalQuestions INTEGER,timeTaken INTEGER,academicYear TEXT,startedAt DATETIME,submittedAt DATETIME,completedAt DATETIME);
  INSERT INTO StudentResult VALUES('owned','student','quiz','in_progress','{"v":1}',NULL,0,1,NULL,NULL,1735787045678,NULL,NULL);`);
  native.close();
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'file:' + filename.replaceAll('\\', '/');
  vi.resetModules();
  const { storage, initializeStorage, getStorageDbForTests } = await import('../../storage');
  const writer = getStorageDbForTests();
  let release!: () => void, entered!: () => void;
  const pause = new Promise<void>(resolve => { release = resolve; });
  const changed = new Promise<void>(resolve => { entered = resolve; });
  let transaction: Promise<unknown> | undefined;
  try {
    await initializeStorage();
    transaction = writer.$transaction(async tx => {
      await tx.$executeRawUnsafe('UPDATE StudentResult SET answers=? WHERE id=?', '{"v":2}', 'owned');
      entered();
      await pause;
    }, { timeout: 10000 });
    await changed;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        storage.getResult('owned'),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Storage read queued behind writer')), 2000); }),
      ]);
      expect(result?.answers).toEqual({ v: 1 });
    } finally { clearTimeout(timer); }
    release();
    await transaction;
    expect((await storage.getResult('owned'))?.answers).toEqual({ v: 2 });
  } finally {
    release();
    await transaction?.catch(() => undefined);
    await writer.$disconnect();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    if (dirname(root) !== tmpdir() || !basename(root).startsWith('quizmaster-test-storage-read-')) throw new Error('Unsafe test cleanup');
    // Windows refuses this removal if either SQLite client remains open.
    rmSync(root, { recursive: true, force: true });
  }
});
