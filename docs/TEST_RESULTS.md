# Splunk Scope — Test Results

**Date:** 2026-07-02  
**Version:** 2.0.0+ (Round 2 UX — budget internal-only, CAST export theme, paths carousel)  
**Schema Version:** 6  

## Round 2 UX regression gate (2026-07-02)

### Automated

| Command | Result |
|---------|--------|
| `npm test` | **604 / 604 PASS** (31 files) |
| `npm run build` | **PASS** |
| `npm run test:e2e` | **10 / 10 PASS** (~29s) |
| `npm test -- src/services/mathConsistency.test.js` | **7 / 7 PASS** |

E2E smoke updates for Round 2 copy/export changes: F04 (`Total potential ingest`), F05 (direct `/#/coverage` — Coverage archived from nav), F07 (customer deliverable + email pack zips), F10 (session tools popover selectors).

### Manual checklist (Round 2 UX)

| # | Check | Automated evidence | Manual |
|---|-------|-------------------|--------|
| 1 | **Analysis:** no budget text | `InterpretationPage.test.js` — page source must not contain `planning budget`; `customerCopyGuard.test.js` scans Analysis surface; F02 passes | Spot-check hero / objectives on Load Example |
| 2 | **Config panel:** wider, EDR More info readable | `SourceWorkflowPage.test.js` — panel width `min(78vw,56rem)`, two-column layout; `SourceMoreInfoPanel` 28-word cap + sample log | Open EDR → More info; confirm tiles readable |
| 3 | **Review:** "Total potential ingest", neutral bar colors | `ReviewPage.test.js` — `TOTAL_INGEST_LABEL`, no green default on hero ingest; F04 asserts label visible | Overview tab: low/info, expected/accent, high/warning |
| 4 | **Shared telemetry:** click shared zone → overlap examples | `overlapInteraction.test.js`, `reviewGateEngine.test.js` — `sharedTelemetry[]` + expand panel | Click overlap card on Review Overview; confirm example list |
| 5 | **Paths:** 3 cards visible, no stacking; donut hover category + sources | `PathCarouselLayout.test.js` — 3-slot deck; F06 carousel + Walk select; `DonutChart` `centerMode: total-only` | Hover center donut tooltip — no clipping at 1440×900 |
| 6 | **Report export:** customer HTML CAST colors; README customer-simple | `customerReportExport.test.js` — `#E954B7`, `#FF7A1A`, gradient, README has no `internal`/`se-sales`; F07 zip downloads | Open exported HTML in browser; compare to in-app Report |

### Banned budget language grep (customer-facing surfaces)

Scanned `src/pages` (except Intake), `src/components/report`, `src/components/sources`, `src/components/architecture-paths`, export customer HTML builders:

| Phrase | Customer UI | Customer export HTML | Internal-only (expected) |
|--------|-------------|----------------------|--------------------------|
| `planning budget` | **None** (Intake only) | **None** | `IntakePage.jsx`, `budgetEngine.js`, `engines.test.js` |
| `ingest budget` | **None** | **None** | `IntakePage.jsx` path budget helper text |
| `opportunity budget` | **None** | **None** | `buildSeSalesSummaryHtml()` only |

`customerReportExport.test.js` + `findBannedBudgetLanguageInReport()` enforce full sanitized report object. `BANNED_CUSTOMER_BUDGET_PHRASES` in `customerFacingCopy.js` covers extended variants (`budget cap`, `budget headroom`, etc.).

---

## Test Summary

| Framework | Tests | Passed | Failed |
|-----------|-------|--------|--------|
| Vitest (`npm test`) | 604 | 604 | 0 |
| Production build (`npm run build`) | — | PASS | 0 |
| Playwright smoke (`npm run test:e2e`) | 10 flows | 10 PASS | 0 |

### Global layout + copy guard (2026-07-01)

- **`customerCopyGuard.test.js`** — Layout utility contract (`.page-content-width`, intake variant) and banned customer-copy scan across Intake, Analysis, Sources, Review, Paths, Report, and badge components.
- **`pathGapCopyEngine.test.js`** — Customer-facing path gap strings; no generic `"Additional telemetry needed"` placeholder.

### Cross-page math consistency (2026-07-01)

- **`mathConsistency.test.js`** — 7 tests: page import guard (no page-local sizing math); `robbins_retail_hybrid` review totals == eligible source expected sum; each path total == included sources; report == selected Walk path; export HTML/zip == in-app numbers; ±20% bands (0.8× / 1.2×) at source and aggregate level; synthetic 5-source session reconciliation.

### Robbins Load Example refresh (2026-07-01)

- **`robbinsScenario.test.js`** — 9 tests: sole Load Example scenario, path budget percentages 80/100/110, overlap annotate-only (`dedup: false`), session configured ingest > 150 GB/day budget cap, Walk/Run path buffered totals vs budget, `selectedPlanIndex: null`, `suppressPathRecommendation: true`.

### Customer report + deliverable export (2026-06-30)

- **`customerReportExport.test.js`** — 22 tests: data builder, HTML tabs/accordions, validation, zip deliverable export, PDF snapshot coverage

### Chuck Robbins Load Example + path/report UX (2026-06-23)

- **`robbinsScenario.test.js`** — 7 tests: sole Load Example scenario, configured ingest > $150K budget cap, four distinct paths, overlap dedupe (M365 + EDR), firewall/VM logging profile sizing
- **Load Example:** `robbins_retail_hybrid` replaces Oakridge; no pre-selected report path; `suppressPathRecommendation` hides Recommended badge until user selects a path on Architecture Paths
- **Planning totals fix:** nested catalog children (e.g. `saas_office`, `saas_crm`) now included when `sources.json` root is passed as an array — `catalogToFlatList()` always flattens

### Architecture Paths carousel (2026-06-29)

- **`pathArchitecture.test.js`** — 12 tests: theme scoring, Walk A/B differentiation, roadmap readiness labels, overlap ratio, messaging hooks
- **`pathDisplayHelpers.test.js`** — 14 tests: recommended index, ingest/delta metrics, tile copy limits, carousel wrap contract, no duplicate ingest on slide, `DonutChart` import on Report
- **UI:** `PathCarousel`, `PathCarouselSlide`, `PathReadinessGauge`, `PathTechnicalDetails` on `PlansPage.jsx`; circular wrap navigation; technical Sources | Scoring accordion

### Sizing guardrails (2026-06-23)

- **`sourceSizingResult.test.js`** — 20 tests: adaptive MB/day display, guardrail floors (CRM, Office, SSO, Cloud VM, Cloud Storage, Firewalls, DLP, Asset lookup), Windows channel consistency, needs-input states

### Cloud Storage additive sizing (2026-06-23)

- **`cloudStorageSizing.test.js`** — 18 tests: four measured examples (AWS base/full, Azure full, blended base), profile toggles, custom components, blank-as-zero, vendor unit labels, overlap warning, legacy migration, sizingEngine integration
- **Data:** `cloudStorageSizingRates.json` (six vendors × four components + profile rollups)
- **Services:** `cloudStorageSizingEngine.js`
- **UI:** `CloudStorageSizingPanel.jsx` in `iaas_storage` config drawer; Review + Report breakdown

### Cloud Instances / VMs additive sizing (2026-06-23)

- **`cloudVmSizing.test.js`** — 18 tests: four measured examples (AWS base/full, Azure full, blended base), profile toggles, custom components, blank-as-zero, provider switch, overlap warning, legacy migration, sizingEngine integration
- **Data:** `cloudVmSizingRates.json` (six providers × four components + profile rollups)
- **Services:** `cloudVmSizingEngine.js`
- **UI:** `CloudVmSizingPanel.jsx` in `iaas_instances` config drawer; Review + Report breakdown

### Containers / Pods / Clusters additive sizing (2026-06-23)

- **`containerSizing.test.js`** — 18 tests: four measured examples (generic + blended), audit/stdout toggles, blank-as-zero, platform rate switch, overlap warning, legacy `count` migration, sizingEngine integration, review display labels
- **Data:** `containerSizingRates.json` (six platforms × four components)
- **Services:** `containerSizingEngine.js`
- **UI:** `ContainerSizingPanel.jsx` in `iaas_containers` config drawer; Review + Report breakdown

### IaaS cloud sizing (2026-06-23)

- **`iaasSizing.test.js`** — 19 tests: standard AWS/Azure/average, advanced scope sums, blank-as-zero, K8s/cluster and account dual-scope rules, overlap warning, legacy migration, sizingEngine integration
- **Data:** `iaasSizingRates.json` (provider + scope rates)
- **Services:** `iaasSizingEngine.js`
- **UI:** `IaasSizingPanel.jsx` in IaaS config drawer

### Data Sources UX + custom sources (2026-06-23)

- **`customSources.test.js`** — 5 tests: ID format, per-unit vs manual total state, catalog entry sizing formula, session listing
- **UI:** Vertical category sidebar on `SourceWorkflowPage.jsx`; top suggested limit 3; `CustomSourceModal` / `CustomConfigDrawer`
- **Rules:** `sourceRecommendationRules.json` `topSuggestedLimit`: 3

### Circuit-assisted import (2026-06-23)

- **`circuit.test.js`** — 16 tests: prompt includes JSON schema, use case names, app IDs, goal preset IDs; processor parses clean JSON and markdown fences; invalid JSON handling; use case/app/deployment mapping; preset validation; unknown values warn without crash; heuristic fallback; session migration v4→v5; `formatTelemetryFocusLabel` capitalization
- **Services:** `circuitPromptBuilder.js`, `circuitResponseProcessor.js`, `intakeImportHelpers.js`, `goalPresets.js`
- **Data:** `goalPresets.json` (90 presets)
- **UI:** Rebuilt `IntakePage.jsx` — Circuit workflow, goal preset dropdowns, advanced pattern-matching fallback

### Customer planning pack export (2026-06-18)

- **`customerReportExport.test.js`** — 13 tests: data builder completeness, HTML tabs/accordions, validation, PDF snapshot coverage
- See prior entry below for services list

### Prior results

See `../splunk-scope-reference/docs/archive/TEST_RESULTS.md` for 2026-06-02 export redesign and app recommendation engine scenarios (235+ engine tests).
