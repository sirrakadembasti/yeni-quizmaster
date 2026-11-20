import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createRuntimePrismaClient } from '../../utils/sqlite-runtime';
import { storage, closeStorage } from '../../storage';

// P-01: cevap kaydı her seferinde sınavın sorularını okumamalı; davranış (doğru sayısı, geçersiz soru)
// ve soru değişikliklerinde önbellek geçersizleşmesi korunmalı.
const db = createRuntimePrismaClient();
let teacher: any;
let student: any;

beforeAll(async () => {
  teacher = await storage.createUser({ name: 'P01 teacher', email: randomUUID() + '@example.com', password: 'hash', role: 'teacher' });
  student = await storage.createUser({ name: 'P01 student', email: randomUUID() + '@example.com', password: 'hash', role: 'student' });
}, 30000);
afterAll(async () => { await db.$disconnect(); await closeStorage(); });

async function setup(questionCount = 2) {
  const quiz = await storage.createQuiz({ title: 'P01 ' + randomUUID(), createdBy: teacher.id, status: 'published' } as any);
  const questions = [];
  for (let i = 0; i < questionCount; i++) {
    questions.push(await storage.createQuestion({ quizId: quiz.id, type: 'multiple-choice', text: `Soru ${i}`, options: ['A', 'B'], correctAnswer: 'A', order: i } as any));
  }
  const learner = await storage.createUser({ name: 'P01 learner', email: randomUUID() + '@example.com', password: 'hash', role: 'student' });
  const result = await storage.createResult({ quizId: quiz.id, studentId: learner.id, totalQuestions: questionCount } as any);
  return { quiz, questions, learner, result };
}

describe('P-01: cevap kaydı soru önbelleği', () => {
  it('doğru cevap sayısı cevap kaydında hesaplanmaz, teslimde hesaplanır', async () => {
    const { questions, learner, result } = await setup();
    await storage.saveResultAnswer(result.id, learner.id, questions[0].id, 'A');
    await storage.saveResultAnswer(result.id, learner.id, questions[1].id, 'B');
    const saved = await storage.getResult(result.id);
    expect(saved?.correctAnswersCount).toBe(0);
    expect(Object.keys(saved!.answers as any)).toHaveLength(2);
    const completed = await storage.completeResult(result.id, learner.id, {});
    expect(completed.correctAnswers).toBe(1);
    expect((await storage.getResult(result.id))?.correctAnswersCount).toBe(1);
  });

  it('eşzamanlı iki farklı soru cevabı birbirini silmez', async () => {
    const { questions, learner, result } = await setup();
    await Promise.all([
      storage.saveResultAnswer(result.id, learner.id, questions[0].id, 'A'),
      storage.saveResultAnswer(result.id, learner.id, questions[1].id, 'A'),
    ]);
    const saved = await storage.getResult(result.id);
    expect(saved?.answers).toEqual({ [questions[0].id]: 'A', [questions[1].id]: 'A' });
  });

  it('soru verisi ilk cevaptan sonra önbellekten okunur (ham silme önbelleği atlatır)', async () => {
    const { questions, learner, result } = await setup();
    await storage.saveResultAnswer(result.id, learner.id, questions[0].id, 'A');
    // storage dışından silinirse önbellek bunu bilemez; ikinci cevap sorgusuz kabul edilir.
    await db.question.deleteMany({ where: { id: questions[1].id } });
    await expect(storage.saveResultAnswer(result.id, learner.id, questions[1].id, 'A')).resolves.toBeUndefined();
  });

  it('storage üzerinden eklenen soru önbelleği geçersiz kılar', async () => {
    const { quiz, questions, learner, result } = await setup(1);
    await storage.saveResultAnswer(result.id, learner.id, questions[0].id, 'A');
    const added = await storage.createQuestion({ quizId: quiz.id, type: 'multiple-choice', text: 'Yeni', options: ['A', 'B'], correctAnswer: 'A', order: 5 } as any);
    await expect(storage.saveResultAnswer(result.id, learner.id, added.id, 'A')).resolves.toBeUndefined();
  });

  it('storage üzerinden silinen soru için cevap reddedilir', async () => {
    const { questions, learner, result } = await setup();
    await storage.saveResultAnswer(result.id, learner.id, questions[0].id, 'A');
    await storage.deleteQuestion(questions[1].id);
    await expect(storage.saveResultAnswer(result.id, learner.id, questions[1].id, 'A')).rejects.toMatchObject({ code: 'INVALID_QUESTION_ID' });
  });

  it('geçersiz soru kimliği hâlâ reddedilir', async () => {
    const { learner, result } = await setup();
    await expect(storage.saveResultAnswer(result.id, learner.id, randomUUID(), 'A')).rejects.toMatchObject({ code: 'INVALID_QUESTION_ID' });
  });
});
