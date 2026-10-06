import { Router, type Response, type NextFunction } from 'express';
import type { PrismaClient, ArchiveSnapshot } from '@prisma/client';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { z } from 'zod';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth';
import { archiveDb } from '../services/archive-db';
import { ArchiveJobError, enqueueArchive, previewArchive, previewAnnualTransition, recoverArchive, cancelUncapturedArchive, archiveFailureReason, UUID } from '../services/archive-jobs';
import type { TransitionSummary } from '../services/archive-transition';
import { getOrCreateActiveYear } from '../services/academic-year';
import { verifyArchiveArtifact } from '../services/archive-export';
import { getProjectRoot } from '../utils/project-paths';

declare module 'express-session' {
  interface SessionData { archiveDownloadGrant?: { snapshotId: string; expiresAt: number; userId: string; sessionVersion: number } }
}
const projectRoot = getProjectRoot();
/** Server configuration only; never derived from any request field. */
export function getArchiveBackupRoot(configured = process.env.ARCHIVE_BACKUP_ROOT): string {
  const root = path.resolve(projectRoot, configured || 'server/data/backups');
  const publicRoots = ['public', 'dist/public', 'client/public', 'client/dist', 'server/public', 'uploads', 'server/uploads'].map(value => path.resolve(projectRoot, value));
  if (root === path.parse(root).root || root === projectRoot || publicRoots.some(publicRoot => {
    const relative = path.relative(publicRoot, root);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  })) throw new Error('Archive backup root cannot be a filesystem root or public storage');
  return root;
}
const transitionSummaryFor = (job: ArchiveSnapshot): TransitionSummary | null => {
  if (job.mode !== 'annual' || job.status !== 'completed' || !job.transitionSummaryJson) return null;
  try {
    const summary = JSON.parse(job.transitionSummaryJson);
    if (['promoted', 'graduated', 'skippedInactive', 'skippedGraduated', 'skippedClassless'].some(key => !Number.isSafeInteger(summary[key]) || summary[key] < 0) || !Array.isArray(summary.transitions)) return null;
    return { promoted: summary.promoted, graduated: summary.graduated, skippedInactive: summary.skippedInactive, skippedGraduated: summary.skippedGraduated, skippedClassless: summary.skippedClassless, transitions: summary.transitions.map((row: any) => ({ fromClassId: row.fromClassId, fromClassName: row.fromClassName, toClassId: row.toClassId, toClassName: row.toClassName, graduate: row.graduate, students: row.students })) };
  } catch { return null; }
};
export const archiveJobMetadata = (job: ArchiveSnapshot) => ({
  id: job.id, academicYearId: job.academicYearId, label: job.label, mode: job.mode, status: job.status,
  initiatedBy: job.initiatedBy, attempts: job.attempts, createdAt: job.createdAt, completedAt: job.completedAt,
  nextAttemptAt: job.nextAttemptAt, zipSha256: job.zipSha256, sizeBytes: job.sizeBytes,
  error: job.lastError ? 'Arşiv işlemi başarısız oldu. Yeniden deneyebilirsiniz.' : null,
  transitionSummary: transitionSummaryFor(job),
});
interface ArchiveRouterOptions { db?: PrismaClient; now?: () => Date; backupRoot?: string; verifyArtifact?: typeof verifyArchiveArtifact }
const manualSchema = z.object({ mode: z.literal('manual').optional(), academicYearId: z.string().uuid().optional(), quizIds: z.array(z.string().uuid()).min(1).max(10000) }).strict();
const ruleSchema = z.object({ rules: z.array(z.object({ fromClassId: z.string().uuid(), toClassId: z.string().uuid().nullable().optional(), graduate: z.boolean() }).strict().refine(rule => rule.graduate ? rule.toClassId == null : !!rule.toClassId)).max(1000) }).strict();
export function createArchiveRouter(options: ArchiveRouterOptions = {}) {
  const db = options.db ?? archiveDb, now = options.now ?? (() => new Date()), verify = options.verifyArtifact ?? verifyArchiveArtifact;
  const router = Router();
  router.use(requireAuth, requireRole(['admin']));
  const wrap = (handler: (req: AuthRequest, res: Response) => Promise<any>) => (req: AuthRequest, res: Response, _next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(error => {
      if (!res.headersSent) res.status(error instanceof ArchiveJobError ? error.status : 500).json({ message: error instanceof ArchiveJobError ? error.message : 'Arşiv işlemi tamamlanamadı.' });
    });
  };
  const jobFor = async (id: string, includeRows = false) => {
    if (!UUID.test(id)) throw new ArchiveJobError(400, 'Geçersiz arşiv kimliği.');
    const job = await db.archiveSnapshot.findUnique({ where: { id }, ...(includeRows ? { include: { rows: { orderBy: [{ entityType: 'asc' }, { entityId: 'asc' }] } } } : {}) });
    if (!job) throw new ArchiveJobError(404, 'Arşiv bulunamadı.');
    return job;
  };
  const metadataFor = async (job: ArchiveSnapshot) => {
    const [manual, recoveries, rowCount] = await Promise.all([
      job.mode === 'annual' && job.status !== 'completed' ? db.archiveSnapshot.findMany({ where: { academicYearId: job.academicYearId, mode: 'manual', status: { notIn: ['completed', 'cancelled'] } }, orderBy: { createdAt: 'asc' } }) : [],
      db.actionLog.findMany({ where: { action: 'ARCHIVE_RECOVERY_REQUESTED', details: { contains: job.id } }, select: { action: true, details: true } }),
      job.mode === 'manual' && job.status === 'failed' && !job.capturedAt ? db.archiveSnapshotRow.count({ where: { snapshotId: job.id } }) : 1,
    ]);
    const history = recoveries.filter(log => { try { return log.action === 'ARCHIVE_RECOVERY_REQUESTED' && JSON.parse(log.details ?? '{}').snapshotId === job.id; } catch { return false; } });
    return { ...archiveJobMetadata(job), recoveryCount: history.length, lifetimeAttempts: job.attempts + history.reduce((sum, log) => sum + (Number(JSON.parse(log.details!).previousAttempts) || 0), 0),
      canCancel: rowCount === 0 && !job.artifactPath && !job.zipSha256 && job.sizeBytes == null && (!job.leaseExpiresAt || job.leaseExpiresAt <= now()),
      blockers: manual.filter(blocker => blocker.academicYearId === job.academicYearId && blocker.mode === 'manual' && !['completed', 'cancelled'].includes(blocker.status)).map(blocker => ({ id: blocker.id, status: blocker.status, ...archiveFailureReason(blocker.lastError), remedy: blocker.status === 'failed' ? 'Geçmiş ve İşler sekmesinde Yeniden Dene ile aynı verileri kurtarın. Kopyalama başlamadıysa açık iptal seçeneği kullanılabilir.' : 'Manuel arşivin doğrulanıp tamamlanmasını bekleyin; başarısız olursa Yeniden Dene ile kurtarın.' })) };
  };
  router.post('/', wrap(async (req, res) => {
    const parsed = manualSchema.safeParse(req.body);
    if (!parsed.success) throw new ArchiveJobError(400, 'Manuel arşiv için açık içerik seçimi gereklidir.');
    const job = await enqueueArchive(db, { ...parsed.data, mode: 'manual', initiatedBy: req.user!.id }, now());
    res.status(202).json({ job: archiveJobMetadata(job) });
  }));
  router.post('/preview', wrap(async (req, res) => {
    const parsed = manualSchema.omit({ mode: true }).safeParse(req.body);
    if (!parsed.success) throw new ArchiveJobError(400, 'Önizleme için açık içerik seçimi gereklidir.');
    res.json(await previewArchive(db, parsed.data, now()));
  }));
  router.post('/close-year', wrap(async (req, res) => {
    const parsed = z.object({ academicYearId: z.string().uuid().optional() }).strict().safeParse(req.body ?? {});
    // An unknown client clock can never influence the server date check.
    const active = await getOrCreateActiveYear(db, now());
    if (now() < active.scheduledCloseAt) throw new ArchiveJobError(409, 'Eğitim yılının kapanış zamanı henüz gelmedi.');
    if (!parsed.success) throw new ArchiveJobError(400, 'Geçersiz yıl sonu isteği.');
    const job = await enqueueArchive(db, { ...parsed.data, mode: 'annual', initiatedBy: req.user!.id }, now());
    res.status(202).json({ job: archiveJobMetadata(job) });
  }));
  router.get('/years', wrap(async (_req, res) => {
    const serverNow = now();
    await getOrCreateActiveYear(db, serverNow);
    const [years, latestCompletedAnnual] = await Promise.all([
      db.academicYear.findMany({ orderBy: [{ status: 'asc' }, { label: 'desc' }] }),
      // Recent job pagination must not hide the last completed year transition.
      db.archiveSnapshot.findFirst({ where: { mode: 'annual', status: 'completed' }, orderBy: [{ label: 'desc' }, { completedAt: 'desc' }, { id: 'desc' }] }),
    ]);
    res.json({
      serverNow: serverNow.toISOString(),
      latestCompletedAnnual: latestCompletedAnnual ? archiveJobMetadata(latestCompletedAnnual) : null,
      years: years.map(year => ({
        ...year,
        canClose: year.status === 'active' && serverNow >= year.scheduledCloseAt,
      })),
    });
  }));
  router.get('/jobs', wrap(async (_req, res) => {
    const jobs = await db.archiveSnapshot.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    res.json({ jobs: await Promise.all(jobs.map(metadataFor)) });
  }));
  router.get('/jobs/:id', wrap(async (req, res) => res.json({ job: await metadataFor(await jobFor(req.params.id)) })));
  router.get('/jobs/:id/logs', wrap(async (req, res) => {
    const job = await jobFor(req.params.id);
    const logs = await db.actionLog.findMany({ where: { action: { startsWith: 'ARCHIVE_' }, details: { contains: job.id } }, orderBy: { createdAt: 'desc' }, take: 500 });
    const filtered = logs.filter(log => { try { return log.action.startsWith('ARCHIVE_') && JSON.parse(log.details ?? '{}').snapshotId === job.id; } catch { return false; } });
    res.json({ logs: filtered.map(log => ({ id: log.id, action: log.action, userId: log.userId, createdAt: log.createdAt, snapshotId: job.id })) });
  }));
  router.post('/jobs/:id/retry', wrap(async (req, res) => {
    await jobFor(req.params.id);
    const job = await recoverArchive(db, { id: req.params.id, actorId: req.user!.id, backupRoot: getArchiveBackupRoot(options.backupRoot) }, now);
    res.status(202).json({ job: await metadataFor(job) });
  }));
  router.post('/jobs/:id/cancel', wrap(async (req, res) => {
    await jobFor(req.params.id);
    const job = await cancelUncapturedArchive(db, req.params.id, req.user!.id, now());
    res.status(202).json({ job: await metadataFor(job) });
  }));
  router.post('/jobs/:id/download-authorize', wrap(async (req, res) => {
    delete req.session.archiveDownloadGrant;
    const job = await jobFor(req.params.id);
    if (job.status !== 'completed') throw new ArchiveJobError(409, 'Arşiv henüz hazır değil.');
    const parsed = z.object({ password: z.string().min(1).max(1024) }).strict().safeParse(req.body);
    const user = await db.user.findUnique({ where: { id: req.user!.id } });
    if (!parsed.success || !user || user.role !== 'admin' || user.sessionVersion !== (req.session.sessionVersion ?? 0) || !await bcrypt.compare(parsed.data.password, user.password)) throw new ArchiveJobError(403, 'Şifre doğrulanamadı.');
    const expiresAt = now().getTime() + 5 * 60 * 1000;
    req.session.archiveDownloadGrant = { snapshotId: job.id, expiresAt, userId: user.id, sessionVersion: user.sessionVersion };
    await db.actionLog.create({ data: { userId: user.id, action: 'ARCHIVE_DOWNLOAD_AUTHORIZED', details: JSON.stringify({ snapshotId: job.id }) } });
    res.json({ expiresAt });
  }));
  router.get('/jobs/:id/download', wrap(async (req, res) => {
    const grant = req.session.archiveDownloadGrant;
    if (!grant || grant.snapshotId !== req.params.id || grant.userId !== req.user!.id || grant.sessionVersion !== req.user!.sessionVersion || grant.sessionVersion !== (req.session.sessionVersion ?? 0) || grant.expiresAt <= now().getTime()) {
      delete req.session.archiveDownloadGrant; throw new ArchiveJobError(403, 'İndirmek için şifrenizi doğrulayın.');
    }
    const job = await jobFor(req.params.id, true);
    if (job.status !== 'completed') throw new ArchiveJobError(409, 'Arşiv henüz hazır değil.');
    let artifact;
    try { artifact = await verify({ id: job.id, label: job.label, initiatedBy: job.initiatedBy, createdAt: job.createdAt, rows: (job as any).rows }, getArchiveBackupRoot(options.backupRoot)); }
    catch { throw new ArchiveJobError(409, 'Arşiv dosyası doğrulanamadı.'); }
    if (artifact.zipSha256 !== job.zipSha256 || artifact.sizeBytes !== job.sizeBytes) throw new ArchiveJobError(409, 'Arşiv özeti doğrulanamadı.');
    res.setHeader('Cache-Control', 'no-store');
    res.download(artifact.artifactPath, `archive-${job.label}-${job.id}.zip`);
  }));
  router.get('/years/:id/rules', wrap(async (req, res) => {
    if (!UUID.test(req.params.id)) throw new ArchiveJobError(400, 'Geçersiz yıl kimliği.');
    const year = await db.academicYear.findUnique({ where: { id: req.params.id } });
    if (!year) throw new ArchiveJobError(404, 'Eğitim yılı bulunamadı.');
    res.json({ rules: await db.academicTransitionRule.findMany({ where: { yearId: year.id }, orderBy: { fromClassId: 'asc' } }) });
  }));
  router.get('/years/:id/transition-preview', wrap(async (req, res) => {
    if (!UUID.test(req.params.id)) throw new ArchiveJobError(400, 'Geçersiz yıl kimliği.');
    res.json(await previewAnnualTransition(db, req.params.id));
  }));
  router.put('/years/:id/rules', wrap(async (req, res) => {
    const parsed = ruleSchema.safeParse(req.body);
    if (!UUID.test(req.params.id) || !parsed.success) throw new ArchiveJobError(400, 'Geçersiz sınıf geçiş kuralları.');
    const rules = parsed.data.rules;
    if (new Set(rules.map(rule => rule.fromClassId)).size !== rules.length || rules.some(rule => rule.fromClassId === rule.toClassId)) throw new ArchiveJobError(400, 'Sınıf geçişleri açık ve benzersiz olmalı.');
    await db.$transaction(async tx => {
      const year = await tx.academicYear.findUnique({ where: { id: req.params.id } });
      if (!year) throw new ArchiveJobError(404, 'Eğitim yılı bulunamadı.');
      const annual = await tx.archiveSnapshot.findUnique({ where: { annualKey: year.label } });
      const editableAnnual = !annual || (['failed', 'queued', 'retry_wait'].includes(annual.status) && (!annual.leaseExpiresAt || annual.leaseExpiresAt <= now()));
      if (year.status !== 'active' || !editableAnnual) throw new ArchiveJobError(409, 'Bu yılın sınıf geçiş kuralları kilitli.');
      const classIds = [...new Set(rules.flatMap(rule => [rule.fromClassId, ...(rule.toClassId ? [rule.toClassId] : [])]))];
      const classes = await tx.class.findMany({ where: { id: { in: classIds } }, select: { id: true } });
      if (classes.length !== classIds.length) throw new ArchiveJobError(400, 'Sınıf bulunamadı.');
      await tx.academicTransitionRule.deleteMany({ where: { yearId: year.id } });
      for (const rule of rules) await tx.academicTransitionRule.create({ data: { yearId: year.id, fromClassId: rule.fromClassId, toClassId: rule.toClassId ?? null, graduate: rule.graduate } });
      await tx.actionLog.create({ data: { userId: req.user!.id, action: 'ARCHIVE_RULES_CHANGED', details: JSON.stringify({ yearId: year.id }) } });
    });
    res.json({ rules: await db.academicTransitionRule.findMany({ where: { yearId: req.params.id } }) });
  }));
  return router;
}
export default createArchiveRouter();
