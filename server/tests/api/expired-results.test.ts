import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { storage, closeStorage, getStorageDbForTests } from '../../storage';

let teacher: any, student: any, student2: any;

async function startedExam(timeLimit: number | null, startedMinutesAgo: number, studentId = student.id) {
  const quiz = await storage.createQuiz({ title: `S02 sınav ${Math.random()}`, createdBy: teacher.id, status: 'published', timeLimit } as any);
  const q1 = await storage.createQuestion({ quizId: quiz.id, type: 'multiple-choice', text: 'Soru 1', options: ['A', 'B'], correctAnswer: 'A', order: 1 });
  await storage.createQuestion({ quizId: quiz.id, type: 'multiple-choice', text: 'Soru 2', options: ['A', 'B'], correctAnswer: 'B', order: 2 });
  const result = await storage.createResult({ studentId, quizId: quiz.id, answers: {}, totalQuestions: 2 } as any);
  await getStorageDbForTests().studentResult.update({
    where: { id: result.id },
    data: { startedAt: new Date(Date.now() - startedMinutesAgo * 60000) },
  });
  return { quiz, result, q1 };
}

beforeAll(async () => {
  const hash = await bcrypt.hash('Password123', 4);
  teacher = await storage.createUser({ name: 'S02 Öğretmen', email: 's02-teacher@test.local', password: hash, role: 'teacher' } as any);
  student = await storage.createUser({ name: 'S02 Öğrenci', email: 's02-student@test.local', password: hash, role: 'student' } as any);
  student2 = await storage.createUser({ name: 'S02 Öğrenci 2', email: 's02-student2@test.local', password: hash, role: 'student' } as any);
}, 30000);

afterAll(async () => { await closeStorage(); });

describe('S-02: süresi dolan sınav oturumları kapanır', () => {
  it('süresi (ve tolerans) dolmuş oturumu kaydedilen cevaplarla tamamlar', async () => {
    const { result, q1 } = await startedExam(1, 10);
    await getStorageDbForTests().studentResult.update({
      where: { id: result.id }, data: { answers: JSON.stringify({ [q1.id]: 'A' }) },
    });

    const closed = await storage.completeExpiredResults();

    expect(closed).toBeGreaterThanOrEqual(1);
    const after = await storage.getResult(result.id);
    expect(after?.status).toBe('completed');
    expect(after?.score).toBe(50);
  });

  it('süresiz sınavdaki oturuma dokunmaz', async () => {
    const { result } = await startedExam(null, 600, student2.id);

    await storage.completeExpiredResults();

    expect((await storage.getResult(result.id))?.status).toBe('in_progress');
  });

  it('süresi dolmamış oturuma dokunmaz', async () => {
    const { result } = await startedExam(60, 5, student2.id);

    await storage.completeExpiredResults();

    expect((await storage.getResult(result.id))?.status).toBe('in_progress');
  });
});
