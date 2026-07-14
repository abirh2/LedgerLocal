# LedgerLocal Developer Documentation

This guide provides setup instructions, code conventions, database migration steps, and testing pipelines for developers working on the LedgerLocal codebase.

---

## 📌 Contents
1. [Prerequisites](#prerequisites)
2. [Local Setup](#local-setup)
3. [Environment Variables](#environment-variables)
4. [Project Structure](#project-structure)
5. [Code Conventions & Architecture Rules](#code-conventions--architecture-rules)
6. [Money & Currency Handling Pattern](#money--currency-handling-pattern)
7. [Date & Time Conventions](#date--time-conventions)
8. [IndexedDB Schema Migration Lifecycles](#indexeddb-schema-migration-lifecycles)
9. [How-To: Adding a New Feature Page](#how-to-adding-a-new-feature-page)
10. [How-To: Adding CSV Importer Column Guessers](#how-to-adding-csv-importer-column-guessers)
11. [Adding and Running Unit & E2E Tests](#adding-and-running-unit--e2e-tests)
12. [Debugging Tips & Tools](#debugging-tips--tools)
13. [Production Build Optimization](#production-build-optimization)

---

## 1. Prerequisites
Ensure you have the following installed on your developer workstation:
* **Node.js**: v18.x or v20.x+ (Recommended: LTS)
* **npm**: v9.x or v10.x+
* **Operating System**: macOS, Linux, or Windows (WSL recommended)

---

## 2. Local Setup
Follow these steps to set up the workspace:

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Install local dependencies**:
   ```bash
   npm install
   ```

3. **Spin up the development server**:
   ```bash
   npm run dev
   ```
   The application will boot on [http://localhost:3000](http://localhost:3000).

---

## 3. Environment Variables
LedgerLocal is an entirely static, client-side application. No secret environment variables or API keys are required for a fully functional deployment. 

The `.env.example` file contains placeholders for optional cloud/external services:
* `GEMINI_API_KEY`: Placeholder for potential future server-side AI categorizers. (Not currently active in local-first code).
* `APP_URL`: Self-referential URL where this applet is hosted.

---

## 4. Project Structure
The repository is structured as a clean, modular React workspace:

```
├── .github/                   # CI and issue configurations
├── docs/                      # General markdown docs
├── src/                       # Frontend application code
│   ├── components/            # Extracted UI elements
│   │   ├── layout/            # Navigation sidebars, headers, and grid wrappers
│   │   └── ui/                # Small atomic elements like buttons or dialog boxes
│   ├── database/              # Storage engines (IndexedDB wrappers)
│   │   ├── db.ts              # Profile database definitions & query handlers
│   │   ├── seed.ts            # Fictional demo dataset
│   │   └── systemDb.ts        # System database (profiles, preferences)
│   ├── lib/                   # pure functional utilities (rules engine, formatters)
│   │   ├── importUtils.ts     # CSV cleaners and date parsers
│   │   ├── merchantManager.ts # Description string cleanups
│   │   ├── ruleEngine.ts      # Conditional rule evaluator
│   │   └── utils.ts           # Class merger helpers
│   ├── models/                # Static TypeScript interface typing declarations
│   │   └── types.ts           # Shared interfaces (Rule, Transaction, etc.)
│   ├── pages/                 # Full screen layout structures with accompanying tests
│   │   ├── OverviewPage.tsx   # Dashboard widgets
│   │   └── OverviewPage.test.tsx # Page vitests
│   ├── store/                 # Global React Context provider
│   │   └── StoreContext.tsx   # Handles global state sync and IndexedDB triggers
│   ├── App.tsx                # Central entry routing component
│   ├── index.css              # Global styles configuring Tailwind v4
│   └── main.tsx               # Browser initialization
├── tests/                     # Playwright E2E automation folder
└── package.json               # Package manifests and runner scripts
```

---

## 5. Code Conventions & Architecture Rules
Keep implementation patterns uniform by adhering to these boundaries:
* **Function Components**: Write all React components as functional components utilizing standard hooks (`useState`, `useMemo`, `useCallback`). Do not use class-based components.
* **Component Splitting**: Do not dump all page logic inside `App.tsx`. Move modular cards, forms, and dialog overlays into separate files inside `src/components/` or keep them modular alongside their page files.
* **Imports Ordering**: Import React first, third-party libraries second, internal components/hooks third, and type declarations or styles last.

---

## 6. Money & Currency Handling Pattern
**Rule**: Never represent money amounts as floating-point numbers (`number` representing dollars) inside database states or calculation engines. Floating-point numbers introduce mathematical drift due to base-2 decimal conversion limits.

* **Pattern**: Always store financial values as **integers representing cents** (`amountCents`). E.g., `$45.99` is stored as `-4599` (debit) or `4599` (credit).
* **Formatters**: Use our visual formatters to render values in user interfaces:
  ```typescript
  export function formatCurrency(cents: number, locale = 'en-US', currency = 'USD'): string {
    const dollars = cents / 100;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency
    }).format(dollars);
  }
  ```

---

## 7. Date & Time Conventions
To prevent timezone skewing and visual displacement across user environments:
* **Storage format**: Store all calendar dates inside IndexedDB as standard ISO-8601 strings truncated to **`YYYY-MM-DD`** (e.g., `"2026-07-14"`). Do not store raw Javascript `Date` objects or raw timestamps.
* **Utilities**: Leverage `date-fns` functions (e.g., `format`, `parseISO`, `differenceInDays`) exclusively when computing calendar periods.

---

## 8. IndexedDB Schema Migration Lifecycles
LedgerLocal uses versioned schema upgrades managed within `src/database/db.ts`. 

The current schema is set to **Version 5**. The upgrade lifecycle steps operate as follows:
* **Version 1**: Initial creation of `accounts`, `transactions`, `categories`, `budgets`, and `imports` object stores.
* **Version 2**: Creation of the `recurring_overrides` object store.
* **Version 3**: Creation of `balance_snapshots` for tracking account balance points over time.
* **Version 4**: Addition of investment stores (`investment_transactions`, `holdings`, `price_snapshots`, and `account_valuations`).
* **Version 5**: Creation of `category_groups`, `rules`, `merchants`, and `transfer_matches` object stores to support advanced transaction organizing.

*When altering schemas, increment the version inside `openDB(...)` and add a conditional block inside the `upgrade` hook to create new stores or index pointers.*

---

## 9. How-To: Adding a New Feature Page
To add a new screen or sub-dashboard to LedgerLocal:

1. **Create the file**: Add your screen file under `src/pages/MyNewPage.tsx`. Ensure it exports a functional component:
   ```typescript
   import React from 'react';
   import { PageHeader } from '../components/layout/PageHeader';
   
   export function MyNewPage() {
     return (
       <div className="flex flex-col space-y-6 h-full">
         <PageHeader title="New Dashboard" />
         <div className="card-raised p-6">My content</div>
       </div>
     );
   }
   ```
2. **Bind Routing in App.tsx**: Import the new component and add a matching string case inside the switch block:
   ```typescript
   case 'mynewpage':
     return <MyNewPage />;
   ```
3. **Add Navigation Trigger in Sidebar.tsx**: Insert a navigation button inside the sidebar render list, linking `onNavigate('mynewpage')` to your case string.

---

## 10. How-To: Adding CSV Importer Column Guessers
To expand supported column headers (e.g., to match custom formats from regional banks), update `handleFileUpload` in `src/pages/ImportsPage.tsx`:

```typescript
// Add new keywords to auto-detect columns
setDateCol(guessField(['date', 'posted', 'booked_date', 'valuta']));
setDescCol(guessField(['description', 'payee', 'merchant', 'beneficiary', 'details']));
setAmountCol(guessField(['amount', 'value', 'charge', 'cents', 'valore']));
```

---

## 11. Adding and Running Unit & E2E Tests
Maintain the integrity of the ledger by accompanying updates with tests:

* **Unit Tests**: Place `.test.tsx` files directly alongside their companion page files. Run Vitest suites:
  ```bash
  npm run test
  ```
* **E2E Tests**: Add or update spec files under `tests/e2e/`. Run the Playwright compiler:
  ```bash
  npm run test:e2e
  ```

---

## 12. Debugging Tips & Tools
* **Developer Console**: You can view active IndexedDB states inside Google Chrome via **F12** > **Application** > **IndexedDB**. Expand stores to inspect records directly.
* **React Developer Tools**: Inspect active context values, reactive states, and render loops inside `StoreProvider`.
* **Diagnostics Panel**: Go to **Settings** > **Diagnostics** inside the app to check active DB schema versions, count rows, and evaluate browser quota allocations.

---

## 13. Production Build Optimization
LedgerLocal builds into optimized static assets through Vite and Tailwind CSS:
* Run the bundler:
  ```bash
  npm run build
  ```
* Vite outputs files to `/dist/`. This directory contains static `index.html`, minified stylesheets, and chunked Javascript files. 
* To test the optimized production build locally before committing, run:
  ```bash
  npm run preview
  ```
