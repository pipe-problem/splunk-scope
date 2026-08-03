# App Recommendation Logic Audit

**Date:** 2026-06-02  
**Scope:** Read-only discovery — no logic changes in this pass  
**Codebase:** Splunk Scope v2 (`src/`, `docs/`)

> **Remediation status (2026-06-02):** The findings below describe the **pre-engine** baseline. A follow-up implementation addressed most customer-facing app recommendation gaps. Use these docs for **current** behavior:
>
> | Topic | Current reference |
> |-------|-------------------|
> | Engine and algorithm | [`APP_RECOMMENDATION_ENGINE.md`](./APP_RECOMMENDATION_ENGINE.md) |
> | Catalog | `src/data/appCatalog.json` |
> | Implementation | `src/services/appRecommendationEngine.js` |
> | UI | `ProductRecommendationsPanel` on Interpretation (not legacy `suggestedApps` list) |
> | Tests | 18 scenarios in `src/services/engines.test.js` — **App recommendation engine** |
> | SME input still needed | [`APP_CATALOG_SME_INTAKE.md`](./APP_CATALOG_SME_INTAKE.md), [`APP_SOURCE_USE_CASE_MATRIX.md`](./APP_SOURCE_USE_CASE_MATRIX.md) |
>
> **Still open after remediation:** `appRequirements.json` thin coverage (SSE/InfoSec/MLTK); CIM % hard-suppress for ES; `useCaseProfiles.json` legacy `splunkApps` strings (profile copy only); source `scoreAppAlignment` / `classifySource` app id normalization (fixed in code — see changelog in repo); product packaging facts in audit appendix require Splunk SME sign-off.

---

## Executive Summary

> **Historical (2026-06-02 discovery).** Superseded for Interpretation/export product picks by `appRecommendationEngine.js`. Retained for traceability and remaining gap analysis.

**Overall assessment: WEAK to MODERATE for product-accurate app recommendations; MODERATE for source prioritization influenced by apps.**

Splunk Scope has **two separate concepts** that are easy to conflate:

1. **“Recommended Splunk apps” (Interpretation page)** — Static display strings from the **single primary use-case profile**, chosen by **keyword scoring** over intake narrative. User-selected `desiredApps`, secondary resolved profiles, budget, deployment type, and configured sources **do not drive this list**.
2. **Source relevance / capability gaps** — Weighted scoring that **uses** `desiredApps` and use-case domains to rank **data sources**, not to recommend Splunk products.

There is **no dedicated app recommendation engine**. Product picks are largely **curated copy in `useCaseProfiles.json`**, with partial downstream hooks in `appRequirements.json`, `sourceRecommendationRules.json`, and `logRequirementEngine.js` — but those hooks mostly affect **sources**, and several mappings are **incomplete or ID/name mismatched**.

The app **does not distinguish** ES vs ES Premier, InfoSec vs ES maturity, SSE vs ES licensing, SOAR vs ES prerequisites, ML experimentation vs production analytics, Observability Cloud vs Splunk Enterprise, or add-ons vs premium apps in the Interpretation UI. **ES Premier, Splunk On-Call, and ES Premier-tier packaging are not represented anywhere in the codebase.**

Keyword matching is **broad** (e.g. generic `"security"` → foundational profile; `"ai"` → AI/ML profile), which can over-recommend heavy products (ES, MLTK) for light intents.

---

## Current Flow

### End-to-end path (intake → customer-facing app text)

```
IntakePage (user input)
  ├─ useCases[]           → structured profile names
  ├─ customUseCases       → freeform text
  ├─ desiredApps[]        → multi-select from splunkApps.json (app ids)
  ├─ deploymentType       → cloud | onprem | hybrid
  ├─ opportunityBudgetUsd → budget band (via budgetEngine)
  ├─ crawl/walk/run goals, discoveryNotes, goals, summary
  └─ context import       → contextImportEngine.js (regex extraction)

InterpretationPage
  └─ interpretInputs(intake)                    [interpretationEngine.js]
       ├─ collectNarrative() → tokenize all text fields (+ desiredApps ids as tokens)
       ├─ scoreProfiles(tokens, deploymentType)  → RULES[] keyword weights
       ├─ pickPrimaryUseCase(scores)             → ONE profile (highest score; default foundational_security)
       ├─ resolveUseCases(intake)                → structured + freeform profiles (NOT used for suggestedApps)
       └─ suggestedApps = primaryUseCase.splunkApps[]   ← ONLY output for "Recommended Splunk apps"

SourceWorkflowPage / ReviewPage
  └─ resolveUseCaseProfiles(intake)             [useCaseResolver.js]
  └─ classifyAndSortSources(..., desiredApps)   [sourceRecommendationEngine.js → sourcePrioritizationEngine.js]
       ├─ resolveLogRequirements(useCases, desiredApps)     [logRequirementEngine.js]
       ├─ classifySourceByCapability(...)                   [sourceRequirementEngine.js]
       ├─ scoreAppAlignment(desiredApps, useCases)          [sourcePrioritizationEngine.js]
       ├─ scoreSiemCoreBoost, scoreUseCaseRelevance, budget/deployment/overlap/keywords
       └─ Labels: suggested | optional | redundant | needs_review (sources, not apps)

CoveragePage
  └─ Uses desiredApps.includes('enterprise_security') for SIEM-focused domain set only

ReportPage / reportExportEngine.js
  └─ desiredAppLabels = resolveAppNames(intake.desiredApps)   ← user selections, NOT suggestedApps
  └─ Per-source splunkApps[] from sources.json in export rows

SourceReferenceLibraryPage / SourceInfoModal
  └─ Static source.splunkApps / technicalAddons from sources.json
  └─ resolveSplunkbaseLink() for verified Splunkbase URLs [splunkbaseCatalog.js]
```

### Functions and files (participation matrix)

| Stage | File | Key functions | Role for **apps** |
|-------|------|---------------|-------------------|
| Intake catalog | `src/data/splunkApps.json` | — | Selectable product list (ids, names, optional `catalogId`) |
| Use-case → app copy | `src/data/useCaseProfiles.json` | — | **`splunkApps[]` display names** per profile (21 profiles) |
| Interpretation | `src/services/interpretationEngine.js` | `interpretInputs`, `scoreProfiles`, `pickPrimaryUseCase`, `parseCustomUseCases` | **Only place that sets `suggestedApps`** |
| Use-case resolution | `src/services/useCaseResolver.js` | `resolveUseCaseProfiles` | Feeds source engines; ignored for suggestedApps |
| Context paste | `src/services/contextImportEngine.js` | `parseCustomerContext`, `collectSplunkApps` | Regex → labels → IntakePage maps to `desiredApps` ids |
| App log/CIM reqs | `src/data/appRequirements.json` | — | ES, SOAR, ITSI, Observability, UBA only (5 apps) |
| Log capabilities | `src/data/logRequirements.json` | — | Legacy capability ids + old source keys |
| CIM models | `src/data/dataModelRequirements.json` | — | `requiredByApps` for ES/UBA |
| Source scoring rules | `src/data/sourceRecommendationRules.json` | — | `appCapabilityMappings` for 5 app **ids** |
| Source log caps | `src/data/sourceLogCapabilities.json` | — | Catalog source id → `*_events` capabilities |
| Log requirement merge | `src/services/logRequirementEngine.js` | `resolveAppRequirementKey`, `resolveLogRequirements` | Merges app + use-case capability tiers |
| Source classification | `src/services/sourceRequirementEngine.js` | `classifySourceByCapability` | Capability gaps + CIM flags on **sources** |
| Source prioritization | `src/services/sourcePrioritizationEngine.js` | `prioritizeSource`, `scoreAppAlignment`, `scoreSiemCoreBoost` | App ids → source boosts |
| Legacy domain classify | `src/services/sourceRecommendationEngine.js` | `classifySource` | `appMatch` via string set intersection |
| Splunkbase links | `src/data/splunkbaseCatalog.json`, `src/services/splunkbaseCatalog.js` | `resolveSplunkbaseLink` | URLs only; does not pick apps |
| TA catalog | `src/data/technicalAddons.json` | — | Add-ons with `catalogId`; not in Interpretation suggestedApps |
| Export | `src/services/reportExportEngine.js` | `buildReportExportPayload`, `resolveAppNames` | PDF/PPT shows **user `desiredApps`**, not suggestedApps |
| UI | `src/pages/InterpretationPage.jsx` | — | Renders `result.suggestedApps` (max 8) |
| UI | `src/pages/IntakePage.jsx` | — | `desiredApps` multi-select |
| Tests | `src/services/engines.test.js`, `src/tests/engineTests.js` | — | Source scoring + log reqs; **no suggestedApps matrix** |

### Inputs used vs ignored (for **app recommendations**)

| Input | Used for suggestedApps? | Used elsewhere? |
|-------|-------------------------|-----------------|
| Structured `useCases[]` | **No** (only via narrative token overlap if names appear in text) | Source/domain scoring via `resolveUseCaseProfiles` |
| `customUseCases` | **Yes** (keyword rules) | Same |
| `desiredApps[]` | **No** (tokens only; does not change primary profile unless id strings match keywords) | Source prioritization, log requirements, exports |
| `deploymentType` | **Weak** (+2 to `cloud_security` profile if "cloud" in type) | Deployment weights for sources |
| Budget / opportunity $ | **No** | Budget band → source penalties/boosts |
| Configured sources (`state.sources`) | **No** | Capability gaps, overlap, sizing |
| `discoveryNotes`, crawl/walk/run goals | **Yes** | Source keyword boosts |
| SOC size / maturity | **No explicit field** | — |
| CIM / data model readiness | **No** for app pick | Partial for source capability satisfaction |
| Vendor selections (Cisco, etc.) | **Only if mentioned in text** | Cisco keyword → network source boosts |

---

## Current Data Model

### 1. `splunkApps.json` — intake multi-select catalog

- **Structure:** `{ category, apps: [{ id, name, shortName?, description, catalogId?, needsReview? }] }`
- **~60 entries** across Security, Observability, Platform, AI/ML, Compliance, Cloud/SaaS, OT, Other
- **Purpose:** User declares interest; drives `intake.desiredApps[]` (ids)
- **Not used** to auto-recommend on Interpretation page

### 2. `useCaseProfiles.json` — primary app recommendation source

- **21 profiles**, each with:
  - `requiredDomains` / `recommendedDomains` (telemetry domains)
  - **`splunkApps[]`** — human-readable product names (mixed apps + add-ons)
  - `technicalAddons[]`, `minimumSources`, `suggestedSources`, crawl/walk/run copy
- **Interpretation uses only `splunkApps` from the single primary profile**

### 3. `appRequirements.json` — partial app → log/CIM contract

- **Only 5 apps:** `splunk_enterprise_security`, `splunk_soar`, `itsi`, `splunk_observability`, `splunk_uba`
- Fields: `requiredLogCapabilities`, `recommendedLogCapabilities`, `requiredDataModels`, `cimRequired`, footprint notes
- **`security_essentials` explicitly maps to `null`** in `logRequirementEngine.js` (`APP_KEY_ALIASES`)
- **No entries** for InfoSec App, MLTK, AITK, DSDL, Mission Control, SSE catalog entry, Cisco apps, cloud TAs

### 4. `sourceRecommendationRules.json` — app → source boosts

- `appCapabilityMappings` keys: `enterprise_security`, `infosec_app`, `security_essentials`, `cisco_networks_app`, `machine_learning_toolkit`
- Weights in `scoreWeights.appAlignment` (18 max contribution to 0–100 source score)
- **Does not recommend apps** — only boosts sources when app ids match

### 5. `splunkbaseCatalog.json` — link metadata

- Generated from seed; `catalogId` on apps/TAs
- `status`: verified | needsReview | deprecated | replacementPreferred
- **SOAR, UBA, Mission Control:** needsReview (no customer-safe Splunkbase URL)

### 6. Identifier fragmentation (critical)

Three parallel naming schemes:

| Layer | Example ES | Example MLTK |
|-------|-----------|--------------|
| `splunkApps.json` id | `enterprise_security` | `machine_learning_toolkit` |
| `useCaseProfiles.splunkApps` | `"Splunk Enterprise Security"` | `"Splunk Machine Learning Toolkit"` |
| `appRequirements.json` key | `splunk_enterprise_security` | *(missing)* |
| `sources.json` splunkApps | `"Enterprise Security"` / full names | varies |

`scoreAppAlignment()` adds **use-case display names** to a set keyed as `appId`, but `appCapabilityMappings` expects **intake ids** → **mapping often misses** for profile-driven names.

`classifySource()` `appMatch` compares `desiredApps` ids with `source.splunkApps` display strings → **often false** unless strings accidentally match.

---

## App-by-App Findings

**Legend — Confidence:** Strong = purpose + triggers + deps aligned; Weak = listed but logic shallow; Missing = not in recommendation path.

| App/Product | Type | Defined In | Current Trigger Logic | Source Dependencies | Data Model Dependencies | Confidence | Issues |
|-------------|------|------------|----------------------|---------------------|-------------------------|------------|--------|
| Splunk Enterprise Security | Premium SIEM | `splunkApps.json`, profiles, `appRequirements` | Primary profile if keywords: siem, soc, enterprise security; **foundational_security profile also lists ES** | `appCapabilityMappings.enterprise_security`; ES log reqs | CIM: Authentication, Network_Traffic, Endpoint, Intrusion_Detection | **Weak** | No ES vs InfoSec/SSE gate; no CIM readiness check before recommend; foundational profile recommends ES for "security" keyword |
| ES Premier | Premium tier | **Not represented** | — | — | — | **Missing** | No SKU/tier concept |
| Splunk InfoSec App | Free/entry app | `splunkApps.json` only | User manual select; `infosec_app` in source rules | `appCapabilityMappings.infosec_app` | None in appRequirements | **Missing** | **Not in any profile `splunkApps`**; foundational profile says ES+SSE, not InfoSec |
| Splunk Security Essentials (SSE) | Free content app | `splunkApps.json`, `splunkbaseCatalog`, profiles | `foundational_security` profile; user select | `appCapabilityMappings.security_essentials` | **`resolveAppRequirementKey` → null** | **Weak** | Listed alongside ES in same profile; no "SSE before ES" logic |
| Splunk SOAR | Premium automation | `splunkApps.json`, profiles, partial `appRequirements` | `enterprise_security` profile string; context import regex | SOAR app reqs empty required caps | None | **Weak** | No ES prerequisite; Splunkbase needsReview; not gated on SOC maturity |
| Splunk UBA / UEBA | Premium analytics | `splunkApps.json`, profiles, `appRequirements` | `risk_based_alerting` profile; keyword "ueba" | UBA log reqs | Authentication CIM | **Weak** | Splunkbase needsReview; no peer with ES RBA distinction |
| Splunk Mission Control | Premium SOC UI | `splunkApps.json`, `threat_detection` profile | Profile string only | None | None | **Missing** | needsReview; no decision logic |
| Splunk Attack Analyzer | Security app | `splunkApps.json`, `threat_detection` profile | Profile copy only | None | None | **Weak** | No Splunkbase catalogId on intake entry |
| Splunk Machine Learning Toolkit | Free ML app | `splunkApps.json`, `ai_ml_analytics` profile | Keywords: mltk, machine learning, **ai**, anomaly, predictive | `appCapabilityMappings.machine_learning_toolkit` | None | **Weak** | **`catalogId` points to Splunk AI Toolkit (5413)** — conflates MLTK/AITK; keyword "ai" is overly broad |
| Splunk AI Toolkit (AITK) | Platform AI | `splunkApps.json` (`ai_toolkit`) | Not in profile lists by default; MLTK shares catalogId | None | None | **Weak** | Product boundary vs MLTK unclear in data |
| App for Data Science & Deep Learning (DSDL) | Community/ext ML | `splunkApps.json`, `ai_ml_analytics` profile | Profile copy only | None | None | **Weak** | No readiness/minimum data volume |
| Splunk ITSI | Premium ITOM | `splunkApps.json`, IT ops profiles | Keywords: itsi, itops; profiles: it_operations, application_monitoring, etc. | `appRequirements.itsi` | Performance (recommended) | **Moderate** | Profiles overlap Observability Cloud; no KPI/service-model gate |
| Splunk Observability Cloud | SaaS observability | `splunkApps.json`, multiple profiles | Keywords: observability, apm, signalfx | `appRequirements.splunk_observability` | None (separate platform) | **Weak** | Treated like Splunk Enterprise app; no "data goes to O11y not indexes" UX on Interpretation |
| Splunk APM | O11y module | `splunkApps.json`, `observability_apm` profile | Profile + APM keywords | Via Observability reqs | None | **Weak** | Not separated from Enterprise/Splunk Cloud ingest path |
| Splunk Infrastructure Monitoring | O11y module | `splunkApps.json`, profiles | Profile strings | None dedicated | None | **Weak** | Same |
| Splunk Synthetic Monitoring | O11y module | `splunkApps.json`, digital_experience profile | Profile copy | None | None | **Weak** | Same |
| Splunk RUM | O11y module | `splunkApps.json`, profiles | Keywords: rum, digital experience | None | None | **Weak** | Same |
| Splunk Log Observer | O11y module | `splunkApps.json` | Profile technicalAddons reference | None | None | **Missing** | Not in suggestedApps lists |
| Splunk On-Call | Incident response | **Not represented** | — | — | — | **Missing** | — |
| AppDynamics Integration | APM (Cisco) | `splunkApps.json` | User select only | None | None | **Missing** | Catalog has `cisco_appdynamics_addon`; no Cisco/AppDynamics trigger |
| Splunk App for AWS / Azure / GCP / M365 | Cloud apps/TAs | `splunkApps.json`, `cloud_security` profile | Cloud keywords + cloud_security profile | Cloud source boosts when in scope | Partial via domains | **Moderate** | Generic `cloud_*_apps` bucket entries; IaaS vs SaaS not distinguished in app pick |
| Cisco Security Cloud | Cisco suite | `splunkbaseCatalog` | Duo replacementPreferred → 7404 | None for app recommend | None | **Missing** | Not in splunkApps intake list as first-class id |
| App for Cisco Network Data | Splunkbase app | `splunkApps.json` (`cisco_networks_app`) | `network_operations` profile; user select | `appCapabilityMappings.cisco_networks_app` | None | **Moderate** | Cisco keyword boosts **sources**, not app chip |
| Cisco ASA / ISE / Secure Firewall TAs | TAs | `technicalAddons.json`, nested under Security in splunkApps | User select / source static metadata | Source `technicalAddons` | None | **Weak** | Mixed into "Recommended apps" UI when profile lists add-ons |
| Splunk Add-on for Windows/Unix/etc. | TA | profiles' `splunkApps` strings | Profile copy | TA in startup guide | None | **Weak** | **Displayed as "apps" on Interpretation** |
| Splunk CIM / ES Content Update | Content | **Not in splunkApps intake** | — | — | ES dependency (needs external validation) | **Missing** | No explicit CIM app recommendation before ES |
| Splunk DB Connect | Connector | profiles, splunkApps | Profile strings | None | None | **Weak** | App vs TA confusion |
| Splunk Stream | Wire data | `splunkApps.json`, profiles | Profile / context import | None | None | **Moderate** | catalogId verified |
| OT apps (Industrial Asset Intelligence, etc.) | OT | profiles | `ot_ics_security` keywords | OT sources | None | **Moderate** | Product names in profile need external validation |
| Compliance apps (PCI, HIPAA, SOX) | Compliance | splunkApps Compliance category | `compliance_audit` keywords | Domain-based sources | Partial | **Weak** | Duplicated PCI entries (`app_pci_compliance` vs `pci_compliance`) |

---

## Security App Decision Logic (detailed)

### How ES vs InfoSec vs SSE vs Premier is decided today

| Question | Current behavior |
|----------|------------------|
| InfoSec vs ES | **Not decided.** InfoSec App is intake-selectable but **never appears in `useCaseProfiles[].splunkApps`**. Foundational profile recommends **ES + Security Essentials**, not InfoSec. Generic keyword `"security"` (weight 1) can still win foundational profile, which includes **ES**. |
| ES Premier vs ES | **Not represented.** No Premier SKU, bundle, or entitlement logic. |
| When SSE? | **`foundational_security` profile** always includes SSE in `splunkApps`. User can select `security_essentials` in intake. No rule prevents also showing ES. |
| When SOAR? | **`enterprise_security` and `threat_detection` profiles** list SOAR in copy; keyword "soc"/"incident response" steers toward enterprise_security. **No check** for ES maturity, notable volume, or playbook ownership. |
| UEBA vs ES RBA | **`risk_based_alerting` profile** lists ES + UBA. Keyword "ueba"/"insider" maps to this profile. **No** distinction between ES built-in RBA vs UBA SKU. |
| Mission Control | **`threat_detection` profile** includes string `"Mission Control for Splunk"`. No other logic. |
| SOC size / maturity | **Not modeled.** No fields for team size, tier-1/2/3, runbooks, or greenfield vs ES migration. |
| CIM / data model readiness | **`appRequirements.splunk_enterprise_security`** defines required models and `cimRequired: true`, used in **`resolveLogRequirements`** for **source** gap analysis only. **Interpretation does not suppress ES** when CIM is not ready. |

### Keyword rules affecting security (interpretationEngine.js RULES)

- `enterprise_security` profile: siem, enterprise security, soc, incident response, … (weight 2)
- `foundational_security` profile: **security, infosec, detection, alert, ransomware, threat** (weight 1)
- `threat_detection`: threat hunting, mitre, forensics, … (weight 3)
- `risk_based_alerting`: ueba, insider, risk-based, … (weight 3)

**Problem:** Low-weight generic "security" still defaults primary profile to foundational, which **includes ES in splunkApps** — so lightweight intents get ES chips.

---

## Analytics / AI / ML Decision Logic

| Question | Current behavior |
|----------|------------------|
| MLTK vs AITK vs DSDL | **`ai_ml_analytics` profile** lists MLTK + DSDL + Observability + Enterprise. MLTK intake entry uses **`catalogId: splunk_ai_toolkit`**. No separate AITK recommendation path. |
| Keyword triggers | `"ai"`, `"mltk"`, `"anomaly detection"`, `"predictive"`, `"forecasting"`, `"correlation"` (weight 2) → ai_ml_analytics |
| Production vs experiment | **Not distinguished.** Same profile for POC and production. |
| Data readiness | **`appCapabilityMappings.machine_learning_toolkit`** boosts edr, AD, firewalls — **source-side only**. No minimum history, event volume, or field quality checks. |
| MLTK too casual? | **Yes.** Single keyword `"ai"` or `"correlation"` can surface MLTK in suggestedApps via profile selection. |

---

## Observability / IT / Platform Decision Logic

| Question | Current behavior |
|----------|------------------|
| IT Ops vs Observability vs APM | Separate profiles (`it_operations`, `infrastructure_monitoring`, `application_monitoring`, `observability_apm`, `digital_experience`) with overlapping **`splunkApps`** (ITSI + Observability Cloud appear together frequently). |
| ITSI gating | Keywords `"itsi"`, `"uptime"`, `"availability"`. **No** requirement for service definitions, KPI models, or entity inventory. |
| Observability Cloud vs Enterprise | **`appRequirements.splunk_observability`** notes SaaS/OTEL path, but Interpretation **does not explain** split ingest model. |
| AppDynamics | Intake entry `appdynamics_integration`; **not** tied to Cisco/AppDynamics keywords. |
| ServiceNow | Referenced in `risk_based_alerting` profile TA string; TA in `technicalAddons.json`. **Not** in appCapabilityMappings. |
| On-Call | **Not present.** |

---

## Cloud / SaaS Decision Logic

| Mechanism | Behavior |
|-----------|----------|
| Cloud apps in suggestedApps | **`cloud_security` profile** lists AWS App, Microsoft Cloud TA, GCP TA, ES. Triggered by cloud security keywords or deploymentType containing "cloud" (+2 cloud_security score). |
| Cloud-only sources | `sourceRecommendationRules.cloudOnlySourceIds` penalized unless `isCloudSecurityInScope()` — **sources only**. |
| IaaS vs SaaS | **Domains** (`cloud_control_plane` vs `saas_activity`) in profiles; **not** reflected in separate app recommendations. |
| Cloud security vs observability | **cloud_security** vs **observability_apm** profiles separate by keywords, but user can get both if narrative matches multiple rule sets — **primary profile is single winner**. |
| CSPM/CWPP/CASB | Cloud keywords boost **sources** (`cspm`, `cwpp`, `casb`); AWS/Azure/GCP **apps** appear via cloud_security profile, not via selected CSPM sources alone. |

---

## Cisco-Related Decision Logic

| Mechanism | Behavior |
|-----------|----------|
| App recommendation | **`network_operations` profile** lists Stream, Cisco Networks Add-on, SNMP, ITSI. **No** `cisco_networks_app` unless that profile wins primary. |
| Keyword `"cisco"` | `interpretationKeywords` in source rules → boosts switches, routers, firewalls — **sources only**. |
| ASA vs FTD vs ISE vs Duo | **Not differentiated** at app layer. `add_on_cisco_security` intake name maps to ASA catalogId; Duo is **`replacementPreferred` → Cisco Security Cloud** in catalog. |
| AppDynamics | Separate intake entry; **no** auto-recommend from narrative. |
| User selected Cisco sources | Does **not** auto-add Cisco Network Data app to Interpretation suggestedApps. |

---

## Add-ons vs Apps

| Aspect | Current state |
|--------|---------------|
| Intake UI | Single multi-select **`splunkApps.json`** mixes premium apps, free apps, **and add-ons** (e.g. `add_on_aws`). |
| Interpretation UI | Section titled **"Recommended Splunk apps"** but renders **`useCaseProfiles.splunkApps`** strings that **include add-ons** (e.g. "Splunk Add-on for Microsoft Windows"). |
| technicalAddons.json | Separate TA catalog with `catalogId`; used in startup guide and source library — **not merged into suggestedApps logic**. |
| Content packs | Referenced in profile strings (e.g. ITSI content packs); not typed separately. |
| CIM dependency | Documented for ES in `appRequirements` / `dataModelRequirements`; **not** surfaced as "install CIM first" recommendation. |

**Conclusion:** **Yes — add-ons and premium apps are incorrectly mixed** in customer-facing "Recommended Splunk apps."

---

## Data Model / CIM Awareness

| Capability | Present? | Where | Used for app recommend? |
|------------|----------|-------|-------------------------|
| CIM field normalization | Documented | `appRequirements`, `dataModelRequirements` | **No** |
| ES acceleration / SH sizing | Notes in appRequirements | footprint notes | **No** |
| Required data models per app | Yes | appRequirements + dataModelRequirements | Source gaps only |
| Parsing / TA requirements | Implicit in sources.json TAs | startupGuideEngine | **No** for app list |
| Search head vs indexer placement | install guidance docs | splunkInstallationGuidance | Export disclaimers only |

---

## Source-to-App Dependency Logic

Apps influence **sources**, not the reverse (mostly):

| Driver | Effect |
|--------|--------|
| Use cases only | **Primary driver** for suggestedApps (profile copy). |
| desiredApps only | **No effect** on suggestedApps; strong effect on source scores. |
| Both | Log requirement merge in `resolveLogRequirements`. |
| Configured sources | Capability satisfaction can label sources **suggested**; **does not add/remove apps**. |
| Deployment type | Cloud gate for cloud-only **sources**; minimal profile scoring. |
| Budget | Low band penalizes enrichment **sources**; **does not downgrade** ES/MLTK suggestions. |

---

## Major Weaknesses (prioritized)

1. **No app recommendation engine** — Interpretation shows static profile strings, not a scored product fit.
2. **Single primary profile** — Ignores multi-select use cases and `desiredApps` for the main "Recommended Splunk apps" panel.
3. **ES over-recommendation** — Foundational/light security keywords still surface **Splunk Enterprise Security** (and often SOAR/MLTK in other profiles) without maturity or CIM gates.
4. **InfoSec App and ES Premier absent** from recommendation path; InfoSec not in foundational profile despite being the logical lightweight alternative.
5. **SSE bundled with ES** in foundational profile — no "SSE-only exploration" path.
6. **MLTK/AITK conflation** — shared `catalogId`; broad `"ai"` keyword triggers ML-heavy profile.
7. **ID vs display name fragmentation** — `scoreAppAlignment` and `classifySource` appMatch often **no-op** for profile-driven names.
8. **Dual capability taxonomies** — `logRequirements.json` legacy keys vs `sourceLogCapabilities.json` catalog ids → uneven capability confidence.
9. **security_essentials → null** in appRequirements — SSE cannot drive log requirement tiers.
10. **Add-ons shown as "apps"** on Interpretation page.
11. **Export shows desiredApps, Interpretation shows suggestedApps** — customer documents may disagree with UI.
12. **Premium Splunkbase gaps** — SOAR, UBA, Mission Control show "Link needs validation."
13. **No Splunk On-Call, ES Premier, CIM app, ESCU** in recommendation taxonomy.
14. **Observability Cloud treated as Splunk app** without deployment/ingest model separation.
15. **Cisco product differentiation** (ASA/FTD/ISE/Duo/AppDynamics) not reflected in app logic.
16. **No negative rules** ("do not recommend ES when…").
17. **No explainability** on Interpretation for *why* each app was suggested.
18. **Sample scenario Northstar** encourages ES + MLTK + Cisco for small budget — reinforces heavy stack.

---

## Data Gaps

Fields/artifacts needed for accurate recommendations:

| Gap | Why it matters |
|-----|----------------|
| `appTier` (free / premium / suite / SaaS) | ES vs SSE vs InfoSec vs Premier |
| `appCategory` (SIEM, SOAR, UEBA, ITOM, O11y, TA, content pack) | UI separation |
| `productFamily` | Enterprise vs Observability Cloud vs Cisco |
| `maturityLevel` (explore / adopt / run) | Crawl-walk-run alignment |
| `minimumMaturityForApp` | SOAR/ES/UBA gates |
| `requiredApps[]` / `incompatibleWith[]` | SOAR→ES, UBA→identity data |
| `requiredDataModels[]` (extended to all security apps) | CIM readiness messaging |
| `minimumUsefulSources[]` per app | Prevent empty ES recommendations |
| `recommendedSources[]` per app | Tie to catalog ids |
| `deploymentCompatibility` (Cloud Classic/Victoria, on-prem, hybrid) | Platform SKUs |
| `whenNotToRecommend[]` | Negative rules |
| `overlapNotes` (ITSI vs O11y vs IM) | Prevent duplicate stack |
| `customerDescription` vs `seNotes` | SE-only caveats |
| `officialDocsUrl` | Beyond Splunkbase |
| `budgetSensitivity` (low/medium/high) | Suppress premium on constrained deals |
| `socSizeBands` | Tier-1 only vs enterprise SOC |
| ES Premier / Mission Control / On-Call **catalog entries** | Complete product map |
| Unified **`appId` registry** | Single id across all JSON files |
| **`infosec_app` in appRequirements** | Parity with infosec_app source mapping |

---

## Recommended Target Data Model

### `appCatalog.json` (illustrative)

```json
{
  "version": "1.0.0",
  "apps": [
    {
      "id": "enterprise_security",
      "displayName": "Splunk Enterprise Security",
      "type": "premium_app",
      "category": "siem",
      "productFamily": "splunk_enterprise",
      "tier": "premium",
      "catalogId": "splunk_enterprise_security",
      "maturityBand": ["walk", "run"],
      "deployment": ["splunk_cloud", "enterprise_onprem"],
      "requiresApps": ["cim", "splunk_enterprise"],
      "recommendedWith": ["escu"],
      "incompatibleAsEntryPointFor": ["greenfield_no_soc"],
      "requiredDataModels": ["Authentication", "Network_Traffic", "Endpoint"],
      "cimRequired": true,
      "minimumUsefulSources": ["active_directory", "firewalls", "edr"],
      "recommendedSources": ["dns", "proxy", "threat_intel"],
      "whenNotToRecommend": [
        "No security use case selected",
        "Budget band low AND maturity explore-only",
        "Required CIM domains coverage < 40%"
      ],
      "alternativesLighter": ["security_essentials", "infosec_app"],
      "customerSummary": "Full SOC SIEM with correlation, notables, and RBA.",
      "seNotes": "Confirm ES license tier (Premier needs external validation)."
    }
  ]
}
```

### `appRecommendationRules.json`

```json
{
  "rules": [
    {
      "id": "security_maturity_ladder",
      "priority": 100,
      "when": { "anyUseCase": ["foundational_security"], "maturity": ["crawl", "explore"], "maxBudgetBand": "medium" },
      "recommend": ["security_essentials", "infosec_app"],
      "suppress": ["enterprise_security", "soar", "user_behavior_analytics"],
      "reason": "Lightweight security exploration before premium SIEM commitment."
    },
    {
      "id": "es_when_ready",
      "priority": 90,
      "when": { "anyUseCase": ["enterprise_security", "threat_detection"], "cimReadinessScore": { "gte": 0.6 } },
      "recommend": ["enterprise_security"],
      "reason": "SIEM use case with sufficient normalized telemetry for CIM-backed correlation."
    }
  ]
}
```

### Supporting files

- **`appDependencies.json`** — `requires`, `enhances`, `conflicts`, `splunkbase/install order`
- **`appMaturityProfiles.json`** — maps crawl/walk/run to allowed tiers
- **`appSourceRequirements.json`** — machine-readable min/recommended source ids per app
- **`appOutputCopy.json`** — customer-facing one-liners + SE caveats per app id

---

## Recommended Target Algorithm

1. **Normalize inputs** — Resolve use cases (structured + NLP), `desiredApps`, deployment, budget band, configured sources, optional maturity/SOC size from intake (new fields).
2. **Score use-case intents** — Keep keyword/structured signals but produce **multi-profile weights**, not only primary.
3. **Build candidate app set** — Union of: rule engine outputs, user `desiredApps`, profile-associated apps (weighted by profile score).
4. **Apply hard filters** — Deployment compatibility, `whenNotToRecommend`, cloud-in-scope for cloud TAs, Cisco apps only if Cisco vendors/sources/keywords present.
5. **Apply maturity ladder** — For low maturity/budget, promote SSE/InfoSec; suppress ES/SOAR/UBA unless explicit enterprise SIEM intent + budget.
6. **Check data readiness** — `resolveLogRequirements` + CIM coverage % from configured/planned sources; downgrade ES/UBA if below threshold; attach reason strings.
7. **Deduplicate & classify** — Split output into **Premium solutions | Splunkbase apps | Technical add-ons | Content packs**; never mix in one undifferentiated list.
8. **Resolve dependencies** — Add CIM/ESCU as prerequisites when ES recommended; add ES when SOAR recommended (configurable).
9. **Rank & cap** — Score = fit(use case) + fit(sources) + user interest − budget penalty; show top N with **explainability** bullet each.
10. **Sync exports** — PDF/PPT use same resolved list + reasons, not raw `desiredApps` alone.
11. **Splunkbase links** — `resolveSplunkbaseLink(catalogId)`; premium without listing → show product doc link + "contact account team" copy.

---

## Needed Tests

| Test case | Expected behavior (target) |
|-----------|---------------------------|
| Small InfoSec / crawl / low budget | **SSE and/or InfoSec** suggested; **not** ES Premier/ES/SOAR |
| Enterprise SIEM + strong source plan | ES suggested with CIM/ESCU prerequisite copy |
| ES without AD/firewall/EDR configured | ES flagged **needs readiness** or suppressed |
| Keyword "security" only | **Not** auto ES — SSE/InfoSec first |
| MLTK with no ML use case | **No** MLTK in suggested apps |
| ML/anomaly use case + metrics sources | MLTK suggested with data volume note |
| ITSI without service/KPI language | **No** ITSI (or IT ops profile only) |
| Observability / APM keywords | Observability Cloud + APM module, not ITSI alone |
| Cloud security use case, on-prem only deployment | Cloud TAs deprioritized |
| CSPM source selected | AWS/Azure/GCP **security** apps, not generic observability |
| Cisco ASA in sources/firewall vendor | Cisco Security TA / Network Data app when relevant |
| Cisco keyword only | Network **sources** boosted; Cisco apps only if network ops/security profile |
| SOAR in desiredApps without ES | Warning or auto-include ES dependency |
| Add-ons | Appear under **Technical add-ons**, not "Recommended apps" |
| `interpretInputs().suggestedApps` | Snapshot tests per intake fixture |
| `scoreAppAlignment` with profile display names | Must resolve to app ids (regression) |
| Export payload | `recommendedApps` matches Interpretation resolved list |
| Multi use-case intake | Merge apps from all profiles above threshold, not primary only |

---

## Recommended Implementation Plan

### Quick fixes (low effort, high clarity)

- Rename Interpretation section to **"Suggested Splunk products"** and split **Apps | Add-ons | Premium** using string/heuristic typing from `splunkApps.json` category.
- **Remove ES from `foundational_security.splunkApps`** or replace with InfoSec + SSE only (content change, not algorithm — needs product validation).
- Show **`desiredApps`** alongside interpretation suggestions on Review page for consistency.
- Add disclaimer when suggestedApps include premium + needsReview catalog entries.
- Fix **`scoreAppAlignment`** to normalize display names → app ids via shared registry.
- Narrow **`ai_ml_analytics`** keywords — remove bare `"ai"` and `"correlation"`.

### Data model work

- Introduce **`appCatalog.json`** as single source of truth; migrate `splunkApps.json` + profile strings to reference `appId`.
- Extend **`appRequirements.json`** to InfoSec, SSE, MLTK, Mission Control (needs external validation for reqs).
- Add **ES Premier, On-Call, CIM, ESCU** entries or explicit "out of scope" flags.
- Unify capability ids (`authentication_success` vs `authentication_success_events`).

### Algorithm work

- New **`appRecommendationEngine.js`** implementing target algorithm; **`interpretInputs`** calls it for `suggestedApps` + `appRecommendationReasons[]`.
- Maturity and budget gates before premium recommendations.
- CIM readiness score from existing coverage engine exposed to app layer.

### UI / export work

- Interpretation: explainability chips ("Suggested because…").
- Report PDF/PPT: unified **`recommendedApps`** with categories and reasons.
- Source Library: distinguish related **apps** vs **TAs** on source detail.

### Test hardening

- Fixture matrix for 20+ intake scenarios (security tiers, O11y, cloud, Cisco, ML).
- Regression: Northstar sample should not recommend ES+MLTK for "Basic InfoSec" without explicit confirmation.

---

## Appendix: Product facts marked “needs external validation”

The following Splunk product boundaries were **not verified against official Splunk documentation** in this audit:

- Splunk Enterprise Security **Premier** packaging and when it replaces standard ES
- Splunk **InfoSec App** vs **Security Essentials** positioning (2025/2026 branding)
- Splunk **Mission Control** vs ES workbench relationship
- **MLTK** vs **AI Toolkit** successor branding (catalog notes MLTK → AITK on Splunkbase 5413)
- **Splunk On-Call** integration path with ITSI/O11y
- **AppDynamics** standalone vs Splunk Observability bundle

Validate with Splunk product docs and account team before encoding hard rules.

---

## Appendix: Key code references

| Behavior | Location |
|----------|----------|
| suggestedApps = primary profile only | `interpretationEngine.js` → `interpretInputs()` lines 235–237 |
| Keyword RULES | `interpretationEngine.js` lines 57–78 |
| appCapabilityMappings | `sourceRecommendationRules.json` lines 45–71 |
| security_essentials → null | `logRequirementEngine.js` line 28 |
| Interpretation UI | `InterpretationPage.jsx` lines 256–299 |
| Export uses desiredApps | `reportExportEngine.js` line 529 |
| appMatch id/name mismatch | `sourceRecommendationEngine.js` lines 153–158 |
