import { describe, it, expect } from 'vitest';
import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog, calculateSourceSize } from './sizingEngine.js';
import {
  calculateCrmSizing,
  detectCrmOverlap,
  formatCrmIngest,
  formatCrmIngestString,
  getCrmSizingReviewDisplay,
  normalizeCrmState,
  CRM_REVIEW_SUMMARY_TEXT,
  CRM_DAILY_OVERRIDE_NOTE,
} from './crmSizingEngine.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const saasCrm = flatCatalog.find((s) => s.id === 'saas_crm');

function baseState(overrides = {}) {
  return {
    status: 'current',
    crmVendor: 'average_blended',
    crmTenantCount: '1',
    crmActiveUserCount: '',
    crmIntegrationCount: '',
    crmCollectionProfile: 'standard_crm_activity',
    crmActivityLevel: 'normal',
    crmCustomizeComponents: false,
    crmUseDailyEventCounts: false,
    ...overrides,
  };
}

describe('formatCrmIngest adaptive display', () => {
  it('shows MB/day when below 0.1 GB/day', () => {
    expect(formatCrmIngestString(0.0007)).toBe('0.72 MB/day');
    expect(formatCrmIngestString(0.006)).toContain('MB/day');
  });

  it('shows GB/day when at or above 0.1 GB/day', () => {
    expect(formatCrmIngestString(0.12)).toBe('0.12 GB/day');
  });

  it('never shows 0.000000 for small positive values', () => {
    const s = formatCrmIngestString(0.000001);
    expect(s).not.toMatch(/0\.0{4,} GB/);
  });

  it('does not duplicate GB/day in formatted string', () => {
    expect(formatCrmIngestString(0.12)).not.toMatch(/GB\/day GB\/day/);
  });

  it('shows 0 for zero values', () => {
    expect(formatCrmIngestString(0)).toBe('0');
    expect(formatCrmIngest(0).text).toBe('0');
  });
});

describe('normalizeCrmState', () => {
  it('defaults tenant to 1 when source is current and tenant blank', () => {
    const n = normalizeCrmState({ status: 'current' });
    expect(n.crmTenantCount).toBe('1');
  });

  it('does not default tenant when source is not active', () => {
    const n = normalizeCrmState({ status: 'unknown' });
    expect(n.crmTenantCount).toBe('');
  });

  it('treats blank active user and integration counts as empty (parsed as 0)', () => {
    const n = normalizeCrmState({ status: 'current', crmActiveUserCount: '', crmIntegrationCount: '' });
    expect(n.crmActiveUserCount).toBe('');
    expect(n.crmIntegrationCount).toBe('');
  });

  it('maps legacy count to crmActiveUserCount', () => {
    const n = normalizeCrmState({ count: '200', vendor: 'Salesforce' });
    expect(n.crmActiveUserCount).toBe('200');
    expect(n.crmVendor).toBe('salesforce');
  });

  it('defaults vendor to average_blended when unknown', () => {
    const n = normalizeCrmState({ status: 'current' });
    expect(n.crmVendor).toBe('average_blended');
  });
});

describe('CRM additive sizing — measured examples', () => {
  it('Example 1 — Salesforce small standard activity', () => {
    const r = calculateCrmSizing(
      baseState({
        crmVendor: 'salesforce',
        crmActiveUserCount: '25',
        crmIntegrationCount: '1',
      }),
    );
    expect(r.expected).toBeCloseTo(0.000998, 3);
  });

  it('Example 2 — Salesforce medium full activity', () => {
    const r = calculateCrmSizing(
      baseState({
        crmVendor: 'salesforce',
        crmActiveUserCount: '250',
        crmIntegrationCount: '5',
        crmCollectionProfile: 'full_crm_activity',
      }),
    );
    expect(r.expected).toBeCloseTo(0.026497, 3);
  });

  it('Example 3 — Dynamics 365 medium full activity', () => {
    const r = calculateCrmSizing(
      baseState({
        crmVendor: 'dynamics_365',
        crmActiveUserCount: '250',
        crmIntegrationCount: '5',
        crmCollectionProfile: 'full_crm_activity',
      }),
    );
    expect(r.expected).toBeCloseTo(0.030204, 3);
  });

  it('Example 4 — Average / Blended large standard activity', () => {
    const r = calculateCrmSizing(
      baseState({
        crmTenantCount: '2',
        crmActiveUserCount: '2500',
        crmIntegrationCount: '25',
      }),
    );
    expect(r.expected).toBeCloseTo(0.080507, 3);
  });

  it('Example 5 — Average / Blended medium full activity', () => {
    const r = calculateCrmSizing(
      baseState({
        crmActiveUserCount: '250',
        crmIntegrationCount: '5',
        crmCollectionProfile: 'full_crm_activity',
      }),
    );
    expect(r.expected).toBeCloseTo(0.02668, 3);
  });
});

describe('CRM collection profiles', () => {
  it('audit_only excludes CRM record activity and API/integration events', () => {
    const r = calculateCrmSizing(
      baseState({
        crmActiveUserCount: '100',
        crmIntegrationCount: '5',
        crmCollectionProfile: 'audit_only',
      }),
    );
    const ids = r.crmBreakdown.map((b) => b.id);
    expect(ids).toContain('admin_config_audit');
    expect(ids).toContain('login_access_security');
    expect(ids).not.toContain('crm_record_activity');
    expect(ids).not.toContain('api_integration_events');
  });

  it('standard profile excludes API/integration events', () => {
    const r = calculateCrmSizing(
      baseState({
        crmActiveUserCount: '100',
        crmIntegrationCount: '5',
      }),
    );
    const ids = r.crmBreakdown.map((b) => b.id);
    expect(ids).toContain('crm_record_activity');
    expect(ids).not.toContain('api_integration_events');
  });

  it('full profile includes API/integration events', () => {
    const r = calculateCrmSizing(
      baseState({
        crmActiveUserCount: '100',
        crmIntegrationCount: '5',
        crmCollectionProfile: 'full_crm_activity',
      }),
    );
    expect(r.crmBreakdown.map((b) => b.id)).toContain('api_integration_events');
  });
});

describe('CRM vendor switch', () => {
  it('updates component rates when vendor changes', () => {
    const sf = calculateCrmSizing(
      baseState({
        crmVendor: 'salesforce',
        crmActiveUserCount: '250',
        crmIntegrationCount: '5',
        crmCollectionProfile: 'full_crm_activity',
      }),
    );
    const dyn = calculateCrmSizing(
      baseState({
        crmVendor: 'dynamics_365',
        crmActiveUserCount: '250',
        crmIntegrationCount: '5',
        crmCollectionProfile: 'full_crm_activity',
      }),
    );
    expect(sf.expected).not.toBe(dyn.expected);
    expect(sf.expected).toBeCloseTo(0.026497, 3);
    expect(dyn.expected).toBeCloseTo(0.030204, 3);
  });
});

describe('CRM daily event overrides', () => {
  it('uses exact daily event counts when override is enabled', () => {
    const r = calculateCrmSizing(
      baseState({
        crmTenantCount: '1',
        crmActiveUserCount: '0',
        crmIntegrationCount: '0',
        crmCollectionProfile: 'audit_only',
        crmUseDailyEventCounts: true,
        dailyAdminAuditEvents: '10000',
      }),
    );
    expect(r.crmUsesDailyEventOverrides).toBe(true);
    expect(r.expected).toBeGreaterThan(0);
    expect(r.crmBreakdown.some((b) => b.fromDailyOverride)).toBe(true);
  });
});

describe('CRM overlap warnings', () => {
  it('warns when overlapping sources are configured', () => {
    const msg = detectCrmOverlap(baseState({ crmVendor: 'salesforce' }), {
      saas_general: { status: 'current', count: '100' },
    });
    expect(msg).toContain('overlap');
  });

  it('warns for Salesforce + SaaS general', () => {
    const msg = detectCrmOverlap(
      baseState({ crmVendor: 'salesforce' }),
      { saas_general: { status: 'current', saasActiveUsers: '50' } },
    );
    expect(msg).toContain('Salesforce');
  });

  it('warns for API integration + API gateway', () => {
    const msg = detectCrmOverlap(
      baseState({
        crmCollectionProfile: 'full_crm_activity',
        crmIntegrationCount: '3',
      }),
      { api_gateway: { status: 'current', count: '2' } },
    );
    expect(msg).toContain('API');
  });
});

describe('CRM review display', () => {
  it('shows standard summary text', () => {
    const r = calculateCrmSizing(baseState({ crmActiveUserCount: '50' }));
    const display = getCrmSizingReviewDisplay(r);
    expect(display.summary).toContain(CRM_REVIEW_SUMMARY_TEXT);
    expect(display.validationNote).toBeTruthy();
  });

  it('mentions daily overrides when used', () => {
    const r = calculateCrmSizing(
      baseState({
        crmUseDailyEventCounts: true,
        dailyAdminAuditEvents: '5000',
        crmCollectionProfile: 'audit_only',
      }),
    );
    const display = getCrmSizingReviewDisplay(r);
    expect(display.summary).toContain(CRM_DAILY_OVERRIDE_NOTE);
  });
});

describe('CRM sizingEngine integration', () => {
  it('saas_crm routes through additive engine', () => {
    expect(saasCrm).toBeTruthy();
    const result = calculateSourceSize(saasCrm, baseState({ crmActiveUserCount: '250', crmIntegrationCount: '5', crmCollectionProfile: 'full_crm_activity' }));
    expect(result.rateSource).toBe('crm_additive');
    expect(result.expected).toBeCloseTo(0.02668, 3);
  });

  it('export/import field preservation round-trip via normalize', () => {
    const raw = {
      status: 'current',
      crmVendor: 'hubspot',
      crmTenantCount: '2',
      crmActiveUserCount: '150',
      crmIntegrationCount: '8',
      crmCollectionProfile: 'full_crm_activity',
      crmActivityLevel: 'heavy',
      crmCustomizeComponents: true,
      crmComponentToggles: {
        includeApiIntegrationEvents: false,
      },
      crmUseDailyEventCounts: true,
      dailyCrmRecordEvents: '12000',
    };
    const n = normalizeCrmState(raw);
    expect(n.crmVendor).toBe('hubspot');
    expect(n.crmTenantCount).toBe('2');
    expect(n.crmActiveUserCount).toBe('150');
    expect(n.crmIntegrationCount).toBe('8');
    expect(n.crmCollectionProfile).toBe('full_crm_activity');
    expect(n.crmActivityLevel).toBe('heavy');
    expect(n.crmCustomizeComponents).toBe(true);
    expect(n.crmUseDailyEventCounts).toBe(true);
    expect(n.dailyCrmRecordEvents).toBe('12000');
    expect(n.crmComponentToggles.includeApiIntegrationEvents).toBe(false);
  });
});
