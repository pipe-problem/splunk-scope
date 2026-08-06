import { DEFAULT_GOAL_PRESET_IDS } from './goalPresets.js';

/**
 * True when the user has entered planning context beyond factory defaults.
 * Relevance scoring on the Sources page is gated on this signal.
 * @param {object} [intake]
 * @returns {boolean}
 */
export function isIntakeReadyForSourceRelevance(intake = {}) {
  if ((intake.useCases || []).length > 0) return true;
  if (String(intake.customUseCases || '').trim()) return true;
  if ((intake.desiredApps || []).length > 0) return true;
  if ((intake.recommendedApps || []).length > 0) return true;
  if (String(intake.discoveryNotes || '').trim()) return true;
  if (intake.importedContext) return true;
  if ((intake.sourceHints || []).length > 0) return true;
  if (String(intake.customerName || '').trim()) return true;

  if (String(intake.crawlGoal || '').trim()) return true;
  if (String(intake.walkGoal || '').trim()) return true;
  if (String(intake.runGoal || '').trim()) return true;

  if (
    intake.crawlGoalPresetId
    && intake.crawlGoalPresetId !== DEFAULT_GOAL_PRESET_IDS.crawl
  ) {
    return true;
  }
  if (
    intake.walkGoalPresetId
    && intake.walkGoalPresetId !== DEFAULT_GOAL_PRESET_IDS.walk
  ) {
    return true;
  }
  if (
    intake.runGoalPresetId
    && intake.runGoalPresetId !== DEFAULT_GOAL_PRESET_IDS.run
  ) {
    return true;
  }

  return false;
}
