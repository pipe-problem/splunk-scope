import { describe, it, expect } from 'vitest';
import {
  createCustomSourceId,
  customSourceCatalogEntry,
  defaultCustomSourceState,
  listCustomSourcesFromSession,
  CUSTOM_SOURCE_CATEGORY,
} from './customSources.js';

describe('customSources', () => {
  it('createCustomSourceId returns custom_ prefix', () => {
    const id = createCustomSourceId();
    expect(id).toMatch(/^custom_\d+_/);
  });

  it('defaultCustomSourceState stores per-unit sizing', () => {
    const state = defaultCustomSourceState({
      name: 'Legacy syslog',
      vendor: 'Internal',
      count: '40',
      sizingMode: 'per_unit',
      sizingRate: '0.25',
    });
    expect(state.status).toBe('current');
    expect(state.name).toBe('Legacy syslog');
    expect(state.count).toBe('40');
    expect(state.sizingRate).toBe('0.25');
    expect(state.override).toBeUndefined();
  });

  it('defaultCustomSourceState stores manual total override', () => {
    const state = defaultCustomSourceState({
      name: 'Bulk feed',
      sizingMode: 'manual_total',
      manualGbTotal: '12.5',
    });
    expect(state.sizingMode).toBe('manual_total');
    expect(state.override).toBe('12.5');
  });

  it('customSourceCatalogEntry builds sizing formula from rate', () => {
    const entry = customSourceCatalogEntry('custom_1', { name: 'Test', sizingRate: '0.5' });
    expect(entry.category).toBe(CUSTOM_SOURCE_CATEGORY);
    expect(entry.isCustom).toBe(true);
    expect(entry.sizing_formula.rate_per_unit).toBe(0.5);
  });

  it('listCustomSourcesFromSession filters custom_* keys only', () => {
    const list = listCustomSourcesFromSession({
      windows_security: { status: 'current' },
      custom_abc: { name: 'One', status: 'current' },
      custom_def: { name: 'Two', status: 'skip' },
    });
    expect(list).toHaveLength(2);
    expect(list.map((s) => s.id).sort()).toEqual(['custom_abc', 'custom_def']);
  });
});
