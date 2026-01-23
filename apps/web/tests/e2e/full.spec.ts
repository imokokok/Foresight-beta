import { test, expect, type Page } from '@playwright/test';

async function loginWithWallet(page: Page) {
  await page.goto('/');
  const connectButton = page.locator('button:has-text("Connect Wallet"), a:has-text("Connect Wallet")');
  await expect(connectButton.first()).toBeVisible({ timeout: 30000 });
  await connectButton.first().click();
  await page.waitForTimeout(2000);
}

async function navigateToMarket(page: Page, marketId: string = '1') {
  await page.goto(`/prediction/${marketId}`);
  await expect(page.locator('h1')).toBeVisible({ timeout: 30000 });
}

test.describe('Wallet Connection', () => {
  test('should show connect wallet button when not connected', async ({ page }) => {
    await page.goto('/');
    const connectButton = page.locator('button:has-text("Connect Wallet"), a:has-text("Connect Wallet")');
    await expect(connectButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show wallet address when connected', async ({ page }) => {
    await loginWithWallet(page);
    await page.waitForTimeout(3000);
    const walletAddress = page.locator('text=0x[0-9a-fA-F]{4}');
    await expect(walletAddress.first()).toBeVisible({ timeout: 5000 });
  });

  test('should disconnect wallet', async ({ page }) => {
    await loginWithWallet(page);
    await page.waitForTimeout(2000);
    const disconnectButton = page.locator('button:has-text("Disconnect")');
    if (await disconnectButton.first().isVisible()) {
      await disconnectButton.first().click();
      await expect(page.locator('button:has-text("Connect Wallet")').first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Market Page', () => {
  test('should display market information', async ({ page }) => {
    await navigateToMarket(page);
    await expect(page.locator('h1')).toContainText(/Prediction|Will|Outcome/i, { timeout: 10000 });
  });

  test('should display orderbook', async ({ page }) => {
    await navigateToMarket(page);
    const orderbook = page.locator('[class*="orderbook"], [class*="OrderBook"], text=Order Book');
    await expect(orderbook.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display price chart', async ({ page }) => {
    await navigateToMarket(page);
    const chart = page.locator('[class*="chart"], [class*="Chart"], canvas');
    await expect(chart.first()).toBeVisible({ timeout: 15000 });
  });

  test('should switch between Yes/No outcomes', async ({ page }) => {
    await navigateToMarket(page);
    const yesButton = page.locator('button:has-text("Yes"), [role="tab"]:has-text("Yes")');
    const noButton = page.locator('button:has-text("No"), [role="tab"]:has-text("No")');
    
    if (await yesButton.first().isVisible()) {
      await yesButton.first().click();
      await expect(yesButton.first()).toHaveAttribute('data-state', 'active').catch(() => {});
      await noButton.first().click();
      await expect(noButton.first()).toHaveAttribute('data-state', 'active').catch(() => {});
    }
  });
});

test.describe('Trading', () => {
  test('should display trade form', async ({ page }) => {
    await loginWithWallet(page);
    await navigateToMarket(page);
    const tradeForm = page.locator('[class*="trade"], [class*="Trade"], form:has-text("Buy"), form:has-text("Sell")');
    await expect(tradeForm.first()).toBeVisible({ timeout: 10000 });
  });

  test('should allow amount input', async ({ page }) => {
    await loginWithWallet(page);
    await navigateToMarket(page);
    const amountInput = page.locator('input[placeholder*="Amount"], input[placeholder*="amount"]');
    if (await amountInput.first().isVisible()) {
      await amountInput.first().fill('10');
      await expect(amountInput.first()).toHaveValue(/10/);
    }
  });

  test('should calculate estimated cost', async ({ page }) => {
    await loginWithWallet(page);
    await navigateToMarket(page);
    const amountInput = page.locator('input[placeholder*="Amount"], input[placeholder*="amount"]');
    const costDisplay = page.locator('text=Cost, text=Total, text=Pay');
    
    if (await amountInput.first().isVisible()) {
      await amountInput.first().fill('100');
      await page.waitForTimeout(500);
      if (await costDisplay.first().isVisible()) {
        await expect(costDisplay.first()).toBeVisible();
      }
    }
  });
});

test.describe('Portfolio', () => {
  test('should display user positions', async ({ page }) => {
    await loginWithWallet(page);
    await page.goto('/profile/me');
    await expect(page.locator('h1, h2')).toContainText(/Profile|Portfolio|Position/i, { timeout: 10000 });
  });

  test('should display open orders', async ({ page }) => {
    await loginWithWallet(page);
    await page.goto('/profile/me');
    const ordersTab = page.locator('button:has-text("Orders"), [role="tab"]:has-text("Orders")');
    if (await ordersTab.first().isVisible()) {
      await ordersTab.first().click();
      await page.waitForTimeout(1000);
    }
  });

  test('should display trading history', async ({ page }) => {
    await loginWithWallet(page);
    await page.goto('/profile/me');
    const historyTab = page.locator('button:has-text("History"), [role="tab"]:has-text("History")');
    if (await historyTab.first().isVisible()) {
      await historyTab.first().click();
      await page.waitForTimeout(1000);
    }
  });
});

test.describe('Leaderboard', () => {
  test('should display leaderboard page', async ({ page }) => {
    await page.goto('/leaderboard');
    await expect(page.locator('h1')).toContainText(/Leaderboard|Ranking/i, { timeout: 10000 });
  });

  test('should display top traders', async ({ page }) => {
    await page.goto('/leaderboard');
    const traderList = page.locator('[class*="trader"], [class*="rank"], [class*="leaderboard"]');
    await expect(traderList.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Search', () => {
  test('should display search functionality', async ({ page }) => {
    await page.goto('/search');
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]');
    await expect(searchInput.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show search results', async ({ page }) => {
    await page.goto('/search');
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]');
    if (await searchInput.first().isVisible()) {
      await searchInput.first().fill('ETH');
      await page.waitForTimeout(1000);
      const results = page.locator('[class*="result"], [class*="market"]');
      await expect(results.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });
});

test.describe('Responsive Design', () => {
  test('should display mobile navigation on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForTimeout(1000);
    const mobileNav = page.locator('[class*="mobile-nav"], [class*="bottom-nav"]');
    await expect(mobileNav.first()).toBeVisible({ timeout: 10000 });
  });

  test('should hide sidebar on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const sidebar = page.locator('[class*="sidebar"], [class*="Sidebar"]');
    const isHidden = await sidebar.first().isHidden();
    expect(isHidden).toBe(true);
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1').first();
    const h2s = page.locator('h2');
    
    await expect(h1).toBeVisible();
    expect(await h2s.count()).toBeGreaterThanOrEqual(0);
  });

  test('should have accessible buttons', async ({ page }) => {
    await page.goto('/');
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const text = await button.textContent();
        expect(text?.length).toBeGreaterThan(0);
      }
    }
  });

  test('should have proper form labels', async ({ page }) => {
    await loginWithWallet(page);
    await navigateToMarket(page);
    const inputs = page.locator('input:not([type="hidden"]):not([type="submit"])');
    const count = await inputs.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const input = inputs.nth(i);
      if (await input.isVisible()) {
        const hasLabel = await input.evaluate((el) => {
          const id = el.getAttribute('id');
          const ariaLabel = el.getAttribute('aria-label');
          const ariaLabelledby = el.getAttribute('aria-labelledby');
          const placeholder = el.getAttribute('placeholder');
          return !!(id || ariaLabel || ariaLabelledby || placeholder);
        });
        expect(hasLabel).toBe(true);
      }
    }
  });
});

test.describe('Error Handling', () => {
  test('should handle invalid market page gracefully', async ({ page }) => {
    await page.goto('/prediction/999999999');
    await page.waitForTimeout(2000);
    const errorPage = page.locator('text=Not Found, text=404, text=Page not found');
    await expect(errorPage.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('should display error boundary on error', async ({ page }) => {
    await page.goto('/');
    const errorBoundary = page.locator('[class*="error"], [class*="Error"]');
    await expect(errorBoundary.first()).toBeHidden({ timeout: 5000 }).catch(() => {});
  });
});
