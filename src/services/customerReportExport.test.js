/**
 * Customer report export — data builder, HTML deliverables, zip, validation.
 */
import { describe, it, expect } from 'vitest';
import { buildCustomerReportData } from './customerReportDataBuilder.js';
import { sanitizeCustomerReportData, findBannedBudgetLanguageInReport } from './customerReportSanitizer.js';
import {
  validateCustomerReportExport,
  canExportCustomerReport,
} from './customerReportExportValidation.js';
import { buildInteractivePlanningPackHtml } from './interactivePlanningPackBuilder.js';
import {
  buildSeSalesSummaryHtml,
  buildCustomerValuePropositionHtml,
  buildStartupGuideHtml,
  buildPropositionReadmeTxt,
  buildSplunkPropositionPackFiles,
  buildCustomerDeliverableZipFiles,
  hashExportStructure,
  downloadSplunkPropositionPack,
} from './customerDeliverableExportBuilder.js';
import { propositionZipFilename } from './exportShared.js';
import { PROPOSITION_PACK } from './exportDocumentShell.js';
import { getSampleScenarioById } from '../data/sampleScenarios.js';
import { migrateSession, CURRENT_SCHEMA_VERSION } from './sessionMigrationEngine.js';
import { formatIngestGb } from './exportShared.js';
import { BANNED_CUSTOMER_BUDGET_PHRASES, findBannedPromptingLanguageInReport } from '../constants/customerFacingCopy.js';

function scenarioToState(scenario, overrides = {}) {
  const explicitPath = scenario.selectedPlanIndex != null;
  const planIndex = explicitPath ? scenario.selectedPlanIndex : 1;
  return migrateSession({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    currentStep: 6,
    intake: scenario.intake,
    sources: scenario.sources,
    selectedPlanIndex: planIndex,
    reportPathExplicit: explicitPath || true,
    suppressPathRecommendation: scenario.suppressPathRecommendation ?? false,
    overlapDecisions: scenario.overlapDecisions || {},
    interpretation: scenario.interpretation || null,
    ...overrides,
  });
}

function buildReportFromScenario(scenarioId = 'robbins_retail_hybrid', overrides = {}) {
  const scenario = getSampleScenarioById(scenarioId);
  expect(scenario).toBeTruthy();
  const { state } = scenarioToState(scenario, overrides);
  expect(state).toBeTruthy();
  const raw = buildCustomerReportData(state, { hideZeroUnconfigured: true });
  return { raw, data: sanitizeCustomerReportData(raw), state };
}

function assertIngestMatchesReport(html, data) {
  const expected = formatIngestGb(data.pathDetail?.ingestSummary?.expected ?? data.ingestSummary.expected);
  const low = formatIngestGb(data.pathDetail?.ingestSummary?.low ?? data.ingestSummary.low);
  const high = formatIngestGb(data.pathDetail?.ingestSummary?.high ?? data.ingestSummary.high);
  expect(html).toContain(expected);
  expect(html).toContain(low);
  expect(html).toContain(high);
}

describe('customerReportDataBuilder', () => {
  it('creates complete report data from session', () => {
    const { data } = buildReportFromScenario();
    expect(data.customer).toBeTruthy();
    expect(data.selectedPath).toBeTruthy();
    expect(data.hasReportPath).toBe(true);
    expect(data.pathDetail).toBeTruthy();
    expect(data.pathDetail.pathPhase).toBeTruthy();
    expect(data.pathDetail.maturityOpportunities).toBeInstanceOf(Array);
    expect(data.pathDetail.appsPowered?.length).toBeGreaterThan(0);
    expect(data.pathDetail.valueDelivered?.length).toBeGreaterThan(0);
    expect(data.pathDetail.sourcesIncluded?.length).toBeGreaterThan(0);
    expect(data.ingestSummary).toMatchObject({
      low: expect.any(Number),
      expected: expect.any(Number),
      high: expect.any(Number),
    });
    expect(data.coverageSummary.score).toBeGreaterThanOrEqual(0);
    expect(data.overview).toBeTruthy();
    expect(data.recommendedProducts).toBeTruthy();
    expect(data.productRecommendations?.compactItems?.length).toBeGreaterThan(0);
    expect(data.sourceGroups).toBeInstanceOf(Array);
    expect(data.assumptions).toBeTruthy();
    expect(data.startupSourcesOrdered?.length).toBeGreaterThan(0);
  });

  it('Robbins scenario has no path until reportPathExplicit selection', () => {
    const scenario = getSampleScenarioById('robbins_retail_hybrid');
    const { state } = scenarioToState(scenario, {
      selectedPlanIndex: null,
      reportPathExplicit: false,
    });
    const raw = buildCustomerReportData(state);
    expect(raw.hasReportPath).toBe(false);
    expect(raw.selectedPath).toBe('');
    expect(raw.pathDetail).toBeNull();
    expect(raw.internalSalesSummary.talkTracks).toEqual([]);
  });

  it('strips internal sales summary from sanitized export data', () => {
    const { raw, data } = buildReportFromScenario();
    expect(raw.internalSalesSummary?.talkTracks?.length).toBeGreaterThan(0);
    expect(data.internalSalesSummary).toBeUndefined();
  });

  it('sanitized report contains no banned budget language', () => {
    const { data } = buildReportFromScenario();
    expect(findBannedBudgetLanguageInReport(data)).toEqual([]);
  });

  it('sanitized report contains no banned prompting language', () => {
    const { data } = buildReportFromScenario();
    expect(findBannedPromptingLanguageInReport(data)).toEqual([]);
  });

  it('customer HTML exports contain no banned prompting language', () => {
    const { data } = buildReportFromScenario();
    const files = buildSplunkPropositionPackFiles(data);
    for (const [name, content] of Object.entries(files)) {
      if (!name.endsWith('.html')) continue;
      expect(content, name).not.toMatch(/Ask the customer|Follow-on phase|Solution fit|talk track/i);
      expect(content, name).not.toMatch(/customer-value-proposition|Customer Snapshot/i);
      expect(content, name).toContain('doc-brand');
      expect(content, name).toContain('Splunk Scope');
    }
  });
});

describe('customerDeliverableExportBuilder', () => {
  it('builds proposition pack with README and two HTML reports', () => {
    const { data } = buildReportFromScenario();
    const files = buildSplunkPropositionPackFiles(data);

    expect(Object.keys(files).sort()).toEqual([
      PROPOSITION_PACK.readme,
      PROPOSITION_PACK.startupGuide,
      PROPOSITION_PACK.valueProposition,
    ]);
    expect(Object.keys(files).join(' ')).not.toMatch(/customer/i);

    const vp = files[PROPOSITION_PACK.valueProposition];
    expect(vp).toContain('What this delivers');
    expect(vp).toContain('Splunk apps powered');
    expect(vp).toContain('report-preview');
    expect(vp).toContain('card-compact');
    expect(vp).toContain('ingest-kpi-grid');
    expect(vp).not.toContain('Readiness');
    expect(vp).toContain('doc-brand');
    expect(vp).not.toMatch(/formula|equation/i);
    expect(vp).not.toMatch(/Solution fit|Follow-on phase|Outcomes/i);

    const sg = files[PROPOSITION_PACK.startupGuide];
    expect(sg).toContain('Startup summary');
    expect(sg).not.toContain('Week-by-week');
    expect(sg).toContain('Source onboarding');
    expect(sg).toContain('Validation search');
    expect(sg).toContain('spl-block');
    expect(sg).toContain('week-accordion');
    expect(sg).not.toContain('>current<');

    const readme = files[PROPOSITION_PACK.readme];
    expect(readme).toContain('SPLUNK SCOPE PLANNING PACK');
    expect(readme).toContain('value-proposition.html');
    expect(readme).toMatch(/Google Chrome/i);
    expect(readme).not.toMatch(/internal|se-sales/i);
  });

  it('builds SE bundle with internal summary plus proposition pack', () => {
    const { raw, data } = buildReportFromScenario();
    const files = buildCustomerDeliverableZipFiles(raw, data);

    expect(Object.keys(files).sort()).toEqual([
      PROPOSITION_PACK.readme,
      'se-sales-summary.html',
      PROPOSITION_PACK.startupGuide,
      PROPOSITION_PACK.valueProposition,
    ]);

    expect(files['se-sales-summary.html']).toContain('Internal — Splunk sales / SE use only');
    expect(files['se-sales-summary.html']).toContain('Talk tracks');
    expect(files['se-sales-summary.html']).toContain('Overlap notes');
    expect(files['se-sales-summary.html']).toContain('Missing analysis priorities');
  });

  it('reconciles GB/day numbers with in-app report data', () => {
    const { raw, data } = buildReportFromScenario();
    const files = buildCustomerDeliverableZipFiles(raw, data);

    assertIngestMatchesReport(files[PROPOSITION_PACK.valueProposition], data);
    assertIngestMatchesReport(files[PROPOSITION_PACK.startupGuide], data);
    assertIngestMatchesReport(files['se-sales-summary.html'], raw);
  });

  it('HTML deliverables exclude budget language; SE summary retains internal budget context', () => {
    const { raw, data } = buildReportFromScenario();
    const files = buildCustomerDeliverableZipFiles(raw, data);
    for (const name of [PROPOSITION_PACK.valueProposition, PROPOSITION_PACK.startupGuide, PROPOSITION_PACK.readme]) {
      expect(files[name], name).not.toMatch(BANNED_CUSTOMER_BUDGET_PHRASES);
    }
    expect(files['se-sales-summary.html']).toMatch(/Budget context|Opportunity budget/i);
  });

  it('uses dark standalone CSS with CAST accent gradient and no localhost dependencies', () => {
    const { raw, data } = buildReportFromScenario();
    const files = buildCustomerDeliverableZipFiles(raw, data);

    for (const [name, content] of Object.entries(files)) {
      if (!name.endsWith('.html')) continue;
      expect(content).toContain('--bg: #050505');
      expect(content).toContain('#F04E98');
      expect(content).toContain('#FF7A1A');
      expect(content).toContain('linear-gradient(90deg, #F04E98 0%, #FF7A1A 55%, #FFD84D 100%)');
      expect(content).toContain('fonts.googleapis.com');
      if (name !== 'se-sales-summary.html') {
        expect(content).toContain('card-compact');
        expect(content).toContain('app-link');
      }
      expect(content.toLowerCase()).not.toContain('localhost');
      expect(content).not.toContain('127.0.0.1');
      expect(content).not.toContain('/src/');
    }
  });

  it('proposition pack excludes internal SE summary', () => {
    const { data } = buildReportFromScenario();
    const files = buildSplunkPropositionPackFiles(data);
    expect(Object.keys(files)).not.toContain('se-sales-summary.html');
    expect(files[PROPOSITION_PACK.readme]).not.toMatch(/internal|se-sales/i);
    expect(files[PROPOSITION_PACK.valueProposition]).toContain('--accent-gradient');
  });

  it('produces stable structure hash for value proposition HTML', () => {
    const { data } = buildReportFromScenario();
    const html1 = buildCustomerValuePropositionHtml(data);
    const html2 = buildCustomerValuePropositionHtml(data);
    expect(hashExportStructure(html1)).toBe(hashExportStructure(html2));
  });

  it('README uses plain-language Chrome open instructions', () => {
    const { data } = buildReportFromScenario();
    const readme = buildPropositionReadmeTxt(data);
    expect(readme).toContain('SPLUNK SCOPE PLANNING PACK');
    expect(readme).toMatch(/Google Chrome/i);
    expect(readme).toMatch(/Extract All|double-click/i);
    expect(readme).toContain('Save as PDF');
    expect(readme).toContain('Splunk account team');
    expect(readme).not.toMatch(/internal|se-sales/i);
    expect(readme).toContain(data.customer);
  });

  it('zip filename uses organization slug and splunk_proposition suffix', () => {
    const { data } = buildReportFromScenario();
    expect(propositionZipFilename(data.customer)).toMatch(/_splunk_proposition\.zip$/);
    expect(propositionZipFilename(data.customer)).not.toMatch(/customer/i);
    expect(propositionZipFilename(data.customer)).toContain('Chuck_Robbins');
  });
});

describe('interactivePlanningPackBuilder', () => {
  it('includes Overview, Sources, and Startup Guide tabs', () => {
    const { data } = buildReportFromScenario();
    const { html } = buildInteractivePlanningPackHtml(data);
    expect(html).toContain('data-pack-tab="overview"');
    expect(html).toContain('data-pack-tab="sources"');
    expect(html).toContain('data-pack-tab="guide"');
    expect(html).toContain('data-pack-panel="overview"');
    expect(html).toContain('data-pack-panel="sources"');
    expect(html).toContain('data-pack-panel="guide"');
  });

  it('uses live Report page styling and copy', () => {
    const { data } = buildReportFromScenario();
    const { html } = buildInteractivePlanningPackHtml(data);
    expect(html).toContain('pack-tab');
    expect(html).toContain('pack-customer-name');
    expect(html).toContain('pack-use-case-chip');
    expect(html).toContain('report-kpi-strip');
    expect(html).toContain('What this delivers');
    expect(html).toContain('Ingest mix (top sources)');
    expect(html).toContain('Recommended Splunk products');
    expect(html).toContain('pack-source-row');
    expect(html).toContain('var(--cast-accent)');
    expect(html).toContain('data-theme="dark"');
  });

  it('omits Next steps accordion from customer export overview', () => {
    const { data } = buildReportFromScenario();
    const { html } = buildInteractivePlanningPackHtml(data);
    expect(html).not.toContain('Next steps');
  });

  it('includes tab and accordion interaction scripts', () => {
    const { data } = buildReportFromScenario();
    const { html } = buildInteractivePlanningPackHtml(data);
    expect(html).toContain('data-pack-tab');
    expect(html).toContain('pack-source-row');
    expect(html).toContain('pack-view-all-products');
    expect(html).toContain('report-accordion');
  });

  it('does not include localhost', () => {
    const { data } = buildReportFromScenario();
    const { html } = buildInteractivePlanningPackHtml(data);
    expect(html.toLowerCase()).not.toContain('localhost');
    expect(html).not.toContain('127.0.0.1');
  });

  it('does not include app sidebar or Save and Quit', () => {
    const { data } = buildReportFromScenario();
    const { html } = buildInteractivePlanningPackHtml(data);
    expect(html).not.toContain('Save and Quit');
    expect(html).not.toContain('WorkflowStepIndicator');
    expect(html).not.toContain('page-header');
  });

  it('uses customer-safe filename pattern', () => {
    const { data } = buildReportFromScenario();
    const { filename } = buildInteractivePlanningPackHtml(data);
    expect(filename).toMatch(/^[\w-]+_splunk_scoping_package\.html$/);
    expect(filename).toContain('Chuck_Robbins');
  });
});

describe('customerReportExportValidation', () => {
  it('catches undefined and [object Object]', () => {
    const bad = {
      customer: 'Test',
      selectedPath: 'Crawl',
      overview: { deliveryBullets: ['undefined value here'] },
      sourceGroups: [{ category: 'Net', sources: [] }],
      ingestSummary: { low: 1, expected: 2, high: 3 },
      coverageSummary: { score: 50, sourceCount: 1 },
    };
    const v = validateCustomerReportExport(bad);
    expect(v.critical.some((c) => /undefined/i.test(c))).toBe(true);

    const badObj = {
      ...bad,
      overview: { deliveryBullets: ['[object Object]'] },
    };
    const v2 = validateCustomerReportExport(badObj);
    expect(v2.critical.some((c) => /object Object/i.test(c))).toBe(true);
  });

  it('catches duplicate GB/day labels', () => {
    const v = validateCustomerReportExport({
      customer: 'Test',
      selectedPath: 'Run',
      overview: { deliveryBullets: ['10 GB/day GB/day'] },
      sourceGroups: [{ category: 'X', sources: [{ name: 'A', ingest: { expected: 1 } }] }],
      ingestSummary: { low: 1, expected: 2, high: 3 },
      coverageSummary: { score: 80, sourceCount: 1 },
    });
    expect(v.critical.some((c) => /GB\/day/i.test(c))).toBe(true);
  });

  it('catches internal-only fields', () => {
    const v = validateCustomerReportExport({
      customer: 'Test',
      selectedPath: 'Crawl',
      overview: { deliveryBullets: ['opportunityBudgetUsd noted'] },
      sourceGroups: [],
      ingestSummary: { low: 0, expected: 0, high: 0 },
      coverageSummary: { score: 0, sourceCount: 0 },
    });
    expect(v.critical.some((c) => /internal/i.test(c))).toBe(true);
  });

  it('passes valid sanitized report data', () => {
    const { data } = buildReportFromScenario();
    const v = validateCustomerReportExport(data);
    expect(canExportCustomerReport(v)).toBe(true);
    expect(v.critical).toHaveLength(0);
  });

  it('blocks missing customer name', () => {
    const { data } = buildReportFromScenario();
    data.customer = '';
    const v = validateCustomerReportExport(data);
    expect(canExportCustomerReport(v)).toBe(false);
  });
});

describe('customer report data coverage', () => {
  it('includes sequential section content for all three report areas', () => {
    const { data } = buildReportFromScenario();
    expect(data.overview.deliveryBullets?.length).toBeGreaterThan(0);
    expect(data.sourceGroups.length).toBeGreaterThan(0);
    expect(data.startupGuide?.onboardingSources?.length).toBeGreaterThan(0);
    expect(data.pathDetail.gaps).toBeInstanceOf(Array);
    const productCount =
      (data.recommendedProducts.recommendedSolutions?.length || 0) +
      (data.recommendedProducts.helpfulApps?.length || 0) +
      (data.recommendedProducts.technicalAddons?.length || 0);
    expect(productCount).toBeGreaterThan(0);
  });

  it('excludes unconfigured zero-ingest sources by default', () => {
    const { data } = buildReportFromScenario();
    for (const group of data.sourceGroups) {
      for (const src of group.sources) {
        expect(src.ingest.expected > 0 || src.configured).toBe(true);
      }
    }
  });
});
