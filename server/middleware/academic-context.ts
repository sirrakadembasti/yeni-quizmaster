import type { NextFunction, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth, type AuthRequest } from './auth';
import { archiveDb } from '../services/archive-db';
declare module 'express-session' { interface SessionData { academicYearContext?: { userId: string; academicYearId: string; historical: boolean } } }
export function historicalRequestPolicy(method: string, path: string, snapshotId?:string): number | null {
  path = path.toLowerCase().replace(/\/$/, '');
  const read = ['GET','HEAD','OPTIONS'].includes(method);
  // Installation configuration has no academic data; router enforces admin.
  if (/^\/api\/admin\/ai(?:\/|$)/.test(path)) return null;
  if (read && ['/api/auth/me','/api/csrf-token'].includes(path)) return null;
  if (method==='POST' && ['/api/auth/login','/api/auth/logout','/api/auth/forgot-password','/api/auth/reset-password'].includes(path)) return null;
  if (method==='POST' && path==='/api/auth/change-password') return null;
  if ((method==='GET' && ['/api/notifications','/api/notifications/preferences'].includes(path)) ||
      (method==='PATCH' && path==='/api/notifications/preferences') ||
      (method==='POST' && path==='/api/notifications/mark-read') ||
      (method==='DELETE' && /^\/api\/notifications\/(?!preferences$|mark-read$)[^/]+$/.test(path))) return null;
  if ((['GET','POST'].includes(method) && path==='/api/admin/password-reset-requests') ||
      (method==='POST' && /^\/api\/admin\/password-reset-requests\/[^/]+\/(resend|cancel)$/.test(path))) return null;
  if (path === '/api/admin/academic-history/context' && ['GET','POST'].includes(method)) return null;
  if (read && path.startsWith('/api/admin/academic-history/')) return null;
  const download=path.match(/^\/api\/admin\/archive\/jobs\/([^/]+)\/(download|download-authorize)$/);
  if (download && snapshotId?.toLowerCase()===download[1] && ((read && download[2]==='download') || (method==='POST' && download[2]==='download-authorize'))) return null;
  return read ? 409 : 403;
}
/** Mount after session and before ALL API routers. Uses server session, never client headers. */
export function createAcademicContextGuard(db: PrismaClient = archiveDb) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const context = req.session?.academicYearContext;
    if (!req.path.toLowerCase().startsWith('/api/') || !context?.historical || context.userId !== req.session.userId) return next();
    requireAuth(req, res, async () => {
      if (req.user?.role !== 'admin') return next();
      let selectedSnapshot:string|undefined;
      if (/^\/api\/admin\/archive\/jobs\/[^/]+\/download(?:-authorize)?\/?$/i.test(req.path)) {
        try {
          const year=await db.academicYear.findUnique({where:{id:context.academicYearId}});
          if(year?.status==='closed' && year.snapshotId){const snapshot=await db.archiveSnapshot.findUnique({where:{id:year.snapshotId}});if(snapshot?.mode==='annual' && snapshot.status==='completed' && snapshot.academicYearId===year.id && snapshot.label===year.label)selectedSnapshot=snapshot.id;}
        }
        catch {return res.status(503).json({message:'Geçmiş arşiv bağlamı doğrulanamadı.'});}
      }
      const status = historicalRequestPolicy(req.method, req.path,selectedSnapshot);
      if (status === null) return next();
      if (status === 403) {
        try { await db.actionLog.create({ data: { userId: req.user.id, action: 'ACADEMIC_HISTORY_WRITE_REJECTED', details: JSON.stringify({ academicYearId: context.academicYearId, method: req.method, path: req.path }) } }); }
        catch { return res.status(503).json({ message: 'İşlem güvenli biçimde engellendi; denetim kaydı yazılamadı.' }); }
      }
      return res.status(status).json({ message: status === 403 ? 'Geçmiş eğitim yılı salt okunurdur. İşlem reddedildi.' : 'Geçmiş yılda yalnız doğrulanmış arşiv verileri okunabilir.', code: 'ACADEMIC_HISTORY_READ_ONLY' });
    });
  };
}
