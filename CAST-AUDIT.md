# CAST Application Audit

**Customer Architecture Strategy Tool for Splunk Planning**

Generated: May 1, 2026

---

## 1. High Level Overview

### What it is
CAST is a local-only, browser-based planning tool that helps Splunk Sales Engineers (SEs) estimate data ingest volumes, validate telemetry coverage, and generate phased architecture recommendations during customer engagements.

### Problem it solves
Splunk SEs need a structured, repeatable way to:
- Walk customers through data source discovery
- Estimate GB/day ingest ranges for licensing conversations
- Validate that selected sources cover the required telemetry domains for a given use case
- Generate professional, shareable architecture plans without relying on spreadsheets

### Who uses it
Internal Splunk SEs during live customer calls, discovery workshops, and internal planning sessions. The tool is screen-share friendly and produces PDF-ready reports.

### How it is used
1. SE opens the app locally during a customer conversation
2. Captures customer context (account, deployment type, desired apps, use cases, goals)
3. The engine interprets inputs and suggests a primary use case + source families
4. SE configures data sources with quantities, vendors, and scope
5. Reviews estimated ingest, validates telemetry coverage, generates phased plans
6. Prints or exports a professional architecture report

### What makes it unique
- **Not a spreadsheet** — structured workflow with intelligent defaults
- **Source-specific inputs** — each source asks the right questions (users vs. devices vs. servers)
- **Telemetry coverage validation** — maps sources to 33 telemetry domains and validates against use case requirements
- **Phased architecture plans** — generates Foundational / Expanded / Target State paths
- **Fully offline** — no API keys, no backend, no data leaves the machine
- **Configurable catalog** — sources, apps, and use cases are JSON-editable

---

## 2. User Flow (Step-by-Step)

### Step 1: Customer Intake

**What the user sees:** Form fields for account context and maturity goals.

**Inputs collected:**
- Customer / Account Name
- Deployment Type (Splunk Cloud, On-Prem, Hybrid, Unknown)
- Desired Splunk Apps (searchable multi-select, 66 apps across 8 categories)
- Primary Use Cases (21 checkbox options covering Security, Observability, IT Ops, Business, AI/ML, OT)
- Crawl / Walk / Run maturity goals (free text)
- Discovery Notes

**Logic:** Stores to AppContext state; auto-saves to localStorage.

**Output:** Populated intake object passed to interpretation engine on next step.

---

### Step 2: Interpretation

**What the user sees:** AI-like recommendations showing primary use case, suggested source families, required telemetry domains, day-1 sources, and future sources.

**Inputs:** The intake object from Step 1.

**Logic:** The `interpretationEngine` tokenizes all intake text (goals, use cases, app names, notes), scores each of 21 use case profiles against keyword rules, picks the highest-scoring profile, then derives source families and telemetry requirements from that profile.

**Output:**
- Primary use case (profile object)
- Suggested source families (category + subcategory groups)
- Required telemetry domains
- Day-1 source IDs (from profile's `minimumSources`)
- Future source IDs (from profile's `suggestedSources` minus minimum)
- Suggested Splunk apps (from profile's `splunkApps`)

---

### Step 3: Data Sources

**What the user sees:** Category-tabbed source cards with dynamic input fields. Global search bar, status filters, quick-jump buttons.

**Inputs collected per source:**
- Status (Current / Future / Skip / Unknown)
- Source-specific quantity fields (defined in `input_fields` per source — e.g., number of users, servers, endpoints, accounts, clusters)
- Vendor / model selections
- Logging scope / audit level
- Manual GB/day override
- Notes

**Logic:** Each source card dynamically renders fields from its `input_fields` config. The sizing engine calculates estimated GB/day in real-time using the source's `sizing_formula`. Confidence is determined by input completeness.

**Output:** Source state object with all inputs stored in `state.sources[sourceId]`.

---

### Step 4: Review Table

**What the user sees:** Sortable table of all configured sources with estimated ingest (low/expected/high), confidence scores, and totals with 20% buffer.

**Inputs:** Search bar for filtering; inline status editing.

**Logic:** Iterates all sources with status `current` or `future`, calls `calculateSourceSize()` for each, sums totals with 20% buffer multiplier.

**Output:** Aggregated GB/day estimates and per-source breakdown. Clicking a row navigates back to source configuration.

---

### Step 5: Coverage Analysis

**What the user sees:** Telemetry domain coverage matrix grouped by category (Security, Observability/IT, Business/Platform, OT/ICS). Progress bars showing strong/partial/none. Gap warnings with suggested fix sources.

**Logic:** `calculateCoverage()` iterates all active sources, collects their `telemetryDomains` mappings, and resolves the maximum strength per domain. `validateForUseCase()` compares coverage against the primary use case's required/recommended domains, identifies gaps, and suggests sources that would fill them.

**Output:**
- Coverage object (domain → strength + contributing sources)
- Validation result (pass/fail, gaps, warnings, suggestions, score %)

---

### Step 6: Architecture Paths (Plans)

**What the user sees:** Three phased architecture recommendations with ingest estimates, value propositions, included sources, strengths, tradeoffs, and next steps.

**Logic:** 
- Plan 1 (Foundational): Current-status sources only
- Plan 2 (Expanded): Current + first half of future sources + custom sources
- Plan 3 (Target State): All configured sources

Each plan calculates coverage, validates against the primary use case, and generates context-aware value propositions based on which telemetry domain combinations are covered.

**Output:** Three plan objects with GB/day ranges, validation status, value props, app lists.

---

### Step 7: Architecture Report

**What the user sees:** Print-ready report with CAST branding. Dark theme in app, light theme for PDF output.

**Sections:**
- Header (customer, deployment, primary use case, coverage score)
- Estimated Daily Ingest Range (with 20% buffer)
- Coverage Analysis (domain category summary)
- Source Inventory table (name, status, GB/day, value proposition)
- Recommended Apps & Add-ons
- Assumptions & Caveats

**Output:** Printable HTML (Ctrl+P/Cmd+P for PDF) or exported JSON.

---

## 3. Tech Stack & Architecture

| Layer | Technology |
|-------|-----------|
| Framework | React 19.2 |
| Build Tool | Vite 8.0 |
| Styling | Tailwind CSS 4.2 (via @tailwindcss/vite plugin) |
| Icons | Lucide React |
| State Management | React Context + useReducer |
| Persistence | localStorage (auto-save on every state change) |
| Data Files | Static JSON imports (sources, profiles, apps, vendors) |
| Deployment | Local only — `npm run dev` |

### Data Flow
```
User Input → dispatch(action) → appReducer → new state → component re-render
                                                    ↓
                                             localStorage.setItem()
```

### Where Logic Lives
- **`src/services/`** — All business logic (sizing, coverage, interpretation, plans, report)
- **`src/data/`** — Configurable JSON catalogs (sources, use cases, apps, vendors)
- **`src/pages/`** — Page-level UI components (one per workflow step)
- **`src/components/`** — Reusable UI components (ProgressRail, SearchableMultiSelect)
- **`src/context/`** — Global state management

### localStorage Usage
- Key: `splunk-sizer-session`
- Stores: Entire app state (intake, sources, interpretation, currentStep, plans)
- Behavior: Writes on every state change via `useEffect`; reads on initial load
- Supports: Export as JSON file, import from file, full reset

---

## 4. File / Folder Structure

```
src/
├── main.jsx                    Entry point, wraps App in AppProvider
├── App.jsx                     Main layout: sidebar + page router
├── index.css                   Theme variables + component styles + print styles
├── context/
│   └── AppContext.jsx          Global state (useReducer + Context + localStorage)
├── components/
│   ├── ProgressRail.jsx        Sidebar step navigation
│   └── SearchableMultiSelect.jsx  Multi-select dropdown with search + custom entries
├── pages/
│   ├── IntakePage.jsx          Customer intake form
│   ├── InterpretationPage.jsx  AI-like recommendations display
│   ├── SourceWorkflowPage.jsx  Dynamic source configuration (459 lines — largest page)
│   ├── ReviewPage.jsx          Aggregated table with search
│   ├── CoveragePage.jsx        Telemetry domain validation
│   ├── PlansPage.jsx           Three-phase architecture paths
│   └── ReportPage.jsx          Print-ready final report
├── services/
│   ├── sizingEngine.js         GB/day calculation engine
│   ├── coverageEngine.js       Telemetry domain coverage + validation
│   ├── interpretationEngine.js NLP-lite intake analysis
│   ├── planEngine.js           Plan generation (currently unused — logic inline in PlansPage)
│   └── reportEngine.js         Report generation (currently unused — logic inline in ReportPage)
├── data/
│   ├── sources.json            Source catalog (53 sources, 3483 lines)
│   ├── useCaseProfiles.json    21 use case profiles
│   ├── splunkApps.json         66 Splunk apps in 8 categories
│   ├── vendorModels.json       Vendor/model dropdowns for key source types
│   └── sizingRules.json        Legacy sizing strategies + global defaults
```

---

## 5. Core Engines

### interpretationEngine.js

**Inputs:** Intake object (customerName, deploymentType, desiredApps, useCases, crawlGoal, walkGoal, runGoal, discoveryNotes)

**Logic:**
1. `collectNarrative()` — Concatenates all text fields and tokenizes (lowercase, strip stopwords)
2. `scoreProfiles()` — Iterates 20 keyword rules against tokens. Each rule maps keywords to a profile ID with a weight. Also fuzzy-matches tokens against profile names/descriptions.
3. `pickPrimaryUseCase()` — Selects highest-scoring profile
4. `sourceFamiliesForProfile()` — Maps profile's suggestedSources to category/subcategory groups
5. Returns primary use case, source families, required telemetry, day-1/future sources, suggested apps

**Output:** `{ primaryUseCase, suggestedSourceFamilies, requiredTelemetry, day1Sources, futureSources, suggestedApps }`

**Limitations:**
- Keyword-only matching (no semantic understanding)
- Single primary use case selected (multi-use-case customers get the "closest match" only)
- Stopword list is minimal
- Ties broken by array order

---

### sizingEngine.js

**Inputs:** Source object (with `sizing_formula`) + input state (user-provided values)

**Logic:**
1. Check for manual override → return flat value
2. Read `sizing_formula.primary_input` and `rate_per_unit`
3. Get primary value from input state
4. If primary missing, scan secondary keys as fallback (low confidence)
5. Apply base formula: `expected = primaryValue × ratePerUnit`
6. Check logging scope/audit level → apply scope multiplier (0.6× for basic, 1.5× for verbose)
7. If vendor/scope provided → tighten confidence band (0.8–1.3× instead of 0.6–1.5×)

**Output:** `{ low, expected, high, confidence, warnings }`

**Limitations:**
- Rate per unit is a single static number per source (no vendor-specific rates)
- Scope multiplier is a simple regex match, not vendor-aware
- No compound formulas (e.g., "users × devices × factor")
- Confidence is binary (high if any qualifier present, else medium/low)

---

### coverageEngine.js

**Inputs:** Array of selected sources (with `telemetryDomains` mappings)

**Logic:**
1. `calculateCoverage()` — For each of 33 domains, finds the maximum strength across all sources that contribute to it
2. `validateForUseCase()` — Compares coverage against profile's `requiredDomains` and `recommendedDomains`. Gaps = required domains without "strong" coverage. Warnings = recommended domains with "none".
3. `calculateSourcePriority()` — Scores each source by how many required/recommended gaps it fills

**Output:** Coverage map + validation result (passed, gaps, warnings, suggestions, score)

**Limitations:**
- Binary "strong" threshold for required domains (partial doesn't satisfy)
- No weighting between domains (all required domains equally important)
- Source priority doesn't account for ingest cost
- Gap suggestions limited to 3 sources per domain

---

### planEngine.js

**Status:** File exists (269 lines) but is **not currently used**. Plan logic was inlined directly into `PlansPage.jsx` for faster iteration.

**Design intent:** Generate three plans with source selection, GB/day totals, coverage validation, and recommendations.

---

### reportEngine.js

**Status:** File exists (266 lines) but is **not currently used**. Report logic was inlined directly into `ReportPage.jsx`.

**Design intent:** Generate structured report object from session data; export as JSON or formatted HTML.

---

## 6. Data Models

### sources.json (53 root sources, 71 with children)

```json
{
  "id": "firewalls",
  "name": "Firewall Logs",
  "category": "Networking Hardware",
  "subcategory": "Firewalls",
  "description": "Perimeter and internal firewall traffic, threat, and config logs",
  "whyItMatters": "Foundational network visibility...",
  "configuredItemLabel": "# of Firewall systems",
  "sizingUnit": "per_item",
  "sizingRate": 1.0,
  "sizingRateLow": 0.5,
  "sizingRateHigh": 2.0,
  "exampleVendors": ["Palo Alto", "Fortinet", "Cisco"],
  "telemetryDomains": {
    "network": "strong",
    "perimeter_control": "strong",
    "authentication": "partial",
    "network_performance": "partial"
  },
  "splunkApps": ["Splunk App for Palo Alto Networks"],
  "technicalAddons": ["Splunk Add-on for Palo Alto Networks"],
  "aiOpportunities": ["Anomalous traffic pattern detection"],
  "input_fields": [
    {"key": "number_of_users", "label": "Number of users protected", "type": "number", "helper": "..."},
    {"key": "number_of_systems", "label": "Number of firewall devices", "type": "number", "helper": "..."},
    {"key": "vendor", "label": "Vendor", "type": "select", "options": [...]},
    {"key": "logging_scope", "label": "Logging scope", "type": "select", "options": [...]}
  ],
  "sizing_formula": {"primary_input": "number_of_users", "strategy": "per_user", "rate_per_unit": 0.01},
  "children": [...]
}
```

**Key fields:** id, name, category, telemetryDomains, input_fields, sizing_formula

---

### useCaseProfiles.json (21 profiles)

```json
{
  "id": "enterprise_security",
  "name": "Enterprise Security / SIEM",
  "description": "Full SIEM deployment with ES, correlation, and investigation",
  "category": "Security",
  "requiredDomains": ["authentication", "endpoint", "network", "perimeter_control", "threat_enrichment"],
  "recommendedDomains": ["identity_governance", "vulnerability_asset", "email_collaboration", "cloud_control_plane"],
  "relevantSourceFamilies": ["Networking", "Security & Compliance", "Server", "End-User Support"],
  "splunkApps": ["Splunk Enterprise Security"],
  "technicalAddons": ["..."],
  "minimumSources": ["firewalls", "windows_servers", "active_directory", "edr"],
  "suggestedSources": ["firewalls", "windows_servers", "active_directory", "edr", "dns", "vpn", "proxy", ...],
  "crawlDescription": "Core security logs with basic correlation...",
  "walkDescription": "Add cloud, threat intel, advanced detection...",
  "runDescription": "Full ES with risk scoring, SOAR automation...",
  "validationRules": ["Must have strong auth + endpoint coverage"],
  "valueProposition": "Complete security operations center capability..."
}
```

**Key fields:** requiredDomains, recommendedDomains, minimumSources, suggestedSources

---

### splunkApps.json (66 apps in 8 categories)

```json
[
  {
    "category": "Security",
    "apps": [
      {"id": "enterprise_security", "name": "Splunk Enterprise Security", "shortName": "ES", "description": "Premium SIEM solution"},
      ...
    ]
  },
  ...
]
```

Categories: Security, Observability / IT Ops, Platform / Admin, AI / ML, Compliance / Risk, Cloud / SaaS, OT / ICS, Other

---

### vendorModels.json

```json
{
  "firewalls": {
    "vendors": [
      {"id": "paloalto", "name": "Palo Alto Networks", "models": ["PA-220", "PA-440", ...]},
      ...
    ]
  },
  "edr": { ... },
  "cloud": { ... },
  "identity": { ... }
}
```

Used for dependent dropdowns (vendor → model) on source cards.

---

## 7. Sizing Logic

### How GB/day is calculated

```
expected = primary_input_value × rate_per_unit × scope_multiplier
low      = expected × confidence_low_multiplier
high     = expected × confidence_high_multiplier
```

### How low/expected/high works

| Confidence | Low multiplier | High multiplier | Trigger |
|-----------|---------------|-----------------|---------|
| High | 0.8× | 1.3× | Vendor AND/OR scope provided |
| Medium | 0.6× | 1.5× | Primary input provided, no qualifiers |
| Low | 0.6× | 1.5× | Fallback input used or missing data |

### How formulas are chosen

Each source defines `sizing_formula.primary_input` in sources.json:
- Firewalls → `number_of_users` (rate: 0.01 GB/user/day)
- Servers → `number_of_servers` (rate: 0.5 GB/server/day)
- EDR → `number_of_endpoints` (rate: 0.02 GB/endpoint/day)
- SaaS → `number_of_users` (rate: 0.002 GB/user/day)
- Cloud → `number_of_accounts` (rate: 0.25 GB/account/day)

### How manual overrides work

If `override` or `manual_gb_day` is set and > 0, the engine returns that value as low = expected = high with "medium" confidence.

### How missing data is handled

1. If primary input is 0 or missing → scan 8 secondary keys in priority order
2. If any secondary key has a value → use it at "low" confidence with a warning
3. If all empty → return 0 GB/day with "No quantity inputs provided" warning

### Scope modifiers

| Pattern matched | Multiplier |
|----------------|-----------|
| "full", "verbose", "all" | 1.5× |
| "basic", "only", "minimal" | 0.6× |
| Anything else / unset | 1.0× |

### Buffer

All totals in Review and Report include a fixed **20% buffer** (multiplied by 1.2).

---

## 8. Coverage Validation

### Telemetry Domains (33 total)

**Security (11):** authentication, endpoint, network, perimeter_control, remote_access, threat_enrichment, identity_governance, vulnerability_asset, email_collaboration, cloud_control_plane, saas_activity

**Observability / IT (12):** infrastructure_metrics, application_logs, application_traces, service_health, synthetic_monitoring, real_user_monitoring, kubernetes_container, cloud_infrastructure, database_activity, middleware_messaging, network_performance, storage_performance

**Business / Platform (6):** business_transactions, user_experience, audit_compliance, platform_health, ingest_pipeline_health, asset_inventory

**OT / ICS (4):** ot_network, scada_events, historian_data, industrial_assets

### How sources map to domains

Each source defines `telemetryDomains` as a key-value object:
```json
"telemetryDomains": {
  "network": "strong",
  "perimeter_control": "strong",
  "authentication": "partial"
}
```

Strength levels: `strong` > `partial` > `minimal` > `none`

### How coverage is calculated

For each domain, the engine finds the **maximum** strength across all selected sources. A domain is "covered" if any active source maps to it with "strong" or "partial".

### How warnings are triggered

- **Gap (critical):** A required domain does not have "strong" coverage
- **Warning (advisory):** A recommended domain has "none" coverage
- **Suggestion:** When a gap exists, the engine finds up to 3 sources in the catalog that provide "strong" coverage for that domain

### Limitations

- "Strong" is the only passing grade for required domains (partial fails)
- No concept of minimum source count per domain
- Coverage doesn't consider source status (current vs. future treated equally)
- No temporal dimension (can't say "this source covers auth NOW but this one covers it BETTER later")
- Custom sources require manual domain tagging

---

## 9. Plan Generation

### How Plans 1/2/3 are created

| Plan | Name | Source Selection |
|------|------|-----------------|
| 1 | Foundational | All sources with status = "current" |
| 2 | Expanded | Current + first 50% of future sources + custom sources |
| 3 | Target State | All sources (current + future + custom) |

If no sources are set to "current," Plan 1 falls back to the first 5 configured sources.

### How sources are selected

Selection is purely based on user-assigned **status**. The engine does not automatically select or exclude sources based on priority scores (though the priority scoring function exists in `coverageEngine.js`).

### How gaps affect plans

Each plan independently calculates coverage and validates against the primary use case. Plans with unmet required domains show "Gaps remain" warnings. The UI shows which specific domains are missing.

### How future sources are handled

Future sources split between Plan 2 (first half) and Plan 3 (all). This is a fixed 50/50 split, not based on priority or dependency.

### Value propositions

Generated dynamically based on which telemetry domain combinations a plan covers. The engine matches domain patterns to pre-written proposition templates (e.g., "authentication + endpoint → credential attack detection").

---

## 10. Report Generation

### How the final report is built

The report is constructed inline in `ReportPage.jsx` using `useMemo`. It:
1. Filters all active sources (current + future + custom)
2. Calculates per-source estimates via `calculateSourceSize()`
3. Sums totals with 20% buffer
4. Calculates coverage and validates against primary use case
5. Generates per-source value propositions

### Sections included

1. **Header** — Customer name, deployment type, primary use case, coverage score
2. **Estimated Daily Ingest Range** — Low/Expected/High with buffer
3. **Coverage Analysis** — Domain category summaries (strong/partial counts)
4. **Source Inventory** — Table with name, status, GB/day, value proposition
5. **Recommended Apps & Add-ons** — Deduplicated from all active sources
6. **Assumptions & Caveats** — Standard methodology notes + source-specific warnings

### How value propositions are generated

`getSourceValueProp()` maps domain keys to human-readable capability descriptions:
- `endpoint` → "endpoint visibility"
- `authentication` → "authentication monitoring"
- `application_traces` → "application log analysis"
- Outputs: "Enables [capability1], [capability2], [capability3]."

### How printable layout works

- CSS `@media print` block in `index.css` overrides dark theme to white/light
- Sidebar hidden via `display: none`
- Cards get white backgrounds, gray borders, no shadows
- Tables get collapsed borders at 9px font
- Page-break-friendly rules prevent splitting cards/headings
- All `.no-print` elements hidden

---

## 11. Current Limitations / Gaps

### Incomplete

1. **`planEngine.js` and `reportEngine.js` are unused** — Logic was inlined into page components. The service files exist but are stale.
2. **No actual telemetry validation for OT/Business domains** — Most sources only map to Security + IT domains; Business and OT mappings are sparse.
3. **No source dependency tracking** — E.g., Active Directory should probably be prerequisite for SSO/PAM.
4. **No vendor-specific sizing rates** — Palo Alto vs. Fortinet firewall volumes differ significantly in reality.

### Fragile

5. **Interpretation engine is keyword-based** — Easily confused by ambiguous input. "Cloud" could mean Cloud Security OR Cloud Infrastructure.
6. **Plan source selection is status-based only** — Does not use priority scores, dependency graphs, or cost optimization.
7. **50/50 future source split for Plan 2/3 is arbitrary** — No intelligence behind which future sources go in which plan.

### Hardcoded

8. **20% buffer is hardcoded** — Not configurable per source or deployment type.
9. **Scope multipliers (0.6×, 1.5×) are fixed** — Not source-specific or vendor-specific.
10. **Value proposition templates are pattern-matched** — Limited to ~10 domain combinations.
11. **Confidence bands (0.6–1.5 and 0.8–1.3) are global** — Not per-source calibrated.

### Needs Improvement

12. **No multi-use-case support** — Only one "primary" use case drives validation. Customers often have 3-4.
13. **No ingest cost/licensing estimation** — GB/day is calculated but not tied to Splunk licensing models.
14. **Children sources inherit parent domains only** — No independent domain mapping.
15. **No data retention/storage calculation** — GB/day × days × compression not shown.
16. **Search doesn't rank results** — All matches shown equally regardless of relevance.

---

## 12. What Should Be Improved Next

### Top 10 Improvements

| # | Area | Improvement |
|---|------|-------------|
| 1 | **Accuracy** | Vendor-specific sizing rates (e.g., PA-5200 vs. FortiGate 200F generate different volumes) |
| 2 | **Logic** | Multi-use-case validation — validate coverage against ALL selected use cases simultaneously |
| 3 | **Data Model** | Source dependency graph (AD required before SSO, firewall before netflow makes sense) |
| 4 | **UX** | Intelligent plan generation using priority scores, not just status-based grouping |
| 5 | **Realism** | Retention/storage calculator (hot/warm/cold days × GB × compression = total storage) |
| 6 | **Realism** | Splunk licensing model integration (ingest-based, workload-based, entity-based) |
| 7 | **Accuracy** | Per-vendor, per-model sizing rate overrides (configurable in vendorModels.json) |
| 8 | **UX** | Guided "quick start" templates (e.g., "Mid-size enterprise, Security + IT Ops") that pre-fill common configurations |
| 9 | **Logic** | Refactor plan/report logic out of page components back into service files for testability |
| 10 | **Data Model** | Community-contributed sizing benchmarks — ability to import/share anonymized rate libraries |

### Honorable mentions

- Print/PDF output could use a dedicated CSS file with page numbers and headers
- Session diff/versioning (compare two sessions for the same customer over time)
- Source cards could show MITRE ATT&CK mapping where applicable
- A "confidence dashboard" showing which estimates are weakest
- Bulk import from CSV/Excel for large environments
- Dark/light theme toggle for non-print viewing preferences

---

*End of audit*
