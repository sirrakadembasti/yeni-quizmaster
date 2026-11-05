import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth';
import { archiveDb } from '../services/archive-db';

export async function archiveContentGuard(req: AuthRequest, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  try {
    const id = req.params.id || req.params.quizId;
    if (!id) return next();
    const quiz = await archiveDb.quiz.findUnique({ where: { id }, select: { status: true } });
    const copied = await archiveDb.archiveSnapshotRow.findFirst({ where: { entityType: 'quiz', entityId: id }, select: { id: true } });
    if (quiz?.status !== 'archived' && !copied) return next();
    if (req.user) await archiveDb.actionLog.create({ data: {
      userId: req.user.id, action: 'ARCHIVE_WRITE_DENIED',
      details: JSON.stringify({ resource: 'quiz', id, method: req.method }),
    } });
    return res.status(403).json({ message: 'Arşivlenen veya snapshot alınan içerik salt okunurdur.' });
  } catch (error) { next(error); }
}

export async function archiveResultGuard(req: AuthRequest, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  try {
    const id = req.params.resultId || req.params.id;
    if (!id) return next();
    const result = await archiveDb.studentResult.findUnique({ where: { id }, select: { quizId: true, academicYear: true } });
    if (!result) return next();
    const quiz = await archiveDb.quiz.findUnique({ where: { id: result.quizId }, select: { status: true } });
    const copied = await archiveDb.archiveSnapshotRow.findFirst({ where: { entityType: 'result', entityId: id }, select: { id: true } });
    if (!result.academicYear && quiz?.status !== 'archived' && !copied) return next();
    if (req.user) await archiveDb.actionLog.create({ data: { userId: req.user.id, action: 'ARCHIVE_WRITE_DENIED', details: JSON.stringify({ resource: 'result', id, method: req.method }) } });
    return res.status(403).json({ message: 'Geçmiş dönem sonuçları salt okunurdur.' });
  } catch (error) { next(error); }
}
