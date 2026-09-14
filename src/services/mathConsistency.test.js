/**
 * Cross-page ingest math consistency — single pipeline, no divergent recalculation.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sourceCatalog from '../data/sources.json';
import sampleScenarios from '../data/sampleScenarios.js';
import { flattenSourceCatalog } from './sizingEngine.js';
import { resolveUseCaseProfiles } from './useCaseResolver.js';
import { computeIngestBudgetFromIntake } from './budgetEngine.js';
import { generatePlans } from './planEngine.js';
import {
  sumSessionPlanningIngest,
  getEligibleConfiguredSources,
} from './planningIngestTotals.js';
import { buildReviewGateData } from './reviewGateEngine.js';
import { buildCustomerReportData } from './customerReportDataBuilder.js';
import { buildReportExportPayload } from './reportExportEngine.js';
import { generateExecutiveSummary } from './valuePropEngine.js';
import { migrateSession, CURRENT_SCHEMA_VERSION } from './sessionMigrationEngine.js';
import { PLANNING_BUFFER_FRACTION } from '../utils/bufferBand.js';
import { buildCustomerDeliverableZipFiles } from './customerDeliverableExportBuilder.js';
import { sanitizeCustomerReportData } from './customerReportSanitizer.js';
import { formatIngestGb } from './exportShared.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pagesDir = resolve(__dirname, '../pages');

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const robbins = sampleScenarios.find((s) => s.id === 'robbins_retail_hybrid');

const syntheticSources = {
  firewalls: { status: 'current', number_of_systems: 6, vendor: 'Palo Alto Networks' },
  edr: { status: 'current', number_of_endpoints: 100, vendor: 'CrowdStrike' },
  active_directory: { status: 'current', number_of_dcs: 4, number_of_users: 800 },
  dns: { status: 'current', number_of_servers: 2 },
  iaas: { status: 'current', iaasAccountCount: 3 },
};

const syntheticIntake = {
  customerName: 'Math Consistency Synthetic',
  deploymentType: 'cloud',
  useCases: ['Threat Detection and Investigation'],
  pathBudgetPercentages: { crawl: 80, walk: 100, run: 110 },
};

/** Symbols that must not appear in page components — sizing math belongs in services. */
const BANNED_PAGE_SIZING_SYMBOLS = [
  'calculateSourceSize',
  'calculateTotals',
  'calculateFullSourceIngest',
  'applyOverlapExclusions',
  'applyPlanningBufferToSource',
  'calculatePlanningTotals',
  'summarizeSessionSizing',
  'calculateSimpleSourceIngest',
];

/** Module imports pages must not use for ingest math (use planningIngestTotals / reviewGate / planEngine instead). */
const BANNED_PAGE_SIZING_MODULE_PATTERNS = [
  { pattern: /from ['"][^'"]*\/simpleSizingEngine(?:\.js)?['"]/, label: 'simpleSizingEngine' },
  {
    pattern: /from ['"][^'"]*\/sourceEligibilityEngine(?:\.js)?['"]/,
    label: 'sourceEligibilityEngine sizing',
    unless: /getOverlapExcludedIds/,
    requireBannedSymbol: /calculateFullSourceIngest|calculateSimpleSourceIngest|sourceCountsTowardTotals/,
  },
  {
    pattern: /from ['"][^'"]*\/overlapEngine(?:\.js)?['"]/,
    label: 'overlapEngine sizing',
    requireBannedSymbol: /applyOverlapExclusions/,
  },
];

function sizingCtx(sourceStates) {
  return { catalog: sourceCatalog, allInputs: sourceStates };
}

function sumRawExpected(rows) {
  return rows.reduce((sum, row) => sum + (row.rawExpected ?? row.gbExpected ?? 0), 0);
}

function assertBufferBand(rows, totals) {
  for (const row of rows) {
    const expected = row.rawExpected ?? row.gbExpected ?? 0;
    if (expected <= 0) continue;
    expect(row.gbLow).toBeCloseTo(expected * (1 - PLANNING_BUFFER_FRACTION), 4);
    expect(row.gbHigh).toBeCloseTo(expected * (1 + PLANNING_BUFFER_FRACTION), 4);
  }
  if (totals.expected > 0) {
    expect(totals.low).toBeCloseTo(totals.expected * (1 - PLANNING_BUFFER_FRACTION), 3);
    expect(totals.high).toBeCloseTo(totals.expected * (1 + PLANNING_BUFFER_FRACTION), 3);
    expect(totals.buffered.low).toBeCloseTo(totals.expected * (1 - PLANNING_BUFFER_FRACTION), 3);
    expect(totals.buffered.high).toBeCloseTo(totals.expected * (1 + PLANNING_BUFFER_FRACTION), 3);
  }
}

function assertPathSourceBreakdown(plan) {
  const breakdownSum = (plan.sourceIngestGb || []).reduce((sum, row) => sum + (row.gbDay ?? 0), 0);
  expect(breakdownSum).toBeCloseTo(plan.totals.buffered.expected, 4);

  for (const row of plan.sourceIngestGb || []) {
    const expected = row.gbDay ?? 0;
    if (expected <= 0) continue;
    if (row.gbLow != null) {
      expect(row.gbLow).toBeCloseTo(expected * (1 - PLANNING_BUFFER_FRACTION), 4);
    }
    if (row.gbHigh != null) {
      expect(row.gbHigh).toBeCloseTo(expected * (1 + PLANNING_BUFFER_FRACTION), 4);
    }
  }

  expect(plan.totals.buffered.low).toBeCloseTo(plan.totals.buffered.expected * (1 - PLANNING_BUFFER_FRACTION), 3);
  expect(plan.totals.buffered.high).toBeCloseTo(plan.totals.buffered.expected * (1 + PLANNING_BUFFER_FRACTION), 3);
}

function assertExportHtmlMatchesReport(html, reportData) {
  const expected = formatIngestGb(reportData.pathDetail?.ingestSummary?.expected ?? reportData.ingestSummary.expected);
  const low = formatIngestGb(reportData.pathDetail?.ingestSummary?.low ?? reportData.ingestSummary.low);
  const high = formatIngestGb(reportData.pathDetail?.ingestSummary?.high ?? reportData.ingestSummary.high);
  expect(html).toContain(expected);
  expect(html).toContain(low);
  expect(html).toContain(high);
}

function assertPlanningMath(sourceStates, overlapDecisions = {}, intake = {}) {
  const ctx = sizingCtx(sourceStates);
  const eligible = getEligibleConfiguredSources({
    catalog: sourceCatalog,
    sourceStates,
    overlapDecisions,
    sizingContext: ctx,
  });
  const session = sumSessionPlanningIngest({
    catalog: sourceCatalog,
    sourceStates,
    overlapDecisions,
    sizingContext: ctx,
  });
  const review = buildReviewGateData({
    catalog: sourceCatalog,
    sourceStates,
    overlapDecisions,
    sizingContext: ctx,
    intake,
  });

  const eligibleExpectedSum = sumRawExpected(eligible);
  expect(session.totals.expected).toBeCloseTo(eligibleExpectedSum, 5);
  expect(review.totals.expected).toBeCloseTo(session.totals.expected, 5);
  expect(review.totals.expected).toBeCloseTo(sumRawExpected(review.eligible), 5);
  assertBufferBand(eligible, session.totals);
  assertBufferBand(review.eligible, review.totals);

  const { profiles } = resolveUseCaseProfiles(intake.useCases ? intake : robbins.intake);
  const budgetGbDay = computeIngestBudgetFromIntake(intake.opportunityBudgetUsd ? intake : robbins.intake)?.budgetGbDay ?? null;
  const plans = generatePlans(
    flatCatalog,
    sourceStates,
    profiles,
    [],
    overlapDecisions,
    PLANNING_BUFFER_FRACTION,
    { budgetGbDay, intake: intake.useCases ? intake : robbins.intake },
  );

  for (const plan of plans) {
    assertPathSourceBreakdown(plan);
  }

  return { session, plans, eligible, review };
}

function robbinsStateWithWalkPath() {
  const { state } = migrateSession({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    currentStep: 6,
    intake: robbins.intake,
    sources: robbins.sources,
    overlapDecisions: robbins.overlapDecisions,
    selectedPlanIndex: 1,
    reportPathExplicit: true,
    suppressPathRecommendation: robbins.suppressPathRecommendation,
  });
  return state;
}

function listPageComponents() {
  return readdirSync(pagesDir).filter((name) => name.endsWith('.jsx') && !name.endsWith('.test.jsx'));
}

describe('mathConsistency — page import guard', () => {
  it('pages do not import sizing math outside planningIngestTotals / reviewGate / planEngine chain', () => {
    const violations = [];

    for (const file of listPageComponents()) {
      const src = readFileSync(join(pagesDir, file), 'utf8');
      for (const sym of BANNED_PAGE_SIZING_SYMBOLS) {
        if (src.includes(sym)) {
          violations.push(`${file}: banned symbol ${sym}`);
        }
      }
      for (const rule of BANNED_PAGE_SIZING_MODULE_PATTERNS) {
        if (!rule.pattern.test(src)) continue;
        if (rule.unless && rule.unless.test(src) && !rule.requireBannedSymbol.test(src)) continue;
        if (rule.requireBannedSymbol && !rule.requireBannedSymbol.test(src)) continue;
        violations.push(`${file}: banned module import ${rule.label}`);
      }
      if (/calculateSourceSize|calculateTotals/.test(src)) {
        violations.push(`${file}: legacy sizingEngine totals`);
      }
    }

    expect(violations).toEqual([]);
  });
});

describe('mathConsistency — robbins_retail_hybrid', () => {
  it('review totals equal sum of eligible configured source expected values', () => {
    const { session, review } = assertPlanningMath(robbins.sources, robbins.overlapDecisions, robbins.intake);
    const configuredSum = sumRawExpected(review.eligible);

    expect(review.totals.expected).toBeCloseTo(configuredSum, 5);
    expect(session.totals.expected).toBeCloseTo(configuredSum, 5);
  });

  it('each path total equals sum of included sources with ±20% bands', () => {
    const { plans } = assertPlanningMath(robbins.sources, robbins.overlapDecisions, robbins.intake);
    expect(plans.length).toBe(3);

    for (const plan of plans) {
      assertPathSourceBreakdown(plan);
      const includedIds = new Set((plan.sources || []).map((s) => s.id));
      const pathEligible = getEligibleConfiguredSources({
        catalog: sourceCatalog,
        sourceStates: robbins.sources,
        overlapDecisions: robbins.overlapDecisions,
        sizingContext: sizingCtx(robbins.sources),
      }).filter((row) => includedIds.has(row.id));
      const pathExpectedSum = sumRawExpected(pathEligible);
      expect(plan.totals.buffered.expected).toBeCloseTo(pathExpectedSum, 4);
    }
  });

  it('report ingest matches selected Walk path totals', () => {
    const { plans } = assertPlanningMath(robbins.sources, robbins.overlapDecisions, robbins.intake);
    const walk = plans.find((p) => p.pathPhase === 'walk') || plans[1];
    const state = robbinsStateWithWalkPath();
    const report = buildCustomerReportData(state, { hideZeroUnconfigured: true });

    expect(report.ingestSummary.expected).toBeCloseTo(walk.totals.buffered.expected, 4);
    expect(report.ingestSummary.low).toBeCloseTo(walk.totals.buffered.low, 4);
    expect(report.ingestSummary.high).toBeCloseTo(walk.totals.buffered.high, 4);
    expect(report.pathDetail.ingestSummary.expected).toBeCloseTo(walk.totals.buffered.expected, 4);
    expect(report.pathDetail.ingestSummary.low).toBeCloseTo(walk.totals.buffered.low, 4);
    expect(report.pathDetail.ingestSummary.high).toBeCloseTo(walk.totals.buffered.high, 4);
  });

  it('export HTML payload and zip deliverables match in-app report numbers', () => {
    const { plans } = assertPlanningMath(robbins.sources, robbins.overlapDecisions, robbins.intake);
    const walk = plans.find((p) => p.pathPhase === 'walk') || plans[1];
    const state = robbinsStateWithWalkPath();
    const report = buildCustomerReportData(state, { hideZeroUnconfigured: true });
    const sanitized = sanitizeCustomerReportData(report);

    const exec = generateExecutiveSummary(plans, resolveUseCaseProfiles(robbins.intake).profiles, robbins.intake.customerName);
    const payload = buildReportExportPayload({
      customerName: robbins.intake.customerName,
      selectedPlan: walk,
      plans,
      sourceRows: report.sourceGroups.flatMap((g) => g.sources),
      sourceStates: robbins.sources,
      intake: robbins.intake,
      useCases: resolveUseCaseProfiles(robbins.intake).profiles,
      coverageValidation: { overallScore: walk.validation?.score ?? 0, gaps: [] },
      executiveSummary: exec,
      startupGuide: report.startupGuide,
      risks: report.risks,
      generatedAt: report.generatedAt,
    });

    expect(payload.totals.expected).toBeCloseTo(report.ingestSummary.expected, 4);
    expect(payload.totals.low).toBeCloseTo(report.ingestSummary.low, 4);
    expect(payload.totals.high).toBeCloseTo(report.ingestSummary.high, 4);

    const rowSum = payload.sourceRows.reduce(
      (sum, row) => sum + (row.ingestRange?.expected ?? row.ingest?.expected ?? 0),
      0,
    );
    expect(payload.totals.expected).toBeCloseTo(rowSum, 3);

    const files = buildCustomerDeliverableZipFiles(report, sanitized);
    assertExportHtmlMatchesReport(files['value-proposition.html'], sanitized);
    assertExportHtmlMatchesReport(files['startup-guide.html'], sanitized);
    assertExportHtmlMatchesReport(files['se-sales-summary.html'], report);
  });

  it('calibrated session stays under budget while Walk/Run paths differentiate', () => {
    const { session, plans } = assertPlanningMath(robbins.sources, robbins.overlapDecisions, robbins.intake);
    const budgetGbDay = computeIngestBudgetFromIntake(robbins.intake).budgetGbDay;

    expect(session.totals.buffered.expected).toBeLessThan(budgetGbDay);

    const walk = plans.find((p) => p.pathPhase === 'walk') || plans[1];
    const run = plans.find((p) => p.pathPhase === 'run') || plans[2];
    expect(walk.totals.buffered.expected).toBeLessThanOrEqual(budgetGbDay * 1.05);
    expect(run.totals.buffered.expected).toBeGreaterThanOrEqual(walk.totals.buffered.expected);
    expect(run.totals.buffered.expected).toBeLessThan(budgetGbDay);
  });
});

describe('mathConsistency — synthetic 5-source session', () => {
  it('session, review, path, report, and export totals agree', () => {
    const { session, plans } = assertPlanningMath(syntheticSources, {}, syntheticIntake);
    expect(session.totals.expected).toBeGreaterThan(0);

    const state = migrateSession({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      currentStep: 6,
      intake: syntheticIntake,
      sources: syntheticSources,
      overlapDecisions: {},
      selectedPlanIndex: 0,
      reportPathExplicit: true,
    }).state;

    const crawl = plans[0];
    const report = buildCustomerReportData(state, { hideZeroUnconfigured: true });
    expect(report.ingestSummary.expected).toBeCloseTo(crawl.totals.buffered.expected, 4);

    const payload = buildReportExportPayload({
      customerName: syntheticIntake.customerName,
      selectedPlan: crawl,
      plans,
      sourceRows: report.sourceGroups.flatMap((g) => g.sources),
      sourceStates: syntheticSources,
      intake: syntheticIntake,
      useCases: resolveUseCaseProfiles(syntheticIntake).profiles,
      coverageValidation: { overallScore: 50, gaps: [] },
      executiveSummary: { text: 'Synthetic planning summary.' },
      startupGuide: report.startupGuide,
      risks: [],
      generatedAt: report.generatedAt,
    });

    expect(payload.totals.expected).toBeCloseTo(report.ingestSummary.expected, 4);
    expect(report.ingestSummary.expected).toBeLessThanOrEqual(session.totals.expected + 0.01);
  });
});
