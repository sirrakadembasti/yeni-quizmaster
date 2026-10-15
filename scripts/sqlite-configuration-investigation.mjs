// Isolate journal/pool effects using only a stopped, owned synthetic template.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import {ownedFile,noLinks,exclusiveJson,readPerformanceRuntime} from './production-performance-guard.mjs';
import {verifyFixturePortsReleased} from './linux-owned-process-cleanup.mjs';
import {isolateAcademicFixture} from './academic-fixture-email.mjs';
import {summarize} from './production-performance-http.mjs';
const repo=noLinks(path.resolve(import.meta.dirname,'..')),req=createRequire(path.join(repo,'server/package.json'));
const templateFile=process.argv[2]||path.join(repo,'server/data/quizmaster-test-academic-performance-pJnUx3/runtime.json');
const template=readPerformanceRuntime(repo,templateFile);
const prior=JSON.parse(fs.readFileSync(ownedFile(template.root,'investigation.json',true),'utf8'));
assert.equal(prior.runId,template.runId);assert.equal(prior.cleanup.clean,true);
assert.ok((await verifyFixturePortsReleased(prior.cleanup.ports.map(p=>p.port))).every(p=>p.stopped));
for(const suffix of ['-wal','-journal'])assert.equal(fs.existsSync(template.database+suffix),false,'Template must have no journal/WAL');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const protectedFiles=['client/src/lib/api.ts','client/src/pages/server-setup.tsx','server/data/quiz.db'];
const before=protectedFiles.map(f=>hash(ownedFile(repo,f,true))),templateHash=hash(template.database);
noLinks(path.join(repo,'server/data'));
const root=fs.mkdtempSync(path.join(repo,'server/data/quizmaster-test-academic-performance-'));
fs.mkdirSync(path.join(root,'server/data'),{recursive:true,mode:0o700});
for(const file of ['.env','server/.env'])fs.writeFileSync(ownedFile(root,file),'# isolated SQLite configuration probe\n',{flag:'wx',mode:0o600});
const runtime={root,database:path.join(root,'server/data/academic.db'),runId:crypto.randomUUID()};
fs.copyFileSync(template.database,runtime.database,fs.constants.COPYFILE_EXCL);
exclusiveJson(root,'runtime.json',runtime);readPerformanceRuntime(repo,path.join(root,'runtime.json'),{runId:runtime.runId});
assert.equal(hash(template.database),templateHash);
Object.assign(process.env,{DATABASE_URL:'file:'+runtime.database.replaceAll('\\','/'),ACADEMIC_ARCHIVE_RUNTIME:path.join(root,'runtime.json')});
const isolation=isolateAcademicFixture();
const {PrismaClient,Prisma}=req('@prisma/client');
const sqlite=createRequire(req.resolve('connect-sqlite3'))('sqlite3');
const normalize=value=>JSON.parse(JSON.stringify(value,(_,v)=>typeof v==='bigint'?Number(v):v));
const proof={runId:runtime.runId,versions:Prisma.prismaVersion,templateCopied:true,phases:[]};
let db;
const print=value=>console.log('SQLITE-CONFIG '+JSON.stringify(normalize(value)));
async function setJournal(mode){
 const native=new sqlite.Database(runtime.database);
 try{return await new Promise((resolve,reject)=>native.get('PRAGMA journal_mode='+mode,(error,row)=>error?reject(error):resolve(row)));}
 finally{await new Promise((resolve,reject)=>native.close(error=>error?reject(error):resolve()));}
}
try{
 for(const [journal,pool] of [['DELETE','default'],['DELETE',1],['WAL','default'],['WAL',1],['DELETE','default']]){
   const actualJournal=await setJournal(journal);assert.equal(actualJournal.journal_mode,journal.toLowerCase());
   const info=[],queries=[];
   db=new PrismaClient({datasources:{db:{url:process.env.DATABASE_URL+(pool===1?'?connection_limit=1':'')}},log:[{emit:'event',level:'info'},{emit:'event',level:'query'}]});
   db.$on('info',e=>info.push(e.message));
   db.$on('query',e=>queries.push({duration:e.duration,kind:e.query.trim().split(/\s+/)[0]}));
   const settings={};for(const name of ['journal_mode','busy_timeout','synchronous','locking_mode','wal_autocheckpoint'])settings[name]=normalize(await db.$queryRawUnsafe('PRAGMA '+name));
   const actors=await db.user.findMany({where:{role:'teacher'},orderBy:{id:'asc'},take:20,select:{id:true}});assert.equal(actors.length,20);
   await db.user.updateMany({where:{id:{in:actors.map(a=>a.id)}},data:{notificationMuted:false}});
   const samples=[];let retries=0;const errors={};const start=performance.now(),cpu=process.cpuUsage();
   const queryOffset=queries.length;
   await Promise.all(actors.map(async actor=>{
     for(let n=0;n<10;n++){
       const muted=n%2===0,at=performance.now();let ok=false,attempt=0;
       try{
         await db.user.findUniqueOrThrow({where:{id:actor.id}}); // Real auth read shape.
         for(;;){
           try{const result=await db.user.update({where:{id:actor.id},data:{notificationMuted:muted},select:{notificationMuted:true}});assert.equal(result.notificationMuted,muted);ok=true;break;}
           catch(e){errors[e.code||e.name]=(errors[e.code||e.name]||0)+1;if(attempt>=3||!['P1008','P2028','P2034'].includes(e.code))throw e;retries++;await new Promise(r=>setTimeout(r,50*(++attempt)));}
         }
       }catch{}
       samples.push({ms:performance.now()-at,status:ok?200:0,ok});
     }
   }));
   const elapsedMs=performance.now()-start,endCpu=process.cpuUsage(cpu);
   const final=await db.user.findMany({where:{id:{in:actors.map(a=>a.id)}},select:{notificationMuted:true}});
   const result={journal,pool,settings,info,...summarize(samples),elapsedMs,qps:samples.length/(elapsedMs/1000),retries,ormErrorCodes:errors,finalFalse:final.filter(a=>!a.notificationMuted).length,cpuMs:(endCpu.user+endCpu.system)/1000,queryEvents:queries.length-queryOffset,queryDurationMs:queries.slice(queryOffset).reduce((n,e)=>n+e.duration,0)};
   proof.phases.push(result);print(result);
   await db.$disconnect();db=null;
 }
 db=new PrismaClient({datasources:{db:{url:process.env.DATABASE_URL+'?connection_limit=1'}}});
 assert.deepEqual(await db.$queryRawUnsafe('PRAGMA integrity_check'),[{integrity_check:'ok'}]);
 assert.equal((await db.$queryRawUnsafe('PRAGMA foreign_key_check')).length,0);
 proof.integrity=true;proof.completed=true;
}catch(e){proof.failure={name:e.name,code:e.code,message:String(e.message).split('\n')[0]};process.exitCode=1;}
finally{
 if(db)await db.$disconnect();
 proof.protectedUnchanged=protectedFiles.map(f=>hash(ownedFile(repo,f,true))).every((h,i)=>h===before[i]);
 proof.templateUnchanged=hash(template.database)===templateHash;
 exclusiveJson(root,'configuration-investigation.json',normalize(proof));
 isolation.restore();print({evidence:path.join(root,'configuration-investigation.json'),completed:proof.completed||false,protectedUnchanged:proof.protectedUnchanged,templateUnchanged:proof.templateUnchanged});
 if(!proof.protectedUnchanged||!proof.templateUnchanged)process.exitCode=1;
}
