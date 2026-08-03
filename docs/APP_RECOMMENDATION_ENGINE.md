# App Recommendation Engine

Splunk Scope uses a dedicated **app/product recommendation layer** so Interpretation, exports, and the source library agree on which Splunk products, apps, add-ons, and readiness items to suggest.

## Purpose

Replace static `primaryUseCase.splunkApps` copy with deterministic recommendations driven by:

- Structured and custom use cases (multi-intent, not a single profile)
- `desiredApps` selections
- Configured / planned data sources and vendors
- Deployment type and budget sensitivity
- Crawl / walk / run maturity
- Telemetry and CIM readiness

All logic runs **locally** in the browser — no external API calls.

## Data model

### Canonical catalog — `src/data/appCatalog.json`

Single source of truth for product metadata. Each entry includes:

| Field | Role |
|-------|------|
| `id` | Canonical app id (used in `desiredApps`, engine output) |
| `displayName` / `shortName` | Customer-facing labels |
| `type` | `premium_solution`, `free_app`, `splunkbase_app`, `technical_addon`, `connector`, `prerequisite`, `content_pack` |
| `category` / `productFamily` | Grouping for rules and UI badges |
| `maturityFit` | crawl / walk / run alignment |
| `splunkbaseCatalogId` | Link into `splunkbaseCatalog.json` (null if unverified) |
| `legacyIds` | Maps old intake ids and aliases |
| `intentTriggers` / `keywordTriggers` / `sourceTriggers` | Scoring inputs |
| `minimumUsefulSources` / `requiredCapabilities` | Readiness checks |
| `requiresApps` | Dependencies (e.g. CIM for ES) |
| `needsExternalValidation` | Conservative flag when packaging/entitlement is uncertain |

### Engine output groups

`recommendApps()` returns:

- **recommendedSolutions** — Premium solutions (ES, ITSI, Observability Cloud, etc.)
- **helpfulApps** — Free / Splunkbase apps (SSE, InfoSec, Cisco Networks App)
- **technicalAddons** — TAs and connectors (Windows, CrowdStrike, Cisco ASA, …)
- **dependencies** — Prerequisites and content (CIM, ESCU)
- **suppressed** — Gated/deferred items with reason codes (SE-facing in `customerReason` on suppressed entries)
- **needsReadiness** — Solutions with telemetry gaps

Each visible item includes `customerReason`, `phase`, `fit`, `readinessWarnings`, and `splunkbaseLinkStatus` / `customerUrl` when verified.

## Algorithm (10 steps)

1. **Normalize inputs** — intake, `sourceStatuses`, profiles, budget band, deployment.
2. **Intent profile** — Weighted scores across ~20 intent categories (SIEM, IR, observability, ML, etc.).
3. **Candidate set** — All catalog apps scored; explicit `desiredApps` always considered.
4. **Hard gates** — Cloud, Cisco, ITSI, Observability, SOAR, UBA, MLTK/AITK/DSDL, ES Premier, ISE-specific, etc.
5. **Maturity ladder** — Crawl/low budget → SSE/InfoSec; defer ES/SOAR/UBA unless explicit or strong SIEM intent.
6. **Telemetry readiness** — Compare `minimumUsefulSources` to current/future sources; attach warnings.
7. **Scoring** — Intent fit, sources, budget, maturity, readiness, explicit selection boost.
8. **Categorize** — By `type`; never mix TAs into `recommendedSolutions`.
9. **Explainability** — Human-readable `customerReason` per item (no raw scores in UI).
10. **Shared output** — Same engine for Interpretation, PDF, PPTX, startup guide, source modal.

## Key decision rules

### Security

| Product | When recommended | When deferred |
|---------|------------------|---------------|
| Security Essentials / InfoSec | Crawl, foundational security, low budget | — |
| Enterprise Security | Explicit selection or strong SIEM + identity/network/endpoint (current or planned) | Light security-only crawl without telemetry |
| ES Premier / Mission Control | Run maturity + high budget or explicit selection | Default; `needsExternalValidation` where uncertain |
| SOAR | IR/automation intent or explicit; needs ES/detections readiness | Crawl without IR intent |
| UBA | Insider/risk/UEBA intent or explicit | No identity/behavior use case |
| CIM / ESCU | Dependencies when ES is recommended | Not shown as “apps to buy” |

### AI / ML

- **MLTK** — Anomaly, forecasting, baselining, explicit MLTK language (not generic “AI”).
- **AITK** — Explicit AITK/assistant interest only.
- **DSDL** — Advanced data science workloads only.

### Observability / IT

- **ITSI** — Service health, KPI, NOC, IT Ops intent.
- **Observability Cloud / APM / IM / RUM / Synthetics** — Observability or cloud-native intent; not default for SIEM-only.
- **On-Call** — Alert routing / on-call / SRE escalation in scope.
- **AppDynamics** — AppDynamics/Cisco APM context only.

### Cloud / Cisco

- AWS/Azure/GCP/M365 add-ons — Cloud sources or cloud security/ops in scope.
- Cisco add-ons — Cisco vendors/sources or explicit selection; ISE TA only when ISE/NAC is in scope.

## App vs add-on distinction

Customer-facing Interpretation section **Suggested Splunk Products** uses four subsections. Technical add-ons are never labeled as premium solutions.

## Adding a new product

1. Add a stanza to `src/data/appCatalog.json` with correct `type`, triggers, sources, and gates.
2. Set `splunkbaseCatalogId` only if verified in `splunkbaseCatalog.json`; otherwise `needsExternalValidation: true`.
3. Add `legacyIds` for intake multi-select compatibility.
4. Add scenario tests in `src/services/engines.test.js` under **App recommendation engine**.
5. Run `npm test` and `npm run build`.

## Validating product metadata

- Cross-check Splunkbase id/status via `splunkbaseCatalog.js`.
- Do not invent packaging or entitlement claims — use `needsExternalValidation` and customer-safe caveats.
- Deprecated entries should use `replacementPreferred` links only.

## Examples

**Light security (crawl):** SSE and/or InfoSec in Helpful Apps; ES/SOAR/UBA suppressed.

**ES + planned AD/firewall/EDR:** ES in Recommended Solutions; CIM in Dependencies; CrowdStrike TA under Technical Add-ons.

**Northstar sample:** ES (explicit), MLTK (walk goal), Cisco ASA/network add-ons when Cisco sources configured.

## SME intake (product and source truth)

When catalog gates or source minimums need field validation, see archived SME worksheets in [`archive/APP_CATALOG_SME_INTAKE.md`](./archive/APP_CATALOG_SME_INTAKE.md) and [`archive/APP_SOURCE_USE_CASE_MATRIX.md`](./archive/APP_SOURCE_USE_CASE_MATRIX.md) (historical). Current truth: `appCatalog.json` and Vitest scenarios in `engines.test.js`.

## Files

| File | Role |
|------|------|
| `src/data/appCatalog.json` | Product metadata |
| `src/services/appCatalogService.js` | ID resolution, lookup helpers |
| `src/services/appRecommendationEngine.js` | Recommendation engine |
| `src/components/ProductRecommendationsPanel.jsx` | Interpretation UI |
| `src/services/interpretationEngine.js` | Attaches `appRecommendations` |
| `src/services/reportExportEngine.js` | Export payload `productRecommendations` |

Legacy `useCaseProfiles[].splunkApps` remains for fallback documentation only — **not** the primary recommendation source.
