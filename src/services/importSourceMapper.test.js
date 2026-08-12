import { describe, expect, it } from 'vitest';
import { mapImportDataSources } from './importSourceMapper.js';

describe('importSourceMapper', () => {
  it('maps high-confidence EDR with count and vendor to apply-eligible candidate', () => {
    const warnings = [];
    const { sourceCandidates, sourceHints } = mapImportDataSources([
      {
        sourceId: 'edr',
        sourceName: 'EDR',
        vendor: 'CrowdStrike',
        count: 4000,
        confidence: 'high',
      },
    ], warnings);

    expect(sourceCandidates).toHaveLength(1);
    expect(sourceCandidates[0].applyEligible).toBe(true);
    expect(sourceCandidates[0].patch.number_of_endpoints).toBe(4000);
    expect(sourceCandidates[0].patch.vendor).toBe('CrowdStrike Falcon');
    expect(sourceHints).toHaveLength(0);
  });

  it('keeps vague cloud mention as hint only', () => {
    const { sourceCandidates, sourceHints } = mapImportDataSources([
      {
        sourceName: 'some cloud stuff',
        confidence: 'low',
        skipReason: 'No explicit user or tenant count',
      },
    ]);

    expect(sourceCandidates).toHaveLength(0);
    expect(sourceHints).toHaveLength(1);
    expect(sourceHints[0].confidence).toBe('low');
  });

  it('downgrades high confidence when count is missing', () => {
    const warnings = [];
    const { sourceCandidates } = mapImportDataSources([
      {
        sourceId: 'firewalls',
        sourceName: 'Firewalls',
        vendor: 'Palo Alto Networks',
        confidence: 'high',
      },
    ], warnings);

    expect(sourceCandidates[0].applyEligible).toBe(false);
    expect(sourceCandidates[0].confidence).toBe('low');
    expect(warnings.some((w) => w.includes('Downgraded'))).toBe(true);
  });

  it('maps generic count to primary input field for active directory', () => {
    const { sourceCandidates } = mapImportDataSources([
      {
        sourceId: 'active_directory',
        count: 6,
        confidence: 'high',
      },
    ]);

    expect(sourceCandidates[0].patch.number_of_dcs).toBe(6);
    expect(sourceCandidates[0].applyEligible).toBe(true);
  });

  it('accepts explicit inputs object over generic count', () => {
    const { sourceCandidates } = mapImportDataSources([
      {
        sourceId: 'iaas_containers',
        confidence: 'high',
        inputs: {
          containerCounts: { clusters: 4, nodes: 60 },
          vendor: 'Amazon EKS',
        },
      },
    ]);

    expect(sourceCandidates[0].patch.containerCounts.clusters).toBe(4);
    expect(sourceCandidates[0].applyEligible).toBe(true);
  });

  it('medium confidence is not apply-eligible by default', () => {
    const { sourceCandidates } = mapImportDataSources([
      {
        sourceId: 'firewalls',
        count: 10,
        vendor: 'Palo Alto Networks',
        confidence: 'medium',
      },
    ]);

    expect(sourceCandidates[0].applyEligible).toBe(false);
  });
});
