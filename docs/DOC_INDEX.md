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

## Generated outputs (local reference folder — not in git)

Build-time and historical artifacts live in **`../splunk-scope-reference/`** (sibling to this repo). See that folder’s `README.md`.

| Output | How to regenerate |
|--------|-------------------|
| `docs/source-sizing-research-template.xlsx` | `npm run gen:research-sheet` |
| `docs/archive/DATA_SOURCE_SIZING_FIELDS.md` | `npm run gen:sizing-doc` |
| `docs/archive/catalog-validation-report.*` | `node scripts/validateSourceCatalog.js` |
| `docs/archive/SPLUNKBASE_CATALOG_REPORT.md` | `npm run refresh:splunkbase` |
| `docs/screenshots/` | `npm run screenshots` |

Historical audits, sizing spreadsheets, SaaS synthetic deliverables, and one-time scripts are also stored under `../splunk-scope-reference/`.
