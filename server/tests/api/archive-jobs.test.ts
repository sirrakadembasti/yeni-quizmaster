import express from 'express';
import session from 'express-session';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile, readdir, mkdir, symlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ role: 'admin', version: 2, password: '' }));
vi.mock('../../middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (auth.role === 'anonymous') return res.sendStatus(401);
    req.user = { id: 'admin', role: auth.role, sessionVersion: auth.version, password: auth.password };
    req.session.userId = 'admin'; req.session.sessionVersion = auth.version; next();
  },
  requireRole: (roles: string[]) => (req: any, res: any, next: any) => roles.includes(req.user.role) ? next() : res.sendStatus(403),
}));
import { enqueueArchive, ArchiveJobError } from '../../services/archive-jobs';
import { createArchiveRouter, getArchiveBackupRoot } from '../../api-routes/archive';
import { exportArchive, verifyArchiveArtifact } from '../../services/archive-export';

let year: any, jobs: any[], quizzes: any[], rules: any[], logs: any[], clock: Date, db: any, defaultBackupRoot: string;
beforeEach(async () => {
  defaultBackupRoot = await mkdtemp(path.join(tmpdir(), 'archive-api-isolated-'));
  clock = new Date('2026-01-01T00:00:00Z'); auth.role = 'admin'; auth.version = 2; auth.password = await bcrypt.hash('secret', 4);
  year = { id: randomUUID(), label: '2025-2026', status: 'active', scheduledCloseAt: new Date('2026-07-14T21:05:00Z') };
  jobs = []; rules = []; logs = []; quizzes = [{ id: randomUUID(), status: 'published', academicYear: null }];
  db = {
    academicYear: { findFirst: async () => year, findUnique: async ({ where }: any) => where.id === year.id ? year : null, findMany: async () => [year] },
    quiz: { findMany: async ({ where }: any) => quizzes.filter(q => where.id.in.includes(q.id)) },
    archiveSnapshotRow: { findFirst: async ({ where }: any) => jobs.flatMap(job => job.rows ?? []).find(row => row.entityType === where.entityType && where.entityId.in.includes(row.entityId)) ?? null, count: async ({ where }: any) => jobs.find(job => job.id === where.snapshotId)?.rows?.length ?? 0 },
    studentResult: { count: async ({ where }: any) => where.quizId.in.includes(quizzes[0].id) ? 3 : 0 },
    surveySubmission: { count: async ({ where }: any) => where.surveyId.in.includes(quizzes[0].id) ? 2 : 0 },
    question: { count: async ({ where }: any) => where.quizId.in.includes(quizzes[0].id) ? 4 : 0 },
    archiveSnapshot: {
      findFirst: async ({ where }: any) => jobs.filter(job => job.mode === where.mode && job.status === where.status).sort((a, b) => b.label.localeCompare(a.label))[0] ?? null,
      findUnique: async ({ where }: any) => jobs.find(j => where.id ? j.id === where.id : j.annualKey === where.annualKey) ?? null,
      findUniqueOrThrow: async ({ where }: any) => jobs.find(j => j.id === where.id),
      findMany: async ({ where, take, orderBy }: any = {}) => {
        const filtered = jobs.filter(job => !where?.status?.notIn?.includes(job.status) && job.status !== where?.status?.not && (!where?.academicYearId || job.academicYearId === where.academicYearId) && (!where?.mode || job.mode === where.mode));
        if (orderBy?.createdAt === 'desc') filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return take === undefined ? filtered : filtered.slice(0, take);
      },
      create: async ({ data }: any) => { const job = { id: randomUUID(), createdAt: clock, attempts: 0, status: 'queued', rows: [], ...data }; jobs.push(job); return job; },
      updateMany: async ({ where, data }: any) => { const job = jobs.find(j => j.id === where.id && j.status === where.status); if (!job) return { count: 0 }; Object.assign(job, data); return { count: 1 }; },
    },
    user: { findUnique: async () => ({ id: 'admin', role: auth.role, password: auth.password, sessionVersion: auth.version }), findMany: async () => [{ id: 'admin', email: 'synthetic@example.test' }] },
    class: { findMany: async ({ where }: any) => where.id.in.map((id: string) => ({ id })) },
    academicTransitionRule: { findMany: async () => rules, deleteMany: async () => { rules = []; }, create: async ({ data }: any) => { rules.push(data); return data; } },
    actionLog: { create: async ({ data }: any) => { logs.push(data); return data; }, findMany: async () => logs },
    $transaction: async (fn: any) => fn(db),
  };
});
afterEach(async () => { await rm(defaultBackupRoot, { recursive: true, force: true }); });
function app(verifyArtifact = vi.fn(), backupRoot = defaultBackupRoot) {
  const app = express(); app.use(express.json()); app.use(session({ secret: 'isolated-tests', resave: false, saveUninitialized: true }));
  app.use('/archive', createArchiveRouter({ db, now: () => clock, backupRoot, verifyArtifact })); return app;
}
it('reports annual eligibility from server time and updates at the exact boundary', async () => {
  const early = await request(app()).get('/archive/years');
  expect(early.body.serverNow).toBe(clock.toISOString());
  expect(early.body.years[0].canClose).toBe(false);
  clock = new Date(year.scheduledCloseAt);
  const due = await request(app()).get('/archive/years');
  expect(due.body.years[0].canClose).toBe(true);
});
it('requires explicit existing active content and never accepts annual mode through manual API', async () => {
  for (const quizIds of [[], ['bad'], [randomUUID()]]) await expect(enqueueArchive(db, { mode: 'manual', quizIds })).rejects.toBeInstanceOf(ArchiveJobError);
  quizzes[0].status = 'archived'; await expect(enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id] })).rejects.toThrow();
  for (const mode of ['auto', 'annual']) expect((await request(app()).post('/archive').send({ mode, quizIds: [quizzes[0].id] })).status).toBe(400);
  expect(jobs).toHaveLength(0);
});
it('persists frozen manual scope and deduplicates annual requests by year', async () => {
  const manual = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id, quizzes[0].id], initiatedBy: 'admin' }, clock);
  expect(JSON.parse(manual.scopeJson).quizIds).toEqual([quizzes[0].id]);
  clock = new Date('2026-07-14T21:05:00Z');
  const a = await enqueueArchive(db, { mode: 'annual' }, clock), b = await enqueueArchive(db, { mode: 'annual' }, clock);
  expect(a.id).toBe(b.id); expect(jobs).toHaveLength(2);
});
it('enforces authentication and server close date', async () => {
  auth.role = 'anonymous'; expect((await request(app()).get('/archive/years')).status).toBe(401);
  auth.role = 'teacher'; expect((await request(app()).get('/archive/years')).status).toBe(403);
  auth.role = 'admin'; expect((await request(app()).post('/archive/close-year').send({ now: '2099-01-01' })).status).toBe(409);
  clock = new Date('2026-07-14T21:05:00Z'); expect((await request(app()).post('/archive/close-year').send({})).status).toBe(202);
});
it('retries only failed jobs without replacing immutable snapshot identity', async () => {
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id] }, clock);
  expect((await request(app()).post(`/archive/jobs/${job.id}/retry`)).status).toBe(409);
  job.status = 'failed'; job.rows = [{ entityType: 'quiz', entityId: quizzes[0].id, dataJson: '{}' }]; job.attempts = 3;
  const response = await request(app()).post(`/archive/jobs/${job.id}/retry`);
  expect(response.status).toBe(202); expect(response.body.job.id).toBe(job.id); expect(job.rows).toHaveLength(1); expect(jobs).toHaveLength(1);
});
it('never exposes paths, raw errors, passwords or arbitrary log details', async () => {
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id] }, clock);
  logs = [];
  job.artifactPath = 'secret-path'; job.lastError = 'password=secret'; logs.push({ id: 'ok', action: 'ARCHIVE_CREATED', details: JSON.stringify({ snapshotId: job.id, password: 'secret' }) }, { id: 'unrelated', action: 'LOGIN', details: job.id });
  const meta = await request(app()).get(`/archive/jobs/${job.id}`), result = await request(app()).get(`/archive/jobs/${job.id}/logs`);
  expect(JSON.stringify(meta.body)).not.toMatch(/secret|artifactPath/); expect(result.body.logs).toHaveLength(1); expect(JSON.stringify(result.body)).not.toMatch(/password|secret/);
});
it('requires correct password and scopes grants to snapshot, clock and session version', async () => {
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id] }, clock); job.status = 'completed';
  const verify = vi.fn().mockRejectedValue(new Error('no artifact')); const agent = request.agent(app(verify));
  expect((await agent.get(`/archive/jobs/${job.id}/download`)).status).toBe(403);
  expect((await agent.post(`/archive/jobs/${job.id}/download-authorize`).send({ password: 'wrong' })).status).toBe(403);
  expect((await agent.post(`/archive/jobs/${job.id}/download-authorize`).send({ password: 'secret' })).status).toBe(200);
  expect((await agent.get(`/archive/jobs/${job.id}/download`)).status).toBe(409); expect(verify).toHaveBeenCalledTimes(1);
  clock = new Date(clock.getTime() + 300001); expect((await agent.get(`/archive/jobs/${job.id}/download`)).status).toBe(403);
  clock = new Date('2026-01-01T00:00:00Z'); await agent.post(`/archive/jobs/${job.id}/download-authorize`).send({ password: 'secret' });
  auth.version++; expect((await agent.get(`/archive/jobs/${job.id}/download`)).status).toBe(403);
});
it('validates explicit class transitions and locks mappings during annual processing', async () => {
  const fromClassId = randomUUID(), toClassId = randomUUID();
  expect((await request(app()).put(`/archive/years/${year.id}/rules`).send({ rules: [{ fromClassId, toClassId, graduate: true }] })).status).toBe(400);
  expect((await request(app()).put(`/archive/years/${year.id}/rules`).send({ rules: [{ fromClassId, toClassId, graduate: false }] })).status).toBe(200);
  expect(rules).toHaveLength(1);
  clock = new Date('2026-07-14T21:05:00Z'); const job = await enqueueArchive(db, { mode: 'annual' }, clock); job.status = 'capturing';
  expect((await request(app()).put(`/archive/years/${year.id}/rules`).send({ rules: [] })).status).toBe(409);
});
it('allows mapping repairs for unleased failed, queued or retry-wait annual jobs', async () => {
  clock = new Date('2026-07-14T21:05:00Z'); const job = await enqueueArchive(db, { mode: 'annual' }, clock);
  const rules = [{ fromClassId: randomUUID(), toClassId: null, graduate: true }];
  for (const status of ['failed', 'queued', 'retry_wait']) {
    job.status = status; job.leaseExpiresAt = null;
    expect((await request(app()).put(`/archive/years/${year.id}/rules`).send({ rules })).status).toBe(200);
  }
  job.leaseExpiresAt = new Date(clock.getTime() + 10000);
  expect((await request(app()).put(`/archive/years/${year.id}/rules`).send({ rules })).status).toBe(409);
  job.leaseExpiresAt = null;
  for (const status of ['files_generating', 'verified', 'completed']) {
    job.status = status; expect((await request(app()).put(`/archive/years/${year.id}/rules`).send({ rules })).status).toBe(409);
  }
});
it('rejects filesystem and public backup roots', () => {
  for (const root of [path.parse(process.cwd()).root, path.resolve(process.cwd(), '..'), path.resolve('../public/backups'), path.resolve('uploads/backups'), path.resolve('../client/public/backups')]) expect(() => getArchiveBackupRoot(root)).toThrow();
  expect(path.isAbsolute(getArchiveBackupRoot())).toBe(true);
});
it('rejects the production client static directory and every nested backup directory', () => {
  for (const root of ['client/dist', 'client/dist/backups', 'client/dist/assets/archive', path.resolve('../client/dist/backups')]) {
    expect(() => getArchiveBackupRoot(root)).toThrow(/public storage/);
  }
  expect(getArchiveBackupRoot('server/data/backups')).toBe(path.resolve('data/backups'));
});
it('blocks cross-snapshot grants and returns only a verified ZIP from frozen rows', async () => {
  const directory = await mkdtemp(path.resolve('data/archive-api-'));
  try {
    const job = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id] }, clock);
    job.rows = [{ entityType: 'quiz', entityId: quizzes[0].id, dataJson: JSON.stringify({ title: 'Frozen exam' }) }];
    Object.assign(job, await exportArchive({ id: job.id, label: job.label, initiatedBy: job.initiatedBy, createdAt: job.createdAt, capturedAt: job.capturedAt, rows: job.rows }, directory, { pdfGenerator: async () => Buffer.from('%PDF-1.4\nFrozen report\n%%EOF') })); job.status = 'completed';
    const expressApp = express(); expressApp.use(express.json()); expressApp.use(session({ secret: 'isolated-download', resave: false, saveUninitialized: true }));
    expressApp.use('/archive', createArchiveRouter({ db, now: () => clock, backupRoot: directory, verifyArtifact: verifyArchiveArtifact }));
    const agent = request.agent(expressApp);
    await agent.post(`/archive/jobs/${job.id}/download-authorize`).send({ password: 'secret' });
    expect((await agent.get(`/archive/jobs/${randomUUID()}/download`)).status).toBe(403);
    await agent.post(`/archive/jobs/${job.id}/download-authorize`).send({ password: 'secret' });
    quizzes[0].title = 'Changed live exam';
    const response = await agent.get(`/archive/jobs/${job.id}/download`);
    expect(response.status).toBe(200); expect(response.headers['content-disposition']).toContain('.zip'); expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-type']).toMatch(/zip/);
    job.zipSha256 = 'corrupt'; expect((await agent.get(`/archive/jobs/${job.id}/download`)).status).toBe(409);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
it('rejects future annual enqueue and manual closed-year requests', async () => {
  await expect(enqueueArchive(db, { mode: 'annual' }, clock)).rejects.toBeInstanceOf(ArchiveJobError);
  await expect(enqueueArchive(db, { mode: 'manual', academicYearId: randomUUID(), quizIds: [quizzes[0].id] }, clock)).rejects.toBeInstanceOf(ArchiveJobError);
  expect(jobs).toHaveLength(0);
});
it('returns the persisted annual winner when concurrent requests hit the unique key', async () => {
  clock = new Date('2026-07-14T21:05:00Z');
  db.archiveSnapshot.create = async ({ data }: any) => { jobs.push({ id: randomUUID(), ...data }); throw { code: 'P2002' }; };
  const job = await enqueueArchive(db, { mode: 'annual' }, clock);
  expect(job.id).toBe(jobs[0].id); expect(jobs).toHaveLength(1);
});
it('previews only the explicit scope with authoritative result, question and survey counts', async () => {
  const response = await request(app()).post('/archive/preview').send({ quizIds: [quizzes[0].id, quizzes[0].id], academicYearId: year.id });
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ quizzes: 1, results: 3, surveySubmissions: 2, questions: 4, quizIds: [quizzes[0].id], label: year.label, academicYearId: year.id });
  expect(jobs).toHaveLength(0);
});
it('uses the same rejection predicates for manual preview and enqueue', async () => {
  for (const body of [{ quizIds: [] }, { quizIds: [randomUUID()] }, { quizIds: [quizzes[0].id], academicYearId: randomUUID() }]) {
    expect((await request(app()).post('/archive/preview').send(body)).status).toBeGreaterThanOrEqual(400);
    expect((await request(app()).post('/archive').send(body)).status).toBeGreaterThanOrEqual(400);
  }
  for (const academicYear of [year.label, '2024-2025']) {
    quizzes[0].academicYear = academicYear;
    expect((await request(app()).post('/archive/preview').send({ quizIds: [quizzes[0].id] })).status).toBe(409);
    expect((await request(app()).post('/archive').send({ quizIds: [quizzes[0].id] })).status).toBe(409);
  }
  expect(jobs).toHaveLength(0);
});
it('rejects frozen quiz overlap even when the previous capture job has failed', async () => {
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id] }, clock);
  job.status = 'failed'; job.rows = [{ entityType: 'quiz', entityId: quizzes[0].id, dataJson: '{}' }];
  expect((await request(app()).post('/archive/preview').send({ quizIds: [quizzes[0].id] })).status).toBe(409);
  expect((await request(app()).post('/archive').send({ quizIds: [quizzes[0].id] })).status).toBe(409);
  expect(jobs).toHaveLength(1);
});

it.each([5, 20])('starts a fresh bounded recovery cycle after %s failed attempts while preserving the frozen identity', async attempts => {
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id], initiatedBy: 'admin' }, clock);
  Object.assign(job, { status: 'failed', attempts, lastError: 'private secret failure', rows: [{ entityType: 'quiz', entityId: quizzes[0].id, dataJson: '{}' }] });
  const response = await request(app()).post(`/archive/jobs/${job.id}/retry`);
  expect(response.status).toBe(202);
  expect(response.body.job).toMatchObject({ id: job.id, attempts: 0, status: 'retry_wait' });
  expect(job.rows).toHaveLength(1);
  expect(logs.find(log => log.action === 'ARCHIVE_RECOVERY_REQUESTED')).toMatchObject({ userId: 'admin' });
  expect(JSON.parse(logs.find(log => log.action === 'ARCHIVE_RECOVERY_REQUESTED').details)).toMatchObject({ snapshotId: job.id, previousAttempts: attempts });
});

it('rejects recovery of a failed job with another live recovery lease', async () => {
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id] }, clock);
  Object.assign(job, { status: 'failed', attempts: 5, leaseOwner: 'other-recovery', leaseExpiresAt: new Date(clock.getTime() + 60000) });
  expect((await request(app()).post(`/archive/jobs/${job.id}/retry`)).status).toBe(409);
  expect(job.status).toBe('failed');
});

it('reports failed manual blockers with safe reasons and recovery remedies on annual jobs', async () => {
  const manual = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id] }, clock);
  Object.assign(manual, { status: 'failed', attempts: 20, lastError: 'password=private' });
  clock = new Date(year.scheduledCloseAt);
  const annual = await enqueueArchive(db, { mode: 'annual', initiatedBy: 'admin' }, clock);
  const response = await request(app()).get(`/archive/jobs/${annual.id}`);
  expect(response.body.job.blockers).toEqual([expect.objectContaining({ id: manual.id, status: 'failed', remedy: expect.stringMatching(/Yeniden Dene/) })]);
  expect(JSON.stringify(response.body)).not.toContain('private');
});

it('audits automatic annual creation once with a durable administrator actor', async () => {
  db.user.findMany = async () => [{ id: 'admin', email: 'synthetic@example.test' }];
  clock = new Date(year.scheduledCloseAt);
  const a = await enqueueArchive(db, { mode: 'annual' }, clock);
  await enqueueArchive(db, { mode: 'annual' }, clock);
  const created = logs.filter(log => log.action === 'ARCHIVE_CREATED');
  expect(created).toHaveLength(1);
  expect(JSON.parse(created[0].details)).toMatchObject({ snapshotId: a.id, automatic: true });
});

it('quarantines a partially published incomplete package during explicit recovery', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'archive-recovery-api-'));
  try {
    const job = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id], initiatedBy: 'admin' }, clock);
    Object.assign(job, { status: 'failed', attempts: 20, rows: [{ entityType: 'quiz', entityId: quizzes[0].id, dataJson: '{}' }] });
    const target = path.join(directory, job.label, job.id);
    await mkdir(target, { recursive: true }); await writeFile(path.join(target, 'archive.zip'), 'incomplete synthetic ZIP');
    expect((await request(app(undefined, directory)).post(`/archive/jobs/${job.id}/retry`)).status).toBe(202);
    expect(await readdir(directory)).toContain('.quarantine');
    const quarantined = path.join(directory, '.quarantine', (await readdir(path.join(directory, '.quarantine')))[0]);
    expect(await readFile(path.join(quarantined, 'package/archive.zip'), 'utf8')).toBe('incomplete synthetic ZIP');
    expect(logs.some(log => log.action === 'ARCHIVE_ARTIFACT_QUARANTINED')).toBe(true);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it('refuses recovery through a symlinked artifact directory and keeps the failed job frozen', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'archive-recovery-api-'));
  try {
    const job = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id], initiatedBy: 'admin' }, clock);
    Object.assign(job, { status: 'failed', attempts: 5, rows: [{ entityType: 'quiz', entityId: quizzes[0].id, dataJson: '{}' }] });
    const outside = path.join(directory, 'outside'); await mkdir(outside); await writeFile(path.join(outside, 'sentinel'), 'untouched');
    const year = path.join(directory, job.label); await mkdir(year);
    await symlink(outside, path.join(year, job.id), process.platform === 'win32' ? 'junction' : 'dir');
    expect((await request(app(undefined, directory)).post(`/archive/jobs/${job.id}/retry`)).status).toBe(409);
    expect(job.status).toBe('failed');
    expect(job.attempts).toBe(5);
    expect(await readFile(path.join(outside, 'sentinel'), 'utf8')).toBe('untouched');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it('keeps failed pre-capture manual scopes reserved so overlapping new jobs cannot strand recovery', async () => {
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id] }, clock);
  job.status = 'failed'; job.attempts = 5;
  expect(job.rows).toEqual([]);
  expect((await request(app()).post('/archive/preview').send({ quizIds: [quizzes[0].id] })).status).toBe(409);
  expect((await request(app()).post('/archive').send({ quizIds: [quizzes[0].id] })).status).toBe(409);
  expect(jobs).toHaveLength(1);
});

it('explicitly cancels only a failed manual job that never captured data and audits the released scope', async () => {
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id], initiatedBy: 'admin' }, clock);
  job.status = 'failed'; job.attempts = 20;
  const response = await request(app()).post(`/archive/jobs/${job.id}/cancel`);
  expect(response.status).toBe(202);
  expect(response.body.job.status).toBe('cancelled');
  expect(logs.some(log => log.action === 'ARCHIVE_CANCELLED' && JSON.parse(log.details).snapshotId === job.id)).toBe(true);
  expect((await request(app()).post('/archive/preview').send({ quizIds: [quizzes[0].id] })).status).toBe(200);
});

it('never cancels captured, artifact-bearing, annual or leased jobs', async () => {
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id] }, clock);
  Object.assign(job, { status: 'failed', attempts: 5 });
  const forbidden = [{ capturedAt: clock }, { rows: [{ entityType: 'quiz', entityId: quizzes[0].id, dataJson: '{}' }] }, { artifactPath: 'private artifact' }, { zipSha256: 'hash' }, { sizeBytes: 10 }, { mode: 'annual' }, { leaseOwner: 'other', leaseExpiresAt: new Date(clock.getTime() + 60000) }];
  for (const fields of forbidden) {
    Object.assign(job, { capturedAt: null, rows: [], artifactPath: null, zipSha256: null, sizeBytes: null, mode: 'manual', leaseOwner: null, leaseExpiresAt: null }, fields);
    expect((await request(app()).post(`/archive/jobs/${job.id}/cancel`)).status).toBe(409);
    expect(job.status).toBe('failed');
  }
});

it.each(['null', '[]', '"invalid"', '42', 'true'])('quarantines an invalid manifest shape %s and rebuilds from exactly the same frozen input', async manifest => {
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id], initiatedBy: 'admin' }, clock);
  const rows = [{ entityType: 'quiz', entityId: quizzes[0].id, dataJson: JSON.stringify({ id: quizzes[0].id, title: 'Frozen manifest exam' }) }];
  const input = { id: job.id, label: job.label, initiatedBy: job.initiatedBy, createdAt: job.createdAt, rows };
  const pdfGenerator = async () => Buffer.from('%PDF-1.4\nSynthetic frozen manifest report\n%%EOF');
  const original = await exportArchive(input, defaultBackupRoot, { pdfGenerator });
  Object.assign(job, original, { status: 'failed', attempts: 20, capturedAt: clock, rows });
  const manifestPath = path.join(path.dirname(original.artifactPath), 'checksums.json');
  await writeFile(manifestPath, manifest);
  const response = await request(app()).post(`/archive/jobs/${job.id}/retry`);
  expect(response.status).toBe(202);
  expect(job.rows).toBe(rows);
  const quarantine = path.join(defaultBackupRoot, '.quarantine', (await readdir(path.join(defaultBackupRoot, '.quarantine')))[0]);
  expect(await readFile(path.join(quarantine, 'package', 'checksums.json'), 'utf8')).toBe(manifest);
  const regenerated = await exportArchive(input, defaultBackupRoot, { pdfGenerator });
  expect(await verifyArchiveArtifact(input, defaultBackupRoot)).toEqual(regenerated);
  expect(regenerated.zipSha256).toBe(original.zipSha256);
});

it('refuses quarantine of a completed package whose manifest is null', async () => {
  const job = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id], initiatedBy: 'admin' }, clock);
  const rows = [{ entityType: 'quiz', entityId: quizzes[0].id, dataJson: '{}' }];
  const output = await exportArchive({ id: job.id, label: job.label, initiatedBy: job.initiatedBy, createdAt: job.createdAt, rows }, defaultBackupRoot, { pdfGenerator: async () => Buffer.from('%PDF-1.4\nSynthetic completed report\n%%EOF') });
  Object.assign(job, output, { status: 'completed', rows });
  const manifestPath = path.join(path.dirname(output.artifactPath), 'checksums.json'); await writeFile(manifestPath, 'null');
  expect((await request(app()).post(`/archive/jobs/${job.id}/retry`)).status).toBe(409);
  expect(await readFile(manifestPath, 'utf8')).toBe('null');
  expect(await readdir(defaultBackupRoot)).not.toContain('.quarantine');
});

it('keeps an older-than-200 blocker addressable through job detail despite bounded history', async () => {
  const failed = await enqueueArchive(db, { mode: 'manual', quizIds: [quizzes[0].id], initiatedBy: 'admin' }, clock);
  Object.assign(failed, { status: 'failed', attempts: 20, capturedAt: clock, rows: [{ entityType: 'quiz', entityId: quizzes[0].id, dataJson: '{}' }] });
  for (let index = 1; index <= 201; index++) jobs.push({ id: randomUUID(), academicYearId: year.id, label: year.label, mode: 'manual', status: 'completed', attempts: 1, scopeJson: JSON.stringify({ quizIds: [randomUUID()] }), createdAt: new Date(clock.getTime() + index), rows: [] });
  clock = new Date(year.scheduledCloseAt);
  const annual = await enqueueArchive(db, { mode: 'annual', initiatedBy: 'admin' }, clock);
  const list = await request(app()).get('/archive/jobs');
  expect(list.body.jobs).toHaveLength(200);
  expect(list.body.jobs.some((job: any) => job.id === failed.id)).toBe(false);
  expect(list.body.jobs.find((job: any) => job.id === annual.id).blockers).toEqual([expect.objectContaining({ id: failed.id })]);
  const detail = await request(app()).get(`/archive/jobs/${failed.id}`);
  expect(detail.status).toBe(200);
  expect(detail.body.job).toMatchObject({ id: failed.id, status: 'failed', attempts: 20, canCancel: false });
});

