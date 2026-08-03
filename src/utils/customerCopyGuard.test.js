import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BANNED_CUSTOMER_COPY } from './displayLabels.js';

const CUSTOMER_SURFACE_FILES = [
  '../pages/IntakePage.jsx',
  '../pages/InterpretationPage.jsx',
  '../pages/SourceWorkflowPage.jsx',
  '../pages/ReviewPage.jsx',
  '../pages/PlansPage.jsx',
  '../pages/ReportPage.jsx',
  '../components/report/ReportDeliverablePreview.jsx',
  '../components/report/CustomerPlanningPackView.jsx',
  '../components/sources/SourceGridCard.jsx',
  '../services/sourceRecommendationEngine.js',
];

describe('customer-facing copy guard', () => {
  it('shared layout utility exists for workflow scroll regions', async () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    expect(css).toContain('.page-content-width');
    expect(css).toContain('max-width: 72rem');
    expect(css).toContain('.page-content-width--intake');
    expect(css).toContain('max-width: 56rem');
  });

  for (const rel of CUSTOMER_SURFACE_FILES) {
    it(`does not expose banned copy in ${rel.split('/').pop()}`, () => {
      const source = readFileSync(new URL(rel, import.meta.url), 'utf8');
      for (const banned of BANNED_CUSTOMER_COPY) {
        expect(source, `found banned phrase "${banned}"`).not.toContain(banned);
      }
    });
  }

  it('customerFacingCopy constants define ingest labels without budget language', async () => {
    const mod = await import('../constants/customerFacingCopy.js');
    expect(mod.TOTAL_INGEST_LABEL).toBe('Total configured source ingest');
    expect(mod.RANGE_CAPTION).toBe('±20% estimate range');
    expect(String(mod.TOTAL_INGEST_LABEL)).not.toMatch(/budget/i);
    expect(String(mod.RANGE_CAPTION)).not.toMatch(/budget/i);
  });
});
