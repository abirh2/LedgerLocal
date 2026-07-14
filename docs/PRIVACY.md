# LedgerLocal Privacy Specification

This document provides a factual, technical description of LedgerLocal's privacy architecture, data storage models, and local security guarantees.

---

## 📌 Contents
1. [What is Stored](#what-is-stored)
2. [Where Data is Stored](#where-data-is-stored)
3. [Network and External Requests](#network-and-external-requests)
4. [CSV Processing Mechanics](#csv-processing-mechanics)
5. [Backup File Sensitivity](#backup-file-sensitivity)
6. [Browser Sandbox Storage Risks](#browser-sandbox-storage-risks)
7. [Private Browsing (Incognito) Restrictions](#private-browsing-incognito-restrictions)
8. [Shared Device Considerations](#shared-device-considerations)
9. [Static Hosting Model (GitHub Pages)](#static-hosting-model-github-pages)
10. [Known Security & Privacy Boundaries](#known-security--privacy-boundaries)
11. [How to Permanently Erase All Data](#how-to-permanently-erase-all-data)

---

## 1. What is Stored
LedgerLocal stores the following transactional and configuration datasets:
* **Account Records**: Institution names, custom account labels, account types, and current balance totals.
* **Transaction Ledgers**: Posted dates, transaction dates, original descriptions, normalized merchant names, dollar amounts (in cents), category assignments, custom tags, and notes.
* **System Definitions**: Custom categories, budget allocations, recurring transaction overrides, and automatic categorization rules.
* **Profiles**: Visual profile names, colors, and global settings configurations (currency symbols, decimal patterns, default reporting intervals).

**No Personal Identifiable Information (PII)** (such as real names, email addresses, phone numbers, or actual physical street addresses) is ever collected or required by the application.

---

## 2. Where Data is Stored
Your financial data is stored exclusively in **IndexedDB** — a local transactional database provided natively by your web browser on your hard drive. 

* All data stays locked inside your browser's private application folder on your device.
* No data is synchronized with remote servers, databases, or third-party storage APIs automatically.
* The databases are organized as:
  * `ledger-local-system`: Main application state, settings, and profile registers.
  * `ledger-local-profile-<profileId>`: Transactional ledgers for each specific profile.

---

## 3. Network and External Requests
LedgerLocal is built as a fully self-contained static application:
* **Zero Backend APIs**: The application contains no server-side communication interfaces.
* **No Analytics or Telemetry**: LedgerLocal does not contain Google Analytics, Mixpanel, log capture engines, or other telemetry frameworks.
* **No External Asset Calls**: All icons, code structures, libraries, and layout styles are bundled locally. Once loaded, the application can operate entirely inside an air-gapped machine with no internet connection.

---

## 4. CSV Processing Mechanics
When you upload a transaction CSV file from your financial institution:
* Parsing is executed entirely client-side inside the browser using `PapaParse` in-memory.
* The file is **never uploaded** to a remote server for processing.
* The raw CSV file contents are discarded immediately after you complete the import process and close the page, or when the tab is refreshed. No temporary file copies are preserved on your file system by LedgerLocal.

---

## 5. Backup File Sensitivity
When you use the **Export Backup** feature in Settings, LedgerLocal compiles your entire database into a plain-text JSON file and triggers a browser file download.
* **Warning**: This exported JSON file is **not encrypted or password-protected**. It contains your complete, un-redacted financial history, merchant list, and accounts.
* **Storage recommendation**: Save backup files inside secure, encrypted storage vaults (such as BitLocker, FileVault, or password-protected local containers). Never upload unencrypted backups to public file-sharing platforms or public cloud folders.

---

## 6. Browser Sandbox Storage Risks
Modern browsers manage IndexedDB as temporary site storage. Under ordinary conditions, browser databases persist indefinitely. However:
* **Eviction Policies**: Under severe low-disk-space warnings, some browser engines (such as Safari on iOS/macOS or Chrome on Android) may automatically clear site databases to prioritize basic system functions.
* **Site Data Cleaning**: Manually choosing to "Clear History", "Delete Cookies and Site Data", or using system cleanup software (such as CCleaner) may permanently erase your local IndexedDB files.
* **Mitigation**: Download standard backup JSON files at the end of every tracking session to preserve your long-term records.

---

## 7. Private Browsing (Incognito) Restrictions
When executing LedgerLocal inside an Incognito or Private Browsing window:
* Browsers place IndexedDB databases into a temporary, volatile RAM space.
* **Immediate Data Loss**: As soon as you close the Private Browsing window or tab, the temporary database is completely wiped by the browser engine. 
* **Recommendation**: Avoid using LedgerLocal in Incognito tabs unless you only want to quickly test mappings with dummy data.

---

## 8. Shared Device Considerations
LedgerLocal does **not** include an application login, master pin, or password-locking mechanism.
* **Shared Computers**: Anyone who has access to your physical computer and logs into your operating system profile can open the browser, navigate to the LedgerLocal URL, and view your complete financial ledgers.
* **Mitigation**: Secure your physical workstation with a secure password or PIN, and lock your screen (`Win+L` or `Cmd+Ctrl+Q`) when leaving your device.

---

## 9. Static Hosting Model (GitHub Pages)
When LedgerLocal is hosted on a static server architecture like GitHub Pages:
* The hosting server only serves static assets (pre-compiled HTML files, stylesheets, and Javascript packages) to your browser.
* **No Remote Processing**: The hosting servers do not act as an intermediate processor or data store. Your database transactions are entirely executed locally inside the browser client and do not touch the hosting provider's logging infrastructure.

---

## 10. Known Security & Privacy Boundaries
While LedgerLocal keeps your data strictly offline, local administrators or forensic software with direct file-system access can theoretically extract database contents:
* **Local Storage Directory**: IndexedDB files are stored unencrypted in plain text inside your browser's local application profile directory (e.g., `%LocalAppData%\Google\Chrome\User Data\Default\IndexedDB` on Windows).
* **System Security**: If your physical machine is compromised, infected with spyware, or exposed to malware, those malicious scripts could theoretically query your local browser databases. Ensure your host system is backed by active antivirus software and keeps up-to-date with security patches.

---

## 11. How to Permanently Erase All Data
If you wish to completely wipe all traces of LedgerLocal from your machine:

### Option A: Via the Application
1. Go to **Settings** > **Diagnostics & Database Management**.
2. Scroll to **Database Management**.
3. Click **Reset Application Database**. This wipes all profile data, system databases, and settings.

### Option B: Via Browser Developer Tools
1. Open the application in your browser.
2. Open developer tools (`F12` or `Right-Click` > **Inspect**).
3. Navigate to the **Application** or **Storage** tab.
4. Select **IndexedDB** from the left-side tree.
5. Right-click and delete `ledger-local-system` and all databases prefixed with `ledger-local-profile-`.
6. Alternatively, click **Clear site data** to reset everything.
