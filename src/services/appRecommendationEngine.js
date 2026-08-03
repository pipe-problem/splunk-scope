/**
 * App / product recommendation engine — deterministic, explainable.
 * Single source of truth for Interpretation, exports, and source library.
 */

import appCatalogData from '../data/appCatalog.json' with { type: 'json' };
import useCaseProfiles from '../data/useCaseProfiles.json' with { type: 'json' };
import sourcesCatalog from '../data/sources.json' with { type: 'json' };
import { parseCustomUseCases } from './interpretationEngine.js';
import { resolveUseCaseProfiles } from './useCaseResolver.js';
import { getBudgetSensitivityBand } from './sourcePrioritizationEngine.js';
import { isCloudSecurityInScope } from './sourcePrioritizationEngine.js';
import { resolveSplunkbaseLink } from './splunkbaseCatalog.js';
import {
  resolveCanonicalAppId,
  getAppCatalogEntry,
  getAllCatalogApps,
} from './appCatalogService.js';
import { assessEnterpriseSecurityEligibility } from './enterpriseSecurityEligibilityEngine.js';
import { withEffectiveGoals } from '../utils/goalPresets.js';

const APPS = appCatalogData.apps || [];
const BY_ID = new Map(APPS.map((a) => [a.id, a]));

/** Profile id → intent category weights */
const PROFILE_INTENT_MAP = {
  foundational_security: { foundational_security: 1, enterprise_siem: 0.2 },
  enterprise_security: { enterprise_siem: 1, threat_detection: 0.5, incident_response: 0.3 },
  threat_detection: { threat_detection: 1, enterprise_siem: 0.6 },
  risk_based_alerting: { risk_based_alerting: 1, enterprise_siem: 0.4 },
  compliance_audit: { compliance: 1, foundational_security: 0.3 },
  identity_access: { identity_access: 1, foundational_security: 0.4 },
  endpoint_security: { endpoint_security: 1, foundational_security: 0.5 },
  cloud_security: { cloud_security: 1, cloud_observability: 0.2 },
  ot_ics_security: { ot_ics: 1 },
  it_operations: { it_service_management: 1, infrastructure_monitoring: 0.5 },
  infrastructure_monitoring: { infrastructure_monitoring: 1, cloud_observability: 0.3 },
  application_monitoring: { observability_apm: 0.8, it_service_management: 0.4 },
  observability_apm: { observability_apm: 1, cloud_observability: 0.8 },
  kubernetes_container: { cloud_observability: 0.9, observability_apm: 0.6 },
  network_operations: { network_operations: 1 },
  database_monitoring: { database_monitoring: 1, it_service_management: 0.3 },
  business_analytics: { business_analytics: 1, ai_ml_predictive: 0.3 },
  digital_experience: { digital_experience: 1, observability_apm: 0.5 },
  ai_ml_analytics: { ai_ml_predictive: 1 },
  platform_admin: { platform_admin: 1 },
  custom_other: {},
};

const INTENT_KEYWORDS = [
  { intent: 'enterprise_siem', keywords: ['siem', 'enterprise security', 'soc', 'security operations'], weight: 3 },
  { intent: 'foundational_security', keywords: ['infosec', 'foundational', 'new to splunk', 'getting started'], weight: 2 },
  { intent: 'threat_detection', keywords: ['threat hunting', 'mitre', 'forensics', 'investigation'], weight: 3 },
  { intent: 'incident_response', keywords: ['soar', 'playbook', 'orchestration', 'case management', 'on-call', 'on call'], weight: 3 },
  { intent: 'risk_based_alerting', keywords: ['ueba', 'uba', 'insider', 'user behavior', 'risk score'], weight: 3 },
  { intent: 'compliance', keywords: ['compliance', 'pci', 'hipaa', 'sox', 'audit', 'gdpr'], weight: 2 },
  { intent: 'identity_access', keywords: ['identity', 'iam', 'okta', 'entra', 'sso', 'mfa', 'privileged'], weight: 2 },
  { intent: 'endpoint_security', keywords: ['edr', 'endpoint', 'crowdstrike', 'defender', 'falcon'], weight: 2 },
  { intent: 'cloud_security', keywords: ['cloud security', 'cspm', 'cwpp', 'casb', 'cloud posture'], weight: 3 },
  { intent: 'cloud_observability', keywords: ['kubernetes', 'k8s', 'container', 'microservices', 'cloud-native'], weight: 2 },
  { intent: 'observability_apm', keywords: ['observability', 'apm', 'tracing', 'opentelemetry', 'otel', 'signalfx'], weight: 3 },
  { intent: 'infrastructure_monitoring', keywords: ['infrastructure monitoring', 'capacity', 'cpu', 'memory', 'metrics'], weight: 2 },
  { intent: 'it_service_management', keywords: ['itsi', 'service health', 'kpi', 'noc', 'slo', 'it ops', 'itops'], weight: 3 },
  { intent: 'digital_experience', keywords: ['rum', 'real user', 'synthetic', 'digital experience', 'web vitals'], weight: 3 },
  { intent: 'ai_ml_predictive', keywords: ['mltk', 'machine learning toolkit', 'anomaly detection', 'forecasting', 'predictive analytics', 'baselining'], weight: 3 },
  { intent: 'network_operations', keywords: ['netops', 'netflow', 'snmp', 'cisco', 'switch', 'router'], weight: 2 },
  { intent: 'database_monitoring', keywords: ['database monitoring', 'db connect', 'sql server', 'oracle database'], weight: 2 },
  { intent: 'ot_ics', keywords: ['ot', 'ics', 'scada', 'industrial', 'plc'], weight: 3 },
  { intent: 'platform_admin', keywords: ['monitoring console', 'splunk health', 'license', 'forwarder management'], weight: 2 },
];

const SOLUTION_TYPES = new Set(['premium_solution']);
const HELPFUL_APP_TYPES = new Set(['free_app', 'splunkbase_app']);
const TA_TYPES = new Set(['technical_addon', 'connector']);
const DEP_TYPES = new Set(['prerequisite', 'content_pack']);

const CISCO_KEYWORDS = ['cisco', 'asa', 'anyconnect', 'catalyst', 'ise', 'firepower', 'ftd', 'duo', 'umbrella'];
const CLOUD_KEYWORDS = ['aws', 'azure', 'gcp', 'google cloud', 'cloudtrail', 'm365', 'office 365', 'entra', 'iaas', 'saas'];

function collectNarrative(intake) {
  return [
    intake?.goals,
    intake?.crawlGoal,
    intake?.walkGoal,
    intake?.runGoal,
    intake?.discoveryNotes,
    intake?.useCaseNotes,
    intake?.summary,
    intake?.customUseCases,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getActiveSourceIds(sourceStatuses = {}) {
  const ids = new Set();
  for (const [id, st] of Object.entries(sourceStatuses)) {
    if (st?.status === 'current' || st?.status === 'future') ids.add(id);
  }
  return ids;
}

function inferMaturityPhase(intake, budgetBand) {
  const text = collectNarrative(intake);
  if (/\bcrawl\b|phase 1|day one|pilot|poc|new to splunk/i.test(text)) return 'crawl';
  if (/\brun\b|phase 3|mature|production soc/i.test(text)) return 'run';
  if (/\bwalk\b|phase 2/i.test(text)) return 'walk';
  if (budgetBand === 'low') return 'crawl';
  if (budgetBand === 'high') return 'walk';
  return 'walk';
}

/**
 * @returns {Record<string, number>}
 */
function scoreIntents(intake, profiles) {
  /** @type {Record<string, number>} */
  const scores = {};
  const bump = (intent, w) => {
    scores[intent] = (scores[intent] || 0) + w;
  };

  for (const p of profiles) {
    const map = PROFILE_INTENT_MAP[p.id] || {};
    for (const [intent, weight] of Object.entries(map)) {
      bump(intent, weight * 4);
    }
  }

  const text = collectNarrative(intake);
  for (const row of INTENT_KEYWORDS) {
    for (const kw of row.keywords) {
      if (text.includes(kw.toLowerCase())) bump(row.intent, row.weight);
    }
  }

  if (parseCustomUseCases(intake?.customUseCases).matched.length) {
    for (const m of parseCustomUseCases(intake?.customUseCases).matched) {
      const map = PROFILE_INTENT_MAP[m.id] || {};
      for (const [intent, weight] of Object.entries(map)) {
        bump(intent, weight * 2);
      }
    }
  }

  return scores;
}

function hasIntent(scores, intent, min = 2) {
  return (scores[intent] || 0) >= min;
}

function detectCloudInScope(intake, profiles, activeSources) {
  if (isCloudSecurityInScope(intake, profiles)) return true;
  const text = collectNarrative(intake);
  if (CLOUD_KEYWORDS.some((k) => text.includes(k))) return true;
  const cloudSources = ['iaas', 'cspm', 'cwpp', 'casb', 'saas_office', 'saas_sso', 'paas', 'cloud_storage'];
  return cloudSources.some((s) => activeSources.has(s));
}

function detectCiscoInScope(intake, activeSources) {
  const text = collectNarrative(intake);
  if (CISCO_KEYWORDS.some((k) => text.includes(k))) return true;
  const ciscoSources = ['firewalls', 'vpn', 'switches', 'routers', 'wireless'];
  return ciscoSources.some((s) => activeSources.has(s));
}

function detectAppDynamicsInScope(intake) {
  const text = collectNarrative(intake);
  return /appdynamics|app dynamics|\bappd\b/i.test(text);
}

function getSourceDomains(sourceId) {
  const src = sourcesCatalog.find((s) => s.id === sourceId);
  return src?.telemetryDomains ? Object.keys(src.telemetryDomains) : [];
}

function assessReadiness(app, activeSources, plannedSources) {
  const all = new Set([...activeSources, ...plannedSources]);
  const requiredCaps = app.requiredCapabilities || [];
  const minSources = app.minimumUsefulSources || [];
  const missingSources = minSources.filter((s) => !all.has(s));
  const warnings = [];

  if (missingSources.length > 0) {
    warnings.push(`Missing planned telemetry: ${missingSources.map((s) => s.replace(/_/g, ' ')).join(', ')}`);
  }

  if (app.cimRequired && missingSources.length > 0) {
    warnings.push('CIM-normalized fields require technical add-ons and parsing before this solution is effective.');
  }

  const coverageRatio =
    minSources.length > 0 ? (minSources.length - missingSources.length) / minSources.length : 1;

  return { missingSources, warnings, coverageRatio, ready: missingSources.length === 0 && coverageRatio >= 0.67 };
}

function splunkbaseStatus(app) {
  if (!app.splunkbaseCatalogId) return 'none';
  const link = resolveSplunkbaseLink(app.splunkbaseCatalogId);
  return link?.status || 'none';
}

function customerVisibleLink(app) {
  const status = splunkbaseStatus(app);
  if (status === 'verified' || status === 'replacementPreferred') {
    const link = resolveSplunkbaseLink(app.splunkbaseCatalogId);
    return link?.customerUrl || null;
  }
  return null;
}

function buildRecommendationObject(app, ctx) {
  const {
    score,
    fit,
    phase,
    reasonCodes,
    customerReason,
    seReason,
    dependencies,
    readinessWarnings,
    sourceDrivers,
    useCaseDrivers,
    customerVisible,
    suppressed,
  } = ctx;

  return {
    appId: app.id,
    displayName: app.displayName,
    type: app.type,
    category: app.category,
    score,
    fit,
    phase,
    reasonCodes,
    customerReason,
    seReason: seReason || '',
    dependencies: dependencies || [],
    readinessWarnings: readinessWarnings || [],
    sourceDrivers: sourceDrivers || [],
    useCaseDrivers: useCaseDrivers || [],
    splunkbaseLinkStatus: splunkbaseStatus(app),
    customerUrl: customerVisibleLink(app),
    customerVisible: customerVisible !== false && !suppressed,
    needsExternalValidation: !!app.needsExternalValidation,
    recommendationCaveat: app.recommendationCaveat || '',
  };
}

function shouldGate(app, ctx) {
  const {
    intake,
    intents,
    cloudInScope,
    ciscoInScope,
    appDynamicsInScope,
    maturityPhase,
    budgetBand,
    explicitDesired,
    activeSources,
  } = ctx;
  const id = app.id;

  if (id === 'add_on_cisco_ise') {
    const iseSources = ['sso_pam', 'network_access_control', 'nac'];
    const hasIseSource = [...ctx.activeSources].some((s) => iseSources.includes(s));
    const text = collectNarrative(ctx.intake);
    if (!hasIseSource && !/\bise\b|identity services engine|network access control/i.test(text) && !explicitDesired.has(id)) {
      return { gate: true, reason: 'ise_not_in_scope' };
    }
  }

  if (id === 'cisco_networks_app') {
    const networkSources = ['switches', 'routers', 'network_devices', 'netflow'];
    const hasDedicatedNetwork = [...activeSources].some((s) => networkSources.includes(s));
    const networkIntent =
      hasIntent(intents, 'network_operations', 3) ||
      hasIntent(intents, 'network_security', 3);
    if (!hasDedicatedNetwork && !networkIntent && !explicitDesired.has(id)) {
      return { gate: true, reason: 'cisco_network_app_not_in_scope' };
    }
  }

  if (app.productFamily?.startsWith('cisco') || id.includes('cisco') || id === 'duo_connector') {
    if (!ciscoInScope && !explicitDesired.has(id)) return { gate: true, reason: 'cisco_not_in_scope' };
  }

  if (['add_on_aws', 'add_on_azure', 'add_on_gcp', 'add_on_microsoft_cloud_services', 'add_on_office_365', 'splunk_app_aws'].includes(id)) {
    if (!cloudInScope && !explicitDesired.has(id)) return { gate: true, reason: 'cloud_not_in_scope' };
  }

  if (['itsi', 'on_call'].includes(id)) {
    if (!hasIntent(intents, 'it_service_management', 3) && !explicitDesired.has(id)) {
      return { gate: true, reason: 'no_itsi_intent' };
    }
  }

  if (['observability_cloud', 'splunk_apm', 'infrastructure_monitoring', 'synthetic_monitoring', 'real_user_monitoring', 'log_observer'].includes(id)) {
    if (!hasIntent(intents, 'observability_apm', 2) && !hasIntent(intents, 'cloud_observability', 2) && !hasIntent(intents, 'infrastructure_monitoring', 2) && !hasIntent(intents, 'digital_experience', 2) && !explicitDesired.has(id)) {
      return { gate: true, reason: 'no_observability_intent' };
    }
  }

  if (id === 'appdynamics') {
    if (!appDynamicsInScope && !explicitDesired.has(id)) return { gate: true, reason: 'no_appdynamics' };
  }

  if (id === 'soar') {
    if (maturityPhase === 'crawl' && !explicitDesired.has(id)) return { gate: true, reason: 'soar_early_maturity' };
    if (!hasIntent(intents, 'incident_response', 2) && !hasIntent(intents, 'enterprise_siem', 4) && !explicitDesired.has(id)) {
      return { gate: true, reason: 'soar_no_ir_intent' };
    }
  }

  if (id === 'uba') {
    if (!hasIntent(intents, 'risk_based_alerting', 2) && !explicitDesired.has(id)) {
      return { gate: true, reason: 'uba_no_intent' };
    }
  }

  if (id === 'mission_control' || id === 'enterprise_security_premier') {
    if (maturityPhase !== 'run' && !explicitDesired.has(id)) return { gate: true, reason: 'premier_run_only' };
    if (budgetBand === 'low' && !explicitDesired.has(id)) return { gate: true, reason: 'premier_budget' };
  }

  if (id === 'machine_learning_toolkit') {
    if (!hasIntent(intents, 'ai_ml_predictive', 3) && !explicitDesired.has(id)) {
      return { gate: true, reason: 'no_ml_intent' };
    }
  }

  if (id === 'ai_toolkit') {
    const text = collectNarrative(ctx.intake);
    if (!/\bai toolkit\b|\baitk\b/i.test(text) && !explicitDesired.has(id)) {
      return { gate: true, reason: 'aitk_explicit_only' };
    }
  }

  if (id === 'data_science_deep_learning') {
    if (!/\bdeep learning\b|\bdata science\b|\bdsdl\b/i.test(collectNarrative(ctx.intake)) && !explicitDesired.has(id)) {
      return { gate: true, reason: 'dsdl_advanced_only' };
    }
  }

  if (id === 'enterprise_security') {
    if (!ctx.esEligibility?.esEligible && !explicitDesired.has(id)) {
      return { gate: true, reason: 'es_not_ready' };
    }
    const lightOnly =
      hasIntent(intents, 'foundational_security', 3) &&
      !hasIntent(intents, 'enterprise_siem', 4) &&
      !explicitDesired.has(id);
    if (lightOnly && maturityPhase === 'crawl' && budgetBand === 'low') {
      return { gate: true, reason: 'es_too_heavy_for_crawl' };
    }
  }

  if (id === 'escu' && !ctx.esEligibility?.esEligible && !explicitDesired.has('enterprise_security')) {
    return { gate: true, reason: 'escu_requires_es' };
  }

  if (id === 'on_call') {
    if (!hasIntent(intents, 'incident_response', 2) && !hasIntent(intents, 'it_service_management', 3) && !explicitDesired.has(id)) {
      return { gate: true, reason: 'on_call_not_in_scope' };
    }
  }

  return { gate: false };
}

function scoreApp(app, ctx) {
  let score = 0;
  const reasonCodes = [];
  const useCaseDrivers = [];
  const sourceDrivers = [];

  const { intents, explicitDesired, activeSources, maturityPhase, budgetBand, readiness } = ctx;

  if (explicitDesired.has(app.id)) {
    score += 40;
    reasonCodes.push('user_selected');
  }

  for (const trigger of app.intentTriggers || []) {
    if (hasIntent(intents, trigger, 2)) {
      score += 15;
      reasonCodes.push(`intent_${trigger}`);
      useCaseDrivers.push(trigger.replace(/_/g, ' '));
    }
  }

  const text = collectNarrative(ctx.intake);
  for (const kw of app.keywordTriggers || []) {
    if (text.includes(kw.toLowerCase())) {
      score += 4;
      reasonCodes.push('keyword_match');
      break;
    }
  }

  for (const src of app.sourceTriggers || []) {
    if (activeSources.has(src)) {
      score += 12;
      sourceDrivers.push(src.replace(/_/g, ' '));
      reasonCodes.push('source_active');
    }
  }

  for (const src of app.minimumUsefulSources || []) {
    if (activeSources.has(src)) {
      score += 6;
      if (!sourceDrivers.includes(src.replace(/_/g, ' '))) sourceDrivers.push(src.replace(/_/g, ' '));
    }
  }

  if (app.maturityFit?.includes(maturityPhase)) score += 8;

  const budgetRank = { low: 0, medium: 1, high: 2 };
  const appBudget = budgetRank[app.budgetSensitivity] ?? 1;
  const custBudget = budgetRank[budgetBand] ?? 1;
  if (appBudget <= custBudget) score += 5;
  else score -= 10;

  if (readiness.ready) score += 12;
  else if (readiness.coverageRatio >= 0.33) score += 4;
  else score -= 8;

  if (app.type === 'prerequisite' || app.type === 'content_pack') score = Math.min(score, 30);

  return { score, reasonCodes, useCaseDrivers, sourceDrivers };
}

function fitFromScore(score, readiness, gated) {
  if (gated) return 'weak';
  if (!readiness.ready && score > 20) return 'weak';
  if (score >= 45 && readiness.ready) return 'strong';
  if (score >= 28) return 'moderate';
  return 'weak';
}

function phaseForApp(app, maturityPhase, explicitDesired, id) {
  if (explicitDesired.has(id)) return maturityPhase;
  if (app.maturityFit?.includes('crawl')) return 'crawl';
  if (app.maturityFit?.includes('walk')) return 'walk';
  return maturityPhase === 'run' ? 'run' : 'walk';
}

function customerReasonFor(app, ctx) {
  const parts = [];
  if (ctx.explicitDesired.has(app.id)) {
    parts.push(`You selected ${app.displayName}.`);
  }
  if (ctx.useCaseDrivers.length) {
    parts.push(`Aligned with ${ctx.useCaseDrivers.slice(0, 2).join(' and ')} goals.`);
  }
  if (ctx.sourceDrivers.length) {
    parts.push(`Supports telemetry from ${ctx.sourceDrivers.slice(0, 3).join(', ')}.`);
  }
  if (!parts.length) {
    parts.push(app.customerDescription || app.displayName);
  }
  if (ctx.readiness.warnings.length) {
    parts.push(`Readiness: ${ctx.readiness.warnings[0]}`);
  }
  if (app.needsExternalValidation) {
    parts.push('Validate availability and entitlement with your account team.');
  }
  return parts.join(' ').trim();
}

function addDependencies(app, recommendedIds, depsOut) {
  for (const depId of app.requiresApps || []) {
    const canonical = resolveCanonicalAppId(depId);
    if (!canonical || recommendedIds.has(canonical)) continue;
    const dep = BY_ID.get(canonical);
    if (!dep) continue;
    depsOut.push(
      buildRecommendationObject(dep, {
        score: 20,
        fit: 'moderate',
        phase: 'walk',
        reasonCodes: ['dependency'],
        customerReason: `Recommended as a readiness dependency for ${app.displayName}.`,
        seReason: dep.recommendationCaveat,
        dependencies: [],
        readinessWarnings: [],
        sourceDrivers: [],
        useCaseDrivers: [],
        customerVisible: dep.customerFacing !== false,
      }),
    );
    recommendedIds.add(canonical);
  }
}

/**
 * Main recommendation entry point.
 * @param {object} params
 */
export function recommendApps({
  intake = {},
  sourceStatuses = {},
  useCaseProfiles: profilesOverride,
  budgetBand: budgetBandOverride,
  deploymentType,
} = {}) {
  const effectiveIntake = withEffectiveGoals(intake);
  const { profiles } = profilesOverride
    ? { profiles: profilesOverride }
    : resolveUseCaseProfiles(effectiveIntake);

  const budgetBand = budgetBandOverride || getBudgetSensitivityBand(effectiveIntake);
  const deploy = deploymentType || effectiveIntake.deploymentType || 'cloud';
  const activeSources = getActiveSourceIds(sourceStatuses);
  const plannedSources = activeSources;
  const maturityPhase = inferMaturityPhase(effectiveIntake, budgetBand);
  const intents = scoreIntents(effectiveIntake, profiles);

  const explicitDesired = new Set();
  for (const raw of effectiveIntake.desiredApps || []) {
    const id = resolveCanonicalAppId(raw);
    if (id) explicitDesired.add(id);
  }

  const cloudInScope = detectCloudInScope(effectiveIntake, profiles, activeSources);
  const ciscoInScope = detectCiscoInScope(effectiveIntake, activeSources);
  const appDynamicsInScope = detectAppDynamicsInScope(effectiveIntake);
  const esEligibility = assessEnterpriseSecurityEligibility(effectiveIntake);

  const ctxBase = {
    intake: effectiveIntake,
    intents,
    explicitDesired,
    activeSources,
    plannedSources,
    maturityPhase,
    budgetBand,
    cloudInScope,
    ciscoInScope,
    appDynamicsInScope,
    deploy,
    esEligibility,
  };

  /** @type {Map<string, object>} */
  const scored = new Map();
  const suppressed = [];
  const warnings = [];
  const explanation = [];

  for (const app of APPS) {
    const gate = shouldGate(app, ctxBase);
    const readiness = assessReadiness(app, activeSources, plannedSources);
    const { score, reasonCodes, useCaseDrivers, sourceDrivers } = scoreApp(app, {
      ...ctxBase,
      readiness,
    });

    const itemCtx = {
      ...ctxBase,
      readiness,
      useCaseDrivers,
      sourceDrivers,
    };

    if (gate.gate && !explicitDesired.has(app.id)) {
      suppressed.push({
        appId: app.id,
        displayName: app.displayName,
        reasonCode: gate.reason,
        customerReason: `Deferred: ${app.displayName} is not prioritized for the current scope (${gate.reason.replace(/_/g, ' ')}).`,
      });
      continue;
    }

    if (score < 8 && !explicitDesired.has(app.id)) continue;

    const fit = fitFromScore(score, readiness, false);
    const phase = phaseForApp(app, maturityPhase, explicitDesired, app.id);
    const needsReadiness = !readiness.ready && (SOLUTION_TYPES.has(app.type) || explicitDesired.has(app.id));

    const rec = buildRecommendationObject(app, {
      score,
      fit: needsReadiness && fit === 'strong' ? 'moderate' : fit,
      phase,
      reasonCodes,
      customerReason: customerReasonFor(app, itemCtx),
      seReason: app.recommendationCaveat,
      dependencies: app.requiresApps || [],
      readinessWarnings: readiness.warnings,
      sourceDrivers,
      useCaseDrivers,
      customerVisible: app.customerFacing !== false,
      suppressed: false,
    });

    scored.set(app.id, rec);
  }

  const hasExplicitEs = explicitDesired.has('enterprise_security');
  const strongSiem = hasIntent(intents, 'enterprise_siem', 5) || hasExplicitEs;
  const foundational = hasIntent(intents, 'foundational_security', 3) || profiles.some((p) => p.id === 'foundational_security');

  if (!esEligibility.esEligible && !hasExplicitEs) {
    for (const id of ['enterprise_security', 'enterprise_security_premier', 'escu', 'mission_control']) {
      if (!explicitDesired.has(id)) scored.delete(id);
    }
    if (foundational || hasIntent(intents, 'foundational_security', 2)) {
      for (const id of ['security_essentials', 'infosec_app']) {
        const app = BY_ID.get(id);
        if (!app) continue;
        const readiness = assessReadiness(app, activeSources, plannedSources);
        const existing = scored.get(id);
        scored.set(
          id,
          buildRecommendationObject(app, {
            score: Math.max(existing?.score ?? 0, 42),
            fit: 'strong',
            phase: maturityPhase === 'run' ? 'walk' : maturityPhase,
            reasonCodes: ['foundational_track', ...(existing?.reasonCodes || [])],
            customerReason:
              id === 'infosec_app'
                ? 'Operational security dashboards for teams building visibility before full SIEM deployment.'
                : 'Prebuilt security content and searches — a practical starting point before Enterprise Security.',
            seReason: app.recommendationCaveat,
            dependencies: [],
            readinessWarnings: readiness.warnings,
            sourceDrivers: existing?.sourceDrivers || [],
            useCaseDrivers: ['foundational security'],
            customerVisible: true,
          }),
        );
      }
    }
  }

  if (foundational && !strongSiem && maturityPhase === 'crawl') {
    for (const id of ['soar', 'uba']) {
      if (!explicitDesired.has(id)) scored.delete(id);
    }
  }

  const text = collectNarrative(intake);
  if (/\bsecurity\b/.test(text) && !strongSiem && !hasExplicitEs && !esEligibility.esEligible) {
    scored.delete('enterprise_security');
  }

  const recommendedSolutions = [];
  const helpfulApps = [];
  const technicalAddons = [];
  const dependencies = [];
  const needsReadiness = [];

  const sorted = [...scored.values()].sort((a, b) => b.score - a.score);
  const recommendedIds = new Set();

  for (const rec of sorted) {
    if (SOLUTION_TYPES.has(rec.type)) {
      if (rec.fit === 'weak' && !explicitDesired.has(rec.appId)) continue;
      recommendedSolutions.push(rec);
      recommendedIds.add(rec.appId);
      const app = BY_ID.get(rec.appId);
      if (app) addDependencies(app, recommendedIds, dependencies);
      if (rec.readinessWarnings?.length) needsReadiness.push(rec);
    } else if (HELPFUL_APP_TYPES.has(rec.type)) {
      helpfulApps.push(rec);
      recommendedIds.add(rec.appId);
    } else if (TA_TYPES.has(rec.type)) {
      technicalAddons.push(rec);
      recommendedIds.add(rec.appId);
    } else if (DEP_TYPES.has(rec.type)) {
      dependencies.push(rec);
      recommendedIds.add(rec.appId);
    }
  }

  // Explicit desired not yet placed
  for (const id of explicitDesired) {
    if (recommendedIds.has(id)) continue;
    const app = BY_ID.get(id);
    if (!app) continue;
    const readiness = assessReadiness(app, activeSources, plannedSources);
    const rec = buildRecommendationObject(app, {
      score: 50,
      fit: readiness.ready ? 'moderate' : 'weak',
      phase: maturityPhase,
      reasonCodes: ['user_selected'],
      customerReason: `You selected ${app.displayName} — confirm telemetry and licensing fit during discovery.`,
      seReason: app.recommendationCaveat,
      dependencies: app.requiresApps || [],
      readinessWarnings: readiness.warnings,
      sourceDrivers: [],
      useCaseDrivers: [],
      customerVisible: true,
    });
    if (SOLUTION_TYPES.has(app.type)) recommendedSolutions.push(rec);
    else if (TA_TYPES.has(app.type)) technicalAddons.push(rec);
    else helpfulApps.push(rec);
    recommendedIds.add(id);
    addDependencies(app, recommendedIds, dependencies);
  }

  recommendedSolutions.sort((a, b) => b.score - a.score);
  helpfulApps.sort((a, b) => b.score - a.score);
  technicalAddons.sort((a, b) => b.score - a.score);

  const primaryRecommendationSummary =
    recommendedSolutions[0]?.customerReason ||
    helpfulApps[0]?.customerReason ||
    'Add use cases and data sources to refine product recommendations.';

  if (recommendedSolutions.some((r) => r.appId === 'enterprise_security')) {
    explanation.push('Enterprise Security recommendation includes CIM normalization and content planning (ESCU) as readiness items.');
  } else if (!esEligibility.esEligible) {
    explanation.push(esEligibility.rationale[0] || 'Foundational InfoSec track recommended over Enterprise Security for current maturity.');
  }

  return {
    recommendedSolutions,
    helpfulApps,
    technicalAddons,
    dependencies,
    suppressed,
    needsReadiness,
    explanation,
    primaryRecommendationSummary,
    warnings,
    meta: {
      maturityPhase,
      budgetBand,
      cloudInScope,
      ciscoInScope,
      intentScores: intents,
      esEligibility,
    },
    esEligibility,
  };
}

/**
 * Convenience wrapper for session state.
 * @param {object} state
 */
export function recommendAppsFromSession(state) {
  const { profiles } = resolveUseCaseProfiles(state.intake || {});
  return recommendApps({
    intake: state.intake || {},
    sourceStatuses: state.sources || {},
    useCaseProfiles: profiles,
  });
}

/**
 * Flat list of display names for backward compatibility (deprecated).
 * @param {ReturnType<typeof recommendApps>} result
 */
export function flattenRecommendationNames(result) {
  return [
    ...result.recommendedSolutions,
    ...result.helpfulApps,
  ]
    .filter((r) => r.customerVisible)
    .map((r) => r.displayName);
}

export { resolveCanonicalAppId, getAppCatalogEntry, getAllCatalogApps };
