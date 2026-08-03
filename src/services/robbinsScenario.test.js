/**
 * Chuck Robbins retail example — over-budget configured ingest and path differentiation.
 */
import { describe, it, expect } from 'vitest';
import sampleScenarios from '../data/sampleScenarios.js';
import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog } from './sizingEngine.js';
import { computeIngestBudgetFromIntake } from './budgetEngine.js';
import { generatePlans } from './planEngine.js';
import { resolveUseCaseProfiles } from './useCaseResolver.js';
import { sumSessionPlanningIngest } from './planningIngestTotals.js';
import { applyPlanningBufferToSource } from '../utils/bufferBand.js';
import { getScopeMultiplier, calculateSourceSize } from './sizingEngine.js';
import { calculateLogOptionIngest } from './sourceHierarchyEngine.js';
import { applySizingGuardrails } from './sourceSizingGuardrailEngine.js';

function advancedFullSourceIngest(source, sourceState, sizingContext) {
  const childIngest = calculateLogOptionIngest(source, sourceState, sizingContext);
  const logOpts = source.log_options || [];
  const usesChannelSum = logOpts.length > 0 && childIngest > 0;
  if (usesChannelSum) {
    const base = calculateSourceSize(source, sourceState, sizingContext);
    const combined = {
      ...base,
      low: base.low + childIngest * 0.6,
      expected: base.expected + childIngest,
      high: base.high + childIngest * 1.5,
      childIngest,
    };
    return applySizingGuardrails(source, sourceState, combined);
  }
  const base = calculateSourceSize(source, sourceState, sizingContext);
  const combined = {
    ...base,
    low: base.low + childIngest * 0.6,
    expected: base.expected + childIngest,
    high: base.high + childIngest * 1.5,
    childIngest,
  };
  return applySizingGuardrails(source, sourceState, combined);
}

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const robbins = sampleScenarios.find((s) => s.id === 'robbins_retail_hybrid');

describe('Robbins retail example scenario', () => {
  it('loads as the sole Load Example scenario', () => {
    expect(sampleScenarios.length).toBe(1);
    expect(robbins).toBeTruthy();
    expect(robbins.suppressPathRecommendation).toBe(true);
    expect(robbins.selectedPlanIndex).toBeNull();
  });

  it('configured session and run path exceed 150 GB/day buffered', () => {
    const budgetGbDay = computeIngestBudgetFromIntake(robbins.intake).budgetGbDay;
    expect(budgetGbDay).toBeCloseTo(150, 0);
    const session = sumSessionPlanningIngest({
      catalog: sourceCatalog,
      sourceStates: robbins.sources,
      overlapDecisions: robbins.overlapDecisions,
      sizingContext: { catalog: sourceCatalog, allInputs: robbins.sources },
    });
    const { profiles } = resolveUseCaseProfiles(robbins.intake);
    const plans = generatePlans(
      flatCatalog,
      robbins.sources,
      profiles,
      [],
      robbins.overlapDecisions,
      0.2,
      { budgetGbDay, intake: robbins.intake },
    );
    const run = plans.find((p) => p.pathPhase === 'run') || plans[2];
    expect(session.totals.buffered.expected).toBeGreaterThan(budgetGbDay);
    expect(run.totals.buffered.expected).toBeGreaterThan(budgetGbDay);
  });

  it('generates three distinct budget-aware paths under cap', () => {
    const { profiles } = resolveUseCaseProfiles(robbins.intake);
    const budgetGbDay = computeIngestBudgetFromIntake(robbins.intake).budgetGbDay;
    const plans = generatePlans(
      flatCatalog,
      robbins.sources,
      profiles,
      [],
      robbins.overlapDecisions,
      0.2,
      { budgetGbDay, intake: robbins.intake },
    );
    expect(plans.length).toBe(3);
    const ingestValues = plans.map((p) => p.totals.buffered.expected);
    expect(new Set(ingestValues.map((v) => Math.round(v * 10) / 10)).size).toBeGreaterThan(1);
    expect(plans[1].totals.buffered.expected).toBeGreaterThanOrEqual(plans[0].totals.buffered.expected);
    for (const p of plans.slice(0, 2)) {
      expect(p.totals.buffered.expected).toBeLessThanOrEqual(budgetGbDay * 1.1);
    }
  });

  it('includes path budget percentages 80/100/110 on intake', () => {
    expect(robbins.intake.pathBudgetPercentages).toEqual({ crawl: 80, walk: 100, run: 110 });
  });

  it('overlap decisions are annotate-only — windows_servers stays in totals', () => {
    expect(robbins.overlapDecisions.saas_general__saas_office.selectedOption.dedup).toBe(false);
    expect(robbins.overlapDecisions.edr__windows_servers.selectedOption.dedup).toBe(false);
    const session = sumSessionPlanningIngest({
      catalog: sourceCatalog,
      sourceStates: robbins.sources,
      overlapDecisions: robbins.overlapDecisions,
      sizingContext: { catalog: sourceCatalog, allInputs: robbins.sources },
    });
    const ids = new Set(session.eligible.map((e) => e.id));
    expect(ids.has('windows_servers')).toBe(true);
    expect(ids.has('edr')).toBe(true);
  });

  it('saas_general and saas_office both count when configured — overlap is note only', () => {
    const sources = {
      ...robbins.sources,
      saas_general: {
        ...robbins.sources.saas_general,
        status: 'current',
        number_of_users: 200,
      },
      saas_office: {
        ...robbins.sources.saas_office,
        status: 'current',
        officeActiveUserCount: 1200,
      },
    };
    const sizingCtx = { catalog: sourceCatalog, allInputs: sources };
    const session = sumSessionPlanningIngest({
      catalog: sourceCatalog,
      sourceStates: sources,
      overlapDecisions: robbins.overlapDecisions,
      sizingContext: sizingCtx,
    });
    const ids = new Set(session.eligible.map((e) => e.id));
    expect(ids.has('saas_general')).toBe(true);
    expect(ids.has('saas_office')).toBe(true);
    expect(session.totals.expected).toBeGreaterThan(
      (session.eligible.find((e) => e.id === 'saas_office')?.gbExpected ?? 0) +
        (session.eligible.find((e) => e.id === 'saas_general')?.gbExpected ?? 0) -
        0.01,
    );
  });
});

describe('Logging scope / profile sizing', () => {
  it('firewall logging_scope changes guardrail-backed ingest', () => {
    const fw = flatCatalog.find((s) => s.id === 'firewalls');
    const base = {
      status: 'current',
      number_of_systems: 6,
      number_of_users: 1200,
      vendor: 'Palo Alto Networks',
    };
    const standard = advancedFullSourceIngest(fw, { ...base, logging_scope: 'Traffic + threat prevention' }, {
      catalog: sourceCatalog,
      allInputs: {},
    });
    const verbose = advancedFullSourceIngest(fw, { ...base, logging_scope: 'Full verbose (all sessions)' }, {
      catalog: sourceCatalog,
      allInputs: {},
    });
    expect(verbose.expected).toBeGreaterThan(standard.expected * 1.2);
  });

  it('cloud VM collection profile changes ingest via guardrail bands', () => {
    const vm = flatCatalog.find((s) => s.id === 'iaas_instances');
    const base = {
      status: 'current',
      cloudVmProvider: 'aws_ec2',
      cloudVmInstanceCount: 80,
      count: 80,
      cloudVmCustomizeComponents: false,
    };
    const standard = advancedFullSourceIngest(
      vm,
      { ...base, cloudVmCollectionProfile: 'standard_vm_logs' },
      { catalog: sourceCatalog, allInputs: {} },
    );
    const full = advancedFullSourceIngest(
      vm,
      { ...base, cloudVmCollectionProfile: 'full_vm_logs' },
      { catalog: sourceCatalog, allInputs: {} },
    );
    expect(full.expected).toBeGreaterThan(standard.expected * 1.2);
  });

  it('getScopeMultiplier distinguishes verbose vs minimal firewall scope strings', () => {
    expect(getScopeMultiplier('Full verbose (all sessions)', null)).toBeGreaterThan(
      getScopeMultiplier('Security only', null),
    );
  });
});
