import { afterAll, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createRequire } from 'node:module';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const db = new PrismaClient();
afterAll(() => db.$disconnect());

it('schedules July 15 at 00:05 in Istanbul regardless of the host timezone', async () => {
  const { getYearSchedule } = await import('../../services/academic-year');
  expect(getYearSchedule('2025-2026').toISOString()).toBe('2026-07-14T21:05:00.000Z');
});

it.each(['2025-2027', '25-26', '2025/2026', ' 2025-2026', '2025-2026x', '0000-0001', '9999-10000', '1999-2000', '2100-2101'])('rejects malformed academic year %s', async label => {
  const { getYearSchedule } = await import('../../services/academic-year');
  expect(() => getYearSchedule(label)).toThrow();
});

it('creates just the installed active year and concurrent initialization reuses it', async () => {
  const { getOrCreateActiveYear } = await import('../../services/academic-year');
  const now = new Date('2026-10-04T12:00:00Z');
  const [first, second] = await Promise.all([getOrCreateActiveYear(db, now), getOrCreateActiveYear(db, now)]);
  expect(first.id).toBe(second.id);
  expect(first).toMatchObject({ label: '2026-2027', status: 'active', opensAt: now, closedAt: null, snapshotId: null });
  expect(first.scheduledCloseAt.toISOString()).toBe('2027-07-14T21:05:00.000Z');
  expect(await db.academicYear.count()).toBe(1);
  expect((await getOrCreateActiveYear(db, new Date('2028-10-04T12:00:00Z'))).id).toBe(first.id);
});

it('enforces a single active year even for direct database writers', async () => {
  await expect(db.academicYear.create({ data: { label: '2030-2031', status: 'active', opensAt: new Date(), scheduledCloseAt: new Date('2031-07-14T21:05:00Z') } })).rejects.toThrow();
});

it('initializes at the Istanbul close boundary without inventing a historical year', async () => {
  const { getOrCreateActiveYear } = await import('../../services/academic-year');
  // Reset this isolated database to model first installation at each instant.
  for (const [instant, label] of [
    ['2026-07-14T21:04:59Z', '2025-2026'],
    ['2026-07-14T21:05:00Z', '2026-2027'],
  ]) {
    await db.academicYear.deleteMany();
    const year = await getOrCreateActiveYear(db, new Date(instant));
    expect(year.label).toBe(label);
    expect(await db.academicYear.count()).toBe(1);
  }
});

it('persists leases and rejects duplicate annual jobs while allowing repeat manual snapshots', async () => {
  const year = await db.academicYear.findFirstOrThrow({ where: { status: 'active' } });
  const annualKey = year.label;
  const data = { academicYearId: year.id, label: year.label, mode: 'annual', annualKey, scopeJson: '{}', attempts: 2, leaseOwner: 'worker-1', leaseExpiresAt: new Date('2026-07-15T01:00:00Z'), nextAttemptAt: new Date('2026-07-15T01:05:00Z') };
  const snapshot = await db.archiveSnapshot.create({ data });
  expect(await db.archiveSnapshot.findUnique({ where: { annualKey } })).toMatchObject({ id: snapshot.id, attempts: 2, leaseOwner: 'worker-1', status: 'queued' });
  await expect(db.archiveSnapshot.create({ data })).rejects.toThrow();
  const manual = { academicYearId: year.id, label: year.label, mode: 'manual', scopeJson: '{}' };
  await db.archiveSnapshot.create({ data: manual });
  await db.archiveSnapshot.create({ data: manual });
});

it('keeps exactly one captured entity and transition rule per source class', async () => {
  const snapshot = await db.archiveSnapshot.findFirstOrThrow();
  const row = { snapshotId: snapshot.id, entityType: 'User', entityId: 'student-1', dataJson: '{"name":"Original"}' };
  await db.archiveSnapshotRow.create({ data: row });
  await expect(db.archiveSnapshotRow.create({ data: row })).rejects.toThrow();
  const cls = await db.class.create({ data: { name: 'Graduating ' + randomUUID() } });
  const rule = { yearId: snapshot.academicYearId, fromClassId: cls.id, graduate: true };
  await db.academicTransitionRule.create({ data: rule });
  await expect(db.academicTransitionRule.create({ data: rule })).rejects.toThrow();
});

it('applies the new migration to legacy fixture data without modifying existing records', async () => {
  const sqlite3 = createRequire(require.resolve('connect-sqlite3'))('sqlite3');
  const directory = mkdtempSync(join(dirname(process.env.DATABASE_URL!.slice(5)), 'migration-fixture-'));
  const connection = new sqlite3.Database(join(directory, 'legacy.db'));
  const execute = (sql: string) => new Promise<void>((resolve, reject) => connection.exec(sql, (error: Error | null) => error ? reject(error) : resolve()));
  const query = (sql: string) => new Promise<any[]>((resolve, reject) => connection.all(sql, (error: Error | null, rows: any[]) => error ? reject(error) : resolve(rows)));
  const migrationsPath = join(process.cwd(), 'prisma', 'migrations');
  try {
    const migrations = readdirSync(migrationsPath).filter(name => /^\d/.test(name)).sort();
    const academicMigration = migrations.find(name => name.endsWith('_academic_archive'));
    expect(academicMigration).toBeDefined();
    for (const migration of migrations.filter(name => name < academicMigration!)) {
      await execute(readFileSync(join(migrationsPath, migration, 'migration.sql'), 'utf8'));
    }
    await execute(`INSERT INTO User (id, name, email, password) VALUES ('legacy-student', 'Existing student', 'legacy@example.test', 'unchanged-hash');
      INSERT INTO Quiz (id, title, createdBy) VALUES ('legacy-quiz', 'Existing quiz', 'legacy-student');
      INSERT INTO Question (id, quizId, text, type, "order") VALUES ('legacy-question', 'legacy-quiz', 'Existing question', 'short-answer', 0);
      INSERT INTO StudentResult (id, studentId, quizId, score) VALUES ('legacy-result', 'legacy-student', 'legacy-quiz', 80);`);
    await execute(readFileSync(join(migrationsPath, academicMigration!, 'migration.sql'), 'utf8'));
    expect(await query('SELECT name, password, graduationYear, graduationDate FROM User')).toEqual([{ name: 'Existing student', password: 'unchanged-hash', graduationYear: null, graduationDate: null }]);
    expect(await query('SELECT title FROM Quiz')).toEqual([{ title: 'Existing quiz' }]);
    expect(await query('SELECT text FROM Question')).toEqual([{ text: 'Existing question' }]);
    expect(await query('SELECT score FROM StudentResult')).toEqual([{ score: 80 }]);
    expect(await query('SELECT * FROM AcademicYear')).toEqual([]);
  } finally {
    await new Promise<void>((resolve, reject) => connection.close((error: Error | null) => error ? reject(error) : resolve()));
    rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}, 120000);
