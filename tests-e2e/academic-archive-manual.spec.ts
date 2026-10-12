import {test,expect} from '@playwright/test';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {assertIsolatedRuntime,prisma,login,api} from './academic-archive-helpers';

// Independent reader verifies actual downloaded stored ZIP entries and their CRC.
function downloadedFiles(zip:Buffer){
  const files=new Map<string,Buffer>();let offset=0;
  while(offset+30<=zip.length&&zip.readUInt32LE(offset)===0x04034b50){
    expect(zip.readUInt16LE(offset+8)).toBe(0);
    const size=zip.readUInt32LE(offset+18),nameLength=zip.readUInt16LE(offset+26),extraLength=zip.readUInt16LE(offset+28);
    const name=zip.subarray(offset+30,offset+30+nameLength).toString('utf8');
    expect(name.split('/').some(part=>part==='..'||part==='.')).toBe(false);expect(files.has(name)).toBe(false);
    const start=offset+30+nameLength+extraLength,bytes=zip.subarray(start,start+size);
    expect(bytes.length).toBe(size);let crc=0xffffffff;
    for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;}
    expect((crc^0xffffffff)>>>0).toBe(zip.readUInt32LE(offset+14));files.set(name,bytes);offset=start+size;
  }
  expect(files.size).toBeGreaterThan(0);expect(zip.readUInt32LE(offset)).toBe(0x02014b50);
  return files;
}
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');

test('real manual selection archives only chosen exam and survey and downloads the verified ZIP after session password confirmation',async({page,browser})=>{
  test.setTimeout(120000);
  const runtime=assertIsolatedRuntime(),db=prisma(),errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    // This scenario runs in its own fresh runner; fixtures are business data only.
    expect(await db.archiveSnapshot.count()).toBe(0);
    const admin=await db.user.findUniqueOrThrow({where:{email:'academic-admin@example.test'}});
    const active=await db.academicYear.findFirstOrThrow({where:{status:'active'}});
    const year=await db.academicYear.update({where:{id:active.id},data:{scheduledCloseAt:new Date('2099-07-14T21:05:00Z')}});
    const teacher=await db.user.create({data:{name:'Manual fixture teacher',email:randomUUID()+'@example.test',password:'manual-synthetic-password',role:'teacher'}});
    const source=await db.class.create({data:{name:'Manual source '+randomUUID()}});
    const target=await db.class.create({data:{name:'Manual next '+randomUUID()}});
    const student=await db.user.create({data:{name:'Manual selected participant',email:randomUUID()+'@example.test',password:'manual-synthetic-password',role:'student',classId:source.id,studentNo:1}});
    const untouchedStudent=await db.user.create({data:{name:'Manual unselected participant',email:randomUUID()+'@example.test',password:'manual-synthetic-password',role:'student',classId:source.id,studentNo:2}});
    await db.academicTransitionRule.create({data:{yearId:year.id,fromClassId:source.id,toClassId:target.id,graduate:false}});
    const quiz=async(title:string,contentType:string)=>db.quiz.create({data:{title,contentType,status:'published',publishedAt:new Date('2026-06-20T09:00:00Z'),createdBy:teacher.id,assignedClasses:{connect:{id:source.id}}}});
    const exam=await quiz('Manual chosen exam '+randomUUID(),'exam'),survey=await quiz('Manual chosen survey '+randomUUID(),'survey'),unselected=await quiz('Manual untouched exam '+randomUUID(),'exam');
    const question=await db.question.create({data:{quizId:exam.id,text:'Manual chosen question',type:'short-answer',correctAnswer:'5',order:0}});
    const surveyQuestion=await db.question.create({data:{quizId:survey.id,text:'Manual frozen survey question',type:'short-answer',correctAnswer:null,order:0}});
    const unselectedQuestion=await db.question.create({data:{quizId:unselected.id,text:'Manual untouched question',type:'short-answer',correctAnswer:'9',order:0}});
    const result=await db.studentResult.create({data:{studentId:student.id,quizId:exam.id,score:85,status:'completed',answers:JSON.stringify({[question.id]:'5'})}});
    const untouchedResult=await db.studentResult.create({data:{studentId:untouchedStudent.id,quizId:unselected.id,score:95,status:'completed'}});
    const submission=await db.surveySubmission.create({data:{surveyId:survey.id,studentId:student.id}});
    const answer=await db.surveyAnswer.create({data:{submissionId:submission.id,questionId:surveyQuestion.id,value:'Manual frozen survey answer'}});
    const sourceBefore=await db.class.findUniqueOrThrow({where:{id:source.id}});
    const peopleBefore=await db.user.findMany({where:{id:{in:[teacher.id,student.id,untouchedStudent.id]}},orderBy:{id:'asc'}});

    await login(page);await page.goto('/archive',{waitUntil:'domcontentloaded'});
    await expect(page.getByRole('tab',{name:'Manuel Arşiv',exact:true})).toBeVisible();
    await page.getByLabel(exam.title+' (Sınav)',{exact:true}).check();
    await page.getByLabel(survey.title+' (Anket)',{exact:true}).check();
    await expect(page.getByLabel(unselected.title+' (Sınav)',{exact:true})).not.toBeChecked();
    await expect(page.getByText('2 içerik, 1 sınav sonucu, 1 anket yanıtı, 2 soru seçildi.',{exact:true})).toBeVisible();
    const createdResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/admin/archive'&&response.request().method()==='POST');
    await page.getByRole('button',{name:'Seçilenleri Arşivle',exact:true}).click();
    const created=await createdResponse;expect(created.status()).toBe(202);const jobId=(await created.json()).job.id;
    await expect(page.getByRole('status').filter({hasText:'Arşiv işlemi kuyruğa alındı'})).toBeVisible();
    // Worker discovery can take 15s; Chromium launch and PDF generation each
    // have a separate 30s bound. Keep the overall 120s scenario unchanged.
    await expect.poll(async()=>(await db.archiveSnapshot.findUniqueOrThrow({where:{id:jobId}})).status,{timeout:90000}).toBe('completed');
    const completed=await db.archiveSnapshot.findUniqueOrThrow({where:{id:jobId}});
    expect(completed).toMatchObject({mode:'manual',academicYearId:year.id,initiatedBy:admin.id,annualKey:null,transitionSummaryJson:null});
    expect(JSON.parse(completed.scopeJson).quizIds.sort()).toEqual([exam.id,survey.id].sort());
    expect(await db.archiveSnapshot.count()).toBe(1);
    expect(await db.academicYear.findUniqueOrThrow({where:{id:year.id}})).toEqual(year);expect(await db.academicYear.count()).toBe(1);
    expect(await db.user.findMany({where:{id:{in:[teacher.id,student.id,untouchedStudent.id]}},orderBy:{id:'asc'}})).toEqual(peopleBefore);
    expect(await db.class.findUniqueOrThrow({where:{id:source.id}})).toEqual(sourceBefore);
    expect(await db.quiz.findUniqueOrThrow({where:{id:unselected.id}})).toEqual(unselected);
    expect(await db.question.findUniqueOrThrow({where:{id:unselectedQuestion.id}})).toEqual(unselectedQuestion);
    expect(await db.studentResult.findUniqueOrThrow({where:{id:untouchedResult.id}})).toEqual(untouchedResult);
    for(const id of [exam.id,survey.id])expect(await db.quiz.findUniqueOrThrow({where:{id}})).toMatchObject({status:'archived',academicYear:year.label});
    expect(await db.studentResult.findUniqueOrThrow({where:{id:result.id}})).toMatchObject({score:85,academicYear:year.label});

    const downloadPath=`/admin/archive/jobs/${jobId}/download`,authorizePath=`/api/admin/archive/jobs/${jobId}/download-authorize`;
    expect((await api(page,'GET',downloadPath)).status()).toBe(403);
    await page.getByRole('tab',{name:'Geçmiş ve İşler',exact:true}).click();
    await page.getByRole('button',{name:'Arşivi İndir',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Arşiv İndirme Doğrulaması',exact:true});
    await dialog.getByLabel('Yönetici şifresi',{exact:true}).fill('WrongSyntheticPassword!');
    const deniedResponse=page.waitForResponse(response=>new URL(response.url()).pathname===authorizePath&&response.request().method()==='POST');
    await dialog.getByRole('button',{name:'Şifreyi Doğrula ve İndir',exact:true}).click();expect((await deniedResponse).status()).toBe(403);
    await expect(dialog.getByRole('alert')).toHaveText('Şifre doğrulanamadı.');
    await expect(dialog.getByLabel('Yönetici şifresi',{exact:true})).toHaveValue('');
    expect((await api(page,'GET',downloadPath)).status()).toBe(403);
    expect(await db.actionLog.count({where:{action:'ARCHIVE_DOWNLOAD_AUTHORIZED',details:{contains:jobId}}})).toBe(0);
    await dialog.getByLabel('Yönetici şifresi',{exact:true}).fill('AcademicFixtureOnly2026!');
    const authorizedResponse=page.waitForResponse(response=>new URL(response.url()).pathname===authorizePath&&response.request().method()==='POST');
    const downloadedResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api'+downloadPath&&response.request().method()==='GET');
    const downloadEvent=page.waitForEvent('download');
    await dialog.getByRole('button',{name:'Şifreyi Doğrula ve İndir',exact:true}).click();
    const authorized=await authorizedResponse;expect(authorized.status()).toBe(200);expect((await authorized.json()).expiresAt).toBeGreaterThan(Date.now());
    const served=await downloadedResponse;expect(served.status()).toBe(200);expect(served.headers()['cache-control']).toBe('no-store');
    const download=await downloadEvent;expect(await download.failure()).toBeNull();expect(download.suggestedFilename()).toBe(`archive-${jobId}.zip`);
    const saved=path.join(runtime.root,'manual-verified-download.zip');await download.saveAs(saved);const zip=await readFile(saved);
    expect(digest(zip)).toBe(completed.zipSha256);expect(zip.length).toBe(completed.sizeBytes);expect(zip).toEqual(await readFile(completed.artifactPath!));
    await expect(dialog).not.toBeVisible();
    expect(await db.actionLog.count({where:{action:'ARCHIVE_DOWNLOAD_AUTHORIZED',details:{contains:jobId}}})).toBe(1);
    // The password grant belongs to this session, even for the same admin account.
    const secondContext=await browser.newContext({baseURL:runtime.baseURL});
    try{const secondPage=await secondContext.newPage();await login(secondPage);expect((await api(secondPage,'GET',downloadPath)).status()).toBe(403);}finally{await secondContext.close();}

    const files=downloadedFiles(zip),records=JSON.parse(files.get('records.json')!.toString()).rows;
    expect([...files.keys()].filter(name=>name.endsWith('.csv')).sort()).toEqual(['csv/courses-assignments.csv','csv/people-classes.csv','csv/quizzes-questions.csv','csv/results-surveys.csv']);
    const frozen=await db.archiveSnapshotRow.findMany({where:{snapshotId:jobId}});
    expect(records.map((record:any)=>[record.entityType,record.entityId,record.data]).sort()).toEqual(frozen.map((record:any)=>[record.entityType,record.entityId,JSON.parse(record.dataJson)]).sort());
    expect(records.filter((record:any)=>record.entityType==='quiz').map((record:any)=>record.entityId).sort()).toEqual([exam.id,survey.id].sort());
    expect(records.some((record:any)=>record.entityId===unselected.id||record.entityId===unselectedQuestion.id||record.entityId===untouchedResult.id||record.entityId===untouchedStudent.id)).toBe(false);
    expect(records.find((record:any)=>record.entityType==='result'&&record.entityId===result.id).data.score).toBe(85);
    expect(records.find((record:any)=>record.entityType==='surveyAnswer'&&record.entityId===answer.id).data.value).toBe(answer.value);
    expect(zip.toString()).not.toContain('manual-synthetic-password');
    for(const person of records.filter((record:any)=>record.entityType==='user')){expect(person.data).not.toHaveProperty('password');expect(person.data).not.toHaveProperty('sessionVersion');}
    const meta=JSON.parse(files.get('meta.json')!.toString());expect(meta).toMatchObject({formatVersion:2,snapshotId:jobId,capturedAt:completed.capturedAt!.toISOString(),initiatedBy:admin.id});
    const manifest=JSON.parse(files.get('manifest.json')!.toString());
    for(const entry of manifest.files){const bytes=files.get(entry.path)!;expect(bytes.length).toBe(entry.bytes);expect(digest(bytes)).toBe(entry.sha256);}
    const checksums=JSON.parse(files.get('checksums.json')!.toString());expect(checksums).not.toHaveProperty('archive.zip');
    for(const [name,sha] of Object.entries(checksums))expect(digest(files.get(name)!)).toBe(sha);
    expect(files.get('pdfs/report.pdf')!.subarray(0,5).toString()).toBe('%PDF-');
    expect(await db.archiveSnapshot.findUniqueOrThrow({where:{id:jobId}})).toEqual(completed);expect(errors).toEqual([]);
  }finally{await db.$disconnect();}
});
