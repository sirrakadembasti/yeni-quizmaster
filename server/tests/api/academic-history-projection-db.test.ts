import express from 'express';
import request from 'supertest';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
vi.mock('../../services/archive-db',()=>({archiveDb:{}}));
vi.mock('../../middleware/auth',()=>({requireAuth:(req:any,_res:any,next:any)=>{req.user={id:'projection-admin',role:'admin'};next();},requireRole:()=> (_req:any,_res:any,next:any)=>next()}));
import { createAcademicHistoryRouter } from '../../api-routes/academic-history';
import { captureArchive } from '../../services/archive-capture';
import { createArchiveWorker } from '../../services/archive-worker';
import { HISTORY_PROJECTION_VERSION,historyProjectionReady,warmHistoryProjection } from '../../services/archive-history-projection';
const template=process.env.DATABASE_URL!.slice(5);
if(!path.basename(path.dirname(template)).startsWith('quizmaster-test-'))throw new Error('Disposable history projection database required');
let db:PrismaClient;
beforeEach(async()=>{const filename=path.join(path.dirname(template),'projection-'+randomUUID()+'.db');await copyFile(template,filename);db=new PrismaClient({datasources:{db:{url:'file:'+filename.split('\\').join('/')}}});});
afterEach(async()=>{expect(await db.$queryRawUnsafe('SELECT * FROM ArchiveFinalizationPermit')).toEqual([]);await db.$disconnect();});
async function fixture(){
  const teacher=await db.user.create({data:{name:'Frozen Teacher',email:randomUUID()+'@example.test',password:'synthetic-not-exported',role:'teacher'}});
  const student=await db.user.create({data:{name:'ÉCOLE ÑANDÚ ΟΣ Москва İZMİR IĞDIR literal%_',email:randomUUID()+'@example.test',password:'synthetic-not-exported',role:'student'}});
  const quiz=await db.quiz.create({data:{title:'Frozen Exam',createdBy:teacher.id,contentType:'exam'}});
  const result=await db.studentResult.create({data:{quizId:quiz.id,studentId:student.id,status:'completed',score:85}});
  const year=await db.academicYear.create({data:{label:'2030-2031',opensAt:new Date(),scheduledCloseAt:new Date('2099-07-14T21:05:00Z')}});
  const job=await db.archiveSnapshot.create({data:{academicYearId:year.id,label:year.label,mode:'annual',scopeJson:'{}'}});
  return {teacher,student,quiz,result,year,job};
}
async function legacyCaptured(){
  const source=await fixture();
  const users=[source.teacher,source.student].map(({password,emailVerified,sessionVersion,...user}:any)=>({entityType:'user',entityId:user.id,dataJson:JSON.stringify(user)}));
  const rows=[...users,{entityType:'quiz',entityId:source.quiz.id,dataJson:JSON.stringify({...source.quiz,assignedClassIds:[]})},{entityType:'result',entityId:source.result.id,dataJson:JSON.stringify(source.result)}];
  await db.archiveSnapshot.update({where:{id:source.job.id},data:{status:'capturing'}});
  await db.archiveSnapshotRow.createMany({data:rows.map(row=>({snapshotId:source.job.id,...row}))});
  await db.archiveSnapshot.update({where:{id:source.job.id},data:{status:'files_generating',capturedAt:new Date()}});
  // A legitimately captured pre-projection snapshot completes through the same
  // exact capability path; no trigger is dropped or business fence bypassed.
  const artifact:any={artifactPath:path.join(path.dirname(template),'legacy-synthetic.zip'),zipSha256:'a'.repeat(64),sizeBytes:100,meta:{}};
  await createArchiveWorker({db,backupRoot:path.dirname(template),export:async()=>artifact,verify:async()=>artifact}).tick();
  expect((await db.archiveSnapshot.findUniqueOrThrow({where:{id:source.job.id}})).status).toBe('completed');
  return source;
}
it('publishes an exact complete projection atomically with capture and reuses it on retry',async()=>{
  const {job}=await fixture();await captureArchive(db,job.id);
  expect(await historyProjectionReady(db,job.id)).toBe(true);
  const rows=await db.archiveSnapshotRow.findMany({where:{snapshotId:job.id}});
  const projection:any[]=await db.$queryRawUnsafe('SELECT sourceRowId,sourceJson FROM ArchiveHistoryProjection WHERE snapshotId=? AND version=?',job.id,HISTORY_PROJECTION_VERSION);
  expect(projection).toHaveLength(rows.length);
  for(const cached of projection)expect(cached.sourceJson).toBe(rows.find(row=>row.id===cached.sourceRowId)!.dataJson);
  const before=await db.archiveSnapshot.findUniqueOrThrow({where:{id:job.id}});await captureArchive(db,job.id);
  expect(await db.archiveSnapshot.findUniqueOrThrow({where:{id:job.id}})).toEqual(before);
  expect(await db.archiveHistoryProjection.count({where:{snapshotId:job.id}})).toBe(rows.length);
  const plan:any[]=await db.$queryRawUnsafe('EXPLAIN QUERY PLAN SELECT 1 FROM ArchiveSnapshotRow WHERE (entityType=? AND entityId=?) OR (entityType=? AND entityId=?)','user',rows[0].entityId,'quiz',rows[0].entityId);
  expect(plan.filter(row=>String(row.detail).startsWith('SEARCH'))).toHaveLength(2);expect(plan.some(row=>String(row.detail).includes('ArchiveSnapshotRow_entityType_entityId_snapshotId_idx'))).toBe(true);
  expect(plan.some(row=>String(row.detail).startsWith('SCAN'))).toBe(false);
});
it('warms a legacy snapshot off request, exposes a distinct retry state, and preserves frozen sources',async()=>{
  const {job,year,result}=await legacyCaptured();
  const before=await db.archiveSnapshotRow.findMany({where:{snapshotId:job.id},orderBy:{id:'asc'}});
  expect(await historyProjectionReady(db,job.id)).toBe(false);
  const app=express();app.use('/history',createAcademicHistoryRouter({db}));
  const initial=await request(app).get(`/history/years/${year.id}/rows?type=result&search=${encodeURIComponent('%_')}`);
  expect(initial.status).toBe(503);expect(initial.body.code).toBe('ARCHIVE_HISTORY_WARMING');expect(initial.headers['retry-after']).toBe('2');
  const started=performance.now();await warmHistoryProjection(db,job.id);
  console.log('ARCHIVE_LEGACY_WARM',JSON.stringify({rows:before.length,remainingWaitMs:performance.now()-started,scope:'wait remaining after503 for off-request warm; not total first-build duration'}));
  const ready=await request(app).get(`/history/years/${year.id}/rows?type=result&search=${encodeURIComponent('%_')}`);
  expect(ready.status).toBe(200);expect(ready.body.rows.map((row:any)=>row.id)).toEqual([result.id]);
  expect(await db.archiveSnapshotRow.findMany({where:{snapshotId:job.id},orderBy:{id:'asc'}})).toEqual(before);
});
it('rejects wrong source bytes, incomplete readiness, and raw auxiliary mutations',async()=>{
  const {job}=await fixture();await captureArchive(db,job.id);
  const row=await db.archiveSnapshotRow.findFirstOrThrow({where:{snapshotId:job.id}});
  await expect(db.$executeRawUnsafe('INSERT INTO ArchiveHistoryProjection(sourceRowId,version,snapshotId,sourceJson,searchText) VALUES (?,?,?,?,?)',row.id,'bad-bytes',job.id,row.dataJson+' ','wrong')).rejects.toThrow(/ARCHIVE_HISTORY_SOURCE_MISMATCH/);
  await expect(db.$executeRawUnsafe('INSERT INTO ArchiveHistoryReady(snapshotId,version,rowCount,inputSha256) VALUES (?,?,?,?)',job.id,'incomplete',await db.archiveSnapshotRow.count({where:{snapshotId:job.id}}),'a'.repeat(64))).rejects.toThrow(/ARCHIVE_HISTORY_PROJECTION_INCOMPLETE/);
  for(const sql of ['UPDATE ArchiveHistoryProjection SET searchText=\'tampered\' WHERE snapshotId=?','DELETE FROM ArchiveHistoryProjection WHERE snapshotId=?','UPDATE ArchiveHistoryReady SET inputSha256=\'tampered\' WHERE snapshotId=?','DELETE FROM ArchiveHistoryReady WHERE snapshotId=?'])await expect(db.$executeRawUnsafe(sql,job.id)).rejects.toThrow(/ARCHIVE_HISTORY_PROJECTION_READ_ONLY/);
  await expect(db.$executeRawUnsafe('UPDATE ArchiveSnapshotRow SET dataJson=? WHERE id=?','{}',row.id)).rejects.toThrow(/ARCHIVE_READ_ONLY/);
  // Prisma maps SQLite trigger aborts on model mutations to P2003; verify the
  // named raw guard above and unchanged bytes rather than its translated text.
  await expect(db.archiveSnapshotRow.update({where:{id:row.id},data:{dataJson:'{}'}})).rejects.toMatchObject({code:'P2003'});
  expect(await db.archiveSnapshotRow.findUniqueOrThrow({where:{id:row.id}})).toEqual(row);
});
it('rebuilds another ICU version rather than using its incompatible search membership',async()=>{
  const {job}=await legacyCaptured();const rows=await db.archiveSnapshotRow.findMany({where:{snapshotId:job.id}});
  for(const row of rows)await db.$executeRawUnsafe('INSERT INTO ArchiveHistoryProjection(sourceRowId,version,snapshotId,sourceJson,searchText) VALUES (?,?,?,?,?)',row.id,'old-icu-version',job.id,row.dataJson,'incompatible');
  await db.$executeRawUnsafe('INSERT INTO ArchiveHistoryReady(snapshotId,version,rowCount,inputSha256) VALUES (?,?,?,?)',job.id,'old-icu-version',rows.length,'a'.repeat(64));
  expect(await historyProjectionReady(db,job.id)).toBe(false);await warmHistoryProjection(db,job.id);expect(await historyProjectionReady(db,job.id)).toBe(true);
  const current:any[]=await db.$queryRawUnsafe('SELECT searchText FROM ArchiveHistoryProjection WHERE snapshotId=? AND version=?',job.id,HISTORY_PROJECTION_VERSION);
  expect(current.some(row=>row.searchText.includes('école'))).toBe(true);expect(current.some(row=>row.searchText==='incompatible')).toBe(false);
});
it('rolls back captured rows and its fence if projection preparation fails',async()=>{
  const {job,student}=await fixture();
  const broken=new Proxy(db,{get(target,key){if(key==='$transaction')return async(fn:any,options:any)=>target.$transaction(async tx=>fn(new Proxy(tx,{get(transaction,property){if(property==='$executeRawUnsafe')return async(sql:string,...values:any[])=>{if(sql.startsWith('INSERT OR IGNORE INTO ArchiveHistoryProjection'))throw new Error('Synthetic projection storage failure');return (transaction.$executeRawUnsafe as any)(sql,...values);};return Reflect.get(transaction,property);}})),options);return Reflect.get(target,key);}});
  await expect(captureArchive(broken,job.id)).rejects.toThrow(/Synthetic projection/);
  expect(await db.archiveSnapshotRow.count({where:{snapshotId:job.id}})).toBe(0);expect((await db.archiveSnapshot.findUniqueOrThrow({where:{id:job.id}})).capturedAt).toBeNull();expect(await historyProjectionReady(db,job.id)).toBe(false);
  await expect(db.user.update({where:{id:student.id},data:{name:'Repair remains possible'}})).resolves.toMatchObject({name:'Repair remains possible'});
});
