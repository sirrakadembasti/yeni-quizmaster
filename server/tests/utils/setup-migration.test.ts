import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { deploySetupDatabase, type SetupCommand } from '../../setup-wizard/migration';

it('deploys all migrations into an absent SQLite DB under inherited warn logging and preserves existing data on rerun', async () => {
  const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  // Komutu scripts/pm.mjs üretir: test npm, pnpm ve Bun altında aynı çalışır (yönetici user agent'tan seçilir).
  const pmScript = join(dirname(serverRoot), 'scripts', 'pm.mjs');
  const dataRoot = join(serverRoot, 'data');
  const fixture = mkdtempSync(join(dataRoot, 'quizmaster-test-migration-'));
  const child = relative(dataRoot, fixture);
  if (!child || child.startsWith('..') || isAbsolute(child) || !basename(fixture).startsWith('quizmaster-test-migration-')) {
    throw new Error('Migration regression requires an isolated database under server/data');
  }
  const database = join(fixture, 'fresh.db');
  const databaseUrl = 'file:' + database.replaceAll('\\', '/');
  const inherited = { ...process.env, RUST_LOG: 'warn', CHECKPOINT_DISABLE: '1' };
  const execute: SetupCommand = async (op, extraEnv) => {
    const started = Date.now();
    const args = ['run', '--workspace', op.workspace ?? 'server', op.script, ...(op.args?.length ? ['--', ...op.args] : [])];
    try {
      return execFileSync(process.execPath, [pmScript, ...args], {
        cwd: dirname(serverRoot), shell: false, windowsHide: true, timeout: 240000,
        env: { ...inherited, ...extraEnv }, encoding: 'utf8',
      });
    } catch (failure) {
      const error = failure as Error & { stdout?: string; stderr?: string; status?: number; signal?: string };
      throw new Error(`Isolated migration command failed after ${Date.now() - started}ms (status=${error.status}, signal=${error.signal})\n${error.message}\nstdout:\n${error.stdout ?? ''}\nstderr:\n${error.stderr ?? ''}`, { cause: error });
    }
  };
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    expect(existsSync(database), 'A fresh install has no database file to precreate').toBe(false);
    await deploySetupDatabase(databaseUrl, execute);
    expect(existsSync(database)).toBe(true);
    const expected = readdirSync(join(serverRoot, 'prisma/migrations')).filter(name => /^\d/.test(name)).sort();
    const applied = await prisma.$queryRawUnsafe<Array<{ migration_name: string; finished_at: unknown; rolled_back_at: unknown }>>(
      'SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY migration_name',
    );
    expect(applied.map(row => row.migration_name)).toEqual(expected);
    expect(applied.every(row => row.finished_at != null && row.rolled_back_at == null)).toBe(true);
    const marker = await prisma.user.create({ data: { name: 'Migration marker', email: 'migration-marker@example.test', password: 'unused-test-marker', role: 'student' } });
    const before = await prisma.user.findUnique({ where: { id: marker.id } });
    await deploySetupDatabase(databaseUrl, execute);
    expect(await prisma.user.findUnique({ where: { id: marker.id } })).toEqual(before);
    expect(await prisma.$queryRawUnsafe<Array<{ migration_name: string; finished_at: unknown; rolled_back_at: unknown }>>(
      'SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY migration_name',
    )).toEqual(applied);
    expect(inherited.RUST_LOG).toBe('warn');
  } finally {
    await prisma.$disconnect();
    rmSync(fixture, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}, 510000);
