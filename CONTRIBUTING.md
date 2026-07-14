# Contributing to LedgerLocal

We appreciate your interest in contributing to LedgerLocal! This document outlines guidelines, coding standards, and repository workflows to ensure a smooth development cycle.

---

## 📌 Contents
1. [Core Philosophy & Boundaries](#core-philosophy--boundaries)
2. [Local Setup for Contributors](#local-setup-for-contributors)
3. [Branching and Workflow](#branching-and-workflow)
4. [Commit Messages Format](#commit-messages-format)
5. [Pull Request (PR) Quality Checklist](#pull-request-pr-quality-checklist)
6. [Testing Constraints (Unit & E2E)](#testing-constraints-unit--e2e)
7. [Adding Mock CSV Fixtures](#adding-mock-csv-fixtures)
8. [Adding Automatic Importers](#adding-automatic-importers)
9. [Accessibility Compliance (a11y)](#accessibility-compliance-a11y)
10. [Strict Privacy Safeguards (No Leakage)](#strict-privacy-safeguards-no-leakage)
11. [Issue Reporting Guidelines](#issue-reporting-guidelines)
12. [Documentation Maintenance](#documentation-maintenance)

---

## 1. Core Philosophy & Boundaries
LedgerLocal is designed to remain a **fully local, offline-first personal finance tracker**. To preserve this design, we enforce strict negative boundaries:
* **No Direct Bank Aggregators**: Pull Requests implementing automatic scraping, bank link APIs (such as Plaid), or remote login gateways will be rejected.
* **No Remote Telemetry or Tracking**: No analytics scripts, logging servers, or tracking cookies may be introduced.
* **No Cloud Backends**: Databases must remain localized in the client sandboxed IndexedDB space.
* **No generative AI or remote LLM integrations**: Categorization must stay strictly deterministic and run in local-first scripts.

---

## 2. Local Setup for Contributors
Make sure your system uses **Node.js LTS (v18.x or v20.x+)** and **npm v9.x+**:

```bash
# Clone the repository
git clone <repository-url>
cd <repository-directory>

# Install development dependencies
npm install

# Boot development environment
npm run dev
```

---

## 3. Branching and Workflow
* **Default Branch**: `main` serves as the stable production branch.
* **Feature Branches**: Sprout branches from `main` using descriptive naming templates:
  * `feature/add-split-transactions`
  * `bugfix/fix-csv-date-parse`
  * `docs/update-user-guide`

---

## 4. Commit Messages Format
Write concise, imperative commit messages to maintain a clean git history. We suggest following the **Conventional Commits** style:

```
<type>(<scope>): <short descriptive summary>

[Optional body explaining context]
```

### Supported Types:
* `feat`: A new user-facing feature.
* `fix`: A bug fix.
* `docs`: Documentation alterations.
* `style`: Code formatting changes (missing semicolons, white space).
* `refactor`: Structural rewrites that do not alter core behavior.
* `test`: Adding or correcting tests.

### Examples:
* `feat(import): add support for separate debit and credit CSV columns`
* `fix(budget): resolve rollover carryover error on month boundary`

---

## 5. Pull Request (PR) Quality Checklist
Before submitting a PR on GitHub, ensure you meet these criteria:
* The codebase compiles cleanly (`npm run build`).
* The code is fully typed and free of linter errors (`npm run lint`).
* All unit and component tests pass (`npm run test`).
* Playwright E2E browser automation runs successfully (`npm run test:e2e`).
* Your changes are accompanied by tests.
* The PR contains a complete description outlining the feature, testing approach, and screenshots (if UI changes were made).

---

## 6. Testing Constraints (Unit & E2E)
Every new layout change or logical function must be supported by test coverage:
* **Mathematical Utilities**: Verify precision cents limits.
* **Component-level Views**: Test button clicks, selector changes, and validation warnings under `/src/pages/`.
* **Flow Integration**: Ensure that user actions (e.g. creating rules, adding accounts) are tested in Playwright specs under `/tests/e2e/`.

---

## 7. Adding Mock CSV Fixtures
If your PR updates CSV parser rules, you must add a dummy CSV file under `/src/test/fixtures/` to prevent regression.

> [!CAUTION]  
> **Strict Rule**: Your fixture files must contain 100% fictional transactions and placeholder account entries. Never upload files containing real account numbers, real bank descriptions, or real transactions from your personal statements.

---

## 8. Adding Automatic Importers
To add default keyword detection for a new bank statement format:
1. Locate the header auto-guessing code blocks inside `src/pages/ImportsPage.tsx`.
2. Append your bank's common CSV header labels to the list of target keywords.
3. Verify your additions locally by loading the mock file on the Import page and confirming columns auto-guess correctly.

---

## 9. Accessibility Compliance (a11y)
LedgerLocal is built with modern, accessible HTML wrappers:
* Always use descriptive `id` and `aria-label` tags on buttons, links, and forms.
* Check contrast ratios to ensure text elements are highly legible against background surfaces.
* Verify your changes do not violate automated accessibility checks:
  ```bash
  npm run test:e2e
  ```

---

## 10. Strict Privacy Safeguards (No Leakage)
To protect your own privacy and that of other users:
* **Screenshots**: When appending screenshots to Pull Requests or issues, redact all real financial parameters, account values, or personal purchase details. Use dummy or demo-generated profiles.
* **Logs**: Never paste raw browser console logs containing your actual transaction objects into issues or discussions.

---

## 11. Issue Reporting Guidelines
If you encounter a bug or wish to suggest a feature:
1. Check the existing Issues tracker to avoid duplication.
2. Select the appropriate issue template on GitHub.
3. Be specific: Provide steps to reproduce, expected vs. actual outcomes, your browser name, and clear descriptions using strictly fictional figures.

---

## 12. Documentation Maintenance
If your Pull Request modifies user workflows, database schemas, or CLI scripts:
* Keep documentation matching actual code implementations.
* Update corresponding markdown files under `docs/` (e.g., `docs/USER_GUIDE.md` for workflow updates, `docs/DEVELOPMENT.md` for architecture additions).
* Verify relative documentation links resolve correctly.
