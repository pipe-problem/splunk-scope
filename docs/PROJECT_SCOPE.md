# Splunk Scope — Project Scope

## Mission

**Splunk Scope** is a **local-only planning and architecture tool** for Splunk Solutions Engineers (SEs). It helps SEs run post-discovery workshops: capture structured intake, interpret customer goals, configure data sources with honest sizing estimates, validate telemetry coverage, compare phased architecture paths, and produce customer-ready reports — without sending session data to external services.

---

## What Splunk Scope Is

- **Customer workshop companion** — The Analysis page and Report are designed for leave-behinds after demo and discovery calls.
- **SE + customer split UX** — Customers see a simplified Sources workflow; deep reference material lives in the **Source Reference Library** (sidebar, SE-only).
- **Decision-support system** — Surfaces trade-offs, gaps, and confidence bands so conversations stay evidence-based.
- **Structured workflow** — Intake → Analysis → Sources → Review → Coverage → Paths → Report.
- **Planning estimates, not commitments** — All GB/day figures, coverage scores, and source priority labels are explicitly framed as estimates.

---

## What Splunk Scope Is Not

- **Not a quoting or licensing tool** — No SKUs, entitlements, or order documents.
- **Not a capacity guarantee** — Ingest ranges are catalog-driven planning bands; validate with PoV measurement.
- **Not a substitute for deployment validation** — Parsing, CIM, and search performance must be confirmed in the customer environment.
- **Not security-only** — Security, IT ops, observability, and analytics use cases are first-class.

---

## Core Features (v1.9)

| Area | Capability |
|------|------------|
| **Intake** | Customer name, deployment (Cloud / On-premises / Hybrid), use cases, Splunk apps, goals, optional context import |
| **Analysis** | Customer-facing summary: grouped **Suggested Splunk Products** (solutions / apps / add-ons / dependencies) from `appRecommendationEngine.js`, focus areas, source preview |
| **Sources** | Minimal configure drawer (status + sizing fields only); priority badges use soft language (High priority / Suggested) |
| **Source Reference Library** | SE workspace with search, full source intel, **Suggested deployment path** (doc + Splunkbase links), downloadable briefs |
| **Coverage** | Multi-use-case domain scoring with adjustable ingest buffer |
| **Architecture paths** | Four phased paths (Crawl + Walk A/B + Run) in a Coverage-style carousel: readiness gauge, KPI strip, circular navigation; technical Sources \| Scoring accordion; explicit CTA to set report path |
| **Report** | Overview (ingest donut chart), Sources, Startup Guide; **Export Customer Pack** (interactive HTML); estimate disclaimers |
| **Sizing research** | `docs/source-sizing-research-template.xlsx` — fill researched GB/day and return to update `sizingRates.json` |
| **Session tools** | Export/import JSON, scenarios, compare |

---

## Governance

| Requirement | Rationale |
|-------------|-----------|
| Local-only operation | Customer data stays in the browser |
| No external APIs at runtime | No phone-home; Splunkbase links are user-initiated |
| Estimate disclaimers | Avoid implied SLAs on GB/day or source priority |
| Clickable onboarding links | Suggested deployment path items link to Splunk docs / Splunkbase so customers can self-serve |
| Honest empty states | Zero sources → zero coverage; no fabricated data |

---

## Do Not Drift Into

- Security-only framing or mandatory "required" language toward customers
- Overwhelming source panels in the customer-facing workflow
- Minified report PDFs without color or charts
- Hardcoded capacity numbers without catalog + research loop

---

## Related artifacts

- [`README.md`](../README.md) — run and workflow
- [`DOC_INDEX.md`](./DOC_INDEX.md) — full documentation map (includes sizing, Splunkbase, archive)
- `docs/source-sizing-research-template.xlsx` — sizing research workbook
- `src/data/premiumSplunkbaseIds.json` — Splunkbase ID map for premium apps
- `src/data/sizingRates.json` — authoritative GB/day bands (updated from research sheet)
