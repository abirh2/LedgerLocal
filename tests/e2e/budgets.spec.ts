import { test, expect } from '@playwright/test';

test.describe('Budgeting Workflow', () => {
  test('should create and track a budget', async ({ page }) => {
    await page.goto('/');

    // 1. Setup: Create account
    await page.click('text=Accounts');
    await page.click('text=Add Account');
    await page.fill('input[placeholder="e.g. Main Checking"]', 'Budget Account');
    await page.click('text=Save Account');

    // 2. Setup: Create transaction with category "Groceries"
    await page.click('text=Transactions');
    await page.click('text=Add Transaction');
    await page.fill('input[placeholder="Merchant Name"]', 'Groceries');
    await page.fill('input[placeholder="0.00"]', '100');
    // Select category "Groceries"
    await page.selectOption('select#tx-category', { label: 'Groceries' });
    await page.click('text=Save Transaction');

    // 3. Go to Budgets
    await page.click('text=Budgets');

    // 4. Click "Add Budget"
    await page.click('text=Add Budget');
    // Select category "Groceries" in the dialog
    await page.selectOption('select#budget-category', { label: 'Groceries (Food)' });
    await page.fill('input[type="number"]', '500');
    await page.click('text=Save Budget');

    // 5. Verify budget and spending progress are visible on the Budgets page
    await expect(page.getByText('$500.00').first()).toBeVisible();
    await expect(page.getByText('$100.00').first()).toBeVisible();
  });
});
