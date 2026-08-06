# Data catalogs (`src/data/`)

JSON files in this directory drive Splunk Scope behavior: source definitions, sizing rates, use cases, app recommendations, and workshop scenarios. **Edit catalogs carefully** — run `npm run validate:catalog` and `npm test` after changes.

---

## Core source catalog

| File | Purpose |
|------|---------|
| **`sources.json`** | Master source tree: IDs, categories, descriptions, `input_fields`, sizing formulas, child sources |
| **`sourceMeasurementQuestions.json`** | "What do you count?" prompts per source |
| **`sourceRecommendationRules.json`** | Priority scoring weights, app capability boosts |
| **`sourceUseCaseMappings.json`** | Source ↔ use case relevance |
| **`sourceLogCapabilities.json`** | Log types each source can produce |
| **`sourceSearchAliases.json`** | Search aliases for the Sources filter bar |
| **`sourceSizingGuardrails.json`** | Planning floors from original sizing sheets |
| **`sourceOverlapPeers.json`** | Overlap pair definitions |
| **`overlapTelemetryCopy.json`** | Customer copy for overlap warnings |
| **`catalogVersion.json`** | App and dataset version metadata — update on releases |

---

## Sizing rate catalogs

| File | Sources covered |
|------|-----------------|
| `sizingRates.json` | Base rates (legacy flat rates + metadata) |
| `iaasSizingRates.json` | IaaS cloud accounts |
| `cloudVmSizingRates.json` | Cloud VMs / instances |
| `cloudStorageSizingRates.json` | Cloud storage |
| `containerSizingRates.json` | Kubernetes / containers |
| `saasSizingRates.json` | General SaaS |
| `officeProductivitySizingRates.json` | M365 / Google Workspace |
| `crmSizingRates.json` | CRM platforms |
| `ssoIdentitySizingRates.json` | SSO / identity providers |
| `vendorModelRates.json` | Vendor/category multipliers |
| `vendorModels.json` | Vendor/model dropdown options |
| `originalSizingRates.json` | Reference copy of sheet-derived rates |
| `sizingResearchNotes.json` | Research notes per source |
| `sourceCountingMethods.json` | Counting methodology text |

---

## Apps, use cases, and recommendations

| File | Purpose |
|------|---------|
| `appCatalog.json` | Splunk apps/add-ons for recommendations |
| `splunkApps.json` | Intake multi-select app list |
| `splunkbaseCatalog.json` | Splunkbase link metadata |
| `appRequirements.json` | App ↔ log capability requirements |
| `logRequirements.json` | Log capability definitions |
| `dataModelRequirements.json` | CIM/data model gaps |
| `useCaseProfiles.json` | Use case profile library |
| `goalPresets.json` | Crawl/Walk/Run goal presets |
| `goalAppSourceKnowledge.json` | Goal → app → source knowledge graph |
| `technicalAddons.json` | Technical add-on metadata |
| `splunkInstallationGuidance.json` | Install guidance snippets |

---

## Workshop and UI

| File | Purpose |
|------|---------|
| `sampleScenarios.json` | Load Example scenarios (e.g. Chuck Robbins retail) |
| `pathThemes.json` | Architecture path carousel themes |

---

## Governance

- **`catalogVersion.json`** — bump `appVersion` with app releases; add a line to `changeSummary` when catalog data changes materially.
- See [`docs/SIZING_METHODOLOGY.md`](../docs/SIZING_METHODOLOGY.md) for rate methodology.
- See [`docs/SOURCE_CATALOG_QA.md`](../docs/SOURCE_CATALOG_QA.md) for QA checklist.

Generated research workbook: `npm run gen:research-sheet` → `../splunk-scope-reference/docs/`.
