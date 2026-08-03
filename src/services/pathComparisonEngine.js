/**
 * Path comparison deltas — upsell messaging vs prior path.
 */

import { buildPathCardMessaging } from './pathValueMessagingEngine.js';

/**
 * @param {object} plan
 * @param {object|null} prevPlan
 * @param {object} [opts]
 */
export function computePathComparison(plan, prevPlan, opts = {}) {
  if (!plan) return null;
  if (!prevPlan) {
    return {
      sourceDelta: 0,
      ingestDeltaGb: 0,
      readinessDelta: 0,
      coverageDelta: 0,
      addedSources: [],
      addedSourceDetails: [],
      summary: null,
    };
  }

  const prevExp = prevPlan.totals?.buffered?.expected ?? prevPlan.totals?.expected ?? 0;
  const exp = plan.totals?.buffered?.expected ?? plan.totals?.expected ?? 0;
  const prevSources = prevPlan.sources?.length ?? 0;
  const sources = plan.sources?.length ?? 0;
  const prevReadiness = prevPlan.outcomeReadiness?.score ?? prevPlan.validation?.score ?? 0;
  const readiness = plan.outcomeReadiness?.score ?? plan.validation?.score ?? 0;
  const prevCov = prevPlan.validation?.score ?? 0;
  const cov = plan.validation?.score ?? 0;

  const prevIds = new Set((prevPlan.sources || []).map((s) => s.id));
  const added = (plan.sources || []).filter((s) => !prevIds.has(s.id));
  const addedNames = added.map((s) => s.name);

  const messaging = buildPathCardMessaging(plan, opts.useCases || []);
  const prevName = prevPlan.name || 'previous path';
  const ingestDelta = exp - prevExp;
  const readinessDelta = readiness - prevReadiness;

  let summary = null;
  if (plan.pathPhase !== 'crawl') {
    const parts = [];
    if (added.length > 0) parts.push(`${added.length} source${added.length !== 1 ? 's' : ''}`);
    if (Math.abs(ingestDelta) >= 0.1) {
      parts.push(`${ingestDelta >= 0 ? '+' : ''}${ingestDelta.toFixed(1)} GB/day`);
    }
    if (readinessDelta !== 0) {
      parts.push(`${readinessDelta >= 0 ? '+' : ''}${readinessDelta} roadmap readiness`);
    }
    const unlock = messaging.mainValueUnlocked;
    summary =
      parts.length > 0
        ? `Compared with ${prevName}, this path adds ${parts.join(', ')}. ${unlock}`
        : `Compared with ${prevName}: ${unlock}`;
  }

  return {
    sourceDelta: sources - prevSources,
    ingestDeltaGb: ingestDelta,
    readinessDelta,
    coverageDelta: cov - prevCov,
    addedSources: addedNames.slice(0, 8),
    addedSourceDetails: added.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category || 'Uncategorized',
    })),
    newOutcomes: messaging.whatYouGet?.slice(0, 3) || [],
    summary,
  };
}

/**
 * @param {object[]} plans
 * @param {object[]} [useCases]
 */
export function attachPathComparisons(plans, useCases = []) {
  return plans.map((plan, idx) => ({
    ...plan,
    pathComparison: computePathComparison(plan, idx > 0 ? plans[idx - 1] : null, { useCases }),
  }));
}
