# Splunk Scope — documentation index

Single map of project documentation. **Start with [`README.md`](../README.md)** for run and workflow; use this table to find everything else.

**App version:** 2.0.1 · See [`VERSIONING.md`](./VERSIONING.md) for release process.

---

## Start here

| Doc | Audience | When to read |
|-----|----------|--------------|
| [`README.md`](../README.md) | All contributors | Clone, install, quick start, workflow overview |
| [`docs/README.md`](./README.md) | All | Documentation hub by audience |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | Contributors | Dev setup, tests, catalog edits, releases |
| [`USER_GUIDE.md`](./USER_GUIDE.md) | SEs, facilitators | Step-by-step workshop usage for every screen |

## Canonical (current product truth)

| Doc | Audience | When to read |
|-----|----------|--------------|
| [`PROJECT_SCOPE.md`](./PROJECT_SCOPE.md) | PM, lead SE, new contributors | Mission, feature list, in/out of scope |
| [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md) | SE, UX, engineering | Guardrails: progressive disclosure, estimate honesty |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Engineers | Code layout, engines, data flow, persistence |
| [`VERSIONING.md`](./VERSIONING.md) | Maintainers | Semver, version file map, release checklist |

## Active reference (engines & catalogs)

| Doc | Audience | When to read |
|-----|----------|--------------|
| [`APP_RECOMMENDATION_ENGINE.md`](./APP_RECOMMENDATION_ENGINE.md) | SE, engineering | Interpretation / exports Splunk product picks |
| [`SOURCE_RECOMMENDATION_RULES.md`](./SOURCE_RECOMMENDATION_RULES.md) | SE, engineering | Data Sources priority labels and scoring |
| [`CURSOR_IMPORT.md`](./CURSOR_IMPORT.md) | SE, engineering | Cursor-assisted intake, schema v7, rollback |
| [`SIZING_METHODOLOGY.md`](./SIZING_METHODOLOGY.md) | SE, catalog maintainers | GB/day bands, units, multipliers |
| [`SOURCE_CATALOG_QA.md`](./SOURCE_CATALOG_QA.md) | Catalog maintainers | Per-source QA rubric |
| [`src/data/README.md`](../src/data/README.md) | Catalog maintainers | Which JSON file to edit |

## Folder READMEs

| Path | Contents |
|------|----------|
| [`scripts/README.md`](../scripts/README.md) | Validation and generation scripts |
| [`e2e/README.md`](../e2e/README.md) | Playwright smoke tests F01–F10 |

## Operational

| Doc | Audience | When to read |
|-----|----------|--------------|
| [`BUGFIX_LOG.md`](./BUGFIX_LOG.md) | Engineering | Historical one-line fixes — prefer CHANGELOG for new work |
| [`CHANGELOG.md`](../CHANGELOG.md) | All | Version-to-version release summary |

## Generated outputs (local reference folder — not in git)

Build-time artifacts live in **`../splunk-scope-reference/`** (sibling to this repo). See that folder's README.

| Output | How to regenerate |
|--------|-------------------|
| `docs/source-sizing-research-template.xlsx` | `npm run gen:research-sheet` |
| `docs/archive/DATA_SOURCE_SIZING_FIELDS.md` | `npm run gen:sizing-doc` |
| `docs/archive/catalog-validation-report.*` | `npm run validate:catalog` |
| `docs/archive/SPLUNKBASE_CATALOG_REPORT.md` | `npm run refresh:splunkbase` |
| `docs/screenshots/` | `npm run screenshots` |

## Point-in-time audits (dated — not live status)

| Doc | Notes |
|-----|-------|
| [`TEST_RESULTS.md`](./TEST_RESULTS.md) | Test gate snapshot; run `npm test` for current count |
| [`CURRENT_APP_AUDIT.md`](./CURRENT_APP_AUDIT.md) | Feature audit snapshot |
| [`UI_AUDIT_2026-06-03.md`](./UI_AUDIT_2026-06-03.md) | UX audit snapshot |
| [`../CAST-AUDIT.md`](../CAST-AUDIT.md) | **Legacy** — pre–Splunk Scope rename; see ARCHITECTURE + CHANGELOG |
