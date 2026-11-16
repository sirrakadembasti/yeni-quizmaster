import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { resolveRuntimeSQLitePath } from './sqlite-runtime-config';
export { resolveSQLiteDatabasePath } from './sqlite-runtime-config';

// This native driver waits synchronously. Bound lock waits for HTTP/socket liveness.
const busyTimeout = 50;
const sqliteMaxBindValues = 32766;

// Prisma 7 istemcisi sıradaki bir transaction başlangıcını varsayılan 2 sn'de P2028 ile düşürür.
// Tek yazıcılı SQLite bağlantısında arşiv gibi uzun işlemler (bütçe 120 sn) bunu aşabilir; önceki
// davranış (sırada beklemek) korunur. Çağrı başına verilen maxWait yine geçerlidir.
const defaultTransactionMaxWaitMs = 130_000;

export function assertPatchedSQLite(version: string): void {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error('Cannot determine SQLite runtime version');
  const major = Number(match[1]), minor = Number(match[2]), patch = Number(match[3]);
  const patched = major === 3 && ((minor === 44 && patch >= 6) || (minor === 50 && patch >= 7)
    || (minor === 51 && patch >= 3) || minor > 52 || (minor === 52 && patch > 0));
  // SQLite withdrew 3.52.0 due to other correctness problems.
  if (!patched) throw new Error(`SQLite ${version} is not an approved patched WAL runtime`);
}

function requireDatabaseFile(filename: string): void {
  if (!path.isAbsolute(filename)) throw new Error('SQLite requires an absolute database path');
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('SQLite database must be an existing regular file');
  const fd = fs.openSync(filename, 'r');
  try {
    const header = Buffer.alloc(16);
    if (fs.readSync(fd, header, 0, 16, 0) !== 16 || header.toString('ascii') !== 'SQLite format 3\0') {
      throw new Error('The existing database does not have a valid SQLite header');
    }
  } finally { fs.closeSync(fd); }
}

/** Existing files are required unless a session store explicitly creates its DB. */
export function openSQLite(filename: string, options: { fileMustExist?: boolean; readonly?: boolean } = {}): Database.Database {
  const fileMustExist = options.fileMustExist ?? true;
  if (fileMustExist) requireDatabaseFile(filename);
  else if (!path.isAbsolute(filename)) throw new Error('SQLite requires an absolute database path');
  const db = new Database(filename, { fileMustExist, readonly: options.readonly ?? false, timeout: busyTimeout });
  try {
    assertPatchedSQLite((db.prepare('SELECT sqlite_version() AS version').get() as { version: string }).version);
    db.pragma(`busy_timeout = ${busyTimeout}`);
    db.pragma('foreign_keys = ON');
    if (!options.readonly) {
      if (db.pragma('journal_mode = WAL', { simple: true }) !== 'wal') throw new Error('SQLite WAL initialization failed');
      db.pragma('synchronous = FULL');
    }
    return db;
  } catch (error) { db.close(); throw error; }
}

type SQLiteConnection = Awaited<ReturnType<PrismaBetterSqlite3['connect']>>;

async function compatibleSQLiteOperation<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    // Adapter 6.19 maps SQLite's writer contention to a variant its pinned
    // library engine cannot deserialize. Preserve the original diagnostics.
    if (error instanceof Error && error.name === 'DriverAdapterError' && 'cause' in error) {
      const cause = error.cause;
      if (cause && typeof cause === 'object' && 'kind' in cause && 'originalCode' in cause
        && cause.kind === 'SocketTimeout' && cause.originalCode === 'SQLITE_BUSY') {
        Object.assign(cause, { kind: 'TransactionWriteConflict' });
      }
    }
    throw error;
  }
}

/** Outside operations must never borrow an interactive transaction's connection. */
function gateSQLiteConnection(connection: SQLiteConnection): SQLiteConnection {
  let queue = Promise.resolve();
  let unavailable: Error | undefined;
  let disposed = false;
  const acquire = async () => {
    let release!: () => void;
    const previous = queue;
    queue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    if (unavailable || disposed) {
      release();
      throw unavailable ?? new Error('SQLite connection is closed');
    }
    return release;
  };
  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    await connection.dispose();
  };
  const poison = async () => {
    unavailable = new Error('SQLite transaction could not be safely settled; reconnect required');
    await dispose().catch(() => undefined);
  };
  const run = async <T>(operation: () => Promise<T>): Promise<T> => {
    const release = await acquire();
    try { return await compatibleSQLiteOperation(operation); } finally { release(); }
  };
  return {
    provider: connection.provider,
    adapterName: connection.adapterName,
    // Prisma 7 istemcisi, bağdaştırıcı bildirmezse SQLite için 999 bağlı değer varsayar ve sıralı (orderBy) büyük
    // IN sorgularını bölemediğinden P2029 verir. Gerçek sınır 32766'dır (SQLITE_MAX_VARIABLE_NUMBER; Prisma 6'da da
    // böyleydi); arşiv yakalama binlerce kimlikle sorgular.
    getConnectionInfo: () => ({ ...connection.getConnectionInfo?.(), maxBindValues: sqliteMaxBindValues, supportsRelationJoins: connection.getConnectionInfo?.().supportsRelationJoins ?? false }),
    queryRaw: query => run(() => connection.queryRaw(query)),
    executeRaw: query => run(() => connection.executeRaw(query)),
    executeScript: script => run(() => connection.executeScript(script)),
    dispose,
    async startTransaction(isolationLevel): Promise<Awaited<ReturnType<SQLiteConnection['startTransaction']>>> {
      const release = await acquire();
      let transaction: Awaited<ReturnType<SQLiteConnection['startTransaction']>>;
      try { transaction = await compatibleSQLiteOperation(() => connection.startTransaction(isolationLevel)); }
      catch (error) {
        // The stock adapter's private mutex may remain held after failed BEGIN.
        await poison(); release(); throw error;
      }
      let settled = false;
      const active = () => {
        if (settled || disposed || unavailable) throw unavailable ?? new Error('SQLite transaction is already settled');
      };
      const rollback = async () => {
        if (settled) return;
        settled = true;
        try {
          await compatibleSQLiteOperation(() => transaction.executeRaw({ sql: 'ROLLBACK', args: [], argTypes: [] }));
          await transaction.rollback();
        } catch (error) { await poison(); throw error; }
        finally { release(); }
      };
      return {
        provider: transaction.provider,
        adapterName: transaction.adapterName,
        // Own SQL settlement so failed COMMIT cannot unlock an open transaction.
        options: { ...transaction.options, usePhantomQuery: true },
        queryRaw: query => { active(); return compatibleSQLiteOperation(() => transaction.queryRaw(query)); },
        executeRaw: query => { active(); return compatibleSQLiteOperation(() => transaction.executeRaw(query)); },
        async commit() {
          if (settled) return;
          try {
            await compatibleSQLiteOperation(() => transaction.executeRaw({ sql: 'COMMIT', args: [], argTypes: [] }));
            await transaction.commit();
            settled = true;
            release();
          } catch (error) {
            await rollback().catch(() => undefined);
            throw error;
          }
        },
        rollback,
      };
    },
  };
}

class ConfiguredSQLiteAdapter extends PrismaBetterSqlite3 {
  constructor(private readonly filename: string, private readonly readonlyConnection = false) {
    super({ url: 'file:' + filename, fileMustExist: true, readonly: readonlyConnection, timeout: busyTimeout }, { timestampFormat: 'unixepoch-ms' });
  }

  override async connect(): Promise<SQLiteConnection> {
    requireDatabaseFile(this.filename);
    const connection = await super.connect();
    const query = (sql: string) => connection.queryRaw({ sql, args: [], argTypes: [] });
    try {
      const version = await query('SELECT sqlite_version()');
      assertPatchedSQLite(String(version.rows[0]?.[0]));
      await connection.executeScript(`PRAGMA busy_timeout = ${busyTimeout}; PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL;`);
      if (!this.readonlyConnection) {
        const mode = await query('PRAGMA journal_mode = WAL');
        if (mode.rows[0]?.[0] !== 'wal') throw new Error('SQLite WAL initialization failed');
      }
      return gateSQLiteConnection(connection);
    } catch (error) { await connection.dispose(); throw error; }
  }
}

export function createRuntimePrismaClient(options: {
  databaseUrl?: string;
  projectRoot?: string;
  readonly?: boolean;
  log?: Prisma.PrismaClientOptions['log'];
} = {}): PrismaClient {
  const filename = resolveRuntimeSQLitePath(options);
  const clientOptions: Prisma.PrismaClientOptions = {
    adapter: new ConfiguredSQLiteAdapter(filename, options.readonly),
    transactionOptions: { maxWait: defaultTransactionMaxWaitMs },
    ...(options.log ? { log: options.log } : {}),
  };
  return new PrismaClient(clientOptions);
}
