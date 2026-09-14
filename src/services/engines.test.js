/**
 * Vitest engine tests — validates core engine behavior for v1.8.
 * Migrates key assertions from the custom testHarness into a standard framework.
 */
import { describe, it, expect } from 'vitest';
import { calculateCoverage, validateMultiUseCase, calculateSplitCoverage } from './coverageEngine.js';
import { OVERLAP_GROUPS, detectActiveOverlaps } from './overlapEngine.js';
import { flattenSourceCatalog, calculateSourceSize, calculateTotals } from './sizingEngine.js';
import { generatePlans } from './planEngine.js';
import { normalizeChartSlicesForDisplay, getActualTooltipData } from './chartDisplayEngine.js';
import { computeIngestBudgetFromIntake, getIngestRateUsdPerGb } from './budgetEngine.js';
import { sourceCountsTowardTotals, calculateFullSourceIngest, getOverlapExcludedIds } from './sourceEligibilityEngine.js';
import { migrateSession, isValidSessionState, CURRENT_SCHEMA_VERSION } from './sessionMigrationEngine.js';
import { interpretInputs } from './interpretationEngine.js';
import {
  prioritizeAndSortSources,
  getTopSuggestedSources,
  getBudgetSensitivityBand,
  sortSourcesByPriority,
} from './sourcePrioritizationEngine.js';
import { classifyAndSortSources } from './sourceRecommendationEngine.js';
import {
  recommendApps,
  recommendAppsFromSession,
  flattenRecommendationNames,
} from './appRecommendationEngine.js';
import { assessEnterpriseSecurityEligibility } from './enterpriseSecurityEligibilityEngine.js';
import originalSizingRates from '../data/originalSizingRates.json';
import {
  resolveCanonicalAppId,
  getAppCatalogEntry,
  sourceMatchesAppInterest,
} from './appCatalogService.js';
import {
  buildReportExportPayload,
  generateValueProposalPdf,
  generateStartupGuidePdf,
  generateCustomerPdf,
  generateCustomerPptx,
  generateCustomerPlanningPackPdf,
  validateExportContent,
  validateValueProposalContent,
  validateStartupGuideContent,
  formatNumberedList,
  formatIngestWithUnit,
  toReadableString,
  enrichSourceRowsForExport,
  buildValueGroups,
  EXPORT_DISCLAIMER_FULL,
  EXPORT_OFFICIAL_LINKS,
} from './reportExportEngine.js';
import { normalizePdfText } from './exportShared.js';
import { applyPlanningBufferToSource } from '../utils/bufferBand.js';
import sourceCatalog from '../data/sources.json';
import useCaseProfiles from '../data/useCaseProfiles.json';
import sampleScenarios, { getSampleScenarioById } from '../data/sampleScenarios.js';
import { buildFullSessionExport } from '../utils/sessionExport.js';
import { generatePathDisplayName, enrichPlanWithDynamicName } from './pathNamingEngine.js';
import { searchSourceCatalog } from './sourceSearchEngine.js';
import { buildSourceBriefText } from './sourceExportEngine.js';
import { resolveUseCaseProfiles } from './useCaseResolver.js';
import { generateExecutiveSummary } from './valuePropEngine.js';
import {
  sumSessionPlanningIngest,
  sumPlanningIngestForSources,
  getEligibleConfiguredSources,
} from './planningIngestTotals.js';
import { resolvePrimaryQuantity } from './simpleSizingEngine.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const foundational = useCaseProfiles.find((uc) => uc.id === 'foundational_security');

function statesWith(ids, status = 'current') {
  const out = {};
  for (const id of ids) {
    out[id] = { status, number_of_users: 5000, number_of_endpoints: 2000, number_of_systems: 4, count: 4, vendor: 'Check Point', logging_scope: 'Traffic + threat prevention' };
  }
  return out;
}

function sourceSetKey(sources) {
  return [...sources]
    .map((s) => s.id)
    .sort()
    .join('|');
}

describe('Coverage Engine', () => {
  it('returns zero scores with no sources', () => {
    const c = calculateCoverage([]);
    expect(Object.values(c).every((v) => v.score === 0)).toBe(true);
  });

  it('validateMultiUseCase with no use cases reports not passed', () => {
    const cov = calculateCoverage([]);
    const r = validateMultiUseCase(cov, []);
    expect(r.passed).toBe(false);
  });

  it('empty session with use cases scores 0', () => {
    const cov = calculateCoverage([]);
    const r = validateMultiUseCase(cov, [foundational]);
    expect(r.overallScore).toBe(0);
  });
});

describe('Overlap Engine', () => {
  it('defines network_security_controls group', () => {
    expect(OVERLAP_GROUPS.network_security_controls?.members?.length).toBeGreaterThan(0);
    expect(Array.isArray(OVERLAP_GROUPS.network_security_controls.pairs)).toBe(true);
  });
});

describe('Sizing Engine', () => {
  it('flattenSourceCatalog returns entries', () => {
    expect(flatCatalog.length).toBeGreaterThan(10);
  });

  it('handles manual override', () => {
    const r = calculateSourceSize({ sizing_formula: { primary_input: 'count', rate_per_unit: 1 } }, { override: '100' });
    expect(r.expected).toBe(100);
  });

  it('exposes low/expected/high bands', () => {
    const r = calculateSourceSize({ sizing_formula: { primary_input: 'count', rate_per_unit: 5 } }, { count: 10 });
    expect(r.low).toBeDefined();
    expect(r.expected).toBeDefined();
    expect(r.high).toBeDefined();
  });

  it('calculateTotals sums per-source planning buffer (fixed 20%): 10+20+30 → low 48, expected 60, high 72', () => {
    const totals = calculateTotals({
      a: { expected: 10 },
      b: { expected: 20 },
      c: { expected: 30 },
    });
    expect(totals.expected).toBe(60);
    expect(totals.low).toBeCloseTo(48, 5);
    expect(totals.high).toBeCloseTo(72, 5);
  });
});

describe('Plan Engine', () => {
  it('generates three architecture paths (crawl, walk, run)', () => {
    const states = statesWith(['active_directory', 'firewalls', 'windows_servers']);
    const plans = generatePlans(flatCatalog, states, [foundational], [], {}, 0.2);
    expect(plans.length).toBe(3);
    expect(plans.map((p) => p.name)).toEqual(['Crawl', 'Walk', 'Run']);
  });

  it('run uses at least as many sources as crawl (no budget)', () => {
    const states = statesWith(['active_directory', 'firewalls', 'edr', 'windows_servers']);
    states.edr = { ...states.edr, status: 'future' };
    const plans = generatePlans(flatCatalog, states, [foundational], [], {}, 0.2);
    expect(plans[2].sources.length).toBeGreaterThanOrEqual(plans[0].sources.length);
  });

  it('with planning budget, Phase 1 path totals reflect configured ingest; Phase 2 lists budget headroom', () => {
    const ids = ['active_directory', 'firewalls', 'windows_servers', 'dns', 'proxy', 'edr'];
    const states = {};
    for (const id of ids) {
      states[id] = {
        status: 'current',
        number_of_users: 200,
        number_of_systems: 4,
        number_of_dcs: 2,
        number_of_endpoints: 200,
        number_of_servers: 15,
        count: 45,
        vendor: 'Check Point',
        logging_scope: 'Traffic + threat prevention',
      };
    }
    const budgetGbDay = 200;
    const plans = generatePlans(flatCatalog, states, [foundational], [], {}, 0.2, {
      budgetGbDay,
      primaryProfileId: 'foundational_security',
    });
    expect(plans.length).toBe(3);
    const crawl = plans[0];
    const walk = plans[1];
    const run = plans[2];

    expect(walk.totals.buffered.expected).toBeGreaterThanOrEqual(crawl.totals.buffered.expected);
    expect(walk.totals.buffered.expected).toBeGreaterThan(0);
    expect(walk.name).toBe('Walk');
    expect(run.name).toBe('Run');

    expect(walk.hasBudgetHeadroom).toBe(true);
    expect(walk.phase2Suggestions.length).toBeGreaterThan(0);
    const phase2Gb = walk.phase2Totals.buffered.expected;
    expect(phase2Gb).toBeGreaterThan(0);
    expect(walk.totals.buffered.expected + phase2Gb).toBeGreaterThan(walk.totals.buffered.expected);

    // User device counts are never inflated to hit budget.
    for (const id of ids) {
      expect(states[id].number_of_users).toBe(200);
    }
  });

  it('Robbins retail stack: calibrated configured ingest stays under budget', () => {
    const robbins = sampleScenarios.find((s) => s.id === 'robbins_retail_hybrid');
    expect(robbins).toBeTruthy();
    const { profiles } = resolveUseCaseProfiles(robbins.intake);
    const budgetGbDay = computeIngestBudgetFromIntake(robbins.intake).budgetGbDay;
    expect(budgetGbDay).toBeCloseTo(150, 0);
    const plans = generatePlans(flatCatalog, robbins.sources, profiles, [], robbins.overlapDecisions, 0.2, { budgetGbDay });
    const [crawl, walk, run] = plans;
    const sizingCtx = { catalog: sourceCatalog, allInputs: robbins.sources };

    const sessionTotals = sumSessionPlanningIngest({
      catalog: sourceCatalog,
      sourceStates: robbins.sources,
      overlapDecisions: robbins.overlapDecisions,
      sizingContext: sizingCtx,
    });

    expect(sessionTotals.totals.buffered.expected).toBeLessThan(budgetGbDay);
    expect(crawl.totals.buffered.expected).toBeLessThanOrEqual(walk.totals.buffered.expected + 0.01);
    expect(walk.totals.buffered.expected).toBeLessThanOrEqual(budgetGbDay * 1.05);
    expect(run.totals.buffered.expected).toBeGreaterThanOrEqual(crawl.totals.buffered.expected * 0.95);

    const distinctRounded = new Set(plans.map((p) => Math.round(p.totals.buffered.expected * 10) / 10));
    expect(distinctRounded.size).toBeGreaterThan(1);
  });

  it('KPI reconciliation: Robbins session total matches Review/Coverage; overlap does not reduce totals', () => {
    const robbins = sampleScenarios.find((s) => s.id === 'robbins_retail_hybrid');
    const { profiles } = resolveUseCaseProfiles(robbins.intake);
    const sizingCtx = { catalog: sourceCatalog, allInputs: robbins.sources };
    const sessionA = sumSessionPlanningIngest({
      catalog: sourceCatalog,
      sourceStates: robbins.sources,
      overlapDecisions: robbins.overlapDecisions,
      sizingContext: sizingCtx,
    });
    const sessionB = sumSessionPlanningIngest({
      catalog: sourceCatalog,
      sourceStates: robbins.sources,
      overlapDecisions: robbins.overlapDecisions,
      sizingContext: sizingCtx,
    });
    expect(sessionA.totals.expected).toBeCloseTo(sessionB.totals.expected, 5);

    const excludedIds = getOverlapExcludedIds(robbins.overlapDecisions);
    expect(excludedIds).toEqual([]);

    const eligible = getEligibleConfiguredSources({
      catalog: sourceCatalog,
      sourceStates: robbins.sources,
      overlapDecisions: robbins.overlapDecisions,
      sizingContext: sizingCtx,
    });
    const reviewSum = eligible.reduce((acc, s) => acc + (s.rawExpected ?? 0), 0);
    expect(sessionA.totals.expected).toBeCloseTo(reviewSum, 5);

    const plans = generatePlans(flatCatalog, robbins.sources, profiles, [], robbins.overlapDecisions, 0.2, {
      budgetGbDay: computeIngestBudgetFromIntake(robbins.intake).budgetGbDay,
    });
    const walk = plans.find((p) => p.pathPhase === 'walk') || plans[1];
    expect(walk.totals.buffered.expected).toBeLessThanOrEqual(sessionA.totals.buffered.expected + 0.01);
    expect(walk.totals.buffered.expected).toBeLessThan(computeIngestBudgetFromIntake(robbins.intake).budgetGbDay * 1.05);
  });
});

describe('Simple sizing engine', () => {
  it('firewalls: 6 devices × 1 GB/day with 0.8/1.2 low/high bands', () => {
    const fw = flatCatalog.find((s) => s.id === 'firewalls');
    const sourceState = { status: 'current', number_of_systems: 6 };
    expect(resolvePrimaryQuantity('firewalls', sourceState)).toBe(6);

    const ctx = { catalog: sourceCatalog, allInputs: { firewalls: sourceState } };
    const result = calculateFullSourceIngest(fw, sourceState, ctx);
    expect(result.expected).toBe(6);
    expect(result.low).toBeCloseTo(4.8, 5);
    expect(result.high).toBeCloseTo(7.2, 5);
    expect(result.unit).toBe('firewall devices total');
    expect(result.quantity).toBe(6);
    expect(result.rateSource).toBe('original_calculator');
  });

  it('Review builder and session totals use the same calculateFullSourceIngest helper', () => {
    const sourceStates = {
      firewalls: { status: 'current', number_of_systems: 6 },
    };
    const sizingCtx = { catalog: sourceCatalog, allInputs: sourceStates };
    const fw = flatCatalog.find((s) => s.id === 'firewalls');
    const direct = calculateFullSourceIngest(fw, sourceStates.firewalls, sizingCtx);

    const eligible = getEligibleConfiguredSources({
      catalog: sourceCatalog,
      sourceStates,
      sizingContext: sizingCtx,
    });
    const row = eligible.find((s) => s.id === 'firewalls');
    expect(row.rawExpected).toBeCloseTo(direct.expected, 5);
    expect(row.gbExpected).toBeCloseTo(direct.expected, 5);

    const session = sumSessionPlanningIngest({
      catalog: sourceCatalog,
      sourceStates,
      sizingContext: sizingCtx,
    });
    expect(session.totals.expected).toBeCloseTo(direct.expected, 5);
  });
});

describe('Chart display engine', () => {
  it('keeps actual values separate from display sizing', () => {
    const slices = normalizeChartSlicesForDisplay([
      { label: 'Big', value: 90 },
      { label: 'Tiny', value: 2 },
    ]);
    expect(slices.length).toBe(2);
    const tiny = slices.find((s) => s.label === 'Tiny');
    expect(tiny.actualValue).toBe(2);
    expect(tiny.displayPercent).toBeGreaterThanOrEqual(4);
    const tip = getActualTooltipData(tiny);
    expect(tip.lines[0]).toContain('2.0');
    expect(tip.lines[0]).toContain('actual');
  });

  it('groups excess slices into Other', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ label: `S${i}`, value: i + 1 }));
    const slices = normalizeChartSlicesForDisplay(items, { maxSlices: 6 });
    expect(slices.some((s) => s.label === 'Other')).toBe(true);
  });
});

describe('Interpretation engine', () => {
  it('exposes narrative keyword mappings for advanced details', () => {
    const r = interpretInputs({
      deploymentType: 'cloud',
      useCases: ['Foundational Security / InfoSec'],
      goals: 'SIEM and threat detection for the SOC',
      customUseCases: 'Prioritize Enterprise Security content',
    });
    expect(r.narrativeKeywordMappings?.length).toBeGreaterThan(0);
    expect(r.narrativeKeywordMappings[0].keyword).toBeTruthy();
    expect(r.narrativeKeywordMappings[0].profileName).toBeTruthy();
  });
});

describe('Budget engine', () => {
  it('computes GB/day budget from opportunity amount (internal)', () => {
    const r = computeIngestBudgetFromIntake({ opportunityBudgetUsd: '100000', deploymentType: 'cloud' });
    expect(r.budgetGbDay).toBeCloseTo(100, 0);
    expect(r.source).toBe('usd');
    const r2 = computeIngestBudgetFromIntake({ opportunityBudgetUsd: '650000', deploymentType: 'cloud' });
    expect(r2.budgetGbDay).toBeCloseTo(650, 0);
    expect(getIngestRateUsdPerGb('onprem')).toBe(650);
    expect(getIngestRateUsdPerGb('cloud')).toBe(1000);
    expect(getIngestRateUsdPerGb('hybrid')).toBe(1000);
  });

  it('budgetGbDayOverride beats opportunityBudgetUsd conversion', () => {
    const r = computeIngestBudgetFromIntake({
      opportunityBudgetUsd: '1000000',
      budgetGbDayOverride: 42,
      deploymentType: 'cloud',
    });
    expect(r.budgetGbDay).toBe(42);
    expect(r.source).toBe('override');
  });
});

describe('Session Migration', () => {
  it('current schema loads without migration', () => {
    const { state, migrated } = migrateSession({ schemaVersion: CURRENT_SCHEMA_VERSION, intake: {}, sources: {}, currentStep: 0 });
    expect(migrated).toBe(false);
    expect(state).toBeTruthy();
  });

  it('old schema migrates to current', () => {
    const { state, migrated } = migrateSession({ intake: {}, sources: {}, currentStep: 0 });
    expect(migrated).toBe(true);
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('invalid data does not crash', () => {
    const { error } = migrateSession(null);
    expect(error).toBeTruthy();
  });
});

describe('Source Eligibility', () => {
  it('0 GB/day source excluded from totals', () => {
    const source = flatCatalog.find((s) => s.id === 'active_directory');
    const counts = sourceCountsTowardTotals(source, { status: 'current' }, { expected: 0 }, new Set());
    expect(counts).toBe(false);
  });
});

describe('v1.8 Bug Fixes', () => {
  it('Home Load Example payload has intake and sources', () => {
    const scenario = sampleScenarios[0];
    expect(scenario).toBeTruthy();
    expect(scenario.intake).toBeTruthy();
    expect(scenario.sources).toBeTruthy();
    expect(typeof scenario.intake).toBe('object');
    expect(typeof scenario.sources).toBe('object');
  });
});

describe('v1.8.1 Interpretation Stale Detection', () => {
  function intakeKey(intake) {
    return JSON.stringify([
      intake.useCases,
      intake.customUseCases,
      intake.desiredApps,
      intake.deploymentType,
      intake.crawlGoal,
      intake.walkGoal,
      intake.runGoal,
    ]);
  }

  const baseIntake = {
    customerName: 'Test Corp',
    deploymentType: 'cloud',
    useCases: ['foundational_security'],
    customUseCases: '',
    desiredApps: [],
    crawlGoal: 'basic monitoring',
    walkGoal: '',
    runGoal: '',
    discoveryNotes: '',
    importedContext: null,
  };

  it('intakeKey changes when use cases change', () => {
    const key1 = intakeKey(baseIntake);
    const modified = { ...baseIntake, useCases: ['foundational_security', 'siem'] };
    const key2 = intakeKey(modified);
    expect(key1).not.toBe(key2);
  });

  it('intakeKey is stable for identical intake', () => {
    const key1 = intakeKey(baseIntake);
    const key2 = intakeKey({ ...baseIntake });
    expect(key1).toBe(key2);
  });

  it('stored key detects stale interpretation after intake changes', () => {
    const result1 = interpretInputs(baseIntake);
    const storedKey = intakeKey(baseIntake);
    expect(result1).toBeTruthy();

    const modifiedIntake = { ...baseIntake, useCases: ['foundational_security', 'insider_threat'] };
    const currentKey = intakeKey(modifiedIntake);
    expect(storedKey).not.toBe(currentKey);
  });

  it('re-analysis updates stored key to match current intake', () => {
    const modifiedIntake = { ...baseIntake, useCases: ['foundational_security', 'insider_threat'] };
    const result2 = interpretInputs(modifiedIntake);
    const newStoredKey = intakeKey(modifiedIntake);
    expect(result2).toBeTruthy();
    expect(newStoredKey).toBe(intakeKey(modifiedIntake));
  });

  it('no stale warning when keys match', () => {
    const result = interpretInputs(baseIntake);
    const storedKey = intakeKey(baseIntake);
    const currentKey = intakeKey(baseIntake);
    expect(storedKey).toBe(currentKey);
    expect(result).toBeTruthy();
  });
});

describe('v1.8.1 CSS Keyframe Uniqueness', () => {
  it('index.css has no duplicate @keyframes names', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/index.css', 'utf-8');
    const matches = [...css.matchAll(/@keyframes\s+([\w-]+)/g)];
    const names = matches.map((m) => m[1]);
    const dupes = names.filter((name, i) => names.indexOf(name) !== i);
    expect(dupes).toEqual([]);
  });
});

/**
 * v1.9.0 — Comprehensive Sizing Validation
 * Tests all source types across multiple input quantities against
 * expected values from the ORIGINAL Sizing Calculator spreadsheet.
 */
describe('v1.9 Sizing Accuracy Validation', () => {
  const entries = originalSizingRates.entries || {};

  function workbookSpec(sourceId, tolerance = 0.15) {
    const entry = entries[sourceId];
    if (!entry) throw new Error(`missing workbook entry for ${sourceId}`);
    return {
      unit: entry.primaryInputField,
      rate: entry.rateGbPerUnit,
      tolerance,
    };
  }

  /** Workbook-aligned rates (ORIGINAL Sizing Calculator). */
  const EXPECTED_RATES = {
    firewalls: workbookSpec('firewalls'),
    windows_servers: workbookSpec('windows_servers'),
    linux_servers: workbookSpec('linux_servers'),
    proxy: workbookSpec('proxy', 0.03),
    edr: workbookSpec('edr', 0.01),
    active_directory: workbookSpec('active_directory'),
    dns: workbookSpec('dns', 0.05),
    vpn: workbookSpec('vpn', 0.0005),
  };

  const TEST_QUANTITIES = [1, 5, 10, 50, 100, 500, 1000, 5000, 10000, 50000];

  for (const [sourceId, spec] of Object.entries(EXPECTED_RATES)) {
    describe(`${sourceId}`, () => {
      const source = flatCatalog.find((s) => s.id === sourceId);

      it('exists in catalog', () => {
        expect(source).toBeTruthy();
      });

      for (const qty of TEST_QUANTITIES) {
        it(`${qty} units produces reasonable output`, () => {
          if (!source) return;
          const inputState = { status: 'current', [spec.unit]: qty };
          const result = calculateSourceSize(source, inputState);
          const expectedGb = qty * spec.rate;
          const lowerBound = expectedGb * 0.3;
          const upperBound = expectedGb * 3.0;

          expect(result.expected).toBeGreaterThan(0);
          expect(result.expected).toBeGreaterThanOrEqual(lowerBound);
          expect(result.expected).toBeLessThanOrEqual(upperBound);
          expect(result.low).toBeLessThanOrEqual(result.expected);
          expect(result.high).toBeGreaterThanOrEqual(result.expected);
        });
      }

      it('vendor + scope narrows confidence', () => {
        if (!source) return;
        const inputState = { status: 'current', [spec.unit]: 100, vendor: 'Check Point', logging_scope: 'Traffic + threat prevention' };
        const result = calculateSourceSize(source, inputState);
        expect(result.expected).toBeGreaterThan(0);
        expect(['medium', 'high']).toContain(result.confidence);
      });

      it('no input returns zero', () => {
        if (!source) return;
        const result = calculateSourceSize(source, { status: 'current' });
        expect(result.expected).toBe(0);
        expect(result.confidence).toBe('none');
      });

      it('manual override takes precedence', () => {
        if (!source) return;
        const result = calculateSourceSize(source, { status: 'current', [spec.unit]: 100, override: '42.5' });
        expect(result.expected).toBe(42.5);
        expect(result.rateSource).toBe('manual');
      });
    });
  }

  describe('SSO workbook simple sizing (saas_sso)', () => {
    const source = flatCatalog.find((s) => s.id === 'saas_sso');

    it('sizes active users × workbook rate in default configure path', () => {
      const r = calculateSourceSize(source, {
        status: 'current',
        vendor: 'Okta',
        ssoActiveUserCount: '500',
      });
      expect(r.rateSource).toBe('workbook_simple');
      expect(r.expected).toBeCloseTo(2.5, 2);
    });

    it('legacy count maps to active users via workbook simple rate', () => {
      const r = calculateSourceSize(source, { status: 'current', count: '100' });
      expect(r.expected).toBeCloseTo(0.5, 2);
      expect(r.rateSource).toBe('workbook_simple');
    });

    it('advanced additive model when useAdvancedSizing is enabled', () => {
      const r = calculateSourceSize(source, {
        status: 'current',
        useAdvancedSizing: true,
        ssoIdpVendor: 'okta',
        ssoTenantCount: '1',
        ssoActiveUserCount: '500',
        ssoMfaUserCount: '400',
        ssoAppIntegrationCount: '20',
        ssoCollectionProfile: 'full_identity_activity',
        ssoActivityLevel: 'normal',
      });
      expect(r.rateSource).toBe('sso_identity_additive');
      expect(r.expected).toBeLessThan(0.5);
      expect(r.expected).toBeGreaterThan(0);
    });

    it('without users yields no sizing confidence', () => {
      const r = calculateSourceSize(source, { status: 'current' });
      expect(r.confidence).toBe('none');
    });
  });

  describe('Robbins retail sizing benchmarks', () => {
    it('sizes Active Directory on DC count, not user count', () => {
      const ad = flatCatalog.find((s) => s.id === 'active_directory');
      const withUsers = calculateSourceSize(ad, { status: 'current', number_of_users: 100, number_of_dcs: 2 });
      const dcsOnly = calculateSourceSize(ad, { status: 'current', number_of_dcs: 2 });
      expect(withUsers.expected).toBeCloseTo(0.5, 1);
      expect(dcsOnly.expected).toBeCloseTo(0.5, 1);
    });

    it('small FortiGate with traffic+threat stays under 2 GB/day per appliance', () => {
      const fw = flatCatalog.find((s) => s.id === 'firewalls');
      const r = calculateSourceSize(fw, {
        status: 'current',
        number_of_systems: 1,
        vendor: 'Fortinet',
        logging_scope: 'Traffic + threat prevention',
      });
      expect(r.expected).toBeLessThan(2);
      expect(r.expected).toBeGreaterThan(0);
    });

    it('Robbins configured stack stays below budget after SaaS and DLP calibration', () => {
      const robbins = sampleScenarios.find((s) => s.id === 'robbins_retail_hybrid');
      const budgetGbDay = computeIngestBudgetFromIntake(robbins.intake).budgetGbDay;
      const session = sumSessionPlanningIngest({
        catalog: sourceCatalog,
        sourceStates: robbins.sources,
        overlapDecisions: robbins.overlapDecisions,
        sizingContext: { catalog: sourceCatalog, allInputs: robbins.sources },
      });
      expect(session.totals.expected).toBeLessThan(budgetGbDay);
      expect(session.totals.buffered.expected).toBeLessThan(budgetGbDay);
    });
  });

  describe('Cross-source totals', () => {
    it('medium enterprise scenario (5000 users behind FW, 200 servers, 5000 endpoints)', () => {
      const states = {
        firewalls: { status: 'current', number_of_systems: 12 },
        windows_servers: { status: 'current', number_of_servers: 200 },
        saas_sso: { status: 'current', count: 5000 },
        edr: { status: 'current', number_of_endpoints: 5000 },
      };

      let totalExpected = 0;
      for (const [id, ss] of Object.entries(states)) {
        const src = flatCatalog.find((s) => s.id === id);
        if (src) {
          const r = calculateSourceSize(src, ss);
          totalExpected += r.expected;
        }
      }

      expect(totalExpected).toBeGreaterThan(50);
      expect(totalExpected).toBeLessThan(200);
    });

    it('small business scenario (500 users, 20 servers)', () => {
      const states = {
        firewalls: { status: 'current', number_of_systems: 2 },
        windows_servers: { status: 'current', number_of_servers: 20 },
        saas_sso: { status: 'current', count: 500 },
      };

      let totalExpected = 0;
      for (const [id, ss] of Object.entries(states)) {
        const src = flatCatalog.find((s) => s.id === id);
        if (src) {
          const r = calculateSourceSize(src, ss);
          totalExpected += r.expected;
        }
      }

      expect(totalExpected).toBeGreaterThan(3);
      expect(totalExpected).toBeLessThan(50);
    });

    it('large enterprise scenario (50000 users, 2000 servers, 50000 endpoints)', () => {
      const states = {
        firewalls: { status: 'current', number_of_systems: 40 },
        windows_servers: { status: 'current', number_of_servers: 2000 },
        saas_sso: { status: 'current', count: 50000 },
        edr: { status: 'current', number_of_endpoints: 50000 },
        saas_office: { status: 'current', count: 50000 },
        proxy: { status: 'current', number_of_systems: 8 },
      };

      let totalExpected = 0;
      for (const [id, ss] of Object.entries(states)) {
        const src = flatCatalog.find((s) => s.id === id);
        if (src) {
          const r = calculateSourceSize(src, ss);
          totalExpected += r.expected;
        }
      }

      expect(totalExpected).toBeGreaterThan(500);
      expect(totalExpected).toBeLessThan(4500);
    });
  });

  describe('Vendor-specific rates', () => {
    it('Palo Alto PA-5200 produces results for firewall', () => {
      const source = flatCatalog.find((s) => s.id === 'firewalls');
      if (!source) return;
      const generic = calculateSourceSize(source, { status: 'current', number_of_systems: 10 });
      const pa = calculateSourceSize(source, { status: 'current', number_of_systems: 10, vendor: 'Palo Alto Networks', model: 'PA-5200' });
      expect(pa.expected).toBeGreaterThan(0);
      expect(generic.expected).toBeGreaterThan(0);
    });

    it('CrowdStrike EDR produces expected rates for 1000 endpoints', () => {
      const source = flatCatalog.find((s) => s.id === 'edr');
      if (!source) return;
      const result = calculateSourceSize(source, { status: 'current', number_of_endpoints: 1000, vendor: 'CrowdStrike Falcon' });
      expect(result.expected).toBeGreaterThan(5);
      expect(result.expected).toBeLessThan(100);
    });
  });

  describe('Rate alias resolution', () => {
    it('firewalls alias resolves to firewall_logs rates', () => {
      const source = { id: 'firewalls', sizing_formula: { primary_input: 'number_of_systems', rate_per_unit: 1.0 } };
      const result = calculateSourceSize(source, { status: 'current', number_of_systems: 10 });
      expect(result.expected).toBeGreaterThan(0);
    });

    it('saas_sso alias resolves to okta_sso rates', () => {
      const source = { id: 'saas_sso', sizing_formula: { primary_input: 'number_of_users', rate_per_unit: 0.005 } };
      const result = calculateSourceSize(source, { status: 'current', number_of_users: 1000 });
      expect(result.expected).toBeGreaterThan(0);
    });
  });

  describe('Boundary and edge cases', () => {
    it('negative input treated as zero', () => {
      const source = flatCatalog.find((s) => s.id === 'firewalls');
      if (!source) return;
      const result = calculateSourceSize(source, { status: 'current', number_of_users: -5 });
      expect(result.expected).toBe(0);
    });

    it('extremely large input does not crash', () => {
      const source = flatCatalog.find((s) => s.id === 'firewalls');
      if (!source) return;
      const result = calculateSourceSize(source, { status: 'current', number_of_systems: 999999 });
      expect(result.expected).toBeGreaterThan(0);
      expect(Number.isFinite(result.expected)).toBe(true);
    });

    it('string input is parsed correctly', () => {
      const source = flatCatalog.find((s) => s.id === 'firewalls');
      if (!source) return;
      const result = calculateSourceSize(source, { status: 'current', number_of_systems: '10' });
      expect(result.expected).toBeGreaterThan(0);
    });

    it('null/undefined source returns safe defaults', () => {
      const result = calculateSourceSize({}, { status: 'current', count: 10 });
      expect(result).toBeTruthy();
      expect(typeof result.expected).toBe('number');
    });
  });

});

describe('Source Prioritization Engine', () => {
  const foundational = useCaseProfiles.find((uc) => uc.id === 'foundational_security');
  const enterprise = useCaseProfiles.find((uc) => uc.id === 'enterprise_security');

  function byId(id) {
    return flatCatalog.find((s) => s.id === id);
  }

  const lowBudgetOnPremIntake = {
    deploymentType: 'onprem',
    opportunityBudgetUsd: 30000,
    desiredApps: ['enterprise_security'],
  };

  const highBudgetIntake = {
    deploymentType: 'hybrid',
    opportunityBudgetUsd: 250000,
    desiredApps: ['enterprise_security'],
  };

  it('low-budget on-prem SIEM prioritizes firewall/AD/endpoint over enrichment', () => {
    const sorted = prioritizeAndSortSources(
      flatCatalog,
      [foundational],
      ['enterprise_security'],
      flatCatalog,
      {},
      {},
      OVERLAP_GROUPS,
      lowBudgetOnPremIntake,
    );
    const top = getTopSuggestedSources(sorted, 6).map((s) => s.id);
    expect(top).toContain('firewalls');
    expect(top).toContain('active_directory');
    expect(top).toContain('edr');
    const netflow = sorted.find((s) => s.id === 'netflow');
    expect(['optional', 'redundant']).toContain(netflow?.relevance?.label);
  });

  it('configuring firewall logs downgrades overlapping IDS/IPS', () => {
    const states = {
      firewalls: { status: 'current', number_of_systems: 4, logging_scope: 'Traffic + threat prevention' },
    };
    const sorted = prioritizeAndSortSources(
      [byId('ids_ips'), byId('firewalls')],
      [foundational],
      [],
      flatCatalog,
      states,
      {},
      OVERLAP_GROUPS,
      lowBudgetOnPremIntake,
    );
    const ids = sorted.find((s) => s.id === 'ids_ips');
    expect(['redundant', 'needs_review', 'optional']).toContain(ids?.relevance?.label);
    expect(ids?.relevance?.label).not.toBe('suggested');
  });

  it('configuring AD downgrades overlapping SSO unless cloud identity in scope', () => {
    const states = {
      active_directory: { status: 'current', number_of_users: 5000, logging_scope: 'Security events' },
    };
    const sorted = prioritizeAndSortSources(
      [byId('sso_pam'), byId('active_directory')],
      [foundational],
      [],
      flatCatalog,
      states,
      {},
      OVERLAP_GROUPS,
      lowBudgetOnPremIntake,
    );
    const sso = sorted.find((s) => s.id === 'sso_pam');
    expect(['optional', 'redundant']).toContain(sso?.relevance?.label);
  });

  it('high-budget mature ES allows enrichment sources to remain suggested', () => {
    const sorted = prioritizeAndSortSources(
      flatCatalog,
      [enterprise],
      ['enterprise_security'],
      flatCatalog,
      {},
      {},
      OVERLAP_GROUPS,
      highBudgetIntake,
    );
    const vuln = sorted.find((s) => s.id === 'vuln_mgmt');
    const dns = sorted.find((s) => s.id === 'dns');
    expect(['suggested', 'optional']).toContain(vuln?.relevance?.label);
    expect(['suggested', 'optional']).toContain(dns?.relevance?.label);
  });

  it('sorts within category: suggested before needs_review before optional before redundant', () => {
    const ORDER = { suggested: 0, needs_review: 1, optional: 2, redundant: 3 };
    const sorted = sortSourcesByPriority([
      { id: 'a', relevance: { label: 'redundant', priorityScore: 90 } },
      { id: 'b', relevance: { label: 'suggested', priorityScore: 50 } },
      { id: 'c', relevance: { label: 'optional', priorityScore: 80 } },
      { id: 'd', relevance: { label: 'needs_review', priorityScore: 70 } },
    ]);
    const ranks = sorted.map((s) => ORDER[s.relevance.label]);
    expect(ranks).toEqual([0, 1, 2, 3]);
  });

  it('getTopSuggestedSources returns highest-scoring suggested sources only', () => {
    const sorted = prioritizeAndSortSources(
      flatCatalog,
      [foundational],
      ['enterprise_security'],
      flatCatalog,
      {},
      {},
      OVERLAP_GROUPS,
      highBudgetIntake,
    );
    const top = getTopSuggestedSources(sorted, 5);
    expect(top.length).toBeLessThanOrEqual(5);
    expect(top.every((s) => s.relevance.label === 'suggested')).toBe(true);
    const scores = top.map((s) => s.relevance.priorityScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('redundant sources sort below suggested in classifyAndSortSources', () => {
    const states = {
      firewalls: { status: 'current', number_of_systems: 4, logging_scope: 'Traffic + threat prevention' },
    };
    const sorted = classifyAndSortSources(
      [byId('ids_ips'), byId('firewalls'), byId('active_directory')],
      [foundational],
      ['enterprise_security'],
      flatCatalog,
      states,
      {},
      OVERLAP_GROUPS,
      lowBudgetOnPremIntake,
    );
    const firstRedundant = sorted.findIndex((s) => s.relevance.label === 'redundant');
    const lastSuggested = sorted.map((s) => s.relevance.label).lastIndexOf('suggested');
    if (firstRedundant >= 0 && lastSuggested >= 0) {
      expect(firstRedundant).toBeGreaterThan(lastSuggested);
    }
  });

  it('marks needs_review when firewall and IDS overlap is unresolved', () => {
    const states = {
      firewalls: { status: 'current', number_of_systems: 2 },
      ids_ips: { status: 'current', number_of_systems: 2 },
    };
    const sorted = prioritizeAndSortSources(
      [byId('ids_ips')],
      [foundational],
      [],
      flatCatalog,
      states,
      {},
      OVERLAP_GROUPS,
      lowBudgetOnPremIntake,
    );
    expect(sorted[0].relevance.label).toBe('needs_review');
  });

  it('getBudgetSensitivityBand maps opportunity budget to low/medium/high', () => {
    expect(getBudgetSensitivityBand({ opportunityBudgetUsd: 30000, deploymentType: 'onprem' })).toBe('low');
    expect(getBudgetSensitivityBand({ opportunityBudgetUsd: 250000, deploymentType: 'cloud' })).toBe('high');
    expect(getBudgetSensitivityBand({})).toBe('medium');
  });

  it('Robbins hybrid ranks core identity and perimeter sources in top suggestions', () => {
    const scenario = sampleScenarios.find((s) => s.id === 'robbins_retail_hybrid');
    expect(scenario).toBeTruthy();
    const { profiles } = resolveUseCaseProfiles(scenario.intake);
    const intake = {
      ...scenario.intake,
      opportunityBudgetUsd: Number(scenario.intake.opportunityBudgetUsd) || 50000,
    };
    const sorted = prioritizeAndSortSources(
      flatCatalog,
      profiles,
      intake.desiredApps || [],
      flatCatalog,
      {},
      {},
      OVERLAP_GROUPS,
      intake,
    );
    const top = getTopSuggestedSources(sorted, 8).map((s) => s.id);
    const core = ['active_directory', 'firewalls', 'edr', 'saas_sso', 'saas_office'];
    expect(top.some((id) => core.includes(id))).toBe(true);
  });

  it('cloud-only sources rank high only when cloud security is explicitly in scope', () => {
    const cloudIntake = {
      deploymentType: 'cloud',
      opportunityBudgetUsd: 250000,
      desiredApps: ['enterprise_security'],
      customUseCases: 'Cloud control plane, CSPM, and SaaS cloud monitoring for AWS and Azure.',
      discoveryNotes: 'Need cloud security posture and workload protection across multi-cloud.',
    };
    const sortedCloud = prioritizeAndSortSources(
      flatCatalog,
      [enterprise],
      ['enterprise_security'],
      flatCatalog,
      {},
      {},
      OVERLAP_GROUPS,
      cloudIntake,
    );
    const cspmCloud = sortedCloud.find((s) => s.id === 'cspm');
    expect(['suggested', 'optional', 'needs_review']).toContain(cspmCloud?.relevance?.label);

    const siemOnlyIntake = {
      deploymentType: 'cloud',
      opportunityBudgetUsd: 250000,
      desiredApps: ['enterprise_security'],
      customUseCases: 'Identity, VPN, endpoint, and Cisco network visibility for SOC.',
    };
    const sortedSiem = prioritizeAndSortSources(
      flatCatalog,
      [enterprise],
      ['enterprise_security'],
      flatCatalog,
      {},
      {},
      OVERLAP_GROUPS,
      siemOnlyIntake,
    );
    const cspmSiem = sortedSiem.find((s) => s.id === 'cspm');
    expect(['optional', 'redundant', 'needs_review']).toContain(cspmSiem?.relevance?.label);
    expect(cspmSiem?.relevance?.label).not.toBe('suggested');
  });

  it('executive summary does not duplicate GB/day units', () => {
    const oakridge = sampleScenarios.find((s) => s.id === 'robbins_retail_hybrid');
    const { profiles } = resolveUseCaseProfiles(oakridge.intake);
    const plans = generatePlans(flatCatalog, oakridge.sources, profiles, [], {}, 0.2, {
      budgetGbDay: computeIngestBudgetFromIntake(oakridge.intake).budgetGbDay,
    });
    const summary = generateExecutiveSummary(plans, profiles, oakridge.intake.customerName);
    expect(summary.text).not.toMatch(/GB\/day\s+GB\/day/i);
    expect(summary.text).toMatch(/GB\/day/);
  });
});

describe('Report PDF export', () => {
  const sampleCtx = {
    customerName: 'Acme Corp',
    bufferPercent: 20,
    totals: { low: 80, expected: 100, high: 120 },
    selectedPlan: { name: 'Walk', sources: [{ id: 'firewalls', name: 'Firewalls', category: 'Networking', splunkApps: ['Enterprise Security'], configuredItemLabel: '# of firewalls', sizing_formula: { primary_input: 'count' } }], strengths: ['Validate ingest'] },
    executiveSummary: { text: 'Planning summary for stakeholder review and sizing validation.' },
    coverageValidation: { overallScore: 72, gaps: [] },
    sourceRows: [{
      id: 'firewalls',
      name: 'Firewalls',
      category: 'Network',
      status: 'current',
      ingest: { low: 4, expected: 5, high: 6, confidence: 'medium', warnings: [] },
      valueProp: { summary: 'Perimeter visibility for security monitoring.' },
    }],
    risks: [{ severity: 'medium', description: 'Sample planning gap', mitigation: 'Validate counts' }],
    startupGuide: {
      metadata: { disclaimer: 'Planning guidance only.' },
      sources: [{ id: 'firewalls', name: 'Firewalls', method: 'Syslog / Splunk Connect for Syslog', ta: 'Vendor TA', status: 'current' }],
      timeline: [{ phase: 'Week 0–1', title: 'Preparation', tasks: ['Confirm access'] }],
      prerequisites: ['Splunk deployment accessible'],
      checkpoints: [{ sourceName: 'Firewalls', checks: ['Data flowing'] }],
      questions: [{ question: 'Confirm syslog path' }],
      currentSources: [{ name: 'Firewalls', method: 'Syslog', status: 'current' }],
    },
    useCases: [{ id: 'foundational_security', name: 'Security monitoring' }],
    intake: { deploymentType: 'onprem', desiredApps: ['enterprise_security'] },
    sourceStates: { firewalls: { status: 'current', count: 4, vendor: 'Palo Alto Networks' } },
    planNarrative: ['Validate firewall logging scope with customer-specific measurement.'],
  };

  it('buildReportExportPayload totals reconcile with source row ingest sums', () => {
    const payload = buildReportExportPayload(sampleCtx);
    const rowSum = payload.sourceRows.reduce((sum, r) => sum + (r.ingestRange?.expected ?? 0), 0);
    expect(Math.abs(payload.totals.expected - rowSum)).toBeLessThanOrEqual(0.1);
  });

  it('buildReportExportPayload includes enriched fields and disclaimer', () => {
    const payload = buildReportExportPayload(sampleCtx);
    expect(payload.disclaimer).toBe(EXPORT_DISCLAIMER_FULL);
    expect(payload.disclaimer).toMatch(/planning-level sizing/i);
    expect(payload.disclaimer).not.toMatch(/proof.of.value|\bPOV\b|\bPOC\b|guaranteed/i);
    expect(payload.deploymentLabel).toMatch(/Enterprise/);
    expect(payload.desiredAppLabels).toContain('Splunk Enterprise Security');
    expect(payload.sourceRows[0].vendor).toBe('Palo Alto Networks');
    expect(payload.sourceRows[0].ingestRange.expected).toBe(5);
    expect(payload.installationGuidance.links.length).toBeGreaterThan(0);
    expect(validateExportContent(payload)).toEqual([]);
  });

  it('export footer includes planning contingency disclaimer', async () => {
    const { EXPORT_FOOTER } = await import('./exportConstants.js');
    expect(EXPORT_FOOTER).toMatch(/20% planning contingency/i);
  });

  it('generateValueProposalPdf is leadership-focused (no install-only sections)', () => {
    const payload = buildReportExportPayload(sampleCtx);
    const result = generateValueProposalPdf(payload);
    expect(result.pageCount).toBeGreaterThanOrEqual(3);
    expect(result.pageCount).toBeLessThanOrEqual(4);
    expect(result.sections).toEqual(expect.arrayContaining([
      'cover',
      'challenges_solutions',
      'architecture_paths',
      'top_sources',
      'risks_next_steps',
    ]));
    expect(result.filename).toMatch(/^splunk-scope-value-proposal-Acme_Corp\.pdf$/);
    expect(validateValueProposalContent(payload)).toEqual([]);
    expect(payload.sourceCount).toBe(payload.sourceRows.length);
    expect(payload.valueProposalDocument?.pages?.length).toBe(5);
  });

  it('generateValueProposalPdf executiveSummaryOnly produces at most 2 pages', () => {
    const payload = buildReportExportPayload({ ...sampleCtx, executiveSummaryOnly: true });
    const result = generateValueProposalPdf(payload);
    expect(result.pageCount).toBeLessThanOrEqual(2);
    expect(result.sections).toEqual(expect.arrayContaining(['cover', 'executive_summary']));
    expect(validateValueProposalContent(payload)).toEqual([]);
  });

  it('generateStartupGuidePdf includes install guidance and validation searches', () => {
    const payload = buildReportExportPayload(sampleCtx);
    const result = generateStartupGuidePdf(payload);
    expect(result.pageCount).toBeGreaterThanOrEqual(6);
    expect(result.sections).toEqual(expect.arrayContaining([
      'implementation_summary',
      'year_one_roadmap',
      'deployment_setup',
      'source_details',
      'validation_library',
      'official_links',
      'cadence_plan',
    ]));
    expect(result.filename).toMatch(/^splunk-scope-startup-guide-Acme_Corp\.pdf$/);
    expect(payload.validationEntries.length).toBeGreaterThan(0);
    expect(payload.officialLinksFull.length).toBeGreaterThan(5);
    expect(validateStartupGuideContent(payload)).toEqual([]);
    expect(payload.startupGuideDocument?.pages?.some((p) => p.id === 'validation_library')).toBe(true);
  });

  it('generateCustomerPlanningPackPdf downloads unified planning pack PDF', () => {
    const payload = buildReportExportPayload(sampleCtx);
    const result = generateCustomerPlanningPackPdf(payload);
    expect(result.pageCount).toBeGreaterThanOrEqual(3);
    expect(result.filename).toMatch(/^splunk-scope-planning-pack-Acme_Corp\.pdf$/);
    expect(payload.customerPlanningPackDocument?.meta?.includesValueProposal).toBe(true);
    expect(payload.customerPlanningPackDocument?.meta?.includesSourcesDetail).toBe(true);
    expect(validateExportContent(payload)).toEqual([]);
  });

  it('planning pack export includes only sources in the selected path', () => {
    const payload = buildReportExportPayload({
      ...sampleCtx,
      sourceRows: [
        ...sampleCtx.sourceRows,
        {
          id: 'edr',
          name: 'EDR',
          category: 'Endpoint',
          status: 'current',
          ingest: { expected: 3, low: 2.4, high: 3.6, confidence: 'medium', warnings: [] },
          valueProp: { summary: 'Endpoint telemetry for detections.' },
        },
      ],
      sourceStates: {
        ...sampleCtx.sourceStates,
        edr: { status: 'current', count: 1000, vendor: 'CrowdStrike' },
      },
    });
    expect(payload.sourceRows.map((r) => r.id)).toEqual(['firewalls']);
    expect(payload.sourceRowsExcludedCount).toBe(1);
    const pack = payload.customerPlanningPackDocument;
    const detailPages = (pack?.pages || []).filter((p) => p.id?.startsWith('sources_'));
    const allDetailRows = detailPages.flatMap((p) =>
      (p.blocks || []).filter((b) => b.type === 'sources_detail_table').flatMap((b) => b.rows || []),
    );
    expect(allDetailRows.map((r) => r.name)).not.toContain('EDR');
  });

  it('generateCustomerPdf alias maps to value proposal', () => {
    const payload = buildReportExportPayload(sampleCtx);
    const result = generateCustomerPdf(payload);
    expect(result.filename).toMatch(/value-proposal/);
  });

  it('formatIngestWithUnit avoids duplicate GB/day', () => {
    expect(formatIngestWithUnit(252.2)).toBe('252.2 GB/day');
    expect(formatIngestWithUnit(252.2)).not.toMatch(/GB\/day GB\/day/);
  });

  it('value groups summarize sources without generic domain copy', () => {
    const payload = buildReportExportPayload(sampleCtx);
    expect(payload.valueGroups.length).toBeGreaterThan(0);
    const blob = JSON.stringify(payload.valueGroups);
    expect(blob).not.toMatch(/enriches telemetry across \d+ domain/i);
  });

  it('official Splunk documentation links are present and HTTPS', () => {
    expect(Object.keys(EXPORT_OFFICIAL_LINKS).length).toBeGreaterThan(5);
    for (const link of Object.values(EXPORT_OFFICIAL_LINKS)) {
      expect(link.url).toMatch(/^https:\/\//);
      expect(link.label.length).toBeGreaterThan(3);
    }
  });

  it('converts plan narrative objects to readable next steps (no [object Object])', () => {
    const payload = buildReportExportPayload({
      ...sampleCtx,
      planNarrative: [{ category: 'Security', narrative: 'Security telemetry supports detection workflows.' }],
    });
    expect(JSON.stringify(payload)).not.toMatch(/\[object Object\]/i);
    expect(payload.nextSteps[0]).toMatch(/Security telemetry/);
  });

  it('formatNumberedList increments step numbers', () => {
    expect(formatNumberedList(['First step', 'Second step', 'Third step'])).toEqual([
      '1. First step',
      '2. Second step',
      '3. Third step',
    ]);
  });

  it('excludes unconfigured and zero-ingest sources from export', () => {
    const payload = buildReportExportPayload({
      ...sampleCtx,
      sourceRows: [
        ...sampleCtx.sourceRows,
        {
          id: 'dns',
          name: 'DNS',
          category: 'Network',
          status: 'current',
          ingest: { low: 0, expected: 0, high: 0, confidence: 'none', warnings: [] },
          valueProp: { summary: 'DNS visibility.' },
        },
        {
          id: 'edr',
          name: 'EDR',
          category: 'Security',
          status: 'unknown',
          ingest: { low: 2, expected: 3, high: 4, confidence: 'medium', warnings: [] },
          valueProp: { summary: 'Endpoint visibility.' },
        },
      ],
      selectedPlan: {
        ...sampleCtx.selectedPlan,
        sources: [
          ...sampleCtx.selectedPlan.sources,
          { id: 'dns', name: 'DNS', category: 'Network', sizing_formula: { primary_input: 'count' } },
          { id: 'edr', name: 'EDR', category: 'Security', sizing_formula: { primary_input: 'count' } },
        ],
      },
      sourceStates: {
        ...sampleCtx.sourceStates,
        dns: { status: 'current' },
        edr: { status: 'unknown' },
      },
    });
    expect(payload.sourceRows.map((r) => r.id)).toEqual(['firewalls']);
    expect(validateExportContent(payload)).toEqual([]);
  });

  it('formats Active Directory counts as DCs and users separately', () => {
    const enriched = enrichSourceRowsForExport(
      [{
        id: 'active_directory',
        name: 'Active Directory',
        category: 'Identity',
        status: 'current',
        ingest: { low: 1, expected: 2, high: 3, confidence: 'medium' },
        valueProp: { summary: 'Identity backbone for authentication monitoring.' },
      }],
      [{
        id: 'active_directory',
        name: 'Active Directory',
        configuredItemLabel: '# of AD domain controllers',
        sizing_formula: { primary_input: 'number_of_users' },
        whyItMatters: 'AD is the identity backbone.',
        input_fields: [
          { key: 'number_of_users', type: 'number' },
          { key: 'number_of_dcs', type: 'number' },
        ],
      }],
      null,
      { active_directory: { status: 'current', number_of_users: 850, number_of_dcs: 4 } },
    );
    expect(enriched[0].count).toBe('4 domain controllers, 850 users');
    expect(enriched[0].countBasis).toMatch(/Domain controllers and user accounts/);
  });

  it('export strings contain no duplicated GB/day units', () => {
    const payload = buildReportExportPayload(sampleCtx);
    const blob = JSON.stringify(payload);
    expect(blob).not.toMatch(/GB\/day\s+GB\/day/i);
  });

  it('toReadableString never returns [object Object]', () => {
    expect(toReadableString({ narrative: 'Readable text' })).toBe('Readable text');
    expect(toReadableString({ foo: 'bar' })).toBe('');
  });

  it('PowerPoint export aligns with Value Proposal (not install guide)', async () => {
    const payload = buildReportExportPayload(sampleCtx);
    const result = await generateCustomerPptx(payload);
    expect(result.slideCount).toBe(10);
    expect(result.slideIds).toEqual(expect.arrayContaining([
      'title',
      'what_we_heard',
      'recommended_path',
      'value_capability',
      'ingest',
      'next_steps',
      'assumptions',
    ]));
    expect(result.filename).toMatch(/value-proposal.*\.pptx$/);
    expect(result.slideTitles).not.toContain('Installation Guidance');
    expect(validateValueProposalContent(payload)).toEqual([]);
  });

  it('customer export payload excludes budget and confidence fields', () => {
    const payload = buildReportExportPayload({
      ...sampleCtx,
      intake: { ...sampleCtx.intake, opportunityBudgetUsd: '250000', budgetNotes: 'internal' },
    });
    expect(payload.intake.opportunityBudgetUsd).toBeUndefined();
    expect(payload.intake.budgetNotes).toBeUndefined();
    expect(payload.sourceRows[0].confidence).toBeUndefined();
    expect(payload.yearOnePlan?.phases?.length).toBeGreaterThan(3);
  });

  it('customer export text excludes budget language from path rationale and strengths', () => {
    const payload = buildReportExportPayload({
      ...sampleCtx,
      intake: { ...sampleCtx.intake, opportunityBudgetUsd: '250000', budgetNotes: 'internal only' },
      selectedPlan: {
        ...sampleCtx.selectedPlan,
        description: 'Sized to your planning budget for balanced coverage.',
        strengths: ['Strong coverage within budget'],
      },
    });
    const exportText = JSON.stringify({
      pathRationale: payload.pathRationale,
      pathTradeoff: payload.pathTradeoff,
      planStrengths: payload.planStrengths,
      executiveSummary: payload.executiveSummary,
      valueProposalDocument: payload.valueProposalDocument,
    });
    expect(exportText).not.toMatch(/planning budget|ingest budget|opportunity budget/i);
    expect(payload.pathRationale).toBe('');
    expect(payload.planStrengths.every((s) => !/within budget/i.test(s))).toBe(true);
  });

  it('startup guide PDF includes year-one deployment plan', () => {
    const payload = buildReportExportPayload(sampleCtx);
    const result = generateStartupGuidePdf(payload);
    expect(result.sections).toContain('year_one_roadmap');
    expect(validateStartupGuideContent(payload)).toEqual([]);
  });

  it('value proposal document includes pain-solution pairs with capability context', () => {
    const payload = buildReportExportPayload(sampleCtx);
    const challengesPage = payload.valueProposalDocument.pages.find((p) => p.id === 'challenges_solutions');
    const pairs = challengesPage.blocks.find((b) => b.type === 'pain_solution_pairs')?.pairs || [];
    expect(pairs.length).toBeGreaterThanOrEqual(3);
    expect(pairs[0].pain).toBeTruthy();
    expect(pairs[0].solution).toMatch(/Splunk|Enterprise Security|CIM|investigation|correlation/i);
    expect(pairs.every((p) => !/optimized to your planning ingest budget/i.test(p.solution))).toBe(true);
  });

  it('normalizePdfText replaces Unicode punctuation for jsPDF safety', () => {
    expect(normalizePdfText('Your challenges → How Splunk')).toBe('Your challenges -> How Splunk');
    expect(normalizePdfText('Walk — Core SIEM')).toBe('Walk - Core SIEM');
    expect(normalizePdfText('No\u200Bzero\u200Cwidth')).toBe('Nozerowidth');
  });

  it('value proposal headings use PDF-safe text without Unicode arrows or em-dashes', () => {
    const payload = buildReportExportPayload(sampleCtx);
    const challengesPage = payload.valueProposalDocument.pages.find((p) => p.id === 'challenges_solutions');
    const heading = challengesPage.blocks.find((b) => b.type === 'heading');
    const normalized = normalizePdfText(heading.text);
    expect(normalized).not.toMatch(/→|—/);
    expect(normalized).toMatch(/challenges.*Splunk/i);
  });

  it('Robbins value proposal PDF is dense (at most 4 pages) with reconciled totals', () => {
    const robbins = getSampleScenarioById('robbins_retail_hybrid');
    const { profiles } = resolveUseCaseProfiles(robbins.intake);
    const plans = generatePlans(flatCatalog, robbins.sources, profiles, [], robbins.overlapDecisions, 0.2, {
      budgetGbDay: computeIngestBudgetFromIntake(robbins.intake).budgetGbDay,
    });
    const selectedPlan = plans[1];
    const sourceRows = selectedPlan.sources.map((s) => {
      const ss = robbins.sources[s.id] || {};
      const raw = calculateFullSourceIngest(s, ss, { catalog: sourceCatalog, allInputs: robbins.sources });
      const breakdown = selectedPlan.sourceIngestGb?.find((r) => r.id === s.id);
      const planned = breakdown
        ? { low: breakdown.gbLow, expected: breakdown.gbDay, high: breakdown.gbHigh }
        : applyPlanningBufferToSource(raw);
      return {
        id: s.id,
        name: s.name,
        category: s.category || 'Uncategorized',
        status: ss.status || 'unknown',
        ingest: { ...planned, confidence: raw.confidence, warnings: raw.warnings },
        valueProp: { summary: 'Planning visibility.' },
      };
    });
    const payload = buildReportExportPayload({
      customerName: robbins.intake.customerName,
      intake: robbins.intake,
      sourceStates: robbins.sources,
      selectedPlan,
      plans,
      totals: selectedPlan.totals?.buffered || selectedPlan.totals,
      useCases: profiles,
      sourceRows,
      coverageValidation: { overallScore: selectedPlan.validation?.score ?? 0, gaps: [] },
      risks: [],
      executiveSummary: { text: 'Chuck Robbins retail planning summary.' },
      planNarrative: [],
      startupGuide: { sources: [], timeline: [], metadata: {} },
    });
    const rowSum = payload.sourceRows.reduce((sum, r) => sum + (r.ingestRange?.expected ?? 0), 0);
    expect(Math.abs(payload.totals.expected - rowSum)).toBeLessThanOrEqual(0.1);
    const pathsBlock = payload.valueProposalDocument.pages
      .find((p) => p.id === 'architecture_paths')
      ?.blocks.find((b) => b.type === 'paths_table');
    expect(pathsBlock.rows.every((r) => r.shortName || ['Crawl', 'Walk', 'Run'].some((l) => r.name === l || r.shortName === l))).toBe(true);
    const result = generateValueProposalPdf(payload);
    expect(result.pageCount).toBeLessThanOrEqual(4);
    expect(result.pageCount).toBeGreaterThanOrEqual(3);
  });
});

describe('Session save and resume', () => {
  it('buildFullSessionExport includes fields needed to resume workflow', () => {
    const state = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      appVersion: '2.0.0',
      sessionId: 'test',
      currentStep: 5,
      theme: 'dark',
      intake: { customerName: 'Acme', opportunityBudgetUsd: '100000' },
      sources: { firewalls: { status: 'current', count: 2 } },
      selectedPlanIndex: 2,
      interpretation: { primaryUseCase: { id: 'foundational_security' } },
      interpretationIntakeKey: 'k',
      plans: null,
      bufferPercent: 20,
      overlapDecisions: {},
      showAllDomains: false,
      scenarios: [],
      activeScenarioId: null,
      activeTemplateId: 'example:robbins_retail_hybrid',
    };
    const exported = buildFullSessionExport(state);
    expect(exported.currentStep).toBe(5);
    expect(exported.intake.customerName).toBe('Acme');
    expect(exported.sources.firewalls.count).toBe(2);
    expect(exported.selectedPlanIndex).toBe(2);
    expect(exported.activeTemplateId).toBe('example:robbins_retail_hybrid');
  });
});

describe('Example scenarios', () => {
  it('loads the single Chuck Robbins retail example scenario', () => {
    expect(sampleScenarios.length).toBe(1);
    expect(sampleScenarios[0].id).toBe('robbins_retail_hybrid');
    expect(getSampleScenarioById('robbins_retail_hybrid')).toBeTruthy();
  });

  it('Robbins retail example prioritizes core sources', () => {
    const scenario = getSampleScenarioById('robbins_retail_hybrid');
    const ucs = useCaseProfiles.filter((u) =>
      (scenario.intake.useCases || []).some((name) => u.name === name || u.id === name),
    );
    const sorted = prioritizeAndSortSources(
      flatCatalog,
      ucs.length ? ucs : [foundational],
      scenario.intake.desiredApps || [],
      flatCatalog,
      scenario.sources,
      {},
      OVERLAP_GROUPS,
      scenario.intake,
    );
    const topIds = getTopSuggestedSources(sorted, 6).map((s) => s.id);
    expect(topIds.length).toBe(6);
    expect(topIds.some((id) => ['firewalls', 'active_directory', 'edr', 'saas_sso', 'saas_office', 'iaas'].includes(id))).toBe(true);
  });
});

describe('Path naming engine', () => {
  it('generates stable dynamic display labels', () => {
    const plan = {
      pathPhase: 'walk',
      sources: [{ id: 'active_directory' }, { id: 'firewalls' }, { id: 'edr' }],
    };
    const a = generatePathDisplayName({ pathPhase: 'walk', plan, useCases: [foundational] });
    const b = generatePathDisplayName({ pathPhase: 'walk', plan, useCases: [foundational] });
    expect(a.displayLabel).toBe(b.displayLabel);
    expect(a.displayLabel).toMatch(/^Walk — /);
    const enriched = enrichPlanWithDynamicName({ ...plan, name: 'Walk' }, [foundational], {});
    expect(enriched.displayLabel).toBeTruthy();
  });
});

describe('Source library search', () => {
  it('finds sources by alias terms', () => {
    const okta = searchSourceCatalog(flatCatalog, 'Okta');
    expect(okta.some((s) => s.id === 'saas_sso' || s.id === 'sso_pam')).toBe(true);
    const asa = searchSourceCatalog(flatCatalog, 'ASA');
    expect(asa.some((s) => s.id === 'firewalls' || s.id === 'vpn')).toBe(true);
    const m365 = searchSourceCatalog(flatCatalog, 'M365');
    expect(m365.some((s) => s.id === 'saas_office')).toBe(true);
    const cs = searchSourceCatalog(flatCatalog, 'CrowdStrike');
    expect(cs.some((s) => s.id === 'edr')).toBe(true);
    const login = searchSourceCatalog(flatCatalog, 'login logs');
    expect(login.some((s) => ['active_directory', 'saas_sso', 'sso_pam'].includes(s.id))).toBe(true);
    const fwTraffic = searchSourceCatalog(flatCatalog, 'firewall traffic');
    expect(fwTraffic.some((s) => s.id === 'firewalls')).toBe(true);
    const ad = searchSourceCatalog(flatCatalog, 'AD');
    expect(ad.some((s) => s.id === 'active_directory')).toBe(true);
    const cloudTrail = searchSourceCatalog(flatCatalog, 'CloudTrail');
    expect(cloudTrail.some((s) => s.id === 'iaas')).toBe(true);
    const s3 = searchSourceCatalog(flatCatalog, 'S3');
    expect(s3.some((s) => s.id === 'iaas_storage')).toBe(true);
  });
});

describe('Customer source brief', () => {
  it('excludes internal SE wording', () => {
    const source = flatCatalog.find((s) => s.id === 'firewalls');
    const text = buildSourceBriefText(source, [foundational], {}, {}, flatCatalog);
    expect(text).not.toMatch(/SIZING QUESTION FOR DISCOVERY|confidence score|what to ask|planning budget/i);
    expect(text).toMatch(/Cisco \| Splunk Scope/);
  });
});

describe('Splunkbase catalog', () => {
  it('loads catalog with required fields on verified entries', async () => {
    const {
      getCatalogEntries,
      getCatalogEntry,
      getSplunkbaseUrl,
      resolveSplunkbaseLink,
      isSplunkbaseLinkCustomerSafe,
    } = await import('./splunkbaseCatalog.js');
    const entries = getCatalogEntries();
    expect(entries.length).toBeGreaterThan(40);
    for (const e of entries.filter((x) => x.status === 'verified')) {
      expect(e.id).toBeTruthy();
      expect(e.name).toBeTruthy();
      expect(e.type).toBeTruthy();
      expect(e.splunkbaseAppId).toMatch(/^\d+$/);
      expect(e.splunkbaseUrl).toMatch(/^https:\/\/splunkbase\.splunk\.com\/app\/\d+$/);
      expect(e.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const es = getCatalogEntry('splunk_enterprise_security');
    expect(es?.splunkbaseAppId).toBe('263');
    expect(getSplunkbaseUrl('Splunk Enterprise Security')).toBe('https://splunkbase.splunk.com/app/263');
    expect(getSplunkbaseUrl('Splunk SOAR')).toBeNull();
    const duo = resolveSplunkbaseLink('Duo Splunk Connector');
    expect(duo?.customerUrl).toBe('https://splunkbase.splunk.com/app/7404');
    expect(isSplunkbaseLinkCustomerSafe('Duo Splunk Connector')).toBe(true);
    const ids = new Set(entries.map((e) => e.id));
    expect(ids.size).toBe(entries.length);
    const appIds = entries.filter((e) => e.splunkbaseAppId).map((e) => e.splunkbaseAppId);
    expect(new Set(appIds).size).toBe(appIds.length);
  });

  it('customer brief omits unverified Splunkbase URLs', () => {
    const source = flatCatalog.find((s) => s.id === 'kubernetes');
    if (!source) return;
    const text = buildSourceBriefText(source, [foundational], {}, {}, flatCatalog);
    expect(text).not.toMatch(/splunkbase\.splunk\.com\/app\/3740/);
  });
});

function recIds(group = []) {
  return group.map((r) => r.appId);
}

function allRecIds(result) {
  return [
    ...recIds(result.recommendedSolutions),
    ...recIds(result.helpfulApps),
    ...recIds(result.technicalAddons),
    ...recIds(result.dependencies),
  ];
}

describe('Enterprise Security eligibility engine', () => {
  it('Robbins retail is eligible for Enterprise Security (desiredApps + budget)', () => {
    const robbins = getSampleScenarioById('robbins_retail_hybrid');
    const result = assessEnterpriseSecurityEligibility(robbins.intake);
    expect(result.esEligible).toBe(true);
    expect(result.rationale.length).toBeGreaterThan(0);
  });

  it('mature SOC with large budget and Splunk tenure is eligible', () => {
    const result = assessEnterpriseSecurityEligibility({
      customerName: 'Metro Health',
      opportunityBudgetUsd: '750000',
      deploymentType: 'cloud',
      useCases: ['Enterprise Security / SIEM'],
      desiredApps: ['enterprise_security'],
      goals: 'We have had Splunk for 4 years. Dedicated SOC team of 8 analysts running 24/7 operations.',
      discoveryNotes: '120 IT staff, mature security operations center.',
    });
    expect(result.esEligible).toBe(true);
    expect(result.confidence).toMatch(/high|medium/);
    expect(result.signals.positive.length).toBeGreaterThan(0);
  });

  it('explicit ES desire without maturity signals stays ineligible', () => {
    const result = assessEnterpriseSecurityEligibility({
      useCases: ['Enterprise Security / SIEM'],
      desiredApps: ['enterprise_security'],
      opportunityBudgetUsd: '50000',
      goals: 'First Splunk deployment. Two-person IT team, no SOC.',
    });
    expect(result.esEligible).toBe(false);
  });
});

describe('App recommendation engine', () => {
  it('1 — basic security / low budget prefers SSE or InfoSec, not ES/SOAR/UBA/Premier', () => {
    const result = recommendApps({
      intake: {
        useCases: ['Foundational Security / InfoSec'],
        crawlGoal: 'New to Splunk — pilot foundational security visibility',
        opportunityBudgetUsd: '40000',
      },
      sourceStatuses: {},
    });
    const solutions = recIds(result.recommendedSolutions);
    const helpful = recIds(result.helpfulApps);
    expect(
      [...solutions, ...helpful].some((id) => ['security_essentials', 'infosec_app'].includes(id)),
    ).toBe(true);
    expect(solutions).not.toContain('enterprise_security');
    expect(solutions).not.toContain('soar');
    expect(solutions).not.toContain('uba');
    expect(solutions).not.toContain('enterprise_security_premier');
  });

  it('2 — ES selected with AD/firewall/endpoint planned recommends ES + CIM dependency', () => {
    const result = recommendApps({
      intake: {
        useCases: ['Enterprise Security / SIEM'],
        desiredApps: ['enterprise_security'],
        walkGoal: 'Deploy Enterprise Security correlation searches',
      },
      sourceStatuses: {
        active_directory: { status: 'future' },
        firewalls: { status: 'future' },
        edr: { status: 'future' },
      },
    });
    expect(recIds(result.recommendedSolutions)).toContain('enterprise_security');
    expect(recIds(result.dependencies)).toContain('cim');
    expect(recIds(result.technicalAddons).length).toBeGreaterThan(0);
    expect(recIds(result.recommendedSolutions)).not.toEqual(recIds(result.technicalAddons));
  });

  it('3 — ES selected without telemetry readiness surfaces readiness warnings', () => {
    const result = recommendApps({
      intake: {
        desiredApps: ['enterprise_security'],
        useCases: ['Enterprise Security / SIEM'],
      },
      sourceStatuses: {},
    });
    const es = result.recommendedSolutions.find((r) => r.appId === 'enterprise_security');
    expect(es).toBeTruthy();
    expect(es.readinessWarnings.length).toBeGreaterThan(0);
    expect(es.fit).not.toBe('strong');
  });

  it('4 — generic security keyword does not auto-recommend ES', () => {
    const result = recommendApps({
      intake: {
        customUseCases: 'Improve security monitoring and visibility',
        crawlGoal: 'security pilot',
      },
      sourceStatuses: {},
    });
    expect(recIds(result.recommendedSolutions)).not.toContain('enterprise_security');
  });

  it('5 — SOAR selected without mature SOC context is deferred or needs readiness', () => {
    const result = recommendApps({
      intake: {
        desiredApps: ['soar'],
        crawlGoal: 'Phase 1 crawl — new team',
        useCases: ['Foundational Security / InfoSec'],
      },
      sourceStatuses: { firewalls: { status: 'current' } },
    });
    const soarRec =
      result.recommendedSolutions.find((r) => r.appId === 'soar') ||
      result.helpfulApps.find((r) => r.appId === 'soar') ||
      result.needsReadiness.find((r) => r.appId === 'soar');
    const deferred = result.suppressed.find((s) => s.appId === 'soar');
    expect(soarRec || deferred).toBeTruthy();
    if (soarRec) {
      expect(['weak', 'moderate'].includes(soarRec.fit) || soarRec.readinessWarnings.length > 0).toBe(true);
    }
  });

  it('6 — MLTK not recommended without ML use case', () => {
    const result = recommendApps({
      intake: { useCases: ['Foundational Security / InfoSec'] },
      sourceStatuses: { firewalls: { status: 'current' } },
    });
    expect(allRecIds(result)).not.toContain('machine_learning_toolkit');
  });

  it('7 — AI word alone does not recommend AITK or MLTK', () => {
    const result = recommendApps({
      intake: {
        discoveryNotes: 'Customer asked about AI in security — exploratory only',
        useCases: ['Threat Detection and Investigation'],
      },
      sourceStatuses: {},
    });
    expect(allRecIds(result)).not.toContain('ai_toolkit');
    expect(allRecIds(result)).not.toContain('machine_learning_toolkit');
  });

  it('8 — anomaly detection use case recommends MLTK with readiness note potential', () => {
    const result = recommendApps({
      intake: {
        customUseCases: 'Anomaly detection and forecasting for VPN and identity baselines',
        walkGoal: 'MLTK baselining for VPN patterns',
      },
      sourceStatuses: {
        vpn: { status: 'current' },
        active_directory: { status: 'current' },
      },
    });
    expect(allRecIds(result)).toContain('machine_learning_toolkit');
  });

  it('9 — ITSI not recommended for basic SIEM-only intake', () => {
    const result = recommendApps({
      intake: {
        useCases: ['Enterprise Security / SIEM', 'Threat Detection and Investigation'],
      },
      sourceStatuses: {
        firewalls: { status: 'current' },
        active_directory: { status: 'current' },
      },
    });
    expect(recIds(result.recommendedSolutions)).not.toContain('itsi');
  });

  it('10 — observability / APM use case recommends Observability products not ES', () => {
    const result = recommendApps({
      intake: {
        useCases: ['Observability / APM'],
        customUseCases: 'Kubernetes microservices APM and SRE observability with OpenTelemetry',
      },
      sourceStatuses: { apm: { status: 'future' }, paas: { status: 'future' }, linux_servers: { status: 'future' } },
    });
    expect(recIds(result.recommendedSolutions)).not.toContain('enterprise_security');
    expect(allRecIds(result).some((id) => ['observability_cloud', 'splunk_apm', 'infrastructure_monitoring'].includes(id))).toBe(
      true,
    );
  });

  it('11 — cloud apps suppressed for pure on-prem SIEM without cloud scope', () => {
    const result = recommendApps({
      intake: {
        deploymentType: 'onprem',
        useCases: ['Enterprise Security / SIEM'],
        desiredApps: ['enterprise_security'],
      },
      sourceStatuses: {
        firewalls: { status: 'current' },
        active_directory: { status: 'current' },
        edr: { status: 'current' },
      },
    });
    expect(allRecIds(result)).not.toContain('splunk_app_aws');
    expect(allRecIds(result)).not.toContain('add_on_aws');
  });

  it('12 — Cisco ASA/firewall vendor context surfaces Cisco TA, not unrelated Cisco products only', () => {
    const result = recommendApps({
      intake: {},
      sourceStatuses: {
        firewalls: { status: 'current', vendor: 'Cisco ASA' },
      },
    });
    expect(allRecIds(result)).toContain('add_on_cisco_asa');
    expect(allRecIds(result)).not.toContain('add_on_cisco_ise');
  });

  it('13 — technical add-ons are not listed under recommended solutions', () => {
    const result = recommendApps({
      intake: {
        desiredApps: ['enterprise_security', 'add_on_crowdstrike'],
        useCases: ['Enterprise Security / SIEM'],
      },
      sourceStatuses: {
        edr: { status: 'current' },
        active_directory: { status: 'current' },
        firewalls: { status: 'current' },
      },
    });
    const solutionTypes = result.recommendedSolutions.map((r) => r.type);
    expect(solutionTypes.every((t) => t === 'premium_solution')).toBe(true);
    expect(recIds(result.technicalAddons)).toContain('add_on_crowdstrike');
  });

  it('14 — Interpretation and export payload share the same recommendation engine', () => {
    const intake = {
      customerName: 'Export Parity Co',
      useCases: ['Enterprise Security / SIEM'],
      desiredApps: ['enterprise_security'],
      deploymentType: 'cloud',
    };
    const sourceStatuses = {
      active_directory: { status: 'current' },
      firewalls: { status: 'current' },
      edr: { status: 'current' },
    };
    const interpretation = interpretInputs({ ...intake, sourceStatuses });
    const payload = buildReportExportPayload({
      customerName: intake.customerName,
      intake,
      sourceStates: sourceStatuses,
      sourceRows: [],
      selectedPlan: { name: 'Walk', displayLabel: 'Walk — Core SIEM' },
      totals: { low: 1, expected: 2, high: 3 },
      useCases: [{ name: 'Enterprise Security / SIEM' }],
    });
    const interpEs = interpretation.appRecommendations.recommendedSolutions.find(
      (r) => r.appId === 'enterprise_security',
    );
    const exportEs = payload.productRecommendations.recommendedSolutions.find(
      (r) => r.name.includes('Enterprise Security'),
    );
    expect(interpEs).toBeTruthy();
    expect(exportEs).toBeTruthy();
  });

  it('15 — Robbins retail scenario: ES and PCI apps in recommended solutions', () => {
    const robbins = getSampleScenarioById('robbins_retail_hybrid');
    const result = recommendApps({
      intake: robbins.intake,
      sourceStatuses: robbins.sources,
    });
    expect(recIds(result.recommendedSolutions)).toContain('enterprise_security');
    expect(
      allRecIds(result).some((id) => ['app_pci_compliance', 'machine_learning_toolkit'].includes(id)),
    ).toBe(true);
  });

  it('16 — app ID normalization resolves legacy and display names', () => {
    expect(resolveCanonicalAppId('enterprise_security')).toBe('enterprise_security');
    expect(resolveCanonicalAppId('Splunk Enterprise Security')).toBe('enterprise_security');
    expect(resolveCanonicalAppId('add_on_cisco_security')).toBe('add_on_cisco_asa');
    expect(getAppCatalogEntry('ES')?.id).toBe('enterprise_security');
  });

  it('17 — Splunkbase status: verified links on ES, needsReview not shown as clean customer URL', () => {
    const es = recommendApps({
      intake: { desiredApps: ['enterprise_security'], useCases: ['Enterprise Security / SIEM'] },
      sourceStatuses: { firewalls: { status: 'current' }, active_directory: { status: 'current' }, edr: { status: 'current' } },
    }).recommendedSolutions.find((r) => r.appId === 'enterprise_security');
    expect(es?.splunkbaseLinkStatus).toBe('verified');
    expect(es?.customerUrl).toMatch(/splunkbase\.splunk\.com/);
    const mc = recommendApps({
      intake: { desiredApps: ['mission_control'], runGoal: 'mature SOC mission control' },
      sourceStatuses: {},
    });
    const mcRec = [...allRecIds({ recommendedSolutions: [], helpfulApps: [], technicalAddons: [], dependencies: [] })];
    void mcRec;
    const entry = getAppCatalogEntry('mission_control');
    if (entry) {
      const rec = recommendApps({ intake: { desiredApps: ['mission_control'], runGoal: 'mature SOC' }, sourceStatuses: {} });
      const item = [...rec.recommendedSolutions, ...rec.helpfulApps].find((r) => r.appId === 'mission_control');
      if (item && item.splunkbaseLinkStatus === 'needsReview') {
        expect(item.customerUrl).toBeFalsy();
      }
    }
  });

  it('18 — customer-facing reasons omit raw scores and reason codes', () => {
    const result = recommendApps({
      intake: {
        useCases: ['Foundational Security / InfoSec'],
        crawlGoal: 'Getting started',
      },
      sourceStatuses: { firewalls: { status: 'current' } },
    });
    for (const item of [...result.recommendedSolutions, ...result.helpfulApps]) {
      expect(item.customerReason).toBeTruthy();
      expect(String(item.customerReason)).not.toMatch(/reasonCodes|score:/i);
      expect(item.seReason).not.toMatch(/^intent_/);
    }
  });

  it('19 — Robbins retail example recommends ES and MLTK from intake desiredApps', () => {
    const scenario = getSampleScenarioById('robbins_retail_hybrid');
    const result = recommendApps({
      intake: scenario.intake,
      sourceStatuses: scenario.sources,
    });
    expect(recIds(result.recommendedSolutions)).toContain('enterprise_security');
    expect(allRecIds(result)).toContain('machine_learning_toolkit');
  });

  it('20 — source app interest resolves display names to catalog ids', () => {
    expect(
      sourceMatchesAppInterest(['Splunk Enterprise Security'], ['enterprise_security']),
    ).toBe(true);
    expect(
      sourceMatchesAppInterest(['Splunk Security Essentials'], ['security_essentials']),
    ).toBe(true);
    expect(sourceMatchesAppInterest(['Splunk App for AWS'], ['enterprise_security'])).toBe(false);
  });

  it('21 — interpretInputs suggestedApps come from recommendation engine, not legacy profile TAs', () => {
    const interp = interpretInputs({
      useCases: ['Foundational Security / InfoSec'],
      crawlGoal: 'New to Splunk — pilot foundational security visibility',
      sourceStatuses: { firewalls: { status: 'current' } },
    });
    expect(interp.suggestedApps.length).toBeGreaterThan(0);
    expect(interp.suggestedApps.some((n) => /InfoSec|Security Essentials/i.test(n))).toBe(true);
    expect(interp.suggestedApps.some((n) => /Add-on for Microsoft Windows/i.test(n))).toBe(false);
  });
});
