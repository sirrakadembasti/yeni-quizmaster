// Explicit real-PDF regression fixture: inspect all 1000 A characters and SON_YANIT within page margins.
import path from 'node:path';
import { exportArchive } from '../../services/archive-export';
import { getProjectRoot } from '../../utils/project-paths';
const output = await exportArchive({
  id: 'pdf-long-value-final-chunks', label: '2025-2026', initiatedBy: 'synthetic-admin',
  createdAt: new Date('2026-07-14T21:04:00Z'), capturedAt: new Date('2026-07-14T21:05:00Z'),
  rows: [
    { entityType: 'quiz', entityId: 'q', dataJson: JSON.stringify({ id: 'q', title: 'Uzun yanıt okunabilirliği', assignedClassIds: [] }) },
    { entityType: 'question', entityId: 'question', dataJson: JSON.stringify({ id: 'question', quizId: 'q', text: 'Soru', type: 'short-answer', correctAnswer: 'Kısa yanıt' }) },
    { entityType: 'user', entityId: 'student', dataJson: JSON.stringify({ id: 'student', name: 'Sentetik Öğrenci', role: 'student' }) },
    { entityType: 'result', entityId: 'result', dataJson: JSON.stringify({ id: 'result', studentId: 'student', quizId: 'q', score: 90, answers: JSON.stringify({ question: 'A'.repeat(1000) + 'SON_YANIT' }) }) },
  ],
}, path.join(getProjectRoot(), '.superpowers/sdd/2026-10-05-academic-archive-review-plan/task-6-pdf-stress'));
console.log(JSON.stringify({ artifactPath: output.artifactPath, sizeBytes: output.sizeBytes }));
