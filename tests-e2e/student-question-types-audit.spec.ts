import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { login, api, prisma } from './student-audit-helpers';

const prefix = 'student-audit-question-types-';
const studentId = 'student-audit-student';
type Question = { id: string; text: string; type: string; options: string[]; correctAnswer: string; imageUrl?: string };

async function fixture(suffix: string, questions: Question[], shuffleQuestions = false) {
  const id = prefix + suffix;
  const db = prisma();
  try {
    await db.studentResult.deleteMany({ where: { quizId: id } });
    await db.quiz.deleteMany({ where: { id } });
    const source = await db.quiz.findUniqueOrThrow({ where: { id: 'student-audit-exam' }, include: { assignedClasses: true } });
    await db.quiz.create({ data: { id, title: `Question types ${suffix}`, createdBy: source.createdBy,
      categoryId: source.categoryId, status: 'published', contentType: 'exam', timeLimit: null, shuffleQuestions,
      assignedClasses: { connect: source.assignedClasses.map((c: any) => ({ id: c.id })) },
      questions: { create: questions.map((question, order) => ({ ...question, options: JSON.stringify(question.options), order })) },
    } });
    return id;
  } finally { await db.$disconnect(); }
}

async function cleanup(id: string) {
  expect(id.startsWith(prefix)).toBe(true);
  const db = prisma();
  try {
    await db.studentResult.deleteMany({ where: { quizId: id } });
    await db.quiz.deleteMany({ where: { id } });
  } finally { await db.$disconnect(); }
}

async function open(page: Page, id: string) {
  const started = page.waitForResponse(r => r.url().endsWith(`/student/quiz/${id}/start`) && r.request().method() === 'POST');
  await page.goto(`/student/quiz/${id}`);
  const response = await started;
  expect(response.status()).toBe(200);
  return response.json();
}

async function saveChoice(page: Page, resultId: string, name: string) {
  const saving = page.waitForResponse(r => r.url().endsWith(`/student/quiz/${resultId}/answer`) && r.request().method() === 'POST');
  await page.getByRole('button', { name, exact: true }).click();
  expect((await saving).status()).toBe(200);
}

async function complete(page: Page, resultId: string) {
  await page.getByRole('button', { name: 'Quizi Bitir', exact: true }).click();
  const submitted = page.waitForResponse(r => r.url().endsWith(`/student/quiz/${resultId}/submit`) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Evet, Bitir', exact: true }).click();
  const response = await submitted;
  expect(response.status()).toBe(200);
  const body = await response.json();
  await expect(page).toHaveURL(`/student/result/${resultId}`);
  await expect(page.getByRole('heading', { name: 'Soru İncelemesi' })).toBeVisible();
  return body;
}

async function screenshot(page: Page, suffix: string) {
  mkdirSync('docs/student-audit/screenshots', { recursive: true });
  await page.screenshot({ path: `docs/student-audit/screenshots/question-types-${suffix}.png`, fullPage: true });
}

test.describe('Student storage/API question types and real image audit', () => {
  test('true-false choices render, save and grade different correct values', async ({ page }) => {
    const questions: Question[] = [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', text: 'Doğru yanlış: iki artı iki dörttür.', type: 'true-false', options: ['Doğru', 'Yanlış'], correctAnswer: 'Doğru' },
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', text: 'Doğru yanlış: üç çift sayıdır.', type: 'true-false', options: ['Doğru', 'Yanlış'], correctAnswer: 'Yanlış' },
    ];
    const id = await fixture('true-false', questions);
    try {
      await login(page);
      const { resultId } = await open(page, id);
      await expect(page.getByText(questions[0].text, { exact: true })).toBeVisible();
      await saveChoice(page, resultId, 'A) Doğru');
      await page.getByRole('button', { name: 'Sonraki', exact: true }).click();
      await expect(page.getByText(questions[1].text, { exact: true })).toBeVisible();
      await saveChoice(page, resultId, 'B) Yanlış');
      expect(await complete(page, resultId)).toMatchObject({ score: 100, correctAnswers: 2, totalQuestions: 2 });
      const db = prisma();
      try {
        const result = await db.studentResult.findUniqueOrThrow({ where: { id: resultId } });
        expect(result).toMatchObject({ studentId, status: 'completed', score: 100 });
        expect(JSON.parse(result.answers)).toEqual({ [questions[0].id]: 'Doğru', [questions[1].id]: 'Yanlış' });
      } finally { await db.$disconnect(); }
      await screenshot(page, 'true-false-result');
    } finally { await cleanup(id); }
  });

  test('unsupported short-answer record shows fallback and normal exam API rejects unsupported types', async ({ page }) => {
    // Current exam creation policy accepts only multiple-choice; legacy type
    // declarations alone must not be treated as a promised student feature.
    const question: Question = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', text: 'Kısa cevap: Türkiye başkenti nedir?', type: 'short-answer', options: [], correctAnswer: 'Ankara' };
    const id = await fixture('short-answer', [question]);
    try {
      await login(page);
      await open(page, id);
      await expect(page.getByText(question.text, { exact: true })).toBeVisible();
      await screenshot(page, 'short-answer-before-input-assertion');
      const questionCard = page.locator('.border-2').filter({ has: page.getByText(question.text, { exact: true }) });
      await expect(questionCard.getByText('Bu soru için seçenek bulunmuyor.', { exact: true })).toBeVisible();
      await expect(questionCard.getByRole('textbox')).toHaveCount(0);
      await login(page, 'student-audit-teacher@example.test');
      const db = prisma();
      try {
        const before = await db.question.findMany({ where: { quizId: 'student-audit-draft' }, orderBy: { order: 'asc' } });
        for (const invalid of [question, { ...question, type: 'true-false', options: ['Doğru','Yanlış'], correctAnswer: 'Doğru' }]) {
          const { id: _existingId, ...newQuestion } = invalid;
          const response = await api(page, 'POST', '/quizzes/student-audit-draft/questions', [newQuestion]);
          expect(response.status()).toBe(400);
          expect(await response.json()).toEqual({ message: 'Sınav soruları, seçenekleri veya doğru cevap geçersiz.' });
        }
        expect(await db.question.findMany({ where: { quizId: 'student-audit-draft' }, orderBy: { order: 'asc' } })).toEqual(before);
      } finally { await db.$disconnect(); }
    } finally { await cleanup(id); }
  });

  test('real public image loads and shuffled questions retain order and saved answers across reload', async ({ page }) => {
    const questions: Question[] = [
      { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', text: 'Image and shuffle question one', type: 'multiple-choice', options: ['A', 'B', 'C'], correctAnswer: 'A', imageUrl: '/favicon.png' },
      { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', text: 'Image and shuffle question two', type: 'multiple-choice', options: ['A', 'B', 'C'], correctAnswer: 'B', imageUrl: '/favicon.png' },
      { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', text: 'Image and shuffle question three', type: 'multiple-choice', options: ['A', 'B', 'C'], correctAnswer: 'C', imageUrl: '/favicon.png' },
    ];
    const id = await fixture('image-shuffle', questions, true);
    try {
      await login(page);
      const asset = await page.request.get('/favicon.png');
      expect(asset.status()).toBe(200);
      expect(asset.headers()['content-type']).toMatch(/^image\//);
      const { resultId } = await open(page, id);
      const order: string[] = [];
      for (let index = 0; index < questions.length; index++) {
        await page.getByRole('button', { name: String(index + 1), exact: true }).click();
        const visibleQuestion = await page.locator('[class*="text-xl"]').filter({ hasText: 'Image and shuffle question' }).innerText();
        order.push(visibleQuestion);
        const image = page.getByRole('img', { name: 'Soru görseli', exact: true });
        await expect(image).toBeVisible();
        await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
        const question = questions.find(q => q.text === visibleQuestion)!;
        expect(question).toBeDefined();
        await saveChoice(page, resultId, `${question.correctAnswer}) ${question.correctAnswer}`);
      }
      expect(new Set(order).size).toBe(3);
      await page.reload();
      await expect(page.getByText('3 cevaplandı', { exact: true })).toBeVisible();
      for (let index = 0; index < questions.length; index++) {
        await page.getByRole('button', { name: String(index + 1), exact: true }).click();
        await expect(page.getByText(order[index], { exact: true })).toBeVisible();
        const question = questions.find(q => q.text === order[index])!;
        await expect(page.getByRole('button', { name: `${question.correctAnswer}) ${question.correctAnswer}`, exact: true })).toHaveClass(/(?:^|\s)border-primary(?:\s|$)/);
      }
      await screenshot(page, 'image-shuffle-resume');
      expect(await complete(page, resultId)).toMatchObject({ score: 100, correctAnswers: 3, totalQuestions: 3 });
    } finally { await cleanup(id); }
  });
});
