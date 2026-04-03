import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  test('should allow user to register and then login', async ({ page }) => {
    // Navigate to auth page
    await page.goto('/auth');

    // Toggle to register form if needed (assuming there's a tabs or toggle mechanism)
    // Using robust generic selectors
    const registerTab = page.locator('text=Kayıt Ol').first();
    if (await registerTab.isVisible()) {
      await registerTab.click();
    }

    // Fill registration form
    await page.getByLabel(/ad soyad/i).fill('Test User');
    await page.getByLabel(/e-posta/i).fill(testEmail);
    await page.getByLabel(/şifre/i).fill(testPassword);
    
    // Select role if applicable (might be fixed to student in some apps, or selectable)
    // Fallback logic for role selection
    const roleSelect = page.getByRole('combobox', { name: /rol/i });
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('student');
    }

    // Submit registration
    await page.getByRole('button', { name: /kayıt ol/i }).click();

    // After registration, user might be auto-logged in or redirected to login
    // Let's ensure we are at dashboard or can login
    await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(async () => {
      // If redirected to login instead of auto-login
      const loginTab = page.locator('text=Giriş Yap').first();
      if (await loginTab.isVisible()) {
        await loginTab.click();
      }
      await page.getByLabel(/e-posta/i).fill(testEmail);
      await page.getByLabel(/şifre/i).fill(testPassword);
      await page.getByRole('button', { name: /giriş yap/i }).click();
      await page.waitForURL('**/dashboard**');
    });

    // Verify successful login by checking dashboard element
    await expect(page.locator('text=Hoş Geldiniz').first()).toBeVisible({ timeout: 10000 });
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
    await expect(page.locator('text=Giriş başarısız').first().or(page.locator('text=Hatalı').first())).toBeVisible();
  });
});