# CSV Import Technical Documentation

This document explains the technical specification, normalization pipelines, and duplicate detection heuristics of LedgerLocal's CSV import engine. It is written to help both power users and developers understand how financial data is ingested, validated, and normalized.

---

## 📌 Contents
1. [Why Financial CSVs Differ](#why-financial-csvs-differ)
2. [Normalized Internal Format](#normalized-internal-format)
3. [Amount Handling & Sign Directions](#amount-handling--sign-directions)
4. [Date and Number Parsing](#date-and-number-parsing)
5. [Delimiters and Structure](#delimiters-and-structure)
6. [Saved Mapping Profiles](#saved-mapping-profiles)
7. [Validation Engine](#validation-engine)
8. [Duplicate Detection Heuristics](#duplicate-detection-heuristics)
9. [Fictional Bank CSV Examples](#fictional-bank-csv-examples)
10. [Developer Guidelines: Extending the Importer](#developer-guidelines-extending-the-importer)

---

## 1. Why Financial CSVs Differ
Unlike structured data standards (such as OFX or QIF), there is no universal CSV standard for bank transactions. Every financial institution exports columns with custom headers, unique date formats, distinct sign conventions, and arbitrary metadata wrappers. 

For example:
* **Bank A** might use headers `Date`, `Description`, `Amount` (with negative values for outflows).
* **Bank B** might use headers `Transaction Date`, `Payee`, `Debit`, `Credit` (with separate positive values for outflows and inflows).
* **Bank C** might prepend several lines of text metadata (e.g., "Account Number: *******1234") before the actual CSV header row.

LedgerLocal resolves this variability with a highly robust, interactive parsing and mapping engine.

---

## 2. Normalized Internal Format
Regardless of the raw CSV columns, all transaction records are normalized into a strict internal model before being committed to IndexedDB. This model is defined in `src/models/types.ts`:

```typescript
export interface Transaction {
  id: string;                      // Unique ID (e.g., 'imp_<timestamp>_<index>')
  accountId: string;               // Target Account UUID
  importId?: string;               // Linked Import Record ID
  postedDate: string;              // Normalized Date format: YYYY-MM-DD
  transactionDate?: string;        // Optional transaction date: YYYY-MM-DD
  originalDescription: string;     // Exact description string from CSV
  merchantName: string;            // Normalized, human-readable merchant name
  amountCents: number;             // Amount in integer cents (positive = income, negative = expense)
  categoryId?: string;             // Category UUID
  transactionType?: string;        // Raw bank transaction type (e.g., DEBIT, FEE, DIRECT_DEP)
  notes?: string;                  // User notes
  excludedFromReports: boolean;    // Reporting toggle
  isTransfer: boolean;             // Transfer flag
  transferId?: string;             // Linked matching transfer ID
  isRefund?: boolean;              // Refund flag
  refundOfId?: string;             // Linked original transaction ID
  tags?: string[];                 // Searchable labels
  ruleId?: string;                 // Linked rule ID that categorized this record
  manualEdit?: boolean;            // Edit flag (protects from rule overwrites)
  createdAt: string;               // ISO Timestamp
}
```

---

## 3. Amount Handling & Sign Directions
Financial calculations performed on floating-point numbers can introduce precision issues (e.g., `0.1 + 0.2 = 0.30000000000000004`). LedgerLocal avoids this entirely by representing all currency values as **integers representing cents** (`amountCents`). For example, `$12.50` is stored as `1250`, and a credit card expense of `-$45.99` is stored as `-4599`.

### Support Ingestion Modes:
1. **Single Amount Column**: A single column represents all transactions.
   * Debits (Outflows/Expenses) must be represented as **negative numbers** (e.g., `-15.00` or `(15.00)`).
   * Credits (Inflows/Income) must be represented as **positive numbers** (e.g., `1200.00`).
2. **Inverted Card Columns**: Credit card exports often invert this direction (where purchases show as positive charges and payments show as negative outflows). The mapping UI allows users to check a toggle to invert signs.
3. **Dual Columns (Debit vs. Credit)**: Some bank sheets split transactions across two separate columns. The parser handles this by subtracting the Debit column value from the Credit column value to derive the final net `amountCents`.

---

## 4. Date and Number Parsing
The normalization engine uses strict parsing layers (`src/lib/importUtils.ts`) to handle variations:

* **Dates**: Handled via Javascript's `Date` constructor and formatted to `yyyy-MM-DD` using `date-fns`. Supports common bank formats (e.g., `MM/DD/YYYY`, `YYYY-MM-DD`, `DD-MMM-YYYY`).
* **Numbers**: Floating values are cleaned of non-numeric symbols (e.g., `$`, commas used as thousands separators) before conversion. Parentheses (accounting notation) are converted to negative numbers:
  ```typescript
  // Converts standard banking accounting notations
  let processedAmount = cleanAmount;
  if (cleanAmount.startsWith('(') && cleanAmount.endsWith(')')) {
    processedAmount = `-${cleanAmount.slice(1, -1)}`;
  }
  ```

---

## 5. Delimiters and Structure
We utilize `PapaParse` under the hood to handle robust CSV files:
* **Delimiters**: Automatically detects commas `,`, semicolons `;`, or tabs `\t`.
* **Quotes**: Intelligently unescapes quoted fields containing delimiters (e.g., `"Starbucks, Chicago IL"` as a single description block).
* **Line endings**: Supports Unix-style `\n` and Windows-style `\r\n` formats.

---

## 6. Saved Mapping Profiles
To prevent users from having to configure column mappings every time they import a file, mappings are stored inside your system database profile.

When a file is imported successfully:
1. The column configuration (`dateCol`, `descCol`, `amountCol`) is saved.
2. The mapping is bound specifically to the **Account ID**.
3. On future uploads to that account, the mapping is prefilled automatically, creating a seamless "One-Click Import" experience.

---

## 7. Validation Engine
During the interactive import steps, the CSV file runs through a client-side validator:

* **Rows Validation**: Each parsed row is verified.
* **Checks**:
  * Does the row have a valid, parseable date?
  * Does the row contain a parseable numeric amount?
  * Is the description field populated?
* **Safety**: If a row fails any checks, it is flagged as **Invalid** in the review table, and a detailed warning tooltip is displayed. Invalid rows are excluded from the database write-phase to prevent data corruption.

---

## 8. Duplicate Detection Heuristics
To prevent double-counting transactions (especially when statements have overlapping dates), LedgerLocal runs imported transactions against a **sliding-window deduplication checker**:

1. **Composite Matching Key**: For each imported row, it compiles a matching key:
   * **Exact Date Match** (`postedDate`)
   * **Exact Amount Cents Match** (`amountCents`)
   * **Similarity Check on Description**: Compares normalized merchant names to avoid minor suffix discrepancies (e.g., `Amazon.com*AMZN` vs `Amazon.com`).
2. **Database Lookup**: Searches existing transactions in that account within a range of **+/- 3 days** of the target date to account for bank processing delays.
3. **Deduplication Suggestion**: If a match is found, the row is marked with a "Potential Duplicate" flag in the Review Table, and the row checkbox is unchecked by default.

---

## 9. Fictional Bank CSV Examples

These templates represent standard layouts supported by our custom mapper.

### Format A: Standard Single Amount (Typical Checking Account)
```csv
Transaction Date,Description,Amount,Balance
07/12/2026,STARBUCKS #4421,-4.50,1452.10
07/11/2026,PAYROLL DIRECT DEP,2500.00,1456.60
07/10/2026,STATE FARM INSURANCE,-112.40,-1043.40
```
* **Mapping**: `Date` = "Transaction Date", `Description` = "Description", `Amount` = "Amount".

### Format B: Credit Card (Inverted charges)
```csv
Posted Date,Merchant,Charge,Reference No
2026-07-14,GAS STATION 1234,45.12,9948271
2026-07-13,AMAZON.COM SALES,14.99,1024562
2026-07-10,AUTOPAY PAYMENT,-120.00,8837162
```
* **Mapping**: `Date` = "Posted Date", `Description` = "Merchant", `Amount` = "Charge" (Toggle **Invert Signs** to ensure purchases are stored as negative expenses).

---

## 10. Developer Guidelines: Extending the Importer

### Adding Default Heuristic Guesses
If you wish to add default header support for a new financial institution, update `src/pages/ImportsPage.tsx` where guessing occurs:

```typescript
// Auto-guess columns based on common bank headers
const guessField = (keywords: string[]) => fields.find(f => keywords.some(k => f.toLowerCase().includes(k))) || '';

setDateCol(guessField(['date', 'posted', 'trans_date', 'posted_date']));
setDescCol(guessField(['description', 'payee', 'merchant', 'name', 'payee_name']));
setAmountCol(guessField(['amount', 'value', 'charge', 'amt']));
```

### Writing Importer Tests
All import utilities are fully tested in `tests/e2e/csv-import.spec.ts` and `src/pages/ImportsPage.test.tsx`. When editing import pipelines:
1. Ensure your changes do not break existing test specs.
2. Add a fictional fixture CSV file to `src/test/fixtures/` and run the Vitest command to verify parsing logic:
   ```bash
   npm run test
   ```
