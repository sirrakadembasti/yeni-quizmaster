import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const req = createRequire(new URL('../server/package.json', import.meta.url));
const Native = req('better-sqlite3');
const { PrismaClient } = req('@prisma/client');
const { PrismaBetterSQLite3 } = req('@prisma/adapter-better-sqlite3');
// Deliberately reproduce the bare upstream adapter defect. Production clients
// use ConfiguredSQLiteAdapter's gate and the native regression suite verifies it.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quizmaster-test-tx-probe-'));
const file = path.join(root, 'owned.db');
const native = new Native(file);
native.exec(`CREATE TABLE User(id TEXT PRIMARY KEY,createdAt DATETIME,isActive BOOLEAN,studentNo INTEGER);
INSERT INTO User VALUES('transaction',0,1,100),('outside',0,1,103);
CREATE TABLE StudentResult(id TEXT PRIMARY KEY,studentId TEXT,quizId TEXT,status TEXT,answers TEXT,score INTEGER,correctAnswersCount INTEGER,totalQuestions INTEGER,timeTaken INTEGER,academicYear TEXT,startedAt DATETIME,submittedAt DATETIME,completedAt DATETIME);`);
native.close();
const db = new PrismaClient({ adapter: new PrismaBetterSQLite3({ url: 'file:' + file, fileMustExist: true }, { timestampFormat: 'unixepoch-ms' }),
  __internal: { configOverride: config => ({ ...config, relativeEnvPaths: { rootEnvPath: null, schemaEnvPath: null } }) } });
try {
  await db.$queryRawUnsafe('PRAGMA journal_mode=WAL');
  for (const [label, operation] of [
    ['updateMany', () => db.user.updateMany({ where: { id: 'outside' }, data: { studentNo: 104 } })],
    ['singleUpdate', () => db.user.update({ where: { id: 'outside' }, data: { studentNo: 104 }, select: { studentNo: true } })],
    ['singleCreate', () => db.studentResult.create({ data: { id: 'created', studentId: 'student', quizId: 'quiz' }, select: { id: true } })],
  ]) {
    await db.$executeRawUnsafe('UPDATE User SET studentNo=103 WHERE id=?', 'outside');
    let release, entered;
    const pause = new Promise(resolve => { release = resolve; });
    const changed = new Promise(resolve => { entered = resolve; });
    const transaction = db.$transaction(async tx => {
      await tx.$executeRawUnsafe('UPDATE User SET studentNo=101 WHERE id=?', 'transaction');
      entered();
      await pause;
      throw new Error('Owned intentional rollback');
    }, { timeout: 10000 }).catch(error => { if (!error.message.includes('Owned intentional rollback')) throw error; });
    await changed;
    let acknowledged = false;
    const outside = operation().then(value => { acknowledged = true; return value; });
    await new Promise(resolve => setTimeout(resolve, 150));
    const acknowledgedBeforeRollback = acknowledged;
    release();
    await transaction;
    const result = await outside;
    const rows = await db.$queryRawUnsafe("SELECT CAST(studentNo AS TEXT) AS studentNo FROM User WHERE id='outside'");
    const created = await db.studentResult.count({ where: { id: 'created' } });
    console.log(JSON.stringify({ label, acknowledgedBeforeRollback, result, persistedStudentNo: rows[0].studentNo, persistedCreated: created }));
  }
} finally {
  await db.$disconnect();
  if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith('quizmaster-test-tx-probe-')) throw new Error('Unsafe probe cleanup');
  fs.rmSync(root, { recursive: true, force: true });
}
