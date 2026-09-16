/**
 * Single source of truth for customer-facing report data (live UI + exports).
 */

import sourceCatalog from '../data/sources.json';
import { generatePlans } from './planEngine.js';
import { computeIngestBudgetFromIntake } from './budgetEngine.js';
import { flattenSourceCatalog } from './sizingEngine.js';
import { calculateFullSourceIngest } from './sourceEligibilityEngine.js';
import { applyPlanningBufferToSource } from '../utils/bufferBand.js';
import { PLANNING_BUFFER_FRACTION } from '../utils/bufferBand.js';
import { resolveUseCaseProfiles } from './useCaseResolver.js';
import { validateMultiUseCase } from './coverageEngine.js';
import {
  generateExecutiveSummary,
  generatePlanNarrative,
  generateSourceValueProp,
} from './valuePropEngine.js';
import { generateStartupGuide } from './startupGuideEngine.js';
import { buildYearOneDeploymentPlan } from './yearOnePlanEngine.js';
import { recommendApps } from './appRecommendationEngine.js';
import { buildStructuredPlanRisks } from '../data/pathRiskMitigations.js';
import {
  isSourceConfiguredForExport,
  sanitizeCustomerFacingText,
} from './reportExportEngine.js';
import { EXPORT_DISCLAIMER_FULL } from './exportConstants.js';
import { APP_VERSION } from '../config/version.js';
import { buildPathCardMessaging } from './pathValueMessagingEngine.js';
import {
  getConfiguredOverlapNotes,
  getMissingAnalysisPriorities,
} from './reviewGateEngine.js';
import { getAnalysisSourcePriorities } from './analysisSourcePriorityEngine.js';
import { mapValidationGapsToCopy } from './pathGapCopyEngine.js';
import { resolvePoweredAppLinks } from './reportAppLinks.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);

const STARTUP_PHASE_LABELS = [
  { title: 'Prepare', match: /preparation|discovery|week 0/i },
  { title: 'Onboard', match: /onboarding|foundational|week 1/i },
  { title: 'Validate', match: /validat|confirm|week 2|week 3/i },
  { title: 'Expand', match: /expand|phase 2|future|week 4/i },
];

export function groupStartupPhases(timeline = []) {
  const cards = STARTUP_PHASE_LABELS.map((p) => ({ ...p, phases: [] }));
  for (const phase of timeline) {
    const label = `${phase.phase} ${phase.title}`;
    const card = cards.find((c) => c.match.test(label)) || cards[cards.length - 1];
    card.phases.push(phase);
  }
  return cards.filter((c) => c.phases.length > 0);
}

function truncateText(text, max = 140) {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

function firstSentence(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const m = t.match(/^[^.!?]+[.!?]/);
  return m ? m[0].trim() : truncateText(t, 160);
}

function buildDeliveryBullets(planNarrative, max = 3) {
  return planNarrative
    .slice(0, max)
    .map((n) => (typeof n === 'string' ? truncateText(n) : truncateText(n.narrative)))
    .filter(Boolean);
}

function buildOverviewNextSteps(selectedPlan, planNarrative, planCoverageValidation) {
  const steps = [];
  if (selectedPlan?.nextStep) steps.push(selectedPlan.nextStep);
  for (const n of planNarrative.slice(0, 2)) {
    const t = typeof n === 'string' ? n : n.narrative;
    if (t) steps.push(t);
  }
  if (planCoverageValidation.gaps.length > 0) {
    steps.push('Expand coverage in a later phase after foundational sources are stable.');
  }
  steps.push('Validate ingest estimates with customer-specific measurement before licensing decisions.');
  const unique = [];
  for (const s of steps) {
    const clean = sanitizeCustomerFacingText(s);
    if (clean && !unique.includes(clean)) unique.push(clean);
  }
  return unique.slice(0, 4);
}

function buildRiskSection(validation, sourceDetails, totals) {
  const risks = [];
  if (validation.gaps.length > 0) {
    risks.push({
      severity: 'high',
      description: `${validation.gaps.length} telemetry gaps below threshold.`,
      mitigation: 'Add sources covering these domains or adjust scope.',
    });
  }
  const lowConfidence = sourceDetails.filter(
    (s) => s.needsReview || s.ingest?.confidence === 'low' || s.ingest?.confidence === 'none',
  );
  if (lowConfidence.length > 0) {
    risks.push({
      severity: 'medium',
      description: `${lowConfidence.length} source(s) need validation before finalizing sizing.`,
      mitigation: 'Gather device counts and logging policies.',
    });
  }
  const expected = totals?.buffered?.expected ?? 0;
  if (expected > 500) {
    risks.push({
      severity: 'medium',
      description: 'Ingest exceeds 500 GB/day — verify license capacity.',
      mitigation: 'Consider phased rollout.',
    });
  }
  return risks;
}

function isExampleValidationQuery(query) {
  return !query || query.includes('<source_index>') || query.includes('index={');
}

function formatValidationDisplay(query) {
  const sanitized = sanitizeCustomerFacingText(query);
  if (isExampleValidationQuery(sanitized)) {
    return { text: sanitized, isExample: true };
  }
  return { text: sanitized, isExample: false };
}

function mapProductItemForPanel(item) {
  const url =
    item.customerUrl && /^https:\/\//i.test(item.customerUrl) ? item.customerUrl : null;
  return {
    appId: item.appId,
    displayName: item.displayName,
    type: item.type,
    phase: item.phase,
    fit: item.fit,
    customerReason: sanitizeCustomerFacingText(item.customerReason),
    customerUrl: url,
    readinessWarnings: (item.readinessWarnings || []).slice(0, 1),
    needsExternalValidation: Boolean(item.needsExternalValidation || !url),
  };
}

function mapProductItem(item) {
  const url =
    item.customerUrl && /^https:\/\//i.test(item.customerUrl) ? item.customerUrl : null;
  return {
    displayName: item.displayName,
    type: item.type,
    phase: item.phase,
    reason: sanitizeCustomerFacingText(item.customerReason),
    url,
    needsValidation: Boolean(item.needsExternalValidation || !url),
  };
}

function mapProductRecommendations(rec) {
  if (!rec) {
    return {
      primaryRecommendationSummary: '',
      compactItems: [],
      recommendedSolutions: [],
      helpfulApps: [],
      technicalAddons: [],
      dependencies: [],
    };
  }
  const filterVisible = (items) =>
    (items || []).filter((r) => r.customerVisible !== false).map(mapProductItem);
  const compactItems = [
    ...(rec.recommendedSolutions || []),
    ...(rec.helpfulApps || []),
  ]
    .filter((r) => r.customerVisible !== false)
    .map(mapProductItemForPanel);
  return {
    primaryRecommendationSummary: sanitizeCustomerFacingText(rec.primaryRecommendationSummary || ''),
    compactItems,
    recommendedSolutions: filterVisible(rec.recommendedSolutions),
    helpfulApps: filterVisible(rec.helpfulApps),
    technicalAddons: filterVisible(rec.technicalAddons),
    dependencies: filterVisible(rec.dependencies),
  };
}

function mapSourceRowForExport(row, guideSource, catalogEntry) {
  const validation = guideSource ? formatValidationDisplay(guideSource.validation) : null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    status: row.status,
    configured: row.configured,
    needsReview: row.needsReview,
    isCustom: Boolean(row.id?.startsWith('custom_')),
    isZeroUnconfigured: Boolean(row.isZeroUnconfigured),
    ingest: {
      low: row.ingest.low,
      expected: row.ingest.expected,
      high: row.ingest.high,
    },
    valueSummary: sanitizeCustomerFacingText(row.valueProp?.summary || ''),
    useCases: (row.valueProp?.relevantUseCases || []).map((u) => sanitizeCustomerFacingText(u)),
    vendor: catalogEntry?.vendor || guideSource?.vendor || '',
    collectionMethod: guideSource?.method || '',
    addons: guideSource?.ta || '',
    permissions: guideSource ? sanitizeCustomerFacingText(guideSource.permissions) : '',
    validation,
    complexity: guideSource?.complexity || '',
    notes: guideSource ? sanitizeCustomerFacingText(guideSource.notes) : '',
  };
}

/**
 * @param {object} state - App session state
 * @param {{ hideZeroUnconfigured?: boolean, generatedAt?: Date }} [options]
 */
export function buildCustomerReportData(state, options = {}) {
  const hideZeroUnconfigured = options.hideZeroUnconfigured !== false;
  const generatedAt = options.generatedAt || new Date();

  const { profiles: useCases } = resolveUseCaseProfiles(state.intake);

  const customSources = Object.entries(state.sources)
    .filter(([id, s]) => id.startsWith('custom_') && (s.status === 'current' || s.status === 'future'))
    .map(([id, s]) => ({
      id,
      name: s.name || 'Custom',
      ...s,
      telemetryDomains: s.telemetryDomains || {},
    }));

  const budgetGbDay = computeIngestBudgetFromIntake(state.intake)?.budgetGbDay ?? null;

  const plans = generatePlans(
    flatCatalog,
    state.sources,
    useCases,
    customSources,
    state.overlapDecisions,
    PLANNING_BUFFER_FRACTION,
    {
      budgetGbDay,
      primaryProfileId: state.interpretation?.primaryUseCase?.id ?? null,
      intake: state.intake,
    },
  );

  const hasReportPath = state.reportPathExplicit && state.selectedPlanIndex != null;
  const planIndex =
    !hasReportPath || plans.length === 0
      ? -1
      : Math.min(Math.max(0, state.selectedPlanIndex), plans.length - 1);
  const selectedPlan = planIndex >= 0 ? plans[planIndex] : null;

  const planCoverageValidation = validateMultiUseCase(selectedPlan?.coverage || {}, useCases);

  const catalogById = Object.fromEntries((selectedPlan?.sources || []).map((s) => [s.id, s]));

  const sourceRows = (selectedPlan?.sources || []).map((s) => {
    const ss = state.sources[s.id] || {};
    const breakdown = selectedPlan.sourceIngestGb?.find((r) => r.id === s.id);
    const raw = calculateFullSourceIngest(s, ss, { catalog: sourceCatalog, allInputs: state.sources });
    const planned = breakdown
      ? { low: breakdown.gbLow, expected: breakdown.gbDay, high: breakdown.gbHigh }
      : applyPlanningBufferToSource(raw);
    const ingest = {
      low: planned.low,
      expected: planned.expected,
      high: planned.high,
      confidence: raw.confidence,
      ciscoPromoApplied: Boolean(raw.ciscoPromoApplied || breakdown?.ciscoPromoApplied),
      grossExpected: breakdown?.gbGrossExpected
        ?? applyPlanningBufferToSource({ expected: raw.gbGrossExpected ?? raw.expected }).expected,
    };
    const valueProp = generateSourceValueProp(s, useCases, selectedPlan.coverage);
    return {
      id: s.id,
      name: s.name,
      category: s.category || 'Uncategorized',
      status: ss.status || 'unknown',
      ingest,
      valueProp,
    };
  });

  const displaySourceRows = sourceRows
    .map((row) => {
      const ss = state.sources[row.id] || {};
      const catalog = catalogById[row.id] || {};
      const configured = isSourceConfiguredForExport(ss, catalog);
      const needsReview =
        row.ingest.confidence === 'low' || row.ingest.confidence === 'none' || !configured;
      const isZeroUnconfigured = row.ingest.expected <= 0 && !configured;
      return { ...row, configured, needsReview, isZeroUnconfigured };
    })
    .sort((a, b) => {
      if (a.configured !== b.configured) return a.configured ? -1 : 1;
      if (a.isZeroUnconfigured !== b.isZeroUnconfigured) return a.isZeroUnconfigured ? 1 : -1;
      return b.ingest.expected - a.ingest.expected;
    });

  const filteredRows = hideZeroUnconfigured
    ? displaySourceRows.filter((r) => !r.isZeroUnconfigured)
    : displaySourceRows;

  const sourcesByCategory = {};
  for (const row of filteredRows) {
    const cat = row.category;
    if (!sourcesByCategory[cat]) sourcesByCategory[cat] = [];
    sourcesByCategory[cat].push(row);
  }

  const startupGuide = selectedPlan?.sources?.length
    ? generateStartupGuide(selectedPlan.sources, state.sources, useCases, state.intake.customerName, {
        deploymentType: state.intake.deploymentType,
        intake: state.intake,
      })
    : null;

  const guideById = Object.fromEntries((startupGuide?.sources || []).map((s) => [s.id, s]));

  const sourceGroups = Object.entries(sourcesByCategory).map(([category, rows]) => ({
    category,
    sources: rows.map((row) => mapSourceRowForExport(row, guideById[row.id], catalogById[row.id])),
  }));

  const bufferedTotals = selectedPlan?.totals?.buffered || { low: 0, expected: 0, high: 0 };
  const configuredSourceCount = displaySourceRows.filter(
    (r) => r.configured && !r.isZeroUnconfigured,
  ).length;

  const executiveSummary = generateExecutiveSummary(plans, useCases, state.intake.customerName);
  const planNarrative = selectedPlan ? generatePlanNarrative(selectedPlan, useCases) : [];
  const risksRaw = buildRiskSection(planCoverageValidation, displaySourceRows, selectedPlan?.totals);

  const planMapped = buildStructuredPlanRisks(
    selectedPlan?.risks || [],
    { validation: selectedPlan?.validation, plan: selectedPlan },
    5,
  );
  const fromPlan = planMapped
    .filter((r) => r.id !== 'none')
    .map((r) => ({ title: r.title, mitigation: r.mitigation }));
  const supplemental = risksRaw.map((r) => ({
    title: r.description,
    mitigation: r.mitigation,
  }));
  const seen = new Set();
  const risks = [];
  for (const row of [...fromPlan, ...supplemental]) {
    const key = `${row.title}|${row.mitigation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    risks.push(row);
  }

  const ingestSegments = sourceRows
    .filter((r) => r.ingest.expected > 0)
    .map((r) => ({ label: r.name, value: r.ingest.expected }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const appRecommendations = recommendApps({ intake: state.intake, sourceStatuses: state.sources });
  const yearOnePlan =
    selectedPlan && startupGuide
      ? buildYearOneDeploymentPlan({ intake: state.intake, selectedPlan, startupGuide })
      : null;

  const startupPhaseCards = startupGuide ? groupStartupPhases(startupGuide.timeline) : [];
  const weekOneThreeSources = (startupGuide?.sources || [])
    .filter((s) => s.status === 'current')
    .slice(0, 8);

  const deploymentType =
    state.intake.deploymentType ||
    state.intake.splunkDeployment ||
    state.intake.platform ||
    'Splunk deployment';

  const pathMessaging = selectedPlan ? buildPathCardMessaging(selectedPlan) : null;
  const pathPhase = selectedPlan?.pathPhase || '';

  const sourcesIncluded = filteredRows
    .filter((r) => r.configured && r.ingest.expected > 0)
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      ingestExpected: r.ingest.expected,
      ingestLow: r.ingest.low,
      ingestHigh: r.ingest.high,
      ingestGrossExpected: r.ingest.grossExpected,
      ciscoPromoApplied: Boolean(r.ingest.ciscoPromoApplied),
    }))
    .sort((a, b) => b.ingestExpected - a.ingestExpected);

  const valueDelivered = selectedPlan
    ? [
        ...(pathMessaging?.executive?.whatYouGet || []),
        ...(selectedPlan.strengths || []).slice(0, 3).map((s) => sanitizeCustomerFacingText(s)),
      ]
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const maturityOpportunities = (selectedPlan?.gaps || []).map((g) => sanitizeCustomerFacingText(g));
  const telemetryGaps =
    pathPhase === 'crawl' || pathPhase === 'walk'
      ? mapValidationGapsToCopy(selectedPlan?.validation, { useCases, intake: state.intake }).map((g) =>
          sanitizeCustomerFacingText(g),
        )
      : [];

  const appsPowered = selectedPlan
    ? resolvePoweredAppLinks(selectedPlan.appsPowered || [])
    : [];

  const appsPartiallyPowered = selectedPlan
    ? (selectedPlan.appsPartiallyPowered || []).map((entry) => ({
        ...resolvePoweredAppLinks([entry.id])[0],
        reason: sanitizeCustomerFacingText(entry.reason || ''),
      }))
    : [];

  const analysisPriorities = getAnalysisSourcePriorities({
    intake: state.intake,
    desiredApps: state.intake?.desiredApps,
    recommendedApps: state.intake?.recommendedApps,
    sourceStates: state.sources,
    overlapDecisions: state.overlapDecisions,
    limit: 50,
  });
  const priorityRank = new Map(analysisPriorities.map((p, i) => [p.sourceId, i]));

  const startupSourcesOrdered = (startupGuide?.sources || [])
    .map((src) => ({
      id: src.id,
      name: src.name,
      status: src.status,
      method: src.method || '',
      complexity: src.complexity || '',
      ta: src.ta || '',
      taLinks: src.taLinks || [],
      permissions: sanitizeCustomerFacingText(src.permissions || ''),
      validation: src.validation || '',
      validationExpected: sanitizeCustomerFacingText(src.validationExpected || ''),
      validationTroubleshooting: sanitizeCustomerFacingText(src.validationTroubleshooting || ''),
      relevanceRank: priorityRank.get(src.id) ?? 999,
    }))
    .sort((a, b) => a.relevanceRank - b.relevanceRank);

  const overlapNotes = getConfiguredOverlapNotes(state.sources, sourceCatalog);
  const missingPriorities = getMissingAnalysisPriorities({
    intake: state.intake,
    sourceStates: state.sources,
    overlapDecisions: state.overlapDecisions,
    sizingContext: {},
    limit: 10,
  });

  const talkTracks = pathMessaging
    ? [
        { label: 'Positioning', text: pathMessaging.heroTagline },
        { label: 'What the customer gets', text: (pathMessaging.executive?.whatYouGet || []).join('; ') },
        { label: 'Not yet in this path', text: (pathMessaging.executive?.notYetIncluded || []).join('; ') },
        { label: 'Best fit when', text: (pathMessaging.executive?.bestFit || []).join('; ') },
        { label: 'Risk to discuss', text: pathMessaging.executiveRisk?.impact || '' },
        { label: 'Mitigation', text: pathMessaging.executiveRisk?.mitigation || '' },
        { label: 'Upgrade path', text: (pathMessaging.executive?.whyUpgrade || []).join('; ') },
      ].filter((t) => t.text)
    : [];

  return {
    hasReportPath,
    customer: state.intake.customerName || 'Customer',
    generatedAt: generatedAt.toISOString(),
    reportTitle: 'Splunk Scope Planning Pack',
    deploymentType: sanitizeCustomerFacingText(deploymentType),
    selectedPath: selectedPlan?.name || '',
    selectedPathDescription: sanitizeCustomerFacingText(selectedPlan?.description || ''),
    pathDetail: hasReportPath && selectedPlan
      ? {
          name: selectedPlan.name,
          description: sanitizeCustomerFacingText(selectedPlan.description || ''),
          pathPhase,
          ingestSummary: {
            low: bufferedTotals.low,
            expected: bufferedTotals.expected,
            high: bufferedTotals.high,
            gross: selectedPlan?.totals?.gross || null,
            ciscoPromoApplied: Boolean(selectedPlan?.totals?.ciscoPromoApplied),
          },
          sourceCount: sourcesIncluded.length,
          sourcesIncluded,
          appsPowered,
          appsPartiallyPowered,
          valueDelivered,
          maturityOpportunities,
          telemetryGaps,
          gaps: maturityOpportunities,
        }
      : null,
    internalSalesSummary: {
      goals: useCases.map((uc) => uc.name),
      budgetGbDay,
      budgetUsd: state.intake?.opportunityBudgetUsd || null,
      selectedPath: selectedPlan?.name || '',
      configuredSourceCount,
      configuredSources: sourcesIncluded.map((s) => ({ name: s.name, ingestExpected: s.ingestExpected })),
      overlaps: overlapNotes.map((o) => o.message),
      missingPriorities: missingPriorities.map((p) => ({
        name: p.sourceName || p.sourceId,
        rationale: sanitizeCustomerFacingText(p.rationale || p.reason || ''),
        appLabels: p.appLabels || [],
      })),
      talkTracks,
    },
    startupSourcesOrdered,
    ingestSummary: {
      low: bufferedTotals.low,
      expected: bufferedTotals.expected,
      high: bufferedTotals.high,
      gross: selectedPlan?.totals?.gross || null,
      ciscoPromoApplied: Boolean(selectedPlan?.totals?.ciscoPromoApplied),
    },
    coverageSummary: {
      score: planCoverageValidation.overallScore,
      sourceCount: configuredSourceCount,
    },
    overview: {
      deliveryBullets: buildDeliveryBullets(planNarrative),
      executiveOneLiner: firstSentence(executiveSummary?.text),
      ingestSegments,
      ingestChartTotal: ingestSegments.reduce((sum, seg) => sum + seg.value, 0),
      useCases: useCases.map((uc) => uc.name),
      strengths: (selectedPlan?.strengths || []).slice(0, 5),
      gaps: (selectedPlan?.validation?.gaps || []).map((g) => g.replace(/_/g, ' ')),
      sourceCountInPath: selectedPlan?.sources?.length || 0,
    },
    architectureFlow: selectedPlan
      ? {
          pathName: selectedPlan.name,
          pathDescription: truncateText(selectedPlan.description, 100),
          sourceCount: selectedPlan.sources.length,
          outcomes: useCases.slice(0, 5).map((uc) => uc.name),
        }
      : null,
    recommendedProducts: mapProductRecommendations(appRecommendations),
    productRecommendations: mapProductRecommendations(appRecommendations),
    risks: risks.slice(0, 5),
    nextSteps: buildOverviewNextSteps(selectedPlan, planNarrative, planCoverageValidation),
    sourceGroups,
    startupGuide: startupGuide
      ? {
          yearOnePlan: yearOnePlan
            ? {
                phases: (yearOnePlan.phases || []).map((p) => ({
                  period: p.period,
                  title: p.title,
                  objectives: (p.objectives || []).map((o) => sanitizeCustomerFacingText(o)),
                  sources: p.sources,
                  validation: p.validation,
                })),
                workshops: yearOnePlan.workshops || [],
              }
            : null,
          phaseCards: startupPhaseCards.map((card) => ({
            title: card.title,
            phases: card.phases.map((phase) => ({
              title: phase.title,
              tasks: (phase.tasks || []).slice(0, 6).map((t) => sanitizeCustomerFacingText(t)),
            })),
          })),
          weekOneThreePriority: weekOneThreeSources.map((s) => s.name),
          onboardingSources: (startupGuide.sources || []).map((src) => {
            const validation = formatValidationDisplay(src.validation);
            return {
              id: src.id,
              name: src.name,
              status: src.status,
              method: src.method,
              complexity: src.complexity,
              ta: src.ta,
              taLinks: src.taLinks || [],
              permissions: sanitizeCustomerFacingText(src.permissions),
              validation,
              validationExpected: sanitizeCustomerFacingText(src.validationExpected || ''),
              validationTroubleshooting: sanitizeCustomerFacingText(src.validationTroubleshooting || ''),
            };
          }),
          prerequisites: (startupGuide.prerequisites || []).map((p) => sanitizeCustomerFacingText(p)),
        }
      : null,
    assumptions: EXPORT_DISCLAIMER_FULL,
    appVersion: APP_VERSION,
    links: [],
  };
}
