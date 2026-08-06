# Splunk Scope — Architecture

Technical overview of **Splunk Scope**: a local React application for Splunk planning, source evaluation, ingest guidance, multi-use-case coverage, phased architecture paths, and report generation.

---

## Directory structure

```text
splunk-scope/                      # GitHub: pipe-problem/splunk-scope
├── docs/                          # See DOC_INDEX.md and docs/README.md
│   ├── DOC_INDEX.md               # Documentation map
│   ├── README.md                  # Docs hub by audience
│   ├── VERSIONING.md              # Release process
│   ├── PROJECT_SCOPE.md           # Mission + features
│   ├── PRODUCT_PRINCIPLES.md      # Decision rules
│   ├── ARCHITECTURE.md            # This file
│   ├── USER_GUIDE.md              # SE workshop walkthrough
│   └── …                          # Engine reference, audits, methodology
├── CONTRIBUTING.md                # Dev setup and release checklist
├── scripts/                       # See scripts/README.md
├── e2e/                           # See e2e/README.md (Playwright smoke)
├── dist/                          # Vite production build output
├── public/                        # Static assets
├── src/
│   ├── components/               # Reusable UI
│   ├── config/                  # version.js, workflow steps, feature flags
│   ├── context/                  # AppContext.jsx — global state + persistence
│   ├── data/                     # JSON catalogs — see src/data/README.md
│   ├── pages/                    # Workflow screens
│   ├── services/                 # Engines and resolvers (domain logic)
│   ├── utils/                    # Shared helpers (e.g. intakeReadiness.js)
│   ├── App.jsx                   # Shell, stepper, session tools
│   └── main.jsx                  # Entry
├── index.html
├── package.json
└── vite.config.js
```

**External reference folder:** `../splunk-scope-reference/` holds generated spreadsheets, validation reports, and historical archives (not tracked in git).

---

## Engines and services

Domain behavior lives in **`src/services/`** — pure or near-pure modules consumed by pages. Resolvers and helpers sit alongside dedicated engines.

| Module | Description |
|--------|-------------|
| **`interpretationEngine`** | Turns intake (and optional imported context) into a structured interpretation for Analysis. |
| **`useCaseResolver`** | Resolves intake selections to use-case profiles from `useCaseProfiles.json`. |
| **`contextImportEngine`** | Parses pasted or imported free text into structured hints aligned with intake fields. |
| **`sizingEngine`** | GB/day estimates per source: formulas, scope and vendor multipliers, manual overrides, totals, storage helper. |
| **`sourceHierarchyEngine`** | Parent/child catalog flattening helpers, log-derived ingest for nested `log_options`, warnings. |
| **`overlapEngine`** | Overlap groups, user prompts, deduplication hints for ingest totals. |
| **`sourceRecommendationEngine`** | Core Required / Recommended / Optional / Redundant / Unnecessary / Needs Review classification. |
| **`logRequirementEngine`** | Log **capabilities** from `logRequirements.json`, app key resolution, satisfaction checks vs. sources. |
| **`sourceRequirementEngine`** | Combines log/app/data-model requirements with domain classification for final labels and explanations. |
| **`sourceRelevanceEngine`** | Relevance scoring and ordering helpers for the catalog. |
| **`intakeReadiness.js`** | Gates source relevance scoring until intake has planning context. |
| **`sourceInsightEngine`** | Rich per-source metadata for modals and detail panels. |
| **`coverageEngine`** | Per-domain coverage (max strength), split current/future, multi-use-case validation. |
| **`priorityEngine`** | Priority scores for ordering sources and feeding plans. |
| **`planEngine`** | Foundational / Expanded / Target State plans from configured sources and gaps. |
| **`gapImpactEngine`** | Severity framing for uncovered domains. |
| **`valuePropEngine`** | Outcome-oriented language tied to plans and coverage honesty. |
| **`customerReportDataBuilder`** | Assembles report sections and executive narrative for ReportPage exports. |
| **`startupGuideEngine`** | Customer onboarding / enablement sections when requested. |
| **`sourceOverlapLookupEngine`** | Pairwise overlap verdicts for configure panel and reference library. |

**Tests:** Vitest suite (`npm test`) covers engines, sizing, overlap lookup, and workflow regressions.

## Data flow

End-to-end pipeline:

```text
Intake → Interpretation (Analysis) → Source configuration → Coverage → Plans → Report
```

1. **Intake** — structured fields + optional Quick Start / scenario load + optional context import.
2. **Interpretation** — normalized “what we understood” view for the SE before deep configuration.
3. **Sources** — catalog-driven configuration, overlap resolution, hierarchical logs, sizing hints.
4. **Coverage** — domain scores vs. selected use cases; ingest rollup with buffer and overlap exclusions.
5. **Plans** — three paths built only from user-configured sources (and gap-fill heuristics within that set).
6. **Report** — narrative and metrics for the **selected** plan; optional startup guide blocks.

---

## State management

- **`AppProvider`** in `src/context/AppContext.jsx` holds a single **`useReducer`** store.
- **`localStorage`** key `splunk-scope-session` persists the working session (intake, sources, overlap decisions, buffer, scenarios, etc.).
- **`Session tools`** in the sidebar support export/import JSON and reset.

Important fields include `sources` (per-source status and inputs), `overlapDecisions`, `bufferPercent`, `plans`, `selectedPlanIndex`, and `showAllDomains` (coverage domain filter).

---

## Data files and purposes

| File | Purpose |
|------|---------|
| `sources.json` | Master source catalog: domains, inputs, sizing, overlap groups, `log_options`. |
| `useCaseProfiles.json` | Use-case definitions: required/recommended domains, apps, copy. |
| `splunkApps.json` | App picker catalog (categories and apps). |
| `sizingRates.json` | Reference GB/day rates, vendor/model overrides, scope multipliers. |
| `sizingRules.json` | Additional sizing rule metadata (as used by tooling or future engines). |
| `sizingBenchmarks.json` | Benchmark snapshots supporting messaging or charts where referenced. |
| `vendorModels.json` | Vendor/model picklists for intake and source forms. |
| `technicalAddons.json` | Technical add-on metadata and refresh stamps. |
| `sampleScenarios.json` | Quick Start scenario payloads. |
| `appRequirements.json` | App → capability expectations. |
| `logRequirements.json` | Capability definitions and domain linkage. |
| `dataModelRequirements.json` | Data model expectations for classification. |

---

## Service layer architecture

- **Pages** bind UI to state and call engines with **plain inputs and outputs** (objects, arrays, scalars).
- **No business rules in JSX** beyond display formatting — thresholds, ordering, and narratives live in services.
- **JSON catalogs** are imported as modules (Vite); scripts that run under Node may read JSON via `fs` where needed.

---

## How classification works

1. **Domain fit** — each source’s `telemetryDomains` is compared to active use-case **required** and **recommended** domains.
2. **Log capabilities** — `logRequirementEngine` derives required capabilities from selected use cases and Splunk apps using `appRequirements.json` and `logRequirements.json`.
3. **`sourceRequirementEngine`** merges capability checks with **`sourceRecommendationEngine`** outcomes so labels reflect both “domain coverage” and “log/app sufficiency.”
4. **Required is rare** — assigned when a source is effectively the **only** strong contributor for an unsatisfied required domain among **active** sources, per engine rules.
5. **Overlap state** — unresolved or deduplicated overlap can force **Redundant** or **Needs Review** regardless of raw domain fit.

Expandable UI sections carry **per-label explanations** (`getLabelExplanation` and related helpers) so users can drill into *why* without switching global “modes.”

---

## How sizing works

- Per-source **`sizing_formula`** (and related `sizingRate` fields) on catalog entries define baseline **rate × quantity**.
- **Composite sources** (`iaas`, `saas_office`, `saas_crm`, `saas_general`, `saas_sso`, and child IaaS rows) use additive engines (`iaasSizingEngine`, `officeProductivitySizingEngine`, etc.) instead of a single quantity field.
- **`sizingPanelRegistry.js`** maps catalog source IDs to dedicated configure panels (`IaasSizingPanel`, `OfficeProductivitySizingPanel`, …). `SourceConfigPanel` renders the registry panel when present; otherwise it falls back to generic measurement fields from `resolveMeasurementInputFields`.
- **Scope** strings (logging scope / audit level) apply pattern-based multipliers.
- **Vendor** selection applies multipliers from `sizingEngine` (and should stay aligned with `sizingRates.json` for consistency).
- **Nested log options** add incremental GB/day from `gb_per_unit` × parent quantity via `sourceHierarchyEngine`.
- **Manual override** GB/day bypasses formula with a documented assumption.
- **Buffer** (session `bufferPercent`) scales totals for Coverage charts and reports.
- **`sizingRates.json`** is the maintained benchmark matrix; run `npm run validate:catalog` after edits to keep `sources.json` bands in sync.

---

## How coverage scoring works

- For each telemetry domain, contributions from all active sources are combined by **maximum** strength (`strong` > `partial` > `minimal`), not sum-of-parts.
- Strength maps to numeric scores (for example strong = 1.0); per-domain scores drive heatmaps and gap lists.
- **Multi-use-case validation** (`validateMultiUseCase`) weights each selected profile and surfaces combined gaps and warnings.
- With **no use cases selected**, validation is explicitly **not** a pass — the engine reports that coverage cannot be evaluated against requirements.

---

## How plan generation works

`planEngine.generatePlans`:

1. Partitions catalog sources into **current** vs. **future** according to session status.
2. Uses **`priorityEngine`** scores to rank future sources for incremental value.
3. **Foundational** — starts from current sources; may pull a small set of **future** gap fillers for critical missing required domains.
4. **Expanded** — adds high-priority future sources and additional gap closure where possible.
5. **Target State** — includes the full configured future-facing set within user selections.

Each plan carries sizing totals (via `sizingEngine`), coverage snapshots, validation against the **primary** resolved use case for some metrics, and narrative hooks for **valuePropEngine** / **customerReportDataBuilder**.

**Architecture Paths UI** (`PlansPage.jsx`) presents those plans through theme engines (`pathThemeEngine`, `pathOutcomeScoringEngine`, `pathValueMessagingEngine`) and display helpers (`pathDisplayHelpers.js`). The customer-facing surface is a **carousel** (`PathCarousel`, `PathCarouselSlide`) with readiness gauge and a collapsed technical accordion — not a four-column comparison grid. Session schema **v5** stores `selectedPlanIndex` for the report path.

---

*Update this document when adding engines, changing persistence keys, or altering the stepper flow. See [`DOC_INDEX.md`](./DOC_INDEX.md) when adding or retiring docs.*
