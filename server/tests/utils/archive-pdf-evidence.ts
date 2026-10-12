import path from 'node:path';
import { exportArchive, verifyArchiveArtifact } from '../../services/archive-export';
import { getProjectRoot } from '../../utils/project-paths';
import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';

// Controlled fixtures only. Kept outside *.test.ts for explicit PDF visual review.
const row = (entityType: string, entityId: string, data: object) => ({ entityType, entityId, dataJson: JSON.stringify({ id: entityId, ...data }) });
const input = {
  id: 'pdf-validation-task6-final-dates', label: '2025-2026', initiatedBy: 'fixture-admin', createdAt: new Date('2026-07-14T21:04:00Z'),capturedAt:new Date('2026-07-14T21:05:00Z'),
  rows: [
    row('class', 'c1', { name: '9/A', assignedCategories: [{ id: 'math' }, { id: 'science' }] }),
    row('class', 'c2', { name: '9/B' }),
    row('category', 'math', { name: 'Matematik' }), row('category', 'science', { name: 'Fen Bilimleri' }),
    row('user', 'teacher', { name: 'Arşiv Öğretmeni', role: 'teacher' }),
    row('user', 'student1', { name: 'Dondurulmuş Öğrenci', role: 'student', classId: 'c1' }),
    row('user', 'student2', { name: 'Başka Sınıftaki Katılımcı', role: 'student', classId: 'c2' }),
    row('user', 'student3', { name: 'Sınıfsız Katılımcı', role: 'student', classId: null }),
    row('teacherAssignment', 'assignment', { classId: 'c1', categoryId: 'math', teacherId: 'teacher' }),
    row('quiz', 'quiz', { title: 'Yıl Sonu Matematik Sınavı', categoryId: 'math', assignedClassIds: ['c1'],publishedAt:'2026-06-20T09:00:00.000Z',createdAt:'2026-06-15T10:00:00.000Z' }),
    row('question', 'question', { quizId: 'quiz', text: 'İki ile üçün toplamı kaçtır?', type: 'short-answer', correctAnswer: '5', order: 0 }),
    row('question','raster-question',{quizId:'quiz',text:'Dondurulmuş kırmızı ve mavi görsel',type:'short-answer',correctAnswer:'kırmızı ve mavi',order:1,imageUrl:'/uploads/00000000-0000-4000-8000-000000000099.png'}),
    row('result', 'result1', { quizId: 'quiz', studentId: 'student1', score: 85, status: 'completed', answers: '{"question":"5"}' }),
    row('result', 'result2', { quizId: 'quiz', studentId: 'student2', score: 95, status: 'completed' }),
    row('result', 'result3', { quizId: 'quiz', studentId: 'student3', score: 75, status: 'completed' }),
    row('quiz', 'survey', { title: 'Yıl Sonu Görüş Anketi', categoryId: null, assignedClassIds: ['c1'], contentType: 'survey',publishedAt:null,createdAt:'2026-06-25T12:00:00.000Z' }),
    row('question', 'survey-question', { quizId: 'survey', text: 'Ders hakkında görüşünüz?', type: 'short-answer', order: 0 }),
    row('surveySubmission', 'submission', { surveyId: 'survey', studentId: 'student3' }),
    row('surveyAnswer', 'answer', { submissionId: 'submission', questionId: 'survey-question', value: 'Öğrenmekten memnun kaldım.' }),
  ],
};
const root = path.join(getProjectRoot(), '.superpowers/sdd/2026-10-05-academic-archive-review-plan/task-6-pdf-evidence');
const uploadsRoot=path.join(root,'synthetic-uploads');await mkdir(uploadsRoot,{recursive:true});
const pixels=Buffer.alloc(120*80*3);
for(let pixel=0;pixel<120*80;pixel++){pixels[pixel*3]=pixel%120<60?220:20;pixels[pixel*3+1]=30;pixels[pixel*3+2]=pixel%120<60?20:220;}
await writeFile(path.join(uploadsRoot,'00000000-0000-4000-8000-000000000099.png'),await sharp(pixels,{raw:{width:120,height:80,channels:3}}).png().toBuffer());
const artifact = await exportArchive(input, root,{uploadsRoot} as any);
await verifyArchiveArtifact(input, root);
console.log(JSON.stringify({ pdfPath: path.join(path.dirname(artifact.artifactPath), 'pdfs/report.pdf'), zipPath: artifact.artifactPath, zipSha256: artifact.zipSha256, sizeBytes: artifact.sizeBytes }));
