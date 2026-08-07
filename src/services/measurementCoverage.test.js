import { describe, it, expect } from 'vitest';
import sourceCatalog from '../data/sources.json';
import originalSizingRates from '../data/originalSizingRates.json';
import questionsData from '../data/sourceMeasurementQuestions.json';
import { flattenSourceCatalog } from './sizingEngine.js';
import {
  getMeasurementQuestion,
  resolveMeasurementInputFields,
} from './sourceMeasurementQuestionsService.js';
import { calculateSimpleSourceIngest } from './simpleSizingEngine.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const catalogById = Object.fromEntries(flatCatalog.map((s) => [s.id, s]));

const TOP_20_SOURCE_IDS = [
  'iaas',
  'iaas_instances',
  'iaas_storage',
  'windows_servers',
  'linux_servers',
  'firewalls',
  'active_directory',
  'edr',
  'saas_office',
  'saas_sso',
  'netflow',
  'dns',
  'web_servers',
  'app_servers',
  'database',
  'desktops',
  'vpn',
  'proxy',
  'storage_prod',
  'cspm',
];

describe('resolveMeasurementInputFields', () => {
  it('exposes iaasAccountCount from catalog input_fields', () => {
    const source = catalogById.iaas;
    expect(source.input_fields.length).toBeGreaterThanOrEqual(1);

    const measurement = getMeasurementQuestion('iaas');
    const rate = originalSizingRates.entries.iaas;
    const { numbers } = resolveMeasurementInputFields('iaas', source, measurement, rate);

    expect(numbers.length).toBeGreaterThanOrEqual(1);
    expect(numbers[0].key).toBe('iaasAccountCount');
    expect(numbers[0].type).toBe('number');
    expect(numbers[0].label).toMatch(/accounts/i);
  });

  it('does not show supplementary add-on fields when log channel toggles exist', () => {
    const source = catalogById.windows_servers;
    const rate = originalSizingRates.entries.windows_servers;
    const measurement = getMeasurementQuestion('windows_servers');
    const { numbers } = resolveMeasurementInputFields('windows_servers', source, measurement, rate);

    const keys = numbers.map((f) => f.key);
    expect(keys).toContain('number_of_servers');
    expect(keys).not.toContain('windows_application_log_servers');
    expect(keys).not.toContain('windows_security_log_servers');
  });

  it('does not inject storage_prod secondary count fields into configure UI', () => {
    const source = catalogById.storage_prod;
    const rate = originalSizingRates.entries.storage_prod;
    const measurement = getMeasurementQuestion('storage_prod');
    const { numbers } = resolveMeasurementInputFields('storage_prod', source, measurement, rate);

    const keys = numbers.map((f) => f.key);
    expect(keys).toEqual(['number_of_systems']);
    expect(keys).not.toContain('storage_moderate_iops_arrays');
    expect(keys).not.toContain('storage_san_switches');
  });

  for (const sourceId of TOP_20_SOURCE_IDS) {
    it(`shows at least one number input for ${sourceId}`, () => {
      const source = catalogById[sourceId];
      expect(source, `catalog missing ${sourceId}`).toBeTruthy();

      const measurement = questionsData.questions?.[sourceId] ?? null;
      const rate = originalSizingRates.entries?.[sourceId] ?? null;
      const { numbers } = resolveMeasurementInputFields(sourceId, source, measurement, rate);

      expect(numbers.length).toBeGreaterThanOrEqual(1);
      expect(numbers.every((f) => f.type === 'number')).toBe(true);
    });
  }
});

describe('simpleSizingEngine iaas primary field', () => {
  it('iaasAccountCount=6 yields expected = 6 * rateGbPerUnit', () => {
    const source = catalogById.iaas;
    const rate = originalSizingRates.entries.iaas;
    const result = calculateSimpleSourceIngest(source, { iaasAccountCount: 6 });

    expect(result.quantity).toBe(6);
    expect(result.expected).toBeCloseTo(6 * rate.rateGbPerUnit, 5);
    expect(result.expected).toBeCloseTo(1.5, 5);
  });

  it('reads nested primaryInputField for iaas_containers', () => {
    const source = catalogById.iaas_containers;
    const rate = originalSizingRates.entries.iaas_containers;
    const result = calculateSimpleSourceIngest(source, {
      containerCounts: { clusters: 4, nodes: 20, pods: 100 },
    });

    expect(result.quantity).toBe(4);
    expect(result.expected).toBeCloseTo(4 * rate.rateGbPerUnit, 5);
  });

  it('adds optional secondary ingest for windows log channels', () => {
    const source = catalogById.windows_servers;
    const rate = originalSizingRates.entries.windows_servers;
    const result = calculateSimpleSourceIngest(source, {
      number_of_servers: 10,
      windows_application_log_servers: 5,
    });

    const primary = 10 * rate.rateGbPerUnit;
    const secondary = 5 * rate.optionalSecondaryInputs[0].rateGbPerUnit;
    expect(result.expected).toBeCloseTo(primary + secondary, 5);
  });
});

describe('measurement question ↔ rate alignment', () => {
  it('primaryInputField matches between questions and originalSizingRates for all shared sources', () => {
    const mismatches = [];
    for (const [sourceId, rate] of Object.entries(originalSizingRates.entries)) {
      const q = questionsData.questions?.[sourceId];
      if (!q) continue;
      if (q.primaryInputField !== rate.primaryInputField) {
        mismatches.push(`${sourceId}: question=${q.primaryInputField} rate=${rate.primaryInputField}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
