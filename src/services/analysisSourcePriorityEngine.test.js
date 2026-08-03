import { describe, it, expect } from 'vitest';
import useCaseProfiles from '../data/useCaseProfiles.json';
import {
  getAnalysisSourcePriorities,
  mapPriorityScoreToRelevance1to10,
  buildAnalysisSourceWhyOneLine,
} from './analysisSourcePriorityEngine.js';

describe('analysisSourcePriorityEngine', () => {
  const enterprise = useCaseProfiles.find((uc) => uc.id === 'enterprise_security');

  it('maps 0–100 priority scores to 1–10 relevance', () => {
    expect(mapPriorityScoreToRelevance1to10(0)).toBe(1);
    expect(mapPriorityScoreToRelevance1to10(1)).toBe(1);
    expect(mapPriorityScoreToRelevance1to10(10)).toBe(1);
    expect(mapPriorityScoreToRelevance1to10(11)).toBe(2);
    expect(mapPriorityScoreToRelevance1to10(100)).toBe(10);
  });

  it('ES intake boosts firewalls, active_directory, and edr', () => {
    const intake = {
      deploymentType: 'cloud',
      opportunityBudgetUsd: '250000',
      useCases: ['Enterprise Security / SIEM'],
      desiredApps: ['enterprise_security'],
    };
    const priorities = getAnalysisSourcePriorities({
      intake,
      desiredApps: ['enterprise_security'],
      recommendedApps: [],
      useCaseProfiles: [enterprise],
    });
    const ids = priorities.map((p) => p.sourceId);
    expect(ids).toContain('firewalls');
    expect(ids).toContain('active_directory');
    expect(ids).toContain('edr');
  });

  it('returns customer-safe whyOneLine without internal labels', () => {
    const line = buildAnalysisSourceWhyOneLine(
      { id: 'firewalls', name: 'Firewalls' },
      ['enterprise_security'],
      [{ name: 'Security Operations / SIEM' }],
    );
    expect(line.toLowerCase()).not.toContain('needs review');
    expect(line.toLowerCase()).not.toContain('optional');
    expect(line.toLowerCase()).not.toContain('required');
    expect(line).toMatch(/Enterprise Security|Telemetry/);
  });

  it('output shape includes appsPowered and relevanceScore1to10', () => {
    const intake = {
      deploymentType: 'cloud',
      useCases: ['Enterprise Security / SIEM'],
      desiredApps: ['enterprise_security'],
    };
    const priorities = getAnalysisSourcePriorities({
      intake,
      desiredApps: intake.desiredApps,
      useCaseProfiles: [enterprise],
      limit: 6,
    });
    expect(priorities.length).toBeGreaterThan(0);
    for (const row of priorities) {
      expect(row).toMatchObject({
        sourceId: expect.any(String),
        sourceName: expect.any(String),
        relevanceScore1to10: expect.any(Number),
        appsPowered: expect.any(Array),
        whyOneLine: expect.any(String),
      });
      expect(row.relevanceScore1to10).toBeGreaterThanOrEqual(1);
      expect(row.relevanceScore1to10).toBeLessThanOrEqual(10);
    }
  });
});
