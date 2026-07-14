# LedgerLocal Testing Suite Documentation

This document explains the testing stack, test structure, command list, and quality assurance workflows used to maintain LedgerLocal's code integrity.

---

## 📌 Contents
1. [Testing Stack & Utilities](#testing-stack--utilities)
2. [Test Project Organization](#test-project-organization)
3. [Running Tests (Command Reference)](#running-tests-command-reference)
4. [Unit and Component Testing (Vitest)](#unit-and-component-testing-vitest)
5. [End-to-End browser Automation (Playwright)](#end-to-end-browser-automation-playwright)
6. [Accessibility Testing (axe-core)](#accessibility-testing-axe-core)
7. [CSV Import Mock Fixtures](#csv-import-mock-fixtures)
8. [Database Isolation & Reset Routines](#database-isolation--reset-routines)
9. [Code Coverage Reporting](#code-coverage-reporting)
10. [Continuous Integration (CI) Model](#continuous-integration-ci-model)
11. [Known Testing Gaps](#known-testing-gaps)

---

## 1. Testing Stack & Utilities
LedgerLocal features a multi-tiered quality control matrix that tests code from pure units to live browser render layers:
* **Test Runner**: [Vitest](https://vitest.dev/) (fast, modern Jest-compatible runner native to Vite)
* **Component Testing**: [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) with `@testing-library/jest-dom` assertions
* **End-to-End (E2E) Browser Runner**: [Playwright](https://playwright.dev/)
* **Accessibility Audits**: `@axe-core/playwright`
* **In-Memory Storage Mock**: `fake-indexeddb` (simulates IndexedDB operations in Node.js test environments without spinning up a real browser)

---

## 2. Test Project Organization
Tests are separated based on scope:

```
├── src/
│   ├── test/                  # Core test configuration and factories
│   │   ├── factories/         # Dynamic mock data generators (accounts, transactions)
│   │   ├── fixtures/          # CSV upload sheets using fictional test data
│   │   ├── helpers/           # In-memory storage clearers
│   │   └── setup.ts           # Vitest environment initialization & fake-indexeddb bootstrap
│   └── pages/                 # Component level tests alongside production pages
│       ├── AccountsPage.test.tsx
│       ├── BudgetsPage.test.tsx
│       └── ...
└── tests/
    └── e2e/                   # E2E Playwright test specs
        ├── accessibility.spec.ts
        ├── budgets.spec.ts
        ├── csv-import.spec.ts
        ├── first-launch.spec.ts
        └── rules.spec.ts
```

---

## 3. Running Tests (Command Reference)

You can run these commands from the repository root:

| Command | Purpose | Runner |
| :--- | :--- | :--- |
| `npm run lint` | Runs TypeScript compilation check (`tsc --noEmit`) to verify types | TSC compiler |
| `npm run test` | Runs the full Vitest unit/component suite in single-run mode | Vitest |
| `npm run test:watch` | Starts Vitest in interactive watcher mode for active development | Vitest |
| `npm run test:coverage` | Generates full text and HTML code coverage metrics | Vitest + c8/v8 |
| `npm run test:e2e` | Runs E2E Playwright tests inside automated headless browsers | Playwright |
| `npm run test:e2e:ui` | Opens the interactive Playwright UI for debugging E2E specs | Playwright |

---

## 4. Unit and Component Testing (Vitest)
Unit and Component tests utilize the in-memory `fake-indexeddb` package. This creates a clean sandbox that prevents test execution from leaking database files onto your machine or colliding across concurrently running tests.

### What is verified in Vitest:
* **State Management Hooks**: Proper context dispatching, transaction refresh cycles, and profile swapping.
* **Pure Logical Utilities**: Mathematical transformations (dollar-to-cents rounding), merchant normalizers, and CSV parsed value cleanups.
* **Conditional Rules Engine**: Evaluating complex conditional nested operators (`AND`/`OR`) and confirming correct action outcomes.
* **Visual Component States**: Accurate form validation, error message boundaries, and responsive collapsible sidebar states.

---

## 5. End-to-End Browser Automation (Playwright)
E2E tests run inside a real browser sandbox. They compile the application, navigate through UI views, and perform actions exactly like a human user.

### Key E2E Scenarios covered:
* `first-launch.spec.ts`: Confirms initialization, profile setup, and demo data loading on clean launches.
* `csv-import.spec.ts`: Uploads dummy CSV files, performs header column mapping, asserts preview validity, and confirms record writes.
* `rules.spec.ts`: Creates conditional rule lists, triggers executions, and verifies transactions are automatically modified.
* `budgets.spec.ts`: Assigns monthly spend limits, logs transactions, and verifies visual progress bars update dynamically.

---

## 6. Accessibility Testing (axe-core)
We prioritize accessible UI patterns. Accessibility testing is automated in `tests/e2e/accessibility.spec.ts` using `@axe-core/playwright`.

* **What it checks**: Color contrast ratios, proper aria-attributes on interactive modal overlays, screen-reader focus outlines, and correct form label pairings.
* **Integrity**: Any changes that introduce poor accessibility markup will fail the build process, ensuring LedgerLocal remains usable for everyone.

---

## 7. CSV Import Mock Fixtures
Mock financial CSVs are stored in `src/test/fixtures/`. These sheets use strictly **fictional financial accounts, random balances, and generic transactions** (e.g. `Acme Corp`, `Mega Store`). 

> [!CAUTION]  
> Never include real personal bank statements, genuine account numbers, or real purchase listings in test fixtures. 

---

## 8. Database Isolation & Reset Routines
In E2E test specs, it is vital to start from a clean state. Playwright tests achieve this by executing reset routines before every spec block:

```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Clear any persistent local databases and restart the browser state
  await page.evaluate(() => {
    window.indexedDB.deleteDatabase('ledger-local-system');
  });
});
```
This guarantees that tests are isolated, deterministic, and repeatable.

---

## 9. Code Coverage Reporting
To view our exact code test coverage, run:
```bash
npm run test:coverage
```
This generates a text report in your console and compiles an interactive HTML visualizer under `/coverage/index.html`. You can open this file in your browser to inspect which lines of code are tested.

---

## 10. Continuous Integration (CI) Model
When a pull request is submitted:
1. Static analysis runs to check syntax and type errors (`npm run lint`).
2. The compiler runs to verify production-ready packaging (`npm run build`).
3. Unit and component tests run using Vitest (`npm run test`).
4. Automated browser tests run using Playwright (`npm run test:e2e`).

---

## 11. Known Testing Gaps
* **Safari and Firefox specific bugs**: Testing is primarily optimized for Chromium browsers inside headless environments.
* **Complex Multi-Year Rollovers**: Multi-year rollover compound budget tracking is currently verified manually and needs broader automated coverage.
* **Large File Import Performance**: Performance benchmarks for importing files containing over 10,000 rows require stress-test specs.
