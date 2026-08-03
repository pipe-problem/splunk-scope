/**
 * Structured goal → app → source knowledge for the Analysis page.
 * Extensible JSON seed — not a live Splunkbase crawl.
 */
import knowledge from '../data/goalAppSourceKnowledge.json' with { type: 'json' };
import { resolveUseCaseProfiles } from './useCaseResolver.js';

/** @type {Map<string, object>} */
const GOALS_BY_ID = new Map(knowledge.goals.map((g) => [g.id, g]));

/** @type {Map<string, object>} */
const APPS_BY_ID = new Map(knowledge.apps.map((a) => [a.id, a]));

/** @type {Map<string, object>} */
const ADDONS_BY_ID = new Map(knowledge.addons.map((a) => [a.id, a]));

/** Use case profile id → knowledge goal id (ML only when profile is explicitly selected). */
const PROFILE_TO_GOAL_ID = {
  enterprise_security: 'siem',
  foundational_security: 'siem',
  threat_detection: 'siem',
  risk_based_alerting: 'rba',
  compliance_audit: 'compliance',
  cloud_security: 'cloud_security',
  platform_admin: 'platform_admin',
  ai_ml_analytics: 'ml_analytics',
};

/** Splunk app id → goal id hints when apps are named on intake (not bare AI keywords). */
const APP_ID_TO_GOAL_ID = {
  enterprise_security: 'siem',
  mission_control: 'siem',
  soar: 'siem',
  security_essentials: 'siem',
  infosec_app: 'siem',
  user_behavior_analytics: 'rba',
  risk_based_alerting: 'rba',
  pci_compliance: 'compliance',
  hipaa_healthcare_audit: 'compliance',
  sox_audit: 'compliance',
  audit_compliance_reporting: 'compliance',
  cloud_aws_apps: 'cloud_security',
  cloud_azure_apps: 'cloud_security',
  cloud_google_apps: 'cloud_security',
  cloud_microsoft_365_apps: 'cloud_security',
  monitoring_console: 'platform_admin',
  enterprise: 'platform_admin',
  deployment_server: 'platform_admin',
  data_manager: 'platform_admin',
  app_pci_compliance: 'compliance',
  machine_learning_toolkit: 'ml_analytics',
  ai_toolkit: 'ml_analytics',
  app_data_science_deep_learning: 'ml_analytics',
};

export function getKnowledgeBase() {
  return knowledge;
}

/**
 * Goals relevant to intake selections — driven by resolved use case profiles and named apps.
 * ML goal requires the anchored AI/ML use case profile or an explicit ML app selection.
 * @param {object} intake
 * @returns {object[]}
 */
export function getGoalsForIntake(intake = {}) {
  const matchedGoalIds = new Set();
  const { profiles } = resolveUseCaseProfiles(intake);

  for (const profile of profiles) {
    const goalId = PROFILE_TO_GOAL_ID[profile.id];
    if (goalId) matchedGoalIds.add(goalId);
  }

  for (const rawId of [...(intake.desiredApps || []), ...(intake.recommendedApps || [])]) {
    const appId = String(rawId).startsWith('custom:') ? null : String(rawId);
    if (!appId) continue;
    const goalId = APP_ID_TO_GOAL_ID[appId];
    if (goalId) matchedGoalIds.add(goalId);
  }

  return knowledge.goals.filter((g) => matchedGoalIds.has(g.id));
}

/**
 * @param {string} goalId
 * @returns {object[]}
 */
export function getAppsForGoal(goalId) {
  const goal = GOALS_BY_ID.get(goalId);
  if (!goal) return [];
  return (goal.appIds || [])
    .map((id) => APPS_BY_ID.get(id))
    .filter(Boolean);
}

/**
 * @param {string} appId
 * @returns {{ requiredSourceIds: string[], recommendedSourceIds: string[], allSourceIds: string[] }|null}
 */
export function getSourcesForApp(appId) {
  const app = APPS_BY_ID.get(appId);
  if (!app) return null;
  const requiredSourceIds = [...(app.requiredSourceIds || [])];
  const recommendedSourceIds = [...(app.recommendedSourceIds || [])];
  const allSourceIds = [...new Set([...requiredSourceIds, ...recommendedSourceIds])];
  return { requiredSourceIds, recommendedSourceIds, allSourceIds };
}

/**
 * Technical add-ons that support a catalog source id.
 * @param {string} sourceId
 * @returns {object[]}
 */
export function getAddonsForSource(sourceId) {
  if (!sourceId) return [];
  return knowledge.addons.filter((addon) => (addon.sourceIds || []).includes(sourceId));
}

export { GOALS_BY_ID, APPS_BY_ID, ADDONS_BY_ID };
