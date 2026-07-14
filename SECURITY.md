# Security Policy & Disclosures

We take the security and privacy of LedgerLocal seriously. This document outlines our security model, supported versions, and instructions on how to report vulnerabilities responsibly.

---

## 📌 Contents
1. [Supported Versions](#supported-versions)
2. [Security Model & Boundaries](#security-model--boundaries)
3. [Local Browser Storage Security Limitations](#local-browser-storage-security-limitations)
4. [Reporting a Vulnerability Privately](#reporting-a-vulnerability-privately)
5. [What to Include in a Security Report](#what-to-include-in-a-security-report)
6. [Data Redaction and Privacy Guarantees](#data-redaction-and-privacy-guarantees)

---

## 1. Supported Versions
LedgerLocal is distributed as a statically compiled client-side single-page application. Security fixes are applied directly to the active development branch:

| Version | Supported | Notes |
| :--- | :---: | :--- |
| `0.0.0` / `main` | Yes | Active development branch. Security patches are merged here. |
| All prior tags | No | Legacy tags do not receive backported security updates. |

---

## 2. Security Model & Boundaries
LedgerLocal operates under a **local-first trust boundary**:
* **No Server Footprint**: Because the application contains no server-side backend or cloud database, there are no remote SQL databases to exploit, no central authentication profiles to breach, and no centralized financial records to leak.
* **Attack Surface**: The primary security boundaries exist inside your **local physical machine** and **local browser sandbox**.

---

## 3. Local Browser Storage Security Limitations
Data is written unencrypted to **IndexedDB** inside your local browser folder. LedgerLocal does not execute custom encryption overlays on IndexedDB contents:
* **Operating System Isolation**: We rely on the host operating system's file permissions to protect your browser's application directory from other local users.
* **Malware Risk**: If your physical machine is infected with malware, keyloggers, or malicious administrative programs, those entities could theoretically read your browser's storage space. Keep your operating system secure, use an active antivirus program, and lock your workstation when unattended.
* **Disk Encryption**: If you require absolute cryptographic security for your physical storage drives, we strongly recommend enabling full-disk encryption (such as **BitLocker** on Windows or **FileVault** on macOS).

---

## 4. Reporting a Vulnerability Privately
If you find a security vulnerability, **do not open a public issue** on GitHub. Public disclosure exposes existing users to unnecessary security risks before a patch can be developed.

### Responsible Disclosure Protocol:
1. Please contact the repository owner privately to report the vulnerability.
   > 📬 **Maintainer Note**: Repository owners should replace this placeholder with their designated security email address or private reporting gateway.
2. Provide a detailed summary of the bug and steps to reproduce.
3. Allow the maintainer a reasonable time window to develop, test, and deploy a patch before disclosing details publicly.

---

## 5. What to Include in a Security Report
To help us understand and resolve the issue quickly, include:
* **Summary**: A high-level description of the security impact.
* **Reproduction Steps**: Step-by-step instructions or code snippets showing how to execute the exploit.
* **Environment Details**: Your operating system, browser name/version, and LedgerLocal application version/commit hash.
* **Proof of Concept (PoC)**: A safe demonstration showing the issue, using **exclusively fictional figures and mock transactions**.

---

## 6. Data Redaction and Privacy Guarantees
* **Strict Rule**: When compile-testing or assembling proof-of-concept material, **never attach real bank statements, genuine CSV sheets, or un-redacted browser console logs**. 
* Ensure all files, names, account balances, and transaction descriptions are fully replaced with mock or randomized strings.
* Any reports containing real, sensitive financial details will be closed immediately and deleted to protect your personal privacy.
