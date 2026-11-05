import type { NextFunction, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth, type AuthRequest } from './auth';
import { archiveDb } from '../services/archive-db';

/** Protect the business-data boundary after annual capture; repairs and login remain available. */
export function createAnnualCaptureGuard(db: PrismaClient = archiveDb) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const path = req.path.toLowerCase();
    if (!path.startsWith('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ||
      (req.method === 'POST' && /^\/api\/auth\/(login|logout|change-password|forgot-password|reset-password)$/.test(path)) ||
      (req.method === 'POST' && /^\/api\/admin\/password-reset-requests(?:\/[^/]+\/(?:resend|cancel))?$/.test(path)) ||
      /^\/api\/(csrf-token$|notifications(?:\/|$))/.test(path) ||
      /^\/api\/admin\/(archive|academic-history|ai)(?:\/|$)/.test(path)) return next();
    db.archiveSnapshot.findFirst({ where: { mode: 'annual', capturedAt: { not: null }, status: { not: 'completed' }, academicYear: { status: 'active' } }, select: { id: true, label: true } })
      .then(job => {
        if (!job) return next();
        requireAuth(req, res, () => {
          db.actionLog.create({ data: { userId: req.user!.id, action: 'ARCHIVE_WRITE_DENIED', details: JSON.stringify({ snapshotId: job.id, method: req.method, path: req.path }) } })
            .then(() => res.status(423).json({ message: 'Yıllık arşiv tamamlanana kadar veriler geçici olarak salt okunurdur. Arşiv sayfasından durumu kontrol edin.', code: 'ANNUAL_CAPTURE_FROZEN' }))
            .catch(next);
        });
      }).catch(next);
  };
}
