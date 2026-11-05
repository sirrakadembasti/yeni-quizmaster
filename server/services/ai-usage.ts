import type {PrismaClient,Prisma} from '@prisma/client';
import {z} from 'zod';
import {AIManagementError,type InternalAIProfile} from './ai-profiles';
import type {AIUsageMetadata} from './ai-usage-metadata';
import {logger} from '../utils/logger';
import {randomUUID} from 'node:crypto';

type Actor={id:string;role:string;name?:string;email?:string};
export type AIUsageContextInput={draftId?:string;quizId?:string;quizTitle?:string;categoryId?:string|null};
type Context={draftId:string|null;quizId:string|null;quizTitle:string;categoryId:string|null;courseName:string;contentType:'exam'|'survey'};
export const aiUsageStatuses=['pending','success','invalid','error','timeout','cancelled','unknown'] as const;
const filterSchema=z.object({
 page:z.coerce.number().int().min(1).max(100000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(25),
 from:z.string().max(40).optional(),to:z.string().max(40).optional(),
 teacher:z.string().trim().max(100).optional(),course:z.string().trim().max(100).optional(),quiz:z.string().trim().max(100).optional(),model:z.string().trim().max(160).optional(),
 status:z.enum(aiUsageStatuses).optional(),
}).strict();
export function parseAIUsageFilters(query:unknown){
 const parsed=filterSchema.safeParse(query);if(!parsed.success)throw new AIManagementError(400,'AI_INVALID_FILTERS','Kullanım filtrelerini ve sayfa boyutunu kontrol edin.');
 const date=(s:string|undefined,end=false)=>{
  if(!s)return undefined;
  if(!/^\d{4}-\d{2}-\d{2}(?:T.+)?$/.test(s))throw new AIManagementError(400,'AI_INVALID_FILTERS','Geçerli tarih girin.');
  const day=s.length===10;const result=new Date(day?s+'T00:00:00+03:00':s);
  if(!Number.isFinite(result.getTime())||(day&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s))throw new AIManagementError(400,'AI_INVALID_FILTERS','Geçerli tarih girin.');
  if(day&&end)result.setTime(result.getTime()+86400000);return result;
 };
 const fromDate=date(parsed.data.from),toDate=date(parsed.data.to,true);
 if(fromDate&&toDate&&fromDate>=toDate)throw new AIManagementError(400,'AI_INVALID_FILTERS','Başlangıç tarihi bitişten önce olmalıdır.');
 return {...parsed.data,fromDate,toDate};
}
export class AIUsageService {
 constructor(private db:PrismaClient,private readDb:PrismaClient=db){}
 async context(actor:Actor,input:AIUsageContextInput,contentType:'exam'|'survey'):Promise<Context>{
  let courseName='Ders seçilmedi',categoryId=input.categoryId||null,quizId:string|null=null;
  if(categoryId){
   const category=await this.db.category.findFirst({where:{id:categoryId,...(actor.role==='admin'?{}:{OR:[
    {teachers:{some:{id:actor.id}}},{teacherAssignments:{some:{teacherId:actor.id}}},
    {classes:{some:{OR:[{teachers:{some:{id:actor.id}}},{classTeacherId:actor.id},{teacherAssignments:{some:{teacherId:actor.id}}}]}}},
   ]})},select:{name:true}});
   if(!category)throw new AIManagementError(403,'AI_CONTEXT_FORBIDDEN','Bu ders için AI kullanım yetkiniz yok.');courseName=category.name;
  }
  if(input.quizId){
   const quiz=await this.db.quiz.findUnique({where:{id:input.quizId},select:{id:true,createdBy:true,contentType:true}});
   if(!quiz||quiz.contentType!==contentType||(actor.role!=='admin'&&quiz.createdBy!==actor.id))throw new AIManagementError(403,'AI_CONTEXT_FORBIDDEN','Bu sınav veya anket için yetkiniz yok.');quizId=quiz.id;
  }
  return {draftId:input.draftId||null,quizId,quizTitle:input.quizTitle?.trim()||'Başlıksız taslak',categoryId,courseName,contentType};
 }
 private async write<T>(operation:()=>Promise<T>):Promise<T|null>{
  for(let attempt=0;attempt<3;attempt++)try{return await operation();}catch{
   if(attempt===2){logger.warn('AI usage persistence failed; provider request will not be repeated');return null;}
   await new Promise(resolve=>setTimeout(resolve,25*(attempt+1)));
  }return null;
 }
 async start(actor:Actor,profile:InternalAIProfile,context:Context,questionCount:number):Promise<string|null>{
  if(actor.role!=='teacher')return null;
  const id=randomUUID();
  const data={id,...context,teacherId:actor.id,teacherName:actor.name||'Öğretmen',teacherEmail:actor.email||'',profileId:profile.id,profileName:profile.name,provider:profile.provider,model:profile.model,profileRevision:profile.revision,thinking:profile.thinking,maxOutputTokens:profile.maxOutputTokens,timeoutMs:profile.timeoutMs,questionCount};
  const row=await this.write(()=>this.db.aIUsage.upsert({where:{id},create:data,update:{}}));
  return row?.id??null;
 }
 async finish(id:string,details:{status:typeof aiUsageStatuses[number];durationMs:number;validQuestionCount?:number;usage?:AIUsageMetadata;errorCode?:string}):Promise<void>{
  const {usage,...data}=details;
  await this.write(()=>this.db.aIUsage.updateMany({where:{id,status:'pending'},data:{...data,durationMs:Math.max(0,Math.min(3600000,Math.round(data.durationMs))),...(usage||{}),errorCode:data.errorCode&&/^(AI|LLM)_[A-Z_]+$/.test(data.errorCode)?data.errorCode:null}}));
 }
 async bindDraft(teacherId:string,draftId:string,quizId:string):Promise<void>{
  const quiz=await this.db.quiz.findUnique({where:{id:quizId},select:{createdBy:true,contentType:true}});
  if(!quiz||quiz.createdBy!==teacherId)throw new AIManagementError(403,'AI_CONTEXT_FORBIDDEN','Kullanım bu sınava bağlanamaz.');
  await this.write(()=>this.db.aIUsage.updateMany({where:{teacherId,draftId,contentType:quiz.contentType,quizId:null},data:{quizId}}));
 }
 async list(filters:ReturnType<typeof parseAIUsageFilters>){
  const stale=new Date(Date.now()-10*60000),{page,pageSize,fromDate,toDate,...f}=filters;
  const conditions:Prisma.AIUsageWhereInput[]=[];
  if(fromDate||toDate)conditions.push({createdAt:{...(fromDate?{gte:fromDate}:{}),...(toDate?{lt:toDate}:{})}});
  if(f.teacher)conditions.push({OR:[{teacherName:{contains:f.teacher}},{teacherEmail:{contains:f.teacher}}]});
  if(f.course)conditions.push({courseName:{contains:f.course}});if(f.quiz)conditions.push({quizTitle:{contains:f.quiz}});if(f.model)conditions.push({model:{contains:f.model}});
  if(f.status==='unknown')conditions.push({OR:[{status:'unknown'},{status:'pending',createdAt:{lt:stale}}]});
  else if(f.status==='pending')conditions.push({status:'pending',createdAt:{gte:stale}});
  else if(f.status)conditions.push({status:f.status});
  const where:Prisma.AIUsageWhereInput={AND:conditions};
  return this.readDb.$transaction(async tx=>{
   const [rows,total,sums,unknown,groups]=await Promise.all([
    tx.aIUsage.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(page-1)*pageSize,take:pageSize}),
    tx.aIUsage.count({where}),tx.aIUsage.aggregate({where,_sum:{inputTokens:true,outputTokens:true}}),
    tx.aIUsage.count({where:{AND:[where,{OR:[{inputTokens:null},{outputTokens:null}]}]}}),
    tx.aIUsage.groupBy({by:['provider','model','thinking','questionCount'],where:{AND:[where,{status:'success',outputTokens:{not:null}}]},_avg:{outputTokens:true},_count:{id:true},_min:{createdAt:true},_max:{createdAt:true},having:{id:{_count:{gte:5}}},orderBy:{model:'asc'},take:50}),
   ]);
   return {rows:rows.map(row=>({...row,status:row.status==='pending'&&row.createdAt<stale?'unknown':row.status})),page,pageSize,total,summary:{requests:total,inputTokens:sums._sum.inputTokens??0,outputTokens:sums._sum.outputTokens??0,unknownUsageRequests:unknown},averages:groups.map(g=>({provider:g.provider,model:g.model,thinking:g.thinking,questionCount:g.questionCount,samples:g._count.id,averageOutputTokens:Math.round(g._avg.outputTokens??0),from:g._min.createdAt?.toISOString(),to:g._max.createdAt?.toISOString()}))};
  });
 }
}
let instance:AIUsageService|undefined;
export async function getAIUsageService(){const {getAIManagementDb,getAIUsageReadDb}=await import('../storage');return instance??=new AIUsageService(getAIManagementDb(),getAIUsageReadDb());}
