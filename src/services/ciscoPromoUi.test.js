import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Cisco promo UI wiring', () => {
  it('shows promo banner on source config when Cisco vendor is selected', () => {
    const panel = readFileSync(resolve(__dirname, '../components/sources/SourceConfigPanel.jsx'), 'utf8');
    expect(panel).toContain('CiscoIngestPromoBanner');
  });

  it('shows strikethrough ingest on Review and Report', () => {
    const review = readFileSync(resolve(__dirname, '../pages/ReviewPage.jsx'), 'utf8');
    const report = readFileSync(resolve(__dirname, '../components/report/ReportDeliverablePreview.jsx'), 'utf8');
    expect(review).toContain('CiscoPromoIngestValue');
    expect(review).toContain('totals.gross');
    expect(report).toContain('CiscoPromoIngestValue');
  });
});
