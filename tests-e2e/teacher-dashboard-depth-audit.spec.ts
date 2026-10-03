import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { login, api, assertIsolatedRuntime, teacherAuditIds as ids } from './teacher-audit-helpers';

test.beforeEach(async ({ page, baseURL }) => {
  assertIsolatedRuntime();
  expect(baseURL).toBe('http://127.0.0.1:5531');
  mkdirSync('docs/teacher-audit/evidence/dashboard-depth', { recursive: true });
  await login(page);
});
test.afterEach(async ({ page }, info) => {
  mkdirSync('docs/teacher-audit/evidence/dashboard-depth', { recursive: true });
  await page.screenshot({ path: `docs/teacher-audit/evidence/dashboard-depth/${info.title.replace(/[^a-zA-Z0-9-]+/g, '-')}.png`, fullPage: true });
});

test('dashboard KPI and recent participation readbacks match the real teacher APIs', async ({ page }) => {
  const stats = await api(page, '/dashboard/stats');
  const overview = await api(page, '/dashboard/overview');
  expect(stats.status).toBe(200); expect(overview.status).toBe(200);
  expect(stats.body.stats.totalStudents).toBe(14);
  expect(stats.body.stats.totalResults).toBe(14);
  // Dashboard stats count all creator content; overview separately lists exams.
  // Do not silently substitute an exam-only count for the actual stats contract.
  expect(overview.body.recentQuizzes.length).toBeGreaterThan(0);
  expect(overview.body.recentQuizzes.length).toBeLessThanOrEqual(5);
  for (const quiz of overview.body.recentQuizzes) {
    expect(quiz.title).not.toMatch(/Private Other|Survey|Material|Draft/);
    const participantRate = quiz.assignedStudents > 0
      ? Math.min(100, Math.round(quiz.participants / quiz.assignedStudents * 100)) : 0;
    expect(quiz.participationRate).toBe(participantRate);
  }
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Öğretmen Paneli', exact: true })).toBeVisible();
  for (const [title, value] of [
    ['Toplam Sınav', String(stats.body.stats.totalQuizzes)],
    ['Aktif Öğrenci', String(stats.body.stats.totalStudents)],
    ['Toplam Katılım', String(stats.body.stats.totalResults)],
    ['Başarı Oranı', `${stats.body.stats.averageStudentScore}%`],
  ]) {
    const card = page.locator('[data-slot="card"]').filter({ has: page.locator('[data-slot="card-title"]', { hasText: new RegExp(`^${title}$`) }) });
    await expect(card).toHaveCount(1);
    await expect(card.locator('[data-slot="card-content"] > div').first()).toHaveText(value);
  }
  const recent = page.locator('[data-slot="card"]').filter({ has: page.getByText('Son Sınavlar', { exact: true }) });
  for (const quiz of overview.body.recentQuizzes) {
    const line = recent.getByText(quiz.title, { exact: true }).locator('..');
    await expect(line).toContainText(`${quiz.participants} Katılım`);
    await expect(line).toContainText(`%${quiz.participationRate}`);
  }
  await expect(recent.getByText(/Private Other|Teacher Audit Survey|Teacher Audit Material/)).toHaveCount(0);
  writeFileSync('docs/teacher-audit/evidence/dashboard-depth/kpi-readback.json', JSON.stringify({
    stats: stats.body.stats, recent: overview.body.recentQuizzes.map((quiz: any) => ({ title: quiz.title,
      participants: quiz.participants, audience: quiz.assignedStudents, rate: quiz.participationRate })),
  }, null, 2));
});

test('dashboard own-class card and task buttons navigate to actual destinations', async ({ page }) => {
  await page.goto('/');
  const classroom = page.getByRole('button', { name: /^Teacher Audit 7A/ });
  await expect(classroom).toBeVisible();
  await expect(page.getByRole('button', { name: /Private Other 7B/ })).toHaveCount(0);
  await classroom.focus(); await expect(classroom).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/classes/${ids.class}$`));
  await expect(page.getByRole('heading', { name: 'Teacher Audit 7A', exact: true })).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: 'Yeni Sınav Oluştur', exact: true }).click();
  await expect(page).toHaveURL(/\/create-quiz$/);
  await expect(page.getByLabel(/Sınav Başlığı/)).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: 'Tümünü Gör', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\?tab=logs$/);
  await expect(page.getByRole('tab', { name: 'İşlem Geçmişi', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('invalid statistics date range is rejected by API and visible in UI then restored', async ({ page }) => {
  for (const query of ['startDate=2026-10-03&endDate=2020-01-01',
    'startDate=not-a-date&endDate=2026-10-03', 'classId=not-a-uuid']) {
    expect((await api(page, `/analytics/classes?${query}`)).status, query).toBe(400);
  }
  await page.goto('/statistics');
  await expect(page.getByRole('row').filter({ hasText: 'Teacher Audit 7A' })).toBeVisible();
  const end = page.locator('#stats-end');
  const originalEnd = await end.inputValue();
  const invalid = page.waitForResponse(response => new URL(response.url()).pathname === '/api/analytics/classes'
    && new URL(response.url()).searchParams.get('endDate') === '2020-01-01');
  await end.fill('2020-01-01');
  expect((await invalid).status()).toBe(400);
  expect(await end.evaluate(input => (input as HTMLInputElement).validity.rangeUnderflow)).toBe(true);
  await expect(page.getByRole('alert').filter({ hasText: 'İstatistikler yüklenemedi' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Excel', exact: true })).toBeDisabled();
  await end.fill(originalEnd);
  await expect(page.getByRole('row').filter({ hasText: 'Teacher Audit 7A' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Excel', exact: true })).toBeEnabled();
  const missing = '99999999-9999-4999-8999-999999999999';
  for (const path of [`/classes/${missing}`, `/users/${missing}`, `/student/results/${missing}`, `/quizzes/${missing}`, `/surveys/${missing}`]) {
    expect((await api(page, path)).status, path).toBe(404);
  }
  // Analytics authorizes class IDs before exposing existence: absent IDs are 403.
  expect((await api(page, `/analytics/classes?classId=${missing}`)).status).toBe(403);
  expect((await api(page, `/analytics/classes?classId=${ids.otherClass}`)).status).toBe(403);
});

test('teacher report correct-answer cells match persisted API counts including zero', async ({ page }) => {
  const response = await api(page, '/results?quizId=teacher-audit-exam');
  expect(response.status).toBe(200);
  expect(response.body.results).toHaveLength(14);
  const zero = response.body.results.find((result: any) => result.id === 'teacher-audit-result');
  expect(zero.correctAnswersCount).toBe(0);
  await page.goto('/results');
  await page.getByRole('tab', { name: 'Öğrenci Raporları', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(14);
  for (const result of response.body.results) {
    const row = page.getByRole('row').filter({ hasText: result.student.name });
    await expect(row).toBeVisible();
    // Doğru/Toplam is the third report column. Undefined is not zero.
    await expect(row.getByRole('cell').nth(2)).toHaveText(`${result.correctAnswersCount} / ${result.totalQuestions}`);
  }
});
