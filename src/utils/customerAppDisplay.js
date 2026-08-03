/**
 * Customer-facing Splunk app labels (demo-safe — AITK not MLTK).
 */
import { getFlatSplunkApps } from '../services/splunkAppsCatalog.js';
import { APPS_BY_ID } from '../services/goalAppSourceKnowledge.js';

const FLAT_NAME = new Map(getFlatSplunkApps().map((a) => [a.id, a.name]));

const AITK_IDS = new Set(['machine_learning_toolkit', 'ai_toolkit', 'mltk', 'aitk']);

const INTAKE_KNOWLEDGE_ALIASES = {
  app_pci_compliance: 'pci_compliance',
  pci_compliance: 'pci_compliance',
  machine_learning_toolkit: 'machine_learning_toolkit',
  ai_toolkit: 'machine_learning_toolkit',
};

export const SPLUNK_AI_TOOLKIT_LABEL = 'Splunk AI Toolkit';
export const AITK_SHORT_LABEL = 'AITK';

/**
 * Map intake / catalog app id to goalAppSourceKnowledge id.
 * @param {string} appId
 */
export function resolveKnowledgeAppId(appId) {
  if (!appId) return appId;
  return INTAKE_KNOWLEDGE_ALIASES[appId] || appId;
}

/**
 * Customer-visible app name — never "MLTK" or "Machine Learning Toolkit" in demo UI.
 * @param {string} appId
 * @param {string} [fallbackName]
 */
export function getCustomerAppDisplayName(appId, fallbackName) {
  const id = String(appId || '');
  if (AITK_IDS.has(id)) return SPLUNK_AI_TOOLKIT_LABEL;
  const name = fallbackName || FLAT_NAME.get(id) || APPS_BY_ID.get(id)?.name || id;
  if (/machine learning toolkit|\bmltk\b/i.test(name)) return SPLUNK_AI_TOOLKIT_LABEL;
  if (/^Splunk AI Toolkit$/i.test(name)) return SPLUNK_AI_TOOLKIT_LABEL;
  return name;
}

/**
 * @param {string} appId
 */
export function getCustomerAppShortName(appId) {
  if (AITK_IDS.has(String(appId || ''))) return AITK_SHORT_LABEL;
  return null;
}
