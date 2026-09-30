import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rmSync } from 'node:fs';
import { basename, dirname, resolve, relative, isAbsolute } from 'node:path';
const require = createRequire(import.meta.url);
export default function setup(project: any) {
  const url = project.config.env.DATABASE_URL;
  const dataDir = resolve(dirname(require.resolve('../package.json')), 'data');
  const testDir = resolve(dirname(url.slice(5)));
  const child = relative(dataDir, testDir);
  if (!url.startsWith('file:') || !basename(testDir).startsWith('quizmaster-test-') ||
      !child || child.startsWith('..') || isAbsolute(child)) {
    throw new Error('Tests require an isolated database within server/data');
  }
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: dirname(require.resolve('../package.json')),
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe',
  });
  return () => rmSync(testDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
