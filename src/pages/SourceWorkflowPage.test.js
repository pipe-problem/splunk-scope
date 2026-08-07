import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(resolve(__dirname, 'SourceWorkflowPage.jsx'), 'utf8');
const cardSource = readFileSync(resolve(__dirname, '../components/sources/SourceGridCard.jsx'), 'utf8');
const panelSource = readFileSync(resolve(__dirname, '../components/sources/SourceConfigPanel.jsx'), 'utf8');
const intelSource = readFileSync(resolve(__dirname, '../components/sources/SourceIntelSections.jsx'), 'utf8');
const moreInfoSource = readFileSync(resolve(__dirname, '../components/sources/SourceMoreInfoPanel.jsx'), 'utf8');

describe('SourceWorkflowPage redesign', () => {
  it('does not render TopSuggestedSources or GB/day on workflow page', () => {
    expect(pageSource).not.toContain('TopSuggestedSources');
    expect(pageSource).not.toMatch(/GB\s*\/\s*day/i);
    expect(pageSource).not.toContain('formatIngestString');
  });

  it('gates relevance on intake readiness', () => {
    expect(pageSource).toContain('isIntakeReadyForSourceRelevance');
    expect(pageSource).toContain('showRelevance={intakeReady}');
    expect(pageSource).toContain('intakeReady={intakeReady}');
  });

  it('sorts by relevance only when intake is ready', () => {
    expect(pageSource).toContain('sortSourcesForGrid');
    expect(pageSource).toContain('intakeReady');
  });

  it('uses in-page SourceConfigPanel instead of full-screen modal', () => {
    expect(pageSource).toContain('SourceConfigPanel');
    expect(pageSource).not.toContain('SourceConfigModal');
    expect(pageSource).not.toContain('function ConfigDrawer');
    expect(pageSource).toContain('panelAnchorRect');
  });

  it('supports URL deep link and pending navigation', () => {
    expect(pageSource).toContain("params.get('source')");
    expect(pageSource).toContain('pendingSourceNavigation');
  });

  it('sorts by relevance and configured state', () => {
    expect(pageSource).toContain('sortSourcesForGrid');
    expect(pageSource).toContain('relevanceScore1to10');
  });

  it('uses alias search engine', () => {
    expect(pageSource).toContain('searchSourceCatalog');
  });
});

describe('SourceGridCard customer view', () => {
  it('card click toggles panel and shows Configure or Edit footer', () => {
    expect(cardSource).toContain('showRelevance');
    expect(cardSource).toContain('relevanceScore1to10');
    expect(cardSource).toContain('onToggle');
    expect(cardSource).toContain('role="button"');
    expect(cardSource).not.toMatch(/GB\s*\/\s*day/i);
    expect(cardSource).not.toContain('RelevanceReviewBadge');
    expect(cardSource).not.toContain('whyOneLine');
    expect(cardSource).toContain('customerSummary');
    expect(cardSource).toContain('source.description');
    expect(cardSource).toContain('formatConfiguredSourceSummary');
    expect(cardSource).not.toContain('onConfigure');
    expect(cardSource).not.toContain('btn-primary');
    expect(cardSource).toContain("'Edit'");
    expect(cardSource).toContain("'Configure'");
    expect(cardSource).not.toContain('Click to configure');
    expect(cardSource).not.toContain('Click to edit');
  });
});

describe('SourceConfigPanel', () => {
  it('save sets configured status without ingest display', () => {
    expect(panelSource).toContain('applySourceConfigSave');
    expect(panelSource).not.toMatch(/GB\s*\/\s*day/i);
    expect(panelSource).toContain('customerSummary');
    expect(panelSource).toContain('showRelevance');
    expect(panelSource).toContain('Configured');
    expect(panelSource).toContain('Not configured');
    expect(panelSource).toContain('anchorRect');
    expect(panelSource).toContain('<Check');
  });

  it('uses wide single-column scroll layout with sizing section above more info', () => {
    expect(panelSource).toContain('w-[min(92vw,68rem)]');
    expect(panelSource).not.toContain('lg:flex-row');
    expect(panelSource).toContain('source-config-section');
    expect(panelSource).toContain('overflowAppCount');
    expect(panelSource).toContain('fieldLabelRepeatsQuestion');
    expect(panelSource).toContain('sizingPanelRegistry');
  });

  it('uses SourceMoreInfoPanel instead of details text wall', () => {
    expect(panelSource).toContain('SourceMoreInfoPanel');
    expect(panelSource).not.toContain('<details');
  });
});

describe('SourceMoreInfoPanel', () => {
  it('delegates to SourceIntelSections with overlap enabled', () => {
    expect(moreInfoSource).toContain('SourceIntelSections');
    expect(moreInfoSource).toContain('showOverlap');
  });

  it('SourceIntelSections renders full-width info blocks, telemetry bars, and sample log', () => {
    expect(intelSource).toContain('What it is');
    expect(intelSource).toContain('Telemetry domains');
    expect(intelSource).toContain('Sample log');
    expect(intelSource).not.toContain('limitWords');
    expect(intelSource).not.toContain('<details');
    expect(intelSource).toContain('InfoBlock');
    expect(intelSource).toContain('md:grid-cols-2');
    expect(intelSource).toContain('SourceOverlapSection');
  });
});
