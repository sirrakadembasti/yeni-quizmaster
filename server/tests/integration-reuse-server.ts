// Reuse only a previously guarded disposable fixture for follow-up UX checks.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import assert from 'node:assert/strict';
const repo = resolve(import.meta.dirname, '../..');
const runtime = JSON.parse(readFileSync(join(repo, 'docs/parent-audit/runtime.json'), 'utf8'));
const root = resolve(runtime.root), database = resolve(runtime.database);
assert.equal(dirname(root), join(repo, 'server/data'));
assert(basename(root).startsWith('quizmaster-test-parent-audit-'));
assert.equal(database, join(root, 'server/data/audit.db'));
assert.deepEqual(runtime.ports, [5560, 5561]);
assert(existsSync(database));
Object.assign(process.env, { DATABASE_URL: 'file:' + database.replaceAll('\\', '/'),
  SESSION_SECRET: 'isolated-integration-reuse-only-secret', PORT: '5560', HOST: '127.0.0.1',
  FRONTEND_URL: 'http://127.0.0.1:5561', ALLOWED_ORIGINS: 'http://127.0.0.1:5561', NODE_ENV: 'development' });
for (const key of ['EMAIL_USER','EMAIL_PASS','EMAIL_FROM','GEMINI_API_KEY','OPENAI_API_KEY','APP_BASE_PATH','FORCE_SECURE_COOKIES','DEPLOYMENT_CONFIG_PATH']) delete process.env[key];
process.chdir(root);
const { installIntegrationAuditIdentity } = await import('./integration-audit-identity');
installIntegrationAuditIdentity();
await import('../index');
