import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listCompositeSizingSourceIds,
  SIZING_PANEL_BY_SOURCE_ID,
} from './sizingPanelRegistry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const panelSource = readFileSync(resolve(__dirname, 'SourceConfigPanel.jsx'), 'utf8');

describe('sizingPanelRegistry', () => {
  it('retains composite panel components for advanced sizing engines', () => {
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
    for (const id of ids) {
      expect(SIZING_PANEL_BY_SOURCE_ID[id], `missing panel for ${id}`).toBeTruthy();
    }
  });
});

describe('SourceConfigPanel configure UX', () => {
  it('does not mount composite sizing panels in the default configure flow', () => {
    expect(panelSource).not.toContain('sizingPanelRegistry');
    expect(panelSource).not.toContain('getSizingPanelForSource');
    expect(panelSource).not.toContain('hasCompositeSizingPanel');
    expect(panelSource).not.toContain('handleCompositeUpdate');
  });
});
