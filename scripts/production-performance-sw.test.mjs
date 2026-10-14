import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const origin='http://127.0.0.1:12345';
async function worker({missing=false,varyOrigin=false}={}){
 let offline=false;
 const stores=new Map(),events={},responses=new Map([
  [origin+'/a/app-shell-assets.json',new Response(JSON.stringify({version:1,assets:['/a/assets/entry.js','/a/assets/style.css']}),{headers:{'content-type':'application/json'}})],
  [origin+'/a/assets/entry.js',new Response(missing?'<!doctype html><html>fallback</html>':'console.log("public shell")',{headers:{'content-type':missing?'text/html':'application/javascript',...(varyOrigin?{vary:'Origin'}:{})}})],
  [origin+'/a/assets/style.css',new Response('body {color:black}',{headers:{'content-type':'text/css'}})],
  [origin+'/a/',new Response('<!doctype html><html>new</html>',{headers:{'content-type':'text/html'}})],
  [origin+'/a/index.html',new Response('<!doctype html><html>new</html>',{headers:{'content-type':'text/html'}})]
 ]);
 const url=value=>new URL(typeof value==='string'?value:value.url,origin).href;
 const fetch=async request=>{if(offline)throw Error('Offline fixture');const value=responses.get(url(request));if(!value)throw Error('Unknown fixture resource');return value.clone();};
 const caches={keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key),open:async key=>{
   if(!stores.has(key))stores.set(key,new Map());const store=stores.get(key);
   return {put:async(request,response)=>store.set(url(request),{request:typeof request==='string'?new Request(url(request)):request,response:response.clone()}),match:async(request,options={})=>{const found=store.get(url(request));if(!found)return;const current=typeof request==='string'?new Request(url(request)):request;if(!options.ignoreVary&&found.response.headers.get('vary')?.toLowerCase()==='origin'&&current.headers.get('origin')!==found.request.headers.get('origin'))return;return found.response.clone();},keys:async()=>[...store.values()].map(v=>v.request),delete:async request=>store.delete(url(request)),addAll:async requests=>{const values=await Promise.all(requests.map(async request=>[request,await fetch(request)]));for(const [request,response] of values)store.set(url(request),{request:typeof request==='string'?new Request(url(request)):request,response});}};
 }};
 const old=await caches.open('quiz-master-app-v2');await old.put('/b/index.html',new Response('other base'));await old.put('/b/uploads/old.png',new Response('other private image'));
 const prior=await caches.open('quiz-master-app-v3:/a');await prior.put('/a/index.html',new Response('previous good index'));
 const unrelated=await caches.open('other-app');await unrelated.put('/other/index.html',new Response('unrelated'));
 const BrowserRequest=class extends Request{constructor(input,options){super(new URL(typeof input==='string'?input:input.url,origin),options);}};
 vm.runInNewContext(fs.readFileSync(path.resolve(import.meta.dirname,'../client/public/sw.js'),'utf8'),{URL,Request:BrowserRequest,Response,fetch,caches,self:{registration:{scope:origin+'/a/'},location:{origin},addEventListener:(name,callback)=>events[name]=callback,skipWaiting:async()=>{},clients:{claim:async()=>{}}}});
 return {events,caches,stores,setOffline:()=>offline=true};
}
test('activating a worker at /a does not delete another base legacy cache or unrelated origin cache',async()=>{
 const {events,caches}=await worker();let pending;events.activate({waitUntil:p=>pending=p});await pending;
 assert.equal(await (await (await caches.open('quiz-master-app-v2')).match('/b/index.html')).text(),'other base');
 assert.equal(await (await (await caches.open('other-app')).match('/other/index.html')).text(),'unrelated');
});
test('HTML200 for a missing entry is not ready and never replaces a previous good shell',async()=>{
 const {events,caches}=await worker({missing:true});let pending,message;
 events.message({data:{type:'QUIZMASTER_SHELL_READY'},ports:[{postMessage:value=>message=value}],waitUntil:p=>pending=p});await pending;
 assert.equal(message.ready,false);
 assert.equal(await (await (await caches.open('quiz-master-app-v3:/a')).match('/a/index.html')).text(),'previous good index');
});
test('a valid manifest makes only its static JS/CSS and public HTML ready',async()=>{
 const {events,caches}=await worker();let pending,message;
 events.message({data:{type:'QUIZMASTER_SHELL_READY'},ports:[{postMessage:value=>message=value}],waitUntil:p=>pending=p});await pending;
 assert.equal(message.ready,true);const keys=await (await caches.open('quiz-master-app-v3:/a')).keys();assert.deepEqual(keys.map(r=>new URL(r.url).pathname).sort(),['/a/','/a/assets/entry.js','/a/assets/style.css','/a/index.html']);
});
test('public immutable module cached without Origin remains usable for an offline module Origin request',async()=>{
 const {events,setOffline}=await worker({varyOrigin:true});let pending;
 events.install({waitUntil:p=>pending=p});await pending;setOffline();
 const request=new Request(origin+'/a/assets/entry.js',{headers:{origin},mode:'cors'});let response;
 events.fetch({request,respondWith:p=>response=p});assert.equal(await (await response).text(),'console.log("public shell")');
});
test('the public shell cache never handles foreign origins, another base, API, uploads, or query variants',async()=>{
 const {events}=await worker({varyOrigin:true});
 for(const url of ['https://foreign.test/a/assets/entry.js',origin+'/b/assets/entry.js',origin+'/api/private.js',origin+'/uploads/private.js',origin+'/a/assets/entry.js?private=1']){
   let handled=false;events.fetch({request:new Request(url),respondWith:()=>handled=true});assert.equal(handled,false);
 }
});
