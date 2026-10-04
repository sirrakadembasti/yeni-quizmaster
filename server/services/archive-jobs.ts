import type { Prisma, PrismaClient, ArchiveSnapshot, AcademicYear } from '@prisma/client';
import { getOrCreateActiveYear } from './academic-year';

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
  const pending = await tx.archiveSnapshot.findMany({ where: { academicYearId: year.id, status: { notIn: ['completed', 'failed'] } }, select: { mode: true, scopeJson: true } });
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
    if (input.initiatedBy) await tx.actionLog.create({ data: { userId: input.initiatedBy, action: 'ARCHIVE_CREATED', details: JSON.stringify({ snapshotId: job.id }) } });
    return job;
  }); } catch (error: any) {
    if (input.mode === 'annual' && error?.code === 'P2002') {
      const winner = await db.archiveSnapshot.findUnique({ where: { annualKey: active.label } });
      if (winner) return winner;
    }
    throw error;
  }
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
