import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/featureFlags.js', () => ({
  SIZING_MODE: 'simple',
  OVERLAP_ANNOTATE_ONLY: true,
  SHOW_COVERAGE_PAGE: false,
}));

import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog } from './sizingEngine.js';
import { calculateFullSourceIngest } from './sourceEligibilityEngine.js';
import { sumSessionPlanningIngest } from './planningIngestTotals.js';
import { applyPlanningAdjustments } from './sourcePlanningAdjustments.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const byId = (id) => flatCatalog.find((s) => s.id === id);

describe('CASB planning calibration', () => {
  const casb = byId('casb');

  it('sizes 3400 users at ~17 GB/day in policy/alert mode (not 170)', () => {
    const ss = { status: 'current', number_of_users: '3400', casbCollectionProfile: 'policy_alerts' };
    const ctx = { catalog: sourceCatalog, allInputs: { casb: ss } };
    const est = calculateFullSourceIngest(casb, ss, ctx);
    expect(est.expected).toBeCloseTo(17, 1);
    expect(est.expected).toBeLessThan(25);
  });

  it('allows full inline profile at 0.05/user when explicitly selected', () => {
    const ss = { status: 'current', number_of_users: '3400', casbCollectionProfile: 'full_inline_saas' };
    const ctx = { catalog: sourceCatalog, allInputs: { casb: ss } };
    const est = calculateFullSourceIngest(casb, ss, ctx);
    expect(est.expected).toBeCloseTo(170, 1);
  });
});

describe('SaaS parent simple-sizing unit', () => {
  const saas = byId('saas_general');

  it('sizes configured SaaS applications or tenants at 0.15 each', () => {
    const ss = { status: 'current', saasTenantCount: '5' };
    const est = calculateFullSourceIngest(saas, ss, {
      catalog: sourceCatalog,
      allInputs: { saas_general: ss },
    });
    expect(est.expected).toBeCloseTo(0.75, 5);
    expect(est.countBasis).toContain('SaaS applications');
  });

  it('does not reinterpret a legacy user count as tenant count', () => {
    const ss = { status: 'current', number_of_users: '500' };
    const est = calculateFullSourceIngest(saas, ss, {
      catalog: sourceCatalog,
      allInputs: { saas_general: ss },
    });
    expect(est.expected).toBe(0);
    expect(est.warnings.some((warning) => warning.includes('Legacy SaaS user count'))).toBe(true);
  });
});

describe('DLP planning calibration', () => {
  const dlp = byId('dlp');

  it('sizes incident telemetry at 0.002 GB/day per monitored user', () => {
    const ss = { status: 'current', number_of_users: '8000' };
    const est = calculateFullSourceIngest(dlp, ss, {
      catalog: sourceCatalog,
      allInputs: { dlp: ss },
    });
    expect(est.expected).toBeCloseTo(16, 5);
    expect(est.high).toBeCloseTo(19.2, 5);
  });

  it('uses 0.05 GB/day per DLP product for channel-only sizing', () => {
    const ss = {
      status: 'current',
      number_of_users: '0',
      number_of_channels: '3',
      dlpSizingProfile: 'channel_products',
    };
    const est = calculateFullSourceIngest(dlp, ss, {
      catalog: sourceCatalog,
      allInputs: { dlp: ss },
    });
    expect(est.expected).toBeCloseTo(0.15, 5);
  });

  it('excludes lookup-only DLP context from ingest', () => {
    const ss = {
      status: 'current',
      number_of_users: '8000',
      dlpSizingProfile: 'lookup_context',
    };
    const est = calculateFullSourceIngest(dlp, ss, {
      catalog: sourceCatalog,
      allInputs: { dlp: ss },
    });
    expect(est.expected).toBe(0);
    expect(est.lookupContextOnly).toBe(true);
  });
});

describe('Windows Server + EDR overlap', () => {
  const windows = byId('windows_servers');
  const edr = byId('edr');

  it('reduces Windows Server rate when EDR is active', () => {
    const sourceStates = {
      edr: { status: 'current', number_of_endpoints: '4000' },
      windows_servers: { status: 'current', number_of_servers: '294' },
    };
    const ctx = { catalog: sourceCatalog, allInputs: sourceStates };
    const est = calculateFullSourceIngest(windows, sourceStates.windows_servers, ctx);
    expect(est.expected).toBeCloseTo(294 * 0.08, 1);
    expect(est.expected).toBeLessThan(50);
  });

  it('Placer-style session total is under 160 GB/day (was ~370 before fix)', () => {
    const sourceStates = {
      casb: { status: 'current', number_of_users: '3400' },
      windows_servers: { status: 'current', number_of_servers: '294' },
      edr: { status: 'current', number_of_endpoints: '4000', vendor: 'CrowdStrike Falcon' },
      saas_sso: { status: 'current', ssoActiveUserCount: '3400', vendor: 'Okta' },
      firewalls: { status: 'current', number_of_systems: '10', vendor: 'Palo Alto Networks' },
      active_directory: { status: 'current', number_of_dcs: '6' },
      linux_servers: { status: 'current', number_of_systems: '15' },
      iaas: { status: 'current', iaasAccountCount: '4', vendor: 'Azure' },
      vuln_mgmt: { status: 'current', number_of_assets: '2' },
      threat_intel: { status: 'current', number_of_feeds: '3' },
    };
    const { totals } = sumSessionPlanningIngest({
      catalog: sourceCatalog,
      sourceStates,
      overlapDecisions: {},
    });
    expect(totals.expected).toBeLessThan(160);
    expect(totals.expected).toBeGreaterThan(100);
  });
});

describe('applyPlanningAdjustments', () => {
  it('zeros Windows servers when overlap decision marks EDR included', () => {
    const windows = byId('windows_servers');
    const base = { expected: 88, low: 70, high: 100, assumptions: [], warnings: [] };
    const out = applyPlanningAdjustments(
      windows,
      { number_of_servers: '294' },
      base,
      {
        allInputs: { edr: { status: 'current', number_of_endpoints: '4000' } },
        overlapDecisions: {
          edr__windows_servers: { selectedOption: { id: 'included', dedup: true } },
        },
      },
    );
    expect(out.expected).toBe(0);
  });
});
