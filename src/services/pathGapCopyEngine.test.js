import { describe, it, expect } from 'vitest';
import useCaseProfiles from '../data/useCaseProfiles.json';
import {
  mapGapToCustomerCopy,
  mapValidationGapsToCopy,
  formatRecommendedNotConfiguredGap,
  BANNED_GAP_SUBSTRINGS,
} from './pathGapCopyEngine.js';

const foundational = useCaseProfiles.find((uc) => uc.id === 'foundational_security');
const riskBased = useCaseProfiles.find((uc) => uc.id === 'risk_based_alerting');

describe('pathGapCopyEngine', () => {
  it('maps identity governance gap to source-aware customer copy', () => {
    const copy = mapGapToCustomerCopy('identity_governance', {
      useCases: [riskBased],
      intake: { useCases: ['Risk-Based Alerting'], desiredApps: ['user_behavior_analytics'] },
    });
    expect(copy).toMatch(/Identity provider logs|Directory authentication logs/);
    expect(copy).toMatch(/would strengthen/);
    expect(copy).toMatch(/identity and access monitoring/i);
    expect(copy).not.toContain('Additional telemetry needed');
    expect(copy).not.toMatch(/^Coverage:/);
  });

  it('maps authentication domain without generic placeholder', () => {
    const copy = mapGapToCustomerCopy('authentication', {
      useCases: [foundational],
      intake: { useCases: ['Foundational Security / InfoSec'] },
    });
    expect(copy).toMatch(/would strengthen authentication monitoring/i);
    expect(BANNED_GAP_SUBSTRINGS.every((banned) => !copy.includes(banned))).toBe(true);
  });

  it('preserves explicit non-generic gap messages', () => {
    const copy = mapGapToCustomerCopy(
      { domain: 'endpoint', message: 'Endpoint EDR coverage is below threshold for threat detection.' },
      { useCases: [foundational] },
    );
    expect(copy).toBe('Endpoint EDR coverage is below threshold for threat detection.');
  });

  it('deduplicates validation gap lines', () => {
    const lines = mapValidationGapsToCopy(
      { gaps: ['authentication', 'authentication', 'endpoint'] },
      { useCases: [foundational], intake: {} },
    );
    expect(lines.length).toBe(2);
    for (const line of lines) {
      expect(BANNED_GAP_SUBSTRINGS.every((banned) => !line.includes(banned))).toBe(true);
    }
  });

  it('formats recommended-not-configured rows for report copy', () => {
    expect(
      formatRecommendedNotConfiguredGap({
        name: 'Cloud IaaS',
        reason: 'Recommended for coverage — configure in Data Sources before ingest planning',
      }),
    ).toContain('Cloud IaaS:');
  });
});
