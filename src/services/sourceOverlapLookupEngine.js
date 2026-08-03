/**
 * Lookup overlap relationships between two catalog sources for workshop UI.
 */
import recommendationRules from '../data/sourceRecommendationRules.json' with { type: 'json' };
import overlapTelemetryCopy from '../data/overlapTelemetryCopy.json' with { type: 'json' };
import overlapPeersDoc from '../data/sourceOverlapPeers.json' with { type: 'json' };
import { OVERLAP_GROUPS } from './overlapEngine.js';

const SUBSTITUTION_RULES = recommendationRules.substitutionRules || [];
const TELEMETRY_PAIRS = overlapTelemetryCopy.pairs || {};
const MANUAL_PEERS = overlapPeersDoc.sources || {};

export function pairKey(sourceIdA, sourceIdB) {
  return [sourceIdA, sourceIdB].sort().join('__');
}

/**
 * @param {string} sourceId
 * @returns {string[]}
 */
export function getLikelyPeerSourceIds(sourceId) {
  const peers = new Set(MANUAL_PEERS[sourceId]?.likelyPeerSourceIds || []);

  for (const group of Object.values(OVERLAP_GROUPS)) {
    if (group.members?.includes(sourceId)) {
      group.members.filter((m) => m !== sourceId).forEach((m) => peers.add(m));
    }
    for (const pair of group.pairs || []) {
      if (pair.sources?.includes(sourceId)) {
        pair.sources.filter((s) => s !== sourceId).forEach((s) => peers.add(s));
      }
    }
  }

  for (const rule of SUBSTITUTION_RULES) {
    const prim = rule.primarySources || [];
    const down = rule.downgradeSources || [];
    if (prim.includes(sourceId)) down.forEach((s) => peers.add(s));
    if (down.includes(sourceId)) prim.forEach((s) => peers.add(s));
  }

  return [...peers].sort();
}

/**
 * @param {string} sourceIdA
 * @param {string} sourceIdB
 * @returns {{
 *   verdict: 'may_overlap' | 'unlikely_overlap' | 'unknown',
 *   summary: string,
 *   sharedTelemetry: Array<{ label: string, example?: string }>,
 *   ruleId?: string,
 * } | null}
 */
export function evaluatePair(sourceIdA, sourceIdB) {
  if (!sourceIdA || !sourceIdB || sourceIdA === sourceIdB) return null;

  const key = pairKey(sourceIdA, sourceIdB);
  const copy = TELEMETRY_PAIRS[key];

  let matchedRule = null;
  for (const rule of SUBSTITUTION_RULES) {
    const prim = rule.primarySources || [];
    const down = rule.downgradeSources || [];
    const aPrimaryBDown = prim.includes(sourceIdA) && down.includes(sourceIdB);
    const bPrimaryADown = prim.includes(sourceIdB) && down.includes(sourceIdA);
    if (aPrimaryBDown || bPrimaryADown) {
      matchedRule = rule;
      break;
    }
  }

  let groupContext = null;
  for (const group of Object.values(OVERLAP_GROUPS)) {
    for (const pair of group.pairs || []) {
      const [s0, s1] = pair.sources || [];
      if (s0 && s1 && pairKey(s0, s1) === key) {
        groupContext = { group, pair };
        break;
      }
    }
  }

  if (copy || matchedRule || groupContext) {
    return {
      verdict: 'may_overlap',
      summary:
        copy?.summary ||
        matchedRule?.reasonTemplate ||
        groupContext?.group.warning ||
        'These sources may share telemetry — validate before counting both toward ingest.',
      sharedTelemetry: copy?.sharedTelemetry || [],
      ruleId: matchedRule?.id,
    };
  }

  for (const group of Object.values(OVERLAP_GROUPS)) {
    if (group.members?.includes(sourceIdA) && group.members?.includes(sourceIdB)) {
      return {
        verdict: 'unknown',
        summary:
          group.warning ||
          'These sources sit in the same overlap family — confirm with the customer whether logs are distinct.',
        sharedTelemetry: [],
      };
    }
  }

  return {
    verdict: 'unlikely_overlap',
    summary:
      'No catalogued overlap rule links these sources. They are usually sized independently — still confirm logging paths in the customer environment.',
    sharedTelemetry: [],
  };
}
