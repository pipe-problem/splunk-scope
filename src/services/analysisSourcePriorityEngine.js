/**
 * Customer-facing source priorities for the Analysis (workshop) page.
 * Wraps sourcePrioritizationEngine — maps 0–100 scores to 1–10, no internal labels.
 */
import sourceCatalog from '../data/sources.json' with { type: 'json' };
import rules from '../data/sourceRecommendationRules.json' with { type: 'json' };
import { flattenSourceCatalog } from './sizingEngine.js';
import { prioritizeAndSortSources } from './sourcePrioritizationEngine.js';
import { OVERLAP_GROUPS } from './overlapEngine.js';
import { resolveUseCaseProfiles } from './useCaseResolver.js';
import { getGoalsForIntake, APPS_BY_ID } from './goalAppSourceKnowledge.js';
import { getFlatSplunkApps } from './splunkAppsCatalog.js';
import { getCustomerAppDisplayName } from '../utils/customerAppDisplay.js';
import { resolveCanonicalAppId } from './appCatalogService.js';

const FLAT_CATALOG = flattenSourceCatalog(sourceCatalog);

const APP_DISPLAY_NAME = new Map(
  getFlatSplunkApps().map((a) => [a.id, a.name]),
);

/**
 * @param {number} priorityScore 0–100
 * @returns {number} 1–10
 */
export function mapPriorityScoreToRelevance1to10(priorityScore) {
  const score = Number(priorityScore);
  if (!Number.isFinite(score) || score <= 0) return 1;
  return Math.max(1, Math.min(10, Math.ceil(score / 10)));
}

/**
 * @param {string} sourceId
 * @param {string[]} appIds
 * @returns {string[]}
 */
function getAppsPoweringSourceForAnalysis(sourceId, appIds) {
  const canonicalApps = appIds.map((id) => resolveCanonicalAppId(id) || id);
  const powered = [];
  for (const appId of canonicalApps) {
    const knowledge = APPS_BY_ID.get(appId);
    const required = knowledge?.requiredSourceIds || [];
    const recommended = knowledge?.recommendedSourceIds || [];
    const mapping = rules.appCapabilityMappings?.[appId];
    const boosted = mapping?.boostSourceIds || [];
    if (required.includes(sourceId) || recommended.includes(sourceId) || boosted.includes(sourceId)) {
      powered.push(appId);
    }
  }
  return [...new Set(powered)];
}

function appDisplayName(appId) {
  return getCustomerAppDisplayName(appId, APP_DISPLAY_NAME.get(appId) || APPS_BY_ID.get(appId)?.name);
}

/**
 * Customer-safe one-line rationale — no internal classification labels.
 * @param {object} source
 * @param {string[]} appsPowered
 * @param {object[]} goals
 */
export function buildAnalysisSourceWhyOneLine(source, appsPowered, goals = []) {
  const appNames = appsPowered.slice(0, 2).map(appDisplayName);
  if (appNames.length === 2) {
    return `Telemetry for ${appNames[0]} and ${appNames[1]}.`;
  }
  if (appNames.length === 1) {
    return `Telemetry that powers ${appNames[0]}.`;
  }
  const goalName = goals[0]?.name;
  if (goalName) {
    return `Aligns with your ${goalName} goals.`;
  }
  return `Foundational data for your Splunk scope.`;
}

/**
 * @param {object} params
 * @param {object} [params.intake]
 * @param {string[]} [params.desiredApps]
 * @param {string[]} [params.recommendedApps]
 * @param {object[]} [params.useCaseProfiles]
 * @param {object} [params.sourceStates]
 * @param {object} [params.overlapDecisions]
 * @param {object} [params.overlapGroups]
 * @param {number} [params.limit=8]
 * @returns {Array<{ sourceId: string, sourceName: string, relevanceScore1to10: number, appsPowered: string[], whyOneLine: string }>}
 */
export function getAnalysisSourcePriorities({
  intake = {},
  desiredApps = [],
  recommendedApps = [],
  useCaseProfiles,
  sourceStates = {},
  overlapDecisions = {},
  overlapGroups = OVERLAP_GROUPS,
  limit = 8,
} = {}) {
  const profiles = useCaseProfiles || resolveUseCaseProfiles(intake).profiles;
  const combinedApps = [...new Set([...(desiredApps || []), ...(recommendedApps || [])])];
  const goals = getGoalsForIntake(intake);

  const sorted = prioritizeAndSortSources(
    FLAT_CATALOG,
    profiles,
    combinedApps,
    FLAT_CATALOG,
    sourceStates,
    overlapDecisions,
    overlapGroups,
    intake,
  );

  const goalPriorityIds = new Set(goals.flatMap((g) => g.prioritySourceIds || []));

  const candidates = sorted
    .filter((s) => s.relevance?.label !== 'redundant')
    .filter((s) => (s.relevance?.priorityScore ?? 0) >= 25)
    .sort((a, b) => {
      const scoreDiff = (b.relevance?.priorityScore ?? 0) - (a.relevance?.priorityScore ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      const aGoal = goalPriorityIds.has(a.id) ? 1 : 0;
      const bGoal = goalPriorityIds.has(b.id) ? 1 : 0;
      return bGoal - aGoal;
    });

  const maxCount = Math.min(10, Math.max(5, limit));

  return candidates.slice(0, maxCount).map((source) => {
    const appsPowered = getAppsPoweringSourceForAnalysis(source.id, combinedApps);
    return {
      sourceId: source.id,
      sourceName: source.name,
      relevanceScore1to10: mapPriorityScoreToRelevance1to10(source.relevance?.priorityScore ?? 0),
      appsPowered,
      whyOneLine: buildAnalysisSourceWhyOneLine(source, appsPowered, goals),
    };
  });
}

/**
 * Customer-facing card/modal metadata for the Sources workflow grid.
 * @param {object} source — catalog entry with optional `relevance` from prioritization
 * @param {object} [options]
 * @param {object} [options.intake]
 * @param {string[]} [options.desiredApps]
 * @param {string[]} [options.recommendedApps]
 */
export function getSourceWorkflowDisplayMeta(source, options = {}) {
  const {
    intake = {},
    desiredApps = [],
    recommendedApps = [],
  } = options;
  const combinedApps = [...new Set([...(desiredApps || []), ...(recommendedApps || [])])];
  const goals = getGoalsForIntake(intake);
  const appsPowered = getAppsPoweringSourceForAnalysis(source?.id, combinedApps);
  const relevanceScore1to10 = mapPriorityScoreToRelevance1to10(source?.relevance?.priorityScore ?? 0);
  return {
    relevanceScore1to10,
    appsPowered,
    appLabels: appsPowered.map(appDisplayName).slice(0, 3),
    whyOneLine: buildAnalysisSourceWhyOneLine(source, appsPowered, goals),
  };
}
