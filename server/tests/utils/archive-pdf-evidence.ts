import path from 'node:path';
import { exportArchive, verifyArchiveArtifact } from '../../services/archive-export';
import { getProjectRoot } from '../../utils/project-paths';

// Controlled fixtures only. Kept outside *.test.ts for explicit PDF visual review.
const row = (entityType: string, entityId: string, data: object) => ({ entityType, entityId, dataJson: JSON.stringify({ id: entityId, ...data }) });
const input = {
  id: 'pdf-validation-v1', label: '2025-2026', initiatedBy: 'fixture-admin', createdAt: new Date('2026-07-14T21:05:00Z'),
  rows: [
    row('class', 'c1', { name: '9/A', assignedCategories: [{ id: 'math' }, { id: 'science' }] }),
    row('class', 'c2', { name: '9/B' }),
    row('category', 'math', { name: 'Matematik' }), row('category', 'science', { name: 'Fen Bilimleri' }),
    row('user', 'teacher', { name: 'Arşiv Öğretmeni', role: 'teacher' }),
    row('user', 'student1', { name: 'Dondurulmuş Öğrenci', role: 'student', classId: 'c1' }),
    row('user', 'student2', { name: 'Başka Sınıftaki Katılımcı', role: 'student', classId: 'c2' }),
    row('user', 'student3', { name: 'Sınıfsız Katılımcı', role: 'student', classId: null }),
    row('teacherAssignment', 'assignment', { classId: 'c1', categoryId: 'math', teacherId: 'teacher' }),
    row('quiz', 'quiz', { title: 'Yıl Sonu Matematik Sınavı', categoryId: 'math', assignedClassIds: ['c1'] }),
    row('question', 'question', { quizId: 'quiz', text: 'İki ile üçün toplamı kaçtır?', type: 'short-answer', correctAnswer: '5', order: 0 }),
    row('result', 'result1', { quizId: 'quiz', studentId: 'student1', score: 85, status: 'completed', answers: '{"question":"5"}' }),
    row('result', 'result2', { quizId: 'quiz', studentId: 'student2', score: 95, status: 'completed' }),
    row('result', 'result3', { quizId: 'quiz', studentId: 'student3', score: 75, status: 'completed' }),
    row('quiz', 'survey', { title: 'Yıl Sonu Görüş Anketi', categoryId: null, assignedClassIds: ['c1'], contentType: 'survey' }),
    row('question', 'survey-question', { quizId: 'survey', text: 'Ders hakkında görüşünüz?', type: 'short-answer', order: 0 }),
    row('surveySubmission', 'submission', { surveyId: 'survey', studentId: 'student3' }),
    row('surveyAnswer', 'answer', { submissionId: 'submission', questionId: 'survey-question', value: 'Öğrenmekten memnun kaldım.' }),
  ],
};
const root = path.join(getProjectRoot(), 'docs/integration-audit/runtime-logs/academic-pdf-evidence');
const artifact = await exportArchive(input, root);
await verifyArchiveArtifact(input, root);
console.log(JSON.stringify({ pdfPath: path.join(path.dirname(artifact.artifactPath), 'pdfs/report.pdf'), zipPath: artifact.artifactPath, zipSha256: artifact.zipSha256, sizeBytes: artifact.sizeBytes }));
