# LedgerLocal User Guide

Welcome to the **LedgerLocal User Guide**! This guide is written for nontechnical users to help you understand how to navigate, configure, and get the most out of your local-first personal finance tracker.

---

## 📌 Contents
1. [Product Overview](#product-overview)
2. [First-Time Setup](#first-time-setup)
3. [Managing Accounts](#managing-accounts)
4. [Downloading Bank CSV Files](#downloading-bank-csv-files)
5. [Importing CSV Files Walkthrough](#importing-csv-files-walkthrough)
6. [Mapping Columns & Saved Profiles](#mapping-columns--saved-profiles)
7. [Duplicate Review & Preview Safety](#duplicate-review--preview-safety)
8. [Editing Transactions Manually](#editing-transactions-manually)
9. [Setting Up Categorization Rules](#setting-up-categorization-rules)
10. [Transfers, Refunds, and Splits](#transfers-refunds-and-splits)
11. [Creating Budgets](#creating-budgets)
12. [Monitoring Recurring Transactions](#monitoring-recurring-transactions)
13. [Visual Reports & Dashboards](#visual-reports--dashboards)
14. [Net Worth Calculations](#net-worth-calculations)
15. [Investment Portfolio Tracking](#investment-portfolio-tracking)
16. [Backup, Restore, and Data Portability](#backup-restore-and-data-portability)
17. [Managing Local Profiles](#managing-local-profiles)
18. [Understanding Privacy, Storage, and Browser Sandboxes](#understanding-privacy-storage-and-browser-sandboxes)
19. [Troubleshooting Common Issues](#troubleshooting-common-issues)
20. [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)

---

## 1. Product Overview
LedgerLocal is an **offline-first, private personal finance utility** that operates entirely inside your web browser. 

Traditional budgeting tools require you to link your login credentials to third-party aggregators (like Plaid), storing your intimate transactional histories on cloud servers. LedgerLocal takes a different approach: **your data belongs to you**. 

* It does not connect to banks.
* It does not send tracking codes or analytics anywhere.
* It stores data locally in your browser's **IndexedDB** database.
* It operates completely offline once loaded.

---

## 2. First-Time Setup
When you first open LedgerLocal, you are greeted with a clean workspace. 
You can choose to:
1. **Load Demo Data**: Recommended for first-time exploration. Clicking the "Load Demo Data" prompt in **Settings** instantly populates fictional checking, credit, and investment accounts with typical transactions so you can explore the reports.
2. **Start Fresh**: Create your first profile and begin adding accounts manually or importing CSV sheets immediately.

---

## 3. Managing Accounts
Before you can record or import transactions, you must define where they live. Navigate to the **Accounts** page.

LedgerLocal supports two types of accounts:
* **Manual Accounts**: Managed entirely by hand. You enter transactions, log manual balance snapshots, and adjust balances manually.
* **Imported Accounts**: Synced via CSV files. Balance calculations are automatically calculated from the imported transactions.

### Supported Account Types:
* **Checking / Savings**: For daily liquid cash.
* **Credit Card**: For tracking card debt and credit card transactions.
* **Brokerage / Retirement**: For offline stocks and portfolio holdings.
* **Other**: For physical assets or manual loans.

---

## 4. Downloading Bank CSV Files
To get your transaction history into LedgerLocal, you will download **CSV (Comma Separated Values)** files from your bank's website.

1. Log into your bank or credit card portal (e.g., Chase, Wells Fargo, local credit union).
2. Find your **Transaction History** or **Statements** tab.
3. Select a date range (e.g., "Last 30 days" or "Year to Date").
4. Choose **CSV** or **Excel** as the export format (do NOT choose PDF).
5. Save the file to your computer.

---

## 5. Importing CSV Files Walkthrough
With your CSV statement downloaded, head to the **Import** tab on the LedgerLocal sidebar.

### Ingestion Pipeline Steps:
1. **Step 1: Upload**
   * Drag your bank's CSV file directly onto the dashed upload square, or click it to select the file using your computer's file explorer.
2. **Step 2: Map Columns**
   * Let the app parse the column headers. Check the selectors to ensure LedgerLocal knows which column represents the **Date**, which holds the **Description/Payee**, and which shows the **Amount**. Select your target account.
3. **Step 3: Review Preview**
   * Inspect the preview list. Rows with valid parameters will show a green checkmark. Rows with errors will show red exclamation points. You can filter duplicates before final approval.
4. **Step 4: Confirm**
   * Click **Confirm Import**. The records are written directly into your local IndexedDB database.

---

## 6. Mapping Columns & Saved Profiles
Since every bank structures CSV sheets differently, the Column Mapping wizard lets you guide the app:

* **Amount Columns**: Choose the CSV column holding the transaction amounts. LedgerLocal handles positive/negative values automatically.
* **Accounting Brackets**: The app intelligently converts accounting notations like `(15.99)` into standard negative amounts (`-15.99`).
* **Saved Configurations**: When you import a file, LedgerLocal links the mapping profile to your selected Account. The next time you import a CSV for that account, the mapping choices are preloaded automatically!

---

## 7. Duplicate Review & Preview Safety
To prevent double-counting transactions, the import engine employs a **Preview Review Panel**:

* **Auto-Detection**: The importer compares inbound transactions against existing records in that account using a composite key (Date + Amount + normalized Original Description).
* **Flags**: Rows identified as potential duplicates are pre-selected to be skipped. You can manually check or uncheck individual items in the review table.
* **Invalid Rows**: If a row is missing essential values (such as an empty date or unparseable amount), it is marked as invalid with a descriptive error so you can ignore or correct it before writing to storage.

---

## 8. Editing Transactions Manually
No matter how good an automated system is, manual corrections are occasionally necessary. On the **Transactions** page, click the edit (pencil) icon next to any transaction to open the edit panel:

* **Merchant Name**: Clean up cryptic bank descriptions (e.g., change `STARBUCKS STORE #12456` to `Starbucks`).
* **Category**: Reassign the transaction to any custom category.
* **Date**: Adjust the posted or transactional date.
* **Exclude**: Exclude the transaction from report graphs (excellent for giant, non-indicative purchases or temporary business-reimbursed expenses).
* **Notes & Tags**: Append searchable keywords, custom tags, or detailed notes.

---

## 9. Setting Up Categorization Rules
Rather than cleaning up the same descriptions every month, navigate to the **Rules** page to build automated categorization workflows.

### Understanding Rule Construction:
Rules are processed in a **top-down priority chain** (ordered by a priority rank).

1. **Conditions**: Set criteria such as:
   * *Merchant* contains `uber`
   * *Amount* is greater than `5.00`
   * *Debit/Credit* is `debit`
2. **Actions**: Set the resulting behaviors:
   * Rename Merchant to `Uber`
   * Assign Category to `Transportation`
   * Add Tag `rideshare`
3. **Execution**: Rules run automatically on every new CSV import. You can also run rules on demand across all existing uncategorized transactions by clicking **"Run on Uncategorized"** in the top-right corner.

---

## 10. Transfers, Refunds, and Splits
### Transfers:
When you pay your credit card bill from your checking account, you have two transactions: a debit in checking and an equal credit in the credit card.
* Mark both transactions as **Is Transfer**.
* You can link them directly in the UI as a single Transfer Match. This hides them from your expenses and income reports to avoid double-counting.

### Refunds:
If you return an item and receive a credit:
* Mark the incoming credit as a **Refund**.
* Link it to the original purchase transaction. This offsets the category's net spending rather than artificially inflating your "Income".

---

## 11. Creating Budgets
Navigate to the **Budgets** page to set boundaries for monthly spending:

* **By Category**: Create a target budget for any active category (e.g., `$400 / Month` for *Groceries*).
* **Visual Gauges**: A color-coded bar chart displays your current progress (Green = safe, Yellow = approaching limit, Red = over budget).
* **Rollover**: Enable rollover to transfer unused budget surpluses (or deficits) into the subsequent month automatically.

---

## 12. Monitoring Recurring Transactions
Track regular payments on the **Recurring** page:

* **Identified Series**: LedgerLocal analyzes your transaction log to surface recurring charges (e.g., Netflix subscription, utility bills, paychecks).
* **Overrides**: You can mark identified series as essential/non-essential, ignore random anomalies, adjust expected frequencies (Weekly, Monthly, Yearly), or predict upcoming bills.

---

## 13. Visual Reports & Dashboards
The **Reports** tab houses rich visual insights powered by `Recharts`:

* **Spending Trend**: Watch your expenditures scale day-by-day or month-by-month.
* **Category Breakdown**: An interactive pie chart displaying proportional costs across your budget groups.
* **Cash Flow**: A bar chart offsetting net income against net spending to see your monthly savings rate.
* **Fixed vs. Variable**: Monitor the ratio of non-discretionary costs (rent, insurance) versus discretionary spending (dining, entertainment).

---

## 14. Net Worth Calculations
Your **Net Worth** represents total assets minus total liabilities.

* **Asset Accounts**: Checking, Savings, and Brokerage balances.
* **Liabilities**: Credit Card statements and loan balances.
* LedgerLocal displays a real-time net worth total on your main **Overview** dashboard and tracks its change over time based on transaction logs and balance snapshots.

---

## 15. Investment Portfolio Tracking
The **Investments** page gives you a comprehensive dashboard to record stock, ETF, and mutual fund performance offline:

* **Log Activity**: Record standard transactions: `Buy`, `Sell`, `Dividend`, `Reinvestment`.
* **Holdings Panel**: Manage asset allocations. Log price snapshots manually to compute real-time market value and see your asset allocation percentage graphs.
* **Valuation History**: Track historical valuation snapshots to view your portfolio's growth curve over time.

---

## 16. Backup, Restore, and Data Portability
Because your data is stored inside your browser, maintaining offline backups is critical. Head to **Settings** > **Backup & Restore**.

* **Export Data**: Click "Export to JSON" to download a complete file containing all profiles, accounts, transactions, and settings. Store this file in a secure place (e.g., a local folder, private cloud drive, or USB drive).
* **Restore Data**: Upload a previously exported JSON file. You can choose to:
  * **Replace**: Erase all current local databases and overwrite with the backup.
  * **Merge**: Safely append non-duplicate records to your existing database.

---

## 17. Managing Local Profiles
Need to segregate your personal spending from a business or joint account? 

* Click your active Profile name at the bottom of the sidebar or navigate to **Settings** > **Profiles**.
* **Create Profile**: Add a new profile with a custom name and theme color.
* **Database Isolation**: Switching profiles instantly switches the active IndexedDB connection. Your personal transactions are completely isolated from your business workspace.

---

## 18. Understanding Privacy, Storage, and Browser Sandboxes
LedgerLocal relies on **IndexedDB**, a browser technology that allocates local storage space to specific websites. 

### Critical Storage Facts:
* **Storage Limits**: Modern browsers grant several gigabytes of space to IndexedDB, which is more than enough for decades of text-based financial transactions.
* **Storage Eviction Warning**: Under extreme low-disk-space conditions, browsers may automatically clean up "temporary" site data. To prevent this, go to **Settings** > **Diagnostics** to check your persistent storage allocation. Always download a monthly backup JSON to avoid accidental data loss!
* **Incognito/Private Browsing**: In Private Browsing mode, browsers restrict IndexedDB persistence. Once you close the private tab, your LedgerLocal data is permanently lost. Always run LedgerLocal in standard browser tabs.

---

## 19. Troubleshooting Common Issues
### My CSV File Won't Upload
* *Reason*: The file might not be in plain-text CSV format (e.g., it is a `.pdf`, `.xls`, or `.xlsx` sheet).
* *Solution*: Open the statement in Microsoft Excel or Google Sheets, go to "File" > "Save As", and select **Comma Separated Values (.csv)**.

### Amounts Are Reversed (Expenses show as Positive, Income as Negative)
* *Reason*: Some banks list debits as positive values on credit card statement exports.
* *Solution*: During the column mapping step, check the preview panel. The app automatically guesses standard directions, but you can toggle the amount column mapping to invert sign directions, or map separate Debit and Credit columns if your bank provides them.

### Recharts Graphs Are Blank
* *Reason*: There might be no categorized transactions, or your active date range filter has no records.
* *Solution*: Ensure transactions have assigned categories, and check your dashboard reporting period settings (e.g., change from "This Month" to "This Year" in the dashboard header).

---

## 20. Frequently Asked Questions (FAQ)
**Q: Can I access LedgerLocal on my phone and computer?**  
A: Since there is no central server, data does not sync automatically. You can, however, export your JSON backup from your computer and import it on your mobile browser manually.

**Q: Is my financial data encrypted?**  
A: No, IndexedDB files are stored unencrypted within your local browser profile directory on your device. However, this folder is isolated by your computer's operating system permissions. Anyone with administrator access to your physical computer profile can theoretically read the database. If you require absolute file-level encryption, consider using an operating system-level encrypted volume (like BitLocker or FileVault) for your user folder.

**Q: Does the app cost money or sell my data?**  
A: No, LedgerLocal is 100% free, open-source, offline, and contains zero trackers, ads, or analytics.

**Q: Where can I request features or report bugs?**  
A: You can open an issue on the project's GitHub repository. Remember **never** to upload screenshots or logs containing real account details or personal transactions.
