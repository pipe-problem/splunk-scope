import { describe, it, expect } from 'vitest';
import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog, calculateSourceSize } from './sizingEngine.js';
import {
  calculateCloudVmSizing,
  detectCloudVmOverlap,
  formatCloudVmGb,
  getCloudVmSizingReviewDisplay,
  normalizeCloudVmState,
  CLOUD_VM_REVIEW_SUMMARY,
} from './cloudVmSizingEngine.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const cloudVm = flatCatalog.find((s) => s.id === 'iaas_instances');

function baseState(overrides = {}) {
  return {
    cloudVmProvider: 'aws_ec2',
    cloudVmInstanceCount: '10',
    cloudVmCollectionProfile: 'base_vm_telemetry',
    cloudVmCustomizeComponents: false,
    ...overrides,
  };
}

describe('formatCloudVmGb', () => {
  it('formats by magnitude tiers', () => {
    expect(formatCloudVmGb(0)).toBe('0');
    expect(formatCloudVmGb(12.34)).toBe('12.3');
    expect(formatCloudVmGb(2.456)).toBe('2.46');
    expect(formatCloudVmGb(0.078)).toBe('0.078');
  });

  it('does not duplicate GB/day in numeric output', () => {
    expect(formatCloudVmGb(1.2)).not.toContain('GB');
  });
});

describe('normalizeCloudVmState / legacy migration', () => {
  it('defaults to average_blended provider and base profile', () => {
    const n = normalizeCloudVmState({});
    expect(n.cloudVmProvider).toBe('average_blended');
    expect(n.cloudVmCollectionProfile).toBe('standard_vm_logs');
    expect(n.cloudVmComponentToggles.includeApplicationServiceLogs).toBe(false);
  });

  it('maps legacy count and vendor to provider and instance count', () => {
    const n = normalizeCloudVmState({ count: '25', vendor: 'AWS EC2' });
    expect(n.cloudVmProvider).toBe('aws_ec2');
    expect(n.cloudVmInstanceCount).toBe('25');
    expect(n.count).toBe('25');
  });
});

describe('Cloud VM additive sizing — measured examples', () => {
  it('Example 1 — AWS EC2 base telemetry, 10 instances', () => {
    const r = calculateCloudVmSizing(baseState());
    expect(r.low).toBeCloseTo(0.0091, 3);
    expect(r.expected).toBeCloseTo(0.1152, 3);
    expect(r.high).toBeCloseTo(1.4423, 3);
    expect(r.cloudVmBreakdown).toHaveLength(3);
    expect(r.cloudVmBreakdown.some((row) => row.id === 'application_service')).toBe(false);
  });

  it('Example 2 — AWS EC2 full VM logs, 10 instances', () => {
    const r = calculateCloudVmSizing(
      baseState({ cloudVmCollectionProfile: 'full_vm_logs' }),
    );
    expect(r.low).toBeCloseTo(0.0405, 3);
    expect(r.expected).toBeCloseTo(0.7438, 3);
    expect(r.high).toBeCloseTo(16.0542, 3);
    expect(r.cloudVmBreakdown).toHaveLength(4);
  });

  it('Example 3 — Azure VMs full VM logs, 10 instances', () => {
    const r = calculateCloudVmSizing(
      baseState({
        cloudVmProvider: 'azure_vms',
        cloudVmCollectionProfile: 'full_vm_logs',
      }),
    );
    expect(r.low).toBeCloseTo(0.0604, 3);
    expect(r.expected).toBeCloseTo(1.1028, 3);
    expect(r.high).toBeCloseTo(18.8535, 3);
  });

  it('Example 4 — Average / Blended base telemetry, 40 instances', () => {
    const r = calculateCloudVmSizing(
      baseState({
        cloudVmProvider: 'average_blended',
        cloudVmInstanceCount: '40',
      }),
    );
    expect(r.low).toBeCloseTo(0.0372, 3);
    expect(r.expected).toBeCloseTo(0.4731, 3);
    expect(r.high).toBeCloseTo(5.5709, 3);
  });
});

describe('Cloud VM profiles and custom toggles', () => {
  it('excludes application/service logs in base profile', () => {
    const r = calculateCloudVmSizing(baseState());
    expect(r.cloudVmBreakdown.some((row) => row.id === 'application_service')).toBe(false);
  });

  it('includes application/service logs in full profile', () => {
    const r = calculateCloudVmSizing(
      baseState({ cloudVmCollectionProfile: 'full_vm_logs' }),
    );
    expect(r.cloudVmBreakdown.some((row) => row.id === 'application_service')).toBe(true);
  });

  it('respects custom component toggles', () => {
    const r = calculateCloudVmSizing(
      baseState({
        cloudVmCustomizeComponents: true,
        cloudVmComponentToggles: {
          includeOsSystemLogs: true,
          includeAuthSecurityLogs: false,
          includeAgentPlatformLogs: false,
          includeApplicationServiceLogs: false,
        },
      }),
    );
    expect(r.cloudVmBreakdown).toHaveLength(1);
    expect(r.cloudVmBreakdown[0].id).toBe('os_system');
  });

  it('treats blank instance count as zero', () => {
    const r = calculateCloudVmSizing(baseState({ cloudVmInstanceCount: '' }));
    expect(r.expected).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('Cloud VM provider switch', () => {
  it('uses different rates for AWS EC2 vs VMware Cloud', () => {
    const aws = calculateCloudVmSizing(baseState({ cloudVmProvider: 'aws_ec2' }));
    const vmware = calculateCloudVmSizing(baseState({ cloudVmProvider: 'vmware_cloud' }));
    expect(vmware.expected).not.toBe(aws.expected);
    expect(vmware.expected).toBeLessThan(aws.expected);
  });
});

describe('Cloud VM overlap warning', () => {
  it('warns when overlapping sources are configured', () => {
    const msg = detectCloudVmOverlap(baseState(), {
      linux_servers: { status: 'current', count: '5' },
    });
    expect(msg).toMatch(/overlap/i);
  });

  it('does not warn when overlapping sources are inactive', () => {
    const msg = detectCloudVmOverlap(baseState(), {
      app_servers: { status: 'skip', count: '10' },
    });
    expect(msg).toBeNull();
  });
});

describe('Cloud VM review display', () => {
  it('shows customer-facing summary without raw field IDs', () => {
    const r = calculateCloudVmSizing(baseState());
    const display = getCloudVmSizingReviewDisplay(r);
    expect(display.summary).toBe(CLOUD_VM_REVIEW_SUMMARY);
    expect(display.rows[0].label).not.toContain('cloudVm');
  });
});

describe('Cloud VM sizing via sizingEngine', () => {
  it('routes iaas_instances through additive engine (not flat per-instance rate)', () => {
    const r = calculateSourceSize(cloudVm, baseState(), { allInputs: {} });
    expect(r.rateSource).toBe('cloud_vm_additive');
    expect(r.expected).toBeCloseTo(0.1152, 3);
    expect(r.cloudVmBreakdown?.length).toBe(3);
  });
});

describe('Cloud VM session field preservation', () => {
  it('preserves provider, profile, instance count, and toggles through normalize round-trip', () => {
    const original = {
      cloudVmProvider: 'gcp_compute',
      cloudVmInstanceCount: '15',
      cloudVmCollectionProfile: 'full_vm_logs',
      cloudVmCustomizeComponents: true,
      cloudVmComponentToggles: {
        includeOsSystemLogs: true,
        includeAuthSecurityLogs: true,
        includeAgentPlatformLogs: false,
        includeApplicationServiceLogs: true,
      },
    };
    const normalized = normalizeCloudVmState(original);
    expect(normalized.cloudVmProvider).toBe('gcp_compute');
    expect(normalized.cloudVmInstanceCount).toBe('15');
    expect(normalized.cloudVmComponentToggles.includeAgentPlatformLogs).toBe(false);
  });
});
