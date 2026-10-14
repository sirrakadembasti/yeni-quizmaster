import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ownedFile,exclusiveJson} from './production-performance-guard.mjs';
import {actorClient,summarize} from './production-performance-http.mjs';
import {cleanupOwned} from './academic-owned-process.mjs';

// Independent read of the exporter's bounded uncompressed ZIP32 payload. No
// entry is extracted to a caller-provided path; only manifest-selected PDFs are
// copied under the canonical exclusive evidence directory.
function unpackStoredZip(bytes){
 const files=new Map();let offset=0;
 while(offset+30<=bytes.length&&bytes.readUInt32LE(offset)===0x04034b50){
   assert.equal(bytes.readUInt16LE(offset+8),0);assert.equal(bytes.readUInt16LE(offset+6),0x800);
   const size=bytes.readUInt32LE(offset+18),plain=bytes.readUInt32LE(offset+22),nameSize=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28);
   assert.equal(size,plain);const start=offset+30+nameSize+extra;assert.ok(start+size<=bytes.length);
   const name=bytes.subarray(offset+30,offset+30+nameSize).toString('utf8');assert.match(name,/^[a-zA-Z0-9.-]+(?:\/[a-zA-Z0-9.-]+)*$/);assert.ok(!name.split('/').some(p=>p==='.'||p==='..'));assert.equal(files.has(name),false);
   files.set(name,bytes.subarray(start,start+size));offset=start+size;
 }
 assert.ok(files.size>0);assert.equal(bytes.readUInt32LE(offset),0x02014b50);assert.equal(bytes.readUInt32LE(bytes.length-22),0x06054b50);assert.equal(bytes.readUInt16LE(bytes.length-14),files.size);return files;
}

export async function archiveAcceptance({repo,root,runtime,db,launch,bounded,write,poll,dbWriterProof,evidence}) {
 const req=createRequire(path.join(repo,'server/package.json'));
 const moduleFile=ownedFile(root,'server/archive-measure-'+crypto.randomUUID()+'.cjs');
 await req('esbuild').build({stdin:{contents:`export {captureArchive} from './services/archive-capture'; export {createArchiveWorker} from './services/archive-worker'; export {exportArchive} from './services/archive-export'; export {HISTORY_PROJECTION_VERSION,warmHistoryProjection} from './services/archive-history-projection';`,resolveDir:path.join(repo,'server'),sourcefile:'performance-measure.ts'},outfile:moduleFile,bundle:true,packages:'external',platform:'node',target:'node22',format:'cjs',logLevel:'silent'});
 const {captureArchive,createArchiveWorker,exportArchive,HISTORY_PROJECTION_VERSION,warmHistoryProjection}=req(moduleFile);
 const admin=await actorClient(runtime.origin,runtime.fixture.actors[0],runtime.fixture.password);
 const writerId=runtime.fixture.writerActors[0].id;
 const writerIdentity=async()=>crypto.createHash('sha256').update(JSON.stringify(await db.user.findUniqueOrThrow({where:{id:writerId},select:{id:true,name:true,password:true,sessionVersion:true,role:true,classId:true}}))).digest('hex');
 const writerIdentityBefore=await writerIdentity();await db.user.update({where:{id:writerId},data:{notificationMuted:false}});
 const label='archive-writer-'+crypto.randomUUID(),stop=ownedFile(root,label+'.stop.json');
 const state=await launch([path.join(repo,'scripts/production-performance-http.mjs'),path.join(root,'runtime.json'),label,'writer','1',runtime.runId],label);
 let stopped=false,snapshotId,beforeWarm,afterCapture,archiveResult;
 const timeline={},workerErrors=[],resources={};
 const measure=async(name,fn)=>{const cpu=process.cpuUsage(),start=Date.now();let peak=process.memoryUsage().rss;const timer=setInterval(()=>peak=Math.max(peak,process.memoryUsage().rss),100);timeline[name]={start};try{return await fn();}finally{clearInterval(timer);timeline[name].end=Date.now();const used=process.cpuUsage(cpu);resources[name]={elapsedMs:timeline[name].end-start,cpuMs:(used.user+used.system)/1000,peakRss:Math.max(peak,process.memoryUsage().rss),scope:'acceptance runner Node incl native Prisma library; separate API backend/browser/generator excluded'};}};
 async function digest(){let type='',id='',rows=0,pages=0,maxPage=0;const hash=crypto.createHash('sha256');for(;;){const page=await db.$queryRawUnsafe('SELECT entityType,entityId,dataJson FROM ArchiveSnapshotRow WHERE snapshotId=? AND (entityType,entityId)>(?,?) ORDER BY entityType,entityId LIMIT 256',snapshotId,type,id);pages++;maxPage=Math.max(maxPage,page.length);if(!page.length)break;for(const row of page)hash.update(JSON.stringify([row.entityType,row.entityId,row.dataJson])+'\n');rows+=page.length;({entityType:type,entityId:id}=page.at(-1));}return {rows,pages,maxPage,sha256:hash.digest('hex')};}
 async function projection(version){const count=await db.$queryRawUnsafe('SELECT count(*) AS n FROM ArchiveHistoryProjection WHERE snapshotId=? AND version=?',snapshotId,version),different=await db.$queryRawUnsafe('SELECT count(*) AS n FROM ArchiveHistoryProjection p JOIN ArchiveSnapshotRow s ON p.sourceRowId=s.id WHERE p.snapshotId=? AND p.version=? AND p.sourceJson<>s.dataJson',snapshotId,version),ready=await db.$queryRawUnsafe('SELECT rowCount,inputSha256 FROM ArchiveHistoryReady WHERE snapshotId=? AND version=?',snapshotId,version);assert.equal(Number(count[0].n),afterCapture.rows);assert.equal(Number(different[0].n),0);assert.equal(ready.length,1);assert.equal(Number(ready[0].rowCount),afterCapture.rows);assert.equal(ready[0].inputSha256,afterCapture.sha256);return {rows:Number(count[0].n),sourceJsonExact:true,readyRows:Number(ready[0].rowCount),inputSha256:ready[0].inputSha256};}
 try {
   await poll(()=>fs.existsSync(ownedFile(root,label+'.ready.json')),30000);
   await new Promise(r=>setTimeout(r,1100));
   await db.academicYear.update({where:{id:runtime.fixture.yearId},data:{scheduledCloseAt:new Date(Date.now()-1000)}});
   const enqueue=await admin('/api/admin/archive/close-year','POST',{academicYearId:runtime.fixture.yearId});assert.equal(enqueue.status,202);snapshotId=enqueue.body.job.id;
   const measuredDb=new Proxy(db,{get(target,key){if(key==='$transaction')return async(callback,options)=>{if(options?.timeout===120000&&!timeline.finalization)return measure('finalization',()=>target.$transaction(callback,options));return target.$transaction(callback,options);};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
   const worker=createArchiveWorker({db:measuredDb,backupRoot:path.join(root,'artifacts'),owner:'performance-owned-'+crypto.randomUUID(),capture:async(_workerDb,id,lease)=>{const result=await measure('capture',()=>captureArchive(db,id,lease));afterCapture=await digest();assert.ok(afterCapture.rows>=10000);return result;},export:async(input,backupRoot)=>{
     // The actual capture fence is tested while the job is captured and its
     // real PDF/ZIP generation/finalization are still outstanding.
     const fence=await admin('/api/quizzes','POST',{});assert.equal(fence.status,423);assert.equal(fence.body.code,'ANNUAL_CAPTURE_FROZEN');write('intentional-fence',{status:423,code:fence.body.code});
     return measure('artifacts',()=>exportArchive(input,backupRoot,{uploadsRoot:path.join(root,'server/uploads')}));
   },onError:error=>workerErrors.push({name:error.name,code:typeof error.code==='string'?error.code:null})});
   await worker.tick();worker.stop();assert.deepEqual(workerErrors,[]);
   const completed=await db.archiveSnapshot.findUniqueOrThrow({where:{id:snapshotId}});assert.equal(completed.status,'completed');assert.equal(completed.attempts,1);assert.ok(completed.zipSha256&&completed.artifactPath&&completed.sizeBytes>0);
   const zip=fs.readFileSync(ownedFile(root,path.relative(root,completed.artifactPath).replaceAll('\\','/'),true));assert.equal(crypto.createHash('sha256').update(zip).digest('hex'),completed.zipSha256);
   const packed=unpackStoredZip(zip),manifest=JSON.parse(packed.get('manifest.json').toString('utf8')),pdfs=[];
   for(const entry of manifest.files){const bytes=packed.get(entry.path);assert.ok(bytes);assert.equal(bytes.length,entry.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);if(entry.path.endsWith('.pdf')){assert.equal(bytes.subarray(0,5).toString(),'%PDF-');const name='archive-'+path.basename(entry.path);fs.writeFileSync(ownedFile(evidence,name),bytes,{flag:'wx',mode:0o600});pdfs.push({file:name,bytes:bytes.length,pdfMagic:true,skiaProducer:bytes.includes(Buffer.from('Skia/PDF'))});}}
   assert.ok(pdfs.length);write('artifact-content-proof',{zipSha256Matches:true,manifestEntries:manifest.files.length,allManifestBytesAndSha256Match:true,pdfs,visualInspectionPending:true});
   const year=await db.academicYear.findUniqueOrThrow({where:{id:runtime.fixture.yearId}});assert.equal(year.status,'closed');assert.equal(year.snapshotId,snapshotId);
   assert.deepEqual(await digest(),afterCapture);const current=await projection(HISTORY_PROJECTION_VERSION);
   const groups=await db.archiveSnapshotRow.groupBy({by:['entityType'],where:{snapshotId},_count:true});
   const historical=await admin('/api/admin/academic-history/context','POST',{academicYearId:year.id});assert.equal(historical.status,200);
   const denyWrite=await admin('/api/quizzes','POST',{}),denyRead=await admin('/api/results');assert.equal(denyWrite.status,403);assert.equal(denyRead.status,409);
   const page=await admin(`/api/admin/academic-history/years/${year.id}/rows?type=result&pageSize=100&page=2&statistics=true`);assert.equal(page.status,200);assert.equal(page.body.rows.length,100);assert.ok(page.body.counts.result>=8000);
   write('intentional-history',{writeStatus:403,readStatus:409,boundedPageRows:page.body.rows.length,totalResults:page.body.counts.result});
   const version=HISTORY_PROJECTION_VERSION+';performance-first-warm-'+crypto.randomUUID(),progress={sourcePages:0,sourceRows:0,maxPage:0,committedChunks:0,maxChunk:0};let chunkRows=0;
   const adapt=target=>new Proxy(target,{get(target,key){if(key==='$queryRawUnsafe'||key==='$executeRawUnsafe')return async(sql,...values)=>{const result=await target[key](sql,...values.map(v=>v===HISTORY_PROJECTION_VERSION?version:v));if(sql.includes('(entityType,entityId)>')){progress.sourcePages++;progress.sourceRows+=result.length;progress.maxPage=Math.max(progress.maxPage,result.length);chunkRows+=result.length;}return result;};if(key==='$transaction')return async(callback,options)=>{chunkRows=0;const result=await target.$transaction(tx=>callback(adapt(tx)),options);progress.committedChunks++;progress.maxChunk=Math.max(progress.maxChunk,chunkRows);return result;};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
   assert.equal((await db.$queryRawUnsafe('SELECT count(*) AS n FROM ArchiveHistoryProjection WHERE snapshotId=? AND version=?',snapshotId,version))[0].n,0n);
   beforeWarm=await digest();await measure('legacyWarm',()=>warmHistoryProjection(adapt(db),snapshotId));const warmed=await projection(version);assert.deepEqual(await digest(),beforeWarm);assert.equal(progress.sourceRows,afterCapture.rows);assert.ok(progress.maxPage<=256&&progress.maxChunk<=4096);assert.ok(progress.committedChunks>=Math.ceil(afterCapture.rows/4096));
   await new Promise(r=>setTimeout(r,1500));exclusiveJson(root,label+'.stop.json',{stopAt:Date.now()});const code=await bounded(state);await cleanupOwned(state);stopped=true;assert.equal(code,0);
   const writer=JSON.parse(fs.readFileSync(ownedFile(root,label+'.json',true),'utf8'));assert.equal(writer.errors,0);const acknowledgement=await dbWriterProof(writer);assert.equal(await writerIdentity(),writerIdentityBefore);
   const overlap=interval=>writer.samples.filter(s=>s.start<interval.end&&s.end>interval.start).length;
   const before=writer.samples.filter(s=>s.end<timeline.capture.start).length,after=writer.samples.filter(s=>s.start>timeline.legacyWarm.end).length;
   const concurrent={before,capture:overlap(timeline.capture),finalization:overlap(timeline.finalization),legacyWarm:overlap(timeline.legacyWarm),after};assert.ok(Object.values(concurrent).every(n=>n>0));assert.deepEqual(await digest(),beforeWarm);
   archiveResult={completed:true,snapshotRows:afterCapture.rows,groups:Object.fromEntries(groups.map(g=>[g.entityType,g._count])),capture:afterCapture,currentProjection:current,artifact:{sizeBytes:completed.sizeBytes,zipSha256:completed.zipSha256,actualChromiumPdfZipVerified:true},timeline,resources,warm:{method:'fresh version namespace on real completed immutable snapshot; no source/triggers/current projection deleted',...progress,projection:warmed,sourceUnchanged:true},writer:{...summarize(writer.samples),concurrent,databaseProof:acknowledgement,independentProcess:true,identityUnchanged:true,operationalFieldExcludedFromSnapshot:true}};
   write('archive-writer',writer);return archiveResult;
 }finally{if(!stopped){if(!fs.existsSync(stop))exclusiveJson(root,label+'.stop.json',{stopAt:Date.now()});await cleanupOwned(state);}}
}
