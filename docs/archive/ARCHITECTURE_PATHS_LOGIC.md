# Architecture Paths — Planning Logic (customer-facing)

## Roadmap readiness (primary card score)

Cards emphasize **Roadmap readiness** (0–100), not domain coverage alone. The score answers: *How complete and valuable is this phased plan for the customer's selected goals?* Domain coverage remains a **technical sub-metric** in the selected-path detail panel only.

Weighted formula (`pathOutcomeScoringEngine.js`):

| Component | Weight | Meaning |
|-----------|--------|---------|
| Required telemetry | 25% | Required-domain coverage from validation |
| Recommended telemetry | 15% | Recommended domains and contextual sources |
| Use-case support | 15% | Selected use cases with meaningful support |
| Enrichment / context | 15% | Asset lists, vuln, CMDB, cloud inventory, user context |
| Detection depth | 10% | Complementary multi-source signals per risk area |
| Roadmap completeness | 10% | Share of Run target sources included |
| Phase maturity | 10% | Theme coverage and path phase progression |

The displayed score blends **technical components (32%)** with a **phase progress score (68%)** so Crawl/Walk/Run progression feels credible in demos (~60–68 / ~76–88 / ~90–98 for full scenarios).

Qualitative labels: **Foundational** (0–59), **Developing** (60–74), **Strong** (75–89), **Target-ready** (90–100).

Detection depth uses tiered scoring (multiple sources + domains per risk group required for high scores — Crawl cannot show 100% depth from a single saturated domain).

Detail panels show a **three-column unlock summary** first, then technical breakdown bars (including domain coverage). Cards show roadmap readiness, GB/day, source count, one-line unlock, and best-for / not-yet.

## Path themes (Crawl / Walk A / Walk B / Run)

Paths are built from explicit themes (`pathThemes.json`, `pathThemeEngine.js`), not identical greedy packing:

| Path | Theme | Intent |
|------|-------|--------|
| **Crawl** | `crawl_foundational` | Smallest practical SIEM foundation (AD, firewall, Windows, EDR, DNS, SSO, asset lists) |
| **Walk A** | `security_core` | Recommended SOC path — Crawl + email, vuln, proxy, VPN, IDS/IPS, enrichment |
| **Walk B** | `cloud_data_risk` | Alternate path — Crawl + IaaS, cloud VMs/storage/containers, SaaS, DLP/CASB, WAF |
| **Run** | `run_expansion` | All valid sized Current + Planned/Future sources supporting selected use cases |

Walk B expands from **Crawl**, not from Walk A. If Walk B overlaps Walk A by more than 70% (excluding Crawl baseline), `diversifyWalkBFromWalkA` swaps security-only extras for cloud/data sources when possible.

## Budget cap (internal)

- **Cloud** and **hybrid** use **$1,000 / GB/day** (hybrid uses cloud rate as the safe estimate).
- **On-prem** uses **$650 / GB/day**.
- `budgetGbDay` from intake is the **buffered** planning cap shown on cards (buffer is inside the cap, not added on top). All path GB/day totals use the same buffered sizing as Coverage/Review.
- **Crawl** targets **60–80%** of configured ceiling or budget (theme-selected minimum viable set).
- **Walk A / Walk B** target configured ceiling or budget with **different source mixes** (security vs cloud/data), not identical packs.
- **Run** maximizes valid sources (soft cap ~2× budget when budget exists).

## Paths (with budget)

| Path | GB/day target | Theme | Sources |
|------|---------------|-------|---------|
| **Crawl** | **60–80%** of ceiling | Foundational | Current only; crawl theme ranks |
| **Walk A** | ~ceiling / budget | Security core | Crawl + security_core expansion |
| **Walk B** | ~ceiling / budget | Cloud & data risk | Crawl + cloud_data_risk expansion |
| **Run** | Maximize (soft cap) | Full roadmap | Current + future as valid |

Walk A and Walk B may differ slightly in GB/day; meaningful differentiation is preferred over exact budget matching.

## Paths (no budget)

Same theme construction; Crawl uses crawl_foundational; Walk A/B use respective themes from Crawl seed; Run includes all valid candidates.

## Ranking when packing

1. Theme rank (`rankCandidatesForTheme`)
2. Required domain coverage (primary mandatory)
3. Splunk apps / use-case relevance
4. Value per GB within cap

## Customer UI

- **Coverage-style carousel** — one path per slide (`PathCarousel` + `PathCarouselSlide`); left/right arrows and keyboard ←/→ with **circular wrap** (Run → Crawl).
- **Recommended vs viewed vs report path** — `findRecommendedPlanIndex()` drives the recommended badge; carousel `viewIndex` is independent; **Use this path in report** sets `selectedPlanIndex` via `SELECT_PLAN`.
- **Slide hero** — readiness gauge (`PathReadinessGauge`), KPI strip (GB/day, sources, domains), three columns: Best for / Unlocks / Still deferred.
- **Technical details** — collapsed accordion (`PathTechnicalDetails`): **Sources** (included table) and **Scoring** (domain coverage + breakdown) only; no separate Gaps/Business Value tabs on the carousel surface.
- Numeric totals from `generatePlans` via `pathDisplayHelpers.js` — same objects as Report/Coverage. Report Ingest tab uses `DonutChart` (import required in `ReportPage.jsx`).

