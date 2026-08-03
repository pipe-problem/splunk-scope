# Splunk Scope — documentation index

Single map of project documentation. **Start with [`README.md`](../README.md)** for run and workflow; use this table to find everything else.

## Canonical (current product truth)

| Doc | Audience | When to read | Superseded by |
|-----|----------|--------------|---------------|
| [`README.md`](../README.md) | All contributors | Clone, install, quick start, workflow overview | — |
| [`USER_GUIDE.md`](./USER_GUIDE.md) | SEs, facilitators | Step-by-step workshop usage for every workflow screen | — |
| [`PROJECT_SCOPE.md`](./PROJECT_SCOPE.md) | PM, lead SE, new contributors | Mission, feature list, in/out of scope, v1.x capabilities | — |
| [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md) | SE, UX, engineering | Guardrails: progressive disclosure, estimate honesty, customer vs SE surfaces | — |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Engineers | Code layout, engines, data flow, persistence | — |

## Active reference (engines & catalogs)

| Doc | Audience | When to read | Superseded by |
|-----|----------|--------------|---------------|
| [`APP_RECOMMENDATION_ENGINE.md`](./APP_RECOMMENDATION_ENGINE.md) | SE, engineering | How Interpretation / exports pick Splunk products; gates and `appCatalog.json` | — |
| [`SOURCE_RECOMMENDATION_RULES.md`](./SOURCE_RECOMMENDATION_RULES.md) | SE, engineering | Data Sources priority labels, scoring, `sourceRecommendationRules.json` | — |
| [`CIRCUIT_IMPORT.md`](./CIRCUIT_IMPORT.md) | SE, engineering | Circuit-assisted intake, JSON schema, schema v5, rollback | — |
| [`SIZING_METHODOLOGY.md`](./SIZING_METHODOLOGY.md) | SE, catalog maintainers | GB/day bands, units, multipliers, `needsReview`, workshop usage | — |

## Operational

| Doc | Audience | When to read | Superseded by |
|-----|----------|--------------|---------------|
| [`BUGFIX_LOG.md`](./BUGFIX_LOG.md) | Engineering | One-line record of stabilization / bug fixes | — |
| [`CHANGELOG.md`](../CHANGELOG.md) | All | Version-to-version release summary | — |

## Generated & assets (not prose canon)

| Path | Audience | When to read | Superseded by |
|------|----------|--------------|---------------|
| [`source-sizing-research-template.xlsx`](./source-sizing-research-template.xlsx) | SE / research | Field GB/day research; return values to `sizingRates.json` | — |
| [`archive/DATA_SOURCE_SIZING_FIELDS.md`](./archive/DATA_SOURCE_SIZING_FIELDS.md) | Catalog editors | Auto-generated per-source field matrix (`npm run gen:sizing-doc`) | Regenerate after catalog edits |
| [`archive/catalog-validation-report.md`](./archive/catalog-validation-report.md) | CI / maintainers | Output of `node scripts/validateSourceCatalog.js` | Latest run |
| [`archive/SPLUNKBASE_CATALOG_REPORT.md`](./archive/SPLUNKBASE_CATALOG_REPORT.md) | Maintainers | Output of `npm run refresh:splunkbase` | Latest run |
| [`screenshots/`](./screenshots/) | UX / QA | Visual review captures (`npm run screenshots`) | — |

## Archived (historical only)

All under [`archive/`](./archive/) — **do not use for current behavior**. See [`archive/README.md`](./archive/README.md).

| Doc | Audience | When to read | Superseded by |
|-----|----------|--------------|---------------|
| [`archive/APP_RECOMMENDATION_LOGIC_AUDIT.md`](./archive/APP_RECOMMENDATION_LOGIC_AUDIT.md) | Engineering history | Pre–v1.9 recommendation audit trail | [`APP_RECOMMENDATION_ENGINE.md`](./APP_RECOMMENDATION_ENGINE.md) |
| [`archive/CURRENT_APP_AUDIT.md`](./archive/CURRENT_APP_AUDIT.md) | Engineering history | Point-in-time app behavior audit | [`PROJECT_SCOPE.md`](./PROJECT_SCOPE.md) + [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| [`archive/UI_QA_REPORT.md`](./archive/UI_QA_REPORT.md) | QA history | Screen-share / UI review snapshot | Current app + [`screenshots/`](./screenshots/) |
| [`archive/TEST_RESULTS.md`](./archive/TEST_RESULTS.md) | CI history | Pinned test run narrative | `npm test` output |
| [`archive/APP_CATALOG_SME_INTAKE.md`](./archive/APP_CATALOG_SME_INTAKE.md) | SMEs (historical) | Worksheet for product gates before catalog import | [`appCatalog.json`](../src/data/appCatalog.json) + [`APP_RECOMMENDATION_ENGINE.md`](./APP_RECOMMENDATION_ENGINE.md) |
| [`archive/APP_SOURCE_USE_CASE_MATRIX.md`](./archive/APP_SOURCE_USE_CASE_MATRIX.md) | SMEs (historical) | App ↔ source ↔ use-case matrix worksheet | `appCatalog.json` + [`SOURCE_RECOMMENDATION_RULES.md`](./SOURCE_RECOMMENDATION_RULES.md) |
| [`archive/SPLUNKBASE_CATALOG_METHODOLOGY.md`](./archive/SPLUNKBASE_CATALOG_METHODOLOGY.md) | Maintainers (historical) | Splunkbase refresh procedure detail | `scripts/refreshSplunkbaseCatalog.js` + archive report |
| [`archive/ARCHITECTURE_PATHS_LOGIC.md`](./archive/ARCHITECTURE_PATHS_LOGIC.md) | Engineering history | Paths engine deep-dive notes | [`ARCHITECTURE.md`](./ARCHITECTURE.md) (`planEngine.js`) |
| [`archive/SOURCE_SIZING_MATRIX.md`](./archive/SOURCE_SIZING_MATRIX.md) | SE (historical) | One-page sizing assumption table | [`SIZING_METHODOLOGY.md`](./SIZING_METHODOLOGY.md) + [`archive/DATA_SOURCE_SIZING_FIELDS.md`](./archive/DATA_SOURCE_SIZING_FIELDS.md) |
| [`archive/dead-code-resolution.md`](./archive/dead-code-resolution.md) | Engineering history | Dead-code triage | Current codebase |
| [`archive/NEEDS_REVIEW_ITEMS.md`](./archive/NEEDS_REVIEW_ITEMS.md) | Engineering history | Open review backlog snapshot | Issue tracker / catalog flags |
| [`archive/release-notes/v1.7.md`](./archive/release-notes/v1.7.md) | All (historical) | v1.7 release detail | [`CHANGELOG.md`](../CHANGELOG.md) |
| [`archive/release-notes/v1.8.md`](./archive/release-notes/v1.8.md) | All (historical) | v1.8 release detail | [`CHANGELOG.md`](../CHANGELOG.md) |
