import { describe, it, expect } from 'vitest';
import splunkApps from '../data/splunkApps.json';
import {
  getIntakeSplunkAppsCatalog,
  inferSplunkAppType,
  filterIntakeAppIds,
} from './splunkAppsCatalog.js';

describe('splunkAppsCatalog', () => {
  it('every app entry has appType app or addon', () => {
    for (const cat of splunkApps) {
      for (const app of cat.apps) {
        expect(['app', 'addon']).toContain(inferSplunkAppType(app));
      }
    }
  });

  it('intake catalog excludes add-ons', () => {
    const intakeCatalog = getIntakeSplunkAppsCatalog();
    for (const cat of intakeCatalog) {
      for (const app of cat.apps) {
        expect(inferSplunkAppType(app)).toBe('app');
      }
    }
    const flatIds = intakeCatalog.flatMap((c) => c.apps.map((a) => a.id));
    expect(flatIds).not.toContain('add_on_palo_alto_networks');
  });

  it('filterIntakeAppIds removes add-on ids', () => {
    const filtered = filterIntakeAppIds(['enterprise_security', 'add_on_cisco_security', 'custom:Foo']);
    expect(filtered).toEqual(['enterprise_security', 'custom:Foo']);
  });
});
