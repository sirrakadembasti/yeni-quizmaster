import { Router, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth';
import { archiveDb } from '../services/archive-db';
import { getOrCreateActiveYear } from '../services/academic-year';
import '../middleware/academic-context';
const types = ['user','student','teacher','class','category','teacherAssignment','quiz','survey','question','result','surveySubmission','surveyAnswer','guardianLink','announcement','questionBank'] as const;
class HistoryError extends Error { constructor(public status: number, message: string) { super(message); } }
export function createAcademicHistoryRouter({ db = archiveDb, now = () => new Date() }: { db?: PrismaClient; now?: () => Date } = {}) {
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
    const active = await getOrCreateActiveYear(db, now());
    const years = await db.academicYear.findMany({ select: { id:true,label:true,status:true,snapshotId:true }, orderBy: { label: 'desc' } });
    const context = req.session.academicYearContext;
    res.json({ years, academicYearId: context?.userId === req.user!.id && context.historical ? context.academicYearId : active.id });
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
  router.get('/years/:yearId/rows', wrap(async (req,res) => {
    const parsed = z.object({ type:z.enum(types).default('user'), page:z.coerce.number().int().min(1).max(10000).default(1), pageSize:z.coerce.number().int().min(1).max(100).default(25), search:z.string().max(200).default(''), classId:z.string().uuid().optional(), studentId:z.string().uuid().optional(), teacherId:z.string().uuid().optional(), entityId:z.string().uuid().optional(), quizId:z.string().uuid().optional(), statistics:z.enum(['true','false']).default('false') }).strict().safeParse(req.query);
    if (!parsed.success) throw new HistoryError(400,'Geçersiz arşiv sorgusu.');
    const { year,snapshot } = await snapshotFor(req.params.yearId);
    const { type,page,pageSize,search,classId,studentId,teacherId,entityId,quizId,statistics:showStatistics } = parsed.data;
    // All relations below are frozen snapshot rows. Never look up live names/classes.
    const raw = await db.archiveSnapshotRow.findMany({ where: { snapshotId:snapshot.id }, orderBy: [{entityType:'asc'},{entityId:'asc'}], take:250001 });
    if (raw.length > 250000) throw new HistoryError(409,'Arşiv kayıt sınırını aşıyor.');
    const byType = new Map<string, any[]>();
    for (const row of raw) { const data = JSON.parse(row.dataJson); const group = byType.get(row.entityType) ?? []; group.push(data); byType.set(row.entityType,group); }
    const indexes = new Map([...byType].map(([kind,rows]) => [kind,new Map(rows.map(row => [row.id,row]))]));
    const lookup = (kind: string,id: unknown) => indexes.get(kind)?.get(id);
    const kind = type === 'student' || type === 'teacher' ? 'user' : type === 'survey' ? 'quiz' : type;
    const enriched = (byType.get(kind) ?? []).filter(row => type === 'student' || type === 'teacher' ? row.role === type : type === 'survey' ? row.type === 'survey' : type === 'quiz' ? row.type !== 'survey' : true).map(row => ({ ...row,
      ...(row.classId ? { className:lookup('class',row.classId)?.name ?? 'Arşivde sınıf yok' } : {}),
      ...(row.targetClassId ? { targetClassName:lookup('class',row.targetClassId)?.name ?? 'Arşivde sınıf yok' } : {}),
      ...(row.teacherId ? { teacherName:lookup('user',row.teacherId)?.name } : {}),
      ...(row.createdBy ? { creatorName:lookup('user',row.createdBy)?.name } : {}),
      ...(row.classTeacherId ? { primaryTeacherName:lookup('user',row.classTeacherId)?.name } : {}),
      ...(row.teachers ? { teacherNames:row.teachers.map((teacher:{id:string}) => lookup('user',teacher.id)?.name ?? teacher.id) } : {}),
      ...(row.managedClassIds ? { managedClassNames:row.managedClassIds.map((id:string) => lookup('class',id)?.name ?? id) } : {}),
      ...(row.assignedCategoryIds ? { assignedCourseNames:row.assignedCategoryIds.map((id:string) => lookup('category',id)?.name ?? id) } : {}),
      ...(row.assignedCategories ? { assignedCourseNames:row.assignedCategories.map((course:{id:string}) => lookup('category',course.id)?.name ?? course.id) } : {}),
      ...(row.studentId ? { studentName:lookup('user',row.studentId)?.name, studentClassName:lookup('class',lookup('user',row.studentId)?.classId)?.name } : {}),
      ...(row.submissionId ? { studentName:lookup('user',lookup('surveySubmission',row.submissionId)?.studentId)?.name, studentClassName:lookup('class',lookup('user',lookup('surveySubmission',row.submissionId)?.studentId)?.classId)?.name, contentTitle:lookup('quiz',lookup('surveySubmission',row.submissionId)?.surveyId)?.title } : {}),
      ...(row.questionId ? { questionText:lookup('question',row.questionId)?.text } : {}),
      ...(row.guardianId ? { guardianName:lookup('user',row.guardianId)?.name } : {}),
      ...(row.categoryId ? { courseName:lookup('category',row.categoryId)?.name } : {}),
      ...(row.quizId || row.surveyId ? { contentTitle:lookup('quiz',row.quizId ?? row.surveyId)?.title } : {}),
      ...(row.assignedClassIds ? { assignedClassNames:row.assignedClassIds.map((id:string) => lookup('class',id)?.name ?? id) } : {}),
      ...(row.classes ? { classNames:row.classes.map((item:{id:string}) => lookup('class',item.id)?.name ?? item.id) } : {}),
    })).filter(row => {
      const rowStudentId=row.studentId??lookup('surveySubmission',row.submissionId)?.studentId;
      const rowQuizId=row.quizId??row.surveyId??lookup('surveySubmission',row.submissionId)?.surveyId;
      const rowClassId=row.classId??lookup('user',rowStudentId)?.classId;
      const classMatch=!classId || row.id===classId || rowClassId===classId || row.targetClassId===classId || row.assignedClassIds?.includes(classId) || row.managedClassIds?.includes(classId) || row.classes?.some((item:{id:string})=>item.id===classId);
      const teacherMatch=!teacherId || (kind==='user' && row.id===teacherId) || row.teacherId===teacherId || row.createdBy===teacherId || row.classTeacherId===teacherId || row.teachers?.some((item:{id:string})=>item.id===teacherId);
      return classMatch && teacherMatch && (!studentId || rowStudentId===studentId || (kind==='user' && row.id===studentId)) && (!entityId || row.id===entityId) && (!quizId || rowQuizId===quizId || (kind==='quiz' && row.id===quizId)) && (showStatistics!=='true' || kind!=='result' || lookup('quiz',row.quizId)?.type!=='survey') && (!search || JSON.stringify(row).toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')));
    });
    const students=(byType.get('user')??[]).filter(row=>row.role==='student' && (!classId || row.classId===classId) && (!studentId || row.id===studentId));
    const examResults=enriched.filter(row=>kind==='result' && typeof row.score==='number' && lookup('quiz',row.quizId)?.type!=='survey');
    const average=(rows:any[])=>rows.length ? rows.reduce((sum,row)=>sum+row.score,0)/rows.length : null;
    const classStatistics=(byType.get('class')??[]).filter(row=>!classId || row.id===classId).map(cls=>{const results=examResults.filter(row=>lookup('user',row.studentId)?.classId===cls.id);return {classId:cls.id,className:cls.name,students:students.filter(row=>row.classId===cls.id).length,scoredExamResults:results.length,averageScore:average(results)};});
    const statistics={students:students.length,scoredExamResults:examResults.length,averageScore:average(examResults),classes:classStatistics};
    res.json({ year: { id:year.id,label:year.label }, snapshotId:snapshot.id, counts:Object.fromEntries([...byType].map(([key,rows]) => [key,rows.length])), statistics, scope:{className:lookup('class',classId)?.name,studentName:lookup('user',studentId)?.name,teacherName:lookup('user',teacherId)?.name,contentTitle:lookup('quiz',quizId)?.title,entityId}, classes:(byType.get('class') ?? []).map(row => ({id:row.id,name:row.name})), rows:enriched.slice((page-1)*pageSize,page*pageSize), pagination:{page,pageSize,total:enriched.length,pages:Math.max(1,Math.ceil(enriched.length/pageSize))} });
  }));
  return router;
}
