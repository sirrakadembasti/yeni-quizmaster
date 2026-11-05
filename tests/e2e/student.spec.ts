import { test, expect } from '@playwright/test';

test.describe('Student Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/e-posta/i).fill('student@quizmaster.com');
    await page.getByLabel(/şifre/i).fill('QuizMaster2026!');
    await page.getByRole('button', { name: /giriş yap/i }).click();
    
    // Öğrenci doğrudan student dashboard'a yönlenir
    await page.waitForURL('**/(student/dashboard|student/quizzes|dashboard)?**', { timeout: 10000 }).catch(() => {});
  });

  test('should navigate to student quizzes and view available quizzes', async ({ page }) => {
    // Öğrencinin izinli sınav sayfası
    await page.goto('/student/quizzes');
    await expect(page).toHaveURL(/\/student\/quizzes/);

    // Başlık doğrulaması
    await expect(page.locator('h1, h2, text="Sınavlarım"').first()).toBeVisible({ timeout: 10000 });

    // Aktif sınav varsa "Quize Başla" butonunu kontrol et
    const startButton = page.locator('button:has-text("Quize Başla")').first();
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForURL('**/student/quiz/**', { timeout: 10000 });
      await expect(page.locator('text=Soru').first()).toBeVisible();
    } else {
      // Bekleyen sınav yoksa boş durum veya tamamlanan sınavlar listesi görüntülenir
      await expect(page.locator('text="Tamamlanan Sınavlar"').or(page.locator('text="yapılacak sınav"').or(page.locator('text="Sınavlarım"'))).first()).toBeVisible();
    }
  });
});