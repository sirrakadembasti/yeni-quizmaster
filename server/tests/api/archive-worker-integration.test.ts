import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { copyFile, readFile, writeFile, readdir } from 'node:fs/promises';
import express from 'express';
import request from 'supertest';
import path from 'node:path';
import { getOrCreateActiveYear, getYearSchedule } from '../../services/academic-year';
import { enqueueArchive } from '../../services/archive-jobs';
import { exportArchive, verifyArchiveArtifact, type SnapshotExport } from '../../services/archive-export';
import { createArchiveWorker } from '../../services/archive-worker';
import { captureArchive } from '../../services/archive-capture';
const recoveryAuth = vi.hoisted(() => ({ id: '' }));
vi.mock('../../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.user = { id: recoveryAuth.id, role: 'admin' }; next(); },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));
import { createArchiveRouter } from '../../api-routes/archive';

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
  // Production triggers check a real SQLite lease clock. Calendar boundaries
  // are still tested by advancing this clock to the next persisted July close.
  clock = new Date();
});
afterEach(async () => {
  expect(await db.$queryRawUnsafe('SELECT * FROM ArchiveFinalizationPermit')).toEqual([]);
  await db.$disconnect();
});
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
  return { id, label: job.label, createdAt: job.createdAt, capturedAt: job.capturedAt, initiatedBy: job.initiatedBy, rows };
}
function recoveryApp(adminId: string) {
  recoveryAuth.id = adminId;
  const app = express(); app.use(express.json());
  app.use('/archive', createArchiveRouter({ db, now, backupRoot: root }));
  return app;
}

it.each([5, 20])('recovers an exhausted manual capture (%s attempts), preserves frozen rows and unblocks exactly one annual rollover', async attempts => {
  const f = await fixture();
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [f.quiz.id], initiatedBy: f.admin.id }, clock);
  await worker({ maxAttempts: 1, export: async (input, directory) => {
    const artifact = await realExport(input, directory);
    await writeFile(artifact.artifactPath, 'corrupt published package');
    return artifact;
  } }).tick();
  await db.archiveSnapshot.update({ where: { id: job.id }, data: { attempts } });
  const rows = await db.archiveSnapshotRow.findMany({ where: { snapshotId: job.id }, orderBy: { id: 'asc' } });
  clock = getYearSchedule(f.year.label);
  await worker().tick();
  const annual = await db.archiveSnapshot.findFirstOrThrow({ where: { mode: 'annual' } });
  expect(annual.status).toBe('queued');
  expect((await db.academicYear.findUniqueOrThrow({ where: { id: f.year.id } })).status).toBe('active');
  const app = recoveryApp(f.admin.id);
  const blocked = await request(app).get(`/archive/jobs/${annual.id}`);
  expect(blocked.body.job.blockers).toEqual([expect.objectContaining({ id: job.id, status: 'failed' })]);
  const retried = await request(app).post(`/archive/jobs/${job.id}/retry`);
  expect(retried.status).toBe(202);
  expect(retried.body.job.attempts).toBe(0);
  const quarantine = await readdir(path.join(root, '.quarantine'));
  expect(quarantine).toHaveLength(1);
  const quarantined = path.join(root, '.quarantine', quarantine[0]);
  expect(await readFile(path.join(quarantined, 'package', 'archive.zip'), 'utf8')).toBe('corrupt published package');
  expect(JSON.parse(await readFile(path.join(quarantined, 'reason.json'), 'utf8'))).toMatchObject({ snapshotId: job.id, reason: 'artifact_integrity_failed' });
  await worker().tick();
  expect((await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('completed');
  expect(await db.archiveSnapshotRow.findMany({ where: { snapshotId: job.id }, orderBy: { id: 'asc' } })).toEqual(rows);
  await worker().tick();
  await worker().tick();
  expect((await db.archiveSnapshot.findUniqueOrThrow({ where: { id: annual.id } })).status).toBe('completed');
  expect(await db.archiveSnapshot.count({ where: { mode: 'annual' } })).toBe(1);
  expect(await db.academicYear.count()).toBe(2);
  expect(await db.actionLog.count({ where: { action: 'ARCHIVE_RECOVERY_REQUESTED', details: { contains: job.id } } })).toBe(1);
  expect(await db.actionLog.count({ where: { action: 'ARCHIVE_ARTIFACT_QUARANTINED', details: { contains: job.id } } })).toBe(1);
  expect(await db.actionLog.count({ where: { action: 'ARCHIVE_CREATED', details: { contains: annual.id } } })).toBe(1);
});

it('each explicit recovery has another bounded automatic cycle and audits failures without losing frozen rows', async () => {
  const f = await fixture();
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [f.quiz.id], initiatedBy: f.admin.id }, clock);
  const fail = () => worker({ maxAttempts: 2, export: async () => { throw new Error('Synthetic export unavailable'); } }).tick();
  await fail();
  clock = (await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } })).nextAttemptAt!;
  await fail();
  expect((await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('failed');
  const rows = await db.archiveSnapshotRow.findMany({ where: { snapshotId: job.id }, orderBy: { id: 'asc' } });
  expect((await request(recoveryApp(f.admin.id)).post(`/archive/jobs/${job.id}/retry`)).status).toBe(202);
  await fail();
  clock = (await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } })).nextAttemptAt!;
  await fail();
  const exhausted = await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } });
  expect(exhausted).toMatchObject({ status: 'failed', attempts: 2 });
  await worker().tick();
  expect((await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } })).attempts).toBe(2);
  expect(await db.archiveSnapshotRow.findMany({ where: { snapshotId: job.id }, orderBy: { id: 'asc' } })).toEqual(rows);
  expect(await db.actionLog.count({ where: { action: 'ARCHIVE_FAILED', details: { contains: job.id } } })).toBe(2);
});

it('refuses completed artifact repair even when its published ZIP has been corrupted', async () => {
  const f = await fixture();
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [f.quiz.id], initiatedBy: f.admin.id }, clock);
  await worker().tick();
  const completed = await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } });
  await writeFile(completed.artifactPath!, 'corrupt completed package');
  expect((await request(recoveryApp(f.admin.id)).post(`/archive/jobs/${job.id}/retry`)).status).toBe(409);
  expect(await readFile(completed.artifactPath!, 'utf8')).toBe('corrupt completed package');
  expect(await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } })).toEqual(completed);
});

it('automatic annual failure creates both an administrator notification and an email outbox item', async () => {
  const f = await fixture();
  clock = getYearSchedule(f.year.label);
  await worker({ maxAttempts: 1, export: async () => { throw new Error('Synthetic annual failure'); } }).tick();
  const job = await db.archiveSnapshot.findFirstOrThrow({ where: { mode: 'annual' } });
  expect(job.status).toBe('failed');
  expect(await db.notification.count({ where: { userId: f.admin.id, message: { contains: job.id } } })).toBe(1);
  expect(await db.emailQueue.count({ where: { to: f.admin.email, type: 'system_alert', body: { contains: job.id } } })).toBe(1);
});

it('concurrent administrator recoveries reserve exactly one owner and reject the competing request', async () => {
  const f = await fixture();
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [f.quiz.id], initiatedBy: f.admin.id }, clock);
  await worker({ maxAttempts: 1, export: async () => { throw new Error('Synthetic failed export'); } }).tick();
  const app = recoveryApp(f.admin.id);
  const responses = await Promise.all([request(app).post(`/archive/jobs/${job.id}/retry`), request(app).post(`/archive/jobs/${job.id}/retry`)]);
  expect(responses.map(response => response.status).sort()).toEqual([202, 409]);
  expect(await db.actionLog.count({ where: { action: 'ARCHIVE_RECOVERY_REQUESTED', details: { contains: job.id } } })).toBe(1);
});

it('failed recovery audit rolls back the retry reset, releases its own lease and retains the quarantine evidence', async () => {
  const f = await fixture();
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [f.quiz.id], initiatedBy: f.admin.id }, clock);
  await worker({ maxAttempts: 1, export: async (input, directory) => {
    const artifact = await realExport(input, directory);
    await writeFile(artifact.artifactPath, 'Synthetic damaged unpublished ZIP');
    return artifact;
  } }).tick();
  const before = await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } });
  const rows = await db.archiveSnapshotRow.findMany({ where: { snapshotId: job.id }, orderBy: { id: 'asc' } });
  await db.$executeRawUnsafe("CREATE TRIGGER fail_recovery_audit BEFORE INSERT ON ActionLog WHEN NEW.action='ARCHIVE_RECOVERY_REQUESTED' BEGIN SELECT RAISE(ABORT,'synthetic recovery audit failure'); END");
  expect((await request(recoveryApp(f.admin.id)).post(`/archive/jobs/${job.id}/retry`)).status).toBe(409);
  expect(await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({ status: 'failed', attempts: before.attempts, capturedAt: before.capturedAt, leaseOwner: null, leaseExpiresAt: null });
  expect(await db.archiveSnapshotRow.findMany({ where: { snapshotId: job.id }, orderBy: { id: 'asc' } })).toEqual(rows);
  const quarantine = path.join(root, '.quarantine', (await readdir(path.join(root, '.quarantine')))[0]);
  expect(JSON.parse(await readFile(path.join(quarantine, 'reason.json'), 'utf8'))).toMatchObject({ snapshotId: job.id, reason: 'artifact_integrity_failed' });
  expect(await db.actionLog.count({ where: { action: 'ARCHIVE_RECOVERY_REQUESTED', details: { contains: job.id } } })).toBe(0);
  expect(await db.actionLog.count({ where: { action: 'ARCHIVE_RECOVERY_FAILED', details: { contains: job.id } } })).toBe(1);
  await db.$executeRawUnsafe('DROP TRIGGER fail_recovery_audit');
  expect((await request(recoveryApp(f.admin.id)).post(`/archive/jobs/${job.id}/retry`)).status).toBe(202);
  await worker().tick();
  expect((await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('completed');
});

it('explicitly cancelling a failed pre-capture job whose quiz was deleted unblocks one annual rollover', async () => {
  const f = await fixture();
  const manual = await enqueueArchive(db, { mode: 'manual', quizIds: [f.other.id], initiatedBy: f.admin.id }, clock);
  await db.archiveSnapshot.update({ where: { id: manual.id }, data: { status: 'failed', attempts: 20, lastError: 'Selected content is missing' } });
  await db.quiz.delete({ where: { id: f.other.id } });
  clock = getYearSchedule(f.year.label);
  await worker().tick();
  const annual = await db.archiveSnapshot.findFirstOrThrow({ where: { mode: 'annual' } });
  expect(annual.status).toBe('queued');
  const response = await request(recoveryApp(f.admin.id)).post(`/archive/jobs/${manual.id}/cancel`);
  expect(response.status).toBe(202);
  expect(response.body.job.status).toBe('cancelled');
  expect(await db.archiveSnapshotRow.count({ where: { snapshotId: manual.id } })).toBe(0);
  await worker().tick(); await worker().tick();
  expect((await db.archiveSnapshot.findUniqueOrThrow({ where: { id: annual.id } })).status).toBe('completed');
  expect(await db.academicYear.count()).toBe(2);
  expect(await db.actionLog.count({ where: { action: 'ARCHIVE_CANCELLED', details: { contains: manual.id } } })).toBe(1);
});

it('API and SQLite refuse cancellation of any captured manual archive', async () => {
  const f = await fixture();
  const manual = await enqueueArchive(db, { mode: 'manual', quizIds: [f.quiz.id], initiatedBy: f.admin.id }, clock);
  await worker({ maxAttempts: 1, export: async () => { throw new Error('Synthetic export unavailable'); } }).tick();
  const job = await db.archiveSnapshot.findUniqueOrThrow({ where: { id: manual.id } });
  expect(job.capturedAt).not.toBeNull();
  const rows = await db.archiveSnapshotRow.findMany({ where: { snapshotId: job.id }, orderBy: { id: 'asc' } });
  expect.soft((await request(recoveryApp(f.admin.id)).post(`/archive/jobs/${job.id}/cancel`)).status).toBe(409);
  await expect(db.archiveSnapshot.update({ where: { id: job.id }, data: { status: 'cancelled' } })).rejects.toThrow();
  expect(await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } })).toEqual(job);
  expect(await db.archiveSnapshotRow.findMany({ where: { snapshotId: job.id }, orderBy: { id: 'asc' } })).toEqual(rows);
});

it('quarantines a null manifest and completes the same captured snapshot without changing frozen rows', async () => {
  const f = await fixture();
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [f.quiz.id], initiatedBy: f.admin.id }, clock);
  await worker({ maxAttempts: 1, export: async (input, directory) => {
    const artifact = await realExport(input, directory);
    await writeFile(path.join(path.dirname(artifact.artifactPath), 'checksums.json'), 'null');
    return artifact;
  } }).tick();
  const failed = await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } });
  expect(failed.status).toBe('failed');
  const rows = await db.archiveSnapshotRow.findMany({ where: { snapshotId: job.id }, orderBy: { id: 'asc' } });
  expect((await request(recoveryApp(f.admin.id)).post(`/archive/jobs/${job.id}/retry`)).status).toBe(202);
  const quarantine = path.join(root, '.quarantine', (await readdir(path.join(root, '.quarantine')))[0]);
  expect(await readFile(path.join(quarantine, 'package', 'checksums.json'), 'utf8')).toBe('null');
  await worker().tick();
  const completed = await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } });
  expect(completed).toMatchObject({ status: 'completed', capturedAt: failed.capturedAt });
  expect(await db.archiveSnapshotRow.findMany({ where: { snapshotId: job.id }, orderBy: { id: 'asc' } })).toEqual(rows);
  const artifact = await verifyArchiveArtifact(await inputFor(job.id), root);
  expect(completed.zipSha256).toBe(artifact.zipSha256);
});

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
  const nextStart = Number(f.year.label.slice(5));
  expect(next.label).toBe(`${nextStart}-${nextStart + 1}`);
  expect(next.scheduledCloseAt).toEqual(getYearSchedule(next.label));
  expect(await db.quiz.findUniqueOrThrow({ where: { id: f.quiz.id } })).toEqual(previousQuiz);
  expect(await db.studentResult.findUniqueOrThrow({ where: { id: f.result.id } })).toEqual(previousResult);
  const movedA = await db.user.findUniqueOrThrow({ where: { id: f.sa.id } });
  const movedInactive = await db.user.findUniqueOrThrow({ where: { id: f.inactive.id } });
  expect(movedA.classId).toBe(f.b.id);
  expect(movedInactive).toEqual(f.inactive);
  expect(movedA.studentNo).not.toBe(teacher.studentNo);
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
  const completed = await request(recoveryApp(f.admin.id)).get(`/archive/jobs/${annual.id}`);
  expect(completed.body.job.transitionSummary).toMatchObject({ promoted: 2, graduated: 1, skippedInactive: 1, skippedGraduated: 0, skippedClassless: 0 });
  await verifyArchiveArtifact(await inputFor(annual.id), root);
});

it('preserves inactive, former graduate and classless accounts while persisting the exact annual outcome', async () => {
  const f = await fixture();
  const former = await db.user.create({ data: { name: 'Former graduate', email: randomUUID() + '@example.test', password: 'synthetic', role: 'student', isActive: true, classId: f.a.id, studentNo: 3, graduationYear: '2024-2025', graduationDate: new Date('2025-07-14T21:05:00Z') } });
  const classless = await db.user.create({ data: { name: 'Classless', email: randomUUID() + '@example.test', password: 'synthetic', role: 'student' } });
  // The reactivated former graduate remains a stationary occupied seat.
  await db.class.update({ where: { id: f.a.id }, data: { maxStudents: 2 } });
  clock = getYearSchedule(f.year.label);
  await worker().tick();
  const annual = await db.archiveSnapshot.findFirstOrThrow({ where: { mode: 'annual' } });
  expect(annual.status).toBe('completed');
  expect(await db.user.findUniqueOrThrow({ where: { id: former.id } })).toEqual(former);
  expect(await db.user.findUniqueOrThrow({ where: { id: classless.id } })).toEqual(classless);
  expect(await db.user.findUniqueOrThrow({ where: { id: f.inactive.id } })).toEqual(f.inactive);
  const summary = { promoted: 2, graduated: 1, skippedInactive: 1, skippedGraduated: 1, skippedClassless: 1 };
  const completion = await db.actionLog.findFirstOrThrow({ where: { action: 'ARCHIVE_COMPLETED', details: { contains: annual.id } } });
  expect(JSON.parse(completion.details!).transitionSummary).toMatchObject(summary);
  expect((await request(recoveryApp(f.admin.id)).get(`/archive/jobs/${annual.id}`)).body.job.transitionSummary).toMatchObject(summary);
  const restartedDb = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    expect((await request(createAppFor(restartedDb, f.admin.id)).get(`/archive/jobs/${annual.id}`)).body.job.transitionSummary).toMatchObject(summary);
  } finally { await restartedDb.$disconnect(); }
});

function createAppFor(client: PrismaClient, adminId: string) {
  recoveryAuth.id = adminId;
  const app = express(); app.use(express.json()); app.use('/archive', createArchiveRouter({ db: client, now, backupRoot: root })); return app;
}

it.each(['missing mapping', 'capacity', 'number collision'])('rejects an invalid annual %s before capture and any filesystem generation', async reason => {
  const f = await fixture();
  if (reason === 'missing mapping') await db.academicTransitionRule.deleteMany({ where: { yearId: f.year.id, fromClassId: f.a.id } });
  if (reason === 'capacity') {
    await db.user.create({ data: { name: 'Stationary graduate', email: randomUUID() + '@example.test', password: 'synthetic', role: 'student', classId: f.b.id, studentNo: 3, graduationYear: '2024-2025' } });
  }
  if (reason === 'number collision') {
    // Reproduce a legacy invalid number. SQLite's unique index still remains intact.
    await db.user.update({ where: { id: f.inactive.id }, data: { studentNo: 0 } });
  }
  const generate = vi.fn(realExport);
  clock = getYearSchedule(f.year.label);
  await worker({ export: generate, maxAttempts: 1 }).tick();
  const job = await db.archiveSnapshot.findFirstOrThrow({ where: { mode: 'annual' } });
  expect(job).toMatchObject({ status: 'failed', capturedAt: null, artifactPath: null });
  expect(await db.archiveSnapshotRow.count({ where: { snapshotId: job.id } })).toBe(0);
  expect(generate).not.toHaveBeenCalled();
  expect(await db.academicYear.count()).toBe(1);
});

it('preview shows missing mappings before closing and accepts empty inactive-only source classes', async () => {
  const f = await fixture();
  await db.academicTransitionRule.deleteMany({ where: { yearId: f.year.id, fromClassId: f.a.id } });
  const app = recoveryApp(f.admin.id);
  const rejected = await request(app).get(`/archive/years/${f.year.id}/transition-preview`);
  expect(rejected.status).toBe(200);
  expect(rejected.body).toMatchObject({ ready: false, issues: [expect.objectContaining({ code: 'missing_mapping', fromClassId: f.a.id })] });
  await db.user.update({ where: { id: f.sa.id }, data: { isActive: false } });
  const accepted = await request(app).get(`/archive/years/${f.year.id}/transition-preview`);
  expect(accepted.status).toBe(200);
  expect(accepted.body).toMatchObject({ ready: true, issues: [], summary: { promoted: 1, graduated: 1, skippedInactive: 2 } });
});

it('final transaction revalidates a rule changed after preflight and writes no partial transition or summary', async () => {
  const f = await fixture();
  clock = getYearSchedule(f.year.label);
  await worker({ verify: async (input, directory) => {
    const artifact = await verifyArchiveArtifact(input, directory);
    // Test-only fault injection; no guard or finalization capability is weakened.
    await db.academicTransitionRule.deleteMany({ where: { yearId: f.year.id, fromClassId: f.a.id } });
    return artifact;
  } }).tick();
  const job = await db.archiveSnapshot.findFirstOrThrow({ where: { mode: 'annual' } });
  expect(job.status).toBe('retry_wait');
  expect((await db.user.findUniqueOrThrow({ where: { id: f.sa.id } })).classId).toBe(f.a.id);
  expect(await db.academicYear.count()).toBe(1);
  expect(await db.actionLog.count({ where: { action: 'ARCHIVE_COMPLETED', details: { contains: job.id } } })).toBe(0);
  expect((await request(recoveryApp(f.admin.id)).get(`/archive/jobs/${job.id}`)).body.job.transitionSummary).toBeNull();
});

it('preview uses captured students on retry and finalizes the repaired rules without recapturing', async () => {
  const f = await fixture();
  clock = getYearSchedule(f.year.label);
  await worker({ maxAttempts: 1, export: async () => { throw new Error('Synthetic storage unavailable'); } }).tick();
  const job = await db.archiveSnapshot.findFirstOrThrow({ where: { mode: 'annual' } });
  const rows = await db.archiveSnapshotRow.findMany({ where: { snapshotId: job.id }, orderBy: { id: 'asc' } });
  await db.academicTransitionRule.deleteMany({ where: { yearId: f.year.id, fromClassId: f.a.id } });
  const app = recoveryApp(f.admin.id);
  const preview = await request(app).get(`/archive/years/${f.year.id}/transition-preview`);
  expect(preview.status).toBe(200);
  expect(preview.body).toMatchObject({ ready: false, source: 'snapshot', issues: [expect.objectContaining({ code: 'missing_mapping' })] });
  await db.academicTransitionRule.create({ data: { yearId: f.year.id, fromClassId: f.a.id, toClassId: f.b.id } });
  expect((await request(app).get(`/archive/years/${f.year.id}/transition-preview`)).body.ready).toBe(true);
  expect((await request(app).post(`/archive/jobs/${job.id}/retry`)).status).toBe(202);
  await worker().tick();
  expect((await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('completed');
  expect(await db.archiveSnapshotRow.findMany({ where: { snapshotId: job.id }, orderBy: { id: 'asc' } })).toEqual(rows);
});

it('restart catches up three missed July boundaries without phantom years or repeated graduates', async () => {
  const f = await fixture();
  clock = new Date(getYearSchedule(`${Number(f.year.label.slice(0, 4)) + 2}-${Number(f.year.label.slice(5)) + 2}`).getTime() + 1);
  // Each tick is a fresh process-style worker using the persisted active year.
  await worker().tick(); await worker().tick(); await worker().tick(); await worker().tick();
  expect(await db.academicYear.count({ where: { status: 'closed' } })).toBe(3);
  expect(await db.archiveSnapshot.count({ where: { mode: 'annual', status: 'completed' } })).toBe(3);
  expect(await db.academicYear.count()).toBe(4);
  expect(await db.user.findUniqueOrThrow({ where: { id: f.inactive.id } })).toEqual(f.inactive);
  const oldest = await db.user.findUniqueOrThrow({ where: { id: f.sc.id } });
  expect(oldest.graduationYear).toBe(f.year.label);
  expect(await db.user.count({ where: { role: 'student', isActive: true, classId: { not: null } } })).toBe(0);
});

it('annual workers with separate clients complete one promotion and one durable summary at the July boundary', async () => {
  const f = await fixture();
  clock = getYearSchedule(f.year.label);
  const secondDb = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
  const first = worker({ owner: 'annual-one', export: async (input, directory) => { const artifact = await realExport(input, directory); entered(); await gate; return artifact; } });
  const pending = first.tick();
  await started;
  try { await worker({ db: secondDb, owner: 'annual-two' }).tick(); }
  finally { release(); await pending; await secondDb.$disconnect(); }
  await worker().tick();
  expect(await db.archiveSnapshot.count({ where: { mode: 'annual', status: 'completed' } })).toBe(1);
  expect(await db.actionLog.count({ where: { action: 'ARCHIVE_COMPLETED' } })).toBe(1);
  expect((await db.user.findUniqueOrThrow({ where: { id: f.sa.id } })).classId).toBe(f.b.id);
  expect((await db.user.findUniqueOrThrow({ where: { id: f.sb.id } })).classId).toBe(f.c.id);
});

it('persists automatic transition counts with no administrator account and protects them from raw tampering', async () => {
  const f = await fixture();
  await db.user.delete({ where: { id: f.admin.id } });
  clock = getYearSchedule(f.year.label);
  await worker().tick();
  const annual = await db.archiveSnapshot.findFirstOrThrow({ where: { mode: 'annual' } });
  expect(annual.status).toBe('completed');
  const [persisted] = await db.$queryRawUnsafe<Array<{ transitionSummaryJson: string }>>('SELECT transitionSummaryJson FROM ArchiveSnapshot WHERE id=?', annual.id);
  expect(JSON.parse(persisted.transitionSummaryJson)).toMatchObject({ promoted: 2, graduated: 1, skippedInactive: 1, skippedGraduated: 0, skippedClassless: 0 });
  expect(await db.actionLog.count({ where: { action: 'ARCHIVE_COMPLETED' } })).toBe(0);
  await expect(db.$executeRawUnsafe("UPDATE ArchiveSnapshot SET transitionSummaryJson='{}' WHERE id=?", annual.id)).rejects.toThrow(/READ_ONLY|SUMMARY/);
  const [unchanged] = await db.$queryRawUnsafe<Array<{ transitionSummaryJson: string }>>('SELECT transitionSummaryJson FROM ArchiveSnapshot WHERE id=?', annual.id);
  expect(unchanged).toEqual(persisted);
});

it('rejects forged transition outcomes on snapshot insert and before verified finalization', async () => {
  const f = await fixture();
  await expect(db.$executeRawUnsafe("INSERT INTO ArchiveSnapshot(id,academicYearId,label,mode,status,scopeJson,createdAt,transitionSummaryJson) VALUES(?,?,?,'annual','queued','{}',?,'{}')", randomUUID(), f.year.id, f.year.label, clock.getTime())).rejects.toThrow(/SUMMARY/);
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [f.quiz.id], initiatedBy: f.admin.id }, clock);
  await expect(db.$executeRawUnsafe("UPDATE ArchiveSnapshot SET transitionSummaryJson='{}' WHERE id=?", job.id)).rejects.toThrow(/SUMMARY/);
});

it.each(['eligible arrival', 'capacity change'])('capture validates an annual %s atomically after the worker preflight', async fault => {
  const f = await fixture();
  clock = getYearSchedule(f.year.label);
  const generate = vi.fn(realExport);
  await worker({ maxAttempts: 1, export: generate, capture: async (client, id, lease) => {
    if (fault === 'eligible arrival') await client.user.create({ data: { name: 'Concurrent eligible student', email: randomUUID() + '@example.test', password: 'synthetic', role: 'student', classId: f.b.id, studentNo: 3 } });
    else await client.class.update({ where: { id: f.b.id }, data: { maxStudents: 0 } });
    return captureArchive(client, id, lease);
  } }).tick();
  const annual = await db.archiveSnapshot.findFirstOrThrow({ where: { mode: 'annual' } });
  expect(annual).toMatchObject({ status: 'failed', capturedAt: null, artifactPath: null });
  expect(await db.archiveSnapshotRow.count({ where: { snapshotId: annual.id } })).toBe(0);
  expect(generate).not.toHaveBeenCalled();
  // The failed preflight must leave business data repairable, without a capture fence.
  await expect(db.class.update({ where: { id: f.b.id }, data: { maxStudents: 3 } })).resolves.toMatchObject({ maxStudents: 3 });
});

it('returns the latest completed annual outcome even after two hundred newer manual archives', async () => {
  const f = await fixture();
  clock = getYearSchedule(f.year.label);
  await worker().tick();
  const annual = await db.archiveSnapshot.findFirstOrThrow({ where: { mode: 'annual' } });
  const active = await db.academicYear.findFirstOrThrow({ where: { status: 'active' } });
  await db.archiveSnapshot.createMany({ data: Array.from({ length: 201 }, (_, index) => ({ academicYearId: active.id, label: active.label, mode: 'manual', status: 'completed', scopeJson: '{}', createdAt: new Date(clock.getTime() + index + 1) })) });
  const app = recoveryApp(f.admin.id);
  expect((await request(app).get('/archive/jobs')).body.jobs.some((job: any) => job.id === annual.id)).toBe(false);
  const years = await request(app).get('/archive/years');
  expect(years.status).toBe(200);
  expect(years.body.latestCompletedAnnual).toMatchObject({ id: annual.id, label: f.year.label, transitionSummary: { promoted: 2, graduated: 1, skippedInactive: 1 } });
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
    createdAt: job.createdAt, capturedAt: job.capturedAt, rows: job.rows,
  }, root);
  expect(artifact.zipSha256).toBe(job.zipSha256);
  expect(artifact.sizeBytes).toBe(job.sizeBytes);
  expect(await readFile(artifact.artifactPath)).toEqual(await readFile(job.artifactPath!));
});
it('SQLite expiry during finalization rolls back all entity writes and consumes no leftover permits', async () => {
  const f = await fixture();
  const people = await db.user.findMany({ orderBy: { id: 'asc' } });
  clock = getYearSchedule(f.year.label);
  await db.$executeRawUnsafe("CREATE TRIGGER expire_finalization_lease AFTER UPDATE ON Quiz WHEN NEW.status='archived' BEGIN UPDATE ArchiveSnapshot SET leaseExpiresAt=1 WHERE status='verified'; END");
  await worker().tick();
  const job = await db.archiveSnapshot.findFirstOrThrow({ where: { mode: 'annual' } });
  expect(job.status).toBe('retry_wait');
  expect(await db.user.findMany({ orderBy: { id: 'asc' } })).toEqual(people);
  expect((await db.quiz.findUniqueOrThrow({ where: { id: f.quiz.id } })).status).toBe('published');
  expect((await db.studentResult.findUniqueOrThrow({ where: { id: f.result.id } })).academicYear).toBeNull();
  expect(await db.academicYear.count()).toBe(1);
  expect(await db.$queryRawUnsafe('SELECT * FROM ArchiveFinalizationPermit')).toEqual([]);
  await db.$executeRawUnsafe('DROP TRIGGER expire_finalization_lease');
  clock = job.nextAttemptAt!;
  await worker().tick();
  expect((await db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('completed');
});
