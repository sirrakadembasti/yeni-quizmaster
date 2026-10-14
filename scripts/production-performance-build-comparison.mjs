import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {launchOwned,cleanupOwned} from './academic-owned-process.mjs';
import {ownedFile,noLinks,exclusiveJson} from './production-performance-guard.mjs';
import {bundleMetrics} from './production-performance-bundle.mjs';
const repo=path.resolve(import.meta.dirname,'..'),main=noLinks(process.argv[2]);
if(!path.basename(repo).startsWith('quizmaster-test-performance-'))throw Error('Isolated Git export required');
const evidence=path.join(repo,'.superpowers/sdd/2026-10-06-production-rehearsal-plan/task4-private','build-'+crypto.randomUUID());noLinks(evidence);fs.mkdirSync(evidence,{mode:0o700});
const files=['client/src/App.tsx','client/src/lib/offline-quiz.ts','client/src/pages/student-quizzes.tsx','client/src/pages/student-quiz.tsx','client/public/sw.js'];
const current=files.map(file=>fs.readFileSync(ownedFile(repo,file,true)));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const configHash=hash(fs.readFileSync(ownedFile(repo,'client/vite.config.ts',true)));
const req=createRequire(path.join(repo,'client/package.json')),vite=path.join(path.dirname(req.resolve('vite/package.json')),'bin/vite.js');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|HOME|TMP|TEMP|SYSTEMROOT|WINDIR|LOCALAPPDATA|USERPROFILE)$/i.test(k)));Object.assign(env,{CI:'true',PORT:'59173'});
async function build(label){let state,timer,code;const start=Date.now(),log=fs.createWriteStream(ownedFile(evidence,label+'.log'),{flags:'wx',mode:0o600});
 try{state=await launchOwned([vite,'build','--manifest'],{cwd:path.join(repo,'client'),env,onState:s=>state=s,onOutput:t=>log.write(t)});code=await Promise.race([state.finished,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Build deadline')),180000);})]);if(code!==0)throw Error('Build failed');const metrics=bundleMetrics(path.join(repo,'client/dist'));exclusiveJson(evidence,label+'.json',{...metrics,elapsedMs:Date.now()-start,configHash,sourceProjection:label==='baseline'?'Git acfe47c + identical public-shell build plugin':'Git acfe47c + only Task4 overlays; protected overlays excluded'});return metrics;}
 finally{clearTimeout(timer);const proof=state?await cleanupOwned(state):null;await new Promise(r=>log.end(r));exclusiveJson(evidence,label+'-cleanup.json',{code,elapsedMs:Date.now()-start,cleanup:proof});}}
let baseline,after;
try {
 for(const [n,file]of files.entries()){const original=spawnSync('git',['show','acfe47c0aa30b91843a4bc47cf94dd8e812f0c04:'+file],{cwd:main,maxBuffer:8*1024*1024});if(original.status!==0)throw Error('Baseline Git source read failed');fs.writeFileSync(ownedFile(repo,file,true),original.stdout);}
 baseline=await build('baseline');
}finally{for(const [n,file]of files.entries())fs.writeFileSync(ownedFile(repo,file,true),current[n]);}
after=await build('after');
const reduction=1-after.initialGzip/baseline.initialGzip;
exclusiveJson(evidence,'comparison.json',{baseline,after,reduction,sameConfig:configHash===hash(fs.readFileSync(ownedFile(repo,'client/vite.config.ts',true))),sourceRestored:files.every((file,n)=>hash(fs.readFileSync(ownedFile(repo,file,true)))===hash(current[n]))});
console.log(JSON.stringify({evidence,baselineBytes:baseline.initialBytes,baselineGzip:baseline.initialGzip,afterBytes:after.initialBytes,afterGzip:after.initialGzip,reductionPercent:reduction*100}));
if(reduction<.25)throw Error('Initial gzip reduction target not reached');
