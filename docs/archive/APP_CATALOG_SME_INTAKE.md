# Splunk Scope — Product metadata SME intake

**Purpose:** Turn Splunk product truth into `appCatalog.json` gates, customer copy, and Vitest scenarios.  
**Canonical engine:** `src/services/appRecommendationEngine.js` · **Catalog:** `src/data/appCatalog.json`

---

## How to use this form

1. Complete **Section A** once per engagement (optional defaults).
2. Complete **Section B** for each product you care about (start with security + anything in the deal).
3. Set **Confidence:** High = safe to automate; Medium = show with caveat; Low = do not auto-recommend.
4. If unsure, leave blank and note **needs external validation** — do not guess packaging or entitlements.

**Return completed forms to:** engineering owner for Splunk Scope (or attach in the engagement repo under `docs/sme-intake/`).

---

## Section A — Engagement defaults (once)

| Field | Your answer |
|-------|-------------|
| Primary Splunk platform | ☐ Splunk Cloud (Victoria) ☐ Cloud (Classic) ☐ Enterprise on-prem ☐ Hybrid |
| Budget band for this deal | ☐ Explore (&lt;$50k) ☐ Crawl ☐ Walk ☐ Run ☐ Enterprise |
| SOC maturity | ☐ None / greenfield ☐ Tier-1 only ☐ Mature SOC ☐ ES already deployed |
| Default security entry product | ☐ InfoSec ☐ Security Essentials ☐ ES standard ☐ ES Premier |
| Observability in scope? | ☐ No ☐ Splunk O11y Cloud only ☐ Enterprise metrics/logs only ☐ Both |
| Cisco estate in scope? | ☐ No ☐ Network only ☐ Security (FW/ISE) ☐ Meraki ☐ AppDynamics |
| OT/ICS in scope? | ☐ No ☐ Read-only passive only (method: ________________) |

**Notes:**

---

## Section B — Per-product worksheet

Copy this block for each product.

### Product: _____________________________

| Field | Fill in |
|-------|---------|
| **Canonical app id** (if known, e.g. `enterprise_security`) | |
| **Display name** (customer-facing) | |
| **Product type** | ☐ Premium solution ☐ Free app ☐ Splunkbase app ☐ TA ☐ Connector ☐ Prerequisite ☐ Content pack ☐ SaaS module |
| **Splunkbase catalog id** (or “none / premium”) | |
| **Official product page URL** | |
| **License / entitlement notes** (SKU, bundle, Cloud-only, etc.) | |

#### When to recommend

| Question | Answer |
|----------|--------|
| **Primary use cases** (check all) | ☐ Foundational security ☐ Enterprise SIEM ☐ Threat hunting ☐ IR/SOAR ☐ UEBA ☐ IT ops ☐ APM/O11y ☐ Cloud security ☐ Compliance ☐ OT ☐ ML/anomaly ☐ Other: ________ |
| **Intent keywords** (phrases that should *support* this product — avoid generic “security” alone) | |
| **Minimum crawl / walk / run** | ☐ Crawl ☐ Walk ☐ Run |
| **Minimum budget band** | ☐ Any ☐ Medium+ ☐ High / enterprise only |
| **Requires these other apps first** | |
| **Lighter alternatives** (recommend instead when immature) | |
| **Never recommend when…** (negative rules) | |

#### Data and sources

| Field | Answer |
|-------|--------|
| **Minimum useful sources** (catalog ids: `active_directory`, `firewalls`, `edr`, …) | |
| **Recommended sources** | |
| **Required CIM data models** (if any) | |
| **CIM required before first value?** | ☐ Yes ☐ No ☐ Partial |
| **Typical ingest path** | ☐ Indexer/UF ☐ HEC ☐ O11y/OTel ☐ Mixed |

#### Overlaps and positioning

| Question | Answer |
|----------|--------|
| **Overlaps with** (customer may already have) | |
| **Customer one-liner** (why buy this) | |
| **SE-only caveat** (packaging, Premier, deprecated, etc.) | |
| **Confidence for automation** | ☐ High ☐ Medium ☐ Low |

---

## Section C — Priority validation list (from logic audit)

Confirm **Yes / No / Partial** and one sentence per row.

| Product / topic | Automate in Scope? | SME confirmed positioning | Notes |
|-----------------|-------------------|---------------------------|-------|
| ES vs InfoSec vs Security Essentials | | | |
| ES Premier vs ES standard | | | |
| SOAR requires ES + detections maturity | | | |
| UBA vs ES RBA | | | |
| Mission Control vs ES workbench | | | |
| MLTK vs AI Toolkit (Splunkbase 5413) | | | |
| DSDL prerequisites | | | |
| ITSI vs Observability Cloud vs IM | | | |
| Splunk On-Call vs ITSI | | | |
| AppDynamics vs Splunk APM | | | |
| Cisco ASA vs FTD vs ISE vs Duo / Security Cloud | | | |
| CIM + ESCU before ES (mandatory?) | | | |

---

## Section D — Submit back to engineering

When complete, send:

- [ ] This file (or exported spreadsheet)
- [ ] Official Splunk doc/deck links
- [ ] 2–3 real examples: “Given this intent, we would sell X not Y”

**Engineering will:** update `appCatalog.json`, extend `appRequirements.json`, add Vitest scenarios, and reconcile source↔app ID mapping.

**Related docs:** `docs/APP_SOURCE_USE_CASE_MATRIX.md` · `docs/APP_RECOMMENDATION_ENGINE.md` · `docs/APP_RECOMMENDATION_LOGIC_AUDIT.md` (remediation status at top)
