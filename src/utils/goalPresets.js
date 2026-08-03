/**
 * Goal preset resolution — Crawl / Walk / Run maturity goals from preset IDs.
 */
import goalPresets from '../data/goalPresets.json';

const crawlById = new Map(goalPresets.crawl.map((p) => [p.id, p]));
const walkById = new Map(goalPresets.walk.map((p) => [p.id, p]));
const runById = new Map(goalPresets.run.map((p) => [p.id, p]));

export const DEFAULT_GOAL_PRESET_IDS = {
  crawl: 'crawl_foundational_visibility',
  walk: 'walk_expand_correlation',
  run: 'run_optimize_and_mature',
};

export function getGoalPresetsForPhase(phase) {
  if (phase === 'crawl') return goalPresets.crawl;
  if (phase === 'walk') return goalPresets.walk;
  if (phase === 'run') return goalPresets.run;
  return [];
}

export function getGoalPresetById(phase, id) {
  if (!id) return null;
  if (phase === 'crawl') return crawlById.get(id) ?? null;
  if (phase === 'walk') return walkById.get(id) ?? null;
  if (phase === 'run') return runById.get(id) ?? null;
  return null;
}

export function isValidGoalPresetId(phase, id) {
  return getGoalPresetById(phase, id) != null;
}

/**
 * Customer-facing goal text for reports and exports.
 */
export function getCustomerFacingGoalText(intake, phase) {
  const presetId =
    phase === 'crawl'
      ? intake?.crawlGoalPresetId
      : phase === 'walk'
        ? intake?.walkGoalPresetId
        : intake?.runGoalPresetId;
  const preset = getGoalPresetById(phase, presetId);
  if (preset?.customerFacingText) return preset.customerFacingText;

  const legacy =
    phase === 'crawl'
      ? intake?.crawlGoal
      : phase === 'walk'
        ? intake?.walkGoal
        : intake?.runGoal;
  if (legacy && String(legacy).trim()) return String(legacy).trim();

  const defaultPreset = getGoalPresetById(phase, DEFAULT_GOAL_PRESET_IDS[phase]);
  return defaultPreset?.customerFacingText ?? '';
}

/**
 * Internal meaning for engines (narrative scoring, path naming).
 */
export function getInternalGoalText(intake, phase) {
  const presetId =
    phase === 'crawl'
      ? intake?.crawlGoalPresetId
      : phase === 'walk'
        ? intake?.walkGoalPresetId
        : intake?.runGoalPresetId;
  const preset = getGoalPresetById(phase, presetId);
  if (preset?.internalMeaning) return preset.internalMeaning;

  const legacy =
    phase === 'crawl'
      ? intake?.crawlGoal
      : phase === 'walk'
        ? intake?.walkGoal
        : intake?.runGoal;
  if (legacy && String(legacy).trim()) return String(legacy).trim();

  const defaultPreset = getGoalPresetById(phase, DEFAULT_GOAL_PRESET_IDS[phase]);
  return defaultPreset?.internalMeaning ?? '';
}

/**
 * Expand intake with effective goal text for engines that expect crawlGoal/walkGoal/runGoal strings.
 */
export function withEffectiveGoals(intake) {
  if (!intake || typeof intake !== 'object') return intake;
  return {
    ...intake,
    crawlGoal: getInternalGoalText(intake, 'crawl'),
    walkGoal: getInternalGoalText(intake, 'walk'),
    runGoal: getInternalGoalText(intake, 'run'),
  };
}

export function getAllGoalPresetIds() {
  return {
    crawl: goalPresets.crawl.map((p) => p.id),
    walk: goalPresets.walk.map((p) => p.id),
    run: goalPresets.run.map((p) => p.id),
  };
}

export function migrateLegacyGoalsToPresets(intake) {
  const migrated = { ...intake };
  const legacyNotes = [];

  if (!migrated.crawlGoalPresetId && migrated.crawlGoal?.trim()) {
    legacyNotes.push(`Legacy Crawl goal: ${migrated.crawlGoal.trim()}`);
  }
  if (!migrated.walkGoalPresetId && migrated.walkGoal?.trim()) {
    legacyNotes.push(`Legacy Walk goal: ${migrated.walkGoal.trim()}`);
  }
  if (!migrated.runGoalPresetId && migrated.runGoal?.trim()) {
    legacyNotes.push(`Legacy Run goal: ${migrated.runGoal.trim()}`);
  }

  if (!migrated.crawlGoalPresetId) {
    migrated.crawlGoalPresetId = DEFAULT_GOAL_PRESET_IDS.crawl;
  }
  if (!migrated.walkGoalPresetId) {
    migrated.walkGoalPresetId = DEFAULT_GOAL_PRESET_IDS.walk;
  }
  if (!migrated.runGoalPresetId) {
    migrated.runGoalPresetId = DEFAULT_GOAL_PRESET_IDS.run;
  }

  return { intake: migrated, legacyNotes };
}
