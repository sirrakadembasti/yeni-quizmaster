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

export function resolveRuntimeSQLitePath(options: { databaseUrl?: string; projectRoot?: string } = {}): string {
  const root = options.projectRoot ?? getProjectRoot();
  let url = options.databaseUrl ?? process.env.DATABASE_URL;
  // index.ts imports storage before dotenv.config(). Match its server-first
  // fallback without changing process.env or loading configuration for explicit URLs.
  if (url === undefined) {
    for (const filename of [path.join(root, 'server', '.env'), path.join(root, '.env')]) {
      if (!fs.existsSync(filename)) continue;
      const configuredUrl = dotenv.parse(fs.readFileSync(filename)).DATABASE_URL;
      if (configuredUrl !== undefined) { url = configuredUrl; break; }
    }
  }
  return resolveSQLiteDatabasePath(url ?? '', root);
}
