/**
 * True when intake has enough context to score source relevance (use case or Splunk app).
 * Customer name, discovery notes, or goal text alone are not sufficient.
 * @param {object} [intake]
 * @returns {boolean}
 */
export function isIntakeReadyForSourceRelevance(intake = {}) {
  if ((intake.useCases || []).length > 0) return true;
  if (String(intake.customUseCases || '').trim()) return true;
  if ((intake.desiredApps || []).length > 0) return true;
  if ((intake.recommendedApps || []).length > 0) return true;
  return false;
}
