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
