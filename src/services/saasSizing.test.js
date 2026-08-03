import { describe, it, expect } from 'vitest';
import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog, calculateSourceSize } from './sizingEngine.js';
import {
  calculateSaaSSizing,
  detectSaaSOverlap,
  formatSaaSIngest,
  formatSaaSIngestString,
  getSaaSSizingReviewDisplay,
  normalizeSaaSState,
  SAAS_REVIEW_SUMMARY_TEXT,
  SAAS_VALIDATION_NOTE,
} from './saasSizingEngine.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const saasGeneral = flatCatalog.find((s) => s.id === 'saas_general');

function baseState(overrides = {}) {
  return {
    saasVendor: 'salesforce',
    saasTenantCount: '1',
    saasActiveUsers: '50',
    saasIntegrationCount: '1',
    saasCollectionProfile: 'standard_activity',
    saasActivityLevel: 'normal',
    ...overrides,
  };
}

describe('formatSaaSIngest adaptive display', () => {
  it('shows zero without decimals', () => {
    expect(formatSaaSIngest(0)).toEqual({ text: '0', unit: '', gb: 0 });
    expect(formatSaaSIngestString(0)).toBe('0');
  });

  it('shows MB/day when below 0.1 GB/day', () => {
    const f = formatSaaSIngest(0.0007);
    expect(f.unit).toBe('MB/day');
    expect(f.text).toBe('0.72');
    expect(formatSaaSIngestString(0.0007)).toBe('0.72 MB/day');
  });

  it('shows GB/day when at or above 0.1 GB/day', () => {
    const f = formatSaaSIngest(0.12);
    expect(f.unit).toBe('GB/day');
    expect(formatSaaSIngestString(0.12)).toBe('0.12 GB/day');
  });

  it('never shows 0.000000 for small positive values', () => {
    const s = formatSaaSIngestString(0.000001);
    expect(s).not.toMatch(/0\.0{4,}/);
    expect(s).toContain('MB/day');
  });
});

describe('normalizeSaaSState / legacy migration', () => {
  it('defaults vendor, profile, and activity level', () => {
    const n = normalizeSaaSState({});
    expect(n.saasVendor).toBe('average_blended');
    expect(n.saasCollectionProfile).toBe('standard_activity');
    expect(n.saasActivityLevel).toBe('normal');
  });

  it('maps legacy users and platforms to SaaS fields', () => {
    const n = normalizeSaaSState({
      number_of_users: '200',
      number_of_platforms: '2',
      vendor: 'ServiceNow',
    });
    expect(n.saasActiveUsers).toBe('200');
    expect(n.number_of_users).toBe('200');
    expect(n.saasTenantCount).toBe('2');
    expect(n.saasVendor).toBe('servicenow');
  });

  it('maps legacy count to active users', () => {
    const n = normalizeSaaSState({ count: '75' });
    expect(n.saasActiveUsers).toBe('75');
  });
});

describe('SaaS additive sizing — measured scenarios', () => {
  it('Small Salesforce — standard activity, normal', () => {
    const r = calculateSaaSSizing(baseState());
    expect(r.expected).toBeCloseTo(0.00187, 3);
    expect(r.saasBreakdown).toHaveLength(3);
    expect(r.saasBreakdown.some((row) => row.id === 'api_integration_events')).toBe(false);
  });

  it('Medium Salesforce — standard activity, normal', () => {
    const r = calculateSaaSSizing(
      baseState({
        saasActiveUsers: '500',
        saasIntegrationCount: '5',
      }),
    );
    expect(r.expected).toBeCloseTo(0.01356, 3);
  });

  it('Large Salesforce — standard activity, normal', () => {
    const r = calculateSaaSSizing(
      baseState({
        saasTenantCount: '2',
        saasActiveUsers: '5000',
        saasIntegrationCount: '20',
      }),
    );
    expect(r.expected).toBeCloseTo(0.1311, 2);
  });

  it('audit_only excludes user activity and API components', () => {
    const r = calculateSaaSSizing(
      baseState({ saasCollectionProfile: 'audit_only' }),
    );
    expect(r.saasBreakdown).toHaveLength(2);
    expect(r.saasBreakdown.map((row) => row.id)).toEqual([
      'admin_config_audit',
      'auth_access_security',
    ]);
  });

  it('full_activity includes API/integration component', () => {
    const r = calculateSaaSSizing(
      baseState({ saasCollectionProfile: 'full_activity' }),
    );
    expect(r.saasBreakdown).toHaveLength(4);
    expect(r.saasBreakdown.some((row) => row.id === 'api_integration_events')).toBe(true);
  });

  it('activity level selects low/medium/high bands', () => {
    const light = calculateSaaSSizing(baseState({ saasActivityLevel: 'light' }));
    const heavy = calculateSaaSSizing(baseState({ saasActivityLevel: 'heavy' }));
    expect(light.expected).toBeLessThan(heavy.expected);
    expect(light.low).toBeLessThan(light.high);
  });
});

describe('SaaS overlap detection', () => {
  it('warns when dedicated SaaS child sources are active', () => {
    const msg = detectSaaSOverlap(baseState(), {
      saas_office: { status: 'current', count: '100' },
    });
    expect(msg).toContain('overlap');
  });

  it('returns null when no overlapping sources are active', () => {
    expect(detectSaaSOverlap(baseState(), {})).toBeNull();
  });
});

describe('SaaS review display', () => {
  it('returns summary and component rows without raw field IDs', () => {
    const r = calculateSaaSSizing(baseState());
    const display = getSaaSSizingReviewDisplay(r);
    expect(display.summary).toBe(SAAS_REVIEW_SUMMARY_TEXT);
    expect(display.validationNote).toBe(SAAS_VALIDATION_NOTE);
    expect(display.rows[0].label).not.toContain('saas');
    expect(display.rows[0].displayGb).toBeGreaterThan(0);
  });
});

describe('SaaS sizing via sizingEngine', () => {
  it('routes saas_general through additive engine', () => {
    const r = calculateSourceSize(saasGeneral, baseState(), { allInputs: {} });
    expect(r.rateSource).toBe('saas_additive_v2');
    expect(r.expected).toBeCloseTo(0.00187, 3);
    expect(r.saasBreakdown?.length).toBe(3);
  });
});

describe('SaaS session field preservation', () => {
  it('preserves vendor, counts, profile, and activity through normalize round-trip', () => {
    const original = {
      saasVendor: 'box',
      saasTenantCount: '3',
      saasActiveUsers: '120',
      saasIntegrationCount: '4',
      saasCollectionProfile: 'full_activity',
      saasActivityLevel: 'heavy',
    };
    const normalized = normalizeSaaSState(original);
    expect(normalized.saasVendor).toBe('box');
    expect(normalized.saasTenantCount).toBe('3');
    expect(normalized.saasActiveUsers).toBe('120');
    expect(normalized.saasIntegrationCount).toBe('4');
    expect(normalized.saasCollectionProfile).toBe('full_activity');
    expect(normalized.saasActivityLevel).toBe('heavy');
  });
});
