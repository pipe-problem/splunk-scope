import { describe, it, expect } from 'vitest';
import { getSourceCapabilities } from './logRequirementEngine.js';
import { prioritizeAndSortSources } from './sourcePrioritizationEngine.js';
import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog } from './sizingEngine.js';
import useCaseProfiles from '../data/useCaseProfiles.json';

const flat = flattenSourceCatalog(sourceCatalog);

const profiles = Array.isArray(useCaseProfiles) ? useCaseProfiles : Object.values(useCaseProfiles.profiles || {});

function profile(id) {
  return profiles.find((p) => p.id === id);
}

describe('logRequirements catalog id aliases', () => {
  it('maps firewalls/edr/AD/SSO catalog ids onto strengthBySource', () => {
    const fw = getSourceCapabilities('firewalls');
    const edr = getSourceCapabilities('edr');
    const ad = getSourceCapabilities('active_directory');
    const sso = getSourceCapabilities('saas_sso');
    expect(Object.keys(fw).length).toBeGreaterThan(0);
    expect(Object.keys(edr).length).toBeGreaterThan(0);
    expect(Object.keys(ad).length).toBeGreaterThan(0);
    expect(Object.keys(sso).length).toBeGreaterThan(0);
    expect(fw).toEqual(getSourceCapabilities('firewall_logs'));
  });
});

describe('recalibrated source ranking', () => {
  it('identity use cases rank AD and PAM above CSPM', () => {
    const identity = profile('identity_access') || {
      id: 'identity_access',
      name: 'Identity',
      requiredDomains: ['authentication'],
      splunkApps: ['Enterprise Security'],
    };
    const sorted = prioritizeAndSortSources(
      flat,
      [identity],
      ['enterprise_security'],
      flat,
      {},
      {},
      [],
      { desiredApps: ['enterprise_security'], customUseCases: 'Active Directory and SSO investigations' },
    );
    const idx = (id) => sorted.findIndex((s) => s.id === id);
    expect(idx('active_directory')).toBeGreaterThanOrEqual(0);
    expect(idx('active_directory')).toBeLessThan(idx('cspm') === -1 ? 999 : idx('cspm'));
  });

  it('network operations ranks firewalls, netflow, and dns highly', () => {
    const netops = {
      id: 'network_operations',
      name: 'Network operations',
      requiredDomains: ['network', 'network_performance'],
      splunkApps: [],
    };
    const sorted = prioritizeAndSortSources(
      flat,
      [netops],
      [],
      flat,
      {},
      {},
      [],
      { customUseCases: 'NetFlow, DNS, and firewall operations' },
    );
    const topIds = sorted.slice(0, 12).map((s) => s.id);
    expect(topIds).toEqual(expect.arrayContaining(['firewalls', 'netflow', 'dns']));
  });
});
