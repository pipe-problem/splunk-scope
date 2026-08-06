# Scripts

Node scripts for catalog validation, Splunkbase maintenance, and documentation generation. Run from the repository root.

---

## Validation

| Script | npm command | Purpose |
|--------|-------------|---------|
| `validateSourceCatalog.js` | `npm run validate:catalog` | Structural validation of `sources.json` (IDs, formulas, hierarchy) |
| `validateSourceContent.mjs` | _(part of validate:catalog)_ | Content rules, overlap peers, measurement coverage cross-checks |
| `audit-measurement-coverage.mjs` | `npm run validate:measurement` | Every catalog source has a measurement question |
| `validateSplunkbaseCatalog.js` | `npm run validate:splunkbase` | Splunkbase app/TA link IDs in catalog |
| `validateSplunkbaseLinks.mjs` | _(manual)_ | Link reachability checks |

Reports from catalog validation write to **`../splunk-scope-reference/docs/archive/`** when that folder exists.

---

## Catalog maintenance

| Script | Purpose |
|--------|---------|
| `refreshSplunkbaseCatalog.js` | `npm run refresh:splunkbase` — refresh Splunkbase metadata |
| `syncRatesFromSizingCatalog.mjs` | Sync rate fields from sizing research into catalog JSON |
| `syncMeasurementFromCatalog.mjs` | Sync measurement questions from catalog changes |
| `findOrphans.mjs` | Find orphan catalog references |

---

## Documentation generation

| Script | npm command | Output |
|--------|-------------|--------|
| `generateDataSourceSizingDoc.mjs` | `npm run gen:sizing-doc` | `DATA_SOURCE_SIZING_FIELDS.md` → reference folder |
| `generateSourceResearchSheet.mjs` | `npm run gen:research-sheet` | `source-sizing-research-template.xlsx` → reference folder |
| `capture-screenshots.mjs` | `npm run screenshots` | UI screenshots → `docs/screenshots/` (gitignored) |

---

## Shared utilities

| Path | Purpose |
|------|---------|
| `lib/catalogUtils.mjs` | Paths to reference repo, catalog loaders |
| `lib/splunkbaseValidator.mjs` | Splunkbase ID validation helpers |

---

## Requirements

- Node.js 20+
- For screenshots: Playwright Chromium (`npx playwright install chromium`)

See [`../CONTRIBUTING.md`](../CONTRIBUTING.md) for the full development workflow.
