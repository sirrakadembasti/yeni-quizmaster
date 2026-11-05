import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const id=(group,n)=>`${group.toString(16).padStart(8,'0')}-1111-4111-8111-${n.toString(16).padStart(12,'0')}`;
export async function seedPerformance(db, root) {
  const req=createRequire(path.join(root,'server/package.json'));
  const password=await req('bcryptjs').hash('PerformanceFixture2026!',10);
  const teacherIds=Array.from({length:60},(_,n)=>id(2,n)),studentIds=Array.from({length:1000},(_,n)=>id(3,n));
  const parentIds=Array.from({length:250},(_,n)=>id(4,n)),classIds=Array.from({length:40},(_,n)=>id(5,n)),courseIds=Array.from({length:6},(_,n)=>id(6,n));
  const admin=id(1,0),examIds=Array.from({length:80},(_,n)=>id(7,n)),surveyIds=Array.from({length:40},(_,n)=>id(8,n)),offlineQuiz=id(9,0);
  const batch=async(model, data)=>{for(let n=0;n<data.length;n+=200)await model.createMany({data:data.slice(n,n+200)});};
  await db.$transaction(async tx=>{
    await batch(tx.user,[{id:admin,name:'Sentetik Yönetici',email:'admin@performance.test',password,role:'admin'},...teacherIds.map((id,n)=>({id,name:'Sentetik Öğretmen '+n,email:`teacher${n}@performance.test`,password,role:'teacher'})),...parentIds.map((id,n)=>({id,name:'Sentetik Veli '+n,email:`parent${n}@performance.test`,password,role:'parent'}))]);
    await batch(tx.category,courseIds.map((id,n)=>({id,name:'Ders '+n})));
    for(const [n,classId] of classIds.entries())await tx.class.create({data:{id:classId,name:`7-${n+1}`,classTeacherId:teacherIds[n],teachers:{connect:[{id:teacherIds[n]}]},assignedCategories:{connect:courseIds.map(id=>({id}))}}});
    await batch(tx.user,studentIds.map((id,n)=>({id,name:'Sentetik Öğrenci '+n,email:`student${n}@performance.test`,password,role:'student',classId:classIds[Math.floor(n/25)],studentNo:n%25+1})));
    await batch(tx.guardianStudent,studentIds.map((studentId,n)=>({id:id(10,n),studentId,guardianId:parentIds[Math.floor(n/4)],relation:'Vasi'})));
    await batch(tx.classTeacherCourse,classIds.flatMap((classId,n)=>courseIds.map((categoryId,k)=>({id:id(11,n*6+k),classId,teacherId:teacherIds[n],categoryId}))));
    for(const [n,quizId] of [...examIds,...surveyIds,offlineQuiz].entries()) {
      const survey=n>=80&&n<120,ownClass=classIds[survey?n-80:n===120?0:n%40];
      await tx.quiz.create({data:{id:quizId,title:n===120?'Çevrimdışı Şekil Sınavı':`${survey?'Anket':'Sınav'} ${n}`,status:'published',contentType:survey?'survey':'exam',createdBy:teacherIds[survey?n-80:n%40],categoryId:courseIds[n%6],assignedClasses:{connect:{id:ownClass}},questions:{create:Array.from({length:survey?5:n===120?2:8},(_,q)=>({id:id(12,n*10+q),text:n===120?'Şekildeki kırmızı alan hangi harftir?':`Sentetik soru ${q+1}`,type:survey?'single-choice':'multiple-choice',options:JSON.stringify(['A','B','C','D']),correctAnswer:survey?null:'A',order:q,imageUrl:n===120&&q===0?'/uploads/performance-diagram.png':null}))}}});
    }
    await batch(tx.studentResult,studentIds.flatMap((studentId,n)=>Array.from({length:8},(_,k)=>{const examIndex=(Math.floor(n/25)+k%2*40),quizId=examIds[examIndex];return {id:id(13,n*8+k),studentId,quizId,status:'completed',score:75,correctAnswersCount:6,totalQuestions:8,answers:JSON.stringify(Object.fromEntries(Array.from({length:8},(_,q)=>[id(12,examIndex*10+q),q<6?'A':'B']))),submittedAt:new Date('2026-10-01'),completedAt:new Date('2026-10-01')};})));
    await batch(tx.surveySubmission,studentIds.map((studentId,n)=>({id:id(14,n),studentId,surveyId:surveyIds[Math.floor(n/25)]})));
    await batch(tx.surveyAnswer,studentIds.flatMap((_,n)=>Array.from({length:5},(_,q)=>({id:id(15,n*5+q),submissionId:id(14,n),questionId:id(12,(80+Math.floor(n/25))*10+q),value:'A'}))));
    await batch(tx.questionBank,Array.from({length:100},(_,n)=>({id:id(16,n),teacherId:teacherIds[n%60],text:'Banka sorusu '+n,type:'multiple-choice',options:'["A","B"]',correctAnswer:'A',categoryId:courseIds[n%6]})));
    await tx.announcement.create({data:{id:id(17,0),title:'Üretim provası',content:'Sentetik kurum duyurusu',createdBy:admin,targetRole:'all'}});
    const year=await tx.academicYear.create({data:{id:id(18,0),label:'2026-2027',opensAt:new Date('2026-08-01'),scheduledCloseAt:new Date('2099-07-15T00:05:00Z')}});
    await batch(tx.academicTransitionRule,classIds.map((fromClassId,n)=>({id:id(19,n),yearId:year.id,fromClassId,toClassId:classIds[(n+1)%40],graduate:false})));
  },{maxWait:10000,timeout:120000});
  const models=['user','class','category','classTeacherCourse','guardianStudent','quiz','question','studentResult','surveySubmission','surveyAnswer','questionBank','announcement'];
  const counts={};for(const name of models)counts[name]=await db[name].count();
  const roles={};for(const role of ['admin','teacher','student','parent'])roles[role]=await db.user.count({where:{role}});
  assert.equal(roles.student,1000);assert.equal(counts.studentResult,8000);assert.equal(counts.surveyAnswer,5000);assert.equal(await db.studentResult.count({where:{score:75,correctAnswersCount:6,totalQuestions:8}}),8000);
  assert.equal((await db.$queryRawUnsafe('PRAGMA foreign_key_check')).length,0);
  const actors=[{id:admin,email:'admin@performance.test',role:'admin'},{id:teacherIds[0],email:'teacher0@performance.test',role:'teacher'},{id:studentIds[0],email:'student0@performance.test',role:'student'},{id:parentIds[0],email:'parent0@performance.test',role:'parent'}];
  return {counts,roles,businessRows:Object.values(counts).reduce((a,b)=>a+b,0),actors,writerActors:teacherIds.slice(20,40).map((id,n)=>({id,email:`teacher${n+20}@performance.test`,role:'teacher'})),offlineQuiz,questionIds:[id(12,1200),id(12,1201)],yearId:id(18,0),password:'PerformanceFixture2026!'};
}
