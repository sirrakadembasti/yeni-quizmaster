import { createHash } from 'node:crypto';
import { enrichFrozenRow, type FrozenLookup } from './archive-history-enrichment';

export const HISTORY_PROJECTION_VERSION = `enriched-json-tr-1;icu=${process.versions.icu};unicode=${process.versions.unicode}`;
export interface HistorySourceRow { id: string; snapshotId: string; entityType: string; entityId: string; dataJson: string }
const warmers = new WeakMap<object, Map<string, Promise<void>>>();
export function frozenLookup(rows: Pick<HistorySourceRow,'entityType'|'dataJson'>[]): FrozenLookup {
  const index = new Map<string,Map<unknown,any>>();
  for (const row of rows) { const data=JSON.parse(row.dataJson), values=index.get(row.entityType)??new Map(); values.set(data.id,data); index.set(row.entityType,values); }
  return (kind,id)=>index.get(kind)?.get(id);
}
function references(data: any) {
  const values: Array<[string,unknown]> = [
    ['class',data.classId],['class',data.targetClassId],['category',data.categoryId],
    ['user',data.teacherId],['user',data.createdBy],['user',data.classTeacherId],['user',data.studentId],['user',data.guardianId],
    ['quiz',data.quizId],['quiz',data.surveyId],['question',data.questionId],['surveySubmission',data.submissionId],
  ];
  for(const id of data.managedClassIds??[])values.push(['class',id]);
  for(const id of data.assignedClassIds??[])values.push(['class',id]);
  for(const item of data.classes??[])values.push(['class',item.id]);
  for(const item of data.teachers??[])values.push(['user',item.id]);
  for(const id of data.assignedCategoryIds??[])values.push(['category',id]);
  for(const item of data.assignedCategories??[])values.push(['category',item.id]);
  return values.filter((value):value is [string,string]=>typeof value[1]==='string'&&Boolean(value[1]));
}
/** Reads only frozen dependencies needed by this page/batch, including nested submissions. */
export async function pageFrozenLookup(db:any,snapshotId:string,rows:HistorySourceRow[]) {
  const all:Array<Pick<HistorySourceRow,'entityType'|'dataJson'>>=[...rows], seen=new Set(rows.map(row=>JSON.stringify([row.entityType,row.entityId])));
  const fields:Record<string,string[]>={user:['id','name','classId'],class:['id','name'],category:['id','name'],quiz:['id','title'],question:['id','text'],surveySubmission:['id','studentId','surveyId']};
  async function fetchReferences(referencesToRead:Array<[string,string]>){
    const requested=new Map<string,Set<string>>();
    for(const [type,id]of referencesToRead){
      const key=JSON.stringify([type,id]);if(seen.has(key))continue;seen.add(key);
      const ids=requested.get(type)??new Set<string>();ids.add(id);requested.set(type,ids);
    }
    for(const [entityType,values]of requested){
      const ids=[...values];
      for(let start=0;start<ids.length;start+=256){
        const batch=ids.slice(start,start+256),columns=fields[entityType];
        const selected=columns.flatMap(field=>[`json_type(dataJson,'$.${field}') AS "${field}Type"`,`json_extract(dataJson,'$.${field}') AS "${field}Value"`]);
        const found:any[]=await db.$queryRawUnsafe(`SELECT ${selected.join(',')} FROM ArchiveSnapshotRow WHERE snapshotId=? AND entityType=? AND entityId IN (${batch.map(()=>'?').join(',')})`,snapshotId,entityType,...batch);
        for(const alias of found){
          const data:Record<string,unknown>={};
          for(const field of columns){const type=alias[field+'Type'],value=alias[field+'Value'];if(type==null)continue;data[field]=type==='object'||type==='array'?JSON.parse(value):type==='true'||type==='false'?Boolean(value):value;}
          all.push({entityType,dataJson:JSON.stringify(data)});
        }
      }
    }
  }
  await fetchReferences(rows.flatMap(row=>references(JSON.parse(row.dataJson))));
  let lookup=frozenLookup(all);
  const nested:Array<[string,string]>=[];
  for(const source of rows){
    const row=JSON.parse(source.dataJson),submission=lookup('surveySubmission',row.submissionId);
    const classId=lookup('user',row.studentId)?.classId;
    if(typeof classId==='string')nested.push(['class',classId]);
    if(typeof submission?.studentId==='string')nested.push(['user',submission.studentId]);
    if(typeof submission?.surveyId==='string')nested.push(['quiz',submission.surveyId]);
  }
  await fetchReferences(nested);lookup=frozenLookup(all);
  const submissionClasses:Array<[string,string]>=[];
  for(const source of rows){const row=JSON.parse(source.dataJson),id=lookup('user',lookup('surveySubmission',row.submissionId)?.studentId)?.classId;if(typeof id==='string')submissionClasses.push(['class',id]);}
  await fetchReferences(submissionClasses);
  return frozenLookup(all);
}
async function insertProjection(db:any,rows:HistorySourceRow[],lookup:FrozenLookup){
  // Five parameters per row: retain compatibility with SQLite's 999-variable
  // minimum while avoiding a third INSERT for each 256-row page.
  for(let start=0;start<rows.length;start+=199){
    const batch=rows.slice(start,start+199),values=batch.flatMap(row=>[row.id,HISTORY_PROJECTION_VERSION,row.snapshotId,row.dataJson,JSON.stringify(enrichFrozenRow(JSON.parse(row.dataJson),lookup)).toLocaleLowerCase('tr')]);
    await db.$executeRawUnsafe(`INSERT OR IGNORE INTO ArchiveHistoryProjection(sourceRowId,version,snapshotId,sourceJson,searchText) VALUES ${batch.map(()=>'(?,?,?,?,?)').join(',')}`,...values);
  }
}
function fingerprint(hash:ReturnType<typeof createHash>,row:HistorySourceRow){hash.update(JSON.stringify([row.entityType,row.entityId,row.dataJson])+'\n');}
async function publish(db:any,snapshotId:string,count:number,hash:string){
  await db.$executeRawUnsafe('INSERT OR IGNORE INTO ArchiveHistoryReady(snapshotId,version,rowCount,inputSha256) VALUES (?,?,?,?)',snapshotId,HISTORY_PROJECTION_VERSION,count,hash);
}
export async function prepareCapturedHistory(db:any,snapshotId:string,rows:HistorySourceRow[]){
  const hash=createHash('sha256');
  const sorted=[...rows].sort((a,b)=>a.entityType<b.entityType?-1:a.entityType>b.entityType?1:a.entityId<b.entityId?-1:a.entityId>b.entityId?1:0);
  for(const row of sorted)fingerprint(hash,row);
  await insertProjection(db,rows,frozenLookup(rows));await publish(db,snapshotId,rows.length,hash.digest('hex'));
}
export async function historyProjectionReady(db:any,snapshotId:string){
  const rows:any[]=await db.$queryRawUnsafe('SELECT rowCount FROM ArchiveHistoryReady WHERE snapshotId=? AND version=?',snapshotId,HISTORY_PROJECTION_VERSION);
  return rows.length===1;
}
/** Legacy warming is explicit background work, never a full parse in the GET handler. */
export function warmHistoryProjection(db:any,snapshotId:string,onError:(error:unknown)=>void=()=>{}){
  let jobs=warmers.get(db);if(!jobs){jobs=new Map();warmers.set(db,jobs);}if(jobs.has(snapshotId))return jobs.get(snapshotId)!;
  const operation=(async()=>{
    if(await historyProjectionReady(db,snapshotId))return;
    let hash=createHash('sha256'),entityType='',entityId='',count=0;
    for(;;){
      // Amortize durable writes without holding an entire legacy snapshot in
      // memory or one long transaction. A failed chunk never advances the hash
      // or cursor; retries reuse only previous fully committed exact rows.
      const chunk=await db.$transaction(async(tx:any)=>{
        let nextType=entityType,nextId=entityId,added=0,finished=false;
        const nextHash=hash.copy();
        // At most 4,096 rows per commit, still only one 256-row page in
        // memory. Amortize measured journal/commit cost without changing
        // the 120s transaction deadline or advancing uncommitted cursors.
        for(let batch=0;batch<16;batch++){
          // A tuple range seeks into the existing unique snapshot/type/id
          // index. The equivalent OR predicate scans the snapshot prefix on
          // each page, making legacy warming increasingly expensive.
          const rows:HistorySourceRow[]=await tx.$queryRawUnsafe('SELECT id,snapshotId,entityType,entityId,dataJson FROM ArchiveSnapshotRow WHERE snapshotId=? AND (entityType,entityId)>(?,?) ORDER BY entityType,entityId LIMIT 256',snapshotId,nextType,nextId);
          if(!rows.length){finished=true;break;}
          const lookup=await pageFrozenLookup(tx,snapshotId,rows);await insertProjection(tx,rows,lookup);
          for(const row of rows)fingerprint(nextHash,row);added+=rows.length;
          ({entityType:nextType,entityId:nextId}=rows[rows.length-1]);
        }
        return {nextType,nextId,added,finished,nextHash};
      },{maxWait:10000,timeout:120000});
      entityType=chunk.nextType;entityId=chunk.nextId;count+=chunk.added;hash=chunk.nextHash;
      if(chunk.finished)break;
    }
    await publish(db,snapshotId,count,hash.digest('hex'));
  })().catch(error=>{onError(error);throw error;}).finally(()=>jobs!.delete(snapshotId));
  jobs.set(snapshotId,operation);return operation;
}
export async function warmCompletedHistory(db:any,onError:(error:unknown)=>void=()=>{}){
  const snapshots=await db.archiveSnapshot.findMany({where:{mode:'annual',status:'completed'},select:{id:true},orderBy:{createdAt:'asc'}});
  for(const snapshot of snapshots)await warmHistoryProjection(db,snapshot.id,onError).catch(()=>{});
}
