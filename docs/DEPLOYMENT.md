# LedgerLocal Deployment Documentation

This document explains how to compile, verify, and deploy LedgerLocal as a static web application to static hosting services, focusing primarily on **GitHub Pages**.

---

## 📌 Contents
1. [GitHub Pages Deployment Prerequisites](#github-pages-deployment-prerequisites)
2. [Base Path Configurations (Subdirectory vs. Custom Domain)](#base-path-configurations-subdirectory-vs-custom-domain)
3. [Local Production Build Verification](#local-production-build-verification)
4. [GitHub Actions Automated Deployment Workflow](#github-actions-automated-deployment-workflow)
5. [Enabling Pages in GitHub Repository Settings](#enabling-pages-in-github-repository-settings)
6. [SPA Routing & Page Fallbacks](#spa-routing--page-fallbacks)
7. [IndexedDB Behavior After Deployment](#indexeddb-behavior-after-deployment)
8. [App Updates & Browser Cache-Busting](#app-updates--browser-cache-busting)
9. [Deployment Rollback Procedure](#deployment-rollback-procedure)
10. [Troubleshooting Deployment and Workflow Failures](#troubleshooting-deployment-and-workflow-failures)

---

## 1. GitHub Pages Deployment Prerequisites
To deploy LedgerLocal to GitHub Pages, ensure you have:
* A GitHub account.
* A GitHub repository housing your cloned project.
* Write permissions to the repository to configure Actions or push code branches.

---

## 2. Base Path Configurations (Dynamic & Zero-Configuration)
LedgerLocal is configured to automatically determine its **base path** during compile/build runs. There is no need to manually modify `vite.config.ts` between environments:

* **Local Development**: Runs at root (`/`).
* **GitHub Actions Run (Standard Repo)**: Automatically detects your repository name from the build environment (`process.env.GITHUB_REPOSITORY`) and sets the compiled base to `/${repo}/` (e.g., `/ledger-local/`).
* **GitHub Actions Run (Username Site)**: Detects if the repository matches `<username>.github.io` and correctly falls back to root `/`.
* **Manual Override**: You can explicitly specify a custom base path by setting the `VITE_BASE_PATH` environment variable during build, which guarantees safe slashes.

---

## 3. Local Production Build Verification
Always verify your production bundle locally before deploying:

1. **Clean prior builds**:
   ```bash
   npm run clean
   ```
2. **Compile static assets**:
   ```bash
   npm run build
   ```
   This generates compiled output under the `/dist/` folder.
3. **Verify the static files locally**:
   ```bash
   npm run preview
   ```
   Open the returned local URL (usually `http://localhost:4173`) and test import and report workflows to verify the build runs without error.

---

## 4. GitHub Actions Automated Deployment & Continuous Integration
LedgerLocal splits CI and Deployment operations into separate, optimized pipelines under the `.github/workflows/` directory:

### Pipeline A: Continuous Integration (`.github/workflows/ci.yml`)
Runs automatically on every push or pull request to validation branches (`main`, `master`), verifying:
* Dependency installations (`npm ci`)
* Syntactic syntax and TypeScript type checking (`npm run lint`)
* Unit and component tests (`npm run test`)
* Production compilation (`npm run build`)

### Pipeline B: Pages Deployment (`.github/workflows/deploy-pages.yml`)
Runs automatically on merges/pushes to production branches (`main`, `master`) or manual triggers (`workflow_dispatch`). This workflow:
1. Validates tests, linting, and compiles the production application.
2. Automatically generates a `.nojekyll` bypass file in the output directory so that Vite's internal chunk folders (e.g. ones with underscores) are not ignored by Jekyll.
3. Uploads the build artifact.
4. Securely deploys the build directly to **GitHub Pages** using OIDC credentials.

---

## 5. Enabling Pages in GitHub Repository Settings
Once you have pushed your workflow file to GitHub:

1. Open your repository on GitHub.
2. Navigate to **Settings** > **Pages** (under Code and automation).
3. Under **Build and deployment**:
   * For **Source**, select **GitHub Actions** from the dropdown menu.
4. Push a commit to your `main` branch. This triggers the GitHub Actions workflow automatically, and your site will be live within minutes!

---

## 6. SPA Routing & Page Fallbacks
LedgerLocal is built as a single-page application (SPA) with browser-standard **hash routing** (e.g., `#overview`, `#settings`, `#guide`).
* **Static Host Compatibility**: Because static hosts like GitHub Pages do not provide server-side routing fallback, standard path routing (like `/settings`) will produce `404 Not Found` errors on refresh.
* **Our Solution**: Hash routing resolves all navigation client-side entirely within the root `index.html`. This guarantees that:
  * Opening the root URL loads properly.
  * Navigating between pages works seamlessly.
  * Refreshing on any page (e.g., `#transactions`) loads the exact correct page without 404s.
  * Browser **Back** and **Forward** buttons function flawlessly (via standard window `hashchange` listeners).
  * In-app deep links (e.g., onboarding steps navigating to other views) function robustly.

---

## 7. IndexedDB Behavior After Deployment
IndexedDB databases are bound strictly to the **origin** (the domain + port) of the active application.

* **Origin binding**: If you run LedgerLocal locally on `http://localhost:3000`, the browser isolates your databases. When you open your deployed app at `https://<username>.github.io/ledger-local/`, the browser creates a fresh, empty local database folder specifically for that deployed URL.
* **Data Migration**: To move your local development workspace data onto your newly deployed live site, export your JSON backup from localhost and import it on the deployed site.

---

## 8. App Updates & Browser Cache-Busting
Vite adds unique hash fingerprints to compiled file names during build tasks (e.g., `assets/index-D78a9c.js`).

* **Why this is important**: This fingerprint forces browsers to fetch the updated code rather than using outdated, cached versions of the application.
* **Caching on GitHub Pages**: GitHub Pages applies aggressive caching to static resources. To ensure you have the latest features loaded, press `Ctrl+F5` (or `Cmd+Shift+R` on Mac) to force-reload your browser and clear local cache buffers.

---

## 9. Deployment Rollback Procedure
If a deployment contains bugs and needs to be reverted immediately:

1. Navigate to your repository's **Actions** tab on GitHub.
2. Find the list of runs for the **Deploy static content to Pages** workflow.
3. Select the last **successful** run before the buggy release.
4. Click **Re-run all jobs** or manually restore your repository's code to that git commit and push to trigger a clean deploy.

---

## 10. Troubleshooting Deployment and Workflow Failures
### The build step fails during GitHub Actions
* *Reason*: Linter violations (`tsc --noEmit` found syntax or type mismatches) or a test failed inside the CI pipeline.
* *Solution*: Run `npm run lint` and `npm run test` on your local workstation. Resolve any compile errors before pushing updates.

### Images or stylesheet assets fail to load (404 errors)
* *Reason*: The `base` parameter in `vite.config.ts` does not match your GitHub Pages repository directory name.
* *Solution*: Verify your repository name and update the base configuration value.
