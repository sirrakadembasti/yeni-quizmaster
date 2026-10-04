import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { login, api, prisma } from './student-audit-helpers';

const studentId = 'student-audit-student';
const prefix = 'student-audit-depth-exams-';

async function createExam(suffix: string, timeLimit: number | null = null) {
  const db = prisma();
  const id = prefix + suffix;
  try {
    await db.studentResult.deleteMany({ where: { quizId: id } });
    await db.quiz.deleteMany({ where: { id } });
    const source = await db.quiz.findUniqueOrThrow({ where: { id: 'student-audit-exam' }, include: { assignedClasses: true } });
    const q1 = randomUUID(), q2 = randomUUID();
    const quiz = await db.quiz.create({ data: {
      id, title: `DepthAudit ${suffix}`, createdBy: source.createdBy, categoryId: source.categoryId,
      status: 'published', contentType: 'exam', timeLimit, shuffleQuestions: false,
      assignedClasses: { connect: source.assignedClasses.map((c: any) => ({ id: c.id })) },
      questions: { create: [q1, q2].map((questionId, order) => ({ id: questionId, text: `Depth question ${order + 1}`, type: 'multiple-choice', options: JSON.stringify(['A', 'B', 'C', 'D']), correctAnswer: 'A', order })) },
    } });
    return { quiz, q1, q2 };
  } finally { await db.$disconnect(); }
}

async function cleanup(ids: string[]) {
  expect(ids.every(id => id.startsWith(prefix))).toBe(true);
  const db = prisma();
  try {
    await db.studentResult.deleteMany({ where: { quizId: { in: ids } } });
    await db.quiz.deleteMany({ where: { id: { in: ids } } });
  } finally { await db.$disconnect(); }
}

async function start(page: Page, id: string) {
  const response = await api(page, 'POST', `/student/quiz/${id}/start`, {});
  expect(response.status()).toBe(200);
  return response.json();
}

async function screenshot(page: Page, name: string) {
  mkdirSync('docs/student-audit/screenshots', { recursive: true });
  await page.screenshot({ path: `docs/student-audit/screenshots/exams-depth-${name}.png`, fullPage: true });
}

test.describe('Student exam depth audit with isolated temporary records', () => {
  test('timed expiry rejects late answers and ignores queued changes while preserving saved answers', async ({ page }) => {
    const { quiz, q1, q2 } = await createExam('timed-api', 1);
    try {
      await login(page);
      const offline = await api(page, 'POST', `/student/quiz/${quiz.id}/prepare-offline`, {});
      expect(offline.status()).toBe(409);
      expect(await offline.json()).toMatchObject({ message: 'Süreli sınavlar güvenlik nedeniyle çevrimdışı başlatılamaz.' });
      const { resultId } = await start(page, quiz.id);
      expect((await api(page, 'POST', `/student/quiz/${resultId}/answer`, { questionId: q1, selectedOption: 'A' })).status()).toBe(200);
      const db = prisma();
      try { await db.studentResult.update({ where: { id: resultId }, data: { startedAt: new Date(Date.now() - 120_000) } }); }
      finally { await db.$disconnect(); }
      expect((await start(page, quiz.id)).remainingSeconds).toBe(0);
      expect((await api(page, 'POST', `/student/quiz/${resultId}/answer`, { questionId: q2, selectedOption: 'A' })).status()).toBe(409);
      const submit = await api(page, 'POST', `/student/quiz/${resultId}/submit`, { answers: { [q1]: 'B', [q2]: 'A' } });
      expect(submit.status()).toBe(200);
      expect(await submit.json()).toMatchObject({ score: 50, correctAnswers: 1, totalQuestions: 2, acceptedQueuedAnswers: false });
      const persisted = prisma();
      try {
        const result = await persisted.studentResult.findUniqueOrThrow({ where: { id: resultId } });
        expect(result).toMatchObject({ status: 'completed', score: 50, correctAnswersCount: 1 });
        expect(JSON.parse(result.answers)).toEqual({ [q1]: 'A' });
        expect(result.timeTaken).toBeGreaterThanOrEqual(120);
        expect(result.submittedAt).not.toBeNull();
      } finally { await persisted.$disconnect(); }
      expect((await api(page, 'POST', `/student/quiz/${resultId}/answer`, { questionId: q2, selectedOption: 'A' })).status()).toBe(400);
    } finally { await cleanup([quiz.id]); }
  });

  test('resuming an expired timed exam automatically submits and renders the persisted result', async ({ page }) => {
    const { quiz, q1 } = await createExam('timed-auto', 1);
    try {
      await login(page);
      const { resultId } = await start(page, quiz.id);
      expect((await api(page, 'POST', `/student/quiz/${resultId}/answer`, { questionId: q1, selectedOption: 'A' })).status()).toBe(200);
      const db = prisma();
      try { await db.studentResult.update({ where: { id: resultId }, data: { startedAt: new Date(Date.now() - 120_000) } }); }
      finally { await db.$disconnect(); }
      const autoSubmit = page.waitForResponse(r => r.url().endsWith(`/student/quiz/${resultId}/submit`) && r.request().method() === 'POST');
      await page.goto(`/student/quiz/${quiz.id}`);
      const submission = await autoSubmit;
      expect(submission.status()).toBe(200);
      expect(await submission.json()).toMatchObject({ score: 50, acceptedQueuedAnswers: false });
      await expect(page).toHaveURL(`/student/result/${resultId}`);
      await expect(page.getByRole('heading', { name: 'Soru İncelemesi' })).toBeVisible();
      const result = await api(page, 'GET', `/student/results/${resultId}`);
      expect(result.status()).toBe(200);
      expect((await result.json()).result).toMatchObject({ status: 'completed', score: 50 });
      await screenshot(page, 'timed-auto-result');
    } finally { await cleanup([quiz.id]); }
  });

  test('invalid UUID and foreign question payloads cannot change the current attempt', async ({ page }) => {
    const own = await createExam('validation-own');
    const other = await createExam('validation-other');
    try {
      await login(page);
      const { resultId } = await start(page, own.quiz.id);
      const invalid = await api(page, 'POST', `/student/quiz/${resultId}/answer`, { questionId: 'not-a-uuid', selectedOption: 'A' });
      expect(invalid.status()).toBe(400);
      const foreign = await api(page, 'POST', `/student/quiz/${resultId}/answer`, { questionId: other.q1, selectedOption: 'A' });
      // Answer endpoint uses 404 for a valid UUID outside the current quiz; submit uses 400.
      expect(foreign.status()).toBe(404);
      const invalidSubmit = await api(page, 'POST', `/student/quiz/${resultId}/submit`, { answers: { [other.q1]: 'A' } });
      expect(invalidSubmit.status()).toBe(400);
      const resumed = await start(page, own.quiz.id);
      expect(resumed).toMatchObject({ resultId, existingAnswers: {} });
      const db = prisma();
      try { expect(await db.studentResult.findUniqueOrThrow({ where: { id: resultId } })).toMatchObject({ status: 'in_progress', answers: '{}' }); }
      finally { await db.$disconnect(); }
    } finally { await cleanup([own.quiz.id, other.quiz.id]); }
  });

  test('unanswered exam confirmation supports cancel and explicit zero-score submission', async ({ page }) => {
    const { quiz } = await createExam('unanswered');
    try {
      await login(page);
      const started = page.waitForResponse(r => r.url().endsWith(`/student/quiz/${quiz.id}/start`) && r.request().method() === 'POST');
      await page.goto(`/student/quiz/${quiz.id}`);
      const response = await started;
      expect(response.status()).toBe(200);
      const { resultId } = await response.json();
      await page.getByRole('button', { name: 'Sonraki', exact: true }).click();
      await page.getByRole('button', { name: 'Quizi Bitir', exact: true }).click();
      await expect(page.getByRole('alertdialog')).toContainText('Sınavı Bitirmek İstiyor musunuz?');
      await page.getByRole('button', { name: 'Hayır, Devam Et', exact: true }).click();
      await expect(page.getByText('0 cevaplandı', { exact: true })).toBeVisible();
      await screenshot(page, 'unanswered-before-submit');
      await page.getByRole('button', { name: 'Quizi Bitir', exact: true }).click();
      const submitted = page.waitForResponse(r => r.url().endsWith(`/student/quiz/${resultId}/submit`) && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Evet, Bitir', exact: true }).click();
      const submission = await submitted;
      expect(submission.status()).toBe(200);
      expect(await submission.json()).toMatchObject({ score: 0, correctAnswers: 0, totalQuestions: 2 });
      await expect(page).toHaveURL(`/student/result/${resultId}`);
    } finally { await cleanup([quiz.id]); }
  });

  test('exam list search, completion filters and pagination keep counts and rows consistent', async ({ page }) => {
    const ids: string[] = [];
    try {
      for (let index = 1; index <= 12; index++) {
        const { quiz } = await createExam(`List-${String(index).padStart(2, '0')}`);
        ids.push(quiz.id);
      }
      const db = prisma();
      try { await db.studentResult.create({ data: { id: prefix + 'list-completed-result', studentId, quizId: ids[0], status: 'completed', score: 100, correctAnswersCount: 2, totalQuestions: 2, answers: '{}', submittedAt: new Date(), completedAt: new Date() } }); }
      finally { await db.$disconnect(); }
      await login(page);
      await page.goto('/student/quizzes');
      await page.getByPlaceholder('Sınav adı veya konu ara...').fill('DepthAudit List-');
      await expect(page.getByText('12 kayıt · Sayfa 1/2', { exact: true })).toBeVisible();
      await expect(page.locator('tbody tr')).toHaveCount(10);
      await expect(page.getByRole('button', { name: 'Önceki', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Sonraki', exact: true }).click();
      await expect(page.getByText('12 kayıt · Sayfa 2/2', { exact: true })).toBeVisible();
      await expect(page.locator('tbody tr')).toHaveCount(2);
      await expect(page.getByRole('button', { name: 'Sonraki', exact: true })).toBeDisabled();
      await page.getByRole('combobox').click();
      await page.getByRole('option', { name: 'Tamamlanan', exact: true }).click();
      await expect(page.getByText('1 kayıt · Sayfa 1/1', { exact: true })).toBeVisible();
      const completedRow = page.locator('tbody tr');
      await expect(completedRow).toHaveCount(1);
      await expect(completedRow).toContainText('DepthAudit List-01');
      await expect(completedRow.getByRole('button', { name: 'Detayları Gör', exact: true })).toBeVisible();
      await page.getByRole('combobox').click();
      await page.getByRole('option', { name: 'Yapılacak', exact: true }).click();
      await expect(page.getByText('11 kayıt · Sayfa 1/2', { exact: true })).toBeVisible();
      await expect(page.locator('tbody tr')).toHaveCount(10);
      await expect(page.locator('tbody')).not.toContainText('DepthAudit List-01');
      await screenshot(page, 'pending-filter');
      await page.getByPlaceholder('Sınav adı veya konu ara...').fill('DepthAudit List-does-not-exist');
      await expect(page.getByText('Aradığınız sınav bulunamadı.', { exact: true })).toBeVisible();
      await expect(page.getByText('0 kayıt · Sayfa 1/1', { exact: true })).toBeVisible();
    } finally { await cleanup(ids); }
  });
});
