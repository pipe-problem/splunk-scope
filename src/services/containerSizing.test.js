import { describe, it, expect } from 'vitest';
import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog, calculateSourceSize } from './sizingEngine.js';
import {
  calculateContainerSizing,
  detectContainerOverlap,
  formatContainerGb,
  getContainerSizingReviewDisplay,
  normalizeContainerState,
  CONTAINER_REVIEW_SUMMARY,
} from './containerSizingEngine.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const containers = flatCatalog.find((s) => s.id === 'iaas_containers');

function baseState(overrides = {}) {
  return {
    containerPlatform: 'generic_kubernetes',
    containerCounts: { clusters: '1', nodes: '3', podsOrContainers: '50' },
    containerToggles: { includeAuditEvents: true, includeContainerStdout: true },
    ...overrides,
  };
}

describe('formatContainerGb', () => {
  it('formats by magnitude tiers', () => {
    expect(formatContainerGb(0)).toBe('0');
    expect(formatContainerGb(12.34)).toBe('12.3');
    expect(formatContainerGb(2.456)).toBe('2.46');
    expect(formatContainerGb(0.45)).toBe('0.45');
    expect(formatContainerGb(0.078)).toBe('0.078');
  });

  it('does not duplicate GB/day in numeric output', () => {
    expect(formatContainerGb(1.2)).not.toContain('GB');
  });
});

describe('normalizeContainerState / legacy migration', () => {
  it('defaults to average_blended platform', () => {
    const n = normalizeContainerState({});
    expect(n.containerPlatform).toBe('average_blended');
    expect(n.containerToggles.includeAuditEvents).toBe(true);
    expect(n.containerToggles.includeContainerStdout).toBe(true);
  });

  it('maps legacy count to clusters and vendor to platform', () => {
    const n = normalizeContainerState({ count: '2', vendor: 'Amazon EKS' });
    expect(n.containerPlatform).toBe('eks');
    expect(n.containerCounts.clusters).toBe('2');
  });

  it('treats blank numeric fields as empty strings', () => {
    const n = normalizeContainerState({
      containerCounts: { clusters: '', nodes: '', podsOrContainers: '' },
    });
    expect(n.containerCounts.clusters).toBe('');
    expect(n.containerCounts.nodes).toBe('');
  });
});

describe('Container additive sizing — measured examples', () => {
  it('Example 1 — small generic Kubernetes cluster', () => {
    const r = calculateContainerSizing(baseState());
    expect(r.low).toBeCloseTo(0.0061, 3);
    expect(r.expected).toBeCloseTo(0.13, 2);
    expect(r.high).toBeCloseTo(2.8, 1);
    expect(r.containerBreakdown).toHaveLength(4);
  });

  it('Example 2 — medium generic Kubernetes cluster', () => {
    const r = calculateContainerSizing(
      baseState({
        containerCounts: { clusters: '1', nodes: '20', podsOrContainers: '500' },
      }),
    );
    expect(r.low).toBeCloseTo(0.026, 2);
    expect(r.expected).toBeCloseTo(0.66, 1);
    expect(r.high).toBeCloseTo(17.7, 0);
  });

  it('Example 3 — large generic Kubernetes cluster', () => {
    const r = calculateContainerSizing(
      baseState({
        containerCounts: { clusters: '1', nodes: '50', podsOrContainers: '1500' },
      }),
    );
    expect(r.low).toBeCloseTo(0.071, 2);
    expect(r.expected).toBeCloseTo(1.83, 1);
    expect(r.high).toBeCloseTo(50.6, 0);
  });

  it('Example 4 — average blended medium cluster', () => {
    const r = calculateContainerSizing(
      baseState({
        containerPlatform: 'average_blended',
        containerCounts: { clusters: '1', nodes: '20', podsOrContainers: '500' },
      }),
    );
    expect(r.low).toBeCloseTo(0.031, 2);
    expect(r.expected).toBeCloseTo(0.78, 1);
    expect(r.high).toBeCloseTo(18.4, 0);
  });
});

describe('Container toggles and blank inputs', () => {
  it('excludes audit/events when toggle is off', () => {
    const r = calculateContainerSizing(
      baseState({
        containerToggles: { includeAuditEvents: false, includeContainerStdout: true },
      }),
    );
    expect(r.containerBreakdown.some((row) => row.id === 'audit_events')).toBe(false);
    expect(r.containerBreakdown.some((row) => row.id === 'control_plane')).toBe(true);
    const withAudit = calculateContainerSizing(baseState());
    expect(r.expected).toBeLessThan(withAudit.expected);
  });

  it('excludes container stdout when toggle is off', () => {
    const r = calculateContainerSizing(
      baseState({
        containerToggles: { includeAuditEvents: true, includeContainerStdout: false },
      }),
    );
    expect(r.containerBreakdown.some((row) => row.id === 'container_stdout')).toBe(false);
    const withStdout = calculateContainerSizing(baseState());
    expect(r.expected).toBeLessThan(withStdout.expected);
  });

  it('treats blank counts as zero', () => {
    const r = calculateContainerSizing({
      containerPlatform: 'generic_kubernetes',
      containerCounts: { clusters: '', nodes: '', podsOrContainers: '' },
    });
    expect(r.expected).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('Platform switch updates rates', () => {
  it('uses different rates for EKS vs generic Kubernetes', () => {
    const generic = calculateContainerSizing(baseState({ containerPlatform: 'generic_kubernetes' }));
    const eks = calculateContainerSizing(baseState({ containerPlatform: 'eks' }));
    expect(eks.expected).not.toBe(generic.expected);
  });
});

describe('Container overlap warning', () => {
  it('warns when overlapping sources are configured', () => {
    const msg = detectContainerOverlap(baseState(), {
      iaas_instances: { status: 'current', count: '10' },
    });
    expect(msg).toMatch(/overlap/i);
    expect(msg).toMatch(/IaaS/);
  });

  it('does not warn when no overlapping sources are active', () => {
    const msg = detectContainerOverlap(baseState(), {
      iaas_instances: { status: 'skip', count: '10' },
    });
    expect(msg).toBeNull();
  });
});

describe('Container review display', () => {
  it('shows customer-facing summary and breakdown labels', () => {
    const r = calculateContainerSizing(baseState());
    const display = getContainerSizingReviewDisplay(r);
    expect(display.summary).toBe(CONTAINER_REVIEW_SUMMARY);
    expect(display.rows.length).toBe(4);
    expect(display.rows[0].label).not.toContain('containerCounts');
  });
});

describe('Container sizing via sizingEngine', () => {
  it('routes iaas_containers through additive engine (not flat per-cluster rate)', () => {
    const r = calculateSourceSize(containers, baseState(), { allInputs: {} });
    expect(r.rateSource).toBe('container_additive');
    expect(r.expected).toBeCloseTo(0.13, 2);
    const flatLegacy = calculateSourceSize(
      { ...containers, sizing_formula: { primary_input: 'count', rate_per_unit: 0.25 } },
      { count: '1' },
    );
    expect(r.expected).not.toBeCloseTo(flatLegacy.expected, 2);
  });
});

describe('Container session field preservation', () => {
  it('preserves platform, counts, and toggles through normalize round-trip', () => {
    const original = {
      containerPlatform: 'gke',
      containerCounts: { clusters: '2', nodes: '15', podsOrContainers: '120' },
      containerToggles: { includeAuditEvents: false, includeContainerStdout: true },
    };
    const normalized = normalizeContainerState(original);
    expect(normalized.containerPlatform).toBe('gke');
    expect(normalized.containerCounts.nodes).toBe('15');
    expect(normalized.containerToggles.includeAuditEvents).toBe(false);
  });
});
