import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/featureFlags.js', () => ({
  SIZING_MODE: 'advanced',
  OVERLAP_ANNOTATE_ONLY: false,
  SHOW_COVERAGE_PAGE: false,
}));

import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog } from './sizingEngine.js';
import { calculateFullSourceIngest } from './sourceEligibilityEngine.js';
import { toPlanningDisplayColumns } from '../utils/planningIngestDisplay.js';
import { formatIngestString } from '../utils/formatIngestDisplay.js';
import { getLogChannelBreakdown } from './sourceHierarchyEngine.js';
import {
  buildSourceSizingResult,
  summarizeSessionSizing,
  SIZING_STATE,
} from './sourceSizingResultEngine.js';
import { calculateSsoIdentitySizing } from './ssoIdentitySizingEngine.js';
import { sumSessionPlanningIngest } from './planningIngestTotals.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const byId = (id) => flatCatalog.find((s) => s.id === id);

function ingest(source, ss, allInputs = {}) {
  const ctx = { catalog: sourceCatalog, allInputs: { ...allInputs, [source.id]: ss } };
  return calculateFullSourceIngest(source, ss, ctx);
}

describe('formatIngestDisplay adaptive', () => {
  it('shows MB/day for 0.041 GB/day', () => {
    const s = formatIngestString(0.041);
    expect(s).toContain('MB/day');
    expect(s).not.toBe('0.0 GB/day');
    expect(s).not.toMatch(/0\.0{4,}/);
  });
});

describe('SaaS propagation', () => {
  const source = byId('saas_general');
  const ss = {
    status: 'current',
    saasVendor: 'average_blended',
    saasTenantCount: '4',
    saasActiveUsers: '0',
    saasIntegrationCount: '0',
    saasCollectionProfile: 'audit_only',
    saasActivityLevel: 'normal',
  };

  it('detail and Review share measured bands and ~2.20 MB/day expected', () => {
    const est = ingest(source, ss);
    const cols = toPlanningDisplayColumns(est);
    expect(est.confidence).not.toBe('none');
    expect(est.expected).toBeGreaterThan(0);
    expect(formatIngestString(cols.gbExpected)).toContain('MB/day');
    const mb = cols.gbExpected * 1024;
    expect(mb).toBeGreaterThan(2);
    expect(mb).toBeLessThan(3);

    const result = buildSourceSizingResult(source, { sources: { saas_general: ss } }, {
      catalog: sourceCatalog,
      allInputs: { saas_general: ss },
    });
    expect(result.includedInTotals).toBe(true);
    expect(result.displayExpected).toContain('MB/day');
  });
});

describe('CRM guardrail calibration', () => {
  const source = byId('saas_crm');
  const ss = {
    status: 'current',
    crmVendor: 'average_blended',
    crmTenantCount: '1',
    crmActiveUserCount: '350',
    crmIntegrationCount: '8',
    crmCollectionProfile: 'full_crm_activity',
    crmActivityLevel: 'normal',
  };

  it('expected is at least 1.75 GB/day for 350 active CRM users', () => {
    const est = ingest(source, ss);
    expect(est.expected).toBeGreaterThanOrEqual(1.75);
    expect(est.expected).not.toBeCloseTo(0.041, 2);
    const cols = toPlanningDisplayColumns(est);
    expect(formatIngestString(cols.gbExpected)).toContain('GB/day');

    const result = buildSourceSizingResult(source, { sources: { saas_crm: ss } }, {
      catalog: sourceCatalog,
      allInputs: { saas_crm: ss },
    });
    expect(result.includedInTotals).toBe(true);
    expect(result.expectedGb).toBeGreaterThanOrEqual(1.75);
  });
});

describe('IaaS propagation', () => {
  const source = byId('iaas');
  const ss = {
    status: 'current',
    iaasProvider: 'average',
    iaasAccountCount: '6',
    iaasSizingMode: 'standard',
  };

  it('matches additive bands even when child sources are active', () => {
    const allInputs = {
      iaas: ss,
      iaas_containers: { status: 'current', containerCounts: { clusters: '2' } },
    };
    const est = ingest(source, ss, allInputs);
    const cols = toPlanningDisplayColumns(est);
    expect(est.expected).toBeCloseTo(1.8, 1);
    expect(cols.gbLow).toBeCloseTo(0.3, 1);
    expect(cols.gbHigh).toBeCloseTo(19.5, 0);

    const result = buildSourceSizingResult(source, { sources: allInputs }, {
      catalog: sourceCatalog,
      allInputs,
    });
    expect(result.rolledUpToChildren).toBe(false);
    expect(result.includedInTotals).toBe(true);
  });
});

describe('SSO guardrail calibration', () => {
  const source = byId('saas_sso');

  it('full identity profile applies active-user guardrail near original sheet rate', () => {
    const ss = {
      status: 'current',
      ssoIdpVendor: 'okta',
      ssoTenantCount: '1',
      ssoActiveUserCount: '1200',
      ssoMfaUserCount: '1000',
      ssoAppIntegrationCount: '50',
      ssoCollectionProfile: 'full_identity_activity',
      ssoActivityLevel: 'normal',
    };
    const est = ingest(source, ss);
    expect(est.expected).toBeGreaterThanOrEqual(5.5);
    expect(est.expected).toBeLessThanOrEqual(7);
    expect(est.assumptions.some((a) => a.includes('planning guardrail'))).toBe(true);
  });

  it('additive engine alone is lower — guardrail raises full ingest path', () => {
    const raw = calculateSsoIdentitySizing({
      status: 'current',
      ssoIdpVendor: 'okta',
      ssoTenantCount: '1',
      ssoActiveUserCount: '500',
      ssoMfaUserCount: '450',
      ssoAppIntegrationCount: '40',
      ssoCollectionProfile: 'full_identity_activity',
      ssoActivityLevel: 'normal',
    });
    expect(raw.rateSource).toBe('sso_identity_additive');
    expect(raw.expected).toBeLessThan(0.5);
    const est = ingest(byId('saas_sso'), {
      status: 'current',
      ssoIdpVendor: 'okta',
      ssoTenantCount: '1',
      ssoActiveUserCount: '500',
      ssoMfaUserCount: '450',
      ssoAppIntegrationCount: '40',
      ssoCollectionProfile: 'full_identity_activity',
      ssoActivityLevel: 'normal',
    });
    expect(est.expected).toBeGreaterThanOrEqual(2.5);
  });
});

describe('Windows channel consistency', () => {
  const source = byId('windows_servers');
  const basicOnly = {
    security_event_log: true,
    system_event_log: true,
    application_event_log: true,
    setup_event_log: true,
  };

  it('per-channel sum × servers equals expected total', () => {
    const ss = {
      status: 'current',
      number_of_servers: '80',
      selectedLogOptions: basicOnly,
    };
    const est = ingest(source, ss);
    const bd = getLogChannelBreakdown(source, ss, { catalog: sourceCatalog, allInputs: { windows_servers: ss } });
    expect(bd).not.toBeNull();
    expect(bd.totalGb).toBeCloseTo(est.expected, 4);
    expect(bd.perServerGb).toBeCloseTo(0.19, 2);
    expect(est.expected).toBeCloseTo(15.2, 1);
  });
});

describe('SaaS standard profile missing users', () => {
  const source = byId('saas_general');
  const ss = {
    status: 'current',
    saasVendor: 'average_blended',
    saasTenantCount: '4',
    saasActiveUsers: '0',
    saasIntegrationCount: '0',
    saasCollectionProfile: 'standard_activity',
    saasActivityLevel: 'normal',
  };

  it('shows Needs Input when standard/full profile has no active users', () => {
    const result = buildSourceSizingResult(source, { sources: { saas_general: ss } }, {
      catalog: sourceCatalog,
      allInputs: { saas_general: ss },
    });
    expect(result.sizingState).toBe(SIZING_STATE.NEEDS_INPUT);
    expect(result.missingInputs).toContain('Missing active users for SaaS activity sizing');
    expect(result.includedInTotals).toBe(false);
  });
});

describe('Office productivity guardrail', () => {
  it('1200 users yields at least 6 GB/day expected for standard activity', () => {
    const source = byId('saas_office');
    const ss = {
      status: 'current',
      officeProductivityProduct: 'microsoft_365',
      officeTenantCount: '1',
      officeActiveUserCount: '1200',
      officeCollectionProfile: 'standard_activity',
    };
    const est = ingest(source, ss);
    expect(est.expected).toBeGreaterThanOrEqual(6);
  });
});

describe('Cloud VM guardrail', () => {
  it('80 instances standard VM logs yields ~20 GB/day expected', () => {
    const source = byId('iaas_instances');
    const ss = {
      status: 'current',
      cloudVmProvider: 'average_blended',
      cloudVmInstanceCount: '80',
      cloudVmCollectionProfile: 'standard_vm_logs',
    };
    const est = ingest(source, ss);
    expect(est.expected).toBeGreaterThanOrEqual(18);
    expect(est.expected).toBeLessThanOrEqual(22);
  });
});

describe('Cloud Storage full access guardrail', () => {
  it('60 assets full access logs yields conservative access-log floor', () => {
    const source = byId('iaas_storage');
    const ss = {
      status: 'current',
      cloudStorageVendor: 'average_blended',
      cloudStorageAssetCount: '60',
      cloudStorageCollectionProfile: 'full_storage_access_logs',
    };
    const est = ingest(source, ss);
    expect(est.expected).toBeGreaterThanOrEqual(15);
  });
});

describe('Firewall sizing guardrail', () => {
  const source = byId('firewalls');

  it('6 firewalls yields at least 6 GB/day expected', () => {
    const ss = { status: 'current', number_of_systems: '6', number_of_users: '0' };
    const est = ingest(source, ss);
    expect(est.expected).toBeGreaterThanOrEqual(6);
  });

  it('1200 protected users yields at least 12 GB/day when no devices', () => {
    const ss = { status: 'current', number_of_users: '1200', number_of_systems: '0' };
    const est = ingest(source, ss);
    expect(est.expected).toBeGreaterThanOrEqual(12);
  });
});

describe('Asset lookup context', () => {
  it('lookup-only profile shows Lookup / Context Source', () => {
    const source = byId('asset_cmdb');
    const ss = {
      status: 'current',
      number_of_assets: '5',
      assetExportProfile: 'Lookup/context only',
    };
    const result = buildSourceSizingResult(source, { sources: { asset_cmdb: ss } }, {
      catalog: sourceCatalog,
      allInputs: { asset_cmdb: ss },
    });
    expect(result.sizingState).toBe(SIZING_STATE.LOOKUP);
    expect(result.statusMessage).toBe('Lookup / Context Source');
    expect(result.includedInTotals).toBe(false);
  });

  it('periodic export uses at least 0.025 GB/day per source', () => {
    const source = byId('asset_cmdb');
    const ss = {
      status: 'current',
      number_of_assets: '4',
      assetExportProfile: 'Periodic CMDB/identity exports',
    };
    const est = ingest(source, ss);
    expect(est.expected).toBeGreaterThanOrEqual(0.1);
  });
});

describe('DLP channel floor profile', () => {
  const source = byId('dlp');

  it('channel-only profile sizes from channels without monitored users', () => {
    const ss = {
      status: 'current',
      number_of_users: '0',
      number_of_channels: '2',
      dlpSizingProfile: 'Channel/products only',
    };
    const est = ingest(source, ss);
    expect(est.expected).toBeGreaterThanOrEqual(0.1);
    const result = buildSourceSizingResult(source, { sources: { dlp: ss } }, {
      catalog: sourceCatalog,
      allInputs: { dlp: ss },
    });
    expect(result.includedInTotals).toBe(true);
  });
});

describe('Firewall missing input', () => {
  const source = byId('firewalls');

  it('shows missing-input state when Current with no sizing inputs', () => {
    const ss = { status: 'current' };
    const est = ingest(source, ss);
    expect(est.warnings.some((w) => w.includes('Missing firewall sizing inputs'))).toBe(true);
    const result = buildSourceSizingResult(source, { sources: { firewalls: ss } }, {
      catalog: sourceCatalog,
      allInputs: { firewalls: ss },
    });
    expect(result.includedInTotals).toBe(false);
    expect(result.sizingState).toBe(SIZING_STATE.NEEDS_INPUT);
  });

  it('rolled-up parent without direct inputs shows rollup messaging', () => {
    const allInputs = {
      firewalls: { status: 'current' },
      fw_perimeter: { status: 'current', count: '5' },
    };
    const result = buildSourceSizingResult(source, { sources: allInputs }, {
      catalog: sourceCatalog,
      allInputs,
    });
    expect(result.sizingState).toBe(SIZING_STATE.ROLLED_UP);
    expect(result.statusMessage).toMatch(/Rolled up/i);
  });
});

describe('Session total consistency', () => {
  it('session total matches sum of included Current sources', () => {
    const sources = {
      saas_general: {
        status: 'current',
        saasVendor: 'average_blended',
        saasTenantCount: '4',
        saasActiveUsers: '0',
        saasIntegrationCount: '0',
        saasCollectionProfile: 'audit_only',
        saasActivityLevel: 'normal',
      },
      saas_crm: {
        status: 'current',
        crmVendor: 'average_blended',
        crmTenantCount: '1',
        crmActiveUserCount: '350',
        crmIntegrationCount: '8',
        crmCollectionProfile: 'full_crm_activity',
        crmActivityLevel: 'normal',
      },
    };
    const { totals, eligible, count } = sumSessionPlanningIngest({
      catalog: sourceCatalog,
      sourceStates: sources,
      overlapDecisions: {},
      sizingContext: { catalog: sourceCatalog, allInputs: sources },
    });
    const summary = summarizeSessionSizing({ sources, catalog: sourceCatalog });
    const sumEligible = eligible.reduce((a, s) => a + s.gbExpected, 0);
    expect(totals.expected).toBeCloseTo(sumEligible, 6);
    expect(summary.sizedCurrent).toBeGreaterThanOrEqual(1);
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

describe('Parent rollup with direct inputs', () => {
  it('sizes parent when direct additive inputs exist alongside active children', () => {
    const allInputs = {
      saas_general: {
        status: 'current',
        saasTenantCount: '4',
        saasActiveUsers: '0',
        saasIntegrationCount: '0',
        saasCollectionProfile: 'audit_only',
        saasActivityLevel: 'normal',
      },
      saas_office: { status: 'current', officeActiveUserCount: '100' },
    };
    const source = byId('saas_general');
    const result = buildSourceSizingResult(source, { sources: allInputs }, {
      catalog: sourceCatalog,
      allInputs,
    });
    expect(result.expectedGb).toBeGreaterThan(0);
    expect(result.rolledUpToChildren).toBe(false);
    expect(result.warnings.some((w) => w.includes('double-counted'))).toBe(true);
  });
});
