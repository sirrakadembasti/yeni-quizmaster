import express from 'express';
import session from 'express-session';
import request from 'supertest';
import {afterAll,beforeAll,expect,it,vi} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
vi.mock('../../services/archive-db',()=>({archiveDb:{}}));
vi.mock('../../middleware/auth',()=>({requireAuth:(req:any,_res:any,next:any)=>{req.user={id:'volume-admin',role:'admin'};req.session.userId='volume-admin';next();},requireRole:()=> (_req:any,_res:any,next:any)=>next()}));
import {captureArchive} from '../../services/archive-capture';
import {createArchiveWorker} from '../../services/archive-worker';
import {createAcademicHistoryRouter} from '../../api-routes/academic-history';
import {exportArchive,verifyArchiveArtifact} from '../../services/archive-export';
import {HISTORY_PROJECTION_VERSION,warmHistoryProjection} from '../../services/archive-history-projection';

interface Phase {status:string;durationMs:number;cpuUserMs:number;cpuSystemMs:number;rssStartBytes:number;rssPeakBytes:number;queries:number;returnedJsonRows:number;returnedJsonBytes:number;error?:{name:string;code?:string;timeout:boolean;operation?:string}}
const results:Array<Record<string,unknown>>=[];
const warmSteps=new Map<number,()=>Promise<void>>();
const profiling=process.env.ARCHIVE_VOLUME_PROFILE==='1';
function queryKind(sql:string){
  if(sql.includes('(entityType,entityId)>'))return 'page';
  if(sql.startsWith('SELECT json_type'))return 'lookup';
  if(sql.startsWith('INSERT OR IGNORE INTO ArchiveHistoryProjection'))return 'projection';
  if(sql.startsWith('INSERT OR IGNORE INTO ArchiveHistoryReady'))return 'publish';
  return 'other';
}
let template:string;
beforeAll(()=>{template=process.env.DATABASE_URL!.slice(5);if(!path.basename(path.dirname(template)).startsWith('quizmaster-test-'))throw new Error('Disposable archive volume database required');});
afterAll(async()=>{
  const directory=path.resolve(__dirname,'../../../.superpowers/sdd/2026-10-05-academic-archive-review-plan');
  const tag=profiling?'profile':process.env.ARCHIVE_VOLUME_RUN==='green'?'green':'baseline';
  await mkdir(directory,{recursive:true});
  for(const report of results)for(const [phase,value] of Object.entries((report as any).phases))if((value as any).status==='unavailable')console.log('ARCHIVE_VOLUME',JSON.stringify({target:report.target,phase,status:'unavailable'}));
  const file=path.join(directory,`task-6-volume-${tag}.json`);let previous:Array<Record<string,unknown>>=[];
  try{previous=JSON.parse(await readFile(file,'utf8')).results??[];}catch{/* First measurement has no earlier scales to retain. */}
  const currentTargets=new Set(results.map(report=>report.target));
  const combined=[...previous.filter(report=>!currentTargets.has(report.target)),...results].sort((a,b)=>Number(a.target)-Number(b.target));
  await writeFile(file,JSON.stringify({transactionBudgetMs:120000,fixtureBudgetMs:360000,fixtureBudgetScope:'archive lifecycle and separate first-version legacy warm each have a 360s bound',artifactPdfBudgetMs:30000,cpuRssScope:'current Node process only; excludes separate Prisma/Chromium processes',finalizationArtifact:'synthetic verified dependency isolates real database finalization; separately measured artifacts use actual Chromium PDF/ZIP/verification',historyMetadata:'matching completed-year router fixture; actual captured rows and SQLite queries',results:combined},null,2));
});
async function batches<T>(values:T[],fn:(batch:T[])=>Promise<unknown>){for(let start=0;start<values.length;start+=1000)await fn(values.slice(start,start+1000));}

for(const target of [1000,10000,50000]){
it(`measures real capture finalization and bounded history at ${target} synthetic rows`,async()=>{
  const copy=path.join(path.dirname(template),'volume-'+target+'-'+randomUUID()+'.db');await copyFile(template,copy);
  const db=new PrismaClient({datasources:{db:{url:'file:'+copy.split('\\').join('/')}},log:[{emit:'event',level:'query'}]});
  const report:any={target,seedMethod:'one 120s transaction with createMany batches of 1000; Prisma manages SQL parameter chunks',phases:{seed:{status:'unavailable'},capture:{status:'unavailable'},artifacts:{status:'unavailable'},finalization:{status:'unavailable'},pagination:{status:'unavailable'},search:{status:'unavailable'}}};results.push(report);
  let queries=0,returnedJsonRows=0,returnedJsonBytes=0;
  (db as any).$on('query',(event:any)=>{
    queries++;
    const progress=report.legacyWarmProgress;
    if(progress&&report.phases.legacyProjectionWarm?.status==='running'){
      const kind=queryKind(event.query);
      progress.queryCounts[kind]=(progress.queryCounts[kind]??0)+1;
      progress.sqlDurationMs[kind]=(progress.sqlDurationMs[kind]??0)+event.duration;
      if(event.duration>progress.slowestSql.durationMs)progress.slowestSql={kind,durationMs:event.duration};
    }
  });
  db.$use(async(params,next)=>{const value=await next(params);if(Array.isArray(value)&&(params.model==='ArchiveSnapshotRow'||params.action==='queryRaw'))for(const row of value){const candidate=[row?.dataJson,row?.json,row?.rowJson].find(value=>typeof value==='string');if(candidate!==undefined||params.action==='queryRaw'){returnedJsonRows++;returnedJsonBytes+=Buffer.byteLength(candidate??JSON.stringify(row,(_key,value)=>typeof value==='bigint'?String(value):value));}}return value;});
  const measure=async<T>(name:string,fn:()=>Promise<T>,rethrow=false)=>{
    const start=performance.now(),cpu=process.cpuUsage(),rss=process.memoryUsage().rss,queryStart=queries,rowStart=returnedJsonRows,byteStart=returnedJsonBytes;
    let peak=rss;const sampling=setInterval(()=>{peak=Math.max(peak,process.memoryUsage().rss);},20);
    const phase:Phase={status:'running',durationMs:0,cpuUserMs:0,cpuSystemMs:0,rssStartBytes:rss,rssPeakBytes:rss,queries:0,returnedJsonRows:0,returnedJsonBytes:0};report.phases[name]=phase;
    try{const value=await fn();phase.status='completed';return value;}catch(error:any){phase.status='failed';phase.error={name:error?.name??'Error',code:typeof error?.code==='string'?error.code:undefined,timeout:/timed|timeout|expired/i.test(String(error)),operation:/browserType\.launch|browser\.newPage|page\.setContent|page\.pdf|PDF generation timeout/.exec(String(error))?.[0]};if(rethrow)throw error;return undefined;}
    finally{clearInterval(sampling);const used=process.cpuUsage(cpu);Object.assign(phase,{durationMs:performance.now()-start,cpuUserMs:used.user/1000,cpuSystemMs:used.system/1000,rssPeakBytes:Math.max(peak,process.memoryUsage().rss),queries:queries-queryStart,returnedJsonRows:returnedJsonRows-rowStart,returnedJsonBytes:returnedJsonBytes-byteStart});console.log('ARCHIVE_VOLUME',JSON.stringify({target,phase:name,...phase}));}
  };
  try{
    const seeded=await measure('seed',()=>db.$transaction(async tx=>{
    const teacher=await tx.user.create({data:{id:randomUUID(),name:'Frozen Volume Teacher',email:randomUUID()+'@example.test',password:'synthetic-secret-must-not-export',role:'teacher'}});
    const count=Math.floor(target/10),studentIds=Array.from({length:count},()=>randomUUID()),quizIds=Array.from({length:count},()=>randomUUID());
    await batches(studentIds,(ids)=>tx.user.createMany({data:ids.map((id,index)=>({id,name:(index%2?'IĞDIR':'İZMİR')+' Frozen Student '+id,email:id+'@example.test',password:'synthetic-secret-must-not-export',role:'student'}))}));
    await batches(quizIds,(ids)=>tx.quiz.createMany({data:ids.map((id,index)=>({id,title:'Frozen Volume '+id,createdBy:teacher.id,contentType:index%5?'exam':'survey'}))}));
    await batches(quizIds,(ids)=>tx.question.createMany({data:ids.map(id=>({id:randomUUID(),quizId:id,text:'Frozen question '+id,type:'short-answer',correctAnswer:'answer',order:0}))}));
    const resultCount=target-count*3;
    const records=Array.from({length:resultCount},(_,index)=>({id:randomUUID(),studentId:studentIds[index%count],quizId:quizIds[index%count],score:80,status:'completed',answers:'{"answer":"frozen"}'}));
    await batches(records,(data)=>tx.studentResult.createMany({data}));
    const year=await tx.academicYear.create({data:{label:'2025-2026',opensAt:new Date(),scheduledCloseAt:new Date('2099-07-15T00:05:00Z')}});
    const job=await tx.archiveSnapshot.create({data:{academicYearId:year.id,label:year.label,mode:'annual',scopeJson:'{}'}});
    return {year,job,resultCount};
    },{maxWait:10000,timeout:120000}));
    expect(seeded).toBeDefined();
    const {year,job,resultCount}=seeded!;
    const captured=await measure('capture',()=>captureArchive(db,job.id));
    if(captured){
      report.actualFrozenRows=await db.archiveSnapshotRow.count({where:{snapshotId:job.id}});
      // Only lifecycle metadata is supplied; data reads/joins/search remain real SQLite.
      const routerDb=new Proxy(db,{get(target,key){if(key==='academicYear')return {findUnique:async()=>({...year,status:'closed',snapshotId:job.id})};if(key==='archiveSnapshot')return {findUnique:async()=>({...captured,status:'completed'})};return Reflect.get(target,key);}});
      const app=express();app.use(session({secret:'synthetic-volume-session',resave:false,saveUninitialized:false}));app.use('/history',createAcademicHistoryRouter({db:routerDb}));
      const page=await measure('pagination',async()=>{const response=await request(app).get(`/history/years/${year.id}/rows?type=result&pageSize=100&page=2&statistics=true`);expect(response.status).toBe(200);return response.body;});
      const searched=await measure('search',async()=>{const response=await request(app).get(`/history/years/${year.id}/rows?type=result&pageSize=25&search=izmir`);expect(response.status).toBe(200);return response.body;});
      if(page){expect(page.rows).toHaveLength(100);expect(page.counts.result).toBe(resultCount);expect(page.statistics.averageScore).toBe(80);}
      if(searched){expect(searched.pagination.total).toBe(resultCount/2);expect(searched.rows.every((row:any)=>row.studentName.startsWith('İZMİR'))).toBe(true);}
      await measure('artifacts',async()=>{
        const rows=await db.archiveSnapshotRow.findMany({where:{snapshotId:job.id},orderBy:[{entityType:'asc'},{entityId:'asc'}]});
        expect(rows.some(row=>row.dataJson.includes('synthetic-secret-must-not-export'))).toBe(false);
        const input={id:job.id,label:job.label,createdAt:job.createdAt,capturedAt:captured.capturedAt,initiatedBy:job.initiatedBy,rows};
        const root=path.join(path.dirname(copy),'real-artifacts-'+target);
        // Diagnostic runs isolate backfill cost; they are never real PDF proof.
        const actual=await exportArchive(input,root,profiling?{pdfGenerator:async()=>Buffer.from('%PDF-1.4\nDIAGNOSTIC FIXTURE ONLY\n%%EOF\n')}:{});expect(await verifyArchiveArtifact(input,root)).toEqual(actual);
        report.artifactGenerator=profiling?'diagnostic-stub-pdf':'actual-chromium';
        report.artifact={rows:rows.length,sizeBytes:actual.sizeBytes,zipSha256:actual.zipSha256,formatVersion:actual.meta.formatVersion};
      });
      const artifact={artifactPath:path.join(path.dirname(copy),'synthetic-verified.zip'),zipSha256:'a'.repeat(64),sizeBytes:100,meta:{} as any};
      await measure('finalization',async()=>{
        const errors:Array<{name:string;code?:string;timeout:boolean}>=[];
        const measuredDb=new Proxy(db,{get(target,key){if(key==='$transaction')return async(fn:any,options:any)=>target.$transaction((tx)=>options?.timeout===120000?measure('finalizationTransaction',()=>fn(tx),true):fn(tx),options);return Reflect.get(target,key);}});
        await createArchiveWorker({db:measuredDb,backupRoot:path.dirname(copy),export:async()=>artifact,verify:async()=>artifact,onError:(error:any)=>errors.push({name:error?.name??'Error',code:typeof error?.code==='string'?error.code:undefined,timeout:/timed|timeout|expired/i.test(String(error))})}).tick();
        const completed=await db.archiveSnapshot.findUniqueOrThrow({where:{id:job.id}});
        report.finalizationOutcome={status:completed.status,attempts:completed.attempts,errors,lastError:completed.lastError?{present:true,timeout:/timed|timeout|expired/i.test(completed.lastError),code:/\bP\d{4}\b/.exec(completed.lastError)?.[0]}:null};
        expect(completed.status).toBe('completed');expect(await db.studentResult.count({where:{academicYear:year.label}})).toBe(resultCount);
      });
      if(report.finalizationOutcome?.status==='completed'){
        // A first-version upgrade backfill is a separate operation from new
        // archive creation. Reuse only this actually completed owned snapshot;
        // give both experiments their existing bounds, without dropping proof.
        warmSteps.set(target,async()=>{
        try{
        await db.$connect();
        const progress=report.legacyWarmProgress={sourcePages:0,sourceRows:0,committedChunks:0,lastOperation:'not-started',queryCounts:{},sqlDurationMs:{},slowestSql:{kind:'none',durationMs:0}};
        const freshVersion=HISTORY_PROJECTION_VERSION+';first-warm-measurement';
        const adaptWarm=(target:any):any=>new Proxy(target,{get(target,key){
          if(key==='$queryRawUnsafe'||key==='$executeRawUnsafe')return async(sql:string,...values:any[])=>{
            const kind=queryKind(sql);progress.lastOperation=kind;
            const value=await target[key](sql,...values.map(value=>value===HISTORY_PROJECTION_VERSION?freshVersion:value));
            progress.lastOperation=kind+'-done';
            if(kind==='page'){progress.sourcePages++;progress.sourceRows+=value.length;}
            return value;
          };
          if(key==='$transaction')return async(callback:any,options:any)=>{
            const value=await target.$transaction((tx:any)=>callback(adaptWarm(tx)),options);
            progress.committedChunks++;
            if(progress.committedChunks%10===0)console.log('ARCHIVE_WARM_PROGRESS',JSON.stringify({target:report.target,...progress}));
            return value;
          };
          return Reflect.get(target,key);
        }});
        const warmDb=adaptWarm(db);
        expect(await db.$queryRawUnsafe('SELECT sourceRowId FROM ArchiveHistoryProjection WHERE snapshotId=? AND version=?',job.id,freshVersion)).toEqual([]);
        expect(await db.$queryRawUnsafe('SELECT rowCount FROM ArchiveHistoryReady WHERE snapshotId=? AND version=?',job.id,freshVersion)).toEqual([]);
        report.legacyWarmMethod='fresh version namespace on a genuinely completed immutable snapshot; same exact JS enrichment/fold, real off-request bounded backfill';
        await measure('legacyProjectionWarm',()=>warmHistoryProjection(warmDb,job.id));
        const warmed:any[]=await db.$queryRawUnsafe('SELECT count(*) AS n FROM ArchiveHistoryProjection WHERE snapshotId=? AND version=?',job.id,freshVersion);
        expect(Number(warmed[0].n)).toBe(report.actualFrozenRows);
        const ready:any[]=await db.$queryRawUnsafe('SELECT rowCount FROM ArchiveHistoryReady WHERE snapshotId=? AND version=?',job.id,freshVersion);
        expect(ready).toHaveLength(1);expect(Number(ready[0].rowCount)).toBe(report.actualFrozenRows);
        expect(report.phases.legacyProjectionWarm.status).toBe('completed');
        }finally{await db.$disconnect();}
        });
      }
    }
    // The acceptance is actual completion within the existing transaction budget,
    // and bounded payload transfer for a page. Metrics persist even on failure.
    expect(report.phases.capture.status).toBe('completed');expect(report.phases.finalization.status).toBe('completed');
    expect(report.phases.pagination.status).toBe('completed');expect(report.phases.search.status).toBe('completed');
    expect(report.phases.artifacts.status).toBe('completed');
    expect(report.phases.capture.durationMs).toBeLessThan(120000);expect(report.phases.finalizationTransaction.status).toBe('completed');expect(report.phases.finalizationTransaction.durationMs).toBeLessThan(120000);
    expect(report.phases.pagination.returnedJsonRows).toBeLessThanOrEqual(512);expect(report.phases.search.returnedJsonRows).toBeLessThanOrEqual(512);
  }finally{await db.$disconnect();}
},360000);
it(`warms legacy projection on the completed archive at ${target} synthetic rows`,async()=>{
  const warm=warmSteps.get(target);
  expect(warm,'The archive lifecycle must complete before the legacy upgrade measurement').toBeDefined();
  await warm!();
},360000);
}
