import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('CSV Import Workflow', () => {
  test('should import transactions from a CSV file', async ({ page }) => {
    await page.goto('/');

    // 1. Create an account first
    await page.click('text=Accounts');
    await page.click('text=Add Account');
    await page.fill('input[placeholder="e.g. Main Checking"]', 'Import Account');
    await page.click('text=Save Account');

    // 2. Go to Imports
    await page.click('text=Imports');

    // 3. Upload CSV
    const filePath = path.resolve('src/test/fixtures/csv/debit-credit.csv');
    await page.setInputFiles('input[type="file"]', filePath);

    // 4. Select Account on Mapping step
    await page.selectOption('select#import-account', { label: 'Import Account' });

    // 5. Select mapping for Amount since 'debit-credit.csv' does not have 'Amount' column
    await page.selectOption('select#map-amount', { value: 'Debit' });

    // 6. Click "Preview Data" to go to preview step
    await page.click('text=Preview Data');

    // 7. Verify Preview
    await expect(page.getByText('Review Import')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Target')).toBeVisible();

    // 8. Complete Import
    await page.locator('main button:has-text("Import")').click();

    // 9. Verify in Transactions page
    await page.click('text=Transactions');
    await expect(page.getByText('Target')).toBeVisible();
    await expect(page.getByText('-$15.50')).toBeVisible();
  });
});
