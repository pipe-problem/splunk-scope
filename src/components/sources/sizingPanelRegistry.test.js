import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sourceCatalog from '../../data/sources.json';
import { flattenSourceCatalog } from '../../services/sizingEngine.js';
import {
  ADDITIVE_SIZING_STRATEGIES,
  listCompositeSizingSourceIds,
  SIZING_PANEL_BY_SOURCE_ID,
} from './sizingPanelRegistry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const panelSource = readFileSync(resolve(__dirname, 'SourceConfigPanel.jsx'), 'utf8');

const flatCatalog = flattenSourceCatalog(sourceCatalog);

function sourcesWithAdditiveStrategy() {
  return flatCatalog.filter((s) => ADDITIVE_SIZING_STRATEGIES.has(s.sizing_formula?.strategy));
}

describe('sizingPanelRegistry', () => {
  it('maps every additive-strategy catalog source to a panel component', () => {
    const additiveSources = sourcesWithAdditiveStrategy();
    expect(additiveSources.length).toBeGreaterThan(0);
    for (const source of additiveSources) {
      expect(SIZING_PANEL_BY_SOURCE_ID[source.id], `missing panel for ${source.id}`).toBeTruthy();
    }
  });

  it('registry includes all planned composite source IDs', () => {
    const ids = listCompositeSizingSourceIds();
    expect(ids).toEqual(
      expect.arrayContaining([
        'iaas',
        'iaas_instances',
        'iaas_storage',
        'iaas_containers',
        'saas_general',
        'saas_office',
        'saas_crm',
        'saas_sso',
      ]),
    );
  });
});

describe('SourceConfigPanel composite wiring', () => {
  it('imports sizing panel registry and renders composite panel when registered', () => {
    expect(panelSource).toContain('sizingPanelRegistry');
    expect(panelSource).toContain('getSizingPanelForSource');
    expect(panelSource).toContain('hasCompositeSizingPanel');
    expect(panelSource).toContain('CompositeSizingPanel');
    expect(panelSource).toContain('handleCompositeUpdate');
  });
});
