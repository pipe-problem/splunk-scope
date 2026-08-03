# Changelog

All notable changes to **Splunk Scope** are documented in this file. Release numbering follows the application version in `package.json` and `catalogVersion.json` where applicable.

---

## [Unreleased] — 2026-07-01

### Added

- **`mathConsistency.test.js`** — Hardened cross-page ingest reconciliation: page import guard (pages must not import sizing math outside `planningIngestTotals` / `reviewGateEngine` / `planEngine` chain); `robbins_retail_hybrid` asserts review totals, per-path source sums, report == selected path, export HTML/zip numbers, and ±20% bands at source and aggregate level.
- **Customer deliverable zip export** — Report **Export Customer Pack** downloads `customer_deliverables.zip` (SE sales summary, customer value proposition, startup guide, README) via `customerDeliverableExportBuilder.js` and `ExportCustomerPackMenu.jsx`.

### Changed

- **Global layout consistency** — Shared `.page-content-width` (`max-w-6xl`) on Analysis, Review, Paths, and Report scroll regions; Intake uses `.page-content-width--intake` (`max-w-4xl`). Paths carousel deck height uses `100dvh`-aware sizing so the **Select for report** footer is not clipped on short laptops. Sources config panel backdrop scopes to the grid region only (header, filter bar, and category sidebar stay interactive).
- **Coverage + Scenario Comparison pages** — Ingest totals now route through `planningIngestTotals.js` instead of page-local `calculateFullSourceIngest` / `calculateSourceSize` math.
- **Customer-facing copy guard** — Banned internal labels (`Needs review`, `Active`, `Planned`, `Skip`, `Required`, `Optional`, `Redundant`, etc.) replaced on Intake, Sources, Review, Report, and badge surfaces; `customerCopyGuard.test.js` prevents regressions.
- **Architecture path gaps** — `pathGapCopyEngine.js` maps coverage gaps to source-aware customer strings (e.g. identity provider logs); removes generic `"Coverage: Additional telemetry needed"` placeholder from `plan.gaps`.
- **Architecture Paths carousel UX** — Side-card peek deck, solution-fit metrics, sticky Select footer, donut hover layout, **Source breakdown** panel below carousel (expanded on desktop).

### Added (prior unreleased — 2026-06-23)

- **Chuck Robbins retail Load Example** — `robbins_retail_hybrid` replaces Oakridge: ~1,200-user hybrid retail, $150K Splunk Cloud budget (~150 GB/day cap), 22 current / 12 future / 8 skip sources, PCI + threat + cloud use cases, pre-seeded M365/SaaS and EDR/Windows overlap dedupe, rich `exampleProfile` for SE demos. **`robbinsScenario.test.js`** (7 tests).
- **Report path explicit selection** — Load Example sets `selectedPlanIndex: null`, `reportPathExplicit: false`, `suppressPathRecommendation: true`; Report page empty state until user picks a path on Architecture Paths; carousel hides Recommended badge when suppressed.

### Changed

- **Load Example scenario** — Single fictional demo: **Chuck Robbins Inc. — Regional Retail & Distribution** (over-budget configured ingest vs fixed cap).
- **Sizing guardrails** — Firewall `logging_scope` multiplier on guardrail floor; Cloud VM profile bands (`standard_vm_logs` vs `full_vm_logs` vs minimal).
- **Planning ingest totals** — Always flatten catalog tree so nested child sources count toward Review/Coverage KPIs (`catalogToFlatList` in `planningIngestTotals.js`, `sourceSizingResultEngine.js`).
- **Session export/migration** — `reportPathExplicit`, `suppressPathRecommendation`; `selectedPlanIndex` may be `null` without coercing to Crawl.

- **Circuit-assisted structured import** — Intake rebuild: copy prompt → paste Circuit JSON → review preview → apply. No direct LLM API keys in Scope. Services: `circuitPromptBuilder.js`, `circuitResponseProcessor.js`, `intakeImportHelpers.js`.
- **Goal preset library** — `src/data/goalPresets.json` (30 Crawl / 30 Walk / 30 Run presets). Crawl/Walk/Run dropdowns replace default freeform goal fields; reports resolve `customerFacingText` from preset IDs.
- **Custom data sources** — Create user-defined feeds on Data Sources (name, vendor, units, GB/unit or manual GB/day). `CustomSourceModal`, `CustomConfigDrawer`, `customSources.js`; session keys `custom_*`; `REMOVE_SOURCE` action.
- **IaaS standard + advanced cloud sizing** — Provider-aware standard mode (accounts × vendor GB/day bands) and optional advanced mode (VM, flow log, storage, Kubernetes scope rates). `iaasSizingRates.json`, `iaasSizingEngine.js`, `IaasSizingPanel.jsx`; overlap warning when advanced IaaS and child cloud sources are both configured.
- **Containers / Pods / Clusters additive sizing** — Platform-aware model (Kubernetes, OpenShift, EKS, AKS, GKE, blended) with cluster, node, and pod/container counts plus audit/events and stdout toggles. `containerSizingRates.json`, `containerSizingEngine.js`, `ContainerSizingPanel.jsx`; non-blocking overlap warning with IaaS, VMs, app/web, and observability sources.
- **Cloud Instances / VMs additive sizing** — Provider-aware model (AWS EC2, Azure, GCE, VMware Cloud, OCI, blended) with instance count, base/full collection profiles, and optional component toggles. `cloudVmSizingRates.json`, `cloudVmSizingEngine.js`, `CloudVmSizingPanel.jsx`; overlap warning with server, app, web, container, and observability sources.
- **Cloud Storage additive sizing** — Vendor-aware model (AWS S3, Azure, GCS, NetApp, Dell PowerScale, blended) with storage asset count, base/full access log profiles, and optional component toggles. `cloudStorageSizingRates.json`, `cloudStorageSizingEngine.js`, `CloudStorageSizingPanel.jsx`; overlap warning with IaaS, app/web, database, DLP, and CASB sources.
- **SaaS (General) additive sizing v2** — Tenant + active-user + integration model (Salesforce, ServiceNow, Workday, Box, Atlassian Cloud, blended) with collection profile and activity level. Measured from 150k synthetic events; adaptive MB/day display for small tenants. `saasSizingRates.json`, `saasSizingEngine.js`, `SaaSSizingPanel.jsx`; deliverables `saas_general_measured_sizing_v2.csv` and `saas_general_synthetic_logs_v2.zip`.
- **Office Productivity additive sizing** — Product-aware model (Microsoft 365, Google Workspace, Exchange, SharePoint, Teams, blended) with tenant, user, mailbox, file-user, and collaboration-user counts plus collection profile and component toggles. `officeProductivitySizingRates.json`, `officeProductivitySizingEngine.js`, `OfficeProductivitySizingPanel.jsx`; adaptive MB/day display and Microsoft 365 overlap warnings.
- **Sizing calibration guardrails** — `sourceSizingGuardrails.json` and `sourceSizingGuardrailEngine.js` apply original sizing-sheet planning floors via `max(additive, guardrail)` for normal profiles (CRM, Office, SSO, SaaS, Cloud VM, Cloud Storage, Containers, Windows all-logs, DLP, Firewalls, Asset lists). Audit-only/minimal profiles stay lower with explicit labeling. DLP and Asset ingest profiles; Cloud VM default profile `standard_vm_logs` (0.1/0.25/0.35 GB/instance). Lookup/context sources show "Lookup / Context Source" instead of 0.0 GB/day. `sourceSizingResult.test.js` expanded with guardrail acceptance cases (20 tests in that file; **460** Vitest tests total).
- **Architecture Paths carousel (v4)** — Coverage-style carousel UX: `PathCarousel`, `PathCarouselSlide`, `PathReadinessGauge`, `PathTechnicalDetails` (Sources | Scoring, collapsed by default). Replaces four-column comparison grid. CAST tokens only; circular wrap navigation; keyboard navigation when focused.
- **Schema v5** — `crawlGoalPresetId`, `walkGoalPresetId`, `runGoalPresetId`, `sourceHints`; legacy freeform goals migrated into `discoveryNotes`.
- **Vitest** — `circuit.test.js` (prompt schema, JSON/markdown parse, deployment aliases, preset validation, migration v5, display labels); `customSources.test.js`.
- **Documentation** — `docs/CIRCUIT_IMPORT.md` (workflow, rollback, privacy).

### Changed

- **Intake page** — "Circuit-assisted import" panel; manual essentials; goal preset selectors; advanced collapsible (freeform goals + pattern-matching fallback).
- **Data Sources page** — Category navigation moved to a **vertical left sidebar** (fixes horizontal tab overflow on narrow screens). **Top suggested** capped at **3** per category (`topSuggestedLimit`). Custom category with create/edit/delete flow.
- **IaaS source** — Replaced vague account-only fields with standard (provider + account count) and advanced (scope-level counts) sizing; legacy `number_of_accounts` / `vendor` auto-migrate on load.
- **Containers / Pods / Clusters (`iaas_containers`)** — Replaced flat per-cluster rate with additive measured model; legacy `count` maps to cluster count on load.
- **Cloud Instances / VMs (`iaas_instances`)** — Replaced flat per-instance rate with additive measured model; legacy `count` maps to instance count on load.
- **Cloud Storage (`iaas_storage`)** — Replaced flat per-bucket rate with additive measured model; legacy `count` maps to storage asset count on load.
- **SaaS (General) (`saas_general`)** — Replaced per-user flat rate with tenant + active-user + integration additive model; legacy `number_of_users` / `count` map to active users; `number_of_platforms` maps to tenant count.
- **Office Productivity (`saas_office`)** — Replaced flat per-user rate with tenant + mailbox + file + collaboration additive model; legacy `count` maps to active user and mailbox counts.
- **CRM (`saas_crm`)** — Replaced flat per-user rate with tenant + active-user + integration additive model; legacy `count` maps to active CRM users; vendor, profile, activity level, toggles, and daily event overrides supported.
- **Analysis page** — "What we will prioritize" uses `formatDomainForCustomer()` (e.g. Identity and authentication, not `authentication`).
- **Report page** — Plan validation gap labels use `formatDomainForCustomer()` for consistent customer-facing names.
- **Customer export (HTML pack)** — Prominent customer name header with use-case chips; tabs below header; **Next steps** accordion removed from overview.
- **Engines** — `interpretationEngine`, `appRecommendationEngine`, exports use effective goal text from presets via `goalPresets.js`.
- **Architecture Paths** — Carousel-first page aligned with Coverage Analysis; spread-out slide layout; circular path navigation; technical details behind accordion.
- **Report page** — Fixed missing `DonutChart` import that crashed the Ingest chart section.
- **Config** — `SCHEMA_VERSION` in `src/config/version.js` now re-exports session `CURRENT_SCHEMA_VERSION` (5); was incorrectly hardcoded to 4.

---

## [Unreleased] — 2026-06-18

### Added

- **Customer planning pack export** — Report **Export Customer Pack** button downloads a standalone **Interactive Planning Pack (.html)** with tabs, accordions, and customer-safe content matching the live Report page (CAST dark theme, same copy and structure). No localhost, budget, or internal fields.
- **Services:** `customerReportDataBuilder.js`, `customerReportSanitizer.js`, `customerReportExportValidation.js`, `interactivePlanningPackBuilder.js`, `CustomerPlanningPackView.jsx`
- **13 Vitest tests** in `customerReportExport.test.js`

### Changed

- Replaced **Save Planning Pack (PDF)** browser-print workaround on Report with HTML export pipeline
- HTML export uses SSR of `CustomerPlanningPackView` for pixel-consistent Report UX

### Removed

- **PDF Snapshot** and **Print Preview** export options
- `/report/customer-pdf` route and browser-print planning pack flow

---

### Added

- **App recommendation engine** — `src/services/appRecommendationEngine.js` with canonical catalog `src/data/appCatalog.json`; grouped **Suggested Splunk Products** on Interpretation (solutions, helpful apps, technical add-ons, dependencies).
- **18 Vitest scenarios** for recommendation gates (security maturity, ES readiness, ML/AI, observability, cloud, Cisco, export parity, Northstar).
- **Documentation** — `docs/APP_RECOMMENDATION_ENGINE.md`.
- **SME intake forms** — `docs/APP_CATALOG_SME_INTAKE.md`, `docs/APP_SOURCE_USE_CASE_MATRIX.md` for product gates and app↔source↔use-case matrices.
- **Vitest** — scenarios 19–21 (basic_infosec example, canonical app-interest on sources, `suggestedApps` from engine).

### Changed

- **Interpretation** — no longer driven by static `primaryUseCase.splunkApps` alone; exports (Value Proposal, Startup Guide, PPTX) use the same engine output.
- **Source modal** — catalog-based related products and add-ons per source.
- **PPTX** — added Suggested Splunk Products slide (9 slides total).

### Fixed

- Cisco ISE add-on gated unless ISE/NAC is in scope.
- Premium apps and technical add-ons no longer mixed in a single undifferentiated list.
- **Source↔app alignment** — `collectCanonicalAppIds` / `sourceMatchesAppInterest` in `appCatalogService.js`; used by `scoreAppAlignment` and `classifySource`.
- **Foundational security profile** — legacy `splunkApps` lists InfoSec + SSE only (not ES).
- **`APP_RECOMMENDATION_LOGIC_AUDIT.md`** — remediation status banner pointing to current engine docs.

---

## [2.0.0] — 2026-05-29

### Added

- **Northstar Regional Logistics** fictional sample customer with full intake, 18 data sources, and structured example profile on intake.
- **PDF export** — three-page customer-facing document (Overview, Sources, Startup Guide) via jsPDF.
- **PowerPoint export** — eight-slide customer deck via pptxgenjs.
- **Splunkbase validation** — `npm run validate:splunkbase` audits app/TA link IDs.
- **Buffer band utility** — `applyBufferBand()` for consistent low/expected/high math.

### Changed

- **Home page** — only **Begin** and **Resume & Import**; enhanced topology/radar hero animation.
- **Favicon** — magnifying-glass logo matching app branding.
- **Buffer semantics** — Expected is unbuffered; low/high = expected ± buffer% (no double-buffering).
- **Splunkbase IDs** — ES, MLTK, Cisco Networks App, CrowdStrike, Okta, Microsoft Cloud Services, and others.
- Customer-facing language cleanup (planning estimate, validation — no POV/POC/pilot in exports).

### Fixed

- CSS `@keyframes radar-pulse` regression from animation update.
- Schema version alignment (`SCHEMA_VERSION` 4).

---

## [1.8.0] — 2026-05-07

### Added

- **Vitest** testing framework with 14 engine tests (`npm test`).
- **Error boundaries** at app and page level (`src/components/layout/ErrorBoundary.jsx`).
- **Toast notification system** (`src/components/layout/Toast.jsx`) for user-visible feedback on all session actions.
- **Stale analysis detection** on the Interpretation page — warns when intake changes after analysis.

### Changed

- **Customer Intake page** — three-column desktop layout (identity, use cases, goals/session tools).
- **Report executive summary** rewritten to be more business/customer-oriented.
- **Report sections** — Architecture Path and Use Cases default to open for a stronger first impression.
- **Quick Start** collapsed by default on Intake page.
- **Session tools** (export, import, reset) accessible directly on the Intake page.
- All literal Tailwind color classes (`bg-green-*`, `text-green-*`, etc.) replaced with CSS custom property references.
- `projectScope.js` version aligned to `1.8.0` (was incorrectly `2.0.0`).

### Fixed

- **HomePage "Load Example"** — was dispatching a bare string; now correctly passes full `{ intake, sources }` payload.
- **Interpretation page stale analysis** — `useEffect` now depends on intake changes instead of running once.
- **Dead `migrationWarning` state** removed from `AppContext.jsx`.
- **Unused `grouped` variable** removed from `UseCaseSelect.jsx`.
- **Silent import failures** — all import/load errors now surface via toast notifications.

---

## [1.7.0] — 2026-05-06

### Added

- Expanded **low / average / high** sizing rates for **~90+** sources (`src/data/sizingRates.json`).
- **Vendor/model** sizing framework: category multipliers (`src/data/vendorModelRates.json`) and per-source `vendorRates` / `models` where defined (`sizingRates.json`).
- **Source counting methodology** for workshop alignment (`src/data/sourceCountingMethods.json`).
- **Source-to-use-case mappings** for all **53** top-level catalog sources (`src/data/sourceUseCaseMappings.json`).
- **Log capability** descriptions for **30+** sources (`src/data/sourceLogCapabilities.json`).
- **Research notes** and validation-oriented metadata for **33** sources (`src/data/sizingResearchNotes.json`).
- **`docs/SIZING_METHODOLOGY.md`** — SE-facing methodology for bands, units, multipliers, overrides, and review rules.
- **`catalogVersion.json`** — central governance fields for app and dataset versions (`src/data/catalogVersion.json`).
- **`docs/release-notes/v1.7.md`** — v1.7 release narrative.

### Changed

- **Sizing configuration** centralized in dedicated JSON catalogs for v1.7; the sizing engine and UI remain aligned to **`sources.json`** formulas with scope/vendor pattern matching—**full consumption of `sizingRates.json` in the runtime calculator is staged** (catalog is authoritative for methodology and rates in this release line).
- **planEngine** buffer handling updated for consistent totals relative to sizing/buffer configuration.

### Fixed

- **CoveragePage** variable ordering defect.
- Undefined **`rowCountsTowardTotals`** reference (eligibility/totals alignment).
- **Theme** toggle icon direction.

---

## [1.6.0] — _Stub_

_Base release line prior to v1.7 catalog expansion._

### Added

- _(Document foundational Splunk Scope workflows: intake, sources, coverage, plans, reporting.)_

### Changed

- _(Record incremental catalog and engine updates from the 1.6 development period.)_

### Fixed

- _(List customer-facing defects resolved in 1.6.x if backfilled.)_

---
