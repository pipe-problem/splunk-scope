# Splunk Scope — Sizing Methodology (v1.7)

This document describes how **Splunk Scope v1.7** defines and applies data-source sizing estimates. It is written for Solutions Engineers (SEs), architects, and contributors maintaining the sizing catalog.

---

## Purpose and scope

The v1.7 sizing catalog captures **planning-level daily ingest estimates** (GB/day per counting unit) for security and IT telemetry sources. Estimates help scope indexer/storage conversations and workshop prioritization—they are **not** substitutes for production metering, license true-ups, or Splunk Professional Services validation.

**Disclaimer:** These values are planning estimates. Actual ingest varies based on customer configuration, logging policy, traffic, audit settings, and collection method. Validate with customer data and qualified Splunk/Cisco personnel.

---

## Low, average (medium), and high bands

Each catalog entry includes three bands, expressed as GB/day **per unit** (where `unit` is defined per source—see [Count basis](#count-basis-how-units-are-chosen)):

| Band | Meaning | Typical interpretation |
|------|---------|------------------------|
| **Low** | Conservative baseline | Minimal required logging, lower traffic, or tuned-down verbosity; useful for “best case” budget conversations when risk is acceptable |
| **Medium** (average) | Typical enterprise deployment | Default or “balanced” policies aligned with common hardening guidance; primary planning anchor |
| **High** | Verbose / high-traffic scenario | Full security telemetry, URL/threat enrichment, dense east-west traffic, heavy audit, or unusually chatty applications |

**How to use bands in workshops**

- Start from **medium** when the customer has not defined logging policy in detail.
- Move toward **low** only when there is evidence of reduced scope (e.g., traffic-only firewall logs, minimal database auditing).
- Use **high** when the customer explicitly centralizes verbose security logs, runs SSL inspection broadly, or operates high-session-rate environments (e.g., carrier-scale, dense VDI, heavy microservices APM).

Bands are **correlated**—they describe the same source under different operational assumptions, not independent SKUs.

---

## Count basis (how units are chosen)

The **unit** tells you what to multiply by the rate. Common units include:

- **Users** — interactive identities, SaaS seats, or IdP-authenticated principals (context-specific per source).
- **Endpoints / devices** — managed workstations, servers, agents, or appliances sending logs.
- **Servers / hosts** — OS instances or VMs generating the relevant log channel.
- **Applications / services** — distinct instrumented apps, databases, or transaction-emitting systems.
- **Clusters / instances / accounts** — cloud control-plane objects, Kubernetes clusters, storage arrays, etc.

**Authoritative guidance per source** lives in `sourceCountingMethods.json` (`primaryUnit`, `howToCount`, `customerQuestion`, `commonMistakes`). Always align workshop questions with that file before relying on a generic “servers vs users” assumption.

**SE discipline:** Confirm that the counted object matches what actually forwards to Splunk (forwarder, HEC, API collector, etc.). A source that exists in the environment but is not in scope for indexing should not drive sizing.

---

## Vendor and model multipliers

The catalog uses two related mechanisms:

1. **`sizingRates.json` — `vendorRates` and nested `models`**  
   Vendor- and model-specific **GB/day rates** (with their own low/medium/high where populated). When a model is present, it replaces the vendor-level rate for that model.

2. **`vendorModelRates.json` — category multipliers**  
   For **13 source categories**, relative **multipliers** (`multiplierLow`, `multiplierAverage`, `multiplierHigh`) adjust baseline expectations by vendor **within that category** (e.g., firewalls, EDR, proxy/SASE).

**Interpretation**

- **Vendor/model data** captures known differences in log verbosity, export format, and default security feature sets.
- **Model-level** entries (where present) are most specific—for example, small-branch appliances vs. data-center chassis in the same vendor family.

When customer hardware or SaaS offering is unknown, stay at category or generic vendor tier and widen the band with stakeholder review.

---

## Logging scope multipliers

Many `sizingRates.json` entries define `scopeMultipliers`: discrete factors keyed by logging scope presets (e.g., traffic-only vs. traffic + threat + URL). These model **policy choice**, independent of vendor.

**In-product behavior:** The running application also applies **pattern-based** scope multipliers from free-text fields such as logging scope / audit level (see `sizingEngine.js`). Treat JSON `scopeMultipliers` as **catalog semantics** for documentation and consistency; align customer language to the closest preset when possible.

---

## Manual overrides

Manual override (e.g., `override` or `manual_gb_day` in session input state) is the SE’s **explicit** GB/day figure for a source. When set to a positive value:

- It **replaces** formula-driven estimate for that source.
- The engine typically derives a **narrow asymmetric band** around the entered value (implementation-defined) for low/high display.

Use overrides when:

- Metered Splunk ingest or index-time sampling is already known.
- A customer-specific study or prior PS engagement established a defensible number.
- The catalog band is clearly wrong for a unique architecture (with written rationale).

---

## `needsReview` flag

In `sizingRates.json`, `needsReview: true` marks sources where:

- Variance across real deployments is extreme, or
- Evidence behind the default band is thin, or
- The source bundles multiple sub-pipelines (e.g., platform + application telemetry) that are easy to mis-count.

**SE expectation:** When `needsReview` is true, **do not** present the number as “Splunk-approved”—present it as a **starting hypothesis**, validate with customer-specific inputs, and document assumptions in the workshop pack.

---

## How SEs should validate values

A practical validation loop:

1. **Confirm the counting unit** using `sourceCountingMethods.json`.
2. **Map logging policy** to a scope preset (or document free-text scope and rationalize multiplier directionally).
3. **Apply vendor/model** when known; otherwise note uncertainty and prefer **wider** bands.
4. **Cross-check** against any of: `_internal` / Cloud Monitoring, license usage reports, index size over time, or vendor sizing worksheets.
5. For **`needsReview` sources**, add a **second source of truth** (metering or SME review) before contractual commitments.

---

## Storage and retention (separate exercise)

**Daily ingest (GB/day)** answers “how fast does data arrive?” **Storage** answers “how much do we retain, for how long, and at what compression/replication factor?”

Estimate storage **separately**:

- **Retention** — hot/warm/frozen, compliance vs. operational tiers, search-time vs. archive.
- **Replication and search factor** — multi-site and SLA-driven copies.
- **Compression** — varies by sourcetype, parsing, and Splunk platform (do not assume a single global factor).

The codebase exposes helpers such as `calculateStorage` in `sizingEngine.js` as a **starting point**; treat outputs as illustrative unless tuned to the customer’s actual cluster economics.

---

## Priority cascade (which number wins)

When multiple layers apply, resolve in this order (highest precedence first):

1. **Manual override** — SE-entered GB/day.
2. **Model-specific** — rates under `vendorRates[vendor].models[model]` in `sizingRates.json`.
3. **Vendor-specific** — vendor block under `vendorRates` or vendor multipliers in `vendorModelRates.json` for the category.
4. **Source-level** — the base rate and low/medium/high for that source id in `sizingRates.json`.
5. **Category fallback** — generic category guidance when finer data is missing (document the fallback in customer-facing notes).

If two mechanisms could double-count (e.g., a vendor rate **and** a category multiplier), **standard practice** is to use the **most specific** applicable layer only unless the release notes for that dataset explicitly define stacking rules.

---

## Relationship to the live Splunk Scope application

- The sizing **catalog** (`sizingRates.json`, `vendorModelRates.json`, `sourceCountingMethods.json`, etc.) is the **authoritative reference** for methodology and workshop content.
- The **in-app calculator** primarily consumes per-source formulas and rates from `sources.json` plus pattern-based scope and a **limited** vendor multiplier table in `sizingEngine.js`. When numbers differ, prefer **catalog + customer evidence** for written deliverables and track product alignment over time.

---

## Per-source field specification

[`archive/DATA_SOURCE_SIZING_FIELDS.md`](./archive/DATA_SOURCE_SIZING_FIELDS.md) lists every catalog source’s form fields, primary sizing input, rollup behavior (parent vs child rows), and vendor or rate-catalog excerpts from `sizingRates.json`. Regenerate after changing `sources.json` or rates: `npm run gen:sizing-doc`.

---

## Versioning

Sizing datasets are versioned in `catalogVersion.json` alongside `schemaVersion` fields inside individual JSON files. When updating rates, bump versions and summarize changes in release notes.
