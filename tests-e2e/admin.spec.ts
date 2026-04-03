import { test, expect } from '@playwright/test';

test.describe('Admin Flow', () => {
  // Assuming a seeded admin account
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/e-posta/i).fill('admin@example.com');
    await page.getByLabel(/şifre/i).fill('password123'); // Assuming default seed password
    await page.getByRole('button', { name: /giriş yap/i }).click();
    
    // Wait for dashboard to load
    await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {});
  });

  test('should list users and create a new teacher', async ({ page }) => {
    // Navigate to user management page (usually /users or /admin/users)
    await page.goto('/users'); // Update this path based on actual admin dashboard routing if needed
    
    // Attempt to click 'Kullanıcılar' or similar menu item if not auto-navigated
    const usersMenu = page.locator('a:has-text("Kullanıcılar")').first();
    if (await usersMenu.isVisible()) {
      await usersMenu.click();
    }

    // Verify user list is present
    await expect(page.locator('text=Kullanıcı').first()).toBeVisible({ timeout: 10000 });

    // Open add user modal/form
    const addUserBtn = page.locator('button:has-text("Ekle")').first().or(page.locator('button:has-text("Yeni")').first());
    if (await addUserBtn.isVisible()) {
      await addUserBtn.click();
      
      const email = `new_teacher_${Date.now()}@example.com`;
      await page.getByLabel(/ad soyad/i).fill('New Teacher');
      await page.getByLabel(/e-posta/i).fill(email);
      await page.getByLabel(/şifre/i).fill('Pass123!');
      
      // Select role
      const roleSelect = page.getByRole('combobox', { name: /rol/i });
      if (await roleSelect.isVisible()) {
        await roleSelect.selectOption('teacher');
      }

      // Submit
      await page.getByRole('button', { name: /kaydet/i }).first().click();

      // Verify success
      await expect(page.locator('text=başarıyla').first()).toBeVisible({ timeout: 10000 });
      // The new user's email should be in the list
      await expect(page.locator(`text=${email}`).first()).toBeVisible({ timeout: 10000 });
    }
  });
});