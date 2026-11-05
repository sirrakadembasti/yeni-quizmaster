import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  test('should allow user to register and then login', async ({ page }) => {
    // Navigate to auth page
    await page.goto('/auth');

    // Toggle to register form
    const registerTab = page.locator('text=Kayıt Ol').first();
    if (await registerTab.isVisible()) {
      await registerTab.click();
    }

    // Fill registration form
    await page.getByLabel(/ad soyad/i).fill('Test User');
    await page.getByLabel(/e-posta/i).fill(testEmail);
    await page.getByLabel(/şifre/i).fill(testPassword);

    // Submit registration
    await page.getByRole('button', { name: /kayıt ol/i }).click();

    // After registration, wait for redirect or login
    await page.waitForURL('**/(student/dashboard|dashboard)?**', { timeout: 10000 }).catch(async () => {
      // If redirected to login instead of auto-login
      const loginTab = page.locator('text=Giriş Yap').first();
      if (await loginTab.isVisible()) {
        await loginTab.click();
      }
      await page.getByLabel(/e-posta/i).fill(testEmail);
      await page.getByLabel(/şifre/i).fill(testPassword);
      await page.getByRole('button', { name: /giriş yap/i }).click();
      await page.waitForURL('**/(student/dashboard|dashboard)?**', { timeout: 10000 });
    });

    // Verify successful dashboard landing
    await expect(page.locator('text=/Hoş Geldin/i').or(page.locator('text=/Çıkış/i')).first()).toBeVisible({ timeout: 10000 });
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/auth');

    const loginTab = page.locator('text=Giriş Yap').first();
    if (await loginTab.isVisible()) {
      await loginTab.click();
    }

    await page.getByLabel(/e-posta/i).fill('invalid@example.com');
    await page.getByLabel(/şifre/i).fill('WrongPassword!');
    await page.getByRole('button', { name: /giriş yap/i }).click();

    // Should show error toast or message
    await expect(page.locator('text=/Geçersiz|Giriş başarısız|Hatalı/i').first()).toBeVisible({ timeout: 10000 });
  });
});