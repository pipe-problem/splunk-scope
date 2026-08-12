# Documentation

Product and engineering documentation for **Splunk Scope** (v2.0.1).

**New here?** Start with the root [`README.md`](../README.md) for install and workshop flow, then read the [`USER_GUIDE.md`](./USER_GUIDE.md) for screen-by-screen guidance.

---

## By audience

### Solutions Engineers (workshop facilitators)

| Doc | Description |
|-----|-------------|
| [`USER_GUIDE.md`](./USER_GUIDE.md) | Every workflow step: Intake → Analysis → Sources → Review → Paths → Report |
| [`SIZING_METHODOLOGY.md`](./SIZING_METHODOLOGY.md) | GB/day bands, units, multipliers, when to override |
| [`CURSOR_IMPORT.md`](./CURSOR_IMPORT.md) | Cursor-assisted intake import |
| [`SOURCE_RECOMMENDATION_RULES.md`](./SOURCE_RECOMMENDATION_RULES.md) | How source priority labels and scores work |
| [`APP_RECOMMENDATION_ENGINE.md`](./APP_RECOMMENDATION_ENGINE.md) | How Splunk product suggestions are derived |

### Engineering and maintainers

| Doc | Description |
|-----|-------------|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Code layout, engines, data flow, persistence |
| [`PROJECT_SCOPE.md`](./PROJECT_SCOPE.md) | Mission, in/out of scope, feature matrix |
| [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md) | UX guardrails (estimates, progressive disclosure) |
| [`VERSIONING.md`](./VERSIONING.md) | Semver, release checklist, version file map |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Clone, test, catalog edit workflow |

### Operational

| Doc | Description |
|-----|-------------|
| [`DOC_INDEX.md`](./DOC_INDEX.md) | Master documentation map |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Release history |
| [`BUGFIX_LOG.md`](./BUGFIX_LOG.md) | Historical one-line fixes (see CHANGELOG for current) |
| [`SOURCE_CATALOG_QA.md`](./SOURCE_CATALOG_QA.md) | Catalog QA rubric |

### Point-in-time audits (dated snapshots)

These reflect a specific date/version — run live tests for current status:

| Doc | Date |
|-----|------|
| [`TEST_RESULTS.md`](./TEST_RESULTS.md) | 2026-07-02 |
| [`CURRENT_APP_AUDIT.md`](./CURRENT_APP_AUDIT.md) | 2026-06-18 |
| [`UI_AUDIT_2026-06-03.md`](./UI_AUDIT_2026-06-03.md) | 2026-06-03 |
| [`../CAST-AUDIT.md`](../CAST-AUDIT.md) | Legacy (pre–Splunk Scope rename) |

---

## Generated artifacts (outside git)

Build-time outputs (spreadsheets, validation reports, screenshots) live in **`../splunk-scope-reference/`**. See [`DOC_INDEX.md`](./DOC_INDEX.md) for regeneration commands.

---

## Assets

[`assets/`](./assets/) — SVG brand graphics used in docs and exports.
