// Diagnostic experiments only: fresh synthetic DB, no deployment or live SQL.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {ownedFile, noLinks, exclusiveJson, readPerformanceRuntime} from './production-performance-guard.mjs';
import {launchOwned, cleanupOwned} from './academic-owned-process.mjs';
import {verifyFixturePortsReleased} from './linux-owned-process-cleanup.mjs';
import {waitForAuditServer} from './audit-server-readiness.mjs';
import {seedPerformance} from './production-performance-seed.mjs';
import {summarize} from './production-performance-http.mjs';

const repo=noLinks(path.resolve(import.meta.dirname,'..'));
const req=createRequire(path.join(repo,'server/package.json'));
if(process.argv.slice(2).some(arg=>!['--late-only','--configuration-http','--pool-one','--journal-wal'].includes(arg)))throw Error('Unknown diagnostic option; fixture paths are never user-selected');
const lateOnly=process.argv.includes('--late-only');
const configurationHttp=process.argv.includes('--configuration-http');
const poolOne=process.argv.includes('--pool-one'),journalWal=process.argv.includes('--journal-wal');
assert.ok(!(lateOnly&&configurationHttp),'Select one diagnostic scope');
const sqlite=createRequire(req.resolve('connect-sqlite3'))('sqlite3');
const source=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8',windowsHide:true}).trim();
assert.match(source,/^[0-9a-f]{40}$/);
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const protectedFiles=['client/src/lib/api.ts','client/src/pages/server-setup.tsx','server/data/quiz.db'];
const before=protectedFiles.map(f=>hash(ownedFile(repo,f,true)));
noLinks(path.join(repo,'server/data'));
const root=fs.mkdtempSync(path.join(repo,'server/data/quizmaster-test-academic-performance-'));
for(const dir of ['server/data','server/uploads','server/prisma','client/dist','artifacts'])fs.mkdirSync(path.join(root,dir),{recursive:true,mode:0o700});
for(const f of ['package.json','server/package.json','client/package.json'])fs.writeFileSync(ownedFile(root,f),'{}',{flag:'wx',mode:0o600});
for(const f of ['.env','server/.env'])fs.writeFileSync(ownedFile(root,f),'# synthetic capacity investigation\n',{flag:'wx',mode:0o600});
fs.writeFileSync(ownedFile(root,'client/dist/index.html'),'<html><body>Synthetic API diagnostic</body></html>',{flag:'wx'});
fs.copyFileSync(ownedFile(repo,'server/prisma/schema.prisma',true),ownedFile(root,'server/prisma/schema.prisma'));
fs.cpSync(noLinks(path.join(repo,'server/prisma/migrations')),path.join(root,'server/prisma/migrations'),{recursive:true,errorOnExist:true,force:false});
const runtime={root,database:path.join(root,'server/data/academic.db'),runId:crypto.randomUUID()};
exclusiveJson(root,'runtime.json',runtime);
readPerformanceRuntime(repo,path.join(root,'runtime.json'),{runId:runtime.runId,requireDatabase:false});
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|SYSTEMROOT|WINDIR|TMP|TEMP|LOCALAPPDATA|USERPROFILE)$/i.test(k)));
Object.assign(env,{DATABASE_URL:'file:'+runtime.database.replaceAll('\\','/'),ACADEMIC_ARCHIVE_RUNTIME:path.join(root,'runtime.json'),SESSION_SECRET:'synthetic-capacity-only-2026',HOST:'127.0.0.1',NODE_ENV:'production',CI:'true',CHECKPOINT_DISABLE:'1',ARCHIVE_BACKUP_ROOT:path.join(root,'artifacts'),PRISMA_HIDE_UPDATE_MESSAGE:'1'});
let db,lockDb,isolation,port,backend;
const jobs=[],proof={runId:runtime.runId,host:process.platform,node:process.version,source,lateOnly,configurationHttp,poolOne,journalWal,experiments:[],loads:[]};
const print=value=>console.log('CAPACITY '+JSON.stringify(value));
async function launch(args,label){
  const log=fs.createWriteStream(ownedFile(root,label+'.log'),{flags:'wx',mode:0o600});
  return launchOwned(args,{cwd:root,env,onState:state=>jobs.push({state,label,log}),onOutput:t=>log.write(t)});
}
async function bounded(state,ms=300000){let timer;try{return await Promise.race([state.finished,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Diagnostic phase deadline')),ms);})]);}finally{clearTimeout(timer);}}
async function freePort(){const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const p=server.address().port;await new Promise(r=>server.close(r));return p;}

// Instrumentation is injected into the disposable bundle; repository product
// sources are not modified. No SQL text, parameters, cookies or bodies logged.
const banner=`const diagALS=new (require('node:async_hooks').AsyncLocalStorage)();
const diagFs=require('node:fs');
globalThis.__capacity={als:diagALS,emit:e=>diagFs.appendFileSync(${JSON.stringify(path.join(root,'timeline.jsonl'))},JSON.stringify({...e,at:Date.now()})+'\\n')};`;
const requestHook=`app.use((req,res,next)=>{
 const id=String(req.headers['x-capacity-request']||'unmeasured');
 const ctx={id,url:req.path,variant:req.headers['x-capacity-variant']||'current',start:Date.now(),ops:[]};
 if(id==='unmeasured')return next();
 globalThis.__capacity.als.run(ctx,()=>{
   const original=res.json.bind(res);
   res.json=value=>{globalThis.__capacity.emit({kind:'json',id,elapsedMs:Date.now()-ctx.start,ops:ctx.ops});return original(value);};
   res.once('finish',()=>globalThis.__capacity.emit({kind:'finish',id,status:res.statusCode,elapsedMs:Date.now()-ctx.start}));
   res.once('close',()=>globalThis.__capacity.emit({kind:'close',id,finished:res.writableFinished,elapsedMs:Date.now()-ctx.start}));
   next();
 });
});`;
const storageHook=`prisma.$use(async(params,next)=>{
 const ctx=globalThis.__capacity.als.getStore(),start=Date.now();
 if(ctx?.url==='/api/results' && ctx.variant==='page100' && params.model==='StudentResult' && params.action==='findMany'){
   params.args.take=100;params.args.orderBy=[{submittedAt:'desc'},{id:'desc'}];
 }
 let code=null;try{return await next(params);}catch(e){code=e.code||e.name;throw e;}finally{
   if(ctx){const op={model:params.model,action:params.action,ms:Date.now()-start,code};ctx.ops.push(op);globalThis.__capacity.emit({kind:'orm',id:ctx.id,...op});}
 }
});
globalThis.__capacity.dashboard=async(teacherId)=>{
 const active={academicYear:null,status:{not:'archived'}};
 const classes=await prisma.class.findMany({where:{OR:[{teachers:{some:{id:teacherId}}},{classTeacherId:teacherId},{teacherAssignments:{some:{teacherId}}}]},select:{id:true}});
 const totalStudents=await prisma.user.count({where:{role:'student',isActive:true,classId:{in:classes.map(c=>c.id)}}});
 const totalQuizzes=await prisma.quiz.count({where:{...active,createdBy:teacherId}});
 const where={academicYear:null,quiz:{...active,createdBy:teacherId}};
 const totalResults=await prisma.studentResult.count({where});
 const scores=await prisma.studentResult.aggregate({where:{...where,status:'completed',score:{not:null}},_avg:{score:true}});
 return {totalQuizzes,totalResults,totalStudents,averageStudentScore:Math.round(scores._avg.score||0)};
};`;
const clientConstructor=`new PrismaClient({${poolOne?"datasources:{db:{url:process.env.DATABASE_URL+'?connection_limit=1'}},":""}log:[{emit:'event',level:'info'}]})`;
const poolInfo=label=>`.$on('info',e=>globalThis.__capacity.emit({kind:'pool-info',client:${JSON.stringify(label)},message:e.message}));`;

async function client(actor){
  let cookie='',csrf='';
  const request=async(url,{method='GET',body,variant='current',id,deadline=30000}={})=>{
    assert.ok(url.startsWith('/api/')&&!url.includes('://'));
    const response=await fetch(runtime.origin+url,{method,redirect:'error',signal:AbortSignal.timeout(deadline),headers:{cookie,'x-csrf-token':csrf,Origin:runtime.origin,'content-type':'application/json',...(id?{'x-capacity-request':id,'x-capacity-variant':variant}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const cookies=response.headers.getSetCookie();if(cookies.length)cookie=cookies.map(v=>v.split(';')[0]).join('; ');
    const text=await response.text();return {status:response.status,bytes:Buffer.byteLength(text),body:JSON.parse(text)};
  };
  csrf=(await request('/api/csrf-token')).body.csrfToken;
  assert.equal((await request('/api/auth/login',{method:'POST',body:{email:actor.email,password:runtime.fixture.password}})).status,200);
  csrf=(await request('/api/csrf-token')).body.csrfToken;
  assert.equal((await request('/api/auth/me')).body.user.id,actor.id);
  return request;
}
async function measured(request,url,options={}){
 const start=performance.now(),at=Date.now(),id=crypto.randomUUID();
 let result,error;
 try{result=await request(url,{...options,id});}catch(e){error=e.name;}
 return {sample:{id,url,variant:options.variant||'current',start:at,end:Date.now(),ms:performance.now()-start,status:result?.status||0,bytes:result?.bytes||0,ok:result?.status===200,error},result};
}
function timeline(){return fs.readFileSync(ownedFile(root,'timeline.jsonl',true),'utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));}
async function waitCompleted(ids,ms=90000){
 const until=Date.now()+ms;
 while(Date.now()<until){const events=timeline();if(ids.every(id=>events.some(e=>e.id===id&&e.kind==='json')))return events;await new Promise(r=>setTimeout(r,100));}
 throw Error('Server completion was not proved before phase reuse');
}
function detail(sample,events){const rows=events.filter(e=>e.id===sample.id),json=rows.find(e=>e.kind==='json');return {...sample,serverMs:json?.elapsedMs,ormCalls:json?.ops.length,ormMs:json?.ops.reduce((n,op)=>n+op.ms,0),operations:json?.ops,closedBeforeResponse:rows.some(e=>e.kind==='close'&&!e.finished)};}

try{
 if(journalWal){
   const initial=new sqlite.Database(runtime.database);
   try{await new Promise((resolve,reject)=>initial.get('PRAGMA journal_mode=WAL',(error,row)=>error?reject(error):row.journal_mode==='wal'?resolve():reject(Error('Fresh fixture WAL rejected'))));}
   finally{await new Promise((resolve,reject)=>initial.close(error=>error?reject(error):resolve()));}
 }
 // Guard Prisma's automatic dotenv lookup in the CLI subprocess as well.
 const migrationGuard=ownedFile(root,'migration-guard.mjs');
 fs.writeFileSync(migrationGuard,`const g=await import(${JSON.stringify(pathToFileURL(path.join(repo,'scripts/academic-fixture-email.mjs')).href)});g.isolateAcademicFixture();`,{flag:'wx',mode:0o600});
 const migration=await launch(['--import',pathToFileURL(migrationGuard).href,req.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.join(root,'server/prisma/schema.prisma')],'migration');
 assert.equal(await bounded(migration),0);await cleanupOwned(migration);
 Object.assign(process.env,{DATABASE_URL:env.DATABASE_URL,ACADEMIC_ARCHIVE_RUNTIME:env.ACADEMIC_ARCHIVE_RUNTIME});
 const guard=await import('./academic-fixture-email.mjs');isolation=guard.isolateAcademicFixture();
 const {PrismaClient}=req('@prisma/client');db=new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}});
 runtime.fixture=await seedPerformance(db,repo);proof.fixture=runtime.fixture.counts;
 if(journalWal)assert.equal((await db.$queryRawUnsafe('PRAGMA journal_mode=WAL'))[0].journal_mode,'wal');
 proof.databaseSettings={};for(const name of ['journal_mode','busy_timeout','synchronous'])proof.databaseSettings[name]=JSON.parse(JSON.stringify(await db.$queryRawUnsafe('PRAGMA '+name),(_,v)=>typeof v==='bigint'?Number(v):v));
 port=await freePort();runtime.origin='http://127.0.0.1:'+port;
 Object.assign(env,{PORT:String(port),FRONTEND_URL:runtime.origin,ALLOWED_ORIGINS:runtime.origin});
 fs.writeFileSync(ownedFile(root,'runtime.json',true),JSON.stringify(runtime));
 readPerformanceRuntime(repo,path.join(root,'runtime.json'),{runId:runtime.runId});
 const entry=ownedFile(root,'server/capacity-backend.cjs');
 await req('esbuild').build({entryPoints:[path.join(repo,'server/index.ts')],outfile:entry,bundle:true,packages:'external',platform:'node',target:'node22',format:'cjs',logLevel:'silent',banner:{js:banner},plugins:[{name:'disposable-diagnostics',setup(build){
   build.onLoad({filter:/server[\\/]index\.ts$/},args=>({contents:fs.readFileSync(args.path,'utf8').replace('const app = express();','const app = express();\n'+requestHook),loader:'ts'}));
   build.onLoad({filter:/server[\\/]storage\.ts$/},args=>({contents:fs.readFileSync(args.path,'utf8').replace('const prisma = new PrismaClient();','const prisma = '+clientConstructor+';\nprisma'+poolInfo('storage')+'\n'+storageHook),loader:'ts'}));
   build.onLoad({filter:/services[\\/]archive-db\.ts$/},args=>({contents:fs.readFileSync(args.path,'utf8').replace('export const archiveDb = new PrismaClient();','export const archiveDb = '+clientConstructor+';\narchiveDb'+poolInfo('archive')+'\n'),loader:'ts'}));
   build.onLoad({filter:/api-routes[\\/]dashboard\.ts$/},args=>({contents:fs.readFileSync(args.path,'utf8').replace("    const teacherId = req.user!.id;","    const teacherId = req.user!.id;\n    if(req.headers['x-capacity-variant']==='aggregate')return res.json({stats:await globalThis.__capacity.dashboard(teacherId)});"),loader:'ts'}));
 }}]});
 const preload=ownedFile(root,'preload.mjs');
 fs.writeFileSync(preload,`import {createRequire} from 'node:module';const g=await import(${JSON.stringify(pathToFileURL(path.join(repo,'scripts/academic-fixture-email.mjs')).href)});g.isolateAcademicFixture();const r=createRequire(${JSON.stringify(path.join(repo,'server/package.json'))});g.disableAcademicFixtureEmailDelivery(r('nodemailer'));await import(${JSON.stringify(pathToFileURL(entry).href)});`,{flag:'wx',mode:0o600});
 backend=await launch([preload],'backend');await waitForAuditServer(runtime.origin+'/api/csrf-token',backend);
 print({phase:'fresh-fixture-ready',rows:runtime.fixture.businessRows});
 const clients=[];
 if(!lateOnly){
 const admin=await client(runtime.fixture.actors[0]),teacher=await client(runtime.fixture.actors[1]);
 if(!configurationHttp){
 for(let round=0;round<3;round++){
   const full=await measured(admin,'/api/results'),page=await measured(admin,'/api/results',{variant:'page100'});
   assert.equal(full.result.body.results.length,8000);assert.equal(page.result.body.results.length,100);
   const ids=new Set(full.result.body.results.map(r=>r.id));assert.ok(page.result.body.results.every(r=>ids.has(r.id)));
   const current=await measured(teacher,'/api/dashboard/stats'),aggregate=await measured(teacher,'/api/dashboard/stats',{variant:'aggregate'});
   assert.deepEqual(current.result.body,aggregate.result.body);
   const samples=[full,page,current,aggregate].map(x=>x.sample);const events=await waitCompleted(samples.map(s=>s.id));
   proof.experiments.push({round,results: samples.map(s=>detail(s,events)),dashboard:current.result.body.stats,resultCounts:{full:8000,page:100}});
 }
 print({phase:'single-request-ab',experiments:proof.experiments});
 }

 for(let n=0;n<20;n++)clients.push({actor:runtime.fixture.writerActors[n],writer:await client(runtime.fixture.writerActors[n]),reader:await client(runtime.fixture.actors[n%4]),role:runtime.fixture.actors[n%4].role});
 const paths={admin:['/api/quizzes','/api/classes','/api/results'],teacher:['/api/quizzes','/api/classes','/api/dashboard/stats'],student:['/api/student/quizzes','/api/student/results'],parent:['/api/parents/students','/api/notifications']};
 for(const [mode,count,variant] of (configurationHttp?[['mixed',20,'current'],['writes',20,'current']]:[['mixed',2,'current'],['mixed',8,'current'],['mixed',20,'current'],['mixed',20,'page100'],['writes',20,'current']])){
   const samples=[],expected=new Map();
   await db.user.updateMany({where:{id:{in:clients.map(c=>c.actor.id)}},data:{notificationMuted:false}});
   await Promise.all(clients.slice(0,count).map(async(c,n)=>{
     let muted=false;
     for(let i=0;i<30;i++){
       const write=mode==='writes'||i%2===1,url=write?'/api/notifications/preferences':paths[c.role][Math.floor(i/2)%paths[c.role].length];
       if(write)muted=!muted;
       const measuredResult=await measured(write?c.writer:c.reader,url,{method:write?'PATCH':'GET',body:write?{muted}:undefined,variant});
       const s=measuredResult.sample;s.actor=n;s.write=write;
       if(write&&s.ok){s.ok=measuredResult.result.body.muted===muted;if(s.ok)expected.set(c.actor.id,muted);}
       samples.push(s);
     }
   }));
   const events=await waitCompleted(samples.map(s=>s.id));
   const mismatches=[];for(const [id,muted] of expected){const actual=await db.user.findUniqueOrThrow({where:{id},select:{notificationMuted:true}});if(actual.notificationMuted!==muted)mismatches.push({actor:clients.findIndex(c=>c.actor.id===id),expected:muted,actual:actual.notificationMuted});}
   const endpoints={};for(const url of new Set(samples.map(s=>s.url)))endpoints[url]=summarize(samples.filter(s=>s.url===url));
   const elapsedMs=Math.max(...samples.map(s=>s.end))-Math.min(...samples.map(s=>s.start));
   const load={mode,count,variant,...summarize(samples),elapsedMs,qps:samples.length/(elapsedMs/1000),mismatches,endpoints,samples:samples.map(s=>detail(s,events))};
   proof.loads.push(load);exclusiveJson(root,`load-${mode}-${count}-${variant}.json`,load);
   print({phase:'load',mode,count,variant,...summarize(samples),elapsedMs,qps:load.qps,mismatches});
 }

 // Separate scale experiment, after the comparable original mixed workload.
 // Only synthetic assignments change; this is not the original 20-actor run.
 if(!configurationHttp){
 const broadTeacher=await db.user.findUniqueOrThrow({where:{email:'teacher59@performance.test'},select:{id:true,email:true,role:true}});
 await db.class.updateMany({data:{classTeacherId:broadTeacher.id}});
 await db.quiz.updateMany({data:{createdBy:broadTeacher.id}});
 const broadClient=await client(broadTeacher);
 proof.dashboardScale=[];
 for(let round=0;round<3;round++){
   const current=await measured(broadClient,'/api/dashboard/stats'),aggregate=await measured(broadClient,'/api/dashboard/stats',{variant:'aggregate'});
   assert.deepEqual(current.result.body,aggregate.result.body);
   const samples=[current.sample,aggregate.sample],events=await waitCompleted(samples.map(s=>s.id));
   proof.dashboardScale.push({round,classes:40,quizzes:121,stats:current.result.body.stats,results:samples.map(s=>detail(s,events))});
 }
 print({phase:'dashboard-scale',results:proof.dashboardScale});
 }
 }

 // Controlled transport deadline (250ms), not the earlier 30s capacity failure.
 // Hold a real SQLite writer lock; require an actual UPDATE to start while held.
 if(!configurationHttp){
 lockDb=new sqlite.Database(runtime.database);
 const sql=text=>new Promise((resolve,reject)=>lockDb.exec(text,error=>error?reject(error):resolve()));
 const actor=clients[0]||{actor:runtime.fixture.writerActors[0],writer:await client(runtime.fixture.writerActors[0])};
 await db.user.update({where:{id:actor.actor.id},data:{notificationMuted:false}});
 await sql('BEGIN IMMEDIATE');
 const latePromise=measured(actor.writer,'/api/notifications/preferences',{method:'PATCH',body:{muted:true},deadline:250});
 let late;
 try{late=await latePromise;assert.equal(late.sample.status,0);await new Promise(r=>setTimeout(r,750));}finally{await sql('COMMIT');}
 const events=await waitCompleted([late.sample.id]);
 const actual=await db.user.findUniqueOrThrow({where:{id:actor.actor.id},select:{notificationMuted:true}});
 assert.equal(actual.notificationMuted,true);
 const lateDetail=detail(late.sample,events);assert.ok(lateDetail.operations.some(op=>op.model==='User'&&op.action==='update'));
 const update=events.find(e=>e.id===late.sample.id&&e.kind==='orm'&&e.model==='User'&&e.action==='update'&&e.code===null);
 assert.ok(update&&update.at-update.ms<late.sample.end&&update.at>=late.sample.end,'UPDATE must span the client abort');
 assert.equal(lateDetail.closedBeforeResponse,true);assert.ok(lateDetail.serverMs>late.sample.ms);
 proof.lateWrite={...lateDetail,controlledDeadlineMs:250,lockHeldAfterAbortMs:750,persistedAfterAbort:true,scope:'controlled disconnect semantics; not a reproduction of the previous 30s capacity timeout'};
 print({phase:'controlled-late-write',...proof.lateWrite});
 }
 proof.poolInfo=timeline().filter(e=>e.kind==='pool-info');
 proof.integrity=await db.$queryRawUnsafe('PRAGMA integrity_check');
 assert.deepEqual(proof.integrity,[{integrity_check:'ok'}]);assert.equal((await db.$queryRawUnsafe('PRAGMA foreign_key_check')).length,0);
 proof.completed=true;
}catch(error){proof.failure={name:error.name,message:String(error.message).split('\n')[0].slice(0,180)};process.exitCode=1;print({phase:'failed',...proof.failure});}
finally{
 const cleanup=[],errors=[];
 if(lockDb)await new Promise(resolve=>lockDb.close(error=>{if(error)errors.push(error.code);resolve();}));
 if(db)try{await db.$disconnect();}catch(e){errors.push(e.name);}
 for(const {state,label,log} of jobs.reverse()){
   try{cleanup.push({label,...await cleanupOwned(state)});}catch(e){errors.push(label+':'+e.message);}
   await new Promise(resolve=>log.end(resolve));
 }
 const ports=port?await verifyFixturePortsReleased([port]):[];
 proof.protection={unchanged:protectedFiles.map(f=>hash(ownedFile(repo,f,true))).every((h,i)=>h===before[i]),hashes:before};
 proof.cleanup={processes:cleanup,ports,errors,clean:errors.length===0&&cleanup.every(p=>p.stopped)&&ports.every(p=>p.stopped)};
 proof.outboundIsolation=isolation?.state;
 exclusiveJson(root,'investigation.json',proof);
 isolation?.restore();
 print({evidence:path.join(root,'investigation.json'),completed:proof.completed||false,protectedUnchanged:proof.protection.unchanged,clean:proof.cleanup.clean});
 if(!proof.protection.unchanged||!proof.cleanup.clean)process.exitCode=1;
}
