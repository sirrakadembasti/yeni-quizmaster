import { afterAll, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { storage, closeStorage } from '../../storage';

const url = process.env.DATABASE_URL ?? '';
if (!url.startsWith('file:') || !path.basename(path.dirname(url.slice(5))).startsWith('quizmaster-test-')) throw new Error('Disposable retention datasource required');
const db = new PrismaClient();
afterAll(async () => { await db.$disconnect(); await closeStorage(); });

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
