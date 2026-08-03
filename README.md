# Splunk Scope

**Plan Splunk deployments with your customer—in the room, on your laptop.**

Splunk Scope is a browser-based workshop tool for Solutions Engineers. Use it after discovery to capture customer context, size data sources with transparent estimates, check telemetry coverage, compare Crawl / Walk / Run architecture paths, and export customer-ready reports.

Everything runs locally in your browser. Customer session data never leaves your machine unless you choose to export it.

> **Planning guidance only.** GB/day totals, coverage scores, and priority labels are estimates—not capacity commitments, quotes, or purchase orders. Validate with PoV measurements, retention requirements, and deployment constraints before staffing or licensing decisions.

---

## Install and open Scope

You need [Node.js 20+](https://nodejs.org/) and a modern browser (Chrome, Edge, or Firefox).

**Get the project**

```bash
git clone https://github.com/pipe-problem/splunk-scope.git
cd splunk-scope
npm install
npm run dev
```

Open the URL shown in your terminal (usually **http://localhost:5173**).

Prefer a ZIP? On the GitHub repo page, choose **Code → Download ZIP**, unzip the folder, then run `npm install` and `npm run dev` inside it.

Scope does not require a Splunk login to run.

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
| **Intake** | Customer context, use cases, apps, goals, optional budget; Circuit import or Load Example |
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
| [**Sizing Methodology**](docs/SIZING_METHODOLOGY.md) | How GB/day bands and units are calculated |
| [**Circuit Import**](docs/CIRCUIT_IMPORT.md) | Paste discovery notes from Circuit or other LLM workflows |
| [**Source Recommendation Rules**](docs/SOURCE_RECOMMENDATION_RULES.md) | How source priorities and labels are assigned |
| [**App Recommendation Engine**](docs/APP_RECOMMENDATION_ENGINE.md) | How Splunk product suggestions are derived |

Additional reference material lives under [`docs/`](docs/). See [`docs/DOC_INDEX.md`](docs/DOC_INDEX.md) for the full list.

---

## Privacy

- Session data stays in **your browser** (`localStorage`) until you export it
- Scope does not send customer data to external services at runtime
- Circuit-assisted import is **copy/paste only**—you control what text enters the app
- Splunkbase and documentation links open in your browser when you click them

---

## Questions and feedback

Open a [GitHub issue](https://github.com/pipe-problem/splunk-scope/issues) for bugs or enhancement ideas. Include steps to reproduce and, if possible, an exported session JSON (with sensitive customer details removed).

---

**Version 2.0.0** · For Splunk Solutions Engineering and authorized partner use
