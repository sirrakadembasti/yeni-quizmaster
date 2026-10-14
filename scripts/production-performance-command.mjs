import fs from 'node:fs';
import path from 'node:path';
import {launchOwned, cleanupOwned} from './academic-owned-process.mjs';
import {noLinks, ownedFile, exclusiveJson} from './production-performance-guard.mjs';
const [root, label, ...args] = process.argv.slice(2);
noLinks(root);
if(!/^quizmaster-test-performance-/.test(path.basename(root))||!/^[-a-z0-9]+$/.test(label)||!args.length)throw Error('Command identity rejected');
const evidence=path.join(root,'.superpowers/sdd/2026-10-06-production-rehearsal-plan/task4-private');
noLinks(evidence);fs.mkdirSync(evidence,{recursive:true,mode:0o700});
const log=fs.createWriteStream(ownedFile(evidence,label+'.log'),{flags:'wx',mode:0o600});
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|HOME|TMP|TEMP|SYSTEMROOT|WINDIR|LOCALAPPDATA|USERPROFILE)$/i.test(key)));
Object.assign(env,{CI:'true',PORT:'59173',PRISMA_HIDE_UPDATE_MESSAGE:'1',DATABASE_URL:'file:'+path.join(root,'server/data/unused.db'),npm_execpath:process.env.npm_execpath||'',VITE_BASE_PATH:process.env.VITE_BASE_PATH||'/'});
let state,timer,code=null,proof;
const start=Date.now();
try {
  state=await launchOwned(args,{cwd:root,env,onState:s=>state=s,onOutput:s=>log.write(s)});
  code=await Promise.race([state.finished,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Command deadline')),600000);})]);
} finally {
  clearTimeout(timer);if(state)proof=await cleanupOwned(state);
  await new Promise(r=>log.end(r));
  exclusiveJson(evidence,label+'.json',{args,code,elapsedMs:Date.now()-start,cleanup:proof});
  console.log(JSON.stringify({label,code,elapsedMs:Date.now()-start,stopped:state?.stopped}));
}
process.exitCode=code??1;
