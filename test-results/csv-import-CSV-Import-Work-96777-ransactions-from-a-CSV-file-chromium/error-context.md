# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: csv-import.spec.ts >> CSV Import Workflow >> should import transactions from a CSV file
- Location: tests/e2e/csv-import.spec.ts:5:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Target')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Target')

```

```yaml
- complementary:
  - text: LedgerLocal
  - button "Collapse sidebar"
  - navigation:
    - button "Overview"
    - button "Transactions"
    - button "Accounts"
    - button "Budgets"
    - button "Recurring"
    - button "Investments"
    - button "Reports"
    - button "Imports"
    - button "Categories"
    - button "Merchants"
    - button "Rules"
    - button "Settings"
    - button "Privacy"
    - button "How to Use"
  - button "P Personal Local Profile":
    - text: P
    - paragraph: Personal
    - paragraph: Local Profile
  - text: Local Data Only
- main:
  - heading "Transactions" [level=1]
  - button "Add Transaction"
  - button "Import CSV"
  - textbox "Search transactions..."
  - text: 0 transactions
  - table:
    - rowgroup:
      - row "Select All Select all transactions Date Merchant Original Description Category Account Amount Actions":
        - columnheader "Select All Select all transactions":
          - text: Select All
          - checkbox "Select all transactions"
        - columnheader "Date"
        - columnheader "Merchant"
        - columnheader "Original Description"
        - columnheader "Category"
        - columnheader "Account"
        - columnheader "Amount"
        - columnheader "Actions"
    - rowgroup:
      - row "No transactions yet Import a CSV file to get started. Go to Imports":
        - cell "No transactions yet Import a CSV file to get started. Go to Imports":
          - paragraph: No transactions yet
          - paragraph: Import a CSV file to get started.
          - button "Go to Imports"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import path from 'path';
  3  | 
  4  | test.describe('CSV Import Workflow', () => {
  5  |   test('should import transactions from a CSV file', async ({ page }) => {
  6  |     await page.goto('/');
  7  | 
  8  |     // 1. Create an account first
  9  |     await page.click('text=Accounts');
  10 |     await page.click('text=Add Account');
  11 |     await page.fill('input[placeholder="e.g. Main Checking"]', 'Import Account');
  12 |     await page.click('text=Save Account');
  13 | 
  14 |     // 2. Go to Imports
  15 |     await page.click('text=Imports');
  16 | 
  17 |     // 3. Upload CSV
  18 |     const filePath = path.resolve('src/test/fixtures/csv/debit-credit.csv');
  19 |     await page.setInputFiles('input[type="file"]', filePath);
  20 | 
  21 |     // 4. Select Account on Mapping step
  22 |     await page.selectOption('select#import-account', { label: 'Import Account' });
  23 | 
  24 |     // 5. Select mapping for Amount since 'debit-credit.csv' does not have 'Amount' column
  25 |     await page.selectOption('select#map-amount', { value: 'Debit' });
  26 | 
  27 |     // 6. Click "Preview Data" to go to preview step
  28 |     await page.click('text=Preview Data');
  29 | 
  30 |     // 7. Verify Preview
  31 |     await expect(page.getByText('Review Import')).toBeVisible();
  32 |     await expect(page.getByText('Target')).toBeVisible();
  33 | 
  34 |     // 8. Complete Import
  35 |     await page.click('button:has-text("Import")');
  36 | 
  37 |     // 9. Verify in Transactions page
  38 |     await page.click('text=Transactions');
> 39 |     await expect(page.getByText('Target')).toBeVisible();
     |                                            ^ Error: expect(locator).toBeVisible() failed
  40 |     await expect(page.getByText('-$15.50')).toBeVisible();
  41 |   });
  42 | });
  43 | 
```