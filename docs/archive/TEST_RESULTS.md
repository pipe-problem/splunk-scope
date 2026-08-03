# Splunk Scope — Test Results

**Date:** 2026-06-02  
**Version:** 2.1.0 (Customer export redesign)  
**Schema Version:** 4  

## Test Summary

| Framework | Tests | Passed | Failed |
|-----------|-------|--------|--------|
| Vitest (`npm test`) | 235 | 235 | 0 |
| Engine harness (`node src/tests/engineTests.js`) | 89 | 89 | 0 |
| Splunkbase catalog (`npm run validate:splunkbase`) | 64 entries | PASS | 0 |
| Catalog validation (`node scripts/validateSourceCatalog.js`) | 78 sources | PASS | 0 |
| Production build (`npm run build`) | — | PASS | 0 |

### Customer export redesign (2026-06-02)

- **Layered builders** — `valueProposalExportBuilder.js`, `startupGuideExportBuilder.js`, `exportPdfRenderer.js`, `pptxExportBuilder.js`, `exportValidationEngine.js`, `exportDesignTokens.js`, `exportShared.js`
- **Value Proposal PDF** — 10 pages: cover/KPIs, executive summary, current vs future, architecture path, value by capability, coverage/risk, ingest bar chart, phased journey, next steps, assumptions
- **Value Proposal PPTX** — 10 slides (presentation layout; product hints on recommended-path slide)
- **Startup Guide PDF** — Year-one plan, cadence, deployment setup, per-source cards, grouped validation SPL library, official links
- **Vitest** — Section/slide IDs, ≥8 PDF pages, capability-grouped apps, no install-only content in value proposal

### App recommendation engine (2026-06-02)

- **21 scenario tests** — crawl security (SSE/InfoSec), ES + CIM, readiness warnings, SOAR defer, ML/AI gates, ITSI/Observability separation, cloud/Cisco gates, export parity, Northstar, basic_infosec example, ID normalization, source app-interest alignment, interpretInputs parity, Splunkbase status, customer wording
- **Engine + catalog** — `appRecommendationEngine.js`, `appCatalog.json`
- **Docs** — `docs/APP_RECOMMENDATION_ENGINE.md`

### Splunkbase catalog pass (2026-06-02)

- **`src/data/splunkbaseCatalog.json`** — 58 verified, 3 needsReview, 1 deprecated, 2 replacementPreferred
- **`npm run refresh:splunkbase`** — HTTP validation via `scripts/refreshSplunkbaseCatalog.js`
- **`npm run validate:splunkbase`** — structural + catalogId reference checks
- **UI/exports** — verified links only; `needsReview` shows "Link needs validation"
- **Fixed stale IDs** — ES 263, Cisco ASA 1620, GCP 3088, Okta 6553, Fortinet 2846, etc.
- **Duo → Cisco Security Cloud** — replacementPreferred (7404)

### vNext hardening pass (2026-06-01)

- **Readability** — Body ~17px; softer light mode; larger buttons/tables/chart legends
- **Copy** — Customer-safe wording; removed internal/unfinished phrases from UI and exports
- **Export credibility** — Fixed duplicate GB/day; `formatIngestWithUnit`; no generic domain copy in value groups
- **Recommendations** — `sourceRecommendationRules.json` v1.1.0; cloud-only deemphasis unless cloud security in scope; top suggested limit 6
- **Northstar SIEM** — Vitest asserts identity/endpoint/network rank above cloud-only sources
- **Coverage** — SIEM default domains; customer-friendly domain labels
- **Report Startup Guide tab** — Year-One Plan + Week 1–3 technical setup sections
- **Source Library** — Aliases for login logs, firewall traffic; priority score behind details
- **Scenario Comparison** — Overlap exclusions; what-changed summary; hide unchanged toggle

### New Vitest coverage (2026-06-01)

- Northstar SIEM prioritization vs cloud-only sources
- Cloud sources rank high only when cloud security explicitly in scope
- Executive summary no duplicate GB/day units
- Source library alias search: login logs, firewall traffic
- Existing: prohibited export wording, value proposal vs startup guide split, source brief sanitization

### v2.0.0 SE screen-share pass (2026-05-29)

- **Save and Quit** — `PageHeaderActions` exports resumable session JSON
- **Export menu** — Value Proposal PDF, Value Proposal PPTX, Startup Guide PDF
- **Example scenarios** — Four fictional customers via intake dropdown
- **Dynamic path names** — `pathNamingEngine.js` → `displayLabel`
- **Year-one plan** — `yearOnePlanEngine.js` in Startup Guide PDF Part 1
- **Source Library search** — `sourceSearchEngine.js` + `sourceSearchAliases.json`
- **Customer brief** — No internal discovery questions, budget, or confidence score
