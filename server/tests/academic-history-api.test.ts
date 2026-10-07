import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
vi.mock('../services/archive-db',()=>({archiveDb:{}}));
vi.mock('../services/academic-year',()=>({getOrCreateActiveYear:async()=>({id:'00000000-0000-4000-8000-000000000002',label:'2026-2027',status:'active',snapshotId:null})}));
vi.mock('../middleware/auth',()=>({requireAuth:(req:any,_res:any,next:any)=>{req.user={id:'actor',role:req.headers['x-role']??'admin'};req.session.userId='actor';next();},requireRole:(roles:string[])=>(req:any,res:any,next:any)=>roles.includes(req.user.role)?next():res.status(403).json({message:'denied'})}));
import { createAcademicHistoryRouter } from '../api-routes/academic-history';
import { createAcademicContextGuard } from '../middleware/academic-context';
const yearId='00000000-0000-4000-8000-000000000001';
const activeId='00000000-0000-4000-8000-000000000002';
const activeYear={id:activeId,label:'2026-2027',status:'active',snapshotId:null};
function setup(snapshotStatus='completed', snapshotLabel='2025-2026') {
  const closedYear={id:yearId,label:'2025-2026',status:'closed',snapshotId:'snapshot'};
  const db:any={academicYear:{findUnique:vi.fn(async({where}:any)=>where.id===activeId?activeYear:closedYear),findFirst:vi.fn(async()=>activeYear),findMany:vi.fn(async()=>[closedYear,activeYear])},archiveSnapshot:{findUnique:vi.fn(async()=>({id:'snapshot',academicYearId:yearId,label:snapshotLabel,mode:'annual',status:snapshotStatus})),findMany:vi.fn(async()=>[{id:'snapshot',academicYearId:yearId,label:snapshotLabel,mode:'annual',status:snapshotStatus}])},archiveSnapshotRow:{findMany:vi.fn(async()=>[
    {entityType:'user',entityId:'student',dataJson:JSON.stringify({id:'student',name:'Frozen Name',role:'student',classId:'class'})},
    {entityType:'class',entityId:'class',dataJson:JSON.stringify({id:'class',name:'Old Class'})},
    {entityType:'result',entityId:'result',dataJson:JSON.stringify({id:'result',studentId:'student',score:90})},
  ])},actionLog:{create:vi.fn(async()=>({}))}};
  const app=express();app.use(express.json());app.use(session({secret:'test-academic-history',resave:false,saveUninitialized:false}));
  app.use(createAcademicContextGuard(db));app.use('/api/admin/academic-history',createAcademicHistoryRouter({db}));
  app.get('/api/users',(_req,res)=>res.json({live:true}));app.delete('/api/users/:id',(_req,res)=>res.json({deleted:true}));
  app.get('/session', (req,res)=>res.json({context:req.session.academicYearContext??null}));
  app.get('/api/admin/archive/jobs/:id/download',(_req,res)=>res.json({download:true}));
  app.post('/api/admin/archive/jobs/:id/download-authorize',(_req,res)=>res.json({authorized:true}));
  return {app,db};
}
describe('frozen historical API and session enforcement',()=>{
  it('keeps snapshot names/class and bounds query input without live tables',async()=>{
    const {app,db}=setup();
    const result=await request(app).get(`/api/admin/academic-history/years/${yearId}/rows?type=result`);
    expect(result.status).toBe(200);expect(result.body.rows[0]).toMatchObject({studentName:'Frozen Name',studentClassName:'Old Class'});
    expect((await request(app).get(`/api/admin/academic-history/years/${yearId}/rows?pageSize=1000`)).status).toBe(400);
    expect(db.archiveSnapshotRow.findMany).toHaveBeenCalledTimes(1);
  });
  it('missing/incomplete annual snapshot errors without fallback',async()=>{
    const {app,db}=setup('failed');expect((await request(app).get(`/api/admin/academic-history/years/${yearId}/rows`)).status).toBe(409);
    expect(db.archiveSnapshotRow.findMany).not.toHaveBeenCalled();
  });
  it('rejects mismatched snapshot labels before reading rows',async()=>{
    const {app,db}=setup('completed','wrong-year');expect((await request(app).get(`/api/admin/academic-history/years/${yearId}/rows`)).status).toBe(409);expect(db.archiveSnapshotRow.findMany).not.toHaveBeenCalled();
  });
  it('scopes a result id and student id, joins announcement target class, and returns exam aggregates',async()=>{
    const {app,db}=setup();
    const student='00000000-0000-4000-8000-000000000011', cls='00000000-0000-4000-8000-000000000012', result='00000000-0000-4000-8000-000000000013';
    const rows=[['user',{id:student,name:'Frozen Student',role:'student',classId:cls}],['class',{id:cls,name:'Class at closure'}],['quiz',{id:'exam',contentType:'exam',title:'Exam'}],['quiz',{id:'survey',contentType:'survey',title:'Survey'}],['result',{id:result,studentId:student,quizId:'exam',score:80,status:'completed'}],['result',{id:'survey-result',studentId:student,quizId:'survey',score:10,status:'completed'}],['result',{id:'other',studentId:'other-student',quizId:'exam',score:20,status:'completed'}],['announcement',{id:'note',title:'For class',targetClassId:cls}]];
    db.archiveSnapshotRow.findMany.mockResolvedValue(rows.map(([entityType,data]:any)=>({entityType,entityId:data.id,dataJson:JSON.stringify(data)})));
    const one=await request(app).get(`/api/admin/academic-history/years/${yearId}/rows?type=result&entityId=${result}&studentId=${student}`);expect(one.status).toBe(200);expect(one.body.rows).toHaveLength(1);expect(one.body.rows[0].id).toBe(result);
    const announcement=await request(app).get(`/api/admin/academic-history/years/${yearId}/rows?type=announcement&classId=${cls}`);expect(announcement.body.rows[0].targetClassName).toBe('Class at closure');
    const stats=await request(app).get(`/api/admin/academic-history/years/${yearId}/rows?type=result&classId=${cls}&statistics=true`);expect(stats.body.statistics).toMatchObject({scoredExamResults:1,averageScore:80,students:1});
    expect(stats.body.rows).toHaveLength(1);
    expect((await request(app).get(`/api/admin/academic-history/years/${yearId}/rows?type=survey`)).body.rows.map((row:any)=>row.id)).toEqual(['survey']);
    expect((await request(app).get(`/api/admin/academic-history/years/${yearId}/rows?type=quiz`)).body.rows.map((row:any)=>row.id)).toEqual(['exam']);
    expect((await request(app).get(`/api/admin/academic-history/years/${yearId}/rows?type=result&studentId=invalid`)).status).toBe(400);
  });
  it('persists past context then rejects and audits direct writes and live reads',async()=>{
    const {app,db}=setup();const agent=request.agent(app);
    expect((await agent.post('/api/admin/academic-history/context').send({academicYearId:yearId})).status).toBe(200);
    expect((await agent.delete('/api/users/live')).status).toBe(403);
    expect((await agent.delete('/API/users/live')).status).toBe(403);
    expect(db.actionLog.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({action:'ACADEMIC_HISTORY_WRITE_REJECTED'})}));
    expect((await agent.get('/api/users')).status).toBe(409);
    expect((await agent.get('/api/admin/academic-history/context')).body.academicYearId).toBe(yearId);
  });
  it('rejects teacher and leaves default active traffic unchanged',async()=>{
    const {app}=setup();expect((await request(app).get(`/api/admin/academic-history/years/${yearId}/rows`).set('x-role','teacher')).status).toBe(403);
    expect((await request(app).get('/api/users')).status).toBe(200);
  });
  it('lists active first and only closed years owned by matching completed annual snapshots',async()=>{
    const {app,db}=setup();
    const extras=['missing','manual','failed','mismatched-year','mismatched-label'].map((kind,index)=>({id:`00000000-0000-4000-8000-00000000001${index}`,label:`202${index}-202${index+1}`,status:'closed',snapshotId:kind==='missing'?null:kind}));
    db.academicYear.findMany.mockResolvedValue([...extras,{id:yearId,label:'2025-2026',status:'closed',snapshotId:'snapshot'},activeYear]);
    db.archiveSnapshot.findUnique.mockImplementation(async({where}:any)=>{
      if(where.id==='snapshot')return {id:'snapshot',academicYearId:yearId,label:'2025-2026',mode:'annual',status:'completed'};
      const source=extras.find(year=>year.snapshotId===where.id)!;
      return {id:where.id,academicYearId:where.id==='mismatched-year'?'different':source.id,label:where.id==='mismatched-label'?'wrong-label':source.label,mode:where.id==='manual'?'manual':'annual',status:where.id==='failed'?'failed':'completed'};
    });
    db.archiveSnapshot.findMany.mockResolvedValue([]);
    const result=await request(app).get('/api/admin/academic-history/context');
    expect(result.status).toBe(200);expect(result.body.years.map((year:any)=>year.id)).toEqual([activeId,yearId]);expect(result.body.academicYearId).toBe(activeId);
    expect((await request(app).get('/session')).body.context).toBeNull();
  });
  it('GET preserves a valid same-session past selection and a new session starts active',async()=>{
    const {app}=setup();const agent=request.agent(app);
    await agent.post('/api/admin/academic-history/context').send({academicYearId:yearId});
    const before=(await agent.get('/session')).body.context;
    const read=await agent.get('/api/admin/academic-history/context');expect(read.body.academicYearId).toBe(yearId);
    expect((await agent.get('/session')).body.context).toEqual(before);
    expect((await request(app).get('/api/admin/academic-history/context')).body.academicYearId).toBe(activeId);
  });
  it.each(['missing','failed','manual','mismatched-label','mismatched-year'])('fails closed when the persisted historical snapshot becomes %s and permits explicit active recovery',async kind=>{
    const {app,db}=setup();const agent=request.agent(app);
    await agent.post('/api/admin/academic-history/context').send({academicYearId:yearId});
    const before=(await agent.get('/session')).body.context;
    db.archiveSnapshot.findUnique.mockResolvedValue(kind==='missing'?null:{id:'snapshot',academicYearId:kind==='mismatched-year'?'other':yearId,label:kind==='mismatched-label'?'wrong':'2025-2026',mode:kind==='manual'?'manual':'annual',status:kind==='failed'?'failed':'completed'});
    db.archiveSnapshot.findMany.mockResolvedValue([]);
    const read=await agent.get('/api/admin/academic-history/context');
    expect(read.status).toBe(200);expect(read.body.invalidSelection).toBe(true);expect(read.body.academicYearId).toBe(yearId);expect(read.body.years.map((year:any)=>year.id)).toEqual([activeId]);
    expect((await agent.get('/session')).body.context).toEqual(before);expect((await agent.get('/api/users')).status).toBe(409);
    expect((await agent.get('/api/admin/archive/jobs/snapshot/download')).status).toBe(409);
    expect((await agent.post('/api/admin/archive/jobs/snapshot/download-authorize')).status).toBe(403);
    expect((await agent.post('/api/admin/academic-history/context').send({academicYearId:activeId})).status).toBe(200);
    expect((await agent.get('/api/users')).status).toBe(200);expect((await agent.get('/api/admin/academic-history/context')).body.academicYearId).toBe(activeId);
  });
  it('does not let a delayed read overwrite a concurrently committed explicit selection',async()=>{
    const {app,db}=setup();const agent=request.agent(app);
    await agent.post('/api/admin/academic-history/context').send({academicYearId:yearId});
    let resolve!: (value:any)=>void;
    db.academicYear.findMany.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
    const reading=agent.get('/api/admin/academic-history/context').then(result=>result);
    await vi.waitFor(()=>expect(resolve).toBeDefined());
    expect((await agent.post('/api/admin/academic-history/context').send({academicYearId:activeId})).status).toBe(200);
    resolve([{id:yearId,label:'2025-2026',status:'closed',snapshotId:'snapshot'},activeYear]);await reading;
    expect((await agent.get('/api/admin/academic-history/context')).body.academicYearId).toBe(activeId);
  });
});
