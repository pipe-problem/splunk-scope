import { describe, it, expect } from 'vitest';
import sourceCatalog from '../data/sources.json';
import sampleScenarios from '../data/sampleScenarios.js';
import { buildReviewGateData, getConfiguredOverlapNotes } from './reviewGateEngine.js';
import { sumSessionPlanningIngest } from './planningIngestTotals.js';

const robbins = sampleScenarios.find((s) => s.id === 'robbins_retail_hybrid');

describe('reviewGateEngine', () => {
  it('session total equals sum of eligible row expected values (±0.1)', () => {
    const sizingCtx = { catalog: sourceCatalog, allInputs: robbins.sources };
    const review = buildReviewGateData({
      catalog: sourceCatalog,
      sourceStates: robbins.sources,
      overlapDecisions: robbins.overlapDecisions,
      sizingContext: sizingCtx,
      intake: robbins.intake,
    });
    const rowSum = review.eligible.reduce((acc, r) => acc + (r.gbExpected ?? 0), 0);
    expect(review.totals.expected).toBeCloseTo(rowSum, 1);

    const session = sumSessionPlanningIngest({
      catalog: sourceCatalog,
      sourceStates: robbins.sources,
      overlapDecisions: robbins.overlapDecisions,
      sizingContext: sizingCtx,
    });
    expect(review.totals.expected).toBeCloseTo(session.totals.expected, 5);
  });

  it('overlap notes do not reduce session totals', () => {
    const sources = {
      ...robbins.sources,
      saas_general: {
        ...robbins.sources.saas_general,
        status: 'current',
        saasTenantCount: 2,
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

    const overlaps = getConfiguredOverlapNotes(sources, sourceCatalog);
    const saasPair = overlaps.find((o) => o.pairKey === 'saas_general__saas_office');
    expect(saasPair).toBeTruthy();
    expect(saasPair.summary).toMatch(/share|overlap|M365|audit/i);
    expect(saasPair.sharedTelemetry.length).toBeGreaterThanOrEqual(3);
    expect(saasPair.confirmQuestion).toBeTruthy();
  });
});
