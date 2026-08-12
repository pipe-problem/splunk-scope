/**
 * Circuit-assisted structured import — prompt builder and response processor tests.
 */
import { describe, it, expect } from 'vitest';
import {
  buildCircuitExtractionPrompt,
  getAllowedUseCaseNames,
  getAllowedSplunkAppIds,
} from './circuitPromptBuilder.js';
import {
  extractJsonFromText,
  processCircuitResponse,
  getDefaultGoalPresetIds,
} from './circuitResponseProcessor.js';
import { getAllGoalPresetIds } from '../utils/goalPresets.js';

const SAMPLE_CIRCUIT_JSON = {
  customerName: 'Northwind Health',
  deploymentType: 'cloud',
  budget: 250000,
  summary: 'Splunk Cloud SIEM pilot',
  discoveryNotes: '40 Linux VMs, Palo Alto firewalls',
  primaryUseCases: ['Enterprise Security / SIEM', 'Identity and Access Monitoring'],
  secondaryUseCases: [],
  splunkApps: ['enterprise_security', 'security_essentials'],
  crawlGoalPresetId: 'crawl_initial_security_visibility',
  walkGoalPresetId: 'walk_expand_correlation',
  runGoalPresetId: 'run_optimize_and_mature',
  dataSources: [
    {
      sourceName: 'Linux servers',
      vendor: 'Linux',
      count: 40,
      notes: 'syslog and auditd',
    },
    {
      sourceName: 'Palo Alto',
      vendor: 'Palo Alto',
      product: 'firewall',
      count: 2,
    },
  ],
  importantRequirements: ['PCI scope'],
  knownGaps: [],
  openQuestions: ['Confirm M365 license tier'],
  confidence: { overall: 'medium', notes: 'Budget stated explicitly' },
};

describe('circuitPromptBuilder', () => {
  it('includes required JSON schema shape', () => {
    const prompt = buildCircuitExtractionPrompt();
    expect(prompt).toContain('"customerName"');
    expect(prompt).toContain('"deploymentType"');
    expect(prompt).toContain('"crawlGoalPresetId"');
    expect(prompt).toContain('"dataSources"');
    expect(prompt).toContain('Return JSON only');
  });

  it('includes allowed use case names', () => {
    const prompt = buildCircuitExtractionPrompt();
    const names = getAllowedUseCaseNames();
    expect(names.length).toBeGreaterThan(5);
    expect(prompt).toContain('Enterprise Security / SIEM');
    expect(prompt).toContain(names[0]);
  });

  it('includes allowed Splunk app IDs', () => {
    const prompt = buildCircuitExtractionPrompt();
    const ids = getAllowedSplunkAppIds();
    expect(ids).toContain('enterprise_security');
    expect(prompt).toContain('enterprise_security');
  });

  it('includes goal preset IDs', () => {
    const prompt = buildCircuitExtractionPrompt();
    const ids = getAllGoalPresetIds();
    expect(prompt).toContain('crawl_foundational_visibility');
    expect(prompt).toContain(ids.crawl[0]);
    expect(prompt).toContain('walk_expand_correlation');
    expect(prompt).toContain('run_optimize_and_mature');
  });

  it('includes aiSummary and source catalog appendix for Cursor import', () => {
    const prompt = buildCircuitExtractionPrompt();
    expect(prompt).toContain('"aiSummary"');
    expect(prompt).toContain('useCaseAssessment');
    expect(prompt).toContain('"confidence"');
    expect(prompt).toContain('primaryInputField');
    expect(prompt).toContain('sourceId exactly');
  });
});

describe('circuitResponseProcessor', () => {
  it('parses clean JSON', () => {
    const result = processCircuitResponse(JSON.stringify(SAMPLE_CIRCUIT_JSON));
    expect(result.parsed).toBe(true);
    expect(result.source).toBe('circuit_json');
    expect(result.fields.customerName).toBe('Northwind Health');
    expect(result.fields.deploymentType).toBe('cloud');
    expect(result.fields.budget).toBe(250000);
    expect(result.fields.useCases).toContain('Enterprise Security / SIEM');
    expect(result.fields.desiredApps).toContain('enterprise_security');
  });

  it('extracts JSON from markdown code fences', () => {
    const wrapped = 'Here is the data:\n```json\n' + JSON.stringify(SAMPLE_CIRCUIT_JSON) + '\n```';
    const result = processCircuitResponse(wrapped);
    expect(result.parsed).toBe(true);
    expect(result.fields.customerName).toBe('Northwind Health');
  });

  it('handles invalid JSON gracefully', () => {
    const result = processCircuitResponse('not json at all');
    expect(result.parsed).toBe(false);
    expect(result.parseError).toBeTruthy();
    expect(result.fields).toBeNull();
  });

  it('maps use cases exactly', () => {
    const payload = { ...SAMPLE_CIRCUIT_JSON, primaryUseCases: ['Threat Detection and Investigation'] };
    const result = processCircuitResponse(JSON.stringify(payload));
    expect(result.fields.useCases).toEqual(['Threat Detection and Investigation']);
  });

  it('maps app IDs and app names', () => {
    const byName = processCircuitResponse(JSON.stringify({
      ...SAMPLE_CIRCUIT_JSON,
      splunkApps: ['Splunk Enterprise Security', 'enterprise_security'],
    }));
    expect(byName.fields.desiredApps).toContain('enterprise_security');
  });

  it('maps deployment aliases', () => {
    const onPrem = processCircuitResponse(JSON.stringify({ deploymentType: 'on prem' }));
    expect(onPrem.fields.deploymentType).toBe('onprem');
    const hybrid = processCircuitResponse(JSON.stringify({ deploymentType: 'Hybrid deployment' }));
    expect(hybrid.fields.deploymentType).toBe('hybrid');
    const cloud = processCircuitResponse(JSON.stringify({ deploymentType: 'Splunk Cloud' }));
    expect(cloud.fields.deploymentType).toBe('cloud');
    const self = processCircuitResponse(JSON.stringify({ deploymentType: 'self-managed' }));
    expect(self.fields.deploymentType).toBe('onprem');
  });

  it('validates goal preset IDs', () => {
    const good = processCircuitResponse(JSON.stringify(SAMPLE_CIRCUIT_JSON));
    expect(good.fields.crawlGoalPresetId).toBe('crawl_initial_security_visibility');
    const bad = processCircuitResponse(JSON.stringify({
      ...SAMPLE_CIRCUIT_JSON,
      crawlGoalPresetId: 'made_up_goal',
    }));
    expect(bad.warnings.some((w) => w.includes('crawl goal preset'))).toBe(true);
    expect(bad.fields.crawlGoalPresetId).toBe('');
  });

  it('unknown use cases produce warnings, not crashes', () => {
    const result = processCircuitResponse(JSON.stringify({
      ...SAMPLE_CIRCUIT_JSON,
      primaryUseCases: ['Fake Use Case XYZ'],
    }));
    expect(result.parsed).toBe(true);
    expect(result.warnings.some((w) => w.includes('Unmatched'))).toBe(true);
    expect(result.fields.useCases).not.toContain('Fake Use Case XYZ');
  });

  it('falls back to heuristic for long unstructured text', () => {
    const text = `
Customer: Acme Corp
Deployment: Splunk Cloud
We need SIEM and SOC visibility.
Splunk Enterprise Security mentioned.
Palo Alto firewalls and Active Directory.
About 500 endpoints.
    `.trim();
    const result = processCircuitResponse(text);
    expect(result.parsed).toBe(true);
    expect(result.source).toBe('heuristic_fallback');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('extractJsonFromText handles braces in prose', () => {
    const obj = extractJsonFromText(JSON.stringify({ a: 1 }));
    expect(obj).toEqual({ a: 1 });
  });

  it('default goal preset IDs match library', () => {
    const defaults = getDefaultGoalPresetIds();
    expect(defaults.crawl).toBe('crawl_foundational_visibility');
    expect(defaults.walk).toBe('walk_expand_correlation');
    expect(defaults.run).toBe('run_optimize_and_mature');
  });

  it('maps aiSummary into aiImportSummary fields', () => {
    const payload = {
      ...SAMPLE_CIRCUIT_JSON,
      aiSummary: {
        useCaseAssessment: 'Cloud SIEM with identity and perimeter focus.',
        recommendedSplunkCapabilities: ['Enterprise Security', 'CIM'],
        recommendedAppIds: ['enterprise_security', 'cim'],
      },
    };
    const result = processCircuitResponse(JSON.stringify(payload));
    expect(result.fields.aiImportSummary.useCaseAssessment).toContain('Cloud SIEM');
    expect(result.fields.aiImportSummary.recommendedSplunkCapabilities).toContain('Enterprise Security');
    expect(result.fields.aiImportSummary.recommendedAppIds).toContain('enterprise_security');
  });

  it('maps high-confidence dataSources to apply-eligible sourceCandidates', () => {
    const payload = {
      ...SAMPLE_CIRCUIT_JSON,
      dataSources: [
        {
          sourceId: 'edr',
          vendor: 'CrowdStrike',
          count: 4000,
          confidence: 'high',
        },
        {
          sourceName: 'some cloud stuff',
          confidence: 'low',
          skipReason: 'No explicit user or tenant count',
        },
      ],
    };
    const result = processCircuitResponse(JSON.stringify(payload));
    expect(result.fields.sourceCandidates).toHaveLength(1);
    expect(result.fields.sourceCandidates[0].applyEligible).toBe(true);
    expect(result.fields.sourceCandidates[0].patch.number_of_endpoints).toBe(4000);
    expect(result.fields.sourceHints.some((h) => h.skipReason?.includes('tenant count'))).toBe(true);
  });
});

describe('session migration v5 goal presets', () => {
  it('migrates v4 session with legacy goals to v5', async () => {
    const { migrateSession, CURRENT_SCHEMA_VERSION } = await import('./sessionMigrationEngine.js');
    const { state, migrated } = migrateSession({
      schemaVersion: 4,
      intake: {
        customerName: 'Legacy Co',
        crawlGoal: 'Old crawl text',
        walkGoal: 'Old walk',
        opportunityBudgetUsd: '100000',
      },
      sources: {},
      currentStep: 1,
    });
    expect(migrated).toBe(true);
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(state.intake.crawlGoalPresetId).toBe('crawl_foundational_visibility');
    expect(state.intake.discoveryNotes).toContain('Legacy Crawl goal');
    expect(Array.isArray(state.intake.sourceHints)).toBe(true);
  });
});

describe('display labels', () => {
  it('formats telemetry domains for customer UI', async () => {
    const { formatTelemetryFocusLabel } = await import('../utils/displayLabels.js');
    expect(formatTelemetryFocusLabel('authentication')).toBe('Identity and authentication');
    expect(formatTelemetryFocusLabel('network')).toBe('Network and perimeter');
    expect(formatTelemetryFocusLabel('vulnerability_asset')).toBe('Asset and vulnerability context');
  });
});
