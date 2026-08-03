# Splunk Scope — Product Principles

These principles guide product decisions, UX, and engineering trade-offs so Splunk Scope stays **credible in front of customers** and **maintainable for SEs and builders**.

---

## 1. Multi-use-case support

Security is essential, but not every engagement leads with security. Defaults, ordering, and language must stay valid when the primary outcomes are IT operations, observability, business analytics, compliance, OT/ICS, cloud platform operations, or bespoke programs. Coverage, planning, and recommendations must **not** implicitly treat non-security outcomes as secondary.

---

## 2. Log- and capability-based requirements

Source value is judged not only against coarse telemetry domains but also against **log capabilities** and **Splunk app expectations** (`logRequirements.json`, `appRequirements.json`, `dataModelRequirements.json`). Classification and warnings should reflect whether the *kind* of logging needed for an app or use case is realistically present.

---

## 3. Source intelligence with accurate classification

Every source should have clear **what it is / why it matters / what it costs** signals before commitment. Labels (Required, Recommended, Optional, Redundant, Unnecessary, Needs Review) must map to **explainable rules**. **Required stays rare**: reserve it for cases where an active source is essentially the sole strong answer to an unsatisfied required need.

---

## 4. Explainability through expandable detail (not modes)

Users discover **why** something was scored or labeled through **inline expansion**, modals, and structured rationales — not by flipping hidden global modes that change the entire product personality. The same surfaces should work in a customer working session and in a solo review; density is controlled with progressive disclosure, not alternate “skins.”

---

## 5. Intelligent plan generation

Architecture paths must reflect **dependencies, overlap reality, gap closure, and priority** — not arbitrary splits. Plans include **only** sources the session has actually configured (plus explicit gap suggestions where appropriate). Missing inventory should read as **gaps**, not silent invention of infrastructure.

---

## 6. Local-only and secure by default

Sensitive customer context stays on the workstation. The interactive app makes **no outbound network calls** in normal use. Any future connectivity must be **explicitly opted in**, documented, and off by default. Secrets and credentials do not belong in persisted session JSON.

---

## 7. Executive-ready UX

The interface should feel **calm, skimmable, and decisive**: consistent typography, tight vertical rhythm, honest empty states, and copy that an SE can read aloud. The first-run experience is a guided path, not an unexplained control surface.

---

## 8. Scalable architecture

Domain rules live in **small engines and data files** that are testable and composable. Pages orchestrate state and presentation; they do not embed scoring formulas or pricing-like logic. Adding a use case or source should chiefly extend JSON + narrow engine hooks.

---

## 9. Auditable sizing

Ingest and storage-related numbers must trace to **documented inputs**: formulas, benchmark tables (`sizingRates.json`), vendor/model assumptions, scope multipliers, manual overrides, and overlap exclusions. When an assumption is inferred, it should surface in assumptions lists or tooltips — not disappear into a composite score.

---

## 10. Language that matches the stakes

Ship text and docs that describe the tool as **planning and architecture software**. Avoid hedging language that sounds like a throwaway experiment; prefer precision about **limits** and **what validation still requires**.

---

*Principles are stable; tactics change. When in doubt, favor transparency, multi-use-case neutrality, and defensible traceability from numbers back to inputs.*
