import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sourceCatalog from '../data/sources.json';
import sampleScenarios from '../data/sampleScenarios.js';
import overlapTelemetryCopy from '../data/overlapTelemetryCopy.json';
import { getConfiguredOverlapNotes } from '../services/reviewGateEngine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reviewPageSource = readFileSync(resolve(__dirname, 'ReviewPage.jsx'), 'utf8');
const robbins = sampleScenarios.find((s) => s.id === 'robbins_retail_hybrid');

describe('getConfiguredOverlapNotes telemetry payload', () => {
  it('returns structured overlap notes with sharedTelemetry and confirmQuestion', () => {
    const sources = {
      ...robbins.sources,
      saas_general: { ...robbins.sources.saas_general, status: 'current' },
      saas_office: { ...robbins.sources.saas_office, status: 'current' },
    };
    const overlaps = getConfiguredOverlapNotes(sources, sourceCatalog);
    const pair = overlaps.find((o) => o.pairKey === 'saas_general__saas_office');
    expect(pair).toBeTruthy();
    expect(pair.sourceNames).toEqual(['Office Productivity (M365/Google)', 'SaaS (General)']);
    expect(pair.summary).toBeTruthy();
    expect(pair.confirmQuestion).toMatch(/M365|general SaaS/i);
    expect(pair.sharedTelemetry.length).toBeGreaterThanOrEqual(3);
    expect(pair.sharedTelemetry[0]).toMatchObject({
      label: expect.any(String),
      example: expect.any(String),
    });
    expect(pair.hint).toMatch(/Both sources remain in your total/i);
  });

  it('loads copy for every overlapEngine pair key', () => {
    const pairKeys = [
      'firewalls__ids_ips',
      'firewalls__ndr',
      'proxy__sase',
      'firewalls__sase',
      'firewalls__vpn',
      'cspm__cwpp',
      'edr__windows_servers',
      'saas_general__saas_office',
    ];
    for (const key of pairKeys) {
      expect(overlapTelemetryCopy.pairs[key]?.sharedTelemetry?.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('ReviewPage overlap interaction UI', () => {
  it('OverlapPairVisual expands to show sharedTelemetry items', () => {
    expect(reviewPageSource).toContain('function OverlapPairVisual');
    expect(reviewPageSource).toContain('useState(false)');
    expect(reviewPageSource).toContain('What overlaps?');
    expect(reviewPageSource).toContain('Telemetry that may appear in both sources');
    expect(reviewPageSource).toContain('sharedTelemetry');
    expect(reviewPageSource).toContain('confirmQuestion');
    expect(reviewPageSource).toContain('Confirm during planning:');
    expect(reviewPageSource).toContain('{expanded &&');
    expect(reviewPageSource).toContain('telemetry.map');
  });
});
