/**
 * Canonical 0–1 telemetry strength weights used by coverage, plan, and recommendation engines.
 * sourceRequirementEngine uses a separate ordinal rank scale for peer comparison only.
 */
export const STRENGTH_SCORE = Object.freeze({
  strong: 1.0,
  partial: 0.5,
  minimal: 0.2,
  none: 0,
})

export function strengthToScore(strength) {
  return STRENGTH_SCORE[strength] ?? 0
}
