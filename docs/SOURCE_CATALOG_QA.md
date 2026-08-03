# Source catalog QA rubric

Use this checklist when reviewing or fixing a single entry in `src/data/sources.json` and its satellite files. Run automated gates first:

```bash
npm run validate:catalog
npm run validate:measurement
```

## Per-source checklist

| # | Check | Where to look |
|---|--------|----------------|
| 1 | **Description** is accurate, vendor-neutral, ≥20 characters | `sources.json` → `description` |
| 2 | **Why it matters** is customer-outcome language, not a copy of description | `whyItMatters` |
| 3 | **Primary sizing input** matches formula and form fields | `sizing_formula.primary_input`, `input_fields[].key` |
| 4 | **Every input field** has a clear `label` and helpful `helper` where needed | `input_fields` |
| 5 | **Measurement question** matches counting guidance | `sourceMeasurementQuestions.json`, `sourceCountingMethods.json` → `customerQuestion`, `howToCount` |
| 6 | **Unit label** matches what you count (not placeholder “active users” on non-user sources) | `primaryInputField`, `unitLabel`, `primaryUnit` |
| 7 | **Example quantity** is realistic for the unit (not default 2500 everywhere) | `exampleQuantity` |
| 8 | **Sizing rates** align with `sizingRates.json` bands (no order-of-magnitude drift) | `sizingRate`, `sizingRates.json` |
| 9 | **Splunk apps / TAs** listed without duplicates | `splunkApps`, `technicalAddons` |
| 10 | **Telemetry domains** consistent with log capabilities | `telemetryDomains`, `sourceLogCapabilities.json` |
| 11 | **Overlap peers** documented for workshop double-count conversations | overlap section / `sourceOverlapPeers.json` |

## Priority order for manual pass

1. Sources with `needsReview: true` in `sizingRates.json`
2. Cloud/SaaS: `cspm`, `cwpp`, `iaas`, `casb`, `saas_*`
3. Network / identity / endpoint: `firewalls`, `active_directory`, `edr`, `vpn`
4. Remaining catalog IDs alphabetically

## Sync helper

After editing `sizing_formula.primary_input` in the catalog:

```bash
node scripts/syncMeasurementFromCatalog.mjs --write
npm run validate:measurement
```

## Sign-off sample (10-source spot audit)

Record date and initials when these pass UI + validator:

- [ ] cspm
- [ ] iaas
- [ ] firewalls
- [ ] edr
- [ ] saas_office
- [ ] saas_crm
- [ ] netflow
- [ ] active_directory
- [ ] vuln_mgmt
- [ ] iaas_containers
