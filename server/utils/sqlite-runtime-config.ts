import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { getProjectRoot } from './project-paths';

export function resolveSQLiteDatabasePath(databaseUrl: string, projectRoot = getProjectRoot()): string {
  if (!databaseUrl.startsWith('file:')) throw new Error('The runtime requires a local SQLite file URL');
  const filename = databaseUrl.slice(5);
  if (!filename || filename === ':memory:' || filename.includes('?') || filename.includes('#') || filename.includes('\0')) {
    throw new Error('Unsupported SQLite file URL or connection options');
  }
  // Legacy Prisma URLs are relative to schema.prisma, not process.cwd().
  return path.isAbsolute(filename) ? path.resolve(filename) : path.resolve(projectRoot, 'server', 'prisma', filename);
}

export type SupportedDatabaseProvider = 'sqlite' | 'postgresql';

export interface DatabaseMigrationReadiness {
  provider: SupportedDatabaseProvider;
  activeRuntimeSupported: boolean;
  resolvedSqlitePath?: string;
  pendingAdaptations: string[];
}

export function detectDatabaseProvider(databaseUrl: string): SupportedDatabaseProvider {
  const normalized = (databaseUrl ?? '').trim();
  if (normalized.startsWith('file:')) return 'sqlite';
  if (normalized.startsWith('postgresql://') || normalized.startsWith('postgres://')) {
    return 'postgresql';
  }
  throw new Error('Unsupported database URL provider; expected file: (SQLite) or postgresql://');
}

export function resolveConfiguredDatabaseUrl(options: { databaseUrl?: string; projectRoot?: string } = {}): string {
  const root = options.projectRoot ?? getProjectRoot();
  let url = options.databaseUrl ?? process.env.DATABASE_URL;
  if (url === undefined) {
    for (const filename of [path.join(root, 'server', '.env'), path.join(root, '.env')]) {
      if (!fs.existsSync(filename)) continue;
      const configuredUrl = dotenv.parse(fs.readFileSync(filename)).DATABASE_URL;
      if (configuredUrl !== undefined) { url = configuredUrl; break; }
    }
  }
  return url ?? '';
}

export function resolveRuntimeSQLitePath(options: { databaseUrl?: string; projectRoot?: string } = {}): string {
  const root = options.projectRoot ?? getProjectRoot();
  const url = resolveConfiguredDatabaseUrl(options);
  return resolveSQLiteDatabasePath(url, root);
}

export function getDatabaseMigrationReadiness(
  options: { databaseUrl?: string; projectRoot?: string } = {}
): DatabaseMigrationReadiness {
  const root = options.projectRoot ?? getProjectRoot();
  const url = resolveConfiguredDatabaseUrl(options);
  const provider = detectDatabaseProvider(url);
  if (provider === 'sqlite') {
    return {
      provider: 'sqlite',
      activeRuntimeSupported: true,
      resolvedSqlitePath: resolveSQLiteDatabasePath(url, root),
      pendingAdaptations: [],
    };
  }
  return {
    provider: 'postgresql',
    activeRuntimeSupported: false,
    pendingAdaptations: [
      'prisma-schema-provider',
      'archive-raw-sql',
      'session-store',
      'maintenance-backup',
    ],
  };
}
