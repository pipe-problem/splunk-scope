import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sourceCatalog from '../data/sources.json';
import sampleScenarios from '../data/sampleScenarios.js';
import { buildReviewGateData } from '../services/reviewGateEngine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(resolve(__dirname, 'ReviewPage.jsx'), 'utf8');
const robbins = sampleScenarios.find((s) => s.id === 'robbins_retail_hybrid');

describe('ReviewPage confirmation gate', () => {
  it('uses buildReviewGateData only — no page-local ingest math', () => {
    expect(pageSource).toContain('buildReviewGateData');
    expect(pageSource).not.toContain('calculateFullSourceIngest');
    expect(pageSource).not.toContain('applyOverlapExclusions');
    expect(pageSource).not.toContain('summarizeSessionSizing');
    expect(pageSource).not.toContain('IngestChart');
    expect(pageSource).not.toContain('sumSessionPlanningIngest');
  });

  it('uses tabbed layout with Overview default', () => {
    expect(pageSource).toContain("useState('overview')");
    expect(pageSource).toContain('Overview');
    expect(pageSource).toContain('Not yet sized');
    expect(pageSource).toContain('Shared telemetry');
    expect(pageSource).not.toContain('grid-cols-4');
    expect(pageSource).not.toContain('sticky top-0');
    expect(pageSource).not.toContain('<table');
  });

  it('Overview shows hero expected GB and range band', () => {
    expect(pageSource).toContain('RangeBandBar');
    expect(pageSource).toContain('TopSourcesBarChart');
    expect(pageSource).toContain('configuredCount');
    expect(pageSource).toContain('missingPriorityCount');
    expect(pageSource).toContain('TOTAL_CONFIGURED_INGEST_LABEL');
    expect(pageSource).toContain('RANGE_CAPTION');
    expect(pageSource).toContain('Estimated daily volume from sources you sized together');
    expect(pageSource).not.toContain('Expected planning ingest');
    expect(pageSource).not.toContain('planning range');
    expect(pageSource).not.toMatch(/First look at planning ingest/i);
  });

  it('uses neutral volume colors — green only on configured chip', () => {
    expect(pageSource).toContain('text-5xl sm:text-6xl lg:text-7xl font-black tabular-nums text-[var(--cast-accent)]');
    const rangeBand = pageSource.slice(pageSource.indexOf('function RangeBandBar'), pageSource.indexOf('function TopSourcesBarChart'));
    expect(rangeBand).not.toContain('cast-success');
    expect(rangeBand).toContain('cast-accent');
    const topChart = pageSource.slice(pageSource.indexOf('function TopSourcesBarChart'), pageSource.indexOf('function OverlapPairVisual'));
    expect(topChart).not.toContain('cast-success');
    expect(topChart).toContain('bg-[var(--cast-accent)]');
    expect(pageSource).toContain('font-mono font-bold text-[var(--cast-text)]');
    expect(pageSource).toContain('bg-[var(--cast-success)]/10 text-[var(--cast-success)]');
    expect(pageSource).toContain('bg-[var(--cast-warning)]/10 text-[var(--cast-warning)]');
  });

  it('Sources tab uses card list sorted from configuredRows', () => {
    expect(pageSource).toContain('sortedConfiguredRows');
    expect(pageSource).toContain('formatQuantityUnit');
  });

  it('opens Sources config via OPEN_SOURCE_FOR_CONFIG', () => {
    expect(pageSource).toContain('OPEN_SOURCE_FOR_CONFIG');
    expect(pageSource).toContain('STEP.SOURCES');
    expect(pageSource).toContain('Add sizing');
  });

  it('overlap tab uses planning-friendly annotate note', () => {
    expect(pageSource).toContain('OVERLAP_ANNOTATE_ONLY_NOTE');
    expect(pageSource).not.toContain('annotate-only');
    expect(pageSource).not.toContain('excluded from totals');
    expect(pageSource).not.toContain('line-through');
    expect(pageSource).toContain('OverlapPairVisual');
    expect(pageSource).toContain('What overlaps?');
    expect(pageSource).toContain('sharedTelemetry');
  });

  it('KPI total matches buildReviewGateData eligible rows (±0.1)', () => {
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
  });
});
