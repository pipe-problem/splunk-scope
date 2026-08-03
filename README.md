# Splunk Scope

**Local planning and architecture tool for Splunk Solutions Engineers.**

Splunk Scope runs entirely in your browser. It helps you structure post-discovery workshops: capture intake, interpret customer goals, configure data sources with honest sizing estimates, validate telemetry coverage, compare phased architecture paths (Crawl / Walk / Run), and produce customer-ready reports—all without sending session data to external services.

> **Disclaimer:** Outputs are planning guidance, not capacity commitments or commercial quotes. Validate estimates with customer-specific measurements, retention goals, and deployment constraints before purchasing or staffing decisions.

**Version:** 2.0.0 · **Stack:** React 19 · Vite 8 · Tailwind CSS 4

---

## Quick start — get Scope running in 5 minutes

### Prerequisites

| Requirement | Version |
|-------------|---------|
| [Node.js](https://nodejs.org/) | 20 LTS or newer |
| npm | Comes with Node (or use pnpm/yarn with equivalent commands) |
| Modern browser | Chrome, Edge, or Firefox |

### Step 1 — Get the code

**Option A — Clone from GitHub** (after you publish the repo):

```bash
git clone https://github.com/YOUR_ORG/splunk-scope.git
cd splunk-scope
```

**Option B — Download ZIP**

1. Open the GitHub repository page
2. Click **Code → Download ZIP**
3. Unzip and `cd` into the project folder

### Step 2 — Install dependencies

```bash
npm install
```

This installs React, Vite, Tailwind, and test tooling into `node_modules/` (not committed to git).

### Step 3 — Start the dev server

```bash
npm run dev
```

Open the URL shown in the terminal (typically **http://localhost:5173**).

### Step 4 — Begin your first session

1. On the **Home** page, click **Begin planning session**
2. On **Intake**, click **Load Example** to try the fictional *Chuck Robbins retail* demo—or enter a real customer name, deployment type, use cases, and optional budget
3. Walk the sidebar: **Analysis → Data Sources → Review → Architecture Paths → Report**
4. On **Architecture Paths**, click **Select for report** on a path, then open **Report** and try **Export Customer Pack**

### Step 5 — Save your work

- Session data auto-saves in browser **localStorage**
- Use sidebar **Tools → Export** to download a portable `.json` session file
- Use **Import saved session** on Home to resume on another machine or browser

### Production build (optional)

Serve a static build without the dev server:

```bash
npm run build      # output → dist/
npm run preview    # serve dist/ locally
```

Deploy `dist/` to any static host (S3, nginx, GitHub Pages, internal web server). Scope has no backend—all logic runs client-side.

---

## User guide

**Full walkthrough:** [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)

That guide covers every workflow step in detail: Intake, Analysis, source configuration (including composite sizing panels for IaaS and M365), overlap annotations, Review, Coverage, Architecture Paths, Report exports, session tools, and workshop tips.

### Workflow at a glance

```
Home → Intake → Analysis → Data Sources → Review → Architecture Paths → Report
                              ↑
                    Source Reference Library (SE sidebar)
                    Coverage Analysis (SE sidebar, /#/coverage)
```

| Step | What you do |
|------|-------------|
| **Intake** | Customer context, use cases, apps, goals, optional budget; Circuit import or Load Example |
| **Analysis** | Customer-facing summary and Splunk product suggestions |
| **Data Sources** | Set Current / Future / Skip; enter sizing; resolve overlap notes |
| **Review** | Confirm GB/day totals and missing priorities |
| **Paths** | Compare Crawl / Walk / Run; **Select for report** |
| **Report** | Preview and export Customer Pack, PDF, or PPTX |

**SE power users:** Coverage is off the main stepper but available via the **Coverage (SE)** sidebar icon or `/#/coverage`. Overlap decisions are **annotate-only**—they flag potential double-counting without reducing ingest totals.

---

## Documentation

### For SEs and workshop facilitators

| Document | Description |
|----------|-------------|
| [**User Guide**](docs/USER_GUIDE.md) | Step-by-step product usage |
| [**Sizing Methodology**](docs/SIZING_METHODOLOGY.md) | GB/day bands, units, multipliers |
| [**Circuit Import**](docs/CIRCUIT_IMPORT.md) | AI-assisted intake workflow |
| [**Source Recommendation Rules**](docs/SOURCE_RECOMMENDATION_RULES.md) | Priority labels and scoring |
| [**App Recommendation Engine**](docs/APP_RECOMMENDATION_ENGINE.md) | How Splunk products are suggested |
| [**Product Principles**](docs/PRODUCT_PRINCIPLES.md) | Estimate honesty and UX guardrails |
| [**Project Scope**](docs/PROJECT_SCOPE.md) | Mission, in/out of scope |

### For developers and maintainers

| Document | Description |
|----------|-------------|
| [**Architecture**](docs/ARCHITECTURE.md) | Code layout, engines, data flow, persistence |
| [**Doc Index**](docs/DOC_INDEX.md) | Full documentation map |
| [**Changelog**](CHANGELOG.md) | Release history |
| [**Source Catalog QA**](docs/SOURCE_CATALOG_QA.md) | Catalog validation conventions |

### How Scope is built (high level)

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ Pages       │  │ Components   │  │ AppContext          │ │
│  │ (workflow)  │→ │ (UI)         │→ │ localStorage persist│ │
│  └─────────────┘  └──────────────┘  └─────────────────────┘ │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Services (engines) — pure JS, no server             │  │
│  │ sizing · coverage · plans · overlap · recommendations │  │
│  └─────────────────────────────────────────────────────┘  │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ JSON catalogs (src/data/)                           │  │
│  │ sources · use cases · apps · sizing rates · rules   │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Location | Role |
|-------|----------|------|
| **UI** | `src/pages/`, `src/components/` | Workflow screens and configure panels |
| **State** | `src/context/AppContext.jsx` | Session reducer + `localStorage` |
| **Engines** | `src/services/` | Sizing, coverage, plans, overlap, exports |
| **Catalogs** | `src/data/*.json` | Sources, rates, use cases, recommendation rules |
| **Tooling** | `scripts/` | Catalog validators, doc generators |
| **Tests** | `src/**/*.test.js`, `e2e/` | Vitest unit tests + Playwright smoke |

**Composite sizing:** Sources like IaaS, M365, CRM, and general SaaS use additive engines and dedicated configure panels wired through `src/components/sources/sizingPanelRegistry.js`.

**No runtime API calls:** Splunk Scope does not phone home. Splunkbase and doc links open in the user’s browser on demand.

---

## Development commands

```bash
npm run dev                   # Dev server
npm run build                 # Production bundle → dist/
npm test                      # Vitest (600+ tests)
npm run test:smoke            # Quick navigation smoke
npm run test:e2e              # Playwright end-to-end (10 flows)
npm run validate:catalog      # sources.json ↔ sizingRates.json
npm run validate:measurement  # Measurement question coverage
npm run lint                  # ESLint
npm run gen:sizing-doc        # Regenerate sizing field matrix doc
```

CI (`.github/workflows/ci.yml`) runs validators, lint, tests, e2e, and build on push/PR.

---

## Publishing to GitHub

If this folder is not yet a git repository:

```bash
git init
git add .
git commit -m "Initial commit: Splunk Scope 2.0.0"
```

Create a new repository on GitHub (empty—no README), then:

```bash
git remote add origin https://github.com/YOUR_ORG/splunk-scope.git
git branch -M main
git push -u origin main
```

Replace `YOUR_ORG/splunk-scope` with your repository path.

---

## Privacy and data handling

- All customer session data stays in **your browser** unless you export it
- No Splunk Cloud or third-party analytics SDK in the runtime
- Circuit-assisted import is **copy/paste only**—you control what leaves Scope

---

## License

Splunk Scope is provided for Splunk Solutions Engineering and partner use. See your organization’s policy before distributing outside Splunk or sharing customer session exports.

---

## Support and feedback

- **Bugs / enhancements:** Open a GitHub issue with steps to reproduce
- **Catalog corrections:** Edit `src/data/sources.json` and `sizingRates.json`, then run `npm run validate:catalog`
- **Historical audits:** `docs/archive/` (not current product truth)
