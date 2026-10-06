import type { Prisma, PrismaClient, ArchiveSnapshot, AcademicYear } from '@prisma/client';
import { getOrCreateActiveYear } from './academic-year';
import { randomUUID } from 'node:crypto';
import { prepareArchiveRecovery } from './archive-export';

export class ArchiveJobError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface ArchiveEnqueueInput {
  mode: 'manual' | 'annual'; academicYearId?: string; quizIds?: string[]; initiatedBy?: string;
}
type ManualInput = Pick<ArchiveEnqueueInput, 'academicYearId' | 'quizIds'>;
async function manualScope(tx: Prisma.TransactionClient, year: AcademicYear, input: ManualInput) {
  if (year.status !== 'active' || (input.academicYearId && input.academicYearId !== year.id)) throw new ArchiveJobError(409, 'Yalnız etkin eğitim yılı arşivlenebilir.');
  if (!Array.isArray(input.quizIds) || !input.quizIds.length || input.quizIds.length > 10000 || input.quizIds.some(id => typeof id !== 'string' || !UUID.test(id))) throw new ArchiveJobError(400, 'Açık bir içerik seçimi gereklidir.');
  const quizIds = [...new Set(input.quizIds)].sort();
  const quizzes = await tx.quiz.findMany({ where: { id: { in: quizIds } }, select: { id: true, status: true, academicYear: true } });
  if (quizzes.length !== quizIds.length) throw new ArchiveJobError(400, 'Seçilen içerik bulunamadı.');
  if (quizzes.some(quiz => quiz.status === 'archived' || quiz.academicYear !== null)) throw new ArchiveJobError(409, 'Geçmiş içerik tekrar arşivlenemez.');
  const frozen = await tx.archiveSnapshotRow.findFirst({ where: { entityType: 'quiz', entityId: { in: quizIds } }, select: { id: true } });
  if (frozen) throw new ArchiveJobError(409, 'Seçilen içerik zaten değişmez bir arşivde kayıtlı.');
  const pending = await tx.archiveSnapshot.findMany({ where: { academicYearId: year.id, status: { notIn: ['completed', 'cancelled'] } }, select: { mode: true, scopeJson: true } });
  if (pending.some(job => job.mode === 'annual' || JSON.parse(job.scopeJson).quizIds?.some((id: string) => quizIds.includes(id)))) throw new ArchiveJobError(409, 'Seçilen içerik için devam eden arşiv var.');
  return quizIds;
}
export async function previewArchive(db: PrismaClient, input: ManualInput, now = new Date()) {
  const active = await getOrCreateActiveYear(db, now);
  return db.$transaction(async tx => {
    const year = await tx.academicYear.findUnique({ where: { id: active.id } });
    if (!year) throw new ArchiveJobError(409, 'Eğitim yılı bulunamadı.');
    const quizIds = await manualScope(tx, year, input);
    const [results, surveySubmissions, questions] = await Promise.all([
      tx.studentResult.count({ where: { quizId: { in: quizIds } } }),
      tx.surveySubmission.count({ where: { surveyId: { in: quizIds } } }),
      tx.question.count({ where: { quizId: { in: quizIds } } }),
    ]);
    return { academicYearId: year.id, label: year.label, quizIds, quizzes: quizIds.length, results, surveySubmissions, questions };
  });
}
export async function enqueueArchive(db: PrismaClient, input: ArchiveEnqueueInput, now = new Date()): Promise<ArchiveSnapshot> {
  if (!Number.isFinite(now.getTime())) throw new ArchiveJobError(400, 'Geçersiz sunucu saati.');
  if (!['manual', 'annual'].includes(input.mode)) throw new ArchiveJobError(400, 'Geçersiz arşiv modu.');
  const active = await getOrCreateActiveYear(db, now);
  if (input.academicYearId && input.academicYearId !== active.id) throw new ArchiveJobError(409, 'Yalnız etkin eğitim yılı arşivlenebilir.');
  try { return await db.$transaction(async tx => {
    const year = await tx.academicYear.findUnique({ where: { id: active.id } });
    if (!year || year.status !== 'active') throw new ArchiveJobError(409, 'Eğitim yılı kapatılmış.');
    let scope: { quizIds?: string[] } = {};
    if (input.mode === 'annual') {
      const existing = await tx.archiveSnapshot.findUnique({ where: { annualKey: year.label } });
      if (existing) return existing;
      if (now < year.scheduledCloseAt) throw new ArchiveJobError(409, 'Yıl sonu arşivi henüz zamanı gelmedi.');
    } else {
      scope = { quizIds: await manualScope(tx, year, input) };
    }
    const job = await tx.archiveSnapshot.create({ data: {
      academicYearId: year.id, label: year.label, mode: input.mode,
      annualKey: input.mode === 'annual' ? year.label : null,
      initiatedBy: input.initiatedBy ?? null, scopeJson: JSON.stringify(scope), createdAt: now,
    } });
    const actorId = input.initiatedBy ?? (await tx.user.findMany({ where: { role: 'admin', isActive: true }, select: { id: true }, orderBy: { id: 'asc' }, take: 1 }))[0]?.id;
    if (actorId) await tx.actionLog.create({ data: { userId: actorId, action: 'ARCHIVE_CREATED', details: JSON.stringify({ snapshotId: job.id, automatic: !input.initiatedBy, academicYear: job.label, mode: job.mode }) } });
    return job;
  }); } catch (error: any) {
    if (input.mode === 'annual' && error?.code === 'P2002') {
      const winner = await db.archiveSnapshot.findUnique({ where: { annualKey: active.label } });
      if (winner) return winner;
    }
    throw error;
  }
}
/** Classify failures without exposing filesystem paths or raw error text. */
export function archiveFailureReason(error: string | null | undefined) {
  if (!error) return { code: 'pending', reason: 'Manuel arşiv henüz tamamlanmadı.' };
  if (/checksum|ZIP verification|metadata conflict|manifest|missing or unexpected/i.test(error)) return { code: 'artifact_integrity_failed', reason: 'Arşiv paketi bütünlük doğrulamasından geçemedi.' };
  if (/transition|mapping|capacity|student number|membership changed/i.test(error)) return { code: 'transition_invalid', reason: 'Sınıf geçiş planı doğrulanamadı. Sınıf Geçişi sekmesindeki kuralları düzeltin.' };
  if (/symlink|non-directory|Unsafe archive/i.test(error)) return { code: 'unsafe_storage', reason: 'Arşiv depolama yolu güvenli değil. Sunucu yöneticisi depolama yolunu düzeltmeli.' };
  return { code: 'archive_failed', reason: 'Arşiv işlemi tamamlanamadı. Sunucu yöneticisi dosya üretimi ve depolama koşullarını kontrol etmeli.' };
}

/** Explicit administrator recovery reserves the job and preserves its frozen input. */
export async function recoverArchive(db: PrismaClient, input: { id: string; actorId: string; backupRoot: string }, now: () => Date) {
  const owner = 'recovery-' + randomUUID();
  const owned = () => ({ id: input.id, status: 'failed', leaseOwner: owner, leaseExpiresAt: { gt: now() } });
  const job = await db.$transaction(async tx => {
    const job = await tx.archiveSnapshot.findUnique({ where: { id: input.id }, include: { rows: true } });
    if (!job || job.status !== 'failed' || (job.leaseExpiresAt && job.leaseExpiresAt > now())) throw new ArchiveJobError(409, 'Bu arşiv şu anda kurtarılamaz. Tamamlanan paketler değiştirilemez.');
    const year = await tx.academicYear.findUnique({ where: { id: job.academicYearId } });
    if (!year || year.status !== 'active' || year.label !== job.label) throw new ArchiveJobError(409, 'Yalnız etkin yılın başarısız arşivi kurtarılabilir.');
    const reserved = await tx.archiveSnapshot.updateMany({ where: { id: job.id, status: 'failed', OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now() } }] }, data: { leaseOwner: owner, leaseExpiresAt: new Date(now().getTime() + 180000) } });
    if (reserved.count !== 1) throw new ArchiveJobError(409, 'Arşiv başka bir kurtarma işlemi tarafından alındı.');
    return { ...job };
  });
  let heartbeatError: unknown;
  const heartbeat = setInterval(() => {
    db.archiveSnapshot.updateMany({ where: owned(), data: { leaseExpiresAt: new Date(now().getTime() + 180000) } }).then(result => {
      if (result.count !== 1) heartbeatError = new ArchiveJobError(409, 'Kurtarma sahipliği değişti.');
    }).catch(error => { heartbeatError = error; });
  }, 60000);
  heartbeat.unref?.();
  try {
    const quarantine = await prepareArchiveRecovery({ id: job.id, label: job.label, initiatedBy: job.initiatedBy, createdAt: job.createdAt, rows: job.rows }, input.backupRoot, {
      actorId: input.actorId, previousAttempts: job.attempts, assertOwned: async () => {
        if (heartbeatError) throw heartbeatError;
        const current = await db.archiveSnapshot.findUnique({ where: { id: job.id } });
        if (!current || current.status !== 'failed' || current.leaseOwner !== owner || !current.leaseExpiresAt || current.leaseExpiresAt <= now()) throw new ArchiveJobError(409, 'Kurtarma sahipliği değişti.');
      },
    });
    if (heartbeatError) throw heartbeatError;
    await db.$transaction(async tx => {
      const updated = await tx.archiveSnapshot.updateMany({ where: owned(), data: { status: 'retry_wait', attempts: 0, nextAttemptAt: now(), leaseOwner: null, leaseExpiresAt: null, lastError: null, ...(quarantine ? { artifactPath: null, zipSha256: null, sizeBytes: null } : {}) } });
      if (updated.count !== 1) throw new ArchiveJobError(409, 'Kurtarma sahipliği değişti.');
      if (quarantine) await tx.actionLog.create({ data: { userId: input.actorId, action: 'ARCHIVE_ARTIFACT_QUARANTINED', details: JSON.stringify({ snapshotId: job.id, reason: 'artifact_integrity_failed', quarantine }) } });
      await tx.actionLog.create({ data: { userId: input.actorId, action: 'ARCHIVE_RECOVERY_REQUESTED', details: JSON.stringify({ snapshotId: job.id, previousAttempts: job.attempts, previousFailure: archiveFailureReason(job.lastError).code }) } });
    });
  } catch (error) {
    await db.$transaction(async tx => {
      const released = await tx.archiveSnapshot.updateMany({ where: { id: job.id, status: 'failed', leaseOwner: owner }, data: { leaseOwner: null, leaseExpiresAt: null } });
      if (released.count === 1) await tx.actionLog.create({ data: { userId: input.actorId, action: 'ARCHIVE_RECOVERY_FAILED', details: JSON.stringify({ snapshotId: job.id, reason: archiveFailureReason(String(error instanceof Error ? error.message : error)).code }) } });
    });
    if (error instanceof ArchiveJobError) throw error;
    throw new ArchiveJobError(409, 'Arşiv kurtarılamadı. Depolama yolunu ve dosya izinlerini düzeltip Yeniden Dene işlemini tekrar başlatın.');
  } finally { clearInterval(heartbeat); }
  return db.archiveSnapshot.findUniqueOrThrow({ where: { id: job.id } });
}
/** Only a failed manual job with no capture or artifact may release its reserved scope. */
export async function cancelUncapturedArchive(db: PrismaClient, id: string, actorId: string, now: Date) {
  return db.$transaction(async tx => {
    const job = await tx.archiveSnapshot.findUnique({ where: { id } });
    if (!job || job.mode !== 'manual' || job.status !== 'failed' || job.capturedAt || job.artifactPath || job.zipSha256 || job.sizeBytes !== null && job.sizeBytes !== undefined || job.leaseExpiresAt && job.leaseExpiresAt > now || await tx.archiveSnapshotRow.count({ where: { snapshotId: id } })) throw new ArchiveJobError(409, 'Yalnız kopyalama başlamamış, paketi olmayan ve başka işlem tarafından kullanılmayan başarısız manuel iş iptal edilebilir.');
    const changed = await tx.archiveSnapshot.updateMany({ where: { id, mode: 'manual', status: 'failed', capturedAt: null, artifactPath: null, zipSha256: null, sizeBytes: null, rows: { none: {} }, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] }, data: { status: 'cancelled', nextAttemptAt: null, leaseOwner: null, leaseExpiresAt: null, lastError: null } });
    if (changed.count !== 1) throw new ArchiveJobError(409, 'Arşiv durumu değişti; iptal edilmedi.');
    await tx.actionLog.create({ data: { userId: actorId, action: 'ARCHIVE_CANCELLED', details: JSON.stringify({ snapshotId: id, previousAttempts: job.attempts, previousFailure: archiveFailureReason(job.lastError).code, reason: 'manual_capture_never_started' }) } });
    return tx.archiveSnapshot.findUniqueOrThrow({ where: { id } });
  });
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
