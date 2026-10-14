import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {actorClient} from './production-performance-http.mjs';
import * as guard from './production-performance-guard.mjs';
test('authenticated HTTP bootstrap never follows a redirect outside the allowed origin',async()=>{
 let hits=0;const target=http.createServer((_,response)=>{hits++;response.end('{}');});
 await new Promise(r=>target.listen(0,'127.0.0.1',r));
 const source=http.createServer((_,response)=>{response.writeHead(302,{location:'http://127.0.0.1:'+target.address().port+'/redirect'});response.end();});
 await new Promise(r=>source.listen(0,'127.0.0.1',r));
 try{await assert.rejects(actorClient('http://127.0.0.1:'+source.address().port,{id:'synthetic',email:'synthetic@example.test'},'synthetic'));assert.equal(hits,0);}
 finally{await Promise.all([new Promise(r=>source.close(r)),new Promise(r=>target.close(r))]);}
});
test('runtime DB/env links and substituted root/database/run identities fail before sentinel reads or writes',()=>{
 const repo=fs.mkdtempSync(path.join(os.tmpdir(),'quizmaster-performance-safety-'));fs.mkdirSync(path.join(repo,'server/data'),{recursive:true});
 const root=fs.mkdtempSync(path.join(repo,'server/data/quizmaster-test-academic-performance-'));fs.mkdirSync(path.join(root,'server/data'),{recursive:true});
 const sentinel=path.join(repo,'external-sentinel');fs.writeFileSync(sentinel,'unchanged-private-sentinel');
 const runtime={root,database:path.join(root,'server/data/academic.db'),runId:'owned-test'},runtimeFile=path.join(root,'runtime.json');
 for(const file of ['.env','server/.env','server/data/academic.db'])fs.writeFileSync(path.join(root,file),'synthetic');
 fs.writeFileSync(runtimeFile,JSON.stringify(runtime));
 try{
   assert.equal(typeof guard.readPerformanceRuntime,'function');
   assert.equal(guard.readPerformanceRuntime(repo,runtimeFile,{runId:'owned-test'}).root,root);
   for(const relative of ['server/data/academic.db','server/.env','.env']){
     const file=path.join(root,relative);fs.unlinkSync(file);fs.symlinkSync(sentinel,file,'file');
     assert.throws(()=>guard.readPerformanceRuntime(repo,runtimeFile,{runId:'owned-test'}));fs.unlinkSync(file);fs.writeFileSync(file,'synthetic');
   }
   for(const altered of [{...runtime,root:repo},{...runtime,database:sentinel},{...runtime,runId:'other'}]){fs.writeFileSync(runtimeFile,JSON.stringify(altered));assert.throws(()=>guard.readPerformanceRuntime(repo,runtimeFile,{runId:'owned-test'}));}
   assert.equal(fs.readFileSync(sentinel,'utf8'),'unchanged-private-sentinel');
 }finally{fs.rmSync(repo,{recursive:true});}
});
