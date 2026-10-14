import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {ownedFile, exclusiveJson, noLinks, readPerformanceRuntime} from './production-performance-guard.mjs';
export function summarize(samples) {
  const sorted=samples.map(s=>s.ms).sort((a,b)=>a-b),percentile=n=>sorted[Math.max(0,Math.ceil(sorted.length*n)-1)]??0;
  const statuses={};for(const s of samples)statuses[s.status]=(statuses[s.status]||0)+1;
  return {requests:samples.length,p50:percentile(.50),p95:percentile(.95),p99:percentile(.99),max:sorted.at(-1)||0,statuses,errors:samples.filter(s=>!s.ok).length};
}
export async function actorClient(origin,actor,password) {
  if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))throw Error('Local HTTP origin required');
  let cookie='',csrf='';
  const request=async(url,method='GET',body)=>{
    if(!url.startsWith('/api/')||url.includes('://'))throw Error('Local API path required');
    const response=await fetch(origin+url,{method,redirect:'error',headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json',Origin:origin},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    const cookies=response.headers.getSetCookie();if(cookies.length)cookie=cookies.map(v=>v.split(';')[0]).join('; ');
    return {status:response.status,body:await response.json().catch(()=>null)};
  };
  csrf=(await request('/api/csrf-token')).body.csrfToken;
  const login=await request('/api/auth/login','POST',{email:actor.email,password});assert.equal(login.status,200);
  csrf=(await request('/api/csrf-token')).body.csrfToken;
  assert.equal((await request('/api/auth/me')).body.user.id,actor.id);
  return request;
}
if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [runtimeFile,outputName,mode,concurrencyText,runId]=process.argv.slice(2);
  if(!runId)throw Error('Owned HTTP run identity required');
  const repo=path.resolve(import.meta.dirname,'..');
  const runtime=readPerformanceRuntime(repo,runtimeFile,{runId}),root=runtime.root;
  const count=Number(concurrencyText),samples=[],expected=[],cpu=process.cpuUsage();
  const actors=mode==='mixed'?Array.from({length:count},(_,n)=>({...runtime.fixture.writerActors[n],reader:runtime.fixture.actors[n%4]})):runtime.fixture.writerActors.slice(0,count);
  const clients=[];
  for(const actor of actors){const writer=await actorClient(runtime.origin,actor,runtime.fixture.password),reader=mode==='mixed'?await actorClient(runtime.origin,actor.reader,runtime.fixture.password):writer;clients.push({actor,writer,reader});}
  const started=Date.now();exclusiveJson(root,outputName+'.ready.json',{readyAt:started,actors:count});
  await Promise.all(clients.map(async({actor,writer,reader},n)=>{
    let muted=false,index=0;
    const paths={'admin':['/api/quizzes','/api/classes','/api/results'],'teacher':['/api/quizzes','/api/classes','/api/dashboard/stats'],'student':['/api/student/quizzes','/api/student/results'],'parent':['/api/parents/students','/api/notifications']};
    do {
      const url=mode==='mixed'&&index%2===0?paths[actor.reader.role][Math.floor(index/2)%paths[actor.reader.role].length]:'/api/notifications/preferences';
      const write=url.endsWith('/preferences');if(write)muted=!muted;
      const at=Date.now(),start=performance.now();let result,status=0,ok=false;
      try {result=await (write?writer:reader)(url,write?'PATCH':'GET',write?{muted}:undefined);status=result.status;ok=status===200&&result.body!==null&&(!write||JSON.stringify(result.body)===JSON.stringify({muted}));}
      catch {ok=false;}
      samples.push({actor:n,url,write,start:at,end:Date.now(),ms:performance.now()-start,status,ok});
      if(write&&ok)expected[n]={id:actor.id,muted};
      index++;
      if(mode!=='mixed')await new Promise(r=>setTimeout(r,500));
    }while(mode==='mixed'?index<30:!fs.existsSync(ownedFile(root,outputName+'.stop.json'))&&Date.now()-started<240000);
  }));
  const elapsedMs=Date.now()-started,endCpu=process.cpuUsage(cpu),endpoints={};
  for(const url of new Set(samples.map(s=>s.url)))endpoints[url]=summarize(samples.filter(s=>s.url===url));
  exclusiveJson(root,outputName+'.json',{...summarize(samples),elapsedMs,qps:samples.length/(elapsedMs/1000),endpoints,expected,samples,cpuMs:(endCpu.user+endCpu.system)/1000,rss:process.memoryUsage().rss,resourceScope:'HTTP generator Node only; excludes backend Node/Prisma/Chromium'});
  console.log(JSON.stringify({mode,concurrency:count,...summarize(samples),elapsedMs}));
  process.exitCode=samples.some(s=>!s.ok)?1:0;
}
