import { test, expect } from '@playwright/test';

test.describe('First Launch Workflow', () => {
  test('should show empty state and allow creating first account', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Check for welcome message or empty state on Overview
    // Based on OverviewPage.tsx, it should show "Welcome to LedgerLocal" if no accounts
    await expect(page.getByText('Welcome to LedgerLocal')).toBeVisible();

    // Navigate to Accounts
    await page.click('text=Accounts');

    // Click "Add Account"
    await page.click('text=Add Account');

    // Fill out the form
    await page.fill('input[placeholder="e.g. Main Checking"]', 'Test Checking');
    await page.selectOption('select', { label: 'Checking' });
    await page.fill('input[placeholder="0.00"]', '1000'); // Initial balance

    // Save
    await page.click('text=Save Account');

    // Verify account appeared in the sidebar or list
    await expect(page.getByText('Test Checking')).toBeVisible();
    await expect(page.locator('span:has-text("$1,000.00")').first()).toBeVisible();
  });
});
