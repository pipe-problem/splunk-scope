/**
 * Customer-facing value messaging — short executive copy only.
 */

import { PATH_THEME_LABELS } from './pathThemeEngine.js';

const PATH_LABEL = {
  crawl: 'Fast start',
  walk: 'Balanced',
  run: 'Target',
};

const CARD_UNLOCK = {
  crawl: 'Core SIEM',
  walk: 'Balanced security + cloud',
  run: 'Full roadmap',
};

const CARD_BEST_FOR = {
  crawl: 'Day 1 SIEM',
  walk: 'SOC + cloud balance',
  run: 'Executive roadmap',
};

const CARD_NOT_YET = {
  crawl: 'Cloud/SaaS depth',
  walk: 'Full roadmap breadth',
  run: 'Onboarding execution',
};

const BADGES = {
  crawl: null,
  walk: null,
  run: { label: 'Target', tone: 'warning' },
};

const STRIP_TAGLINE = {
  walk: 'Best balance of SOC value, cloud visibility, ingest, and time to value.',
  crawl: 'Fastest credible SIEM foundation with lowest ingest.',
  run: 'Complete target-state roadmap across security and data.',
};

const SUMMARY_UNLOCKS = {
  crawl: ['Core SIEM', 'Identity visibility', 'Endpoint + network'],
  walk: ['RBA-ready SOC', 'Cloud + SaaS context', 'Balanced ingest footprint'],
  run: ['Full security + cloud roadmap', 'SaaS and compliance coverage', 'Executive target state'],
};

const SUMMARY_ADDED_HINT = {
  crawl: [],
  walk: ['Email & productivity', 'Cloud infrastructure', 'Vulnerability management'],
  run: ['Remaining roadmap sources', 'Future-state telemetry', 'Full platform breadth'],
};

const SUMMARY_DEFERRED = {
  crawl: ['Cloud/SaaS depth'],
  walk: ['Some advanced SaaS/customer data', 'Remaining roadmap sources'],
  run: ['Onboarding execution', 'Data quality validation'],
};

const SUMMARY_DECISION = {
  crawl: ['Fastest time to value', 'Lowest ingest footprint'],
  walk: ['Best balance of value and ingest', 'Recommended commercial launch path'],
  run: ['Full target-state roadmap', 'Highest long-term value'],
};

const EXECUTIVE_WHY_UPGRADE = {
  crawl: ['Walk adds balanced SOC + cloud depth', 'Run completes roadmap'],
  walk: ['Run completes all configured sources'],
  run: [],
};

const EXECUTIVE_RISKS = {
  crawl: {
    title: 'Foundation gaps',
    impact: 'Cloud, SaaS, and data-risk visibility remain limited.',
    mitigation: 'Walk for balanced SOC + cloud coverage, or Run for full roadmap.',
  },
  walk: {
    title: 'Next expansion',
    impact: 'Some advanced SaaS and compliance sources remain for Run.',
    mitigation: 'Run when full target-state coverage is the priority.',
  },
  run: {
    title: 'Execution risk',
    impact: 'Roadmap is largely complete; onboarding and data quality remain.',
    mitigation: 'Phased rollout with 24-hour source validation.',
  },
};

function resolveThemeKey(plan) {
  const phase = plan.pathPhase || 'crawl';
  if (phase === 'walk') return 'walk';
  return phase;
}

/** @deprecated — comparison board does not use chips */
export function buildPathChips() {
  return [];
}

/**
 * @param {object} plan
 */
export function buildPathCardMessaging(plan) {
  const themeKey = resolveThemeKey(plan);
  const themeLabel = PATH_THEME_LABELS[themeKey] || plan.pathSubtitle || '';
  const badge = BADGES[themeKey] || null;
  const pathLabel = PATH_LABEL[themeKey] || '';
  const cardUnlock = CARD_UNLOCK[themeKey] || '';
  const cardBestFor = CARD_BEST_FOR[themeKey] || '';
  const cardNotYet = CARD_NOT_YET[themeKey] || '';

  return {
    themeKey,
    themeLabel,
    pathLabel,
    badge,
    cardUnlock,
    cardBestFor,
    cardNotYet,
    chips: [],
    heroTagline: STRIP_TAGLINE[themeKey] || '',
    mainValueUnlocked: cardUnlock,
    notYetIncluded: cardNotYet,
    tradeoff: cardNotYet,
    summaryUnlocks: SUMMARY_UNLOCKS[themeKey] || [],
    summaryAddedHint: SUMMARY_ADDED_HINT[themeKey] || [],
    summaryDeferred: SUMMARY_DEFERRED[themeKey] || [],
    summaryDecision: SUMMARY_DECISION[themeKey] || [],
    whyUpgrade: EXECUTIVE_WHY_UPGRADE[themeKey] || [],
    executive: {
      whatYouGet: SUMMARY_UNLOCKS[themeKey] || [],
      notYetIncluded: SUMMARY_DEFERRED[themeKey] || [],
      whyUpgrade: EXECUTIVE_WHY_UPGRADE[themeKey] || [],
      bestFit: SUMMARY_DECISION[themeKey] || [],
    },
    executiveRisk: EXECUTIVE_RISKS[themeKey],
  };
}
