import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { login, prisma, assertIsolatedRuntime } from './student-audit-helpers';

// Assertions in this file are deliberately stricter than the route smoke test.
// Synthetic error responses are only used in the two explicitly named failure tests.
async function withResults(run: (titles: string[], categoryName: string) => Promise<void>) {
  const db = prisma();
  const token = randomUUID();
  const ids = Array.from({ length: 5 }, (_, n) => `student-depth-${token}-${n}`);
  const categoryId = randomUUID(), categoryName = `Depth Category ${token}`;
  const titles = ids.map((_, n) => `Depth Result ${token} ${n}`);
  try {
    const student = await db.user.findUniqueOrThrow({ where: { id: 'student-audit-student' } });
    expect(student.classId).toBeTruthy();
    await db.category.create({ data: { id: categoryId, name: categoryName } });
    for (const [n, id] of ids.entries()) {
      await db.quiz.create({ data: {
        id, title: titles[n], status: 'published', contentType: 'exam',
        createdBy: 'student-audit-teacher', categoryId,
        assignedClasses: { connect: { id: student.classId! } },
      } });
      const submittedAt = new Date(Date.UTC(2026, 8, 1 + n));
      await db.studentResult.create({ data: {
        id: `${id}-result`, studentId: student.id, quizId: id, status: 'completed',
        score: [20, 50, 75, 90, 100][n], totalQuestions: 20,
        correctAnswersCount: [4, 10, 15, 18, 20][n], timeTaken: 60 + n,
        submittedAt, completedAt: submittedAt, answers: '{}',
      } });
    }
    await run(titles, categoryName);
  } finally {
    // Only this invocation's IDs are removed; no shared attempt or fixture is reset.
    try {
      await db.studentResult.deleteMany({ where: { quizId: { in: ids } } });
      await db.quiz.deleteMany({ where: { id: { in: ids } } });
      await db.category.deleteMany({ where: { id: categoryId } });
    } finally { await db.$disconnect(); }
  }
}

async function select(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test.beforeAll(() => assertIsolatedRuntime());

test('S-D01 dashboard all-results action with five own completed records opens authorized results', async ({ page }) => {
  await withResults(async () => {
    await login(page);
    await page.goto('/student/dashboard');
    const all = page.getByRole('button', { name: 'Tüm Sonuçları Gör', exact: true });
    await expect(all).toBeVisible();
    await all.click();
    await expect(page).toHaveURL(/\/student\/results$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sınav Sonuçlarım' })).toBeVisible();
  });
});

test('S-D02 results search, score boundaries, sort order and reset reflect seeded records', async ({ page }) => {
  await withResults(async titles => {
    await login(page);
    await page.goto('/student/results');
    await expect(page.getByText(titles[4], { exact: true })).toBeVisible();
    const search = page.getByLabel('Sınav Adı', { exact: true });
    const rows = page.locator('main tbody tr');
    await search.fill(titles[0]);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(titles[0]);
    await search.fill('definitely-no-depth-match');
    await expect(page.getByText('Sonuç Bulunamadı', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Filtreleri Temizle', exact: true }).click();
    await expect(search).toHaveValue('');
    // Restrict to this test's records so prior exam tests cannot affect sort assertions.
    await search.fill(titles[0].slice(0, -1));
    await expect(rows).toHaveCount(5);
    await select(page, 'Başarı Durumu', 'Pekiyi (90-100)');
    await expect(rows).toHaveCount(2);
    await expect(rows).toContainText([titles[4], titles[3]]);
    await select(page, 'Başarı Durumu', 'Başarılı (70-89)');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(titles[2]);
    await select(page, 'Başarı Durumu', 'Geliştirilmeli (0-69)');
    await expect(rows).toHaveCount(2);
    await select(page, 'Başarı Durumu', 'Tüm Puanlar');
    await select(page, 'Sıralama Ölçütü', 'En Düşük Puan');
    await expect(rows).toContainText(titles);
    await select(page, 'Sıralama Ölçütü', 'En Yüksek Puan');
    await expect(rows).toContainText([...titles].reverse());
    await select(page, 'Sıralama Ölçütü', 'En Eski Tarih');
    await expect(rows).toContainText(titles);
    await select(page, 'Sıralama Ölçütü', 'En Yeni Tarih');
    await expect(rows).toContainText([...titles].reverse());
    await page.getByRole('button', { name: 'Filtreleri Temizle', exact: true }).click();
    await expect(search).toHaveValue('');
    await expect(page.getByLabel('Başarı Durumu', { exact: true })).toContainText('Tüm Puanlar');
    await expect(page.getByLabel('Ders / Kategori', { exact: true })).toContainText('Tüm Dersler');
    await expect(page.getByLabel('Sıralama Ölçütü', { exact: true })).toContainText('En Yeni Tarih');
    for (const title of titles) await expect(page.getByText(title, { exact: true })).toBeVisible();
  });
});

test('S-D03 choosing an actual category preserves its completed results', async ({ page }) => {
    await login(page);
    await page.goto('/student/results');
    await expect(page.getByText('Student Audit Completed Exam', { exact: true })).toBeVisible();
    // Use the boot-time category: direct Prisma seeding does not invalidate the
    // application category cache and must not masquerade as a product defect.
    await select(page, 'Ders / Kategori', 'Audit Mathematics');
    mkdirSync('docs/student-audit/screenshots', { recursive: true });
    await page.screenshot({ path: 'docs/student-audit/screenshots/results-category-filter.png', fullPage: true });
    await expect(page.getByText('Student Audit Completed Exam', { exact: true })).toBeVisible();
});

test('S-D04 loaded student routes have specific content, reload correctly and fit mobile width', async ({ page }) => {
  await login(page);
  const routes = [
    { route: '/student/dashboard', heading: /Hoş Geldin, Student/, content: 'Sıradaki Sınavlar' },
    { route: '/student/quizzes', heading: 'Sınavlarım', content: 'Student Audit Completed Exam' },
    { route: '/my-quizzes', heading: 'Sınavlarım', content: 'Student Audit Completed Exam' },
    { route: '/student/results', heading: 'Sınav Sonuçlarım', content: 'Student Audit Completed Exam' },
    { route: '/my-results', heading: 'Sınav Sonuçlarım', content: 'Student Audit Completed Exam' },
    { route: '/my-stats', heading: 'İstatistikler', content: 'Audit Mathematics' },
    { route: '/student/surveys', heading: 'Anketlerim', content: 'Student Audit Survey' },
    { route: '/settings', heading: 'Hesap Ayarları', content: 'Kişisel Bilgiler' },
    { route: '/announcements', heading: 'Duyuru Merkezi', content: 'Student Audit Announcement' },
  ];
  for (const item of routes) {
    await page.goto(item.route);
    await expect(page.getByRole('heading', { level: 1, name: item.heading })).toBeVisible();
    await expect(page.locator('main')).toContainText(item.content);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: item.heading })).toBeVisible();
    await expect(page.locator('main')).toContainText(item.content);
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('heading', { level: 1, name: item.heading })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${item.route} document overflow`).toBe(true);
    await page.setViewportSize({ width: 1280, height: 720 });
  }
});

test('S-D05 mobile menu keyboard focus trap, Escape and notification popover work', async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/student/quizzes');
  await expect(page.getByText('Student Audit Completed Exam', { exact: true })).toBeVisible();
  const trigger = page.getByRole('button', { name: 'Menüyü aç', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('dialog', { name: 'Ana menü', exact: true });
  await expect(menu).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  const close = menu.getByRole('button', { name: 'Menüyü kapat', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(menu.getByRole('link', { name: 'Ayarlar', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  const notifications = page.getByRole('button', { name: 'Bildirimleri aç', exact: true });
  await notifications.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: 'Tüm Bildirimleri Gör', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(notifications).toBeFocused();
});

test('S-D06 injected dashboard API failure must not claim all exams completed', async ({ page }) => {
  await login(page);
  await page.route('**/api/student/results', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Depth controlled dashboard failure' }) }));
  await page.goto('/student/dashboard');
  await expect(page.locator('main')).toContainText('Depth controlled dashboard failure');
  await expect(page.getByText('Tüm Sınavları Tamamladın!', { exact: true })).toHaveCount(0);
});

test('S-D07 injected survey API failure must show error and retry instead of empty success', async ({ page }) => {
  await login(page);
  await page.route('**/api/surveys', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Depth controlled survey failure' }) }));
  const failed = page.waitForResponse(r => new URL(r.url()).pathname === '/api/surveys' && r.status() === 500);
  await page.goto('/student/surveys');
  await failed;
  await expect(page.getByText('Anketler yükleniyor...', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Yanıtlamanız gereken anket bulunmuyor.', { exact: true })).toHaveCount(0);
  await expect(page.locator('main')).toContainText(/yüklenemedi|hata|Depth controlled survey failure/i);
  await expect(page.getByRole('button', { name: /Tekrar dene|Yeniden dene/i })).toBeVisible();
});
