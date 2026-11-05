import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {ownedFile,exclusiveJson,noLinks} from './production-performance-guard.mjs';
import {browserApi} from './production-performance-browser-api.mjs';

export async function acceptProductionBrowser({browser,runtime,evidence,db,contextFor,poll,repo,main}) {
 const base=runtime.appBase||'',url=pathname=>runtime.origin+base+pathname,checks=[],network=[],pageErrors=[],contexts=[];
 let mode='normal',activePage;
 const checkpoint=message=>{checks.push(message);const file=ownedFile(evidence,'browser-checkpoint.json');fs.writeFileSync(file,JSON.stringify({mode,checks}),{flag:fs.existsSync(file)?'w':'wx',mode:0o600});};
 const track=page=>{
   activePage=page;
   page.on('response',response=>network.push({mode,path:new URL(response.url()).pathname,status:response.status(),type:response.request().resourceType(),vary:response.headers().vary||'',originHeader:response.request().headers().origin===runtime.origin}));
   page.on('requestfailed',request=>network.push({mode,path:new URL(request.url()).pathname,status:0,type:request.resourceType(),originHeader:request.headers().origin===runtime.origin}));
   page.on('pageerror',error=>pageErrors.push({mode,name:error.name,expected:mode==='chunk-fault'}));
 };
 const shot=async(page,name)=>{const file=ownedFile(evidence,name+'.png');if(fs.existsSync(file))throw Error('Screenshot exists');await page.screenshot({path:file,fullPage:true});fs.chmodSync(file,0o600);};
 const heading=async(page,name)=>page.getByRole('heading',{name,exact:true}).waitFor({timeout:30000});
 const fresh=async actor=>{const context=await contextFor(actor);contexts.push(context);return context;};
 const student=n=>({...runtime.fixture.actors[2],id:runtime.fixture.actors[2].id.slice(0,-12)+n.toString(16).padStart(12,'0'),email:`student${n}@performance.test`});
 const list=async(page)=>{await page.goto(url('/student/quizzes'),{waitUntil:'domcontentloaded'});await heading(page,'Sınavlarım');await page.getByLabel('Sınav Ara').fill('Çevrimdışı Şekil');return page.getByRole('row').filter({hasText:'Çevrimdışı Şekil Sınavı'});};
 const image=async(page)=>{
   const element=page.getByRole('img',{name:'Soru görseli',exact:true});await element.waitFor();
   await poll(()=>element.evaluate(img=>img.complete&&img.naturalWidth===240&&img.naturalHeight===160));
   const pixels=await element.evaluate(img=>{const canvas=document.createElement('canvas');canvas.width=240;canvas.height=160;const context=canvas.getContext('2d');context.drawImage(img,0,0);return {red:[...context.getImageData(40,40,1,1).data],blue:[...context.getImageData(150,90,1,1).data],private:img.currentSrc.startsWith('data:image/')};});
   assert.deepEqual(pixels.red,[220,30,35,255]);assert.deepEqual(pixels.blue,[30,80,220,255]);assert.equal(pixels.private,true);return pixels;
 };
 const session=page=>page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('quiz-master:offline-session:')).map(([,v])=>JSON.parse(v)));
 const cacheProof=async(page)=>{
   const result=await page.evaluate(async()=>{const keys=await caches.keys(),result={};for(const key of keys){result[key]=(await (await caches.open(key)).keys()).map(r=>new URL(r.url).pathname);}return result;});
   const current=result[`quiz-master-app-v3:${base||'/'}`]||[];assert.ok(current.length>=3);assert.ok(current.every(p=>p===base+'/'||p===base+'/index.html'||p.startsWith(base+'/assets/')&&/\.(?:js|css)$/.test(p)));
   assert.ok(current.every(p=>!p.includes('/uploads/')&&!p.includes('/api/')));return result;
 };
 try {
   if(!runtime.browserOfflineOnly){
   // No authentication or page/report chunks are needed to render login.
   const publicContext=await browser.newContext();contexts.push(publicContext);await publicContext.route('**/*',route=>new URL(route.request().url()).origin===runtime.origin?route.continue():route.abort());
   const publicPage=await publicContext.newPage();track(publicPage);await publicPage.goto(url('/auth'),{waitUntil:'domcontentloaded'});await publicPage.getByLabel('E-posta',{exact:true}).waitFor();
   await publicPage.evaluate(()=>navigator.serviceWorker.ready);await cacheProof(publicPage);
   const manifest=JSON.parse(fs.readFileSync(ownedFile(repo,'client/dist/.vite/manifest.json',true),'utf8'));
   const reportFiles=Object.entries(manifest).filter(([key])=>/pages\/(?:dashboard|results|class-statistics|student-stats|survey-results)\.tsx$/.test(key)).map(([,entry])=>base+'/'+entry.file);
   assert.ok(!network.some(r=>reportFiles.includes(r.path)));assert.ok(!network.some(r=>/BarChart-/.test(r.path)));checkpoint('public login + SW background downloads only static shell; no reports/Recharts');await shot(publicPage,'public-login');
   await publicPage.goto(url('/results'),{waitUntil:'domcontentloaded'});await publicPage.getByLabel('E-posta',{exact:true}).waitFor();assert.equal(await publicPage.evaluate(()=>sessionStorage.getItem('returnUrl')),'/results');
   await publicPage.getByLabel('E-posta',{exact:true}).fill(runtime.fixture.actors[1].email);await publicPage.getByLabel('Şifre',{exact:true}).fill(runtime.fixture.password);await publicPage.getByRole('button',{name:'Giriş Yap',exact:true}).click();await publicPage.waitForURL(url('/results'));await heading(publicPage,'Sınav Sonuçları');checkpoint('public protected returnUrl restored by actual login form');
   await publicPage.goto(url('/unknown-performance-route'),{waitUntil:'domcontentloaded'});await heading(publicPage,'404');checkpoint('true 404 route remains available');
   await publicContext.close();
   const routes=[['admin','/archive','Yıl Sonu ve Arşiv İşlemleri','/parent/dashboard','/api/parents/students'],['teacher','/results','Sınav Sonuçları','/management','/api/admin/archive/years'],['student','/student/quizzes','Sınavlarım','/results','/api/admin/archive/years'],['parent','/parent/results','Sınav Sonuçları','/quizzes','/api/student/quizzes']];
   for(const [role,allowed,title,denied,api] of routes){
     mode=role;const context=await fresh(runtime.fixture.actors.find(a=>a.role===role)),page=await context.newPage();track(page);
     const start=network.length;await page.goto(url(allowed),{waitUntil:'domcontentloaded'});await heading(page,title);await page.reload({waitUntil:'domcontentloaded'});await heading(page,title);
     await page.locator(`a[href="${base}/settings"]`).first().click();await heading(page,'Hesap Ayarları');await page.goBack({waitUntil:'domcontentloaded'});await heading(page,title);await page.goForward({waitUntil:'domcontentloaded'});await heading(page,'Hesap Ayarları');
     await page.goto(url(denied),{waitUntil:'domcontentloaded'});await page.waitForURL(url('/'));
     const target=denied==='/results'?'results':denied==='/management'?'admin-management':denied==='/quizzes'?'quizzes':'parent-dashboard';
     const targetFile=Object.entries(manifest).find(([key])=>key.endsWith('/pages/'+target+'.tsx'))?.[1].file;
     // Student's forbidden chart page, teacher's forbidden management and
     // parent's forbidden quiz editor stay unimported in that fresh profile.
     if(targetFile&&!(role==='admin'&&target==='parent-dashboard'))assert.ok(!network.slice(start).some(r=>r.path===base+'/'+targetFile));
     const denial=await context.request.get(runtime.origin+api,{maxRedirects:0,timeout:30000});assert.equal(denial.status(),403);
     if(role==='teacher'){await page.goto(url('/student-quizzes/'+runtime.fixture.offlineQuiz),{waitUntil:'domcontentloaded'});await page.waitForURL(url('/student/quiz/'+runtime.fixture.offlineQuiz));await page.getByRole('button',{name:'Sonraki',exact:true}).waitFor();checkpoint('legacy alias redirects to canonical eager quiz preview');}
     await page.goto(url(allowed),{waitUntil:'domcontentloaded'});await heading(page,title);await shot(page,'role-'+role);checkpoint(role+' allowed/denied API+page, direct/refresh/back/forward');await context.close();
   }
   // A real missing/404 chunk is an explicit user recovery, never an auto loop.
   mode='chunk-fault';const faultContext=await fresh(runtime.fixture.actors[1]),fault=await faultContext.newPage();track(fault);
   const resultFile=Object.entries(manifest).find(([key])=>key.endsWith('/pages/results.tsx'))[1].file;
   let faults=0;const targetUrl=runtime.origin+base+'/'+resultFile;
   await faultContext.route(targetUrl,route=>{faults++;return route.fulfill({status:404,contentType:'text/javascript',body:''});});
   await fault.goto(url('/results'),{waitUntil:'domcontentloaded'});await fault.getByRole('alert').filter({hasText:'Sayfa yüklenemedi'}).waitFor();assert.equal(faults,1);await shot(fault,'lazy-chunk-error');
   await fault.getByRole('link',{name:'Ana sayfaya dön',exact:true}).click();await fault.waitForURL(url('/'));assert.equal(await fault.getByRole('alert').filter({hasText:'Sayfa yüklenemedi'}).count(),0);
   await fault.locator(`a[href="${base}/results"]`).first().click();await fault.getByRole('alert').filter({hasText:'Sayfa yüklenemedi'}).waitFor();assert.equal(faults,1);
   await faultContext.unroute(targetUrl);mode='chunk-recovery';await Promise.all([fault.waitForNavigation({waitUntil:'domcontentloaded'}),fault.getByRole('button',{name:'Sayfayı yeniden yükle',exact:true}).click()]);await heading(fault,'Sınav Sonuçları');checkpoint('lazy 404 accessible alert, SPA home reset, explicit hard reload recovery');await faultContext.close();
   }
   // Root and base path runs use different students so the second fresh
   // preparation is independent of the first completed exam.
   const actor=student(base?1:0),offlineContext=await fresh(actor),page=await offlineContext.newPage();track(page);mode='prepare';const row=await list(page);
   await row.getByRole('button',{name:'Çevrimdışı Hazırla',exact:true}).click();await row.getByRole('button',{name:'Çevrimdışı Hazır',exact:true}).waitFor({timeout:30000});
   const prepared=await session(page);assert.equal(prepared.length,1);assert.ok(prepared[0].questions.every(q=>!('correctAnswer'in q)));assert.ok(prepared[0].questions[0].imageUrl.startsWith('data:image/png;'));await cacheProof(page);
   const serviceWorker=offlineContext.serviceWorkers()[0];
   await serviceWorker.evaluate(()=>{const match=Cache.prototype.match;Cache.prototype.match=async function(request,...options){const result=await match.call(this,request,...options);if(typeof request!=='string'&&new URL(request.url).pathname.includes('/assets/')){const ignored=await match.call(this,request,{ignoreVary:true});(globalThis.performanceVaryProof??=[]).push({path:new URL(request.url).pathname,originHeader:request.headers.has('origin'),normalMatch:Boolean(result),ignoreVaryMatch:Boolean(ignored),vary:ignored?.headers.get('vary')});}return result;};});
   mode='offline';await offlineContext.setOffline(true);await page.goto(url('/student/quiz/'+runtime.fixture.offlineQuiz),{waitUntil:'domcontentloaded'});await image(page);exclusiveJson(evidence,'worker-vary-proof.json',await serviceWorker.evaluate(()=>globalThis.performanceVaryProof||[]));await shot(page,'offline-never-visited-diagram');
   await page.getByRole('button',{name:'A) A',exact:true}).click();await page.reload({waitUntil:'domcontentloaded'});await image(page);assert.equal(await page.getByRole('button',{name:'A) A',exact:true}).getAttribute('aria-pressed'),'true');
   // Catch the image replacement bug on the real online start endpoint too.
   mode='online-start';await offlineContext.setOffline(false);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'A) A',exact:true}).waitFor();assert.ok((await session(page))[0].questions[0].imageUrl.startsWith('data:image/png;'));
   mode='offline';await offlineContext.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await image(page);await page.getByRole('button',{name:'Sonraki',exact:true}).click();await page.getByRole('button',{name:'A) A',exact:true}).click();await page.getByRole('button',{name:'Quizi Bitir',exact:true}).click();await page.getByRole('button',{name:'Evet, Bitir',exact:true}).click();
   await page.getByText('Teslim yerel olarak kaydedildi. İnternet gelince otomatik gönderilecek.',{exact:true}).waitFor();const queued=(await session(page))[0];assert.equal(queued.pendingSubmit,true);assert.deepEqual(queued.answers,Object.fromEntries(runtime.fixture.questionIds.map(id=>[id,'A'])));assert.ok(queued.answerRevisions[runtime.fixture.questionIds[0]]>=1);assert.ok(queued.answerRevisions[runtime.fixture.questionIds[1]]>=1);
   await page.reload({waitUntil:'domcontentloaded'});await image(page);await page.getByText('Teslim yerel olarak kaydedildi. İnternet gelince otomatik gönderilecek.',{exact:true}).waitFor();await shot(page,'offline-queued-submit');
   mode='reconnect';await offlineContext.setOffline(false);await poll(async()=>await db.studentResult.count({where:{studentId:actor.id,quizId:runtime.fixture.offlineQuiz,status:'completed'}})===1,30000);
   const result=await db.studentResult.findFirstOrThrow({where:{studentId:actor.id,quizId:runtime.fixture.offlineQuiz}});assert.equal(await db.studentResult.count({where:{studentId:actor.id,quizId:runtime.fixture.offlineQuiz}}),1);assert.equal(result.score,100);assert.equal(result.correctAnswersCount,2);assert.equal(result.totalQuestions,2);assert.deepEqual(JSON.parse(result.answers),queued.answers);
   const csrf=await (await browserApi(offlineContext,runtime.origin,'/api/csrf-token')).json();const duplicate=await browserApi(offlineContext,runtime.origin,'/api/student/quiz/'+result.id+'/submit',{method:'POST',data:{answers:queued.answers},headers:{'x-csrf-token':csrf.csrfToken}});assert.equal((await duplicate.json()).acceptedQueuedAnswers,false);assert.equal(await db.studentResult.count({where:{studentId:actor.id,quizId:runtime.fixture.offlineQuiz}}),1);
   await page.waitForURL(url('/student/result/'+result.id),{timeout:30000});await page.reload({waitUntil:'domcontentloaded'});await poll(()=>page.getByRole('heading').count().then(n=>n>0));await shot(page,'offline-reconnected-result');
   exclusiveJson(evidence,'offline-database-proof.json',{oneResult:true,score:100,correctAnswers:2,totalQuestions:2,answersExact:true,duplicateIdempotent:true,privateImageSurvivedOnlineStart:true,base});checkpoint('fresh never-visited offline direct/reload diagram pixels, answers+revisions, online-start copy preservation, queued reload, reconnect EXACTone correct result');await offlineContext.close();
   // Actual browser quota rejection leaves the UI unprepared after reload.
   if(!base){
     mode='quota';const quotaContext=await fresh(student(3));await quotaContext.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('quiz-master:offline-session:'))throw new DOMException('synthetic quota','QuotaExceededError');return set.call(this,key,value);};});const quotaPage=await quotaContext.newPage();track(quotaPage);const quotaRow=await list(quotaPage);await quotaRow.getByRole('button',{name:'Çevrimdışı Hazırla',exact:true}).click();await quotaPage.getByRole('alert').filter({hasText:'Sınav cihazda saklanamadı'}).waitFor({timeout:30000});assert.equal((await session(quotaPage)).length,0);await quotaPage.reload({waitUntil:'domcontentloaded'});await heading(quotaPage,'Sınavlarım');assert.equal(await quotaPage.getByRole('button',{name:'Çevrimdışı Hazır',exact:true}).count(),0);await shot(quotaPage,'offline-quota-retry');checkpoint('actual production storage quota error, no persisted/ready state after reload');await quotaContext.close();
     mode='logout-inflight';const logoutContext=await fresh(student(4)),logoutPage=await logoutContext.newPage();track(logoutPage);let release,requested=false;const hold=new Promise(r=>release=r);await logoutPage.route('**/uploads/performance-diagram.png',async route=>{requested=true;await hold;await route.continue().catch(()=>{});});const logoutRow=await list(logoutPage);await logoutRow.getByRole('button',{name:'Çevrimdışı Hazırla',exact:true}).click();await poll(()=>requested);await logoutPage.getByRole('button',{name:/Sentetik Öğrenci/}).click();await logoutPage.getByRole('menuitem',{name:'Güvenli Çıkış',exact:true}).click();await logoutPage.waitForURL(url('/'));release();await new Promise(r=>setTimeout(r,200));assert.equal(await logoutPage.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('quiz-master:offline-session:')||k==='quiz-master:offline-user').length),0);checkpoint('actual in-flight image logout/unmount abort prevents late private persistence');await logoutContext.close();
     mode='shell-mime';const mimeContext=await fresh(student(6)),mimePage=await mimeContext.newPage();track(mimePage);const manifestFile=ownedFile(runtime.root,'client/dist/app-shell-assets.json',true),goodManifest=fs.readFileSync(manifestFile);
     try {
       const mimeRow=await list(mimePage);await mimePage.evaluate(()=>navigator.serviceWorker.ready);await cacheProof(mimePage);
       const token=await (await browserApi(mimeContext,runtime.origin,'/api/csrf-token')).json();const prepared=await (await browserApi(mimeContext,runtime.origin,'/api/student/quiz/'+runtime.fixture.offlineQuiz+'/prepare-offline',{method:'POST',data:{},headers:{'x-csrf-token':token.csrfToken}})).json();
       const old={version:1,userId:student(6).id,quizId:runtime.fixture.offlineQuiz,resultId:prepared.resultId,quiz:prepared.quiz,questions:prepared.questions,answers:{[runtime.fixture.questionIds[0]]:'B'},pendingAnswers:{[runtime.fixture.questionIds[0]]:'B'},answerRevisions:{[runtime.fixture.questionIds[0]]:2},pendingSubmit:true,remainingSeconds:null,timerCapturedAt:prepared.preparedAt,cachedAt:prepared.preparedAt,offlinePrepared:true,offlineEntry:'previous-entry-that-is-not-ready'};
       await mimePage.evaluate(old=>localStorage.setItem(`quiz-master:offline-session:${old.userId}:${old.quizId}`,JSON.stringify(old)),old);
       const before=await mimePage.evaluate(async()=>await (await (await caches.open('quiz-master-app-v3:/')).match('/index.html')).text());
       const absent='/assets/absent-performance-'+crypto.randomUUID()+'.js';fs.writeFileSync(manifestFile,JSON.stringify({version:1,assets:[absent]}));
       const fallback=await mimeContext.request.get(runtime.origin+absent,{maxRedirects:0});assert.equal(fallback.status(),200);assert.ok(fallback.headers()['content-type'].includes('text/html'));
       await mimeRow.getByRole('button',{name:'Çevrimdışı Hazırla',exact:true}).click();await mimePage.getByRole('alert').filter({hasText:'Çevrimdışı uygulama hazırlanamadı'}).waitFor({timeout:30000});assert.equal(await mimePage.evaluate(old=>localStorage.getItem(`quiz-master:offline-session:${old.userId}:${old.quizId}`),old),JSON.stringify(old));
       assert.equal(await mimePage.evaluate(async()=>await (await (await caches.open('quiz-master-app-v3:/')).match('/index.html')).text()),before);await mimePage.reload({waitUntil:'domcontentloaded'});await heading(mimePage,'Sınavlarım');assert.equal(await mimePage.getByRole('button',{name:'Çevrimdışı Hazır',exact:true}).count(),0);checkpoint('actual missing entry HTML200 rejects shell readiness, prior cache/session/revisions/submit preserved, no Ready after reload');
     }finally{fs.writeFileSync(manifestFile,goodManifest);await mimeContext.close();}
   }
   // Legacy worker upgrade: preserve shared namespaces, mark old preparation
   // honestly unready, and retain queued answers while making a private copy.
   if(!base){
     mode='worker-upgrade';const workerFile=ownedFile(runtime.root,'client/dist/sw.js',true),currentWorker=fs.readFileSync(workerFile);const git=spawnSync('git',['show','acfe47c0aa30b91843a4bc47cf94dd8e812f0c04:client/public/sw.js'],{cwd:main});assert.equal(git.status,0);
     let upgradeContext;
     try{
       fs.writeFileSync(workerFile,git.stdout);upgradeContext=await fresh(student(5));const upgrade=await upgradeContext.newPage();track(upgrade);await list(upgrade);await upgrade.evaluate(()=>navigator.serviceWorker.ready);await poll(()=>upgrade.evaluate(()=>Boolean(navigator.serviceWorker.controller)));
       const token=await (await browserApi(upgradeContext,runtime.origin,'/api/csrf-token')).json();const response=await (await browserApi(upgradeContext,runtime.origin,'/api/student/quiz/'+runtime.fixture.offlineQuiz+'/prepare-offline',{method:'POST',data:{},headers:{'x-csrf-token':token.csrfToken}})).json();
       const legacy={version:1,userId:student(5).id,quizId:runtime.fixture.offlineQuiz,resultId:response.resultId,quiz:response.quiz,questions:response.questions.map(q=>({...q,options:typeof q.options==='string'?JSON.parse(q.options):q.options})),answers:{[runtime.fixture.questionIds[0]]:'B'},pendingAnswers:{[runtime.fixture.questionIds[0]]:'B'},answerRevisions:{[runtime.fixture.questionIds[0]]:3},pendingSubmit:true,remainingSeconds:null,timerCapturedAt:response.preparedAt,cachedAt:response.preparedAt,started:false};
       await upgrade.evaluate(async legacy=>{localStorage.setItem(`quiz-master:offline-session:${legacy.userId}:${legacy.quizId}`,JSON.stringify(legacy));await fetch('/uploads/performance-diagram.png').then(r=>r.blob());const shared=await caches.open('quiz-master-app-v2');await shared.put('/other-base/index.html',new Response('other base retained'));const other=await caches.open('other-origin-app');await other.put('/unrelated.txt',new Response('unrelated retained'));},legacy);
       await poll(()=>upgrade.evaluate(async()=>Boolean(await (await caches.open('quiz-master-app-v2')).match('/uploads/performance-diagram.png'))));
       fs.writeFileSync(workerFile,currentWorker);await upgrade.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();const worker=registration.installing||registration.waiting;if(worker&&worker.state!=='activated')await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('upgrade activation deadline')),15000);worker.addEventListener('statechange',()=>{if(worker.state==='activated'){clearTimeout(timer);resolve();}else if(worker.state==='redundant'){clearTimeout(timer);reject(Error('upgrade rejected'));}});});});
       const upgradedRow=await list(upgrade);assert.equal(await upgrade.getByRole('button',{name:'Çevrimdışı Hazır',exact:true}).count(),0);await upgradedRow.getByRole('button',{name:'Çevrimdışı Hazırla',exact:true}).click();await upgradedRow.getByRole('button',{name:'Çevrimdışı Hazır',exact:true}).waitFor({timeout:30000});const newSession=(await session(upgrade))[0];assert.equal(newSession.pendingSubmit,true);assert.deepEqual(newSession.answers,legacy.answers);assert.deepEqual(newSession.answerRevisions,legacy.answerRevisions);assert.ok(newSession.questions[0].imageUrl.startsWith('data:image/'));
       assert.equal(await upgrade.evaluate(async()=>await (await (await caches.open('quiz-master-app-v2')).match('/other-base/index.html')).text()),'other base retained');assert.equal(await upgrade.evaluate(async()=>await (await (await caches.open('other-origin-app')).match('/unrelated.txt')).text()),'unrelated retained');await cacheProof(upgrade);
       await upgradeContext.setOffline(true);await upgrade.goto(url('/student/quiz/'+runtime.fixture.offlineQuiz),{waitUntil:'domcontentloaded'});await image(upgrade);await shot(upgrade,'worker-upgrade-private-diagram-queue');checkpoint('actual v2→v3 upgrade, other-base/unrelated cache retained, truthful reprepare, queued answers/revisions/submit and private image survive');
     }finally{fs.writeFileSync(workerFile,currentWorker);if(upgradeContext)await upgradeContext.close();}
   }
   assert.equal(pageErrors.filter(e=>!e.expected).length,0);exclusiveJson(evidence,'browser-network.json',{network,pageErrors,expectedOfflineFailures:network.filter(r=>r.mode==='offline'&&r.status===0).length});
   return {checks,unexpectedPageErrors:0,networkRequests:network.length,base};
 }catch(error){
   if(activePage&&!activePage.isClosed())await shot(activePage,'browser-failure-'+mode).catch(()=>{});
   exclusiveJson(evidence,'browser-network.json',{network,pageErrors});
   if(activePage&&!activePage.isClosed()){
     const workers=activePage.context().serviceWorkers();if(workers.length&&!fs.existsSync(ownedFile(evidence,'worker-vary-proof.json')))exclusiveJson(evidence,'worker-vary-proof.json',await workers[0].evaluate(()=>globalThis.performanceVaryProof||[]).catch(()=>[]));
     const shell=await activePage.evaluate(async base=>{const cache=await caches.open('quiz-master-app-v3:'+(base||'/'));const entries=[];for(const request of await cache.keys()){const response=await cache.match(request);entries.push({path:new URL(request.url).pathname,vary:response.headers.get('vary'),type:response.headers.get('content-type')});}return {controlled:Boolean(navigator.serviceWorker.controller),rootChildren:document.getElementById('root')?.childElementCount,scripts:[...document.scripts].map(s=>new URL(s.src||location.href).pathname),entries};},base).catch(()=>({diagnosticUnavailable:true}));exclusiveJson(evidence,'browser-shell-diagnostic.json',shell);
   }
   exclusiveJson(evidence,'browser-incomplete.json',{mode,checks,unexpectedPageErrors:pageErrors.filter(e=>!e.expected).length});
   throw error;
 }finally{for(const context of contexts.reverse())await context.close().catch(()=>{});}
}

export async function acceptHistoryBrowser({browser,runtime,evidence,db,contextFor,poll}){
 const context=await contextFor(runtime.fixture.actors[0]);
 try {const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.name));await page.goto(runtime.origin+'/archive',{waitUntil:'domcontentloaded'});const select=page.getByLabel('Eğitim yılı',{exact:true});await select.waitFor();await select.selectOption(runtime.fixture.yearId);await page.getByText('Geçmiş yıl · Salt okunur',{exact:true}).waitFor();await page.goto(runtime.origin+'/results',{waitUntil:'domcontentloaded'});await page.getByRole('region',{name:'Geçmiş eğitim yılı arşivi'}).waitFor();await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('region',{name:'Geçmiş eğitim yılı arşivi'}).waitFor();const active=await db.academicYear.findFirstOrThrow({where:{status:'active'}});await select.selectOption(active.id);await page.getByRole('heading',{name:'Sınav Sonuçları',exact:true}).waitFor();await select.selectOption(runtime.fixture.yearId);await page.getByRole('region',{name:'Geçmiş eğitim yılı arşivi'}).waitFor();await poll(()=>page.getByRole('button',{name:'Ayrıntıları görüntüle',exact:true}).count().then(n=>n>0));await page.screenshot({path:ownedFile(evidence,'historical-readonly-reselection.png'),fullPage:true});assert.equal(errors.length,0);return {historicalReadonly:true,refresh:true,activeReselection:true,completedReselection:true,pageErrors:0};}
 finally{await context.close();}
}

// Final visual evidence waits for settled data, including the legitimate empty
// active-year lists after the separately accepted annual rollover.
export async function acceptSettledRolesBrowser({runtime,evidence,contextFor}){
 const cases=[['admin','/archive','Arşivlenebilir içerik bulunmuyor.'],['teacher','/results','Görüntülenecek Veri Yok'],['student','/student/quizzes','Aradığınız sınav bulunamadı.'],['parent','/parent/results','Tamamlanmış sınav bulunmuyor.']],proof=[];
 for(const [role,route,settled] of cases){const context=await contextFor(runtime.fixture.actors.find(a=>a.role===role));try{const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.name));await page.goto(runtime.origin+route,{waitUntil:'domcontentloaded'});await page.getByText(settled,{exact:typeof settled==='string'}).waitFor({timeout:30000});await page.reload({waitUntil:'domcontentloaded'});await page.getByText(settled,{exact:typeof settled==='string'}).waitFor({timeout:30000});if(role==='parent')await page.getByRole('combobox',{name:'Öğrenci seçin',exact:true}).waitFor();assert.equal(await page.getByRole('alert').count(),0);assert.equal(errors.length,0);const file=ownedFile(evidence,'settled-role-'+role+'.png');await page.screenshot({path:file,fullPage:true});fs.chmodSync(file,0o600);proof.push({role,settled:true,reload:true,alerts:0,pageErrors:0});}finally{await context.close();}}
 return {checks:proof,activeYearAfterRollover:true};
}
