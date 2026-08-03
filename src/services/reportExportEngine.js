/**
 * Customer-facing PDF and PowerPoint export from report session data.
 * Uses the same payload as the Report page — no independent recalculation of totals.
 */
import splunkAppsCatalog from '../data/splunkApps.json' with { type: 'json' };
import installGuidance from '../data/splunkInstallationGuidance.json' with { type: 'json' };
import { buildYearOneDeploymentPlan } from './yearOnePlanEngine.js';
import { recommendApps } from './appRecommendationEngine.js';
import { getAppCatalogEntry } from './appCatalogService.js';
import { buildStructuredPlanRisks } from '../data/pathRiskMitigations.js';
import { buildValueProposalDocument, buildValueProposalSlideDeck } from './valueProposalExportBuilder.js';
import { buildStartupGuideDocument } from './startupGuideExportBuilder.js';
import { buildCustomerPlanningPackDocument } from './customerPlanningPackBuilder.js';
import { renderValueProposalPdf, renderStartupGuidePdf, renderCustomerPlanningPackPdf } from './exportPdfRenderer.js';
import { renderValueProposalPptx } from './pptxExportBuilder.js';
import {
  validateExportContent,
  validateValueProposalContent,
  validateStartupGuideContent,
  validatePptxDeck,
} from './exportValidationEngine.js';
import {
  EXPORT_DISCLAIMER_FULL,
  EXPORT_DISCLAIMER_SHORT,
  EXPORT_OFFICIAL_LINKS,
} from './exportConstants.js';
import {
  sanitizeCustomerFacingText,
  formatIngestGb,
  formatIngestRange,
  formatIngestRangeWithUnit,
  formatIngestWithUnit,
  truncate,
  toReadableString,
} from './exportShared.js';

export { EXPORT_DISCLAIMER_FULL, EXPORT_DISCLAIMER_SHORT, EXPORT_OFFICIAL_LINKS };
export {
  sanitizeCustomerFacingText,
  formatIngestGb,
  formatIngestRange,
  formatIngestRangeWithUnit,
  formatIngestWithUnit,
  truncate,
  toReadableString,
} from './exportShared.js';
export {
  validateExportContent,
  validateValueProposalContent,
  validateStartupGuideContent,
  validatePptxDeck,
};

const GENERIC_VALUE_PROP = /enriches telemetry across \d+ domain\(s\)/i;

const DEPLOYMENT_LABELS = {
  cloud: 'Splunk Cloud Platform',
  onprem: 'Customer-managed Splunk Enterprise',
  hybrid: 'Hybrid (Splunk Cloud + on-premises collection)',
};

const STARTUP_PHASE_CARDS = [
  { key: 'prepare', title: 'Prepare', match: /preparation|discovery|week 0/i },
  { key: 'onboard', title: 'Onboard', match: /onboarding|foundational|week 1/i },
  { key: 'validate', title: 'Validate', match: /validat|confirm|week 2|week 3/i },
  { key: 'expand', title: 'Expand', match: /expand|phase 2|future|week 4/i },
];

const APP_NAME_BY_ID = (() => {
  const map = {};
  for (const group of splunkAppsCatalog) {
    for (const app of group.apps || []) {
      map[app.id] = app.name;
    }
  }
  return map;
})();

function sanitizeIntakeForCustomer(intake = {}) {
  const copy = { ...intake };
  delete copy.opportunityBudgetUsd;
  delete copy.budgetNotes;
  delete copy.internalBudget;
  return copy;
}

function pathLabel(plan, fallback = '-') {
  return plan?.displayLabel || plan?.name || fallback;
}

/** Short path label for PDF tables (Crawl / Walk / Run). */
export function shortPathLabel(plan) {
  const name = plan?.name || '';
  if (['Crawl', 'Walk', 'Run'].includes(name)) return name;
  if (plan?.pathPhase === 'crawl') return 'Crawl';
  if (plan?.pathPhase === 'walk') return 'Walk';
  if (plan?.pathPhase === 'run') return 'Run';
  const short = String(name).split(/\s[-—]\s/)[0]?.trim();
  return short || name || 'Path';
}

function resolveAppNames(appIds = []) {
  return appIds.map((id) => {
    const entry = getAppCatalogEntry(id);
    if (entry?.displayName) return entry.displayName;
    return APP_NAME_BY_ID[id] || id.replace(/_/g, ' ');
  });
}

function summarizeProductRecommendations(rec) {
  if (!rec) {
    return {
      recommendedSolutions: [],
      helpfulApps: [],
      technicalAddons: [],
      dependencies: [],
      primarySummary: '',
      recommendedSolutionsLine: '',
      technicalAddonsLine: '',
      dependenciesLine: '',
    };
  }
  const mapItem = (item) => ({
    name: item.displayName,
    type: item.type,
    phase: item.phase,
    reason: sanitizeCustomerFacingText(item.customerReason),
  });
  const recommendedSolutions = (rec.recommendedSolutions || [])
    .filter((r) => r.customerVisible)
    .map(mapItem);
  const helpfulApps = (rec.helpfulApps || []).filter((r) => r.customerVisible).map(mapItem);
  const technicalAddons = (rec.technicalAddons || []).filter((r) => r.customerVisible).map(mapItem);
  const dependencies = (rec.dependencies || []).filter((r) => r.customerVisible).map(mapItem);
  const recommendedSolutionsLine = recommendedSolutions.map((r) => r.name).join(', ');
  const technicalAddonsLine = technicalAddons.slice(0, 8).map((r) => r.name).join(', ');
  const dependenciesLine = dependencies.map((r) => r.name).join(', ');
  return {
    recommendedSolutions,
    helpfulApps,
    technicalAddons,
    dependencies,
    primarySummary: sanitizeCustomerFacingText(rec.primaryRecommendationSummary || ''),
    recommendedSolutionsLine,
    technicalAddonsLine,
    dependenciesLine,
  };
}

const VALUE_GROUP_RULES = [
  { group: 'Identity and Access', pattern: /identity|authentication|active directory|sso|pam|iam|entra|domain controller|user auth/i },
  { group: 'Endpoint and Server', pattern: /endpoint|server|desktop|edr|linux|windows|workstation|virtual/i },
  { group: 'Network and Perimeter', pattern: /network|firewall|vpn|dns|dhcp|router|switch|perimeter|wan|sd-wan|proxy|load balancer/i },
  { group: 'Email / SaaS / Cloud', pattern: /email|saas|cloud|office|365|web app|application|collaboration|storage/i },
  { group: 'Risk and Context', pattern: /vuln|threat|cmdb|asset|risk|compliance|intel|inventory/i },
];

const DEFAULT_BUSINESS_OUTCOMES = [
  'Centralized visibility across identity, endpoint, network, and cloud telemetry',
  'Faster investigations by reducing tool switching and correlating related events',
  'Better risk prioritization by connecting vulnerabilities, identities, and detections',
  'Stronger compliance evidence collection through retained, searchable audit trails',
  'Improved security maturity through a phased, measurable rollout',
];

const LINK_PURPOSES = {
  system_requirements: 'Validate OS, CPU, memory, and storage before Enterprise deployment.',
  reference_hardware: 'Baseline indexer and search head sizing for on-premises planning.',
  install_linux: 'Install Splunk Enterprise on Linux hosts.',
  install_windows: 'Install Splunk Enterprise on Windows servers.',
  cloud_uf_forwarding: 'Configure Universal Forwarders to send data to Splunk Cloud.',
  cloud_uf_credentials: 'Install Splunk Cloud UF credentials on forwarders.',
  install_windows_uf: 'Deploy Windows Universal Forwarder agents.',
  uf_download: 'Download Universal Forwarder installers.',
  apps_addons_overview: 'Understand apps and add-ons for parsing and dashboards.',
  indexes_conf: 'Plan indexes, retention, and routing.',
};

function assignValueGroup(row) {
  const haystack = `${row.name} ${row.category || ''} ${row.subcategory || ''}`;
  for (const rule of VALUE_GROUP_RULES) {
    if (rule.pattern.test(haystack)) return rule.group;
  }
  return 'Other telemetry';
}

export function buildValueGroups(sourceRows) {
  const groups = {};
  for (const row of sourceRows || []) {
    const group = assignValueGroup(row);
    if (!groups[group]) {
      groups[group] = { name: group, sources: [], totalIngest: 0, apps: new Set() };
    }
    groups[group].sources.push(row);
    groups[group].totalIngest += row.ingestRange?.expected ?? row.ingest?.expected ?? 0;
    for (const app of row.splunkApps || []) groups[group].apps.add(app);
  }
  return Object.values(groups).map((g) => ({
    ...g,
    apps: [...g.apps].slice(0, 5),
    totalIngestLabel: formatIngestWithUnit(g.totalIngest),
    sourceNames: g.sources.map((s) => s.name),
    valueSummary: g.sources.map((s) => s.whyIncluded).filter(Boolean).slice(0, 2).join(' '),
    needsReview: g.sources.some((s) => s.needsReview),
  }));
}

function buildBusinessOutcomes(useCases, sourceRows) {
  const outcomes = new Set(DEFAULT_BUSINESS_OUTCOMES.slice(0, 3));
  const domains = new Set();
  for (const row of sourceRows || []) {
    for (const cat of row.valueProp?.categories || []) {
      if (cat === 'security') outcomes.add('Stronger threat detection and investigation across security telemetry');
      if (cat === 'observability') outcomes.add('Improved service reliability and performance visibility');
      if (cat === 'business') outcomes.add('Better compliance and audit evidence for stakeholders');
    }
  }
  if ((useCases || []).some((u) => /compliance|audit/i.test(u.name))) {
    outcomes.add('Stronger compliance evidence collection');
  }
  return [...outcomes].slice(0, 5);
}

function buildChallengeNarrative(intake, useCases, selectedPlan) {
  const parts = [];
  if (intake?.discoveryNotes?.trim()) {
    parts.push(sanitizeCustomerFacingText(intake.discoveryNotes.trim()));
  }
  if (intake?.walkGoal?.trim()) {
    parts.push(`Planning goal: ${sanitizeCustomerFacingText(intake.walkGoal.trim())}`);
  }
  if (!parts.length && useCases?.length) {
    parts.push(`Current operations require visibility across ${useCases.slice(0, 3).map((u) => u.name).join(', ')} without switching between disconnected tools.`);
  }
  parts.push(`The ${selectedPlan?.name || 'selected'} path enables phased onboarding with measurable coverage and ingest targets.`);
  return parts.join(' ');
}

function buildValidationEntries(sourceRows, startupGuide) {
  return (sourceRows || []).map((row) => {
    const guide = startupGuide?.sources?.find((s) => s.id === row.id);
    const rawSpl = guide?.validation || row.guideValidation || '';
    const isTemplate = !rawSpl || rawSpl.includes('<source_index>') || rawSpl.includes('index={');
    const splExample = isTemplate
      ? rawSpl.replace('<source_index>', 'main').replace('{index}', 'main') || `index=main sourcetype=* | stats count by sourcetype, host | head 20`
      : rawSpl;
    return {
      sourceName: row.name,
      purpose: `Confirm ${row.name} data is arriving with expected sourcetypes and fields.`,
      splExample,
      isExample: isTemplate,
      expectedSignal: `Recent events from ${row.name} with parseable fields for dashboards and detections.`,
      troubleshooting: 'If no data appears: verify collection method, credentials, network path, index routing, and TA/add-on deployment.',
    };
  });
}

function buildCadencePlan(payload) {
  const lowConf = (payload.sourceRows || []).filter((r) => r.needsReview || r.confidence === 'low' || r.confidence === 'none');
  return {
    beforeFirstCall: [
      'Confirm Splunk deployment type and tenant/environment access',
      'Validate source availability and logging scope for Phase 1 sources',
      'Align on index, retention, and app/add-on requirements',
      'Review expected ingest range and licensing assumptions',
    ],
    afterEachSource: [
      'Validate data flow and sourcetype assignment',
      'Confirm field extractions and CIM/normalization where applicable',
      'Run source-specific validation search and document results',
      'Review dashboard and detection readiness',
    ],
    openDecisions: [
      'Finalize architecture path selection with stakeholders',
      'Confirm phased rollout timeline and resource owners',
      ...(payload.coverageValidation?.gaps?.length
        ? [`Address ${payload.coverageValidation.gaps.length} coverage gap(s) in a later phase`]
        : []),
    ],
    lowConfidenceSources: lowConf.map((r) => r.name),
    nextAgenda: [
      'Review validation results for onboarded sources',
      'Confirm next source batch and collection methods',
      'Reconcile ingest measurements against planning estimates',
    ],
  };
}

function getAllOfficialLinks(install) {
  const seen = new Set();
  const merged = [];
  const candidates = [
    ...(install?.links || []),
    ...installGuidance.universalForwarder.linkKeys
      .map((k) => installGuidance.officialLinks[k])
      .filter(Boolean),
    ...Object.values(installGuidance.officialLinks),
  ];
  for (const link of candidates) {
    if (!link?.url?.startsWith('https://') || !link.label) continue;
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    merged.push({
      ...link,
      purpose: LINK_PURPOSES[Object.keys(installGuidance.officialLinks).find((k) => installGuidance.officialLinks[k].url === link.url)] ||
        'Reference documentation for deployment planning and validation.',
    });
  }
  return merged;
}

export function getInstallationGuidanceForDeployment(deploymentType) {
  const key = deploymentType === 'onprem' ? 'onprem' : deploymentType === 'hybrid' ? 'hybrid' : 'cloud';
  const section = installGuidance.deploymentTypes[key] || installGuidance.deploymentTypes.cloud;
  const links = (section.linkKeys || [])
    .map((k) => installGuidance.officialLinks[k])
    .filter(Boolean);
  return { ...section, links, deploymentKey: key };
}

export function isSourceConfiguredForExport(ss = {}, catalog = {}) {
  if (!ss || ss.status === 'unknown' || ss.status === 'skip') return false;
  const fields = catalog.input_fields || [];
  const hasNumeric = fields.some(
    (f) => f.type === 'number' && ss[f.key] != null && ss[f.key] !== '',
  );
  if (hasNumeric) return true;
  if (ss.vendor || ss.logging_scope || ss.notes?.trim() || ss.override) return true;
  return false;
}

function isInvalidCount(sourceId, ss, catalog) {
  if (sourceId === 'active_directory') {
    const dcs = Number(ss.number_of_dcs);
    const users = Number(ss.number_of_users);
    if (Number.isFinite(dcs) && dcs > 100 && (!Number.isFinite(users) || users < dcs)) return true;
    if (Number.isFinite(dcs) && dcs > 500) return true;
    return false;
  }
  const key = catalog.sizing_formula?.primary_input;
  const raw = key ? ss[key] : ss.count;
  const n = Number(raw);
  if (!Number.isFinite(n)) return false;
  if (key === 'number_of_users' && n > 5_000_000) return true;
  if (key === 'count' && n > 100_000) return true;
  return false;
}

export function formatSourceCounts(sourceId, ss = {}, catalog = {}) {
  if (sourceId === 'active_directory') {
    const parts = [];
    const dcs = ss.number_of_dcs;
    const users = ss.number_of_users;
    if (dcs != null && dcs !== '') parts.push(`${dcs} domain controllers`);
    if (users != null && users !== '') parts.push(`${users} users`);
    return {
      count: parts.length ? parts.join(', ') : 'Needs validation',
      countBasis: 'Domain controllers and user accounts',
      invalidCount: isInvalidCount(sourceId, ss, catalog),
    };
  }

  const countKey = catalog.sizing_formula?.primary_input;
  const primaryField = (catalog.input_fields || []).find((f) => f.key === countKey);
  let rawCount = countKey ? ss[countKey] : null;
  if (rawCount == null || rawCount === '') rawCount = ss.count ?? null;

  let unitLabel = primaryField?.label?.replace(/^Number of /i, '') ||
    catalog.configuredItemLabel?.replace(/^# of /i, '') ||
    'units';

  if (rawCount == null || rawCount === '') {
    return {
      count: 'Needs validation',
      countBasis: unitLabel,
      invalidCount: isInvalidCount(sourceId, ss, catalog),
    };
  }

  return {
    count: `${rawCount} ${unitLabel}`,
    countBasis: unitLabel,
    invalidCount: isInvalidCount(sourceId, ss, catalog),
  };
}

function buildWhyIncluded(row, catalog) {
  const candidates = [
    row.valueProp?.summary,
    row.valueProp?.headline,
    catalog?.whyItMatters,
    catalog?.description,
  ]
    .map((c) => sanitizeCustomerFacingText(toReadableString(c)))
    .filter((c) => c && !GENERIC_VALUE_PROP.test(c));

  if (candidates.length) return truncate(candidates[0], 140);
  return 'Included in the selected architecture path for planning coverage.';
}

export function shouldIncludeSourceInExport(row, ss, catalog) {
  if (row.status !== 'current' && row.status !== 'future') return false;
  if (!isSourceConfiguredForExport(ss, catalog)) return false;
  if (isInvalidCount(row.id, ss, catalog)) return false;

  const expected = row.ingest?.expected ?? 0;
  if (expected <= 0) {
    if (ss.includeForContext || ss.include_zero_ingest) return true;
    return false;
  }
  return true;
}

/**
 * Enrich report source rows with export-only fields (vendor, count, apps, guide metadata).
 */
export function enrichSourceRowsForExport(sourceRows, planSources, startupGuide, sourceStates = {}) {
  const catalogById = Object.fromEntries((planSources || []).map((s) => [s.id, s]));
  return (sourceRows || []).map((row) => {
    const catalog = catalogById[row.id] || {};
    const ss = sourceStates[row.id] || {};
    const guide = startupGuide?.sources?.find((g) => g.id === row.id);
    const selectFields = (catalog.input_fields || []).filter((f) => f.type === 'select');
    const vendor =
      selectFields.map((f) => ss[f.key]).find(Boolean) ||
      ss.vendor ||
      (catalog.exampleVendors || [])[0] ||
      '';
    const { count, countBasis, invalidCount } = formatSourceCounts(row.id, ss, catalog);
    const splunkApps = [...new Set([...(catalog.splunkApps || []), ...(catalog.technicalAddons || [])])].slice(0, 4);
    const expected = row.ingest?.expected ?? 0;
    const zeroIngestContext = expected <= 0 && (ss.includeForContext || ss.include_zero_ingest);
    const assumptions = [
      ...(row.ingest?.warnings || []).map((w) => sanitizeCustomerFacingText(toReadableString(w))),
      ss.notes ? sanitizeCustomerFacingText(ss.notes) : null,
      ss.logging_scope ? `Logging scope: ${ss.logging_scope}` : null,
      row.ingest?.rateSource === 'fallback' ? 'Using catalog default sizing rate — validate with customer counts.' : null,
      zeroIngestContext ? 'Included for context — no ingest estimate at current scope.' : null,
    ].filter(Boolean);
    const configured = isSourceConfiguredForExport(ss, catalog);
    const needsReview =
      invalidCount ||
      row.ingest?.confidence === 'low' ||
      row.ingest?.confidence === 'none' ||
      !vendor ||
      count === 'Needs validation' ||
      !configured;

    return {
      ...row,
      vendor,
      count,
      countBasis,
      configured,
      ingestRange: {
        low: row.ingest?.low ?? 0,
        expected,
        high: row.ingest?.high ?? 0,
      },
      splunkApps,
      whyIncluded: buildWhyIncluded(row, catalog),
      assumptions,
      needsReview,
      collectionMethod: guide?.method || '—',
      technicalAddon: guide?.ta || splunkApps[0] || '—',
      guidePermissions: sanitizeCustomerFacingText(guide?.permissions || ''),
      guideValidation: sanitizeCustomerFacingText(guide?.validation || ''),
      zeroIngestContext,
    };
  });
}

export function filterExportSourceRows(enrichedRows, sourceStates, planSources) {
  const catalogById = Object.fromEntries((planSources || []).map((s) => [s.id, s]));
  return (enrichedRows || []).filter((row) => {
    const catalog = catalogById[row.id];
    if (!catalog) return false;
    const ss = sourceStates[row.id] || {};
    return shouldIncludeSourceInExport(row, ss, catalog);
  });
}

export function groupSourcesByCategory(rows) {
  const groups = {};
  for (const row of rows || []) {
    const cat = row.category || 'Uncategorized';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(row);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function normalizeNextSteps(planNarrative, selectedPlan) {
  if (planNarrative?.length) {
    return planNarrative.slice(0, 5).map((n) => sanitizeCustomerFacingText(toReadableString(n)));
  }
  return (selectedPlan?.strengths || [])
    .slice(0, 4)
    .map((s) => sanitizeCustomerFacingText(toReadableString(s)))
    .filter(Boolean);
}

function reconcileExportTotals(sourceRows, planTotals) {
  if (!sourceRows?.length) {
    return planTotals?.buffered ?? planTotals ?? { low: 0, expected: 0, high: 0 };
  }
  const low = sourceRows.reduce((sum, r) => sum + (r.ingestRange?.low ?? r.ingest?.low ?? 0), 0);
  const expected = sourceRows.reduce((sum, r) => sum + (r.ingestRange?.expected ?? r.ingest?.expected ?? 0), 0);
  const high = sourceRows.reduce((sum, r) => sum + (r.ingestRange?.high ?? r.ingest?.high ?? 0), 0);
  return { low, expected, high };
}

function planIngestTotals(plan) {
  return plan?.totals?.buffered ?? plan?.totals ?? { low: 0, expected: 0, high: 0 };
}

function buildPathComparisonRows(plans = [], selectedPlan) {
  const selectedKey = pathLabel(selectedPlan, '');
  return (plans || []).map((plan) => {
    const totals = planIngestTotals(plan);
    const fullName = pathLabel(plan);
    const shortName = shortPathLabel(plan);
    return {
      name: shortName,
      shortName,
      fullName,
      pathPhase: plan.pathPhase || '',
      expectedGb: totals.expected ?? 0,
      lowGb: totals.low ?? 0,
      highGb: totals.high ?? 0,
      sourceCount: plan.sources?.length ?? 0,
      coverage: plan.validation?.score ?? 0,
      selected: fullName === selectedKey || plan.name === selectedPlan?.name,
    };
  });
}

function buildStructuredExportRisks(selectedPlan, coverageValidation, normalizedRisks = []) {
  const riskStrings = selectedPlan?.risks?.length
    ? selectedPlan.risks
    : normalizedRisks.map((r) => r.description);
  const structured = buildStructuredPlanRisks(riskStrings, {
    validation: coverageValidation,
    plan: selectedPlan,
  }, 6);
  return structured.map((r) => ({
    severity: 'Planning',
    title: sanitizeCustomerFacingText(r.title),
    description: sanitizeCustomerFacingText(r.impact || r.raw),
    mitigation: sanitizeCustomerFacingText(r.mitigation),
  }));
}

function normalizeRisks(risks) {
  return (risks || []).map((r) => ({
    severity: r.severity || 'medium',
    description: sanitizeCustomerFacingText(toReadableString(r.description)),
    mitigation: sanitizeCustomerFacingText(toReadableString(r.mitigation)),
  }));
}

function mapStartupPhases(timeline = []) {
  const cards = STARTUP_PHASE_CARDS.map((p) => ({ ...p, tasks: [] }));
  for (const phase of timeline) {
    const label = `${phase.phase} ${phase.title}`;
    const card =
      cards.find((c) => c.match.test(label)) ||
      cards.find((c) => c.key === 'expand');
    card.tasks.push(`${phase.title}: ${(phase.tasks || []).slice(0, 3).join('; ')}`);
  }
  return cards.filter((c) => c.tasks.length > 0);
}

/** @param {object} ctx - report context assembled by ReportPage */
export function buildReportExportPayload(ctx) {
  const deploymentType = ctx.intake?.deploymentType || 'cloud';
  const enrichedAll = enrichSourceRowsForExport(
    ctx.sourceRows,
    ctx.selectedPlan?.sources,
    ctx.startupGuide,
    ctx.sourceStates,
  );
  const sourceRows = filterExportSourceRows(enrichedAll, ctx.sourceStates || {}, ctx.selectedPlan?.sources);
  const sourceRowsByCategory = groupSourcesByCategory(sourceRows);
  const sourceCount = sourceRows.length;
  const useCaseLabels = (ctx.useCases || []).map((u) => u.name).filter(Boolean);
  const desiredAppLabels = resolveAppNames(ctx.intake?.desiredApps || []);
  const appRecommendations = recommendApps({
    intake: ctx.intake || {},
    sourceStatuses: ctx.sourceStates || {},
  });
  const productRecommendations = summarizeProductRecommendations(appRecommendations);
  const installationGuidance = getInstallationGuidanceForDeployment(deploymentType);
  const valueGroups = buildValueGroups(sourceRows);
  const validationEntries = buildValidationEntries(sourceRows, ctx.startupGuide);
  const cadencePlan = buildCadencePlan({
    sourceRows,
    coverageValidation: ctx.coverageValidation,
    risks: ctx.risks,
  });

  const forwardSteps = [
    'Validate source availability and logging scope with relevant teams',
    'Confirm device/user counts and collection methods for each source',
    'Finalize architecture path selection with stakeholders',
    'Align on onboarding sequence and implementation owners',
    'Validate ingest assumptions with customer-specific measurements',
    'Move to implementation planning and cadence calls',
  ];

  const yearOnePlan = buildYearOneDeploymentPlan({
    intake: ctx.intake || {},
    selectedPlan: ctx.selectedPlan,
    startupGuide: ctx.startupGuide,
  });

  const ufSteps = (installGuidance.universalForwarder?.steps || []).map((s) =>
    sanitizeCustomerFacingText(toReadableString(s)),
  );

  const normalizedRisks = normalizeRisks(ctx.risks);
  const allPlans = ctx.plans?.length ? ctx.plans : (ctx.selectedPlan ? [ctx.selectedPlan] : []);
  const exportTotals = reconcileExportTotals(sourceRows, ctx.selectedPlan?.totals);

  const payload = {
    customerName: ctx.customerName || 'Customer',
    generatedAt: ctx.generatedAt || new Date().toISOString(),
    bufferPercent: ctx.bufferPercent ?? 20,
    totals: exportTotals,
    phase1Totals: exportTotals,
    phase2Suggestions: ctx.selectedPlan?.phase2Suggestions ?? [],
    phase2Totals: ctx.selectedPlan?.phase2Totals ?? null,
    budgetGbDay: ctx.selectedPlan?.budgetGbDay ?? ctx.budgetGbDay ?? null,
    configuredUtilizationPct: ctx.selectedPlan?.budgetUtilizationPct ?? null,
    configuredCeiling: ctx.selectedPlan?.configuredCeiling ?? null,
    budgetHeadroomGb: ctx.selectedPlan?.budgetHeadroomGb ?? null,
    hasBudgetHeadroom: ctx.selectedPlan?.hasBudgetHeadroom ?? false,
    selectedPlan: ctx.selectedPlan,
    allPlans,
    pathComparisonRows: buildPathComparisonRows(allPlans, ctx.selectedPlan),
    pathDisplayLabel: pathLabel(ctx.selectedPlan),
    executiveSummaryOnly: Boolean(ctx.executiveSummaryOnly),
    executiveSummary: {
      text: sanitizeCustomerFacingText(toReadableString(ctx.executiveSummary?.text || ctx.executiveSummary)),
    },
    coverageValidation: ctx.coverageValidation,
    sourceRows,
    sourceRowsByCategory,
    sourceCount,
    sourceRowsExcludedCount: enrichedAll.length - sourceRows.length,
    valueGroups,
    businessOutcomes: buildBusinessOutcomes(ctx.useCases, sourceRows),
    challengeNarrative: buildChallengeNarrative(ctx.intake, ctx.useCases, ctx.selectedPlan),
    validationEntries,
    cadencePlan,
    officialLinksFull: getAllOfficialLinks(installationGuidance),
    forwardSteps,
    risks: normalizedRisks,
    structuredRisks: buildStructuredExportRisks(ctx.selectedPlan, ctx.coverageValidation, normalizedRisks),
    startupGuide: ctx.startupGuide,
    startupPhases: mapStartupPhases(ctx.startupGuide?.timeline),
    useCases: ctx.useCases || [],
    useCaseLabels,
    useCaseLabelsVisible: useCaseLabels.slice(0, 5),
    useCaseLabelsOverflow: Math.max(0, useCaseLabels.length - 5),
    intake: sanitizeIntakeForCustomer(ctx.intake || {}),
    desiredAppLabels,
    desiredAppLabelsVisible: desiredAppLabels.slice(0, 5),
    desiredAppLabelsOverflow: Math.max(0, desiredAppLabels.length - 5),
    appRecommendations,
    esEligibility: appRecommendations.esEligibility,
    productRecommendations,
    deploymentType,
    deploymentLabel: DEPLOYMENT_LABELS[deploymentType] || deploymentType,
    installationGuidance,
    disclaimer: EXPORT_DISCLAIMER_FULL,
    disclaimerShort: EXPORT_DISCLAIMER_SHORT,
    nextSteps: normalizeNextSteps(ctx.planNarrative, ctx.selectedPlan),
    pathRationale: sanitizeCustomerFacingText(ctx.selectedPlan?.description || ''),
    pathTradeoff: sanitizeCustomerFacingText(ctx.selectedPlan?.nextStep || ctx.selectedPlan?.subtitle || ''),
    planStrengths: (ctx.selectedPlan?.strengths || []).map((s) => sanitizeCustomerFacingText(toReadableString(s))),
    planGaps: (ctx.selectedPlan?.validation?.gaps || ctx.coverageValidation?.gaps || [])
      .slice(0, 5)
      .map((g) => toReadableString(g.domain || g.name || g).replace(/_/g, ' ')),
    yearOnePlan,
    ufSteps,
  };

  payload.valueProposalDocument = buildValueProposalDocument(payload);
  payload.startupGuideDocument = buildStartupGuideDocument(payload);
  payload.customerPlanningPackDocument = buildCustomerPlanningPackDocument(payload);
  return payload;
}

export function formatNumberedList(items) {
  return (items || [])
    .filter(Boolean)
    .map((item, i) => `${i + 1}. ${sanitizeCustomerFacingText(toReadableString(item))}`);
}

/** Architecture Value Proposal — audience: leadership / buyer */
export function generateValueProposalPdf(payload) {
  const document = payload.valueProposalDocument || buildValueProposalDocument(payload);
  return renderValueProposalPdf(document, payload);
}

/** Implementation Startup Guide — audience: engineers / admins */
export function generateStartupGuidePdf(payload) {
  const document = payload.startupGuideDocument || buildStartupGuideDocument(payload);
  return renderStartupGuidePdf(document, payload);
}

/** Customer Planning Pack — Overview + Sources + Startup Guide (direct PDF download). */
export function generateCustomerPlanningPackPdf(payload) {
  const document = payload.customerPlanningPackDocument || buildCustomerPlanningPackDocument(payload);
  return renderCustomerPlanningPackPdf(document, payload);
}

/** @deprecated Use generateValueProposalPdf — kept for backward compatibility */
export function generateCustomerPdf(payload) {
  return generateValueProposalPdf(payload);
}

export async function generateCustomerPptx(payload) {
  const deck = buildValueProposalSlideDeck(payload);
  return renderValueProposalPptx(deck);
}
