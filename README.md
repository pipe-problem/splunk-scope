# Splunk Scope

**Plan Splunk deployments with your customer—in the room, on your laptop.**

Splunk Scope is a browser-based workshop tool for Solutions Engineers. Use it after discovery to capture customer context, size data sources with transparent estimates, check telemetry coverage, compare Crawl / Walk / Run architecture paths, and export customer-ready reports.

Everything runs locally in your browser. Customer session data never leaves your machine unless you choose to export it.

> **Planning guidance only.** GB/day totals, coverage scores, and priority labels are estimates—not capacity commitments, quotes, or purchase orders. Validate with PoV measurements, retention requirements, and deployment constraints before staffing or licensing decisions.

---

## Download Splunk Scope

Splunk Scope is a **private GitHub repository**. You need access from the repo owner before you can download it.

**Repository:** [github.com/pipe-problem/splunk-scope](https://github.com/pipe-problem/splunk-scope)

### Before you start

| Requirement | Details |
|-------------|---------|
| **GitHub access** | You must be logged in and invited as a collaborator on `pipe-problem/splunk-scope` (private repo). If clone or download fails with “not found,” ask the owner for access. |
| **Node.js 20+** | Install from [nodejs.org](https://nodejs.org/) (LTS recommended). Check with `node -v` — you should see `v20.x` or newer. |
| **npm** | Bundled with Node.js. Check with `npm -v`. |
| **Browser** | Chrome, Edge, or Firefox (recent version). |
| **Splunk login** | **Not required** to run Scope. |

Optional: [Git](https://git-scm.com/downloads) if you want to clone and pull updates. Not required if you use **Download ZIP**.

---

### Quick start — copy and paste (Git clone)

Run these commands **one block at a time** in Terminal (Mac) or PowerShell (Windows). You must have [Node.js 20+](https://nodejs.org/) installed first.

**Mac / Linux:**

```bash
cd ~/Documents
git clone https://github.com/pipe-problem/splunk-scope.git
cd splunk-scope
npm install
npm run build
npm run dev
```

**Windows (PowerShell):**

```powershell
cd $HOME\Documents
git clone https://github.com/pipe-problem/splunk-scope.git
cd splunk-scope
npm install
npm run build
npm run dev
```

Then open **http://localhost:5173** in your browser.

- `npm run build` confirms the download is complete (if any app files are missing, this step fails with a clear error instead of a blank browser page).
- Keep the terminal open while using Scope. Press **Ctrl+C** to stop.

**Already cloned?** Pull the latest fix, reinstall if needed, and rebuild:

```bash
cd ~/Documents/splunk-scope
git pull
npm install
npm run build
npm run dev
```

---

### Quick start — copy and paste (ZIP download)

After you download and unzip the repo from GitHub:

**Mac / Linux** (change the folder name if yours differs):

```bash
cd ~/Downloads/splunk-scope-main
npm install
npm run build
npm run dev
```

**Windows (PowerShell):**

```powershell
cd $HOME\Downloads\splunk-scope-main
npm install
npm run build
npm run dev
```

Open **http://localhost:5173** in your browser.

---

### Option A — Clone with Git (recommended for updates)

Use this if you plan to run `git pull` when new versions are published.

1. Open a terminal (Terminal on Mac, PowerShell or Command Prompt on Windows).
2. Go to the folder where you keep projects, for example:
   ```bash
   cd ~/Documents
   ```
3. Clone the repository:
   ```bash
   git clone https://github.com/pipe-problem/splunk-scope.git
   ```
4. If GitHub asks you to sign in:
   - **HTTPS:** Use a [Personal Access Token](https://github.com/settings/tokens) as the password (classic token with **repo** scope). GitHub no longer accepts account passwords for git over HTTPS.
   - **SSH (alternative):** If you use SSH keys with GitHub:
     ```bash
     git clone git@github.com:pipe-problem/splunk-scope.git
     ```
5. Enter the project folder:
   ```bash
   cd splunk-scope
   ```

**Update later:** From inside `splunk-scope`, run `git pull` to fetch the latest code, then `npm install` if dependencies changed.

---

### Option B — Download ZIP (no Git required)

Use this for a one-time download or if you do not use Git.

1. Sign in to GitHub and open [github.com/pipe-problem/splunk-scope](https://github.com/pipe-problem/splunk-scope).
2. Click the green **Code** button near the top right of the file list.
3. Choose **Download ZIP**.
4. Unzip the archive:
   - **Mac:** Double-click the ZIP file. You will get a folder named `splunk-scope-main` or `splunk-scope-master`.
   - **Windows:** Right-click → **Extract All…**
5. Open a terminal and go into that folder, for example:
   ```bash
   cd ~/Downloads/splunk-scope-main
   ```
   (Adjust the path if your unzip location or folder name differs.)

**Note:** With ZIP downloads there is no `git pull`. To get a newer version, download a fresh ZIP and repeat setup below.

---

### Install dependencies

From inside the `splunk-scope` folder (clone or unzipped), run:

```bash
npm install
```

This downloads React, Vite, and other packages into `node_modules/` (a few hundred MB; first run may take 1–2 minutes).

If you see permission errors on Mac/Linux, do **not** use `sudo npm install`. Fix npm permissions or use a Node version manager ([nvm](https://github.com/nvm-sh/nvm)) instead.

---

### Start Splunk Scope

```bash
npm run dev
```

The terminal prints a local URL, usually:

**http://localhost:5173**

Open that URL in your browser. Scope runs entirely on your machine—keep the terminal window open while you work.

To stop the app, press **Ctrl+C** in the terminal.

---

### Production build (optional)

To serve a static build without the dev server (for example, hosting on an internal web server):

```bash
npm run build
npm run preview
```

Open the URL shown (typically **http://localhost:4173**). The built files are in the `dist/` folder.

---

### Quick check that everything worked

1. Browser shows the **Splunk Scope** home page (dark theme).
2. Click **Begin planning session**.
3. On **Intake**, click **Load Example** and confirm the demo customer loads.

If that works, you are ready for a real workshop.

---

### Common download / setup issues

| Problem | What to try |
|---------|-------------|
| **Repository not found** | Confirm you are logged into GitHub and have been granted access to the private repo. |
| **`node: command not found`** | Install Node.js 20+ from [nodejs.org](https://nodejs.org/) and restart the terminal. |
| **`npm install` fails** | Ensure you are inside the `splunk-scope` folder (there should be a `package.json` file). Try deleting `node_modules/` and running `npm install` again. |
| **Blank page or red Vite error overlay** | Run `git pull` (or re-download ZIP) to get the latest code, then `npm install` and `npm run build`. If build fails with “Failed to resolve import”, the download is incomplete—ask the repo owner for an updated copy. |
| **Port already in use** | Another app may be using port 5173. Stop other dev servers or run `npm run dev -- --port 5174` and open the new URL. |

---

## Your first planning session

1. On **Home**, click **Begin planning session**.
2. On **Intake**, enter the customer name, deployment type (Cloud, on-prem, or hybrid), use cases, and optional budget—or click **Load Example** to explore the fictional *Chuck Robbins retail* demo.
3. Follow the sidebar through the workshop:
   - **Analysis** — review interpreted goals and suggested Splunk products
   - **Data Sources** — set Current / Future / Skip, enter sizing, and note overlap warnings
   - **Review** — confirm GB/day totals before architecture work
   - **Architecture Paths** — compare Crawl, Walk, and Run; **Select for report** on the path you want to present
   - **Report** — preview and **Export Customer Pack** (PDF, PPTX, or bundled files)

**Save your work:** Scope auto-saves in your browser. Use **Tools → Export** in the sidebar for a portable `.json` file you can import later on another machine via **Import saved session** on Home.

---

## Workshop flow

```
Home → Intake → Analysis → Data Sources → Review → Architecture Paths → Report
```

| Step | What you do here |
|------|------------------|
| **Intake** | Customer context, use cases, apps, goals, optional budget; Cursor import or Load Example |
| **Analysis** | Customer-facing summary and Splunk product suggestions |
| **Data Sources** | Configure sources, enter quantities, resolve overlap annotations |
| **Review** | Sanity-check ingest totals and missing priorities |
| **Architecture Paths** | Compare phased paths against budget; pick one for the report |
| **Report** | Customer leave-behind exports |

**Sidebar extras**

- **Source Reference Library** — lookup sizing notes and Splunkbase links while you configure sources
- **Coverage (SE)** — optional deep-dive on telemetry coverage (`/#/coverage`); not on the main stepper

Overlap notes are **annotate-only**: they flag possible double-counting between sources but do not automatically reduce your totals—you decide how to explain them in the workshop.

---

## Learn more

| Guide | When to read it |
|-------|-----------------|
| [**User Guide**](docs/USER_GUIDE.md) | Full walkthrough of every screen and export |
| [**Contributing**](CONTRIBUTING.md) | Dev setup, tests, catalog edits, releases |
| [**Documentation index**](docs/DOC_INDEX.md) | Full list of guides and reference material |
| [**Versioning**](docs/VERSIONING.md) | Release numbering and checklist |
| [**Sizing Methodology**](docs/SIZING_METHODOLOGY.md) | How GB/day bands and units are calculated |
| [**Cursor Import**](docs/CURSOR_IMPORT.md) | Paste discovery JSON from Cursor or other LLM workflows |
| [**Source Recommendation Rules**](docs/SOURCE_RECOMMENDATION_RULES.md) | How source priorities and labels are assigned |
| [**App Recommendation Engine**](docs/APP_RECOMMENDATION_ENGINE.md) | How Splunk product suggestions are derived |

Additional reference material lives under [`docs/`](docs/). See [`docs/DOC_INDEX.md`](docs/DOC_INDEX.md) for the full list.

---

## Privacy

- Session data stays in **your browser** (`localStorage`) until you export it
- Scope does not send customer data to external services at runtime
- Cursor-assisted import is **copy/paste only**—you control what text enters the app
- Splunkbase and documentation links open in your browser when you click them

---

## Questions and feedback

Open a [GitHub issue](https://github.com/pipe-problem/splunk-scope/issues) for bugs or enhancement ideas. Include steps to reproduce and, if possible, an exported session JSON (with sensitive customer details removed).

---

**Version 2.0.1** · For Splunk Solutions Engineering and authorized partner use
