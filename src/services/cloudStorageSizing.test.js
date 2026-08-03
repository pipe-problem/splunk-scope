import { describe, it, expect } from 'vitest';
import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog, calculateSourceSize } from './sizingEngine.js';
import {
  calculateCloudStorageSizing,
  detectCloudStorageOverlap,
  formatCloudStorageGb,
  getCloudStorageSizingReviewDisplay,
  getCloudStorageVendorMeta,
  normalizeCloudStorageState,
  CLOUD_STORAGE_REVIEW_SUMMARY,
} from './cloudStorageSizingEngine.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const cloudStorage = flatCatalog.find((s) => s.id === 'iaas_storage');

function baseState(overrides = {}) {
  return {
    cloudStorageVendor: 'aws_s3',
    cloudStorageAssetCount: '10',
    cloudStorageCollectionProfile: 'base_storage_telemetry',
    cloudStorageCustomizeComponents: false,
    ...overrides,
  };
}

describe('formatCloudStorageGb', () => {
  it('formats by magnitude tiers', () => {
    expect(formatCloudStorageGb(0)).toBe('0');
    expect(formatCloudStorageGb(12.34)).toBe('12.3');
    expect(formatCloudStorageGb(0.028)).toBe('0.028');
    expect(formatCloudStorageGb(0.005)).toBe('0.005');
  });

  it('does not duplicate GB/day in numeric output', () => {
    expect(formatCloudStorageGb(1.2)).not.toContain('GB');
  });
});

describe('normalizeCloudStorageState / legacy migration', () => {
  it('defaults to average_blended vendor and base profile', () => {
    const n = normalizeCloudStorageState({});
    expect(n.cloudStorageVendor).toBe('average_blended');
    expect(n.cloudStorageCollectionProfile).toBe('base_storage_telemetry');
    expect(n.cloudStorageComponentToggles.includeAccessRequestLogs).toBe(false);
  });

  it('maps legacy count and vendor to storage fields', () => {
    const n = normalizeCloudStorageState({ count: '12', vendor: 'Amazon S3' });
    expect(n.cloudStorageVendor).toBe('aws_s3');
    expect(n.cloudStorageAssetCount).toBe('12');
    expect(n.count).toBe('12');
  });
});

describe('Cloud Storage additive sizing — measured examples', () => {
  it('Example 1 — AWS S3 base telemetry, 10 assets', () => {
    const r = calculateCloudStorageSizing(baseState());
    expect(r.low).toBeCloseTo(0.001, 3);
    expect(r.expected).toBeCloseTo(0.028, 3);
    expect(r.high).toBeCloseTo(0.87, 2);
    expect(r.cloudStorageBreakdown).toHaveLength(3);
    expect(r.cloudStorageBreakdown.some((row) => row.id === 'access_request')).toBe(false);
  });

  it('Example 2 — AWS S3 full storage access logs, 10 assets', () => {
    const r = calculateCloudStorageSizing(
      baseState({ cloudStorageCollectionProfile: 'full_storage_access_logs' }),
    );
    expect(r.low).toBeCloseTo(0.005, 3);
    expect(r.expected).toBeCloseTo(0.4, 2);
    expect(r.high).toBeCloseTo(13.4, 1);
    expect(r.cloudStorageBreakdown).toHaveLength(4);
  });

  it('Example 3 — Azure Storage full storage access logs, 10 assets', () => {
    const r = calculateCloudStorageSizing(
      baseState({
        cloudStorageVendor: 'azure_storage',
        cloudStorageCollectionProfile: 'full_storage_access_logs',
      }),
    );
    expect(r.low).toBeCloseTo(0.009, 3);
    expect(r.expected).toBeCloseTo(0.82, 1);
    expect(r.high).toBeCloseTo(23.9, 0);
  });

  it('Example 4 — Average / Blended base telemetry, 25 assets', () => {
    const r = calculateCloudStorageSizing(
      baseState({
        cloudStorageVendor: 'average_blended',
        cloudStorageAssetCount: '25',
      }),
    );
    expect(r.low).toBeCloseTo(0.004, 3);
    expect(r.expected).toBeCloseTo(0.081, 2);
    expect(r.high).toBeCloseTo(2.34, 1);
  });
});

describe('Cloud Storage profiles and custom toggles', () => {
  it('excludes access request logs in base profile', () => {
    const r = calculateCloudStorageSizing(baseState());
    expect(r.cloudStorageBreakdown.some((row) => row.id === 'access_request')).toBe(false);
  });

  it('includes access request logs in full profile', () => {
    const r = calculateCloudStorageSizing(
      baseState({ cloudStorageCollectionProfile: 'full_storage_access_logs' }),
    );
    expect(r.cloudStorageBreakdown.some((row) => row.id === 'access_request')).toBe(true);
  });

  it('respects custom component toggles', () => {
    const r = calculateCloudStorageSizing(
      baseState({
        cloudStorageCustomizeComponents: true,
        cloudStorageComponentToggles: {
          includeManagementAudit: true,
          includeAccessRequestLogs: false,
          includeLifecycleReplication: false,
          includePerformanceHealth: false,
        },
      }),
    );
    expect(r.cloudStorageBreakdown).toHaveLength(1);
    expect(r.cloudStorageBreakdown[0].id).toBe('management_audit');
  });

  it('treats blank asset count as zero', () => {
    const r = calculateCloudStorageSizing(baseState({ cloudStorageAssetCount: '' }));
    expect(r.expected).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('Cloud Storage vendor switch', () => {
  it('updates rates and unit labels by vendor', () => {
    const aws = calculateCloudStorageSizing(baseState({ cloudStorageVendor: 'aws_s3' }));
    const azure = calculateCloudStorageSizing(
      baseState({ cloudStorageVendor: 'azure_storage' }),
    );
    expect(azure.expected).not.toBe(aws.expected);
    expect(getCloudStorageVendorMeta('aws_s3').components.management_audit.unit).toBe('bucket');
    expect(getCloudStorageVendorMeta('azure_storage').components.management_audit.unit).toBe(
      'storage account',
    );
  });
});

describe('Cloud Storage overlap warning', () => {
  it('warns when overlapping sources are configured', () => {
    const msg = detectCloudStorageOverlap(baseState(), {
      dlp: { status: 'current', count: '3' },
    });
    expect(msg).toMatch(/overlap/i);
  });

  it('does not warn when overlapping sources are inactive', () => {
    const msg = detectCloudStorageOverlap(baseState(), {
      app_servers: { status: 'skip', count: '10' },
    });
    expect(msg).toBeNull();
  });
});

describe('Cloud Storage review display', () => {
  it('shows customer-facing summary without raw field IDs', () => {
    const r = calculateCloudStorageSizing(baseState());
    const display = getCloudStorageSizingReviewDisplay(r);
    expect(display.summary).toBe(CLOUD_STORAGE_REVIEW_SUMMARY);
    expect(display.rows[0].label).not.toContain('cloudStorage');
  });
});

describe('Cloud Storage sizing via sizingEngine', () => {
  it('routes iaas_storage through additive engine', () => {
    const r = calculateSourceSize(cloudStorage, baseState(), { allInputs: {} });
    expect(r.rateSource).toBe('cloud_storage_additive');
    expect(r.expected).toBeCloseTo(0.028, 3);
    expect(r.cloudStorageBreakdown?.length).toBe(3);
  });
});

describe('Cloud Storage session field preservation', () => {
  it('preserves vendor, profile, asset count, and toggles through normalize round-trip', () => {
    const original = {
      cloudStorageVendor: 'google_cloud_storage',
      cloudStorageAssetCount: '8',
      cloudStorageCollectionProfile: 'full_storage_access_logs',
      cloudStorageCustomizeComponents: true,
      cloudStorageComponentToggles: {
        includeManagementAudit: true,
        includeAccessRequestLogs: true,
        includeLifecycleReplication: false,
        includePerformanceHealth: true,
      },
    };
    const normalized = normalizeCloudStorageState(original);
    expect(normalized.cloudStorageVendor).toBe('google_cloud_storage');
    expect(normalized.cloudStorageAssetCount).toBe('8');
    expect(normalized.cloudStorageComponentToggles.includeLifecycleReplication).toBe(false);
  });
});
