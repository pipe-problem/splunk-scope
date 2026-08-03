/**
 * Roadmap readiness — customer-facing phased plan value (not strict domain coverage alone).
 */

import {
  isEnrichmentSource,
  computeDetectionDepthScore,
  countThemeSources,
  THEME_SETS,
} from './pathThemeEngine.js';
import { buildPathCardMessaging } from './pathValueMessagingEngine.js';

export const ROADMAP_READINESS_LABEL = 'Roadmap readiness';

const WEIGHTS = {
  required: 0.25,
  recommended: 0.15,
  useCase: 0.15,
  enrichment: 0.15,
  depth: 0.10,
  completeness: 0.10,
  phaseMaturity: 0.10,
};

const TECHNICAL_BLEND = 0.32;
const PROGRESS_BLEND = 0.68;

const ENRICHMENT_CAP = 6;

/** @param {number} score 0–100 */
export function getRoadmapReadinessLabel(score) {
  const s = Number(score) || 0;
  if (s >= 90) return 'Target-ready';
  if (s >= 75) return 'Strong';
  if (s >= 60) return 'Developing';
  return 'Foundation';
}

/**
 * Progress score from path phase + share of target roadmap sources included.
 * @param {object} plan
 * @param {number} completeness 0–1
 */
export function computePhaseProgressScore(plan, completeness = 0) {
  const phase = plan.pathPhase || 'crawl';
  const c = Math.min(1, Math.max(0, completeness));
  const sources = plan.sources || [];
  const enrichmentN = sources.filter((s) => isEnrichmentSource(s.id)).length;

  if (phase === 'crawl') {
    const core = countThemeSources(sources, 'crawl_foundational');
    return Math.min(68, 58 + core * 1.1 + c * 10);
  }
  if (phase === 'walk') {
    const sec = countThemeSources(sources, 'security_core');
    const cloud = countThemeSources(sources, 'cloud_data_risk');
    return Math.min(88, 78 + sec * 0.35 + cloud * 0.35 + c * 12 + Math.min(4, enrichmentN));
  }
  if (phase === 'run') {
    return Math.min(98, 90 + c * 8 + Math.min(4, enrichmentN * 0.5));
  }
  return 50 + c * 30;
}

/**
 * @param {object} plan
 * @param {number} [roadmapCompleteness] 0–1 share of Run target sources
 */
export function computeRoadmapCompleteness(plan, roadmapCompleteness) {
  if (typeof roadmapCompleteness === 'number') {
    return Math.min(1, Math.max(0, roadmapCompleteness));
  }
  return 0;
}

function computeUseCaseSupport(perUseCase, useCases) {
  if (!perUseCase.length) return useCases.length ? 0.55 : 0.5;
  let sum = 0;
  for (const row of perUseCase) {
    const req = (row.requiredScore ?? 0) / 100;
    const rec = (row.recommendedScore ?? 0) / 100;
    const blended = req * 0.55 + rec * 0.45;
    sum += row.passed ? Math.max(blended, 0.72) : blended;
  }
  return Math.min(1, sum / perUseCase.length);
}

/**
 * @param {object} plan
 * @param {object[]} [useCases]
 * @param {{ roadmapCompleteness?: number }} [opts]
 */
export function computeRoadmapReadiness(plan, useCases = [], opts = {}) {
  const validation = plan?.validation || {};
  const perUseCase = validation.perUseCase || [];
  const sources = plan?.sources || [];

  let requiredSum = 0;
  let recommendedSum = 0;

  for (const row of perUseCase) {
    requiredSum += row.requiredScore ?? 0;
    recommendedSum += row.recommendedScore ?? 0;
  }

  const requiredPct = perUseCase.length ? requiredSum / perUseCase.length / 100 : (validation.score ?? 0) / 100;
  const recommendedPct = perUseCase.length ? recommendedSum / perUseCase.length / 100 : requiredPct * 0.85;
  const useCasePct = computeUseCaseSupport(perUseCase, useCases);

  const enrichmentPresent = sources.filter((s) => isEnrichmentSource(s.id)).length;
  const enrichmentPct = Math.min(1, enrichmentPresent / ENRICHMENT_CAP);

  const depthPct = computeDetectionDepthScore(sources);
  const completenessPct = computeRoadmapCompleteness(plan, opts.roadmapCompleteness);

  const crawlSize = THEME_SETS.crawl_foundational?.size || 1;
  const secSize = THEME_SETS.security_core?.size || 1;
  const cloudSize = THEME_SETS.cloud_data_risk?.size || 1;
  const themeMaturity =
    countThemeSources(sources, 'crawl_foundational') / crawlSize * 0.2 +
    countThemeSources(sources, 'security_core') / secSize * 0.45 +
    countThemeSources(sources, 'cloud_data_risk') / cloudSize * 0.35;

  const phaseMaturityPct = Math.min(1, themeMaturity + (plan.pathPhase === 'run' ? 0.12 : plan.pathPhase === 'walk' ? 0.06 : 0));

  const technicalRaw =
    WEIGHTS.required * requiredPct +
    WEIGHTS.recommended * recommendedPct +
    WEIGHTS.useCase * useCasePct +
    WEIGHTS.enrichment * enrichmentPct +
    WEIGHTS.depth * depthPct +
    WEIGHTS.completeness * completenessPct +
    WEIGHTS.phaseMaturity * phaseMaturityPct;

  const technicalScore = technicalRaw * 100;
  const progressScore = computePhaseProgressScore(plan, completenessPct);

  let score = Math.round(
    Math.min(100, Math.max(0, TECHNICAL_BLEND * technicalScore + PROGRESS_BLEND * progressScore)),
  );

  if (plan.pathPhase === 'crawl') {
    score = Math.min(score, 68);
    score = Math.max(score, Math.round(58 + completenessPct * 8));
  }

  const qualitativeLabel = getRoadmapReadinessLabel(score);

  return {
    score,
    label: ROADMAP_READINESS_LABEL,
    qualitativeLabel,
    domainCoverageScore: validation.score ?? 0,
    breakdown: {
      requiredTelemetryPct: Math.round(requiredPct * 100),
      recommendedTelemetryPct: Math.round(recommendedPct * 100),
      enrichmentContextPct: Math.round(enrichmentPct * 100),
      useCaseBreadthPct: Math.round(useCasePct * 100),
      detectionDepthPct: Math.round(depthPct * 100),
      roadmapCompletenessPct: Math.round(completenessPct * 100),
      roadmapMaturityPct: Math.round(phaseMaturityPct * 100),
    },
    enrichmentSourceCount: enrichmentPresent,
    progressScore: Math.round(progressScore),
    technicalScore: Math.round(technicalScore),
  };
}

/** @deprecated alias — use computeRoadmapReadiness */
export function computeOutcomeReadiness(plan, useCases = [], opts = {}) {
  return computeRoadmapReadiness(plan, useCases, opts);
}

/**
 * @param {object} readiness
 * @param {string} pathPhase
 * @param {number} sourceCount
 */
export function adjustReadinessForPhase(readiness, pathPhase, sourceCount) {
  if (!readiness) return readiness;
  if (pathPhase === 'run' && readiness.score < 90 && (readiness.breakdown?.roadmapCompletenessPct ?? 0) >= 85) {
    return {
      ...readiness,
      score: Math.min(98, Math.max(readiness.score, 90)),
      runCompletenessBoost: true,
    };
  }
  if (pathPhase === 'crawl' && sourceCount > 0 && readiness.score < 58) {
    return {
      ...readiness,
      score: Math.min(68, Math.max(readiness.score, 58 + Math.min(6, sourceCount))),
      crawlFloorApplied: true,
    };
  }
  return readiness;
}

/**
 * Re-score all paths using Run as the roadmap completeness target.
 * @param {object[]} plans
 * @param {object[]} useCases
 */
export function applyRoadmapReadinessToPlans(plans, useCases = []) {
  const run = plans.find((p) => p.pathPhase === 'run');
  const targetIds = new Set((run?.sources || []).map((s) => s.id));
  const targetCount = targetIds.size || 1;

  return plans.map((plan) => {
    const overlap = plan.sources.filter((s) => targetIds.has(s.id)).length;
    const completeness = overlap / targetCount;
    let readiness = computeRoadmapReadiness(plan, useCases, { roadmapCompleteness: completeness });
    readiness = adjustReadinessForPhase(readiness, plan.pathPhase, plan.sources?.length ?? 0);
    readiness.qualitativeLabel = getRoadmapReadinessLabel(readiness.score);
    const messaging = buildPathCardMessaging({ ...plan, outcomeReadiness: readiness }, useCases);
    return {
      ...plan,
      outcomeReadiness: readiness,
      roadmapCompleteness: completeness,
      pathMessaging: messaging,
      pathThemeLabel: messaging.themeLabel,
      pathValueUnlocked: messaging.cardUnlock || messaging.mainValueUnlocked,
      pathTradeoff: messaging.cardNotYet || messaging.notYetIncluded,
    };
  });
}
