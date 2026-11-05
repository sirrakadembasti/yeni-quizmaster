import {expect,it,beforeEach,afterEach,vi} from 'vitest';
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
import {createRuntimePrismaClient} from '../../utils/sqlite-runtime';
import {AIUsageService,parseAIUsageFilters} from '../../services/ai-usage';
const require=createRequire(import.meta.url);
let db:ReturnType<typeof createRuntimePrismaClient>,dir:string,service:AIUsageService,teacher:any,peer:any,category:any;
beforeEach(async()=>{
 dir=fs.mkdtempSync(path.resolve('data/quizmaster-test-ai-usage-'));const filename=path.join(dir,'quiz.db');
 const SQLite=require('better-sqlite3'),native=new SQLite(filename);native.pragma('journal_mode=MEMORY');native.pragma('synchronous=OFF');
 try{for(const name of fs.readdirSync('prisma/migrations').sort()){const file=path.join('prisma/migrations',name,'migration.sql');if(fs.existsSync(file))native.exec(fs.readFileSync(file,'utf8'));}}finally{native.close();}
 db=createRuntimePrismaClient({databaseUrl:'file:'+filename.replaceAll('\\','/')});service=new AIUsageService(db);
 teacher=await db.user.create({data:{name:'Öğretmen',email:'teacher@example.invalid',password:'fixture',role:'teacher'}});
 peer=await db.user.create({data:{name:'Diğer',email:'peer@example.invalid',password:'fixture',role:'teacher'}});
 category=await db.category.create({data:{name:'Tarih',teachers:{connect:{id:teacher.id}}}});
},30000);
afterEach(async()=>{await db?.$disconnect();if(dir&&path.dirname(dir)===path.resolve('data')&&path.basename(dir).startsWith('quizmaster-test-ai-usage-'))fs.rmSync(dir,{recursive:true,force:true});});
const profile:any={id:'profile',name:'Profil',provider:'xiaomi_mimo',model:'mimo-v2.6-flash',revision:2,timeoutMs:120000,maxOutputTokens:8192,thinking:'auto'};
it('records real usage for a draft and binds only the owning teacher without duplicating rows',async()=>{
 const draftId=crypto.randomUUID(),context=await service.context(teacher,{draftId,quizTitle:'Kurtuluş',categoryId:category.id},'exam');
 const id=await service.start(teacher,profile,context,10);expect(id).toBeTruthy();
 await service.finish(id!,{status:'success',durationMs:25,validQuestionCount:10,usage:{inputTokens:100,outputTokens:500,reasoningTokens:100,cacheReadTokens:null,cacheWriteTokens:null,totalTokens:600}});
 const quiz=await db.quiz.create({data:{title:'Son başlık',createdBy:teacher.id}});
 await expect(service.bindDraft(peer.id,draftId,quiz.id)).rejects.toMatchObject({code:'AI_CONTEXT_FORBIDDEN'});
 await service.bindDraft(teacher.id,draftId,quiz.id);await service.bindDraft(teacher.id,draftId,quiz.id);
 const result=await service.list(parseAIUsageFilters({}));expect(result.total).toBe(1);
 expect(result.rows[0]).toMatchObject({teacherName:'Öğretmen',courseName:'Tarih',quizTitle:'Kurtuluş',quizId:quiz.id,inputTokens:100,outputTokens:500,reasoningTokens:100});
 expect(result.summary).toMatchObject({requests:1,inputTokens:100,outputTokens:500,unknownUsageRequests:0});
});
it('rejects foreign course and quiz attribution before a provider request',async()=>{
 await expect(service.context(peer,{categoryId:category.id,quizTitle:'Sahte'},'exam')).rejects.toMatchObject({code:'AI_CONTEXT_FORBIDDEN'});
 const quiz=await db.quiz.create({data:{title:'Başkasının',createdBy:peer.id}});
 await expect(service.context(teacher,{quizId:quiz.id},'exam')).rejects.toMatchObject({code:'AI_CONTEXT_FORBIDDEN'});
});
it('keeps unknown tokens distinct from zero and excludes admin tests',async()=>{
 const context=await service.context(teacher,{},'exam');
 const id=await service.start(teacher,profile,context,1);await service.finish(id!,{status:'timeout',durationMs:20000});
 expect(await service.start({...teacher,role:'admin'},profile,context,1)).toBeNull();
 const result=await service.list(parseAIUsageFilters({}));expect(result.rows[0].inputTokens).toBeNull();expect(result.summary.unknownUsageRequests).toBe(1);
 expect(result.rows[0].quizId).toBeNull();expect(result.rows[0].quizTitle).toBe('Başlıksız taslak');
});
it('filters and paginates on the server and preserves model snapshots',async()=>{
 const context=await service.context(teacher,{categoryId:category.id},'exam');
 for(let i=0;i<6;i++){const id=await service.start(teacher,profile,context,10);await service.finish(id!,{status:'success',durationMs:1,validQuestionCount:10,usage:{inputTokens:10,outputTokens:100,reasoningTokens:null,cacheReadTokens:null,cacheWriteTokens:null,totalTokens:110}});}
 const result=await service.list(parseAIUsageFilters({teacher:'Öğretmen',course:'Tarih',page:'2',pageSize:'2'}));expect(result.rows).toHaveLength(2);expect(result.total).toBe(6);expect(result.summary.outputTokens).toBe(600);expect(result.averages[0]).toMatchObject({model:profile.model,samples:6,averageOutputTokens:100});
 expect((await service.list(parseAIUsageFilters({model:'missing'}))).total).toBe(0);
});
it('rejects unbounded or malformed filter requests',()=>{
 for(const query of [{pageSize:'101'},{page:'0'},{status:'madeup'},{from:'invalid'},{from:'2026-10-16',to:'2026-10-15'}])expect(()=>parseAIUsageFilters(query)).toThrow();
});

it('a retry after a lost start acknowledgement keeps one durable request row',async()=>{
 const original=db.aIUsage.upsert.bind(db.aIUsage);let lost=true;
 const intercepted=Object.create(db);Object.defineProperty(intercepted,'aIUsage',{value:{upsert:async(args:any)=>{const result=await original(args);if(lost){lost=false;throw new Error('lost acknowledgement');}return result;}}});
 const resilient=new AIUsageService(intercepted);const context=await service.context(teacher,{},'exam');
 expect(await resilient.start(teacher,profile,context,1)).toBeTruthy();expect(await db.aIUsage.count()).toBe(1);
});
it('turns stale pending requests into unknown outcomes and does not overwrite completed totals',async()=>{
 const context=await service.context(teacher,{},'exam');const id=await service.start(teacher,profile,context,1);
 await db.aIUsage.update({where:{id:id!},data:{createdAt:new Date(Date.now()-11*60000)}});
 expect((await service.list(parseAIUsageFilters({status:'unknown'}))).rows[0].status).toBe('unknown');
 await service.finish(id!,{status:'success',durationMs:1,usage:{inputTokens:1,outputTokens:2,reasoningTokens:null,cacheReadTokens:null,cacheWriteTokens:null,totalTokens:3}});
 await service.finish(id!,{status:'error',durationMs:2});expect((await service.list(parseAIUsageFilters({}))).rows[0].status).toBe('success');
});

it('reports on the read connection while the answer writer gate is occupied',async()=>{
 const reader=createRuntimePrismaClient({databaseUrl:'file:'+path.join(dir,'quiz.db').replaceAll('\\','/'),readonly:true});
 try{await reader.$connect();const report=new AIUsageService(db,reader);
 await db.$transaction(async tx=>{await tx.user.update({where:{id:teacher.id},data:{name:'Writer pending'}});const result=await report.list(parseAIUsageFilters({}));expect(result.total).toBe(0);});
 }finally{await reader.$disconnect();}
});
it('finish-write exhaustion leaves a pending unknown-token row without throwing',async()=>{
 const context=await service.context(teacher,{},'exam');const id=await service.start(teacher,profile,context,1);
 const update=vi.fn().mockRejectedValue(new Error('DB unavailable'));
 const intercepted=Object.create(db);Object.defineProperty(intercepted,'aIUsage',{value:{updateMany:update}});
 await expect(new AIUsageService(intercepted).finish(id!,{status:'success',durationMs:1})).resolves.toBeUndefined();expect(update).toHaveBeenCalledTimes(3);
 expect(await db.aIUsage.findUnique({where:{id:id!}})).toMatchObject({status:'pending',inputTokens:null,outputTokens:null});
});
