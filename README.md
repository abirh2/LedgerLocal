# LedgerLocal

[![Continuous Integration](https://github.com/OWNER/REPOSITORY/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPOSITORY/actions/workflows/ci.yml)
[![Deploy static content to Pages](https://github.com/OWNER/REPOSITORY/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/OWNER/REPOSITORY/actions/workflows/deploy-pages.yml)

### Factual, Private, Local-First Personal Finance Tracker

**LedgerLocal** is a private, local-first personal finance tracker that imports financial CSV files without connecting to banks or sending financial data to a server. 

> [!WARNING]  
> **License Notice**: This repository currently does not have an open-source license. The repository owner must choose a license before encouraging distribution, cloning, or public contributions.

---

## 📷 Screenshots

<!-- The following are placeholders for application screenshots. Maintainers can add images under docs/images/ -->

| Overview Dashboard | CSV Import |
| :---: | :---: |
| <!-- docs/images/overview.png --> *[Placeholder: Dashboard with Net Worth, cash flow chart, and account summaries]* | <!-- docs/images/csv_import.png --> *[Placeholder: Drag & drop interface, column mapping, and import preview]* |

| Transactions Manager | Reports & Category Breakdown |
| :---: | :---: |
| <!-- docs/images/transactions.png --> *[Placeholder: Tabular view of transactions with filtering, category selection, and manual editing]* | <!-- docs/images/reports.png --> *[Placeholder: Interactive Recharts visualizations of spending trend, fixed vs variable costs, and category groups]* |

---

## ✨ Key Features

LedgerLocal implements a wide array of comprehensive local personal finance tracking features:

* **Local CSV Processing**: Import standard bank and credit card CSV exports. File processing occurs completely in-browser using `PapaParse` and is never sent to a server.
* **Custom Column Mapping**: Map arbitrary CSV columns to LedgerLocal's internal formats. Supports interactive selection for Date, Description, and Amount columns.
* **Interactive Column Auto-Guessing**: Leverages smart keywords (e.g., `date`, `posted`, `payee`, `amount`) to pre-map CSV columns automatically.
* **Duplicate Review**: View and review parsed CSV rows before writing them to the database. Identifies potential duplicates and highlights invalid rows (e.g., missing amounts or unparseable dates).
* **Multi-Profile Isolation**: Create separate financial profiles (e.g., *Personal*, *Business*). Under the hood, LedgerLocal completely segregates profiles into distinct, dynamically managed IndexedDB databases (`ledger-local-profile-<id>`).
* **Deterministic Categorization Rules**: Build high-performance, ordered rule chains to auto-categorize and clean up transactions. Rules support nested conditions (`AND` / `OR` logic) based on fields like description, merchant, account, amount, and notes. Actions include renaming merchants, assigning categories, adding/removing tags, excluding from reports, and marking as transfer or refund.
* **Visual Reports**: Explore interactive visual analytics built with `Recharts`. View spending trends, cash flow, category breakdowns, and fixed vs. variable expense distributions.
* **Budget Planning**: Set monthly budgets by category with visual indicators for spent vs. remaining funds and rollover settings.
* **Recurring Transactions**: Monitor recurring bills, subscriptions, and income streams. Manage expected amounts and frequencies.
* **Net Worth Tracker**: View manual and imported accounts in a unified panel. Set manually updated accounts or compute balances dynamically from transaction ledgers.
* **Offline Investment Tracking**: Log and track investment transactions (`Buy`, `Sell`, `Dividend`, `Reinvestment`), stock symbols, holdings, price snapshots, and historical valuations.
* **Local Backups & Restore**: Export your entire application database (including system configurations, settings, profiles, and transactional data) into a single JSON file. Restore backups via full-replacement or merge strategies.
* **Static Portability**: LedgerLocal compiles to static assets (HTML, CSS, JS) and runs entirely client-side. It can be easily self-hosted on static hosts like GitHub Pages.

---

## 🔒 Privacy Model

LedgerLocal is designed from the ground up to guarantee absolute financial privacy:

* **No Bank Logins**: No Plaid, Yodlee, or direct bank credential integrations. All ingestion relies on manual input or local CSV uploads.
* **No AI/LLM Calls**: LedgerLocal runs 100% locally in your browser. It does not send transaction descriptions or merchant data to external generative AI services or LLMs for categorization.
* **No Server Backend or Cloud Database**: Financial data is never written to a remote cloud database. LedgerLocal uses the browser's native **IndexedDB** engine to store transaction histories, accounts, and settings.
* **No Application Account Required**: There are no usernames, passwords, or emails sent to a sign-up server. Your financial identity is tied strictly to your browser profile.
* **No Telemetry or Analytics**: There are no tracking scripts, cookies, or remote reporting frameworks. Your application usage remains entirely confidential.
* **Browser Sandbox Limitations**: Because data is stored in the browser's IndexedDB, clearing your browser cache, storage, or site data will wipe your local records. It is critical to take regular local backups.
* **Host vs. Data Partitioning**: Hosting platforms (such as GitHub Pages or Cloud Run) only serve the static application files (HTML, CSS, JavaScript). None of your financial records, CSV imports, or account values are ever uploaded to, or stored on, the hosting servers.

---

## 🌐 Try the App

You can access the static web application hosted at the following URL:
👉 **[LedgerLocal Live Applet](https://ais-pre-f53n6bxkbjrbuemazfq5kp-366598270637.us-east1.run.app)** *(Static Preview)*

### Quick Start Checklist for First-Time Users:
1. **Isolated Storage**: Data is stored strictly inside that specific browser profile.
2. **Explore Safe**: Use the built-in **"Demo Data"** button to populate the UI with realistic fictional data first to see how charts and rules work.
3. **Backup Often**: Get into the habit of exporting JSON backups from **Settings** > **Backup & Restore** before clearing browser data.
4. **No Auto-Sync**: Data does not automatically synchronize across devices (e.g., between your phone and your desktop) since there is no remote cloud server. Use JSON backup exports to transfer profiles.

---

## 💻 Local Installation

Ensure you have **Node.js (v18.x or v20.x+)** installed. The project uses **npm** as its primary package manager.

### 1. Clone the Repository
```bash
git clone <repository-url>
cd <repository-directory>
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
Run the local development server (binds to port `3000` by default):
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Production Compilation
Build optimized static assets to the `dist/` directory:
```bash
npm run build
```

### 5. Local Production Preview
Preview the production build locally:
```bash
npm run preview
```

---

## 🚀 How to Use LedgerLocal

To get started with tracking your finances, follow this typical workflow:

1. **Create an Account**: Go to the **Accounts** page and create your bank accounts (e.g., *Main Checking*, *Visa Credit Card*).
2. **Download CSV**: Log into your bank or financial institution and download your transaction history as a CSV file.
3. **Import CSV**: Navigate to the **Import** tab on the sidebar. Select your CSV file.
4. **Map Columns**: Map your CSV columns to LedgerLocal's expected schema (Date, Description, Amount).
5. **Review and Confirm**: Filter out duplicates and preview how transaction rules will apply, then click **Confirm Import**.
6. **Categorize Transactions**: Check your imported ledger on the **Transactions** page. Add categories manually or set up automatic rules on the **Rules** page to categorize matching transactions in the future.
7. **Take a Backup**: Go to **Settings** > **Backup** and download your JSON data file to keep your history safe.

*For detailed guidance, refer to the [User Guide](docs/USER_GUIDE.md).*

---

## 📊 CSV Support & Standard Mapping

Since financial institutions do not adhere to a single unified CSV format, LedgerLocal uses a **highly flexible column mapping pipeline**:

* **Auto-Guessing**: Leverages common keywords (`postedDate`, `posted`, `payee`, `amount`) to map files instantly.
* **Sign Modes**: Handles unified sign files (where negative represents debits and positive represents credits) and separate debit/credit column structures.
* **Parentheses Parsing**: Automatically detects financial accounting layouts like `(100.00)` as `-100.00`.
* **Profiles**: Remembers column mapping indices so you don't have to remap columns for the same bank on subsequent imports.

*For examples of compatible CSV formats, see [CSV Import Documentation](docs/CSV_IMPORTS.md).*

---

## 🛠️ Technology Stack

LedgerLocal is constructed with a highly modular modern frontend architecture:

* **UI Framework**: [React 19](https://react.dev/)
* **Build System**: [Vite 6](https://vite.dev/)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
* **Database Layer**: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) managed via the [idb](https://www.npmjs.com/package/idb) wrapper
* **CSV Parsing**: [Papa Parse](https://www.papaparse.com/)
* **Charts & Analytics**: [Recharts](https://recharts.org/)
* **Animation**: [Motion](https://motion.dev/)
* **Data Validation**: [Zod](https://zod.dev/)
* **Utility Libraries**: `date-fns`, `clsx`, `tailwind-merge`

---

## 📁 Repository Structure

```
.
├── .github/                   # GitHub issues & PR templates
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   └── feature_request.yml
│   └── pull_request_template.md
├── docs/                      # Technical & User documentation
│   ├── ARCHITECTURE.md
│   ├── CSV_IMPORTS.md
│   ├── DEPLOYMENT.md
│   ├── DEVELOPMENT.md
│   ├── PRIVACY.md
│   ├── TESTING.md
│   └── USER_GUIDE.md
├── src/                       # Application source code
│   ├── components/            # Shared UI components (layout, widgets)
│   ├── database/              # IndexedDB schemas, system db, and store connections
│   ├── lib/                   # Normalizers, rules engine, and CSV utility functions
│   ├── models/                # TypeScript domain type models
│   ├── pages/                 # Full application pages & local test suites
│   ├── store/                 # State management context providers
│   ├── test/                  # Test setup, factories, fixtures, and helpers
│   ├── App.tsx                # Routing and main application content
│   ├── index.css              # Global Tailwind v4 styles
│   └── main.tsx               # Client entry point
├── tests/                     # Playwright End-to-End browser tests
│   └── e2e/                   # Test specs for features (accessibility, rules, CSV)
├── package.json               # Manifest file containing scripts and dependencies
├── playwright.config.ts       # Playwright E2E configuration
├── tsconfig.json              # TypeScript compilation rules
└── vite.config.ts             # Vite configuration using @tailwindcss/vite
```

---

## 🧪 Testing

LedgerLocal is backed by a rigorous multi-tier test suite. To learn how tests are structured, consult [Testing Documentation](docs/TESTING.md).

### Run Linting & Type Checks
```bash
npm run lint
```

### Run Unit & Component Tests (Vitest)
```bash
npm run test
```

### Run Coverage Report
```bash
npm run test:coverage
```

### Run Playwright End-to-End Tests
```bash
npm run test:e2e
```

---

## 🚀 Deployment

LedgerLocal is compiled into static assets that can be served on static infrastructure. Detailed guides for deploying via **GitHub Pages** can be found in the [Deployment Guide](docs/DEPLOYMENT.md).

---

## 🤝 Contributing

Contributions are welcome from the community. Before submitting a Pull Request, please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

* **Fictional Test Data**: Always use fictional or randomized dummy financial data. Never attach or upload real bank CSV exports to GitHub issues or include them as test fixtures.
* **Privacy Constraints**: Features that introduce tracking, remote financial aggregation, cloud APIs, or AI integrations will be rejected to preserve the core privacy mission of LedgerLocal.

---

## 🛡️ Security & Disclosures

To report a vulnerability or read about the security model, consult our [Security Policy](SECURITY.md).

> [!WARNING]  
> **DO NOT** attach real CSV exports or un-redacted console logs to public GitHub issues. They may contain highly sensitive information like account numbers, home addresses, account balances, and merchant histories.

---

## 🗺️ Product Roadmap

* **[Todo] Enhanced CSV Auto-Detection**: Build heuristic mappings for standard bank exports to speed up first-time column configuration.
* **[Todo] Tag Manager**: Add a dedicated dashboard under Settings to manage, bulk-rename, and color-code custom transaction tags.
* **[Future] Dark Theme Support**: Standardize custom Tailwind v4 semantic dark colors.
* **[Future] Split Transactions**: Support splitting a single imported transaction across multiple categories.

---

## ⚠️ Known Limitations

1. **Browser Cache Clear**: If your browser clears local storage or site cache, IndexedDB files are deleted. Users must export backups to maintain long-term histories.
2. **Device Isolation**: There is no live remote synchronization. If you work across a laptop and desktop, data will diverge unless manual backup exports are shared.
3. **CSV Variations**: Financial institutions update CSV layouts without warning. Importers may occasionally require manual column adjustments.
4. **No Live Aggregation**: No real-time scraping of stock prices or live bank account feeds.

---

## 📄 License

*This repository does not currently contain an active software license. Maintainers or owners must add a LICENSE file before encouraging public redistribution or commercial usage.*
