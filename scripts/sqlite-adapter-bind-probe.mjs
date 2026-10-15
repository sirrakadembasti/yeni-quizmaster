import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const req = createRequire(new URL('../server/package.json', import.meta.url));
const Native = req('better-sqlite3');
const { PrismaClient } = req('@prisma/client');
const { PrismaBetterSQLite3 } = req('@prisma/adapter-better-sqlite3');
// Bare upstream adapter diagnostic, not the gated production runtime factory.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quizmaster-test-bind-probe-'));
const filename = path.join(directory, 'owned.db');
const native = new Native(filename);
native.exec(`CREATE TABLE User(id TEXT PRIMARY KEY,createdAt DATETIME,isActive BOOLEAN,studentNo INTEGER);
CREATE TABLE Observation(value TEXT);
INSERT INTO User VALUES ('owned',0,0,0);
CREATE TRIGGER observe_update BEFORE UPDATE ON User BEGIN
INSERT INTO Observation VALUES(json_object('dateType',typeof(NEW.createdAt),'boolType',typeof(NEW.isActive),'studentType',typeof(NEW.studentNo),'date',NEW.createdAt,'bool',NEW.isActive,'studentNo',NEW.studentNo)); END;`);
native.close();
class ProbeAdapter extends PrismaBetterSQLite3 {
  async connect() {
    const connection = await super.connect();
    const query = connection.queryRaw.bind(connection);
    connection.queryRaw = input => {
      if (input.sql.startsWith('SELECT typeof(?)')) console.log(JSON.stringify({ adapterArgs: input.args, argTypes: input.argTypes }, (_k, value) => typeof value === 'bigint' ? value.toString() : value));
      return query(input);
    };
    return connection;
  }
}
const db = new PrismaClient({ adapter: new ProbeAdapter({ url: 'file:' + filename, fileMustExist: true }, { timestampFormat: 'unixepoch-ms' }),
  __internal: { configOverride: config => ({ ...config, relativeEnvPaths: { rootEnvPath: null, schemaEnvPath: null } }) } });
try {
  const at = 1735787045678;
  for (const [label, value, flag, studentNo] of [['Number', at, 1, 103], ['BigInt', BigInt(at), 1n, 103n], ['Date', new Date(at), true, 103]]) {
    const rows = await db.$queryRawUnsafe("SELECT typeof(?) AS type,json_object('date',?,'bool',?,'studentNo',?) AS json", value, value, flag, studentNo);
    console.log(JSON.stringify({ label, rows }));
  }
  await db.user.updateMany({ where: { id: 'owned' }, data: { createdAt: new Date(at), isActive: true, studentNo: 103 } });
  console.log(JSON.stringify({ ORM_beforeTrigger: await db.$queryRawUnsafe('SELECT value FROM Observation') }));
  console.log(JSON.stringify({ compare: await db.$queryRawUnsafe("SELECT json_object('date',?,'bool',?,'studentNo',?) = json_object('date',createdAt,'bool',isActive,'studentNo',studentNo) AS matching FROM User", BigInt(at), 1n, 103n) }, (_k, v) => typeof v === 'bigint' ? v.toString() : v));
  console.log(JSON.stringify({ castCompare: await db.$queryRawUnsafe("SELECT json_object('date',CAST(? AS INTEGER),'bool',CAST(? AS INTEGER),'studentNo',CAST(? AS INTEGER)) = json_object('date',createdAt,'bool',isActive,'studentNo',studentNo) AS matching FROM User", BigInt(at), 1n, 103n) }, (_k, v) => typeof v === 'bigint' ? v.toString() : v));
} finally {
  await db.$disconnect();
  if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith('quizmaster-test-bind-probe-')) throw new Error('Unsafe probe cleanup');
  fs.rmSync(directory, { recursive: true, force: true });
}
