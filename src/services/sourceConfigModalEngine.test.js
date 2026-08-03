import { describe, it, expect } from 'vitest';
import { applySourceConfigSave, applySourceConfigReset, isSourceConfigured } from './sourceConfigModalEngine.js';
import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog } from './sizingEngine.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const firewalls = flatCatalog.find((s) => s.id === 'firewalls');

describe('sourceConfigModalEngine', () => {
  it('save sets status to current', () => {
    const saved = applySourceConfigSave({ number_of_systems: 6, vendor: 'Palo Alto Networks' });
    expect(saved.status).toBe('current');
    expect(saved.number_of_systems).toBe(6);
  });

  it('reset clears inputs and sets unknown status', () => {
    const reset = applySourceConfigReset(firewalls);
    expect(reset.status).toBe('unknown');
    expect(reset.number_of_systems).toBe('');
    expect(reset.selectedLogOptions).toEqual({});
  });

  it('isSourceConfigured reflects current status only', () => {
    expect(isSourceConfigured({ status: 'current' })).toBe(true);
    expect(isSourceConfigured({ status: 'future' })).toBe(false);
    expect(isSourceConfigured({ status: 'unknown' })).toBe(false);
  });
});
