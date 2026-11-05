import { test, expect } from '@playwright/test';

test.describe('Teacher Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/e-posta/i).fill('teacher@quizmaster.com');
    await page.getByLabel(/şifre/i).fill('QuizMaster2026!');
    await page.getByRole('button', { name: /giriş yap/i }).click();
    
    // Öğretmen dashboard'a yönlendirilir
    await page.waitForURL('**/(dashboard)?**', { timeout: 10000 }).catch(() => {});
  });

  test('should navigate to quizzes and open create quiz page', async ({ page }) => {
    await page.goto('/quizzes');
    await expect(page).toHaveURL(/\/quizzes/);

    // Başlık doğrulaması
    await expect(page.locator('h1:has-text("Sınavlarım")')).toBeVisible({ timeout: 10000 });

    // Yeni Sınav Oluştur butonuna tıkla
    const createBtn = page.getByRole('button', { name: /yeni sınav oluştur/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // /create-quiz sayfasına ulaşıldığını doğrula
    await page.waitForURL('**/create-quiz**', { timeout: 10000 });
    await expect(page.locator('h1:has-text("Yeni Sınav Oluştur")')).toBeVisible();

    // Sınav başlığını doldur
    const quizTitle = `E2E Test Sınavı ${Date.now()}`;
    await page.getByLabel(/sınav başlığı/i).or(page.getByPlaceholder(/başlık/i)).first().fill(quizTitle);

    // Taslak Kaydet butonunun görünür ve tıklanabilir olduğunu doğrula
    const draftSaveBtn = page.getByRole('button', { name: /taslak kaydet/i });
    await expect(draftSaveBtn).toBeVisible();
  });
});