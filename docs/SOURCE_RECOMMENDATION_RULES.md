# Source Recommendation Rules

**Version:** 1.1.0  
**Last updated:** 2026-06-01  
**Config:** `src/data/sourceRecommendationRules.json`  
**Engine:** `src/services/sourcePrioritizationEngine.js`

## Purpose

The Data Sources page ranks catalog sources by customer relevance—not static catalog order. Each source receives an internal **priority score (0–100)** and a customer-facing **label**. Scores are not shown in the UI by default.

## Labels

| Label | When used |
|-------|-----------|
| **Suggested** | Strong alignment with selected apps, use cases, goals, and uncovered capability gaps |
| **Optional** | Useful enrichment; not necessary for current scope, or budget-constrained planning |
| **Redundant** | Another configured source likely satisfies the same need |
| **Needs Review** | Vendor, logging scope, overlap, or count is unknown |

Legacy internal classifications (`required`, `recommended`, `unnecessary`) map to these four labels. **Required** is not shown on the Data Sources page unless the app literally cannot function without that source.

## Scoring factors

1. **Selected Splunk apps** — `appCapabilityMappings` boosts sources and capabilities per app (e.g. Enterprise Security → identity, network, endpoint, asset context).
2. **Use cases** — `sourceUseCaseMappings.json` relevance (high/medium/low) plus `useCaseCapabilityHints`.
3. **Customer goals / notes** — `interpretationKeywords` in rules JSON match freeform intake text.
4. **Deployment type** — `deploymentWeights` (on-prem, cloud, hybrid) boost or de-emphasize source IDs. Cloud deployment alone does **not** promote CSPM/CWPP/CASB/IaaS unless cloud security keywords or use cases are in scope.
5. **Budget sensitivity** — Annual opportunity budget converts to GB/day bands (`low` / `medium` / `high`) via `budgetEngine.js`. No pricing is shown to customers.
6. **Configured sources** — `substitutionRules` downgrade overlapping sources when a primary source is active.
7. **Capability gaps** — `sourceRequirementEngine` gap closure increases score and can promote to Suggested.
8. **Ingest efficiency** — High-volume sources penalized on low budget; compact sources favored when they satisfy the same need.
9. **Overlap** — `overlapEngine` + user decisions; unresolved overlap → Needs Review; confirmed dedup → Redundant.

## Sort order

Within each category (and in **Top Suggested Sources**):

1. Suggested  
2. Needs Review  
3. Optional  
4. Redundant  

Within each group: priority score descending.

Category tabs are ordered by the sum of top source scores in each category (`rankCategoriesByRelevance`).

## Configuration reference

### Budget bands

| Band | Threshold (GB/day) | Behavior |
|------|-------------------|----------|
| low | ≤ 60 | Boost minimum-viable sources; penalize enrichment |
| medium | 61–149 | Balanced (default when no budget) |
| high | ≥ 150 | Allow broader enrichment |

### Minimum viable sources (low budget)

`firewalls`, `active_directory`, `edr`, `windows_servers`, `desktops`

### Enrichment sources (down-ranked on low budget)

`vuln_mgmt`, `asset_cmdb`, `dns`, `dhcp`, `netflow`, `proxy`, `sase`, `ndr`, `threat_intel`, `email`, `business_txn`

### Substitution rules (overlap)

When a primary source is configured, overlapping feeds are downgraded (see full list in `sourceRecommendationRules.json`):

| Primary configured | Downgraded | Typical label |
|--------------------|------------|---------------|
| `firewalls` | `ids_ips` | Redundant |
| `firewalls` | `ndr` | Optional |
| `edr` | `av_edr_legacy`, `cwpp` | Optional |
| `active_directory` | `sso_pam`, `windows_servers` | Optional |
| `saas_sso` / `sso_pam` | `active_directory` | Optional |
| `saas_office` | `saas_sso` | Optional |
| `proxy` / `sase` / `casb` | each other | Optional |
| `netflow` / `ndr` | each other | Optional |
| `dns` | `windows_servers` | Optional |
| `cspm` / `iaas` / `cwpp` / `casb` / `cloud_storage` | each other | Optional / not Suggested unless cloud security in scope |

### Cloud-only sources (default deemphasis)

When intake does **not** mention cloud security, CSPM, CWPP, CASB, IaaS control plane, or SaaS cloud monitoring:

- `cloudOnlySourceIds` receive a score penalty in `sourcePrioritizationEngine.js`
- They should not appear in **Top Suggested** for SIEM/on-prem narratives (e.g. Northstar Regional Logistics)

Explicit cloud-security signals (`cloudInScopeKeywords`, `cloudInScopeUseCaseIds`) lift the penalty.

Budget band `overlapStrictness` tightens penalties on **low** budget.

## UI surfaces

- **Top Suggested Sources** — Up to **3** highest-scoring Suggested sources (`topSuggestedLimit` in rules JSON).
- **Source cards** — Badge + customer-safe reason line (`SourceGridCard.jsx`).
- **Configure drawer** — Same label and reason when configuring a source.

## Tests

Vitest suite `Source Prioritization Engine` in `src/services/engines.test.js` covers:

- Low-budget on-prem SIEM prioritization  
- **Northstar SIEM** — identity/endpoint/network above cloud-only sources  
- **Cloud in scope** — CSPM suggested only when cloud security explicitly stated  
- Firewall → IDS/IPS downgrade  
- AD → SSO downgrade  
- High-budget ES enrichment  
- Label sort order  
- Top Suggested filtering  
- Needs Review on unresolved overlap  
- Budget band mapping  

## Updating rules

Edit `src/data/sourceRecommendationRules.json` only—avoid hardcoding source logic in React components. After changes, run:

```bash
npm test
node src/tests/engineTests.js
```
