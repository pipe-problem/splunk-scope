import { describe, it, expect } from 'vitest';
import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog, calculateSourceSize } from './sizingEngine.js';
import {
  calculateOfficeProductivitySizing,
  detectOfficeProductivityOverlap,
  formatOfficeProductivityIngest,
  formatOfficeProductivityIngestString,
  getOfficeFieldVisibility,
  getOfficeProductivitySizingReviewDisplay,
  normalizeOfficeProductivityState,
  OFFICE_REVIEW_SUMMARY_TEXT,
} from './officeProductivitySizingEngine.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const saasOffice = flatCatalog.find((s) => s.id === 'saas_office');

function baseState(overrides = {}) {
  return {
    status: 'current',
    officeProductivityProduct: 'microsoft_365',
    officeTenantCount: '1',
    officeActiveUserCount: '',
    officeActiveMailboxCount: '',
    officeActiveFileUserCount: '',
    officeActiveCollaborationUserCount: '',
    officeCollectionProfile: 'standard_activity',
    officeCustomizeComponents: false,
    ...overrides,
  };
}

describe('formatOfficeProductivityIngest adaptive display', () => {
  it('shows MB/day when below 0.1 GB/day', () => {
    expect(formatOfficeProductivityIngestString(0.0007)).toBe('0.72 MB/day');
    expect(formatOfficeProductivityIngestString(0.005379)).toContain('MB/day');
  });

  it('shows GB/day when at or above 0.1 GB/day', () => {
    expect(formatOfficeProductivityIngestString(0.12)).toBe('0.12 GB/day');
  });

  it('never shows 0.000000 for small positive values', () => {
    const s = formatOfficeProductivityIngestString(0.000001);
    expect(s).not.toMatch(/0\.0{4,} GB/);
  });

  it('does not duplicate GB/day in formatted string', () => {
    expect(formatOfficeProductivityIngestString(0.12)).not.toMatch(/GB\/day GB\/day/);
  });
});

describe('normalizeOfficeProductivityState', () => {
  it('defaults tenant to 1 when source is current and tenant blank', () => {
    const n = normalizeOfficeProductivityState({ status: 'current' });
    expect(n.officeTenantCount).toBe('1');
  });

  it('does not default tenant when source is not active', () => {
    const n = normalizeOfficeProductivityState({ status: 'unknown' });
    expect(n.officeTenantCount).toBe('');
  });

  it('treats blank numeric counts as empty strings (parsed as 0)', () => {
    const n = normalizeOfficeProductivityState({ status: 'current', officeActiveMailboxCount: '' });
    expect(n.officeActiveMailboxCount).toBe('');
  });

  it('maps legacy count to user and mailbox fields', () => {
    const n = normalizeOfficeProductivityState({ count: '200', vendor: 'Google Workspace' });
    expect(n.officeActiveUserCount).toBe('200');
    expect(n.officeActiveMailboxCount).toBe('200');
    expect(n.officeProductivityProduct).toBe('google_workspace');
  });
});

describe('Office productivity additive sizing — measured examples', () => {
  it('Example 1 — Microsoft 365 small full activity', () => {
    const r = calculateOfficeProductivitySizing(
      baseState({
        officeActiveUserCount: '50',
        officeActiveMailboxCount: '50',
        officeActiveFileUserCount: '40',
        officeActiveCollaborationUserCount: '40',
        officeCollectionProfile: 'full_activity',
      }),
    );
    expect(r.expected).toBeCloseTo(0.005379, 3);
  });

  it('Example 2 — Microsoft 365 medium full activity', () => {
    const r = calculateOfficeProductivitySizing(
      baseState({
        officeActiveUserCount: '500',
        officeActiveMailboxCount: '500',
        officeActiveFileUserCount: '400',
        officeActiveCollaborationUserCount: '350',
        officeCollectionProfile: 'full_activity',
      }),
    );
    expect(r.expected).toBeCloseTo(0.044086, 2);
  });

  it('Example 3 — Google Workspace medium full activity', () => {
    const r = calculateOfficeProductivitySizing(
      baseState({
        officeProductivityProduct: 'google_workspace',
        officeActiveUserCount: '500',
        officeActiveMailboxCount: '500',
        officeActiveFileUserCount: '400',
        officeActiveCollaborationUserCount: '350',
        officeCollectionProfile: 'full_activity',
      }),
    );
    expect(r.expected).toBeCloseTo(0.03204, 2);
  });

  it('Example 4 — Exchange Online medium standard activity', () => {
    const r = calculateOfficeProductivitySizing(
      baseState({
        officeProductivityProduct: 'exchange_online',
        officeActiveMailboxCount: '500',
        officeCollectionProfile: 'standard_activity',
      }),
    );
    expect(r.expected).toBeCloseTo(0.048893, 3);
  });

  it('Example 5 — SharePoint Online medium full activity', () => {
    const r = calculateOfficeProductivitySizing(
      baseState({
        officeProductivityProduct: 'sharepoint_online',
        officeActiveFileUserCount: '400',
        officeCollectionProfile: 'full_activity',
      }),
    );
    expect(r.expected).toBeCloseTo(0.023617, 3);
  });

  it('Example 6 — Teams medium standard activity', () => {
    const r = calculateOfficeProductivitySizing(
      baseState({
        officeProductivityProduct: 'teams',
        officeActiveCollaborationUserCount: '350',
        officeCollectionProfile: 'standard_activity',
      }),
    );
    expect(r.expected).toBeCloseTo(0.010967, 3);
  });

  it('Example 7 — Average / Blended medium full activity', () => {
    const r = calculateOfficeProductivitySizing(
      baseState({
        officeProductivityProduct: 'average_blended',
        officeActiveUserCount: '500',
        officeActiveMailboxCount: '500',
        officeActiveFileUserCount: '400',
        officeActiveCollaborationUserCount: '350',
        officeCollectionProfile: 'full_activity',
      }),
    );
    expect(r.expected).toBeCloseTo(0.038112, 3);
  });
});

describe('Office productivity profiles and toggles', () => {
  it('audit_only excludes standard/full workload components for M365', () => {
    const r = calculateOfficeProductivitySizing(
      baseState({
        officeCollectionProfile: 'audit_only',
        officeActiveMailboxCount: '50',
        officeActiveFileUserCount: '40',
        officeActiveCollaborationUserCount: '40',
      }),
    );
    expect(r.officeBreakdown).toHaveLength(1);
    expect(r.officeBreakdown[0].id).toBe('tenant_admin_audit');
  });

  it('standard profile includes primary workload components for M365', () => {
    const r = calculateOfficeProductivitySizing(
      baseState({
        officeCollectionProfile: 'standard_activity',
        officeActiveMailboxCount: '50',
        officeActiveFileUserCount: '40',
      }),
    );
    expect(r.officeBreakdown.map((row) => row.id)).toEqual([
      'tenant_admin_audit',
      'exchange_mail',
      'sharepoint_file',
    ]);
  });

  it('full profile adds Teams activity for M365', () => {
    const r = calculateOfficeProductivitySizing(
      baseState({
        officeCollectionProfile: 'full_activity',
        officeActiveMailboxCount: '50',
        officeActiveFileUserCount: '40',
        officeActiveCollaborationUserCount: '40',
      }),
    );
    expect(r.officeBreakdown.some((row) => row.id === 'teams_chat_meeting')).toBe(true);
  });
});

describe('Office product field visibility', () => {
  it('Exchange Online emphasizes mailboxes', () => {
    const vis = getOfficeFieldVisibility('exchange_online');
    expect(vis.officeActiveMailboxCount).toBe(true);
    expect(vis.officeActiveFileUserCount).toBe(false);
  });

  it('Teams emphasizes collaboration users', () => {
    const vis = getOfficeFieldVisibility('teams');
    expect(vis.officeActiveCollaborationUserCount).toBe(true);
    expect(vis.officeActiveMailboxCount).toBe(false);
  });
});

describe('Office productivity overlap detection', () => {
  it('warns when overlapping SaaS sources are active', () => {
    const msg = detectOfficeProductivityOverlap(baseState(), {
      saas_general: { status: 'current', saasActiveUsers: '100' },
    });
    expect(msg).toContain('overlap');
  });

  it('warns when Microsoft 365 and email are both configured', () => {
    const msg = detectOfficeProductivityOverlap(
      baseState({ officeProductivityProduct: 'microsoft_365' }),
      { email: { status: 'current', count: '10' } },
    );
    expect(msg).toContain('Exchange');
  });
});

describe('Office productivity review display', () => {
  it('includes M365 suite note for Microsoft 365', () => {
    const r = calculateOfficeProductivitySizing(
      baseState({ officeActiveMailboxCount: '50' }),
    );
    const display = getOfficeProductivitySizingReviewDisplay(r);
    expect(display.summary).toBe(OFFICE_REVIEW_SUMMARY_TEXT);
    expect(display.m365Note).toContain('Microsoft 365');
    expect(display.rows[0].label).not.toContain('office');
  });
});

describe('Office productivity via sizingEngine', () => {
  it('routes saas_office through additive engine', () => {
    const r = calculateSourceSize(
      saasOffice,
      baseState({
        officeActiveMailboxCount: '50',
        officeActiveFileUserCount: '40',
        officeActiveCollaborationUserCount: '40',
        officeCollectionProfile: 'full_activity',
      }),
      { allInputs: {} },
    );
    expect(r.rateSource).toBe('office_productivity_additive');
    expect(r.expected).toBeCloseTo(0.005379, 3);
  });
});

describe('Office session field preservation', () => {
  it('preserves product, profile, counts, and toggles', () => {
    const original = {
      status: 'current',
      officeProductivityProduct: 'google_workspace',
      officeTenantCount: '2',
      officeActiveUserCount: '120',
      officeActiveMailboxCount: '100',
      officeActiveFileUserCount: '80',
      officeActiveCollaborationUserCount: '60',
      officeCollectionProfile: 'full_activity',
      officeCustomizeComponents: true,
      officeComponentToggles: {
        includeTenantAdminAudit: true,
        includeLoginAccessSecurity: true,
        includeEmailMessageActivity: false,
        includeFileActivity: true,
        includeChatMeetingActivity: true,
      },
    };
    const normalized = normalizeOfficeProductivityState(original);
    expect(normalized.officeProductivityProduct).toBe('google_workspace');
    expect(normalized.officeComponentToggles.includeEmailMessageActivity).toBe(false);
  });
});
