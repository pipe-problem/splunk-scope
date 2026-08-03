/**
 * Architecture path themes — deterministic source grouping for Crawl / Walk A / Walk B / Run.
 */

import pathThemes from '../data/pathThemes.json';
import { strengthToScore } from './strengthScores.js';

const THEME_SETS = {
  crawl_foundational: new Set(pathThemes.crawl_foundational || []),
  security_core: new Set(pathThemes.security_core || []),
  cloud_data_risk: new Set(pathThemes.cloud_data_risk || []),
  enrichment_context: new Set(pathThemes.enrichment_context || []),
};

export const PATH_THEME_LABELS = {
  crawl: 'Foundational',
  walk: 'Balanced Recommended',
  run: 'Target Roadmap',
};

/** @param {string} sourceId */
export function getSourceThemes(sourceId) {
  const themes = [];
  for (const [name, set] of Object.entries(THEME_SETS)) {
    if (set.has(sourceId)) themes.push(name);
  }
  return themes;
}

/** @param {string} sourceId @param {string} themeKey */
export function sourceInTheme(sourceId, themeKey) {
  const set = THEME_SETS[themeKey];
  return set ? set.has(sourceId) : false;
}

/** @param {string} sourceId */
export function isEnrichmentSource(sourceId) {
  return THEME_SETS.enrichment_context.has(sourceId);
}

/**
 * @param {object[]} sourcesA
 * @param {object[]} sourcesB
 * @param {string[]} [crawlIds] — IDs treated as shared baseline (excluded from overlap ratio)
 */
export function computeSourceOverlapRatio(sourcesA, sourcesB, crawlIds = []) {
  const crawlSet = new Set(crawlIds);
  const idsA = new Set(sourcesA.map((s) => s.id).filter((id) => !crawlSet.has(id)));
  const idsB = new Set(sourcesB.map((s) => s.id).filter((id) => !crawlSet.has(id)));
  if (idsB.size === 0) return 0;
  let shared = 0;
  for (const id of idsB) {
    if (idsA.has(id)) shared += 1;
  }
  return shared / idsB.size;
}

/**
 * Rank pool candidates for a theme (higher = prefer first).
 * @param {object} pool
 * @param {string} themeKey
 * @param {object[]} selected
 * @param {{ preferCurrent?: boolean }} opts
 */
export function rankCandidatesForTheme(pool, themeKey, selected, opts = {}) {
  const selectedIds = new Set(selected.map((s) => s.id));
  const preferCurrent = opts.preferCurrent !== false;

  return pool.candidates
    .filter((c) => !selectedIds.has(c.id))
    .filter((c) => sourceInTheme(c.id, themeKey))
    .map((c) => {
      let rank = c.priorityScore + c.valuePerGb * 4;
      if (preferCurrent && c.status === 'current') rank += 25;
      if (c.status === 'future') rank += 8;
      rank += c.gb > 0 ? Math.min(20, 10 / c.gb) : 0;
      return { ...c, rank };
    })
    .sort((a, b) => b.rank - a.rank);
}

/**
 * @param {object[]} sources
 * @param {string} themeKey
 */
export function countThemeSources(sources, themeKey) {
  return sources.filter((s) => sourceInTheme(s.id, themeKey)).length;
}

/**
 * Detection depth: complementary signals per risk area — requires multiple sources
 * and domains; single-source saturation cannot yield 100%.
 * @param {object[]} sources
 */
export function computeDetectionDepthScore(sources) {
  const groups = pathThemes.depth_signal_groups || [];
  if (!groups.length || !sources?.length) return 0;

  let total = 0;

  for (const group of groups) {
    const distinctSources = new Set();
    let domainsHit = 0;
    let strongDomains = 0;

    for (const source of sources) {
      if (!source.telemetryDomains) continue;
      let sourceContributed = false;
      for (const domain of group) {
        const strength = source.telemetryDomains[domain];
        const score = strengthToScore(strength);
        if (score >= 0.5) {
          domainsHit += 1;
          if (score >= 0.9) strongDomains += 1;
          sourceContributed = true;
        }
      }
      if (sourceContributed) distinctSources.add(source.id);
    }

    const nSources = distinctSources.size;
    const nDomains = domainsHit;
    const groupSize = group.length;

    let tier = 0;
    if (nSources >= 1 && nDomains >= 1) tier = 0.2;
    if (nSources >= 2 && nDomains >= 2) tier = 0.45;
    if (nSources >= 3 && nDomains >= Math.min(3, groupSize)) tier = 0.65;
    if (nSources >= 4 && strongDomains >= 2) tier = 0.82;
    if (nSources >= 5 && nDomains >= groupSize && strongDomains >= 2) tier = 0.95;

    total += tier;
  }

  return Math.min(1, total / groups.length);
}

export { pathThemes, THEME_SETS };
