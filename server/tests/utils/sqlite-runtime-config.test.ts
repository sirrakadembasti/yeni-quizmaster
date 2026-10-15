import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveRuntimeSQLitePath } from '../../utils/sqlite-runtime-config';

const owned: string[] = [];
const originalUrl = process.env.DATABASE_URL;
afterEach(() => {
  if (originalUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalUrl;
  owned.splice(0).forEach(directory => rmSync(directory, { recursive: true, force: true }));
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'quizmaster-test-runtime-config-'));
  owned.push(root);
  mkdirSync(join(root, 'server'));
  return root;
}

it('resolves .env-only server database configuration before dotenv initialization', () => {
  const root = fixture();
  writeFileSync(join(root, '.env'), 'DATABASE_URL=file:./wrong-root.db\n');
  writeFileSync(join(root, 'server', '.env'), 'DATABASE_URL="file:../data/quiz.db"\n');
  delete process.env.DATABASE_URL;
  expect(resolveRuntimeSQLitePath({ projectRoot: root })).toBe(join(root, 'server', 'data', 'quiz.db'));
  expect(process.env.DATABASE_URL).toBeUndefined();
});

it('uses root fallback, explicit URL and environment precedence without reading unrelated secrets', () => {
  const root = fixture();
  writeFileSync(join(root, '.env'), 'DATABASE_URL=file:./root.db\n');
  delete process.env.DATABASE_URL;
  expect(resolveRuntimeSQLitePath({ projectRoot: root })).toBe(join(root, 'server', 'prisma', 'root.db'));
  process.env.DATABASE_URL = 'file:./environment.db';
  expect(resolveRuntimeSQLitePath({ projectRoot: root })).toBe(join(root, 'server', 'prisma', 'environment.db'));
  expect(resolveRuntimeSQLitePath({ projectRoot: root, databaseUrl: 'file:./explicit.db' })).toBe(join(root, 'server', 'prisma', 'explicit.db'));
});
