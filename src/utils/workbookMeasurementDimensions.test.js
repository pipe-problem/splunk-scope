import { describe, it, expect } from 'vitest';
import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog } from '../services/sizingEngine.js';
import {
  getWorkbookBackedLogOptions,
  hasWorkbookBackedLogChannelOptions,
  hasWorkbookOptionalSecondaryInputs,
} from '../utils/workbookMeasurementDimensions.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const windows = flatCatalog.find((s) => s.id === 'windows_servers');
const storage = flatCatalog.find((s) => s.id === 'storage_prod');
const firewalls = flatCatalog.find((s) => s.id === 'firewalls');

describe('workbookMeasurementDimensions', () => {
  it('windows_servers has workbook-backed log channel toggles', () => {
    expect(hasWorkbookOptionalSecondaryInputs('windows_servers')).toBe(true);
    expect(hasWorkbookBackedLogChannelOptions(windows)).toBe(true);
    const opts = getWorkbookBackedLogOptions(windows);
    expect(opts.length).toBe(5);
    expect(opts.map((o) => o.id)).toEqual(
      expect.arrayContaining([
        'security_event_log',
        'system_event_log',
        'application_event_log',
        'setup_event_log',
        'performance_metrics',
      ]),
    );
    expect(opts.map((o) => o.id)).not.toContain('sysmon');
    expect(opts.map((o) => o.id)).not.toContain('powershell_operational');
  });

  it('storage_prod has workbook secondaries but no log toggles in configure UI', () => {
    expect(hasWorkbookOptionalSecondaryInputs('storage_prod')).toBe(true);
    expect(hasWorkbookBackedLogChannelOptions(storage)).toBe(false);
    expect(getWorkbookBackedLogOptions(storage)).toEqual([]);
  });

  it('firewalls has no workbook multi-dimensional exception', () => {
    expect(hasWorkbookOptionalSecondaryInputs('firewalls')).toBe(false);
    expect(hasWorkbookBackedLogChannelOptions(firewalls)).toBe(false);
  });
});
