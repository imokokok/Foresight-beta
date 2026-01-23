import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/');
    
    await expect(page).toHaveTitle(/Foresight/i);
    
    await expect(page.locator('main')).toBeVisible();
  });

  test('should display navigation', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('nav')).toBeVisible();
  });
});

test.describe('Market Page', () => {
  test('should display market list', async ({ page }) => {
    await page.goto('/markets');
    
    await expect(page.locator('h1')).toContainText(/Markets/i);
  });
});

test.describe('Authentication', () => {
  test('should show login button when not authenticated', async ({ page }) => {
    await page.goto('/');
    
    const loginButton = page.locator('button:has-text("Login"), a:has-text("Login")');
    await expect(loginButton.first()).toBeVisible({ timeout: 10000 });
  });
});
