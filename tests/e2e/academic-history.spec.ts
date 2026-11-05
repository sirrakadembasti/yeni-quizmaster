import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { assertIsolatedRuntime, prisma, login, api } from './academic-archive-helpers';
import { captureArchive } from '../../server/services/archive-capture';
import { createArchiveWorker } from '../../server/services/archive-worker';
import { exportArchive } from '../../server/services/archive-export';
const diagnosticTimelines=new WeakMap<object,Record<string,unknown>[]>();

test.afterEach(async({page},info)=>{
  const failed=info.status!==info.expectedStatus;
  assertIsolatedRuntime();
  const evidence=path.resolve('.superpowers/sdd/2026-10-05-academic-archive-review-plan/task-5-chrome-diagnostics',new Date().toISOString().replace(/[:.]/g,'-'));
  mkdirSync(evidence,{recursive:true});
  const states=[];
  for(const [index,opened] of page.context().pages().entries()){
    try{
      states.push({...await opened.evaluate(()=>{
        const selector=document.querySelector<HTMLSelectElement>('select[aria-label="Eğitim yılı"]');
        const historical=document.querySelector('[aria-label="Geçmiş eğitim yılı arşivi"]');
        return {at:new Date().toISOString(),path:location.pathname,tab:new URLSearchParams(location.search).get('tab'),year:selector?.value,yearDisabled:selector?.disabled,options:selector?Array.from(selector.options).map(option=>({value:option.value,label:option.textContent})):[],status:Array.from(document.querySelectorAll('[role="status"]')).map(node=>node.textContent?.slice(0,500)),alerts:Array.from(document.querySelectorAll('[role="alert"]')).map(node=>node.textContent?.slice(0,500)),historical:!!historical,historicalTabs:historical?Array.from(historical.querySelectorAll('[role="tab"]')).map(node=>({label:node.textContent,selected:node.getAttribute('aria-selected')})):[],timeline:(window as any).__academicContextDiagnostics??[]};
      }),timeline:diagnosticTimelines.get(opened)??[]});
      if(failed)await opened.screenshot({path:path.join(evidence,`page-${index}.png`),timeout:5000});
    }catch{states.push({page:index,captureFailed:true});}
  }
  writeFileSync(path.join(evidence,'state.json'),JSON.stringify({status:info.status,states},null,2));
  console.log('Sanitized academic context diagnostics:',path.relative(process.cwd(),evidence));
});

test('actual captured history separates exam/survey data and preserves management tabs across year changes',async({page})=>{
  test.setTimeout(120000);
  const runtime=assertIsolatedRuntime();
  const imageBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF7sAAAAASUVORK5CYII=','base64');
  const uploadsRoot=path.join(runtime.root,'server','uploads');mkdirSync(uploadsRoot,{recursive:true});
  const imageName=randomUUID()+'.png',imageFile=path.join(uploadsRoot,imageName);writeFileSync(imageFile,imageBytes);
  await page.context().exposeBinding('academicContextDiagnostic',({page:source},row)=>{
    const allowed=['at','type','path','method','status','name','phase','nonce','invalid'];
    const safe=Object.fromEntries(allowed.filter(key=>['string','number','boolean'].includes(typeof row?.[key])).map(key=>[key,row[key]]));
    const timeline=diagnosticTimelines.get(source)??[];timeline.push(safe);diagnosticTimelines.set(source,timeline);
  });
  await page.context().addInitScript(()=>{
    const rows:any[]=[];
    (window as any).__academicContextDiagnostics=rows;
    const contextPath='/api/admin/academic-history/context';
    const record=(type:string,data:Record<string,unknown>={})=>{
      rows.push({at:new Date().toISOString(),type,...data});
      void (window as any).academicContextDiagnostic(rows[rows.length-1]).catch(()=>{});
    };
    const fetchOriginal=window.fetch;
    window.fetch=async(input,options)=>{
      const address=typeof input==='string'?input:input instanceof URL?input.href:input.url;
      const watched=new URL(address,location.href).pathname===contextPath;
      const method=options?.method??(input instanceof Request?input.method:'GET');
      if(watched)record('fetch-start',{path:contextPath,method});
      try{const response=await fetchOriginal.call(window,input,options);if(watched)record('fetch-resolved',{path:contextPath,method,status:response.status});return response;}
      catch(error){if(watched)record('fetch-rejected',{path:contextPath,method,name:(error as Error).name});throw error;}
    };
    const jsonOriginal=Response.prototype.json;
    Response.prototype.json=async function(){
      const watched=new URL(this.url||'/',location.href).pathname===contextPath;
      if(watched)record('json-start',{status:this.status});
      try{const data=await jsonOriginal.call(this);if(watched)record('json-resolved',{status:this.status});return data;}
      catch(error){if(watched)record('json-rejected',{status:this.status,name:(error as Error).name});throw error;}
    };
    const itemOriginal=Storage.prototype.setItem;
    const sync=(type:string,key:string,value:string|null)=>{
      if(key!=='quizmaster:academic-context'||!value)return;
      try{const data=JSON.parse(value);record(type,{phase:data.phase,nonce:data.nonce});}catch{record(type,{invalid:true});}
    };
    Storage.prototype.setItem=function(key,value){itemOriginal.call(this,key,value);sync('storage-set',key,value);};
    window.addEventListener('storage',event=>sync('storage-received',event.key??'',event.newValue));
  });
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  const db=prisma();
  let yearId:string,examId:string,surveyId:string,studentId:string,teacherId:string,classId:string,adminId:string;
  try {
    adminId=(await db.user.findUniqueOrThrow({where:{email:'academic-admin@example.test'}})).id;
    const teacher=await db.user.create({data:{name:'Frozen History Teacher',email:randomUUID()+'@example.test',password:'synthetic',role:'teacher'}});
    const cls=await db.class.create({data:{name:'Frozen History Class',classTeacherId:teacher.id,teachers:{connect:{id:teacher.id}}}});
    const next=await db.class.create({data:{name:'Current History Class'}});
    const student=await db.user.create({data:{name:'Frozen History Student',email:randomUUID()+'@example.test',password:'synthetic',role:'student',classId:cls.id}});
    const course=await db.category.create({data:{name:'Frozen History Course',teachers:{connect:{id:teacher.id}},classes:{connect:{id:cls.id}}}});
    const assignment=await db.classTeacherCourse.create({data:{classId:cls.id,teacherId:teacher.id,categoryId:course.id}});
    const exam=await db.quiz.create({data:{title:'History Exam Only',contentType:'exam',createdBy:teacher.id,categoryId:course.id,assignedClasses:{connect:{id:cls.id}}}});
    const survey=await db.quiz.create({data:{title:'History Survey Only',contentType:'survey',createdBy:teacher.id,assignedClasses:{connect:{id:cls.id}}}});
    await db.question.create({data:{quizId:exam.id,text:'Frozen exam question',type:'short-answer',correctAnswer:'yes',order:0,imageUrl:'/uploads/'+imageName}});
    const question=await db.question.create({data:{quizId:survey.id,text:'Frozen survey question',type:'short-answer',order:0}});
    await db.studentResult.create({data:{studentId:student.id,quizId:exam.id,status:'completed',score:80}});
    await db.studentResult.create({data:{studentId:student.id,quizId:survey.id,status:'completed',score:10}});
    const submission=await db.surveySubmission.create({data:{studentId:student.id,surveyId:survey.id}});
    await db.surveyAnswer.create({data:{submissionId:submission.id,questionId:question.id,value:'Frozen survey answer'}});
    const active=await db.academicYear.findFirst({where:{status:'active'}});
    const year=active??await db.academicYear.create({data:{label:'2026-2027',opensAt:new Date(),scheduledCloseAt:new Date('2027-09-01')}});
    await db.academicTransitionRule.create({data:{yearId:year.id,fromClassId:cls.id,toClassId:next.id}});
    // A future fixture clock reclaims this live-to-server lease without allowing
    // the running worker to race the seed. SQL still checks its real wall clock.
    const leaseOwner='history-fixture-'+randomUUID();
    const snapshot=await db.archiveSnapshot.create({data:{academicYearId:year.id,label:year.label,mode:'annual',scopeJson:'{}',leaseOwner,leaseExpiresAt:new Date(Date.now()+120000)}});
    await captureArchive(db,snapshot.id,{owner:leaseOwner,now:()=>new Date()});
    const fixtureClock=new Date(Date.now()+120001);
    await createArchiveWorker({db,backupRoot:path.join(runtime.root,'artifacts'),owner:leaseOwner,now:()=>new Date(fixtureClock),export:(input,root)=>exportArchive(input,root,{uploadsRoot})}).tick();
    expect((await db.archiveSnapshot.findUniqueOrThrow({where:{id:snapshot.id}})).status).toBe('completed');
    writeFileSync(imageFile,'Synthetic live upload changed after publication');
    await db.user.update({where:{id:student.id},data:{name:'Current History Student',classId:next.id}});
    await db.user.update({where:{id:teacher.id},data:{name:'Current History Teacher'}});
    await db.class.update({where:{id:cls.id},data:{name:'Renamed History Class',teachers:{set:[]},classTeacherId:null}});
    await db.category.update({where:{id:course.id},data:{name:'Current History Course'}});
    await db.classTeacherCourse.delete({where:{id:assignment.id}});
    yearId=year.id;examId=exam.id;surveyId=survey.id;studentId=student.id;teacherId=teacher.id;classId=cls.id;
  } finally {await db.$disconnect();}
  await login(page);
  await page.context().route('**/*',route=>new URL(route.request().url()).origin===runtime.baseURL?route.continue():route.abort());
  await page.goto('/management',{waitUntil:'domcontentloaded'});
  await page.getByRole('tab',{name:'Sınıflar',exact:true}).click();
  await expect(page).toHaveURL(/tab=classes/);
  const other=await page.context().newPage();
  other.on('pageerror',error=>errors.push(error.message));
  await other.goto('/students',{waitUntil:'domcontentloaded'});
  await expect(other.getByLabel('Eğitim yılı',{exact:true})).toBeEnabled();
  let releaseSelection!:()=>void;
  const pendingSelection=new Promise<void>(resolve=>{releaseSelection=resolve;});
  const holdSelection=async(route:any)=>{if(route.request().method()==='POST')await pendingSelection;await route.continue();};
  await page.route('**/api/admin/academic-history/context',holdSelection);
  await page.getByLabel('Eğitim yılı',{exact:true}).selectOption(yearId);
  await expect(other.getByLabel('Eğitim yılı',{exact:true})).toBeDisabled();
  await expect(other.getByRole('status').filter({hasText:'Eğitim yılı doğrulanıyor'})).toBeVisible();
  releaseSelection();
  const history=page.getByRole('region',{name:'Geçmiş eğitim yılı arşivi'});
  await expect(history.getByRole('tab',{name:'Sınıflar',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(history.getByRole('cell',{name:'Frozen History Class',exact:true})).toBeVisible();
  await expect(other.getByLabel('Eğitim yılı',{exact:true})).toHaveValue(yearId);
  await expect(other.getByRole('region',{name:'Geçmiş eğitim yılı arşivi'})).toBeVisible();
  await page.unroute('**/api/admin/academic-history/context',holdSelection);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(history.getByRole('tab',{name:'Sınıflar',exact:true})).toHaveAttribute('aria-selected','true');
  await history.getByRole('tab',{name:'Sınavlar',exact:true}).click();
  await expect(history.getByRole('cell',{name:'History Exam Only',exact:true})).toBeVisible();
  await expect(history.getByRole('cell',{name:'History Survey Only',exact:true})).toHaveCount(0);
  await history.getByRole('tab',{name:'Anketler',exact:true}).click();
  await expect(history.getByRole('cell',{name:'History Survey Only',exact:true})).toBeVisible();
  await expect(history.getByRole('cell',{name:'History Exam Only',exact:true})).toHaveCount(0);
  await page.goto(`/survey-results?surveyId=${surveyId}`,{waitUntil:'domcontentloaded'});
  await expect(history.getByRole('cell',{name:'Frozen survey answer',exact:true})).toBeVisible();
  await expect(history.getByRole('cell',{name:'Frozen History Student',exact:true})).toBeVisible();
  await page.goto(`/quizzes/${examId}?tab=questions`,{waitUntil:'domcontentloaded'});
  await expect(history.getByRole('cell',{name:'Frozen exam question',exact:true})).toBeVisible();
  await history.getByRole('button',{name:'Ayrıntıları görüntüle',exact:true}).click();
  const frozenImage=history.getByRole('img',{name:'Dondurulmuş soru görseli',exact:true});await expect(frozenImage).toBeVisible();
  const imageUrl=(await frozenImage.getAttribute('src'))!;
  expect(imageUrl).toMatch(new RegExp('^/api/admin/academic-history/years/'+yearId+'/assets/[a-f0-9]{64}\\.png$'));
  await expect.poll(()=>frozenImage.evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth===1)).toBe(true);
  const frozenImageResponse=await api(page,'GET',imageUrl);expect(frozenImageResponse.status()).toBe(200);expect(await frozenImageResponse.body()).toEqual(imageBytes);
  expect(await history.locator('img[src^="/uploads/"]').count()).toBe(0);
  await page.goto(`/statistics?classId=${classId}`,{waitUntil:'domcontentloaded'});
  await expect(history.getByLabel('Dondurulmuş sınav istatistikleri')).toContainText('Ortalama puan: 80.00');
  const assignmentResponse=await api(page,'GET',`/admin/academic-history/years/${yearId}/rows?type=teacherAssignment&teacherId=${teacherId}`);
  expect(assignmentResponse.status()).toBe(200);expect((await assignmentResponse.json()).rows[0]).toMatchObject({teacherName:'Frozen History Teacher',courseName:'Frozen History Course',className:'Frozen History Class'});
  const studentResponse=await api(page,'GET',`/admin/academic-history/years/${yearId}/rows?type=student&studentId=${studentId}`);
  expect((await studentResponse.json()).rows[0]).toMatchObject({name:'Frozen History Student',className:'Frozen History Class'});
  await page.goto('/management?tab=logs',{waitUntil:'domcontentloaded'});
  await expect(history.getByRole('note')).toContainText('günlükleri');
  await expect(history.getByRole('table')).toHaveCount(0);
  await expect(history.getByRole('tablist')).toHaveCount(0);
  // Session operations remain available and are labeled independently of the frozen year.
  const ops=prisma();
  const notification=await ops.notification.create({data:{userId:adminId!,title:'Current session operational notice',message:'Current session only',type:'announcement'}});
  await ops.$disconnect();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Bildirimleri aç',exact:true}).click();
  const notifications=page.getByRole('dialog');
  await expect(notifications).toContainText('Mevcut oturum bildirimleri');
  await expect(notifications).toContainText('Current session operational notice');
  await expect(notifications.getByRole('link',{name:'Detay',exact:true})).toHaveCount(0);
  await expect(notifications.getByRole('link',{name:'Tüm Bildirimleri Gör',exact:true})).toHaveCount(0);
  await notifications.getByRole('button',{name:'Hepsini Oku',exact:true}).click();
  await expect.poll(async()=>((await(await api(page,'GET','/notifications')).json()).notifications.find((row:any)=>row.id===notification.id)?.isRead)).toBe(true);
  await notifications.getByRole('button',{name:'Bildirimleri sessize al',exact:true}).click();
  await expect.poll(async()=>(await(await api(page,'GET','/notifications/preferences')).json()).muted).toBe(true);
  const noticeRow=notifications.getByText('Current session operational notice').locator('xpath=../../..');
  await noticeRow.getByRole('button',{name:'Bildirimi sil',exact:true}).click();
  await expect.poll(async()=>((await(await api(page,'GET','/notifications')).json()).notifications.some((row:any)=>row.id===notification.id))).toBe(false);
  await page.keyboard.press('Escape');
  // A regenerated login shares this browser's localStorage but starts in active mode.
  await page.evaluate(({userId,yearId})=>{localStorage.setItem(`academic-year:${userId}`,yearId);localStorage.setItem(`academic-year-mode:${userId}`,'historical');},{userId:adminId!,yearId});
  await login(page);
  await page.reload({waitUntil:'domcontentloaded'});
  const currentDb=prisma();
  const beforeRollover=await currentDb.academicYear.findFirstOrThrow({where:{status:'active'}});
  await expect(page.getByLabel('Eğitim yılı',{exact:true})).toHaveValue(beforeRollover.id);
  await page.goto('/students',{waitUntil:'domcontentloaded'});
  await other.reload({waitUntil:'domcontentloaded'});
  const closeCurrent=async()=>{
    const selected=await currentDb.academicYear.findFirstOrThrow({where:{status:'active'}});
    const students=await currentDb.user.findMany({where:{role:'student',isActive:true,graduationYear:null,graduationDate:null,classId:{not:null}},select:{classId:true}});
    for(const source of new Set(students.map((student:any)=>student.classId)))await currentDb.academicTransitionRule.create({data:{yearId:selected.id,fromClassId:source!,graduate:true}});
    const owner='context-fixture-'+randomUUID();
    const job=await currentDb.archiveSnapshot.create({data:{academicYearId:selected.id,label:selected.label,mode:'annual',scopeJson:'{}',leaseOwner:owner,leaseExpiresAt:new Date(Date.now()+120000)}});
    await captureArchive(currentDb,job.id,{owner,now:()=>new Date()});
    const clock=new Date(Date.now()+120001);
    await createArchiveWorker({db:currentDb,backupRoot:path.join(runtime.root,'artifacts'),owner,now:()=>new Date(clock)}).tick();
    expect((await currentDb.archiveSnapshot.findUniqueOrThrow({where:{id:job.id}})).status).toBe('completed');
    return currentDb.academicYear.findFirstOrThrow({where:{status:'active'}});
  };
  try{
    const afterRollover=await closeCurrent();
    // Neither page is the archive screen. The central poll updates both without navigation.
    await expect(page.getByLabel('Eğitim yılı',{exact:true})).toHaveValue(afterRollover.id,{timeout:20000});
    await expect(other.getByLabel('Eğitim yılı',{exact:true})).toHaveValue(afterRollover.id,{timeout:20000});
    await page.getByLabel('Eğitim yılı',{exact:true}).selectOption(yearId);
    await expect(other.getByLabel('Eğitim yılı',{exact:true})).toHaveValue(yearId);
    const newest=await closeCurrent();
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await other.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await expect(page.getByLabel('Eğitim yılı',{exact:true})).toHaveValue(yearId);
    await expect(other.getByLabel('Eğitim yılı',{exact:true})).toHaveValue(yearId);
    await expect(page.getByRole('option',{name:new RegExp(newest.label)})).toHaveCount(1);
    await page.getByLabel('Eğitim yılı',{exact:true}).selectOption(newest.id);
    await expect(other.getByLabel('Eğitim yılı',{exact:true})).toHaveValue(newest.id);
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'Menüyü aç',exact:true}).click();
    const mobileMenu=page.getByRole('dialog',{name:'Ana menü',exact:true});
    const mobileYear=mobileMenu.getByLabel('Eğitim yılı',{exact:true});
    await expect(mobileYear).toBeVisible();
    expect(await mobileYear.locator('option').first().getAttribute('value')).toBe(newest.id);
    const keyboardPast=(await mobileYear.locator('option').nth(1).getAttribute('value'))!;
    await mobileYear.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
    await expect(page.getByLabel('Eğitim yılı',{exact:true})).toHaveValue(keyboardPast);
    await expect(other.getByLabel('Eğitim yılı',{exact:true})).toHaveValue(keyboardPast);
    await expect(page.getByRole('region',{name:'Geçmiş eğitim yılı arşivi'})).toBeVisible();
    await expect(other.getByRole('region',{name:'Geçmiş eğitim yılı arşivi'})).toBeVisible();
    await page.getByRole('button',{name:'Menüyü aç',exact:true}).click();
    await expect(mobileMenu).toBeVisible();await page.keyboard.press('Escape');
    await expect(mobileMenu).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Menüyü aç',exact:true})).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    // The public security operation must remain reachable from a historical session.
    await page.goto('/reset-password?token=synthetic-boundary-token',{waitUntil:'domcontentloaded'});
    await expect(page.getByLabel('Yeni Şifre',{exact:true})).toBeVisible();
    await expect(page.getByRole('region',{name:'Geçmiş eğitim yılı arşivi'})).toHaveCount(0);
    await page.goto('/students',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Menüyü aç',exact:true}).click();
    await mobileMenu.getByLabel('Eğitim yılı',{exact:true}).selectOption(newest.id);
    await expect(other.getByLabel('Eğitim yılı',{exact:true})).toHaveValue(newest.id);
    await expect(page.getByRole('region',{name:'Geçmiş eğitim yılı arşivi'})).toHaveCount(0);
  }finally{await currentDb.$disconnect();await other.close();}
  expect(errors).toEqual([]);
});
