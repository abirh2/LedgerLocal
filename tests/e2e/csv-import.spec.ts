import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('CSV Import Workflow', () => {
  test('should import transactions from a CSV file', async ({ page }) => {
    await page.goto('/');

    await page.click('text=Accounts');
    await page.click('text=Add Account');
    await page.fill('input[placeholder="e.g. Main Checking"]', 'Import Account');
    await page.click('text=Save Account');

    await page.click('text=Imports');
    const filePath = path.resolve('src/test/fixtures/csv/debit-credit.csv');
    await page.setInputFiles('input[type="file"]', filePath);

    await page.selectOption('select#import-account', { label: 'Import Account' });
    // Generic pipeline flow: opt into custom mapping for debit/credit layout.
    await page.getByText('Use custom column mapping instead').click();
    await page.selectOption('select#map-amount', { value: 'Debit' });
    await page.click('text=Preview Data');

    await expect(page.getByText('Review Import')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('row', { name: /Target/ })).toBeVisible();

    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.getByText('Import Complete')).toBeVisible({ timeout: 10000 });

    await page.click('text=Transactions');
    await expect(page.getByText('Target', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('-$15.50')).toBeVisible();
  });

  test('Bank of America checking fixture: detect, snapshot, import, undo', async ({ page }) => {
    await page.goto('/');

    await page.click('text=Accounts');
    await page.click('text=Add Account');
    await page.fill('input[placeholder="e.g. Main Checking"]', 'Example BoA Checking');
    await page.click('text=Save Account');

    await page.click('text=Imports');
    const filePath = path.resolve(
      'src/test/fixtures/csv/bankOfAmericaChecking/standard.csv'
    );
    await page.setInputFiles('input[type="file"]', filePath);

    await expect(page.getByText('Detected: Bank of America Checking')).toBeVisible({
      timeout: 10000,
    });
    await page.selectOption('select#import-account', { label: 'Example BoA Checking' });
    await page.locator('label:has-text("Import opening balance as snapshot")').click();
    await page.click('text=Preview Data');

    await expect(page.getByText('Review Import')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('EXAMPLE EMPLOYER PAYROLL').first()).toBeVisible();
    await expect(page.getByText('Opening balance').first()).toBeVisible();

    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.getByText('Import Complete')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Opening balance snapshots created:\s*1/)).toBeVisible();
    await expect(page.getByText(/Normal transactions imported:\s*6/)).toBeVisible();

    await page.getByRole('button', { name: 'Undo import' }).click();
    await page.click('text=Transactions');
    await expect(page.getByText('EXAMPLE EMPLOYER PAYROLL')).toHaveCount(0);
    await expect(page.getByText('EXAMPLE GROCERY STORE')).toHaveCount(0);
  });
});
