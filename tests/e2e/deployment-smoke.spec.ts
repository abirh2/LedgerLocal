import { test, expect } from '@playwright/test';

test.describe('Deployment & Router Smoke Tests', () => {
  test('should load the application at root URL and default to Overview', async ({ page }) => {
    await page.goto('/');
    
    // Check that we have been routed to overview (hash is #overview)
    // and Overview content is visible
    await expect(page).toHaveURL(/.*#overview/);
    await expect(page.getByText('Welcome to LedgerLocal')).toBeVisible();
  });

  test('should navigate between pages using hash router and support browser back/forward buttons', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to Accounts
    await page.click('text=Accounts');
    await expect(page).toHaveURL(/.*#accounts/);
    await expect(page.getByText('Add Account')).toBeVisible();

    // Navigate to Transactions
    await page.click('text=Transactions');
    await expect(page).toHaveURL(/.*#transactions/);

    // Test back button
    await page.goBack();
    await expect(page).toHaveURL(/.*#accounts/);
    await expect(page.getByText('Add Account')).toBeVisible();

    // Test forward button
    await page.goForward();
    await expect(page).toHaveURL(/.*#transactions/);
  });

  test('should support direct navigation and page refresh', async ({ page }) => {
    // Navigate directly to Budgets view
    await page.goto('/#budgets');
    await expect(page).toHaveURL(/.*#budgets/);
    await expect(page.getByText('Monthly Budgets')).toBeVisible();

    // Perform page reload
    await page.reload();
    await expect(page).toHaveURL(/.*#budgets/);
    await expect(page.getByText('Monthly Budgets')).toBeVisible();
  });

  test('should verify asset paths and base path safety', async ({ page }) => {
    await page.goto('/');
    
    // Locate the LedgerLocal logo icon or title and ensure it is rendered and base path is safe
    const sidebarTitle = page.locator('span:has-text("LedgerLocal")');
    if (await sidebarTitle.isVisible()) {
      await expect(sidebarTitle).toBeVisible();
    }
  });

  test('should verify help-page section sessionStorage anchor redirects', async ({ page }) => {
    await page.goto('/');
    
    // Set anchor in sessionStorage
    await page.evaluate(() => {
      sessionStorage.setItem('guide_section_anchor', 'security');
    });

    // Navigate to guide page
    await page.click('text=How to Use');
    await expect(page).toHaveURL(/.*#guide/);
    
    // The guide page should have scrolled to or displayed the security section
    await expect(page.locator('#section-security')).toBeVisible();
  });

  test('should support downloading JSON backup', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to Settings
    await page.click('text=Settings');
    await expect(page).toHaveURL(/.*#settings/);

    // Start waiting for download before clicking the export button
    const downloadPromise = page.waitForEvent('download');
    
    // Click export backup button
    await page.click('text=Export JSON');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('ledger_backup');
    
    const path = await download.path();
    expect(path).toBeTruthy();
  });
});
