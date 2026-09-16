import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sampleScenarios from '../data/sampleScenarios.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(resolve(__dirname, 'IntakePage.jsx'), 'utf8');
const robbins = sampleScenarios.find((s) => s.id === 'robbins_retail_hybrid');

describe('IntakePage simplified UX', () => {
  it('shows only core intake sections on the main scroll', () => {
    expect(pageSource).toContain('Cursor-assisted import');
    expect(pageSource).toContain('Customer');
    expect(pageSource).toContain('Budget');
    expect(pageSource).toContain('Apps');
    expect(pageSource).toContain('Path targets');
  });

  it('includes Cursor import workflow and AI summary card', () => {
    expect(pageSource).toContain('Copy Cursor Extraction Prompt');
    expect(pageSource).toContain('Process Cursor Output');
    expect(pageSource).toContain('AiImportSummaryCard');
    expect(pageSource).toContain('Sources to apply');
    expect(pageSource).toContain('editCount');
    expect(pageSource).toContain('splunk-scope-import');
  });

  it('does not render removed sections or example profile panel', () => {
    expect(pageSource).not.toContain('ExampleProfilePanel');
    expect(pageSource).not.toContain('Data & source notes');
    expect(pageSource).not.toContain('Crawl / Walk / Run maturity presets');
    expect(pageSource).not.toMatch(/title="Goals"/);
  });

  it('gates advanced intake behind ADVANCED_INTAKE flag', () => {
    expect(pageSource).toContain('ADVANCED_INTAKE');
  });

  it('uses wider layout and neutral example control styling', () => {
    expect(pageSource).toContain('page-content-width--intake');
    expect(pageSource).not.toContain('max-w-3xl');
    expect(pageSource).toContain("toast.success('Example loaded')");
    expect(pageSource).not.toMatch(/isExampleActive \? 'bg-\[var\(--cast-accent\)\] text-white'/);
  });

  it('robbins example intake includes customer name for load', () => {
    expect(robbins).toBeTruthy();
    expect(robbins.intake.customerName).toMatch(/Chuck Robbins/i);
    expect(robbins.intake.pathBudgetPercentages).toEqual({ crawl: 80, walk: 100, run: 110 });
  });
});
