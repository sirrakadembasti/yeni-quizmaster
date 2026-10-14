// Semantic negative controls on an isolated export; restore source in finally.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {launchOwned,cleanupOwned} from './academic-owned-process.mjs';
import {ownedFile,noLinks,exclusiveJson} from './production-performance-guard.mjs';
const repo=path.resolve(import.meta.dirname,'..');if(!path.basename(repo).startsWith('quizmaster-test-performance-'))throw Error('Isolated export required');
const evidence=path.join(repo,'.superpowers/sdd/2026-10-06-production-rehearsal-plan/task4-private','route-negative-'+crypto.randomUUID());noLinks(evidence);fs.mkdirSync(evidence,{mode:0o700});
const req=createRequire(path.join(repo,'client/package.json')),vitest=path.join(path.dirname(req.resolve('vitest/package.json')),'vitest.mjs');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|HOME|TMP|TEMP|SYSTEMROOT|WINDIR|USERPROFILE)$/i.test(k)));env.CI='true';
async function negative(label,file,transform,test){const target=ownedFile(repo,file,true),before=fs.readFileSync(target),after=transform(before.toString('utf8'));if(after===before.toString('utf8'))throw Error('Missing negative control');let state,timer,code;const log=fs.createWriteStream(ownedFile(evidence,label+'.log'),{flags:'wx',mode:0o600});
 try{fs.writeFileSync(target,after);state=await launchOwned([vitest,'run',test,'--maxWorkers=1','--fileParallelism=false'],{cwd:path.join(repo,'client'),env,onState:s=>state=s,onOutput:s=>log.write(s)});code=await Promise.race([state.finished,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Negative control deadline')),45000);})]);if(code===0)throw Error('Negative control was not detected');}
 finally{clearTimeout(timer);fs.writeFileSync(target,before);const cleanup=state?await cleanupOwned(state):null;await new Promise(r=>log.end(r));exclusiveJson(evidence,label+'.json',{code,cleanup,sourceRestored:fs.readFileSync(target).equals(before)});}
}
await negative('loading-and-rejection','client/src/components/RouteLoadBoundary.tsx',()=>`export function RouteLoadBoundary({children}:any){return children;}\n`,'src/components/RouteLoadBoundary.test.tsx');
await negative('authorization','client/src/App.tsx',source=>source.replace("if (!(roles as string[]).includes(role)) return <UnauthorizedRedirect />;",'// negative control: unauthorized component incorrectly rendered'),'src/components/RouteGuard.test.tsx');
console.log(JSON.stringify({evidence,semanticRedDetected:2,sourcesRestored:true}));
