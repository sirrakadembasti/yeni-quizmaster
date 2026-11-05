import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import {browserApi} from './production-performance-browser-api.mjs';
const req=createRequire(new URL('../package.json',import.meta.url));
test('APIRequestContext authentication never follows a different-origin redirect',async()=>{
 let hits=0;const target=http.createServer((_,response)=>{hits++;response.setHeader('content-type','application/json');response.end('{}');});await new Promise(r=>target.listen(0,'127.0.0.1',r));
 const source=http.createServer((_,response)=>{response.writeHead(302,{location:'http://127.0.0.1:'+target.address().port+'/api/csrf-token'});response.end();});await new Promise(r=>source.listen(0,'127.0.0.1',r));
 const context={request:await req('playwright').request.newContext()};
 try {await assert.rejects(browserApi(context,'http://127.0.0.1:'+source.address().port,'/api/csrf-token'));assert.equal(hits,0);}
 finally {await context.request.dispose();await Promise.all([new Promise(r=>source.close(r)),new Promise(r=>target.close(r))]);}
});
