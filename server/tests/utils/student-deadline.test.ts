import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSQLite } from '../../utils/sqlite-runtime';

const directory = mkdtempSync(join(tmpdir(), 'quizmaster-test-student-deadline-'));
const file = join(directory, 'deadline.db');
const migrations = join(dirname(fileURLToPath(import.meta.url)), '../../prisma/migrations');
const startedAt = new Date('2026-10-15T00:00:00Z');
const cutoff = startedAt.getTime() + 30 * 60000;
let clock = cutoff - 1;
let storage: (typeof import('../../storage'))['storage'];
let closeStorage: (typeof import('../../storage'))['closeStorage'];
let db: ReturnType<(typeof import('../../storage'))['getStorageDbForTests']>;

beforeAll(async () => {
  const fixture = openSQLite(file, { fileMustExist: false });
  try {
    for (const name of readdirSync(migrations).sort()) {
      if (name !== 'migration_lock.toml') fixture.exec(readFileSync(join(migrations, name, 'migration.sql'), 'utf8'));
    }
  } finally { fixture.close(); }
  vi.stubEnv('DATABASE_URL', 'file:' + file.replaceAll('\\', '/'));
  const actual = await import('../../storage');
  storage = actual.storage; closeStorage = actual.closeStorage; db = actual.getStorageDbForTests();
  await db.user.create({ data: { id: 'deadline-owner', name: 'Fixture student', email: 'deadline-fixture@example.invalid', password: 'fixture-only' } });
  await db.quiz.create({ data: { id: 'deadline-quiz', title: 'Private deadline fixture', createdBy: 'deadline-owner', timeLimit: 30 } });
  await db.question.create({ data: { id: 'deadline-question', quizId: 'deadline-quiz', text: 'Fixture question', type: 'multiple-choice', order: 0, correctAnswer: 'A' } });
});
beforeEach(async () => {
  await db.studentResult.deleteMany();
  await db.studentResult.create({ data: { id: 'deadline-result', studentId: 'deadline-owner', quizId: 'deadline-quiz', startedAt, answers: '{}', totalQuestions: 1 } });
  clock = cutoff - 1;
  vi.spyOn(Date, 'now').mockImplementation(() => clock);
  const original = db.$transaction.bind(db);
  vi.spyOn(db, '$transaction').mockImplementation((async (operation: any, options: any) => {
    clock = cutoff + 5000; // The trusted request arrived before this server queue delay.
    return original(operation, options);
  }) as any);
});
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => {
  try { if (closeStorage) await closeStorage(); }
  finally { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});
it('saves an answer received before cutoff despite transaction processing after cutoff', async () => {
  await storage.saveResultAnswer('deadline-result', 'deadline-owner', 'deadline-question', 'A', cutoff - 1);
  expect((await db.studentResult.findUniqueOrThrow({ where: { id: 'deadline-result' } })).answers).toBe('{"deadline-question":"A"}');
});
it('captures the default answer timestamp once before entering the transaction queue', async () => {
  await storage.saveResultAnswer('deadline-result', 'deadline-owner', 'deadline-question', 'A');
  expect((await db.studentResult.findUniqueOrThrow({ where: { id: 'deadline-result' } })).correctAnswersCount).toBe(1);
});
it('accepts submitted answers received before cutoff despite delayed transaction processing', async () => {
  const outcome = await storage.completeResult('deadline-result', 'deadline-owner', { 'deadline-question': 'A' }, cutoff - 1);
  expect(outcome).toMatchObject({ score: 100, acceptedQueuedAnswers: true });
});
it('captures the default submit timestamp before transaction queue delay', async () => {
  expect(await storage.completeResult('deadline-result', 'deadline-owner', { 'deadline-question': 'A' })).toMatchObject({ score: 100, acceptedQueuedAnswers: true });
});
it.each([0, 1])('rejects an answer actually received at/after cutoff (+%sms)', async offset => {
  await expect(storage.saveResultAnswer('deadline-result', 'deadline-owner', 'deadline-question', 'A', cutoff + offset)).rejects.toMatchObject({ code: 'RESULT_EXPIRED' });
  expect((await db.studentResult.findUniqueOrThrow({ where: { id: 'deadline-result' } })).answers).toBe('{}');
});
it.each([0, 1])('ignores queued submit answers actually received at/after cutoff (+%sms)', async offset => {
  expect(await storage.completeResult('deadline-result', 'deadline-owner', { 'deadline-question': 'A' }, cutoff + offset)).toMatchObject({ score: 0, acceptedQueuedAnswers: false });
});
it('still rejects foreign owners even when receipt was before cutoff', async () => {
  await expect(storage.saveResultAnswer('deadline-result', 'other-owner', 'deadline-question', 'A', cutoff - 1)).rejects.toMatchObject({ code: 'RESULT_FORBIDDEN' });
});
