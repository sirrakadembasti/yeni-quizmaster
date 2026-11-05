// Invoke the actual TSX email utility with independent network/env defenses.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { disableAcademicFixtureEmailDelivery, isolateAcademicFixture } from './academic-fixture-email.mjs';
const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const data = path.join(repo, 'server/data');
const root = fs.mkdtempSync(path.join(data, 'quizmaster-test-academic-email-integration-'));
const requireServer = createRequire(path.join(repo, 'server/package.json'));
let isolation, db, closeStorage;
try {
  const database = path.join(root, 'server/data/academic.db');
  fs.mkdirSync(path.dirname(database), { recursive: true });
  const marker = path.join(root, 'runtime.json');
  fs.writeFileSync(marker, JSON.stringify({ root, database }));
  fs.writeFileSync(path.join(root, '.env'), '# No deployment credentials\n');
  fs.writeFileSync(path.join(root, 'server/.env'), '# No deployment credentials\n');
  process.env.ACADEMIC_ARCHIVE_RUNTIME = marker;
  process.env.DATABASE_URL = 'file:' + database.replaceAll('\\', '/');
  const sentinels = { EMAIL_USER: 'synthetic@example.test', EMAIL_PASS: 'fixture-delivery-disabled', EMAIL_FROM: 'synthetic@example.test', GEMINI_API_KEY: '', GOOGLE_API_KEY: '', OPENAI_API_KEY: '' };
  Object.assign(process.env, sentinels);
  process.chdir(root);
  isolation = isolateAcademicFixture();
  const cjs = requireServer('nodemailer');
  const esm = (await import(pathToFileURL(path.resolve(path.dirname(requireServer.resolve('nodemailer')), '../esm/nodemailer.js')).href)).default;
  assert.notEqual(cjs, esm, 'Conditional nodemailer export identity must be represented by this probe');
  disableAcademicFixtureEmailDelivery(cjs);
  if (!process.argv.includes('--cjs-only')) disableAcademicFixtureEmailDelivery(esm);
  const { PrismaClient } = requireServer('@prisma/client');
  db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  assert.ok(Object.entries(sentinels).every(([key, value]) => process.env[key] === value), 'Prisma constructor changed fixture credential sentinels');
  const email = await import(pathToFileURL(path.join(repo, 'server/utils/email.ts')).href);
  ({ closeStorage } = await import(pathToFileURL(path.join(repo, 'server/storage.ts')).href));
  assert.ok(Object.entries(sentinels).every(([key, value]) => process.env[key] === value), 'Actual email/storage import changed fixture credential sentinels');
  await assert.rejects(email.sendDirectEmail({ to: 'synthetic@example.test', subject: 'Fixture probe', text: 'No physical delivery' }), { code: 'ACADEMIC_FIXTURE_EMAIL_DELIVERY_DISABLED' });
  await assert.rejects(email.verifyEmailTransport(), { code: 'ACADEMIC_FIXTURE_EMAIL_DELIVERY_DISABLED' });
  assert.equal(isolation.state.deniedConnections, 0, 'Patched actual utility must not attempt external DNS/socket connections');
  console.log(JSON.stringify({ conditionalExportsSeparate: true, actualUtilityDeliveryBlocked: true, fixtureCredentialSentinelsPreserved: true, deniedEnvironmentReads: isolation.state.deniedEnvironmentReads, externalNetworkAttempts: 0 }));
} finally {
  await db?.$disconnect();
  await closeStorage?.();
  isolation?.restore();
  process.chdir(repo);
  if (path.dirname(path.resolve(root)) !== data || !path.basename(root).startsWith('quizmaster-test-academic-email-integration-')) throw new Error('Unsafe fixture cleanup');
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
