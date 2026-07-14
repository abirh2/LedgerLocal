# LedgerLocal Architectural Documentation

This document describes the internal engineering design, system components, storage layers, and data pipelines of LedgerLocal. It serves as a technical blueprint for developers seeking to maintain or contribute to the codebase.

---

## 📌 Contents
1. [System Topology Overview](#system-topology-overview)
2. [Local-First Architecture](#local-first-architecture)
3. [Core Database Module & Schema Design](#core-database-module--schema-design)
4. [Multi-Profile Database Isolation](#multi-profile-database-isolation)
5. [CSV Processing & Ingestion Pipeline](#csv-processing--ingestion-pipeline)
6. [Deterministic Rule Execution Engine](#deterministic-rule-execution-engine)
7. [Transfer Matching & Refund Linking](#transfer-matching--refund-linking)
8. [Reporting & Analytics Calculations](#reporting--analytics-calculations)
9. [Backup & Restore Serialization Schema](#backup--restore-serialization-schema)
10. [Routing and State Lifecycle](#routing-and-state-lifecycle)
11. [Testing Layers](#testing-layers)
12. [Static Sandbox Constraints (GitHub Pages)](#static-sandbox-constraints-github-pages)

---

## 1. System Topology Overview

LedgerLocal is built as a highly performant, statically compiled React application that is fully decoupled from external databases or API servers. 

```
┌────────────────────────────────────────────────────────────────────────┐
│                              BROWSER CLIENT                            │
│                                                                        │
│  ┌─────────────────────────┐               ┌────────────────────────┐  │
│  │     React Components    │ ◄───────────► │  React Context Store   │  │
│  │ (UI Pages, Recharts)    │               │     (StoreContext)     │  │
│  └─────────────────────────┘               └───────────▲────────────┘  │
│               ▲                                        │               │
│               │ (CSV File Upload)                      │ (DB Sync)     │
│               ▼                                        ▼               │
│  ┌─────────────────────────┐               ┌────────────────────────┐  │
│  │    Import Normalizer    │               │      Database API      │  │
│  │  (PapaParse, rulesEngine)│ ───────────►  │     (dbApi, idb)       │  │
│  └─────────────────────────┘               └───────────┬────────────┘  │
│                                                        │               │
└────────────────────────────────────────────────────────┼───────────────┘
                                                         │
                                                         ▼
                                             ┌────────────────────────┐
                                             │      IndexedDB         │
                                             │ (ledger-local-system)  │
                                             │ (ledger-local-profile) │
                                             └────────────────────────┘
```

---

## 2. Local-First Architecture
The "local-first" principle dictates that **data ownership, execution, and persistence** remain strictly on the user's local hardware:
* **Rich Client State**: All computations (interest accrual, budget rolls, report structures) are performed directly on the client.
* **Persistent Storage**: Changes are immediately written asynchronously to local disk space.
* **Zero Network Dependence**: The application starts, operates, parses files, and renders graphs even when disconnected from the internet.

---

## 3. Core Database Module & Schema Design
LedgerLocal splits persistence across two distinct database systems implemented using browser-native **IndexedDB** via the lightweight `idb` library:

### 1. System Database (`ledger-local-system`)
Houses global, cross-profile settings, available profiles list, and current app state.
* **Stores**:
  * `profiles`: User Profiles lists (`id`, `name`, `color`, `createdAt`, `lastUsedAt`).
  * `settings`: Custom configurations bound to specific Profile IDs.
  * `state`: Central operational variables (e.g., tracking `currentProfileId`).

### 2. Profile Database (`ledger-local-profile-<profileId>`)
Contains transactional, budgeting, rule, and asset tracking structures bound strictly to a single profile.
* **Stores & Indexes**:
  * `accounts`: Core financial account lists.
  * `transactions`: Bank ledgers. 
    * *Index*: `by-account` on `accountId`
    * *Index*: `by-date` on `postedDate`
  * `categories` & `category_groups`: Configurable visual organizational labels.
    * *Index*: `by-group` on `group` (CategoryGroup relationship)
  * `budgets`: Budget bounds defined by month and category.
    * *Index*: `by-month` on `month`
  * `rules`: Rule chains.
    * *Index*: `by-priority` on `priority` (for strict evaluation ordering)
  * `merchants`: Normalizer lists mapping messy descriptors to human-friendly clean strings.
  * `transfer_matches`: Paired counterparty transfers.
    * *Index*: `by-tx1` on `tx1Id`, `by-tx2` on `tx2Id`
  * `imports`: Records of previous CSV files ingested for audit tracking.
  * `recurring_overrides`: Series override rules.
  * `balance_snapshots`: Manual or computed historical ledger records.
  * `investment_transactions` / `holdings` / `price_snapshots` / `account_valuations`: High-performance tables backing the investment tracking suite.

---

## 4. Multi-Profile Database Isolation
LedgerLocal provides total isolation between distinct operational workspaces (e.g. *Personal* vs. *Business*):
1. **Dynamic Database Creation**: When a new Profile is created, LedgerLocal spawns a completely separate database file labeled `ledger-local-profile-<UUID>`.
2. **Context Switching**: When switching profiles via the UI:
   * The active database connection is safely `.close()`'d.
   * `currentProfileId` is updated in `ledger-local-system`.
   * A new database connection to the target profile database is initialized.
   * State variables are completely refreshed, preventing cross-profile memory leakage.

---

## 5. CSV Processing & Ingestion Pipeline
The ingestion pipeline is designed as an ordered transaction pipeline:

```
[Raw CSV File] 
    │
    ▼ (PapaParse)
[Raw Row Objects] 
    │
    ▼ (Column Mapper: Date, Desc, Amount)
[Normalized In-Memory Records] 
    │
    ▼ (Deduplication Engine: Similarity checks)
[Unique Rows] 
    │
    ▼ (Deterministic Rule Engine)
[Categorized Transactions] 
    │
    ▼ (IndexedDB Transaction)
[Saved local Records]
```

---

## 6. Deterministic Rule Execution Engine
Automated categorization is managed by a top-down prioritised rule compiler (`src/lib/ruleEngine.ts`):
* **Order of Execution**: Rules are sorted by their `priority` index (lowest priority values execute first).
* **Logical Combinators**: Conditions within a rule are evaluated as an `AND` block or an `OR` block. Nested groupings are fully supported.
* **Operations**: Supports string matches (`contains`, `starts_with`, `matches` Regex) and mathematical thresholds (`gt`, `lt` for amounts).
* **Actions**: If matched, actions (merchant renaming, category assignment, tag appending) are applied, stamping the transaction with `ruleId` provenance.
* **Immutability of Manual Edits**: If a transaction's `manualEdit` flag is `true`, the rule engine skips evaluation to preserve explicit user configurations.

---

## 7. Transfer Matching & Refund Linking
To prevent financial distortions:
* **Transfers**: Inter-account movements (e.g. paying credit cards from checking) are marked `isTransfer = true`. LedgerLocal matches opposing transactions of identical absolute values occurring within a 3-day window across separate accounts and links them as a confirmed `TransferMatch`.
* **Refunds**: Returning products credits cash back. LedgerLocal supports linking these credits (`isRefund = true`) directly to their original purchase transaction ID (`refundOfId`). Reports subtract this value from categorical expense sums instead of falsely counting it as positive income.

---

## 8. Reporting & Analytics Calculations
Graphical aggregates are computed dynamically on the client inside React components:
* **Cash Flow**: Income (categorized as credit) is offset against expenses (debits) in matching calendar buckets.
* **Historical Balances**: Computed on-the-fly by summing transaction deltas chronologically from the closest preceding `balance_snapshot` recorded for that account.
* **Variable vs. Fixed Cost Distribution**: Categorized spending balances are aggregated by joining category tables onto their primary group type (e.g., fixed housing costs vs. variable entertainment).

---

## 9. Backup & Restore Serialization Schema
Backups serialize your data into a structured single JSON document containing:
```json
{
  "version": "1.0.0",
  "timestamp": "ISO-8601-Timestamp",
  "settings": { ...UserSettings },
  "accounts": [ ... ],
  "transactions": [ ... ],
  "categories": [ ... ],
  "category_groups": [ ... ],
  "budgets": [ ... ],
  "rules": [ ... ],
  "merchants": [ ... ],
  "transfer_matches": [ ... ],
  "imports": [ ... ],
  "recurring_overrides": [ ... ],
  "balance_snapshots": [ ... ],
  "investment_transactions": [ ... ],
  "holdings": [ ... ],
  "price_snapshots": [ ... ],
  "account_valuations": [ ... ]
}
```
During restoration, the database uses indexed DB bulk transactions to guarantee atomic integrity (i.e., if one table load fails, changes are safely rolled back).

---

## 10. Routing and State Lifecycle
LedgerLocal is built as a single-page application (SPA). Instead of a heavy external router, routing is handled in `src/App.tsx` via standard React state:
* **Route State**: `currentView` (string) tracks active page panels (e.g., `overview`, `transactions`, `reports`, `settings`).
* **Profile Syncing**: React Context (`src/store/StoreContext.tsx`) provides shared reactivity, wrapping API endpoints and dispatching state refreshes so visual charts update immediately when transactions are added or deleted.

---

## 11. Testing Layers
Our quality assurance stack comprises three main testing tiers:
1. **Unit Tests (Vitest)**: Verifies isolated logic models like date cleanups, rules, and mathematical calculations.
2. **Component Tests (React Testing Library)**: Tests page interactions, forms, validation warnings, and responsive layout state toggles.
3. **E2E Tests (Playwright)**: Automates browser sandboxes to run end-to-end user flows (e.g. uploading fixtures, adding accounts, evaluating linter-compliance, verifying a11y standards).

---

## 12. Static Sandbox Constraints (GitHub Pages)
When deployed to static hosts like GitHub Pages:
* **No Server Middleware**: The app compiles purely to static HTML, CSS, and JS.
* **Local Sandboxing**: The browser strictly restricts IndexedDB access. If you host the app under a shared domain (e.g., `username.github.io/ledger-local/`), other applications on that exact subdirectory could theoretically access the storage. LedgerLocal avoids collision by dynamically isolating databases with unique naming keys.
