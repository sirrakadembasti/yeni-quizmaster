import { Router, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth';
import { archiveDb } from '../services/archive-db';
import '../middleware/academic-context';
import { historyProjectionReady, warmHistoryProjection } from '../services/archive-history-projection';
import { queryFrozenHistory } from '../services/archive-history-query';
import path from 'node:path';
import { lstat, readFile } from 'node:fs/promises';
import { verifyArchiveArtifact, type ArchiveManifest, type SnapshotExport, type ArchiveArtifact } from '../services/archive-export';
import { sha256 } from '../services/archive-package';
import { getArchiveBackupRoot } from './archive';
import { archiveArtifactLocation, verifiedImageManifest } from '../services/archive-asset-manifest';
const types = ['user','student','teacher','class','category','teacherAssignment','quiz','survey','question','result','surveySubmission','surveyAnswer','guardianLink','announcement','questionBank'] as const;
class HistoryError extends Error { constructor(public status: number, message: string) { super(message); } }
export function createAcademicHistoryRouter({ db = archiveDb, now = () => new Date(), backupRoot, verifyArtifact=verifyArchiveArtifact }: { db?: PrismaClient; now?: () => Date; backupRoot?:string; verifyArtifact?:(input:SnapshotExport,root:string)=>Promise<ArchiveArtifact> } = {}) {
  const router = Router();
  router.use(requireAuth, requireRole(['admin']));
  router.use((_req,res,next) => {res.setHeader('Cache-Control','no-store');next();});
  const wrap = (fn: (req: AuthRequest, res: Response) => Promise<unknown>) => (req: AuthRequest, res: Response) => { void fn(req,res).catch(error => { if (!res.headersSent) res.status(error instanceof HistoryError ? error.status : 500).json({ message: error instanceof HistoryError ? error.message : 'Geçmiş yıl verileri okunamadı.' }); }); };
  const snapshotFor = async (id: string) => {
    if (!z.string().uuid().safeParse(id).success) throw new HistoryError(400,'Geçersiz yıl kimliği.');
    const year = await db.academicYear.findUnique({ where: { id } });
    if (!year || year.status !== 'closed' || !year.snapshotId) throw new HistoryError(409,'Bu yılın tamamlanmış yıllık arşivi bulunamadı.');
    const snapshot = await db.archiveSnapshot.findUnique({ where: { id: year.snapshotId } });
    if (!snapshot || snapshot.academicYearId !== year.id || snapshot.label !== year.label || snapshot.mode !== 'annual' || snapshot.status !== 'completed') throw new HistoryError(409,'Bu yılın tamamlanmış yıllık arşivi bulunamadı.');
    return { year, snapshot };
  };
  router.get('/context', wrap(async (req,res) => {
    const active = await db.academicYear.findFirst({ where: { status: 'active' }, select: { id:true,label:true,status:true,snapshotId:true } });
    if (!active) throw new HistoryError(503,'Aktif eğitim yılı doğrulanamadı.');
    const candidates = await db.academicYear.findMany({ select: { id:true,label:true,status:true,snapshotId:true }, orderBy: { label: 'desc' } });
    const years = [active];
    for (const year of candidates) {
      if (year.status !== 'closed' || !year.snapshotId) continue;
      const snapshot = await db.archiveSnapshot.findUnique({ where: { id: year.snapshotId } });
      if (snapshot && snapshot.academicYearId === year.id && snapshot.label === year.label && snapshot.mode === 'annual' && snapshot.status === 'completed') years.push(year);
    }
    const context = req.session.academicYearContext;
    const selected = context?.userId === req.user!.id && context.historical ? context.academicYearId : active.id;
    res.json({ years, academicYearId: selected, ...(!years.some(year=>year.id===selected) ? { invalidSelection:true } : {}) });
  }));
  router.post('/context', wrap(async (req,res) => {
    const parsed = z.object({ academicYearId: z.string().uuid() }).strict().safeParse(req.body);
    if (!parsed.success) throw new HistoryError(400,'Geçersiz yıl seçimi.');
    const year = await db.academicYear.findUnique({ where: { id: parsed.data.academicYearId } });
    if (!year) throw new HistoryError(404,'Eğitim yılı bulunamadı.');
    if (year.status !== 'active') await snapshotFor(year.id);
    req.session.academicYearContext = { userId: req.user!.id, academicYearId: year.id, historical: year.status !== 'active' };
    await new Promise<void>((resolve,reject) => req.session.save(error => error ? reject(error) : resolve()));
    res.json({ academicYearId: year.id });
  }));
  router.get('/years/:yearId/assets/:name',wrap(async(req,res)=>{
    const name=req.params.name;
    if(!/^[a-f0-9]{64}\.(png|jpg|webp)$/.test(name))throw new HistoryError(400,'Geçersiz arşiv görseli.');
    const {snapshot}=await snapshotFor(req.params.yearId);
    try{
      const root=getArchiveBackupRoot(backupRoot);
      const expected=archiveArtifactLocation(snapshot,root);
      let manifest:ArchiveManifest|null;
      if(verifyArtifact===verifyArchiveArtifact)manifest=await verifiedImageManifest(snapshot,root);
      else{
        const artifact=await verifyArtifact({id:snapshot.id,label:snapshot.label,initiatedBy:snapshot.initiatedBy,createdAt:snapshot.createdAt,capturedAt:snapshot.capturedAt,rows:[]},root);
        if(artifact.zipSha256!==snapshot.zipSha256||path.resolve(artifact.artifactPath)!==expected)throw new Error('Artifact identity mismatch');
        const manifestFile=path.join(path.dirname(expected),'manifest.json'),stat=await lstat(manifestFile);
        if(!stat.isFile()||stat.isSymbolicLink()||stat.size>16*1024*1024)throw new Error('Invalid image manifest');
        manifest=JSON.parse(await readFile(manifestFile,'utf8'));
      }
      if(!manifest)throw new Error('Legacy package has no frozen images');
      const directory=path.dirname(expected);
      for(const filename of [directory,path.join(directory,'images')]){const stat=await lstat(filename);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Unsafe image directory');}
      const entry=manifest.files.find(item=>item.path==='images/'+name);
      if(!entry)throw new Error('Frozen image missing');
      const file=path.join(directory,'images',name),stat=await lstat(file);
      if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==entry.bytes||stat.size>5*1024*1024)throw new Error('Invalid frozen image');
      const bytes=await readFile(file);
      if(sha256(bytes)!==entry.sha256||entry.sha256!==name.slice(0,64))throw new Error('Frozen image checksum mismatch');
      res.setHeader('X-Content-Type-Options','nosniff');res.type(name.endsWith('.jpg')?'image/jpeg':name.endsWith('.webp')?'image/webp':'image/png');res.send(bytes);
    }catch{throw new HistoryError(409,'Dondurulmuş arşiv görseli doğrulanamadı.');}
  }));
  router.get('/years/:yearId/rows', wrap(async (req,res) => {
    const parsed = z.object({ type:z.enum(types).default('user'), page:z.coerce.number().int().min(1).max(10000).default(1), pageSize:z.coerce.number().int().min(1).max(100).default(25), search:z.string().max(200).default(''), classId:z.string().uuid().optional(), studentId:z.string().uuid().optional(), teacherId:z.string().uuid().optional(), entityId:z.string().uuid().optional(), quizId:z.string().uuid().optional(), statistics:z.enum(['true','false']).default('false') }).strict().safeParse(req.query);
    if (!parsed.success) throw new HistoryError(400,'Geçersiz arşiv sorgusu.');
    const { year,snapshot } = await snapshotFor(req.params.yearId);
    if (!await historyProjectionReady(db,snapshot.id)) {
      void warmHistoryProjection(db,snapshot.id).catch(()=>{});
      res.setHeader('Retry-After','2');
      return res.status(503).json({code:'ARCHIVE_HISTORY_WARMING',message:'Arşiv arama dizini hazırlanıyor. Yeniden deneyin.'});
    }
    const result=await queryFrozenHistory(db,snapshot.id,parsed.data);
    const imageRows=result.rows.filter(row=>typeof row.imageUrl==='string'&&row.imageUrl.startsWith('/uploads/'));
    if(imageRows.length){
      let manifest:ArchiveManifest|null;
      try{manifest=await verifiedImageManifest(snapshot,getArchiveBackupRoot(backupRoot));}
      catch{throw new HistoryError(409,'Dondurulmuş arşiv görselleri doğrulanamadı.');}
      for(const row of imageRows){const image=manifest?.images.find(image=>image.entityId===row.id&&image.originalUrl===row.imageUrl&&['question','questionBank'].includes(image.entityType));if(image&&/^images\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(image.path))row.imageAssetUrl=`/api/admin/academic-history/years/${year.id}/assets/${path.basename(image.path)}`;}
    }
    res.json({year:{id:year.id,label:year.label},snapshotId:snapshot.id,...result});
  }));
  return router;
}
