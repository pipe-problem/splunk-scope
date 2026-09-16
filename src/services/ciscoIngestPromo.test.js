import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/featureFlags.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, SIZING_MODE: 'simple', OVERLAP_ANNOTATE_ONLY: true };
});

import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog } from './sizingEngine.js';
import { calculateFullSourceIngest } from './sourceEligibilityEngine.js';
import { sumSessionPlanningIngest } from './planningIngestTotals.js';
import {
  isCiscoVendor,
  findParentSourceId,
  resolveSourceVendor,
  applyCiscoIngestPromo,
  CISCO_INGEST_PROMO_FACTOR,
} from './ciscoIngestPromo.js';

const flat = flattenSourceCatalog(sourceCatalog);
const byId = (id) => flat.find((s) => s.id === id);

describe('isCiscoVendor', () => {
  it('matches Cisco catalog labels', () => {
    expect(isCiscoVendor('Cisco ISE')).toBe(true);
    expect(isCiscoVendor('Cisco ASA/Firepower')).toBe(true);
    expect(isCiscoVendor('cisco meraki')).toBe(true);
    expect(isCiscoVendor('Cisco')).toBe(true);
  });

  it('rejects non-Cisco vendors and Francisco', () => {
    expect(isCiscoVendor('Palo Alto Networks')).toBe(false);
    expect(isCiscoVendor('Fortinet FortiGate')).toBe(false);
    expect(isCiscoVendor('San Francisco')).toBe(false);
    expect(isCiscoVendor('')).toBe(false);
    expect(isCiscoVendor(null)).toBe(false);
  });
});

describe('parent vendor inheritance', () => {
  it('finds firewall child parent', () => {
    const parent = findParentSourceId(sourceCatalog, 'fw_perimeter');
    expect(parent).toBe('firewalls');
  });

  it('inherits Cisco vendor from parent state', () => {
    const child = byId('fw_perimeter');
    const vendor = resolveSourceVendor(child, { status: 'current', count: 10 }, {
      catalog: sourceCatalog,
      allInputs: {
        firewalls: { status: 'current', vendor: 'Cisco ASA/Firepower' },
        fw_perimeter: { status: 'current', count: 10 },
      },
    });
    expect(vendor).toBe('Cisco ASA/Firepower');
  });
});

describe('applyCiscoIngestPromo', () => {
  it('halves Cisco ingest and keeps gross', () => {
    const out = applyCiscoIngestPromo(
      { id: 'firewalls' },
      { vendor: 'Cisco ASA/Firepower' },
      { expected: 10, low: 8, high: 12, assumptions: [], warnings: [] },
    );
    expect(out.ciscoPromoApplied).toBe(true);
    expect(out.ciscoPromoFactor).toBe(CISCO_INGEST_PROMO_FACTOR);
    expect(out.gbGrossExpected).toBe(10);
    expect(out.expected).toBe(5);
    expect(out.low).toBe(4);
    expect(out.high).toBe(6);
  });

  it('leaves Palo Alto unchanged as billable = gross', () => {
    const out = applyCiscoIngestPromo(
      { id: 'firewalls' },
      { vendor: 'Palo Alto Networks' },
      { expected: 10, low: 8, high: 12, assumptions: [], warnings: [] },
    );
    expect(out.ciscoPromoApplied).toBe(false);
    expect(out.expected).toBe(10);
    expect(out.gbGrossExpected).toBe(10);
  });
});

describe('calculateFullSourceIngest Cisco promo', () => {
  const fw = byId('firewalls');

  it('discounts Cisco firewall simple sizing vs Palo Alto', () => {
    const ciscoState = {
      status: 'current',
      vendor: 'Cisco ASA/Firepower',
      number_of_systems: '10',
    };
    const paloState = {
      status: 'current',
      vendor: 'Palo Alto Networks',
      number_of_systems: '10',
    };
    const cisco = calculateFullSourceIngest(fw, ciscoState, {
      catalog: sourceCatalog,
      allInputs: { firewalls: ciscoState },
    });
    const palo = calculateFullSourceIngest(fw, paloState, {
      catalog: sourceCatalog,
      allInputs: { firewalls: paloState },
    });
    expect(cisco.ciscoPromoApplied).toBe(true);
    expect(palo.ciscoPromoApplied).toBe(false);
    expect(cisco.expected).toBeCloseTo(palo.expected * 0.5, 5);
    expect(cisco.gbGrossExpected).toBeCloseTo(palo.expected, 5);
  });

  it('applies promo to children that inherit a Cisco parent vendor', () => {
    const parent = { status: 'current', vendor: 'Cisco ASA/Firepower' };
    const childState = { status: 'current', count: 4 };
    const child = byId('fw_perimeter') || fw;
    if (child.id === 'firewalls') return;
    const est = calculateFullSourceIngest(child, childState, {
      catalog: sourceCatalog,
      allInputs: { firewalls: parent, [child.id]: childState },
    });
    if (est.expected > 0) {
      expect(est.ciscoPromoApplied).toBe(true);
      expect(est.expected).toBeCloseTo(est.gbGrossExpected * 0.5, 5);
    }
  });
});

describe('session mix of Cisco and non-Cisco', () => {
  it('session total is 0.5 of Cisco portion plus full non-Cisco', () => {
    const ciscoFw = { status: 'current', vendor: 'Cisco ASA/Firepower', number_of_systems: '10' };
    const paloFw = { status: 'current', vendor: 'Palo Alto Networks', number_of_systems: '10' };

    const ciscoOnly = sumSessionPlanningIngest({
      catalog: sourceCatalog,
      sourceStates: { firewalls: ciscoFw },
    });
    expect(ciscoOnly.totals.ciscoPromoApplied).toBe(true);
    expect(ciscoOnly.totals.expected).toBeCloseTo(ciscoOnly.totals.gross.expected * 0.5, 5);

    const paloOnly = sumSessionPlanningIngest({
      catalog: sourceCatalog,
      sourceStates: { firewalls: paloFw },
    });
    expect(paloOnly.totals.ciscoPromoApplied).toBe(false);
    expect(paloOnly.totals.expected).toBeCloseTo(paloOnly.totals.gross.expected, 5);
  });
});
