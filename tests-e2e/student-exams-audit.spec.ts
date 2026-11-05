import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { login, api, prisma } from './student-audit-helpers';

const examId = 'student-audit-exam';
const studentId = 'student-audit-student';
const cacheKey = `quiz-master:offline-session:${studentId}:${examId}`;

async function resetAttempt() {
  const db = prisma();
  try {
    await db.studentResult.deleteMany({ where: { studentId, quizId: examId } });
    const quiz = await db.quiz.findUniqueOrThrow({ where: { id: examId } });
    const questions = await db.question.findMany({ where: { quizId: examId }, orderBy: { order: 'asc' } });
    expect(questions).toHaveLength(2);
    return { quiz, questions };
  } finally { await db.$disconnect(); }
}

async function shot(page: Page, name: string) {
  mkdirSync('tests/denetim-kanitlari/ogrenci/screenshots', { recursive: true });
  await page.screenshot({ path: `tests/denetim-kanitlari/ogrenci/screenshots/exams-${name}.png`, fullPage: true });
}

async function openExam(page: Page) {
  const response = page.waitForResponse(r => r.url().endsWith(`/student/quiz/${examId}/start`) && r.request().method() === 'POST');
  await page.goto(`/student/quiz/${examId}`);
  const started = await response;
  expect(started.status()).toBe(200);
  await expect(page.getByText('Soru 1 / 2', { exact: true })).toBeVisible();
  return started.json();
}

async function choose(page: Page, option: string) {
  const saving = page.waitForResponse(r => /\/student\/quiz\/[^/]+\/answer$/.test(r.url()) && r.request().method() === 'POST');
  await page.getByRole('button', { name: `${option}) ${option}`, exact: true }).click();
  expect((await saving).status()).toBe(200);
}

function assertNoAnswerKey(value: unknown) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    expect(['correctAnswer', 'correctAnswers', 'isCorrect', 'correctAnswersCount'], `answer key exposed as ${key}`).not.toContain(key);
    assertNoAnswerKey(child);
  }
}

test.describe('Student exam real-server audit', () => {
  test('start, answer, navigate, reload, resume, submit and persist scored result', async ({ page }) => {
    const { quiz, questions } = await resetAttempt();
    await login(page);
    await page.goto('/student/quizzes');
    await page.getByPlaceholder('Sınav adı veya konu ara...').fill(quiz.title);
    const row = page.getByRole('row').filter({ hasText: quiz.title });
    await expect(row).toBeVisible();
    const starting = page.waitForResponse(r => r.url().endsWith(`/student/quiz/${examId}/start`) && r.request().method() === 'POST');
    await row.getByRole('button', { name: 'Başla', exact: true }).click();
    const start = await starting;
    expect(start.status()).toBe(200);
    const { resultId } = await start.json();
    await expect(page.getByText('Soru 1 / 2', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Önceki', exact: true })).toBeDisabled();
    await choose(page, 'A');
    await page.getByRole('button', { name: 'Sonraki', exact: true }).click();
    await expect(page.getByText('Soru 2 / 2', { exact: true })).toBeVisible();
    await choose(page, 'B');
    await page.getByRole('button', { name: '1', exact: true }).click();
    await expect(page.getByRole('button', { name: 'A) A', exact: true })).toHaveClass(/(?:^|\s)border-primary(?:\s|$)/);
    await page.reload();
    await expect(page.getByText('2 cevaplandı', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'A) A', exact: true })).toHaveClass(/(?:^|\s)border-primary(?:\s|$)/);
    const resume = await api(page, 'POST', `/student/quiz/${examId}/start`, {});
    expect(resume.status()).toBe(200);
    expect(await resume.json()).toMatchObject({ resultId, existingAnswers: { [questions[0].id]: 'A', [questions[1].id]: 'B' } });
    await shot(page, 'resumed');
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: 'Quizi Bitir', exact: true }).click();
    await page.getByRole('button', { name: 'Hayır, Devam Et', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Quizi Bitir', exact: true }).click();
    const submitted = page.waitForResponse(r => r.url().endsWith(`/student/quiz/${resultId}/submit`) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Evet, Bitir', exact: true }).click();
    expect((await submitted).status()).toBe(200);
    await expect(page).toHaveURL(`/student/result/${resultId}`);
    await expect(page.getByRole('heading', { name: 'Soru İncelemesi' })).toBeVisible();
    const db = prisma();
    try {
      const result = await db.studentResult.findUniqueOrThrow({ where: { id: resultId } });
      expect(result).toMatchObject({ studentId, quizId: examId, status: 'completed', score: 50, correctAnswersCount: 1, totalQuestions: 2 });
      expect(JSON.parse(result.answers)).toEqual({ [questions[0].id]: 'A', [questions[1].id]: 'B' });
      expect(result.submittedAt).not.toBeNull();
    } finally { await db.$disconnect(); }
    expect(await page.evaluate(key => localStorage.getItem(key), cacheKey)).toBeNull();
    await shot(page, 'completed');
    const restart = await api(page, 'POST', `/student/quiz/${examId}/start`, {});
    expect(restart.status()).toBe(409);
    const repeatedSubmit = await api(page, 'POST', `/student/quiz/${resultId}/submit`, { answers: { [questions[1].id]: 'A' } });
    expect(repeatedSubmit.status()).toBe(200);
    expect(await repeatedSubmit.json()).toMatchObject({ score: 50, acceptedQueuedAnswers: false });
  });

  test('published exam payloads and unfinished results keep the answer key confidential', async ({ page }) => {
    await resetAttempt();
    await login(page);
    const list = await api(page, 'GET', '/student/quizzes');
    expect(list.status()).toBe(200);
    assertNoAnswerKey(await list.json());
    for (const action of ['start', 'prepare-offline']) {
      const response = await api(page, 'POST', `/student/quiz/${examId}/${action}`, {});
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.questions).toHaveLength(2);
      assertNoAnswerKey(body);
      const unfinished = await api(page, 'GET', `/student/results/${body.resultId}`);
      expect(unfinished.status()).toBe(409);
    }
    const results = await api(page, 'GET', '/student/results');
    expect(results.status()).toBe(200);
    const unfinished = (await results.json()).results.find((r: any) => r.quizId === examId);
    expect(unfinished.status).toBe('in_progress');
    expect(unfinished).not.toHaveProperty('score');
    assertNoAnswerKey(unfinished);
  });

  test('draft, foreign-class and unassigned exams reject both start and offline preparation', async ({ page }) => {
    await login(page);
    const response = await api(page, 'GET', '/student/quizzes');
    expect(response.status()).toBe(200);
    const ids = (await response.json()).quizzes.map((q: any) => q.id);
    for (const id of ['student-audit-draft', 'student-audit-other-exam', 'student-audit-unassigned-exam']) {
      expect(ids).not.toContain(id);
      for (const action of ['start', 'prepare-offline']) {
        const denied = await api(page, 'POST', `/student/quiz/${id}/${action}`, {});
        expect(denied.status(), `${id}/${action}`).toBe(403);
        assertNoAnswerKey(await denied.json());
      }
    }
    await page.goto('/student/quiz/student-audit-draft');
    await expect(page.getByText('Bu sınav henüz yayında değil.', { exact: true })).toBeVisible();
    await shot(page, 'draft-forbidden');
  });

  test('foreign results cannot be read, answered, submitted or selected through query parameters', async ({ page }) => {
    const db = prisma();
    let foreignQuestion: string;
    try { foreignQuestion = (await db.question.findFirstOrThrow({ where: { quizId: 'student-audit-other-exam' } })).id; }
    finally { await db.$disconnect(); }
    await login(page);
    const before = await api(page, 'GET', '/student/results?studentId=student-audit-other-student');
    expect(before.status()).toBe(200);
    for (const result of (await before.json()).results) expect(result.studentId).toBe(studentId);
    for (const [method, path, data] of [
      ['GET', '/student/results/student-audit-private-result', undefined],
      ['POST', '/student/quiz/student-audit-private-result/answer', { questionId: foreignQuestion, selectedOption: 'A' }],
      ['POST', '/student/quiz/student-audit-private-result/submit', { answers: {} }],
    ] as const) expect((await api(page, method, path, data)).status()).toBe(403);
    await page.goto('/student/result/student-audit-private-result');
    await expect(page.getByText('Bu sonuca erişim yetkiniz yok.', { exact: true })).toBeVisible();
    await shot(page, 'ownership-forbidden');
  });

  test('offline answers and queued submission sync to real persisted result on reconnection', async ({ page, context }) => {
    const { questions } = await resetAttempt();
    await login(page);
    const { resultId } = await openExam(page);
    await context.setOffline(true);
    try {
      await page.getByRole('button', { name: 'A) A', exact: true }).click();
      await page.getByRole('button', { name: 'Sonraki', exact: true }).click();
      await page.getByRole('button', { name: 'A) A', exact: true }).click();
      await page.getByRole('button', { name: 'Quizi Bitir', exact: true }).click();
      await page.getByRole('button', { name: 'Evet, Bitir', exact: true }).click();
      await expect(page.getByText('Teslim yerel olarak kaydedildi. İnternet gelince otomatik gönderilecek.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'A) A', exact: true })).toBeDisabled();
      const cached = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), cacheKey);
      expect(cached).toMatchObject({ pendingSubmit: true, answers: { [questions[0].id]: 'A', [questions[1].id]: 'A' } });
      const db = prisma();
      try { expect(await db.studentResult.findUniqueOrThrow({ where: { id: resultId } })).toMatchObject({ status: 'in_progress', answers: '{}' }); }
      finally { await db.$disconnect(); }
      await shot(page, 'offline-queued');
    } finally { await context.setOffline(false); }
    await expect(page).toHaveURL(`/student/result/${resultId}`, { timeout: 20000 });
    const result = await api(page, 'GET', `/student/results/${resultId}`);
    expect(result.status()).toBe(200);
    expect((await result.json()).result).toMatchObject({ status: 'completed', score: 100, correctAnswersCount: 2 });
    expect(await page.evaluate(key => localStorage.getItem(key), cacheKey)).toBeNull();
    await shot(page, 'offline-synced');
  });

  test('rapid A to B to A keeps the final unsent answer after delayed saves and reload', async ({ page }) => {
    const { questions } = await resetAttempt();
    await login(page);
    const { resultId } = await openExam(page);
    let releaseFirst!: () => void, releaseSecond!: () => void;
    const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
    const secondGate = new Promise<void>(resolve => { releaseSecond = resolve; });
    const url = `**/api/student/quiz/${resultId}/answer`;
    const requests: string[] = [];
    await page.route(url, async route => {
      requests.push(route.request().postDataJSON().selectedOption);
      if (requests.length === 1) await firstGate;
      else if (requests.length === 2) await secondGate;
      else { await route.abort('failed'); return; }
      await route.continue(); // The successful writes use the actual API and SQLite.
    });
    try {
      await page.getByRole('button', { name: 'A) A', exact: true }).click();
      await expect.poll(() => requests.length).toBe(1);
      await page.getByRole('button', { name: 'B) B', exact: true }).click();
      await page.getByRole('button', { name: 'A) A', exact: true }).click();
      const firstSaved = page.waitForResponse(r => r.url().endsWith(`/quiz/${resultId}/answer`) && r.status() === 200);
      releaseFirst(); await firstSaved;
      await expect.poll(() => requests.length).toBe(2);
      const secondSaved = page.waitForResponse(r => r.url().endsWith(`/quiz/${resultId}/answer`) && r.status() === 200);
      releaseSecond(); await secondSaved;
      await expect.poll(() => requests.length).toBe(3);
      expect(requests).toEqual(['A', 'B', 'A']);
      const cached = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), cacheKey);
      expect(cached.pendingAnswers[questions[0].id]).toBe('A');
      const db = prisma();
      try { expect(JSON.parse((await db.studentResult.findUniqueOrThrow({ where: { id: resultId } })).answers)[questions[0].id]).toBe('B'); }
      finally { await db.$disconnect(); }
      await page.unroute(url);
      await page.reload();
      await expect(page.getByRole('button', { name: 'A) A', exact: true })).toHaveClass(/(?:^|\s)border-primary(?:\s|$)/);
      const verify = prisma();
      try { expect(JSON.parse((await verify.studentResult.findUniqueOrThrow({ where: { id: resultId } })).answers)[questions[0].id]).toBe('A'); }
      finally { await verify.$disconnect(); }
    } finally { releaseFirst(); releaseSecond(); await page.unroute(url); }
  });

  test('an answer saved offline survives reconnecting and reloading before submission', async ({ page, context }) => {
    const { questions } = await resetAttempt();
    await login(page);
    const { resultId } = await openExam(page);
    await context.setOffline(true);
    try {
      await page.getByRole('button', { name: 'B) B', exact: true }).click();
      await expect(page.getByText('Cevap kaydedildi', { exact: true })).toBeVisible();
      await shot(page, 'offline-unsent-answer');
    } finally { await context.setOffline(false); }
    await page.reload();
    await expect(page.getByText('Soru 1 / 2', { exact: true })).toBeVisible();
    await shot(page, 'offline-answer-after-reload');
    await expect(page.getByRole('button', { name: 'B) B', exact: true })).toHaveClass(/(?:^|\s)border-primary(?:\s|$)/);
    await expect(page.getByText('1 cevaplandı', { exact: true })).toBeVisible();
    const db = prisma();
    try {
      await expect.poll(async () => JSON.parse((await db.studentResult.findUniqueOrThrow({ where: { id: resultId } })).answers as string)[questions[0].id]).toBe('B');
    } finally { await db.$disconnect(); }
    await page.getByRole('button', { name: 'Sonraki', exact: true }).click();
    await page.getByRole('button', { name: 'Quizi Bitir', exact: true }).click();
    await page.getByRole('button', { name: 'Evet, Bitir', exact: true }).click();
    await expect(page).toHaveURL(`/student/result/${resultId}`, { timeout: 20000 });
    const result = (await (await api(page, 'GET', `/student/results/${resultId}`)).json()).result;
    expect(result.status).toBe('completed');
    expect(result.answers[questions[0].id]).toBe('B');
  });
});
