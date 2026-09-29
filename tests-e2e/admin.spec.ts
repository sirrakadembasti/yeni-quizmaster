import { test, expect } from '@playwright/test';

test.describe('Admin Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/e-posta/i).fill('admin@quizmaster.com');
    await page.getByLabel(/şifre/i).fill('QuizMaster2026!');
    await page.getByRole('button', { name: /giriş yap/i }).click();
    
    await page.waitForURL('**/(dashboard)?**', { timeout: 10000 }).catch(() => {});
  });

  test('should navigate to management, view users tab, and open new user dialog', async ({ page }) => {
    // Admin yönetim rotası /management'tır
    await page.goto('/management');
    await expect(page).toHaveURL(/\/management/);

    // Kullanıcılar sekmesine geçiş
    const usersTab = page.getByRole('tab', { name: /kullanıcılar/i }).or(page.locator('button:has-text("Kullanıcılar")')).first();
    await expect(usersTab).toBeVisible({ timeout: 10000 });
    await usersTab.click();

    // Yeni Kullanıcı Oluştur butonunu bul
    const addUserBtn = page.getByRole('button', { name: /yeni kullanıcı oluştur/i });
    await expect(addUserBtn).toBeVisible({ timeout: 10000 });
    await addUserBtn.click();

    // Dialog başlığını doğrula
    await expect(page.locator('text="Yeni Kullanıcı Kaydı"')).toBeVisible({ timeout: 5000 });

    // Kullanıcı formunu doldur
    const newEmail = `teacher_${Date.now()}@okul.com`;
    await page.getByPlaceholder(/mehmet can/i).or(page.getByLabel(/ad soyad/i)).first().fill('E2E Test Öğretmeni');
    await page.getByPlaceholder(/mehmet@okul.com/i).or(page.getByLabel(/e-posta/i)).first().fill(newEmail);
    await page.getByLabel(/şifre/i).first().fill('QuizMaster2026!');

    // Kaydet butonunun mevcut olduğunu doğrula
    const saveBtn = page.getByRole('button', { name: /kullanıcıyı kaydet/i });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Başarılı toast veya tablonun güncellenmesini bekle
    await expect(page.locator(`text=${newEmail}`).or(page.locator('text=oluşturuldu').or(page.locator('text=Başarılı'))).first()).toBeVisible({ timeout: 10000 });
  });
});