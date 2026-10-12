import { enrichFrozenRow } from './archive-history-enrichment';
import { HISTORY_PROJECTION_VERSION, pageFrozenLookup, type HistorySourceRow } from './archive-history-projection';

export interface HistoryQuery { type:string;page:number;pageSize:number;search:string;classId?:string;studentId?:string;teacherId?:string;entityId?:string;quizId?:string;statistics:string }
/** All SQL identifiers and JSON paths below are fixed; every request value is bound. */
export async function queryFrozenHistory(db:any,snapshotId:string,query:HistoryQuery){
  const {type,page,pageSize,search,classId,studentId,teacherId,entityId,quizId,statistics}=query;
  const kind=type==='student'||type==='teacher'?'user':type==='survey'?'quiz':type;
  const value=(field:string)=>`json_extract(r.dataJson,'$.${field}')`;
  const subStudent="json_extract(sub.dataJson,'$.studentId')",subQuiz="json_extract(sub.dataJson,'$.surveyId')";
  const rowStudent=`COALESCE(${value('studentId')},${subStudent})`,rowQuiz=`COALESCE(${value('quizId')},${value('surveyId')},${subQuiz})`;
  const rowClass=`COALESCE(${value('classId')},json_extract(student.dataJson,'$.classId'))`;
  const id=value('id');
  const from=`FROM ArchiveSnapshotRow r
    LEFT JOIN ArchiveSnapshotRow sub ON sub.snapshotId=r.snapshotId AND sub.entityType='surveySubmission' AND sub.entityId=${value('submissionId')}
    LEFT JOIN ArchiveSnapshotRow student ON student.snapshotId=r.snapshotId AND student.entityType='user' AND student.entityId=${rowStudent}
    LEFT JOIN ArchiveSnapshotRow exam ON exam.snapshotId=r.snapshotId AND exam.entityType='quiz' AND exam.entityId=${value('quizId')}
    JOIN ArchiveHistoryProjection p ON p.sourceRowId=r.id AND p.snapshotId=r.snapshotId AND p.version=?`;
  const clauses=['r.snapshotId=?','r.entityType=?'],values:any[]=[HISTORY_PROJECTION_VERSION,snapshotId,kind];
  const add=(sql:string,...parameters:any[])=>{clauses.push(sql);values.push(...parameters);};
  const arrayHas=(field:string,object=false)=>`EXISTS(SELECT 1 FROM json_each(${value(field)}) item WHERE ${object?"json_extract(item.value,'$.id')":'item.value'}=?)`;
  if(type==='student'||type==='teacher')add(`${value('role')}=?`,type);
  if(type==='survey'||type==='quiz')add(`${value('contentType')}=?`,type==='survey'?'survey':'exam');
  if(classId)add(`(${id}=? OR ${rowClass}=? OR ${value('targetClassId')}=? OR ${arrayHas('assignedClassIds')} OR ${arrayHas('managedClassIds')} OR ${arrayHas('classes',true)})`,...Array(6).fill(classId));
  if(teacherId)add(`(${kind==='user'?id+'=? OR ':''}${value('teacherId')}=? OR ${value('createdBy')}=? OR ${value('classTeacherId')}=? OR ${arrayHas('teachers',true)})`,...Array(kind==='user'?5:4).fill(teacherId));
  if(studentId)add(`(${rowStudent}=?${kind==='user'?` OR ${id}=?`:''})`,...Array(kind==='user'?2:1).fill(studentId));
  if(entityId)add(`${id}=?`,entityId);
  if(quizId)add(`(${rowQuiz}=?${kind==='quiz'?` OR ${id}=?`:''})`,...Array(kind==='quiz'?2:1).fill(quizId));
  if(statistics==='true'&&kind==='result')add("json_extract(exam.dataJson,'$.contentType')='exam'");
  if(search)add('instr(p.searchText,?)>0',search.toLocaleLowerCase('tr'));
  const where='WHERE '+clauses.join(' AND '), querySql=(sql:string,...parameters:any[])=>db.$queryRawUnsafe(sql,...parameters);
  const totals:any[]=await querySql(`SELECT count(*) AS total ${from} ${where}`,...values);
  const total=Number(totals[0].total);
  const sources:HistorySourceRow[]=await querySql(`SELECT r.id,r.snapshotId,r.entityType,r.entityId,r.dataJson ${from} ${where} ORDER BY r.entityType,r.entityId LIMIT ? OFFSET ?`,...values,pageSize,(page-1)*pageSize);
  const lookup=await pageFrozenLookup(db,snapshotId,sources);
  const rows=sources.map(row=>enrichFrozenRow(JSON.parse(row.dataJson),lookup));
  const counts:any[]=await querySql('SELECT entityType,count(*) AS total FROM ArchiveSnapshotRow WHERE snapshotId=? GROUP BY entityType ORDER BY entityType',snapshotId);
  const classes:any[]=await querySql("SELECT json_extract(dataJson,'$.id') AS id,json_extract(dataJson,'$.name') AS name FROM ArchiveSnapshotRow WHERE snapshotId=? AND entityType='class' ORDER BY entityId",snapshotId);
  const studentClauses=["snapshotId=?","entityType='user'","json_extract(dataJson,'$.role')='student'"],studentValues:any[]=[snapshotId];
  if(classId){studentClauses.push("json_extract(dataJson,'$.classId')=?");studentValues.push(classId);}
  if(studentId){studentClauses.push("json_extract(dataJson,'$.id')=?");studentValues.push(studentId);}
  const students:any[]=await querySql(`SELECT json_extract(dataJson,'$.classId') AS classId,count(*) AS total FROM ArchiveSnapshotRow WHERE ${studentClauses.join(' AND ')} GROUP BY json_extract(dataJson,'$.classId')`,...studentValues);
  let exams:any[]=[];
  if(kind==='result')exams=await querySql(`SELECT json_extract(student.dataJson,'$.classId') AS classId,count(*) AS total,sum(${value('score')}) AS sum ${from} ${where} AND json_type(r.dataJson,'$.score') IN ('integer','real') AND json_extract(exam.dataJson,'$.contentType')='exam' GROUP BY json_extract(student.dataJson,'$.classId')`,...values);
  const scoredExamResults=exams.reduce((sum,row)=>sum+Number(row.total),0),scoreSum=exams.reduce((sum,row)=>sum+Number(row.sum),0);
  const statsClasses=classes.filter(row=>!classId||row.id===classId).map(row=>{const exam=exams.find(item=>item.classId===row.id),student=students.find(item=>item.classId===row.id);return{classId:row.id,className:row.name,students:Number(student?.total??0),scoredExamResults:Number(exam?.total??0),averageScore:exam?Number(exam.sum)/Number(exam.total):null};});
  const name=async(type:string,id?:string)=>{if(!id)return undefined;const found:any[]=await querySql("SELECT json_extract(dataJson,?) AS name FROM ArchiveSnapshotRow WHERE snapshotId=? AND entityType=? AND entityId=?",type==='quiz'?'$.title':'$.name',snapshotId,type,id);return found[0]?.name??undefined;};
  const scope={className:await name('class',classId),studentName:await name('user',studentId),teacherName:await name('user',teacherId),contentTitle:await name('quiz',quizId),entityId};
  return {counts:Object.fromEntries(counts.map(row=>[row.entityType,Number(row.total)])),classes,scope,rows,statistics:{students:students.reduce((sum,row)=>sum+Number(row.total),0),scoredExamResults,averageScore:scoredExamResults?scoreSum/scoredExamResults:null,classes:statsClasses},pagination:{page,pageSize,total,pages:Math.max(1,Math.ceil(total/pageSize))}};
}
