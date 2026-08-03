/** Feature flags for Splunk Scope redesign (Phase 1+). */

/** When false, Coverage is omitted from the main workflow nav (route remains available). */
export const SHOW_COVERAGE_PAGE = false

/** Sizing UX mode — `simple` uses original-calculator defaults; `advanced` uses additive/guardrail path. */
export const SIZING_MODE = 'simple'

/** When true, overlap decisions annotate only — totals must not deduct overlapping sources (Phase 4). */
export const OVERLAP_ANNOTATE_ONLY = true

/** When false, Intake hides freeform goals, discovery notes editor, and heuristic fallback. */
export const ADVANCED_INTAKE = false
