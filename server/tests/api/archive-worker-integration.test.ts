import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getOrCreateActiveYear, getYearSchedule } from '../../services/academic-year';
import { enqueueArchive } from '../../services/archive-jobs';
import { exportArchive, verifyArchiveArtifact, type SnapshotExport } from '../../services/archive-export';
import { createArchiveWorker } from '../../services/archive-worker';

// Each case starts from the migrated, empty global-setup DB. No captured job can
// leak its write fence into another case, and no production datasource is used.
const template = process.env.DATABASE_URL!.slice(5);
if (!process.env.DATABASE_URL!.startsWith('file:') || !path.basename(path.dirname(template)).startsWith('quizmaster-test-')) throw new Error('Isolated worker datasource required');
let db: PrismaClient, root: string, clock: Date, databaseUrl: string;
beforeEach(async () => {
  const file = path.join(path.dirname(template), randomUUID() + '.db');
  await copyFile(template, file);
  databaseUrl = 'file:' + file.split('\\').join('/');
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  root = path.join(path.dirname(template), 'artifacts-' + randomUUID());
  clock = new Date('2026-06-01T00:00:00Z');
});
afterEach(async () => { await db.$disconnect(); });
const now = () => new Date(clock);
const pdf = async () => Buffer.from('%PDF-1.4\nSynthetic integration fixture\n%%EOF');
const realExport = (input: SnapshotExport, directory: string) => exportArchive(input, directory, { pdfGenerator: pdf });
function worker(overrides: Partial<Parameters<typeof createArchiveWorker>[0]> = {}) {
  return createArchiveWorker({ db, backupRoot: root, now, export: realExport, ...overrides });
}
async function fixture() {
  const year = await getOrCreateActiveYear(db, clock);
  const admin = await db.user.create({ data: { name: 'Synthetic admin', email: randomUUID() + '@example.test', password: 'synthetic', role: 'admin' } });
  const a = await db.class.create({ data: { name: 'A', maxStudents: 1 } });
  const b = await db.class.create({ data: { name: 'B branch', maxStudents: 1 } });
  const c = await db.class.create({ data: { name: 'C', maxStudents: 1 } });
  const student = async (name: string, classId: string, studentNo: number, isActive = true) => db.user.create({ data: { name, email: randomUUID() + '@example.test', password: 'synthetic', classId, studentNo, isActive, classNo: 'legacy' } });
  const sa = await student('A active', a.id, 1), inactive = await student('A inactive', a.id, 2, false);
  const sb = await student('B active', b.id, 2), sc = await student('C graduate', c.id, 1);
  const teacher = await db.user.create({ data: { name: 'Teacher', email: randomUUID() + '@example.test', password: 'synthetic', role: 'teacher', classId: b.id, studentNo: 1, managedClasses: { connect: { id: b.id } } } });
  const category = await db.category.create({ data: { name: randomUUID(), teachers: { connect: { id: teacher.id } }, classes: { connect: { id: b.id } } } });
  await db.class.update({ where: { id: b.id }, data: { classTeacherId: teacher.id } });
  const assignment = await db.classTeacherCourse.create({ data: { classId: b.id, teacherId: teacher.id, categoryId: category.id } });
  const quiz = await db.quiz.create({ data: { title: 'Selected quiz', status: 'published', createdBy: teacher.id, categoryId: category.id, assignedClasses: { connect: { id: a.id } } } });
  const other = await db.quiz.create({ data: { title: 'Other quiz', status: 'published', createdBy: teacher.id } });
  const result = await db.studentResult.create({ data: { quizId: quiz.id, studentId: sc.id, score: 75, status: 'completed' } });
  await db.academicTransitionRule.createMany({ data: [
    { yearId: year.id, fromClassId: a.id, toClassId: b.id },
    { yearId: year.id, fromClassId: b.id, toClassId: c.id },
    { yearId: year.id, fromClassId: c.id, graduate: true },
  ] });
  return { year, admin, a, b, c, sa, inactive, sb, sc, teacher, category, assignment, quiz, other, result };
}
async function inputFor(id: string): Promise<SnapshotExport> {
  const job = await db.archiveSnapshot.findUniqueOrThrow({ where: { id } });
  const rows = await db.archiveSnapshotRow.findMany({ where: { snapshotId: id } });
  // The verifier hashes the precise exported input, including row order.
  rows.sort((a, b) => a.entityType.localeCompare(b.entityType) || a.entityId.localeCompare(b.entityId));
  return { id, label: job.label, createdAt: job.createdAt, initiatedBy: job.initiatedBy, rows };
}

it('annual capture boundary rejects newly inserted quizzes and students during export', async () => {
  const f = await fixture();
  clock = getYearSchedule(f.year.label);
  let quizRejected = false, studentRejected = false;
  await worker({ export: async (input, directory) => {
    try { await db.quiz.create({ data: { title: 'Late quiz', createdBy: f.teacher.id } }); } catch { quizRejected = true; }
    try { await db.user.create({ data: { name: 'Late student', email: randomUUID() + '@example.test', password: 'synthetic', classId: f.a.id } }); } catch { studentRejected = true; }
    return realExport(input, directory);
  } }).tick();
  expect.soft(quizRejected).toBe(true);
  expect.soft(studentRejected).toBe(true);
  expect((await db.archiveSnapshot.findFirstOrThrow({ where: { mode: 'annual' } })).status).toBe('completed');
});

it('manual capture archives exactly its scope only after real ZIP verification without moving students or year', async () => {
  const f = await fixture();
  const people = await db.user.findMany({ orderBy: { id: 'asc' } });
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [f.quiz.id], initiatedBy: f.admin.id }, clock);
  let verified = false;
  await worker({ verify: async (input, directory) => {
    expect((await db.quiz.findUniqueOrThrow({ where: { id: f.quiz.id } })).status).toBe('published');
    expect((await db.academicYear.findUniqueOrThrow({ where: { id: f.year.id } })).status).toBe('active');
    const artifact = await verifyArchiveArtifact(input, directory);
    expect((await readFile(artifact.artifactPath)).length).toBe(artifact.sizeBytes);
    verified = true;
    return artifact;
  } }).tick();
  expect(verified).toBe(true);
  const completed = await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } });
  expect(completed.status).toBe('completed');
  expect(completed.zipSha256).toMatch(/^[a-f0-9]{64}$/);
  expect((await db.quiz.findUniqueOrThrow({ where: { id: f.quiz.id } })).status).toBe('archived');
  expect((await db.quiz.findUniqueOrThrow({ where: { id: f.other.id } })).status).toBe('published');
  expect(await db.user.findMany({ orderBy: { id: 'asc' } })).toEqual(people);
  expect(await db.academicYear.count()).toBe(1);
  expect(await db.archiveSnapshotRow.count({ where: { snapshotId: job.id, entityType: 'quiz', entityId: f.other.id } })).toBe(0);
});

it('annual due rollover includes manually archived content, moves the initial chain once, and copies rules while preserving teachers and history', async () => {
  const f = await fixture();
  const manual = await enqueueArchive(db, { mode: 'manual', quizIds: [f.quiz.id], initiatedBy: f.admin.id }, clock);
  await worker().tick();
  expect((await db.archiveSnapshot.findUniqueOrThrow({ where: { id: manual.id } })).status).toBe('completed');
  const previousQuiz = await db.quiz.findUniqueOrThrow({ where: { id: f.quiz.id } });
  const previousResult = await db.studentResult.findUniqueOrThrow({ where: { id: f.result.id } });
  const classes = await db.class.findMany({ orderBy: { id: 'asc' }, include: { teachers: true, assignedCategories: true } });
  const categories = await db.category.findMany({ include: { teachers: true, classes: true } });
  const teacher = await db.user.findUniqueOrThrow({ where: { id: f.teacher.id }, include: { managedClasses: true, assignedCategories: true } });
  const rules = await db.academicTransitionRule.findMany({ where: { yearId: f.year.id } });
  // Reject even a redundant write to the already archived manual content.
  await db.$executeRawUnsafe(`CREATE TRIGGER reject_redundant_quiz BEFORE UPDATE ON Quiz WHEN OLD.id='${f.quiz.id}' BEGIN SELECT RAISE(ABORT,'redundant archived update'); END`);
  await db.$executeRawUnsafe(`CREATE TRIGGER reject_redundant_result BEFORE UPDATE ON StudentResult WHEN OLD.id='${f.result.id}' BEGIN SELECT RAISE(ABORT,'redundant result update'); END`);
  clock = new Date(getYearSchedule(f.year.label).getTime() - 1);
  await worker().tick();
  expect(await db.archiveSnapshot.count({ where: { mode: 'annual' } })).toBe(0);
  clock = getYearSchedule(f.year.label);
  await worker().tick();
  const annual = await db.archiveSnapshot.findFirstOrThrow({ where: { mode: 'annual' } });
  expect(annual.status).toBe('completed');
  expect((await db.academicYear.findUniqueOrThrow({ where: { id: f.year.id } })).snapshotId).toBe(annual.id);
  const next = await db.academicYear.findFirstOrThrow({ where: { status: 'active' } });
  expect(next.label).toBe('2026-2027');
  expect(next.scheduledCloseAt).toEqual(getYearSchedule(next.label));
  expect(await db.quiz.findUniqueOrThrow({ where: { id: f.quiz.id } })).toEqual(previousQuiz);
  expect(await db.studentResult.findUniqueOrThrow({ where: { id: f.result.id } })).toEqual(previousResult);
  const movedA = await db.user.findUniqueOrThrow({ where: { id: f.sa.id } });
  const movedInactive = await db.user.findUniqueOrThrow({ where: { id: f.inactive.id } });
  expect(movedA.classId).toBe(f.b.id);
  expect(movedInactive.classId).toBe(f.b.id);
  expect(movedInactive.isActive).toBe(false);
  expect(new Set([movedA.studentNo, movedInactive.studentNo, teacher.studentNo]).size).toBe(3);
  expect(movedA.classNo).toBeNull();
  expect((await db.user.findUniqueOrThrow({ where: { id: f.sb.id } })).classId).toBe(f.c.id);
  const graduated = await db.user.findUniqueOrThrow({ where: { id: f.sc.id } });
  expect(graduated).toMatchObject({ classId: null, studentNo: null, classNo: null, isActive: false, graduationYear: f.year.label, graduationDate: clock, deactivatedAt: clock });
  const graduateRow = await db.archiveSnapshotRow.findFirstOrThrow({ where: { snapshotId: annual.id, entityType: 'user', entityId: f.sc.id } });
  expect(JSON.parse(graduateRow.dataJson)).toMatchObject({ classId: f.c.id, studentNo: 1, isActive: true });
  expect(await db.archiveSnapshotRow.count({ where: { snapshotId: annual.id, entityType: 'quiz', entityId: f.quiz.id } })).toBe(1);
  expect(await db.class.findMany({ orderBy: { id: 'asc' }, include: { teachers: true, assignedCategories: true } })).toEqual(classes);
  expect(await db.category.findMany({ include: { teachers: true, classes: true } })).toEqual(categories);
  expect(await db.user.findUniqueOrThrow({ where: { id: f.teacher.id }, include: { managedClasses: true, assignedCategories: true } })).toEqual(teacher);
  expect(await db.classTeacherCourse.findUniqueOrThrow({ where: { id: f.assignment.id } })).toEqual(f.assignment);
  const copied = await db.academicTransitionRule.findMany({ where: { yearId: next.id } });
  const shape = (rows: typeof rules) => rows.map(({ fromClassId, toClassId, graduate }) => ({ fromClassId, toClassId, graduate })).sort((x, y) => x.fromClassId.localeCompare(y.fromClassId));
  expect(shape(copied)).toEqual(shape(rules));
  expect(copied.every(r => !rules.some(old => old.id === r.id))).toBe(true);
  await verifyArchiveArtifact(await inputFor(annual.id), root);
});

it('completion audit failure rolls the whole rollover back and retry reuses frozen rows and the verified filesystem artifact', async () => {
  const f = await fixture();
  const people = await db.user.findMany({ orderBy: { id: 'asc' } });
  clock = getYearSchedule(f.year.label);
  await db.$executeRawUnsafe("CREATE TRIGGER fail_completed_audit BEFORE INSERT ON ActionLog WHEN NEW.action='ARCHIVE_COMPLETED' BEGIN SELECT RAISE(ABORT,'injected completion audit failure'); END");
  const generatePdf = vi.fn(pdf);
  const exportSpy = vi.fn((input: SnapshotExport, directory: string) => exportArchive(input, directory, { pdfGenerator: generatePdf }));
  await worker({ export: exportSpy }).tick();
  const job = await db.archiveSnapshot.findFirstOrThrow({ where: { mode: 'annual' } });
  expect(job.status).toBe('retry_wait');
  // Prisma maps SQLite trigger aborts to its foreign-key error category; the
  // invocation identifies the deliberately faulted completion audit insertion.
  expect(job.lastError).toContain('actionLog.create');
  expect(await db.actionLog.count({ where: { action: 'ARCHIVE_COMPLETED' } })).toBe(0);
  expect(job.zipSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(await db.user.findMany({ orderBy: { id: 'asc' } })).toEqual(people);
  expect(await db.academicYear.count()).toBe(1);
  expect((await db.academicYear.findUniqueOrThrow({ where: { id: f.year.id } })).status).toBe('active');
  expect((await db.quiz.findUniqueOrThrow({ where: { id: f.quiz.id } })).status).toBe('published');
  expect((await db.studentResult.findUniqueOrThrow({ where: { id: f.result.id } })).academicYear).toBeNull();
  const rows = await db.archiveSnapshotRow.findMany({ where: { snapshotId: job.id }, orderBy: { id: 'asc' } });
  const bytes = await readFile(job.artifactPath!);
  await db.$executeRawUnsafe('DROP TRIGGER fail_completed_audit');
  clock = job.nextAttemptAt!;
  await worker({ export: exportSpy }).tick();
  const completed = await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } });
  expect(completed.status).toBe('completed');
  expect(completed.zipSha256).toBe(job.zipSha256);
  expect(await readFile(completed.artifactPath!)).toEqual(bytes);
  expect(await db.archiveSnapshotRow.findMany({ where: { snapshotId: job.id }, orderBy: { id: 'asc' } })).toEqual(rows);
  expect(generatePdf).toHaveBeenCalledTimes(1);
  expect(await db.actionLog.count({ where: { action: 'ARCHIVE_COMPLETED' } })).toBe(1);
});

it('two workers respect the live lease and an expired owner cannot finalize after takeover', async () => {
  const f = await fixture();
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [f.quiz.id], initiatedBy: f.admin.id }, clock);
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  let firstArtifact: string | undefined;
  const first = worker({ owner: 'first-owner', export: async (input, directory) => {
    const artifact = await realExport(input, directory);
    firstArtifact = artifact.zipSha256;
    entered();
    await gate;
    return artifact;
  } });
  const independentDb = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const second = worker({ owner: 'second-owner', db: independentDb });
  const pending = first.tick();
  await started;
  try {
    await second.tick();
    expect((await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } })).attempts).toBe(1);
    clock = new Date(clock.getTime() + 180001);
    await second.tick();
    const completed = await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } });
    expect(completed.status).toBe('completed');
    expect(completed.attempts).toBe(2);
    expect(completed.zipSha256).toBe(firstArtifact);
  } finally { release(); await pending; await independentDb.$disconnect(); }
  expect(await db.actionLog.count({ where: { action: 'ARCHIVE_COMPLETED' } })).toBe(1);
});

it('a restarted worker verifies and reuses a persisted verified artifact without invoking export', async () => {
  const f = await fixture();
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [f.quiz.id], initiatedBy: f.admin.id }, clock);
  // Halt after filesystem verification, before the transaction can finalize.
  await worker({ owner: 'old-process', verify: async (input, directory) => {
    const artifact = await verifyArchiveArtifact(input, directory);
    await db.archiveSnapshot.update({ where: { id: job.id }, data: { status: 'verified', artifactPath: artifact.artifactPath, zipSha256: artifact.zipSha256, sizeBytes: artifact.sizeBytes } });
    clock = new Date(clock.getTime() + 180001);
    return artifact;
  } }).tick();
  expect((await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('verified');
  const forbiddenExport = vi.fn(async () => { throw new Error('Verified restart must not export'); });
  await worker({ owner: 'new-process', export: forbiddenExport }).tick();
  expect((await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('completed');
  expect(forbiddenExport).not.toHaveBeenCalled();
  await verifyArchiveArtifact(await inputFor(job.id), root);
});

it('real filesystem publication failure prevents graduation and next-year activation', async () => {
  const f = await fixture();
  const students = await db.user.findMany({ where: { role: 'student' }, orderBy: { id: 'asc' } });
  await writeFile(root, 'This is a file, not a backup directory');
  clock = getYearSchedule(f.year.label);
  await worker().tick();
  expect((await db.archiveSnapshot.findFirstOrThrow({ where: { mode: 'annual' } })).status).toBe('retry_wait');
  expect(await db.user.findMany({ where: { role: 'student' }, orderBy: { id: 'asc' } })).toEqual(students);
  expect(await db.academicYear.count()).toBe(1);
  expect((await db.academicYear.findUniqueOrThrow({ where: { id: f.year.id } })).status).toBe('active');
  expect((await db.quiz.findUniqueOrThrow({ where: { id: f.quiz.id } })).status).toBe('published');
});

it('tampered real ZIP fails verification and prevents year activation or promotion', async () => {
  const f = await fixture();
  clock = getYearSchedule(f.year.label);
  await worker({ export: async (input, directory) => {
    const artifact = await realExport(input, directory);
    await writeFile(artifact.artifactPath, 'corrupted ZIP');
    return artifact;
  } }).tick();
  const job = await db.archiveSnapshot.findFirstOrThrow({ where: { mode: 'annual' } });
  expect(job.status).toBe('retry_wait');
  expect(job.lastError).toContain('ZIP verification failed');
  expect(job.zipSha256).toBeNull();
  expect(await db.academicYear.count()).toBe(1);
  expect((await db.user.findUniqueOrThrow({ where: { id: f.sa.id } })).classId).toBe(f.a.id);
  expect((await db.user.findUniqueOrThrow({ where: { id: f.sc.id } })).isActive).toBe(true);
});

it('a worker-completed artifact verifies with the download API input shape and database row ordering', async () => {
  const f = await fixture();
  const queued = await enqueueArchive(db, { mode: 'manual', quizIds: [f.quiz.id], initiatedBy: f.admin.id }, clock);
  await worker().tick();
  const job = await db.archiveSnapshot.findUniqueOrThrow({
    where: { id: queued.id },
    include: { rows: { orderBy: [{ entityType: 'asc' }, { entityId: 'asc' }] } },
  });
  expect(job.status).toBe('completed');
  // Match archive.ts download's property order rather than the worker's. Both
  // callers describe the same frozen input and must accept the same artifact.
  const artifact = await verifyArchiveArtifact({
    id: job.id, label: job.label, initiatedBy: job.initiatedBy,
    createdAt: job.createdAt, rows: job.rows,
  }, root);
  expect(artifact.zipSha256).toBe(job.zipSha256);
  expect(artifact.sizeBytes).toBe(job.sizeBytes);
  expect(await readFile(artifact.artifactPath)).toEqual(await readFile(job.artifactPath!));
});
