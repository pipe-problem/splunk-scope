/**
 * Architecture path themes, roadmap readiness, and three-path model (Crawl / Walk / Run).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/featureFlags.js', () => ({
  SIZING_MODE: 'advanced',
  OVERLAP_ANNOTATE_ONLY: false,
  SHOW_COVERAGE_PAGE: false,
}));

import sourceCatalog from '../data/sources.json';
import useCaseProfiles from '../data/useCaseProfiles.json';
import sampleScenarios from '../data/sampleScenarios.js';
import { flattenSourceCatalog } from './sizingEngine.js';
import { generatePlans, resolvePathBudgetTargets } from './planEngine.js';
import { computeIngestBudgetFromIntake } from './budgetEngine.js';
import { resolveUseCaseProfiles } from './useCaseResolver.js';
import { computeDetectionDepthScore } from './pathThemeEngine.js';
import { buildPathCardMessaging } from './pathValueMessagingEngine.js';
import { getRoadmapReadinessLabel, ROADMAP_READINESS_LABEL } from './pathOutcomeScoringEngine.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const foundational = useCaseProfiles.find((uc) => uc.id === 'foundational_security');

function baseState(id, overrides = {}) {
  return {
    status: 'current',
    number_of_users: 5000,
    number_of_endpoints: 2000,
    number_of_systems: 4,
    number_of_servers: 25,
    number_of_dcs: 4,
    count: 100,
    vendor: 'Microsoft',
    logging_scope: 'Security + System',
    ...overrides,
  };
}

function richSecurityStates() {
  const ids = [
    'active_directory',
    'firewalls',
    'windows_servers',
    'dns',
    'edr',
    'saas_sso',
    'proxy',
    'vpn',
    'email',
    'vuln_mgmt',
    'saas_office',
    'asset_cmdb',
    'iaas',
    'iaas_instances',
    'iaas_storage',
    'iaas_containers',
    'saas_general',
    'saas_crm',
    'dlp',
    'web_servers',
    'database',
  ];
  const states = {};
  for (const id of ids) {
    states[id] = baseState(id);
  }
  states.firewalls = baseState('firewalls', { vendor: 'Palo Alto Networks', count: 8 });
  states.iaas = baseState('iaas', { number_of_accounts: 4, cloud_provider: 'aws' });
  states.iaas_instances = baseState('iaas_instances', { instance_count: 120, cloud_provider: 'aws' });
  states.iaas_storage = baseState('iaas_storage', { count: 40, cloud_provider: 'aws' });
  states.iaas_containers = baseState('iaas_containers', { cluster_count: 6, platform: 'kubernetes' });
  states.saas_office = baseState('saas_office', { count: 5000, product: 'microsoft_365' });
  states.saas_general = baseState('saas_general', { count: 5000, vendor: 'salesforce' });
  states.saas_crm = baseState('saas_crm', { count: 5000, vendor: 'salesforce' });
  return states;
}

function richPlans() {
  return generatePlans(flatCatalog, richSecurityStates(), [foundational], [], {}, 0.2, {
    budgetGbDay: 250,
    primaryProfileId: 'foundational_security',
  });
}

describe('Architecture path themes & roadmap readiness', () => {
  it('generates exactly three paths: crawl, walk, run', () => {
    const plans = richPlans();
    expect(plans.length).toBe(3);
    expect(plans.map((p) => p.pathPhase)).toEqual(['crawl', 'walk', 'run']);
    expect(plans.map((p) => p.name)).toEqual(['Crawl', 'Walk', 'Run']);
  });

  it('walk ingest >= crawl and run >= walk when enough configured sources', () => {
    const plans = richPlans();
    const [crawl, walk, run] = plans;
    expect(walk.totals.buffered.expected).toBeGreaterThanOrEqual(crawl.totals.buffered.expected);
    expect(run.totals.buffered.expected).toBeGreaterThanOrEqual(walk.totals.buffered.expected);
    expect(run.sources.length).toBeGreaterThanOrEqual(crawl.sources.length);
  });

  it('budget targets use intake path percentages (default 80/100/110)', () => {
    const targets = resolvePathBudgetTargets(100, {});
    expect(targets.crawl).toBeCloseTo(80, 1);
    expect(targets.walk).toBeCloseTo(100, 1);
    expect(targets.run).toBeCloseTo(110, 1);
  });

  it('scores increase by phase and land in demo-friendly ranges', () => {
    const plans = richPlans();
    const [crawl, walk, run] = plans;
    const crawlR = crawl.outcomeReadiness?.score ?? 0;
    const walkR = walk.outcomeReadiness?.score ?? 0;
    const runR = run.outcomeReadiness?.score ?? 0;

    expect(crawlR).toBeLessThan(walkR);
    expect(walkR).toBeLessThanOrEqual(runR);

    expect(crawlR).toBeGreaterThanOrEqual(58);
    expect(crawlR).toBeLessThanOrEqual(68);
    expect(walkR).toBeGreaterThanOrEqual(76);
    expect(walkR).toBeLessThanOrEqual(88);
    expect(runR).toBeGreaterThanOrEqual(90);
    expect(runR).toBeLessThanOrEqual(98);
  });

  it('Walk is not displayed as a weak low-percent plan', () => {
    const plans = richPlans();
    const walk = plans[1];
    expect(walk.outcomeReadiness.score).toBeGreaterThanOrEqual(76);
    expect(walk.outcomeReadiness.label).toBe(ROADMAP_READINESS_LABEL);
    expect(walk.outcomeReadiness.qualitativeLabel).toMatch(/Strong|Target-ready/);
  });

  it('Run scores as target-ready when nearly all roadmap sources are included', () => {
    const plans = richPlans();
    const run = plans[2];
    expect(run.pathPhase).toBe('run');
    expect(run.outcomeReadiness.score).toBeGreaterThanOrEqual(90);
    expect(run.outcomeReadiness.qualitativeLabel).toBe('Target-ready');
    expect(run.outcomeReadiness.breakdown.roadmapCompletenessPct).toBeGreaterThanOrEqual(95);
  });

  it('Crawl detection depth is not saturated at 100%', () => {
    const plans = richPlans();
    const crawl = plans[0];
    const depthPct = crawl.outcomeReadiness?.breakdown?.detectionDepthPct ?? 0;
    expect(depthPct).toBeLessThan(90);
    const rawDepth = computeDetectionDepthScore(crawl.sources);
    expect(rawDepth).toBeLessThan(0.9);
  });

  it('adding enrichment sources increases depth score', () => {
    const minimal = generatePlans(
      flatCatalog,
      {
        active_directory: baseState('active_directory'),
        firewalls: baseState('firewalls'),
        windows_servers: baseState('windows_servers'),
      },
      [foundational],
      [],
      {},
      0.2,
      { budgetGbDay: 100 },
    );
    const full = richPlans();
    const crawlMin = minimal[0].outcomeReadiness?.breakdown?.detectionDepthPct ?? 0;
    const runFull = full[2].outcomeReadiness?.breakdown?.detectionDepthPct ?? 0;
    expect(runFull).toBeGreaterThan(crawlMin);
  });

  it('each plan includes totals, coverage, appsPowered, gaps, and categoryBreakdown', () => {
    const plans = richPlans();
    for (const plan of plans) {
      expect(plan.totals?.buffered?.expected).toBeGreaterThan(0);
      expect(plan.coverage).toBeTruthy();
      expect(Array.isArray(plan.appsPowered)).toBe(true);
      expect(Array.isArray(plan.gaps)).toBe(true);
      expect(Array.isArray(plan.categoryBreakdown)).toBe(true);
      if (plan.categoryBreakdown.length > 0) {
        expect(plan.categoryBreakdown[0]).toMatchObject({
          category: expect.any(String),
          gbDay: expect.any(Number),
          pct: expect.any(Number),
        });
      }
    }
  });

  it('plan gaps never use generic Additional telemetry needed placeholder', () => {
    const minimal = generatePlans(
      flatCatalog,
      {
        active_directory: baseState('active_directory', { number_of_dcs: 2 }),
        firewalls: baseState('firewalls', { count: 2 }),
      },
      [foundational],
      [],
      {},
      0.2,
      { budgetGbDay: 100 },
    );
    const plans = [...minimal, ...richPlans()];
    for (const plan of plans) {
      for (const gap of plan.gaps) {
        expect(gap).not.toContain('Additional telemetry needed');
        expect(gap).not.toMatch(/^Coverage:\s*Additional telemetry needed/i);
      }
    }
  });

  it('path card messaging is short and includes executive sections', () => {
    const plans = richPlans();
    for (const plan of plans) {
      const msg = plan.pathMessaging || buildPathCardMessaging(plan, [foundational]);
      expect(msg.cardUnlock.length).toBeLessThan(80);
      expect(msg.cardBestFor.length).toBeLessThan(80);
      expect(msg.cardNotYet.length).toBeLessThan(80);
      expect(msg.executive?.whatYouGet?.length).toBeGreaterThan(0);
      expect(msg.executive?.notYetIncluded?.length).toBeGreaterThan(0);
      expect(msg.executive?.bestFit?.length).toBeGreaterThan(0);
      expect(msg.executiveRisk?.title).toBeTruthy();
      expect(msg.executiveRisk?.impact.length).toBeLessThan(160);
    }
    const walk = plans[1];
    expect(walk.pathMessaging.badge).toBeNull();
    const run = plans[2];
    expect(run.pathMessaging.badge?.label).toMatch(/target/i);
    const crawl = plans[0];
    expect(crawl.pathMessaging.badge).toBeNull();
  });

  it('qualitative readiness labels map correctly', () => {
    expect(getRoadmapReadinessLabel(55)).toBe('Foundation');
    expect(getRoadmapReadinessLabel(64)).toBe('Developing');
    expect(getRoadmapReadinessLabel(82)).toBe('Strong');
    expect(getRoadmapReadinessLabel(95)).toBe('Target-ready');
  });

  it('delta messaging is attached for paths after Crawl', () => {
    const plans = richPlans();
    for (let i = 1; i < plans.length; i++) {
      const plan = plans[i];
      expect(plan.pathComparison).toBeTruthy();
      expect(typeof plan.pathComparison.sourceDelta).toBe('number');
      expect(typeof plan.pathComparison.ingestDeltaGb).toBe('number');
      expect(typeof plan.pathComparison.readinessDelta).toBe('number');
      if (plan.pathComparison.sourceDelta > 0 || plan.pathComparison.readinessDelta > 0) {
        expect(plan.pathComparison.summary || plan.pathComparison.addedSources?.length).toBeTruthy();
      }
    }
  });

  it('readiness breakdown includes roadmap completeness and domain coverage remains available', () => {
    const plans = richPlans();
    const run = plans[2];
    expect(run.outcomeReadiness.breakdown.roadmapCompletenessPct).toBeGreaterThan(0);
    expect(run.outcomeReadiness.breakdown.roadmapMaturityPct).toBeGreaterThan(0);
    expect(run.outcomeReadiness.domainCoverageScore).toBeGreaterThan(0);
    expect(run.outcomeReadiness.breakdown.detectionDepthPct).toBeLessThan(100);
  });

  it('Value tab executive sections include upgrade and best-fit copy', () => {
    const plans = richPlans();
    const walk = plans[1];
    const exec = walk.pathMessaging.executive;
    expect(exec.whatYouGet.length).toBeGreaterThan(0);
    expect(exec.notYetIncluded.length).toBeGreaterThan(0);
    expect(exec.whyUpgrade.length).toBeGreaterThan(0);
    expect(exec.bestFit.length).toBeGreaterThan(0);
    expect(walk.pathMessaging.executiveRisk.impact).toMatch(/SaaS|compliance|Run/i);
  });

  it('Robbins demo: paths differ in readiness and ingest under budget cap', () => {
    const robbins = sampleScenarios.find((s) => s.id === 'robbins_retail_hybrid');
    const { profiles } = resolveUseCaseProfiles(robbins.intake);
    const budget = computeIngestBudgetFromIntake(robbins.intake).budgetGbDay;
    const plans = generatePlans(flatCatalog, robbins.sources, profiles, [], robbins.overlapDecisions, 0.2, {
      budgetGbDay: budget,
      intake: robbins.intake,
    });
    expect(plans.length).toBe(3);
    const readinessScores = plans.map((p) => p.outcomeReadiness?.score ?? 0);
    const uniqueReadiness = new Set(readinessScores);
    expect(uniqueReadiness.size).toBeGreaterThan(1);

    expect(plans[1].outcomeReadiness.score).toBeGreaterThan(plans[0].outcomeReadiness.score);
    expect(plans[2].outcomeReadiness.score).toBeGreaterThanOrEqual(88);

    const ingestValues = plans.map((p) => p.totals.buffered.expected);
    expect(new Set(ingestValues.map((v) => Math.round(v * 10) / 10)).size).toBeGreaterThan(1);
    expect(plans[1].totals.buffered.expected).toBeGreaterThanOrEqual(plans[0].totals.buffered.expected);
  });
});
