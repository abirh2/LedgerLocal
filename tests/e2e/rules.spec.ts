import { test, expect } from '@playwright/test';

test.describe('Rules Management Workflow', () => {
  test('should create and apply a rule to transactions', async ({ page }) => {
    await page.goto('/');

    // 1. Setup: Create account
    await page.click('text=Accounts');
    await page.click('text=Add Account');
    await page.fill('input[placeholder="e.g. Main Checking"]', 'Rules Account');
    await page.click('text=Save Account');

    // 2. Go to Rules and create the rule first
    await page.click('text=Rules');
    await page.click('text=Create Rule');
    await page.fill('input[placeholder="Rule Name"]', 'Amazon Rename');
    
    // Set condition: Merchant contains AMZN
    await page.selectOption('select#condition-field-0', { value: 'merchant' });
    await page.selectOption('select#condition-operator-0', { value: 'contains' });
    await page.fill('input#condition-value-0', 'AMZN');

    // Set action: Rename to Amazon
    await page.selectOption('select#action-type-0', { value: 'rename_merchant' });
    await page.fill('input#action-value-0', 'Amazon');

    await page.click('text=Save Rule');

    // 3. Go to Transactions and create the transaction
    await page.click('text=Transactions');
    await page.click('text=Add Transaction');
    await page.fill('input[placeholder="Merchant Name"]', 'AMZN MKTP');
    await page.fill('input[placeholder="0.00"]', '45.99');
    await page.click('text=Save Transaction');

    // 4. Verify that the rule was immediately applied on transaction creation
    await expect(page.getByText('Amazon')).toBeVisible();
    // "AMZN MKTP" should not be visible in the main merchant name cell
    await expect(page.locator('.font-medium:has-text("AMZN MKTP")')).not.toBeVisible();
  });
});
