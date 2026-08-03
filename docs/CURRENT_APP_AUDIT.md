# Splunk Scope — Current App Audit

**Date:** 2026-06-18  
**Version:** 2.1.0+  
**Schema Version:** 4  
**Tests:** 265 Vitest passing; production build OK

## Customer planning pack export (2026-06-18)

- **Export:** Report page **Export Customer Pack** button — downloads standalone interactive HTML
- **Data pipeline:** `buildCustomerReportData` → `sanitizeCustomerReportData` → `validateCustomerReportExport` → SSR HTML via `CustomerPlanningPackView`
- **Interactive HTML:** `interactivePlanningPackBuilder.js` — embedded CAST dark-theme CSS, same tabs/copy/structure as live Report; no localhost or app chrome
- **Removed:** PDF Snapshot, Print Preview, `/report/customer-pdf` route, and browser print hack on live Report page

## Customer export redesign (2026-06-02)

- **Pipeline:** `buildReportExportPayload` → content builders → PDF/PPTX renderers → `exportValidationEngine`
- **Value Proposal PDF (10 pages):** Cover/KPIs, executive summary, before/after, architecture path, capability cards, coverage/gaps, ingest bar chart, crawl/walk/run, next steps, assumptions
- **Value Proposal PPTX (10 slides):** Same narrative for screen-share
- **Startup Guide PDF:** Year-one roadmap, onboarding phases, per-source validation SPL, official HTTPS links
- **Unchanged:** Local-only privacy, path logic, sizing, app recommendations

## App recommendation engine (2026-06-02)

- **Canonical catalog:** `src/data/appCatalog.json`
- **Engine:** `src/services/appRecommendationEngine.js`
- **UI:** Interpretation **Suggested Splunk Products**; Report accordion uses same engine
- **Guide:** `docs/APP_RECOMMENDATION_ENGINE.md`

Historical detail: [`docs/archive/CURRENT_APP_AUDIT.md`](archive/CURRENT_APP_AUDIT.md)
