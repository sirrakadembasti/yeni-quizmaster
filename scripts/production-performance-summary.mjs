import fs from 'node:fs';
import path from 'node:path';
import {ownedFile,noLinks} from './production-performance-guard.mjs';
const repo=path.resolve(import.meta.dirname,'..');
const base=path.join(repo,'.superpowers/sdd/2026-10-06-production-rehearsal-plan/task4-private');noLinks(base);
if(process.argv[2]?.startsWith('test:')){
 const prefix=process.argv[2].slice(5);if(!/^[-a-z0-9]*$/.test(prefix))throw Error('Test label rejected');
 for(const file of fs.readdirSync(base).filter(f=>f.startsWith(prefix)&&f.endsWith('.log'))){const raw=fs.readFileSync(ownedFile(base,file,true),'utf8').replace(/\u001b\[[0-9;]*m/g,'');console.log(JSON.stringify({testLog:file,counts:raw.split('\n').filter(l=>/^\s*(?:Test Files|Tests |# tests|# pass|# fail)/.test(l)),failedTests:raw.split('\n').filter(l=>/^\s*FAIL |^\s*× /.test(l)),errorKinds:[...new Set(raw.match(/\b[A-Za-z]+Error\b/g)||[])]}));}
 process.exit(0);
}
for(const entry of fs.readdirSync(base,{withFileTypes:true})) {
 if(!entry.isDirectory()||(process.argv[2]&&!entry.name.startsWith(process.argv[2])))continue;
 const directory=path.join(base,entry.name),summary={run:entry.name};
 const comparison=ownedFile(directory,'comparison.json');if(fs.existsSync(comparison)){const v=JSON.parse(fs.readFileSync(comparison,'utf8'));summary.comparison={baselineBytes:v.baseline.initialBytes,baselineGzip:v.baseline.initialGzip,afterBytes:v.after.initialBytes,afterGzip:v.after.initialGzip,reductionPercent:v.reduction*100,sameConfig:v.sameConfig,sourceRestored:v.sourceRestored,afterStaticFiles:v.after.staticJs.map(s=>s.file),largestChunks:v.after.largestChunks,css:v.after.css};}
 for(const name of ['bundle','fixture','failure','cleanup','port-proof','resources','offline-red','browser','browser-incomplete','browser-checkpoint','archive']) {
   const file=ownedFile(directory,name+'.json');if(!fs.existsSync(file))continue;
   const value=JSON.parse(fs.readFileSync(file,'utf8'));
   if(name==='bundle')summary.bundle={initialBytes:value.initialBytes,initialGzip:value.initialGzip,totalJsBytes:value.totalJsBytes,initialFiles:value.staticJs.map(r=>r.file)};
   if(name==='fixture')summary.fixture=value;
   if(name==='failure')summary.failure={name:value.name,code:value.code,message:value.message};
   if(name==='cleanup')summary.cleanup={protected:value.protectedUnchanged,ports:value.ports.every(p=>p.stopped),portErrors:value.ports.filter(p=>!p.stopped).map(p=>p.error),jobs:value.cleanup.map(j=>({label:j.label,stopped:j.stopped}))};
   if(name==='resources')summary.resources={scope:value.scope,peakRss:value.peakRss,available:value.systemAvailableBytes,cpuTicks:value.samples.at(-1)?.ticks-value.samples[0]?.ticks,elapsedMs:value.samples.at(-1)?.at-value.samples[0]?.at};
   if(name==='port-proof')summary.portProof={states:value.states,released:value.released.every(p=>p.stopped)};
   if(name==='offline-red')summary.offlineRed=value;
   if(name==='browser')summary.browser={checks:value.checks,unexpectedPageErrors:value.unexpectedPageErrors};
   if(name==='browser-incomplete'||name==='browser-checkpoint')summary[name]={mode:value.mode,checks:value.checks,unexpectedPageErrors:value.unexpectedPageErrors};
   if(name==='archive')summary.archive={snapshotRows:value.snapshotRows,completed:value.completed,warm:value.warm,writer:value.writer};
 }
 for(const file of fs.readdirSync(directory).filter(f=>/-http-\d+\.json$/.test(f))) {const value=JSON.parse(fs.readFileSync(ownedFile(directory,file,true),'utf8'));summary[file]={requests:value.requests,p50:value.p50,p95:value.p95,p99:value.p99,max:value.max,errors:value.errors,statuses:value.statuses,elapsedMs:value.elapsedMs,qps:value.qps,databaseProof:value.databaseProof,postStopDatabaseProof:value.postStopDatabaseProof};}
 const backend=ownedFile(directory,'backend.log');if(fs.existsSync(backend)){const raw=fs.readFileSync(backend,'utf8');summary.backendDiagnostic={prismaCodes:[...new Set(raw.match(/\bP\d{4}\b/g)||[])],busyMentions:(raw.match(/SQLITE_BUSY|database is locked/gi)||[]).length,timeoutMentions:(raw.match(/timed out|timeout/gi)||[]).length};}
 console.log(JSON.stringify(summary));
}
if(process.argv[2])process.exit(0);
for(const file of fs.readdirSync(base).filter(f=>/^baseline-acceptance.*\.log$/.test(f))){const raw=fs.readFileSync(ownedFile(base,file,true),'utf8');console.log(JSON.stringify({commandLog:file,ownedErrors:[...new Set((raw.match(/Error: (?:Owned|Unable to|Unable cleanup)[a-zA-Z .-]*/g)||[]))],stoppedMention:/stopped/.test(raw),engineMismatch:/Query Engine/.test(raw)}));}
for(const file of fs.readdirSync(base).filter(f=>/^(?:frontend-|offline-unit-|route-|notification-|safety-).*\.log$/.test(f))){const raw=fs.readFileSync(ownedFile(base,file,true),'utf8').replace(/\u001b\[[0-9;]*m/g,'');console.log(JSON.stringify({testLog:file,counts:raw.split('\n').filter(l=>/^\s*(?:Test Files|Tests |# tests|# pass|# fail)/.test(l)),failedTests:raw.split('\n').filter(l=>/^\s*FAIL |^\s*× /.test(l)),errorKinds:[...new Set(raw.match(/\b[A-Za-z]+Error\b/g)||[])]}));}
const pointer=ownedFile(path.dirname(base),'task4-fixture.json');
if(fs.existsSync(pointer)){
 const runtime=JSON.parse(fs.readFileSync(pointer,'utf8'));const root=runtime.root;
 noLinks(root);if(path.dirname(root)!==path.join(repo,'server/data')||!path.basename(root).startsWith('quizmaster-test-academic-performance-'))throw Error('Rejected summary fixture');
 for(const file of fs.readdirSync(root).filter(f=>/-http-\d+\.json$/.test(f))){const v=JSON.parse(fs.readFileSync(ownedFile(root,file,true),'utf8'));console.log(JSON.stringify({fixturePhase:file,requests:v.requests,errors:v.errors,statuses:v.statuses,endpoints:v.endpoints}));}
}
