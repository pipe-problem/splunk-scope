import { describe, expect, it } from 'vitest';
import { evaluatePair, getLikelyPeerSourceIds, pairKey } from './sourceOverlapLookupEngine.js';

describe('sourceOverlapLookupEngine', () => {
  it('pairKey is order-independent', () => {
    expect(pairKey('cspm', 'iaas')).toBe('cspm__iaas');
    expect(pairKey('iaas', 'cspm')).toBe('cspm__iaas');
  });

  it('getLikelyPeerSourceIds includes CSPM cloud peers', () => {
    const peers = getLikelyPeerSourceIds('cspm');
    expect(peers).toContain('iaas');
    expect(peers).toContain('cwpp');
  });

  it('evaluatePair returns telemetry copy for cspm and iaas', () => {
    const result = evaluatePair('cspm', 'iaas');
    expect(result).not.toBeNull();
    expect(result.verdict).toBe('may_overlap');
    expect(result.summary).toMatch(/CSPM|IaaS|posture/i);
    expect(result.sharedTelemetry?.length).toBeGreaterThan(0);
  });

  it('evaluatePair returns null for same source', () => {
    expect(evaluatePair('cspm', 'cspm')).toBeNull();
  });

  it('evaluatePair returns telemetry for firewalls and ids_ips', () => {
    const result = evaluatePair('firewalls', 'ids_ips');
    expect(result?.verdict).toBe('may_overlap');
    expect(result?.sharedTelemetry?.length).toBeGreaterThan(0);
  });

  it('evaluatePair returns telemetry for saas_office and saas_general', () => {
    const result = evaluatePair('saas_office', 'saas_general');
    expect(result?.verdict).toBe('may_overlap');
    expect(result?.summary).toMatch(/M365|general SaaS|audit/i);
    expect(result?.sharedTelemetry?.length).toBeGreaterThan(0);
  });

  it('getLikelyPeerSourceIds includes network security peers for firewalls', () => {
    const peers = getLikelyPeerSourceIds('firewalls');
    expect(peers).toContain('ids_ips');
    expect(peers).toContain('ndr');
  });

  it('evaluatePair returns telemetry for active_directory and saas_sso', () => {
    const result = evaluatePair('active_directory', 'saas_sso');
    expect(result?.verdict).toBe('may_overlap');
    expect(result?.sharedTelemetry?.length).toBeGreaterThan(0);
  });
});
