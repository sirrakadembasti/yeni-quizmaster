// Actual production HTTP/SQLite/Chromium acceptance, using only disposable data.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {deflateSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {launchOwned,cleanupOwned} from './academic-owned-process.mjs';
import {waitForAuditServer} from './audit-server-readiness.mjs';
import {verifyFixturePortsReleased} from './linux-owned-process-cleanup.mjs';
import {ownedFile,noLinks,exclusiveJson,readPerformanceRuntime} from './production-performance-guard.mjs';
import {seedPerformance} from './production-performance-seed.mjs';
import {bundleMetrics} from './production-performance-bundle.mjs';
import {actorClient,summarize} from './production-performance-http.mjs';
import {browserApi} from './production-performance-browser-api.mjs';
const repo=path.resolve(import.meta.dirname,'..'),req=createRequire(path.join(repo,'server/package.json')),rootReq=createRequire(path.join(repo,'package.json'));
const phase=process.argv[2];if(!['baseline','baseline-resume','after','ui','ui-offline','base','archive','roles'].includes(phase))throw Error('Select baseline/after/ui/base/archive/roles');
const main=path.resolve(process.argv[3]);noLinks(main);
const plan=path.join(repo,'.superpowers/sdd/2026-10-06-production-rehearsal-plan'),pointer=ownedFile(plan,'task4-fixture.json');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const protectedFiles=['client/src/lib/api.ts','client/src/pages/server-setup.tsx','server/data/quiz.db'];
const protectedBefore=protectedFiles.map(f=>hash(ownedFile(main,f,true)));
assert.deepEqual(protectedBefore,['de94a69161d940db1e10268fb95120da5a77325dbd3b90e3b26774f30a41831c','3e2d02a470166cc33df798c2316b1345ea0a9e7c2467ccc6c4bdd95703b459cb','8210a4b79f2cfb9cf74de6a4989f5c8a5449ba1d17b2332abdbd018c3741a158']);
noLinks(path.join(repo,'server/data'));noLinks(plan);
let root,runtime;
if(phase==='baseline'){
 root=fs.mkdtempSync(path.join(repo,'server/data/quizmaster-test-academic-performance-'));
 fs.chmodSync(root,0o700);
 for(const dir of ['server/data','server/uploads','server/prisma','client','artifacts'])fs.mkdirSync(path.join(root,dir),{recursive:true,mode:0o700});
 for(const file of ['package.json','server/package.json','client/package.json'])fs.writeFileSync(ownedFile(root,file),'{}',{flag:'wx',mode:0o600});
 for(const file of ['.env','server/.env'])fs.writeFileSync(ownedFile(root,file),'# synthetic performance only\n',{flag:'wx',mode:0o600});
 fs.copyFileSync(ownedFile(repo,'server/prisma/schema.prisma',true),ownedFile(root,'server/prisma/schema.prisma'));
 fs.cpSync(path.join(repo,'server/prisma/migrations'),path.join(root,'server/prisma/migrations'),{recursive:true,errorOnExist:true,force:false});
 runtime={root,database:path.join(root,'server/data/academic.db'),runId:crypto.randomUUID()};exclusiveJson(plan,'task4-fixture.json',runtime);
}else{
 runtime=JSON.parse(fs.readFileSync(ownedFile(plan,'task4-fixture.json',true),'utf8'));root=runtime.root;
 noLinks(root);if(path.dirname(root)!==path.join(repo,'server/data')||!path.basename(root).startsWith('quizmaster-test-academic-performance-')||runtime.database!==path.join(root,'server/data/academic.db'))throw Error('Fixture reuse identity rejected');
 runtime=readPerformanceRuntime(repo,path.join(root,'runtime.json'),{runId:runtime.runId});
}
const evidence=path.join(plan,'task4-private',phase+'-'+crypto.randomUUID());noLinks(evidence);fs.mkdirSync(evidence,{recursive:true,mode:0o700});
const write=(name,value)=>exclusiveJson(evidence,name+'.json',value),jobs=[],resources=[];let ports=[],browser,db,monitor,isolation;
const osEnv=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|HOME|SYSTEMROOT|WINDIR|TMP|TEMP|LOCALAPPDATA|USERPROFILE)$/i.test(k)));
const env={...osEnv,CI:'true',DATABASE_URL:'file:'+runtime.database.replaceAll('\\','/'),SESSION_SECRET:'performance-fixture-local-only-secret-2026',HOST:'127.0.0.1',NODE_ENV:'production',CHECKPOINT_DISABLE:'1',PRISMA_HIDE_UPDATE_MESSAGE:'1',ACADEMIC_ARCHIVE_RUNTIME:path.join(root,'runtime.json'),ARCHIVE_BACKUP_ROOT:path.join(root,'artifacts')};
const print=message=>console.log('PERFORMANCE '+message);
async function launch(args,label,cwd=root){
 const log=fs.createWriteStream(ownedFile(evidence,label+'.log'),{flags:'wx',mode:0o600});let state;
 try{state=await launchOwned(args,{cwd,env,onState:s=>{state=s;jobs.push({state,label,log});},onOutput:t=>log.write(t)});return state;}
 catch(e){if(state)await cleanupOwned(state);await new Promise(r=>log.end(r));throw e;}
}
async function bounded(state,ms=240000){let timer;try{return await Promise.race([state.finished,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned phase deadline')),ms);})]);}finally{clearTimeout(timer);}}
async function command(args,label){const start=Date.now(),state=await launch(args,label);const code=await bounded(state);await cleanupOwned(state);write(label,{code,elapsedMs:Date.now()-start,stopped:state.stopped});assert.equal(code,0);}
async function freePort(){const s=net.createServer();await new Promise((r,j)=>{s.once('error',j);s.listen(0,'127.0.0.1',r);});const port=s.address().port;await new Promise(r=>s.close(r));return port;}
function diagram(){const width=240,height=160,raw=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++){raw[y*(width*4+1)]=0;for(let x=0;x<width;x++){const p=y*(width*4+1)+1+x*4;const red=x>25&&x<100&&y>25&&y<140,blue=x>130&&x<210&&y>65&&y<140;raw.set(red?[220,30,35,255]:blue?[30,80,220,255]:[245,245,240,255],p);}}const crc=b=>{let value=0xffffffff;for(const byte of b){value^=byte;for(let n=0;n<8;n++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;};const chunk=(kind,bytes)=>{const b=Buffer.alloc(bytes.length+12);b.writeUInt32BE(bytes.length);b.write(kind,4);bytes.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,-4)),b.length-4);return b;};const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
async function poll(fn,ms=30000){const until=Date.now()+ms;while(Date.now()<until){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Acceptance deadline');}
async function dbWriterProof(result){for(const expected of result.expected){const actual=await db.user.findUniqueOrThrow({where:{id:expected.id},select:{notificationMuted:true}});assert.equal(actual.notificationMuted,expected.muted);}return {actors:result.expected.length,verified:true};}
async function load(label){
 // Prior phase processes/ports are proven stopped before reuse. Reset only the
 // measured operational boolean, outside timing, so each first toggle is real.
 await db.user.updateMany({where:{id:{in:runtime.fixture.writerActors.map(a=>a.id)}},data:{notificationMuted:false}});
 const reports=[],identity=async()=>crypto.createHash('sha256').update(JSON.stringify(await db.user.findMany({where:{id:{in:runtime.fixture.writerActors.map(a=>a.id)}},select:{id:true,name:true,password:true,sessionVersion:true,role:true,classId:true},orderBy:{id:'asc'}}))).digest('hex');
 const beforeIdentity=await identity();
 for(const concurrency of [2,8,20]){
   const name=label+'-'+crypto.randomUUID()+'-http-'+concurrency;
   const state=await launch([path.join(repo,'scripts/production-performance-http.mjs'),path.join(root,'runtime.json'),name,'mixed',String(concurrency),runtime.runId],name);
   const code=await bounded(state);await cleanupOwned(state);
   const result=JSON.parse(fs.readFileSync(ownedFile(root,name+'.json',true),'utf8'));
   result.exitCode=code;result.databaseProof=await dbWriterProof(result);result.identityUnchanged=beforeIdentity===await identity();assert.equal(result.identityUnchanged,true);
   result.workloadElapsedMs=Math.max(...result.samples.map(s=>s.end))-Math.min(...result.samples.map(s=>s.start));result.workloadQps=result.requests/(result.workloadElapsedMs/1000);
   write(name,result);reports.push(result);
   await db.user.updateMany({where:{id:{in:runtime.fixture.writerActors.map(a=>a.id)}},data:{notificationMuted:false}});
   print(JSON.stringify({label,concurrency,...summarize(result.samples),qps:result.workloadQps}));if(phase==='after')assert.equal(code,0);
 }
 return reports;
}
async function browserStart(){const {chromium}=rootReq('playwright');browser=await chromium.launch({headless:true});return browser;}
async function contextFor(actor){const context=await browser.newContext({viewport:{width:1280,height:900}});await context.route('**/*',route=>new URL(route.request().url()).origin===runtime.origin?route.continue():route.abort());try{const csrf=await (await browserApi(context,runtime.origin,'/api/csrf-token')).json();assert.equal(typeof csrf.csrfToken,'string');const response=await browserApi(context,runtime.origin,'/api/auth/login',{method:'POST',data:{email:actor.email,password:runtime.fixture.password},headers:{'x-csrf-token':csrf.csrfToken}});const authenticated=await response.json();assert.equal(authenticated.user.id,actor.id);return context;}catch(error){await context.close();throw error;}}
async function offlineRed(){await browserStart();const context=await contextFor(runtime.fixture.actors[2]);try{const page=await context.newPage();await page.goto(runtime.origin+'/student/quizzes',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Sınavlarım',exact:true}).waitFor();await page.getByLabel('Sınav Ara').fill('Çevrimdışı Şekil');const row=page.getByRole('row').filter({hasText:'Çevrimdışı Şekil Sınavı'});await row.getByRole('button',{name:'Çevrimdışı Hazırla',exact:true}).click();await row.getByRole('button',{name:'Çevrimdışı Hazır',exact:true}).waitFor();await page.evaluate(()=>navigator.serviceWorker.ready);const cache=await page.evaluate(async()=>{const keys=await caches.keys(),urls=[];for(const key of keys)for(const request of await (await caches.open(key)).keys())urls.push(new URL(request.url).pathname);return urls;});const prepared=await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('quiz-master:offline-session:')).map(([,v])=>JSON.parse(v)));await context.setOffline(true);await page.goto(runtime.origin+'/student/quiz/'+runtime.fixture.offlineQuiz,{waitUntil:'domcontentloaded'}).catch(()=>{});const loaded=await page.getByRole('button',{name:'Quizi Bitir',exact:true}).isVisible().catch(()=>false);write('offline-red',{cache,loaded,privateImagePrepared:prepared.some(s=>s.questions.some(q=>q.imageUrl?.startsWith('data:image/'))),preparedSessionCount:prepared.length});assert.equal(loaded,false,'Baseline unexpectedly supports first-visit offline JS');assert.equal(prepared.some(s=>s.questions.some(q=>q.imageUrl?.startsWith('data:image/'))),false);await page.screenshot({path:ownedFile(evidence,'offline-red.png'),fullPage:true});print('Real first-visit offline RED: shell failed, image copy absent');}finally{await context.close();await browser.close();browser=null;await db.studentResult.deleteMany({where:{quizId:runtime.fixture.offlineQuiz}});}}
try {
  if(phase!=='baseline'){const previousPort=Number(new URL(runtime.origin).port);assert.ok((await verifyFixturePortsReleased([previousPort])).every(p=>p.stopped));}
  const port=await freePort();ports=[port];runtime.origin='http://127.0.0.1:'+port;env.PORT=String(port);env.FRONTEND_URL=runtime.origin;env.ALLOWED_ORIGINS=runtime.origin;
  runtime.appBase=phase==='base'?'/school':'';env.APP_BASE_PATH=runtime.appBase||'/';
  runtime.browserOfflineOnly=phase==='ui-offline';
 if(phase==='baseline'){
   exclusiveJson(root,'runtime.json',runtime);
   readPerformanceRuntime(repo,path.join(root,'runtime.json'),{runId:runtime.runId,requireDatabase:false});
   Object.assign(process.env,{DATABASE_URL:env.DATABASE_URL,ACADEMIC_ARCHIVE_RUNTIME:env.ACADEMIC_ARCHIVE_RUNTIME});
   const guard=await import('./academic-fixture-email.mjs');isolation=guard.isolateAcademicFixture();guard.disableAcademicFixtureEmailDelivery(req('nodemailer'));
   await command([req.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.join(root,'server/prisma/schema.prisma')],'migrations');
   // Only the freshly migrated owned DB is queried; no live source is copied.
   db=new (req('@prisma/client').PrismaClient)({datasources:{db:{url:env.DATABASE_URL}}});
   runtime.fixture=await seedPerformance(db,repo);fs.writeFileSync(ownedFile(root,'runtime.json',true),JSON.stringify(runtime),{mode:0o600});
   fs.writeFileSync(ownedFile(root,'server/uploads/performance-diagram.png'),diagram(),{flag:'wx',mode:0o600});
   const migrations=await db.$queryRawUnsafe('SELECT count(*) AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');assert.equal(Number(migrations[0].n),22);
   write('fixture',{counts:runtime.fixture.counts,roles:runtime.fixture.roles,businessRows:runtime.fixture.businessRows,migrations:22,relationsAndScoresVerified:true});
 } else {fs.writeFileSync(ownedFile(root,'runtime.json',true),JSON.stringify(runtime),{mode:0o600});readPerformanceRuntime(repo,path.join(root,'runtime.json'),{runId:runtime.runId});Object.assign(process.env,{DATABASE_URL:env.DATABASE_URL,ACADEMIC_ARCHIVE_RUNTIME:env.ACADEMIC_ARCHIVE_RUNTIME});const guard=await import('./academic-fixture-email.mjs');isolation=guard.isolateAcademicFixture();guard.disableAcademicFixtureEmailDelivery(req('nodemailer'));db=new (req('@prisma/client').PrismaClient)({datasources:{db:{url:env.DATABASE_URL}}});}
 for(const file of ['server/data/academic.db','server/.env','.env','runtime.json'])ownedFile(root,file,true);
 if(fs.existsSync(path.join(root,'client/dist'))){noLinks(path.join(root,'client/dist'));fs.rmSync(path.join(root,'client/dist'),{recursive:true});}
 fs.cpSync(path.join(repo,'client/dist'),path.join(root,'client/dist'),{recursive:true,errorOnExist:true,force:false});
 const metrics=bundleMetrics(path.join(root,'client/dist'));write('bundle',metrics);print(JSON.stringify({phase,initialBytes:metrics.initialBytes,initialGzip:metrics.initialGzip,totalJsBytes:metrics.totalJsBytes}));
 const entry=ownedFile(root,'server/performance-backend.cjs');
 await req('esbuild').build({entryPoints:[path.join(repo,'server/index.ts')],outfile:entry,bundle:true,packages:'external',platform:'node',target:'node22',format:'cjs',logLevel:'silent'});
 const preload=ownedFile(root,'entry-'+phase+'-'+crypto.randomUUID()+'.mjs');
 fs.writeFileSync(preload,`import {createRequire} from 'node:module';\nconst {isolateAcademicFixture,disableAcademicFixtureEmailDelivery}=await import(${JSON.stringify(pathToFileURL(path.join(repo,'scripts/academic-fixture-email.mjs')).href)});isolateAcademicFixture();const req=createRequire(${JSON.stringify(path.join(repo,'server/package.json'))});disableAcademicFixtureEmailDelivery(req('nodemailer'));await import(${JSON.stringify(pathToFileURL(entry).href)});`,{flag:'wx',mode:0o600});
 const backend=await launch([preload],'backend');await waitForAuditServer(runtime.origin+'/api/csrf-token',backend);
 monitor=setInterval(()=>{let ticks=0,rss=0,members=0;for(const identity of backend.knownProcesses.values()){try{const fields=fs.readFileSync(`/proc/${identity.pid}/stat`,'utf8').replace(/^.*\) /,'').split(' ');if(fields[19]!==identity.startTicks)continue;ticks+=Number(fields[11])+Number(fields[12]);rss+=Number(fields[21])*4096;members++;}catch{}}resources.push({at:Date.now(),ticks,rss,members});},250);
 if(phase==='after'||phase.startsWith('baseline'))write('load',await load(phase));
 if(phase.startsWith('baseline'))await offlineRed();
 else if(phase==='archive'){const {archiveAcceptance}=await import('./production-performance-archive.mjs');write('archive',await archiveAcceptance({repo,root,runtime,db,env,launch,bounded,write,print,poll,dbWriterProof,evidence}));const {acceptHistoryBrowser}=await import('./production-performance-browser.mjs');await browserStart();write('history-browser',await acceptHistoryBrowser({browser,runtime,evidence,db,contextFor,poll}));await browser.close();browser=null;}
 else if(phase==='roles'){const {acceptSettledRolesBrowser}=await import('./production-performance-browser.mjs');await browserStart();write('settled-roles',await acceptSettledRolesBrowser({runtime,evidence,contextFor}));await browser.close();browser=null;}
 else {const {acceptProductionBrowser}=await import('./production-performance-browser.mjs');await browserStart();write('browser',await acceptProductionBrowser({browser,runtime,evidence,db,contextFor,poll,repo,main}));await browser.close();browser=null;}
 write('resources',{scope:'owned backend process group incl supervisor Node/API Node and Prisma descendants; /proc cumulative CPU ticks (100Hz on this Linux host), RSS sum; excludes separate generator/browser and system',samples:resources,peakRss:Math.max(...resources.map(r=>r.rss)),systemAvailableBytes:Number(fs.readFileSync('/proc/meminfo','utf8').match(/MemAvailable:\s*(\d+)/)[1])*1024});
 print('Acceptance '+phase+' passed');
} catch(error) {write('failure',{name:error.name,code:error.code||null,message:String(error.message).split('\n')[0].slice(0,180)});print('Acceptance failed: '+error.name+' '+(error.code||''));process.exitCode=1;}
finally {
 clearInterval(monitor);const errors=[],cleanup=[];
 const attempt=async(label,fn)=>{try{return await fn();}catch(error){errors.push({label,name:error.name,code:typeof error.code==='string'?error.code:null});return null;}};
 if(resources.length&&!fs.existsSync(ownedFile(evidence,'resources.json')))await attempt('resources-proof',async()=>write('resources',{scope:'owned API backend process group; Node and its in-process native Prisma engine included, separate generator/browser excluded',samples:resources,peakRss:Math.max(...resources.map(r=>r.rss)),incomplete:true}));
 if(browser)await attempt('browser-close',()=>browser.close());
 if(db)await attempt('database-disconnect',()=>db.$disconnect());
 for(const {state,label,log} of jobs.reverse()){
   const proof=await attempt(label,()=>cleanupOwned(state));cleanup.push({label,...(proof||{stopped:false})});
   await attempt(label+'-log',()=>log.writableFinished?Promise.resolve():new Promise((r,j)=>{log.once('error',j);log.end(r);}));
 }
 const released=await attempt('ports-proof',()=>verifyFixturePortsReleased(ports));
 let protectedUnchanged=false;await attempt('protected-proof',async()=>{protectedUnchanged=JSON.stringify(protectedFiles.map(f=>hash(ownedFile(main,f,true))))===JSON.stringify(protectedBefore);});
 const clean=errors.length===0&&cleanup.every(c=>c.stopped)&&released?.every(r=>r.stopped)&&protectedUnchanged;
 write('cleanup',{cleanup,ports:released||[],protectedHashes:protectedBefore,protectedUnchanged,errors,clean,outboundIsolation:isolation?.state});print(JSON.stringify({evidence,cleanup:clean,portsReleased:released?.every(r=>r.stopped),protectedUnchanged}));
 if(!clean)process.exitCode=1;
}
