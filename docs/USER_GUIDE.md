# Splunk Scope — User Guide

This guide walks through **every step** of a typical planning workshop using Splunk Scope. It is written for Splunk Solutions Engineers (SEs) who facilitate discovery follow-ups, architecture conversations, and customer leave-behinds.

**Remember:** All GB/day figures, coverage scores, and priority labels are **planning estimates**, not capacity commitments or quotes. Validate with PoV measurements and customer-specific retention before purchasing decisions.

---

## Before you start

| Requirement | Notes |
|-------------|--------|
| **Browser** | Chrome, Edge, or Firefox (recent version) |
| **Network** | Not required after install — Scope runs locally |
| **Customer data** | Stays in your browser (`localStorage`); export JSON to share sessions |
| **Splunk login** | Not required to run Scope |

Optional: have discovery notes, a rough ingest budget (GB/day or Splunk Cloud spend), and a short list of use cases ready before Intake.

---

## 1. Home — start or resume

**Path:** `/#/` (app root)

| Action | What it does |
|--------|----------------|
| **Begin planning session** | Clears the session and opens **Customer Intake** |
| **Import saved session** | Loads a previously exported `.json` file and jumps to the saved workflow step |
| **Resume** | If you already have data in this browser, use the sidebar stepper to continue |

**Tip:** Export your session often (sidebar **Tools → Export**) before major changes or before closing the browser.

---

## 2. Customer Intake

**Path:** `/#/intake`

Capture the minimum context Scope needs to interpret goals and size sources.

### Essential fields

- **Customer name** — appears on reports and exports
- **Deployment** — Splunk Cloud, On-premises, or Hybrid
- **Use cases** — select from the profile library (security, IT ops, observability, compliance, etc.)
- **Splunk apps in scope** — ES, ITSI, Observability, MLTK, etc. (drives product recommendations)
- **Goals** — use **Crawl / Walk / Run** preset dropdowns for workshop-friendly language, or expand **Advanced** for freeform notes
- **Planning budget** — optional GB/day cap or Splunk Cloud spend (used on Architecture Paths)

### Cursor-assisted import (optional)

If you used Cursor (or another LLM) to structure discovery notes:

1. Click **Cursor-assisted import**
2. Copy the generated prompt (includes the `splunk-scope-import` skill) → run in Cursor with customer PDFs → paste JSON back
3. Review the preview — edit source counts/vendors, check rows to apply → **Apply to Intake**

See [`CURSOR_IMPORT.md`](./CURSOR_IMPORT.md) for schema details and rollback.

### Load Example

**Load Example → Chuck Robbins retail / hybrid** loads a fictional over-budget scenario (22 current sources, PCI + threat + cloud use cases). Use it for demos and training—not as a customer template.

When intake looks complete, continue to **Analysis**.

---

## 3. Analysis

**Path:** `/#/analysis`

Customer-facing summary of what Scope understood from intake.

| Section | Purpose |
|---------|---------|
| **Interpreted goals** | Crawl/Walk/Run narrative from presets |
| **Suggested Splunk products** | Apps, add-ons, and dependencies from `appRecommendationEngine` |
| **Focus areas** | Domain themes tied to selected use cases |
| **Suggested sources preview** | High-level data-source direction before deep configuration |

Use this page in live workshops: it is designed as a leave-behind after discovery calls.

Continue to **Data Sources** when the customer agrees on direction.

---

## 4. Data Sources

**Path:** `/#/sources`

Configure which telemetry feeds are **in scope**, **planned later**, or **skipped**, and enter sizing inputs.

### Source grid

- Sources are grouped by **category** (Identity, Network, Cloud, Endpoint, etc.)
- **Before intake is filled in:** cards show the catalog description only — no relevance score (`X/10`). Complete Intake first (customer name, use cases, apps, or notes).
- **After intake:** each card shows a relevance score (`X/10`) based on your selections. Unconfigured cards still show the catalog description; configured cards show sizing counts (e.g. number of firewalls).
- Use the **High relevance** filter (visible after intake) to focus on top-scoring sources.

### Configure a source

Click a source card to open the **configure panel**:

1. Set **Status**: Current (in scope now), Future (later phase), or Skip
2. Answer the **measurement question** at the top (what to count: users, devices, accounts, etc.)
3. Fill sizing fields:
   - **Simple sources** — number inputs + vendor/scope dropdowns
   - **Composite sources** — dedicated panels for IaaS, M365/Google, CRM, general SaaS, SSO, and child cloud rows (VMs, storage, containers)
4. Optional: **manual GB/day override** when you have measured PoV data
5. **Save** (checkmark) or **Reset** to clear local edits

### Overlap (annotate-only)

For some source pairs (firewall + IDS, M365 + general SaaS, EDR + Windows events), Scope shows **overlap warnings**. These **do not reduce** planning totals—they flag where double-counting might happen in production. Confirm separate collection paths with the customer.

Use **Compare with…** in the overlap section to see shared telemetry bullets between two sources.

### Custom sources

Use **+ Custom source** to add a feed not in the catalog (name, vendor, units, GB/unit). Custom rows behave like other sources in totals and reports.

---

## 5. Review

**Path:** `/#/review`

First **planning checkpoint** before architecture paths.

| Tab / area | What to check |
|------------|----------------|
| **Totals strip** | Session-wide GB/day (expected, low, high) with ±20% planning band |
| **Overlap notes** | Pairs where both sources are Current—expand for shared telemetry |
| **Missing priorities** | Analysis top suggestions not yet marked Current |
| **Source list** | Per-source ingest contribution |

Fix gaps by returning to Sources, then continue to **Architecture Paths** (or **Coverage** if you use the SE sidebar link).

---

## 6. Source Reference Library (SE tool)

**Path:** `/#/reference` — sidebar **book** icon

Deep reference workspace—not shown in the customer stepper.

- Search the full catalog (~78 sources)
- Read deployment paths, Splunkbase links, log capabilities, overlap compare
- Download a **source brief** (text export) for offline research

Use during prep; avoid overwhelming customers with this surface in live workshops.

---

## 7. Coverage Analysis (SE tool)

**Path:** `/#/coverage` — sidebar **shield** icon (hidden from main stepper by default)

Maps configured sources against **telemetry domains** required by selected use cases.

- **Coverage gauge** — weighted score across domains
- **Domain hierarchy** — Current vs Future vs combined strength
- **Gap list** — domains still weak after configuration
- **Ingest summary** — same planning totals as Review, with buffer control

Coverage validates *whether* you have the right telemetry classes—not whether Splunk is sized for retention or search concurrency.

---

## 8. Architecture Paths

**Path:** `/#/paths`

Compare phased rollout options as a **carousel** (Crawl / Walk / Run variants).

| Concept | Meaning |
|---------|---------|
| **Crawl** | ~80% of intake budget — minimal viable telemetry |
| **Walk** | ~100% of budget — balanced coverage |
| **Run** | ~110% of budget — expanded future-state set |

For each path:

- **Readiness gauge** — solution-fit score
- **KPI strip** — sources count, GB/day, coverage score
- **Source breakdown** — which feeds are in the path
- **Technical accordion** — scoring details (collapsed by default)

**Select for report** — explicitly choose which path feeds the Architecture Report. Load Example does **not** pre-select a path (by design).

---

## 9. Architecture Report

**Path:** `/#/report`

Customer deliverable preview for the **selected** path.

| Section | Content |
|---------|---------|
| **Overview** | Executive summary, ingest donut, coverage snapshot, next steps |
| **Sources** | Configured sources with sizing and status |
| **Startup guide** | Enablement outline when generated |

### Exports

| Export | Format | Use |
|--------|--------|-----|
| **Export Customer Pack** | ZIP (HTML + assets) | Workshop leave-behind bundle |
| **Value proposition** | PDF / PPTX | Stakeholder narrative |
| **Startup guide** | PDF | Customer onboarding outline |
| **Session JSON** | JSON | Resume later or share with another SE |

All exports include estimate disclaimers.

---

## 10. Session tools

Open **Tools** in the sidebar (gear icon):

| Tool | Action |
|------|--------|
| **Export** | Download full session as JSON |
| **Import** | Load JSON (also on Home) |
| **Reset** | Clear session (double-click to confirm) |
| **Save scenario** | Name and store a snapshot for **Scenario Comparison** |
| **Theme** | Light / dark mode |

Sessions auto-save to browser storage. Export before clearing browser data or switching machines.

---

## 11. Scenario Comparison

**Path:** `/#/compare`

Save two or more named scenarios from Session Tools, then compare ingest, coverage, and source deltas side-by-side. Useful for “what if we add EDR?” or budget sensitivity conversations.

---

## Workshop tips

1. **Start with Load Example** to learn the flow, then reset and run a real customer.
2. **Keep Sources configure panels focused** — status + sizing only in the customer view; use Reference Library for deep dives.
3. **Call out overlap explicitly** — Scope annotates; you decide whether logs are distinct in the customer environment.
4. **Pick a path before Report** — the report stays empty until you select Crawl/Walk/Run on Paths.
5. **Export early and often** — JSON is your backup; Customer Pack is your leave-behind.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Totals show zero | Mark sources **Current** and enter sizing quantities |
| Report is empty | Select a path on Architecture Paths (**Select for report**) |
| Import fails | Ensure JSON is a Scope session export, not arbitrary JSON |
| Composite panel missing | Source must be IaaS, M365, CRM, general SaaS, SSO, or child IaaS row |
| Coverage says “no use cases” | Return to Intake and select at least one use-case profile |

---

## Related documentation

| Doc | Topic |
|-----|--------|
| [`README.md`](../README.md) | Install, quick start, doc index |
| [`SIZING_METHODOLOGY.md`](./SIZING_METHODOLOGY.md) | GB/day bands and multipliers |
| [`SOURCE_RECOMMENDATION_RULES.md`](./SOURCE_RECOMMENDATION_RULES.md) | Priority labels and scoring |
| [`CURSOR_IMPORT.md`](./CURSOR_IMPORT.md) | AI-assisted intake |
| [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md) | UX and estimate honesty rules |
