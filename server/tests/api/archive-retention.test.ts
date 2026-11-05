import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { copyFile } from 'node:fs/promises';

const url = process.env.DATABASE_URL ?? '';
if (!url.startsWith('file:') || !path.basename(path.dirname(url.slice(5))).startsWith('quizmaster-test-')) throw new Error('Disposable retention datasource required');
let db: PrismaClient, storage: typeof import('../../storage').storage, closeStorage: typeof import('../../storage').closeStorage;
beforeAll(async () => {
  const file = path.join(path.dirname(url.slice(5)), 'retention-' + randomUUID() + '.db');
  await copyFile(url.slice(5), file);
  const copyUrl = 'file:' + file.split('\\').join('/');
  db = new PrismaClient({ datasources: { db: { url: copyUrl } } });
  vi.resetModules();
  vi.stubEnv('DATABASE_URL', copyUrl);
  ({ storage, closeStorage } = await import('../../storage'));
});
afterAll(async () => {
  try { await db.$disconnect(); await closeStorage(); }
  finally { vi.unstubAllEnvs(); }
});

it('retains old archive audit evidence and lifetime retry accounting while pruning operational logs', async () => {
  const user = await db.user.create({ data: { name: 'Synthetic retention admin', email: randomUUID() + '@example.test', password: 'synthetic', role: 'admin' } });
  const snapshotId = randomUUID(), createdAt = new Date('2020-01-01');
  const actions = ['ARCHIVE_CREATED', 'ARCHIVE_RECOVERY_REQUESTED', 'ARCHIVE_RECOVERY_FAILED', 'ARCHIVE_ARTIFACT_QUARANTINED', 'ARCHIVE_FAILED', 'ARCHIVE_COMPLETED'];
  for (const action of actions) await db.actionLog.create({ data: { userId: user.id, action, createdAt, details: JSON.stringify({ snapshotId, previousAttempts: 20 }) } });
  const ordinary = await db.actionLog.create({ data: { userId: user.id, action: 'LOGIN', createdAt } });
  const cutoff = new Date('2025-01-01');
  const result = await storage.pruneOperationalData({ actionLogsBefore: cutoff, readNotificationsBefore: cutoff, emailLogsBefore: cutoff, passwordResetsBefore: cutoff });
  expect(result.actionLogs).toBe(1);
  expect(await db.actionLog.findUnique({ where: { id: ordinary.id } })).toBeNull();
  expect((await db.actionLog.findMany({ where: { userId: user.id }, orderBy: { action: 'asc' } })).map(log => log.action)).toEqual(actions.sort());
});
