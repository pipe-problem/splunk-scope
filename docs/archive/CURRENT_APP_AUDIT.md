# Splunk Scope — Current App Audit

**Date:** 2026-06-02  
**Version:** 2.1.0  
**Schema Version:** 4  
**Tests:** 232 Vitest passing; Splunkbase catalog validated; production build OK

## Customer export redesign (2026-06-02)

- **Pipeline:** `buildReportExportPayload` → content builders → PDF/PPTX renderers → `exportValidationEngine`
- **Value Proposal PDF (10 pages):** Cover/KPIs, executive summary, before/after, architecture path, capability cards (not source tables), coverage/gaps, ingest bar chart, crawl/walk/run, next steps, assumptions
- **Value Proposal PPTX (10 slides):** Same narrative for screen-share; Splunk product hints on recommended-path slide
- **Startup Guide PDF:** Implementation summary, year-one roadmap, cadence, deployment-specific setup, onboarding phases, per-source cards with validation SPL, grouped validation library, official HTTPS links
- **Design:** `exportDesignTokens.js` (brand colors, layout); headers/footers/page numbers on every PDF page
- **Unchanged:** Local-only privacy, path logic, sizing, app recommendations, source catalog validation

## App recommendation engine (2026-06-02)

- **Canonical catalog:** `src/data/appCatalog.json` — premium solutions, free apps, TAs, prerequisites separated by `type`
- **Engine:** `src/services/appRecommendationEngine.js` — multi-intent scoring, maturity ladder, hard gates (cloud, Cisco, ITSI, Observability, SOAR, UBA, MLTK/AITK)
- **UI:** Interpretation **Suggested Splunk Products** with expandable sections (max 3/4/5/4 visible)
- **Exports:** Value Proposal, Startup Guide, PPTX use `productRecommendations` from the same engine
- **Audit baseline:** `docs/APP_RECOMMENDATION_LOGIC_AUDIT.md` — prior weaknesses addressed (remediation banner at top)
- **Guide:** `docs/APP_RECOMMENDATION_ENGINE.md`
- **SME intake:** `docs/APP_CATALOG_SME_INTAKE.md`, `docs/APP_SOURCE_USE_CASE_MATRIX.md`
- **Source↔app IDs:** `collectCanonicalAppIds` / `sourceMatchesAppInterest` in `appCatalogService.js` (used by source prioritization)

Legacy `useCaseProfiles[].splunkApps` retained for fallback only — not primary recommendation source.

## Splunkbase catalog pass (2026-06-02)

- **Canonical catalog:** `src/data/splunkbaseCatalog.json` with HTTP-validated entries
- **Data layer:** `catalogId` in `technicalAddons.json` / `splunkApps.json` (removed stale `splunkbaseId`)
- **Resolver:** `src/services/splunkbaseCatalog.js` — customer-safe URLs only
- **Scripts:** `npm run refresh:splunkbase`, `npm run validate:splunkbase`
- **Customer surfaces:** Source Library, Interpretation, source briefs, deployment path — no broken links
- **Replacements:** Duo Splunk Connector → Cisco Security Cloud; deprecated Cisco Network Data → App for Cisco Network Data

## vNext hardening pass (2026-06-01)

- **Screen-share readability:** Body ~17px; improved dark muted contrast; min-height 44px buttons; chart/table legend classes
- **Light mode:** Soft off-white `#E8E8ED` background; reduced glare on cards and tables
- **Customer copy:** Removed internal/unfinished phrasing from UI, report, PDFs, PPTX, and source briefs
- **Export credibility:** Fixed duplicate GB/day in executive summary; consistent source counts; no unconfigured 0 GB/day in customer exports
- **Recommendations v1.1.0:** Conservative Suggested labels; max 6 top suggestions; cloud-only sources penalized unless cloud security in scope; expanded substitution rules
- **Northstar example:** Top suggestions prioritize AD, SSO, EDR, firewalls, VPN, M365, DNS, email over CSPM/CWPP/CASB/IaaS
- **Coverage:** SIEM-focused default domains; plain-English gap labels; top 3 use cases by default
- **Architecture paths:** Delta cards (+sources, +GB/day, +coverage) vs previous path
- **Report:** Value delivered section; Startup Guide tab split Year-One vs Week 1–3
- **Source Library:** Expanded aliases; priority score in collapsible details only
- **Scenario comparison:** What-changed summary; overlap-aware diff; hide unchanged domains

## v2.0.0 SE screen-share pass (2026-05-29)

- **Save and Quit:** Global on workflow pages via `PageHeaderActions`
- **Report actions:** Export dropdown (3 customer deliverables) + Back + Save and Quit
- **Examples:** Four scenarios including Northstar Regional Logistics
- **Path naming:** Deterministic `displayLabel` from use cases and source families
- **Startup Guide PDF:** Part 1 year-one deployment plan + Part 2 weeks 1–3 detailed setup (see export redesign for structured layout)
- **Value Proposal PDF:** Business value focus; capability-grouped value; no budget/confidence/raw source tables

## Customer-safe language

Budget and confidence scores are SE-only. Customer PDFs, PPTX, report Sources tab, and downloadable briefs show Needs Review where appropriate but not numeric confidence or pricing.

## SE reference library

Source Reference Library (`/reference`) is SE-oriented for research; customer brief downloads remain sanitized.
