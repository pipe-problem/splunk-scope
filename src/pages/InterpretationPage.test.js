import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(resolve(__dirname, 'InterpretationPage.jsx'), 'utf8');

describe('InterpretationPage (Analysis) customer copy', () => {
  it('does not render GB/day strings in page source', () => {
    expect(pageSource).not.toMatch(/GB\s*\/\s*day/i);
    expect(pageSource).not.toMatch(/gb\/day/i);
    expect(pageSource.toLowerCase()).not.toContain('gb day');
  });

  it('does not show budget hints in the analysis hero', () => {
    expect(pageSource).not.toContain('formatBudgetHint');
    expect(pageSource).not.toContain('budgetHint');
    expect(pageSource).not.toContain('planning budget');
    expect(pageSource).not.toContain('opportunityBudgetUsd');
    expect(pageSource).not.toContain('budgetGbDayOverride');
  });

  it('uses Begin sizing CTA copy', () => {
    expect(pageSource).toContain('Begin sizing');
    expect(pageSource).not.toContain('Size these sources');
  });

  it('uses full-width analysis layout and new section headings', () => {
    expect(pageSource).toContain('page-content-width');
    expect(pageSource).not.toContain('max-w-3xl');
    expect(pageSource).toContain('Your objectives');
    expect(pageSource).toContain('Splunk solutions');
    expect(pageSource).toContain('Priority data sources');
  });

  it('does not use retired draft section labels or duplicate footer CTA', () => {
    expect(pageSource).not.toContain('What we heard');
    expect(pageSource).not.toContain('Splunk apps for your goals');
    expect(pageSource).not.toContain('Recommended apps');
    expect(pageSource).not.toContain('Sources to size next');
    expect(pageSource).not.toContain('Next, capture counts and logging scope');
  });

  it('merges desired and recommended apps with Requested and Suggested tags', () => {
    expect(pageSource).toContain('Requested');
    expect(pageSource).toContain('Suggested');
    expect(pageSource).toContain('mergedSolutions');
  });
});
