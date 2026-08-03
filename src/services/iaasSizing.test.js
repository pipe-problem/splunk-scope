import { describe, it, expect } from 'vitest';
import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog, calculateSourceSize } from './sizingEngine.js';
import {
  calculateIaasSizing,
  detectIaasChildOverlap,
  formatIaasGb,
  mapLegacyVendorToProvider,
  normalizeIaasState,
} from './iaasSizingEngine.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const iaas = flatCatalog.find((s) => s.id === 'iaas');

describe('formatIaasGb', () => {
  it('formats by magnitude tiers', () => {
    expect(formatIaasGb(0)).toBe('0');
    expect(formatIaasGb(2.456)).toBe('2.5');
    expect(formatIaasGb(0.45)).toBe('0.45');
    expect(formatIaasGb(0.078)).toBe('0.078');
  });

  it('does not duplicate GB/day in numeric output', () => {
    expect(formatIaasGb(1.2)).not.toContain('GB');
  });
});

describe('normalizeIaasState / legacy migration', () => {
  it('maps legacy vendor and number_of_accounts', () => {
    const n = normalizeIaasState({
      vendor: 'AWS',
      number_of_accounts: '4',
    });
    expect(n.iaasProvider).toBe('aws');
    expect(n.iaasAccountCount).toBe('4');
    expect(n.iaasSizingMode).toBe('standard');
  });

  it('mapLegacyVendorToProvider handles Azure and Oracle Cloud', () => {
    expect(mapLegacyVendorToProvider('Azure')).toBe('azure');
    expect(mapLegacyVendorToProvider('Oracle Cloud')).toBe('oci');
  });
});

describe('IaaS standard sizing', () => {
  it('calculates AWS correctly', () => {
    const r = calculateIaasSizing({
      iaasProvider: 'aws',
      iaasSizingMode: 'standard',
      iaasAccountCount: '10',
    });
    expect(r.low).toBeCloseTo(0.5, 6);
    expect(r.expected).toBeCloseTo(3.0, 6);
    expect(r.high).toBeCloseTo(30.0, 6);
    expect(r.confidence).toBe('medium');
    expect(r.needsReview).toBe(true);
  });

  it('calculates Azure correctly', () => {
    const r = calculateIaasSizing({
      iaasProvider: 'azure',
      iaasSizingMode: 'standard',
      iaasAccountCount: '2',
    });
    expect(r.low).toBeCloseTo(0.1, 6);
    expect(r.expected).toBeCloseTo(0.7, 6);
    expect(r.high).toBeCloseTo(7.0, 6);
  });

  it('calculates Average / Unknown correctly', () => {
    const r = calculateIaasSizing({
      iaasProvider: 'average',
      iaasSizingMode: 'standard',
      iaasAccountCount: '4',
    });
    expect(r.low).toBeCloseTo(0.2, 6);
    expect(r.expected).toBeCloseTo(1.2, 6);
    expect(r.high).toBeCloseTo(13.0, 6);
  });

  it('uses legacy number_of_accounts when iaasAccountCount missing', () => {
    const r = calculateIaasSizing({
      vendor: 'GCP',
      number_of_accounts: '5',
    });
    expect(r.expected).toBeCloseTo(1.5, 6);
  });
});

describe('IaaS advanced sizing', () => {
  it('sums scope subtotals and does not apply standard provider rate', () => {
    const r = calculateIaasSizing({
      iaasProvider: 'aws',
      iaasSizingMode: 'advanced',
      iaasAccountCount: '100',
      iaasAdvancedCounts: {
        accountLikeContainers: '2',
        instances: '10',
        flowLogInterfaces: '',
        storageBuckets: '1',
        kubernetesClusters: '1',
        containersOrPods: '5',
      },
    });
    // audit: 2 * 0.078 = 0.156
    // config: 2 * 0.0035 = 0.007
    // compute: 10 * 0.000289 = 0.00289
    // storage: 1 * 0.03 = 0.03
    // k8s cp: 1 * 0.017 = 0.017
    // k8s audit: 1 * 0.107 = 0.107
    // pods: 5 * 0.0085 = 0.0425
    const expectedMedium = 0.156 + 0.007 + 0.00289 + 0.03 + 0.017 + 0.107 + 0.0425;
    expect(r.expected).toBeCloseTo(expectedMedium, 5);
    expect(r.expected).toBeLessThan(1);
    expect(r.iaasBreakdown?.length).toBeGreaterThan(0);
  });

  it('treats blank advanced inputs as 0', () => {
    const r = calculateIaasSizing({
      iaasProvider: 'aws',
      iaasSizingMode: 'advanced',
      iaasAdvancedCounts: {
        accountLikeContainers: '',
        instances: '0',
        flowLogInterfaces: null,
        storageBuckets: undefined,
        kubernetesClusters: ' ',
        containersOrPods: '',
      },
    });
    expect(r.expected).toBe(0);
    expect(r.warnings.some((w) => /at least one advanced count/i.test(w))).toBe(true);
  });

  it('applies kubernetes cluster count to control-plane and audit/events', () => {
    const r = calculateIaasSizing({
      iaasProvider: 'aws',
      iaasSizingMode: 'advanced',
      iaasAdvancedCounts: {
        accountLikeContainers: '',
        instances: '',
        flowLogInterfaces: '',
        storageBuckets: '',
        kubernetesClusters: '2',
        containersOrPods: '',
      },
    });
    const cp = r.iaasBreakdown.find((b) => b.id === 'k8s_control_plane');
    const audit = r.iaasBreakdown.find((b) => b.id === 'k8s_audit_events');
    expect(cp?.mediumGb).toBeCloseTo(2 * 0.017, 6);
    expect(audit?.mediumGb).toBeCloseTo(2 * 0.107, 6);
  });

  it('applies container count to pod stdout only', () => {
    const r = calculateIaasSizing({
      iaasProvider: 'aws',
      iaasSizingMode: 'advanced',
      iaasAdvancedCounts: {
        accountLikeContainers: '',
        instances: '',
        flowLogInterfaces: '',
        storageBuckets: '',
        kubernetesClusters: '',
        containersOrPods: '3',
      },
    });
    expect(r.iaasBreakdown).toHaveLength(1);
    expect(r.iaasBreakdown[0].id).toBe('pod_stdout');
    expect(r.expected).toBeCloseTo(3 * 0.0085, 6);
  });

  it('applies account count to audit and config inventory', () => {
    const r = calculateIaasSizing({
      iaasProvider: 'aws',
      iaasSizingMode: 'advanced',
      iaasAdvancedCounts: {
        accountLikeContainers: '3',
        instances: '',
        flowLogInterfaces: '',
        storageBuckets: '',
        kubernetesClusters: '',
        containersOrPods: '',
      },
    });
    const audit = r.iaasBreakdown.find((b) => b.id === 'cloud_audit');
    const config = r.iaasBreakdown.find((b) => b.id === 'config_inventory');
    expect(audit?.mediumGb).toBeCloseTo(3 * 0.078, 6);
    expect(config?.mediumGb).toBeCloseTo(3 * 0.0035, 6);
  });
});

describe('IaaS provider labels', () => {
  it('updates unit context via provider meta', () => {
    const azure = calculateIaasSizing({
      iaasProvider: 'azure',
      iaasSizingMode: 'standard',
      iaasAccountCount: '1',
    });
    expect(azure.countBasis).toBe('subscription');
    expect(azure.assumptions.some((a) => /Microsoft Azure/i.test(a))).toBe(true);
  });
});

describe('IaaS overlap warning', () => {
  it('warns when advanced IaaS overlaps configured child sources', () => {
    const msg = detectIaasChildOverlap(
      { iaasSizingMode: 'advanced' },
      {
        iaas_containers: { status: 'current', count: '2' },
        iaas_instances: { status: 'skip' },
      },
    );
    expect(msg).toMatch(/overlap with separate cloud sources/i);
  });

  it('does not warn in standard mode', () => {
    expect(detectIaasChildOverlap({ iaasSizingMode: 'standard' }, { iaas_storage: { status: 'current', count: 1 } })).toBeNull();
  });
});

describe('IaaS via sizingEngine integration', () => {
  it('calculateSourceSize delegates to IaaS engine', () => {
    const r = calculateSourceSize(
      iaas,
      { status: 'current', iaasProvider: 'aws', iaasSizingMode: 'standard', iaasAccountCount: '1' },
      { catalog: sourceCatalog, allInputs: {} },
    );
    expect(r.rateSource).toBe('iaas_cloud');
    expect(r.expected).toBeCloseTo(0.3, 6);
  });

  it('sizes parent when child is active and parent has account inputs', () => {
    const inputs = {
      iaas: { status: 'current', iaasProvider: 'aws', iaasAccountCount: '3' },
      iaas_containers: { status: 'current', count: 2 },
    };
    const parent = calculateSourceSize(iaas, inputs.iaas, { catalog: sourceCatalog, allInputs: inputs });
    expect(parent.expected).toBeCloseTo(0.9, 1);
    expect(parent.rateSource).toBe('iaas_cloud');
  });

  it('rolls up parent when child is active and parent has no direct inputs', () => {
    const inputs = {
      iaas: { status: 'current', iaasProvider: 'aws' },
      iaas_containers: { status: 'current', count: 2 },
    };
    const parent = calculateSourceSize(iaas, inputs.iaas, { catalog: sourceCatalog, allInputs: inputs });
    expect(parent.expected).toBe(0);
    expect(parent.rateSource).toBe('rollup_children');
  });
});

describe('IaaS session field preservation', () => {
  it('preserves provider and advanced counts through normalize round-trip', () => {
    const original = {
      iaasProvider: 'gcp',
      iaasSizingMode: 'advanced',
      iaasAdvancedCounts: {
        accountLikeContainers: '1',
        instances: '20',
        flowLogInterfaces: '5',
        storageBuckets: '2',
        kubernetesClusters: '1',
        containersOrPods: '10',
      },
    };
    const normalized = normalizeIaasState(original);
    expect(normalized.iaasProvider).toBe('gcp');
    expect(normalized.iaasSizingMode).toBe('advanced');
    expect(normalized.iaasAdvancedCounts.instances).toBe('20');
    expect(normalized.iaasAdvancedCounts.kubernetesClusters).toBe('1');
  });
});
