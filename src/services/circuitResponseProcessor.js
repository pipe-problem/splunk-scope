/**
 * Processes pasted Circuit JSON responses into intake-ready fields.
 * Falls back to heuristic parseCustomerContext on failure.
 */
import useCaseProfiles from '../data/useCaseProfiles.json';
import { DEFAULT_PATH_BUDGET_PERCENTAGES } from '../config/intakeDefaults.js';
import {
  DEFAULT_GOAL_PRESET_IDS,
  getGoalPresetById,
  isValidGoalPresetId,
} from '../utils/goalPresets.js';
import { parseCustomerContext } from './contextImportEngine.js';
import {
  matchSplunkAppToken,
  matchSourceHint,
  normalizeDeploymentType,
  filterIntakeAppIds,
} from './intakeImportHelpers.js';

const USE_CASE_BY_NAME = new Map(useCaseProfiles.map((p) => [p.name.toLowerCase(), p.name]));
const USE_CASE_BY_ID = new Map(useCaseProfiles.map((p) => [p.id, p.name]));

/**
 * Extract JSON object from raw pasted text (handles markdown fences).
 * @param {string} text
 * @returns {object|null}
 */
export function extractJsonFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    // continue
  }

  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // continue
    }
  }

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }

  return null;
}

function mapUseCaseName(token) {
  const raw = String(token || '').trim();
  if (!raw) return null;
  const byName = USE_CASE_BY_NAME.get(raw.toLowerCase());
  if (byName) return byName;
  const byId = USE_CASE_BY_ID.get(raw);
  if (byId) return byId;
  for (const [key, name] of USE_CASE_BY_NAME) {
    if (key.includes(raw.toLowerCase()) || raw.toLowerCase().includes(key)) return name;
  }
  return null;
}

function mapUseCases(list, warnings, fieldLabel) {
  const matched = [];
  const unmatched = [];
  for (const item of list || []) {
    const name = mapUseCaseName(item);
    if (name) matched.push(name);
    else if (String(item || '').trim()) {
      unmatched.push(String(item).trim());
      warnings.push(`Unmatched ${fieldLabel}: ${String(item).trim()}`);
    }
  }
  return { matched: [...new Set(matched)], unmatched };
}

function mapSplunkApps(list, warnings) {
  const ids = [];
  const labels = [];
  for (const item of list || []) {
    const { id, label } = matchSplunkAppToken(item);
    if (id) {
      if (filterIntakeAppIds([id]).length) {
        ids.push(id);
        labels.push(label);
      } else {
        warnings.push(`Add-on excluded from intake apps: ${label}`);
      }
    } else if (label) {
      warnings.push(`Unmatched Splunk app: ${label}`);
      labels.push(label);
    }
  }
  return { ids: [...new Set(ids)], labels, unmatchedLabels: labels.filter((l) => !matchSplunkAppToken(l).id) };
}

function mapPathBudgetPercentages(raw, warnings) {
  const defaults = { ...DEFAULT_PATH_BUDGET_PERCENTAGES };
  if (!raw || typeof raw !== 'object') return defaults;
  const out = { ...defaults };
  for (const phase of ['crawl', 'walk', 'run']) {
    const value = raw[phase];
    if (value == null || value === '') continue;
    const num = parseInt(String(value), 10);
    if (!Number.isFinite(num) || num < 1 || num > 200) {
      warnings.push(`Invalid pathBudgetPercentages.${phase}: ${value}`);
      continue;
    }
    out[phase] = num;
  }
  return out;
}

function mapGoalPresetId(phase, id, warnings) {
  const raw = id == null || id === '' ? null : String(id).trim();
  if (!raw) return '';
  if (isValidGoalPresetId(phase, raw)) return raw;
  warnings.push(`Invalid ${phase} goal preset ID: ${raw}`);
  return '';
}

function mapSourceHints(dataSources, warnings) {
  const hints = [];
  for (const row of dataSources || []) {
    if (!row || typeof row !== 'object') continue;
    const sourceName = row.sourceName || row.name || '';
    const vendor = row.vendor || null;
    const product = row.product || null;
    let sourceId = row.sourceId || null;
    if (sourceId && !matchSourceHint(sourceId, null, null)) {
      warnings.push(`Unknown sourceId from Circuit: ${sourceId}`);
      sourceId = matchSourceHint(sourceName, vendor, product);
    } else if (!sourceId) {
      sourceId = matchSourceHint(sourceName, vendor, product);
    }
    if (!sourceId && (sourceName || vendor || product)) {
      warnings.push(`Could not map data source: ${[sourceName, vendor, product].filter(Boolean).join(' / ')}`);
    }
    hints.push({
      sourceName: String(sourceName || '').trim(),
      sourceId,
      vendor: vendor ? String(vendor).trim() : null,
      product: product ? String(product).trim() : null,
      count: row.count != null && !Number.isNaN(Number(row.count)) ? Number(row.count) : null,
      environment: row.environment || 'unknown',
      status: row.status || 'current',
      notes: String(row.notes || '').trim(),
    });
  }
  return hints;
}

function buildDiscoveryNotes(payload, sourceHints) {
  const parts = [];
  if (payload.summary?.trim()) parts.push(payload.summary.trim());
  if (payload.discoveryNotes?.trim()) parts.push(payload.discoveryNotes.trim());
  if (payload.importantRequirements?.length) {
    parts.push(`Important requirements:\n${payload.importantRequirements.map((r) => `- ${r}`).join('\n')}`);
  }
  if (payload.knownGaps?.length) {
    parts.push(`Known gaps:\n${payload.knownGaps.map((g) => `- ${g}`).join('\n')}`);
  }
  if (sourceHints.length) {
    const lines = sourceHints.map((h) => {
      const bits = [h.sourceName || h.sourceId, h.vendor, h.product, h.count != null ? `count: ${h.count}` : null, h.notes]
        .filter(Boolean);
      return `- ${bits.join(' | ')}`;
    });
    parts.push(`Data sources (from Circuit):\n${lines.join('\n')}`);
  }
  return parts.join('\n\n').trim();
}

/**
 * @param {string} pastedText
 * @returns {import('./circuitResponseProcessor.js').CircuitProcessResult}
 */
export function processCircuitResponse(pastedText) {
  const warnings = [];
  const needsReview = [];

  const json = extractJsonFromText(pastedText);
  if (!json || typeof json !== 'object') {
    const fallbackText = String(pastedText || '').trim();
    if (fallbackText.length > 20) {
      const heuristic = parseCustomerContext(fallbackText);
      return {
        parsed: true,
        source: 'heuristic_fallback',
        fields: {
          customerName: heuristic.customerName || '',
          deploymentType: normalizeDeploymentType(heuristic.deploymentModel),
          budget: null,
          discoveryNotes: buildHeuristicNotes(heuristic),
          customUseCases: '',
          useCases: heuristic.useCases || [],
          desiredApps: filterIntakeAppIds(
            (heuristic.splunkApps || []).map((l) => matchSplunkAppToken(l).id || `custom:${l}`),
          ),
          crawlGoalPresetId: '',
          walkGoalPresetId: '',
          runGoalPresetId: '',
          pathBudgetPercentages: { ...DEFAULT_PATH_BUDGET_PERCENTAGES },
          sourceHints: [],
        },
        warnings: ['Could not parse JSON — used pattern-matching fallback. Ask Circuit to return JSON only for best results.'],
        needsReview: heuristic.unknowns || [],
        openQuestions: [],
        confidence: heuristic.confidence || 'low',
        raw: heuristic,
        parseError: 'Invalid or missing JSON — heuristic fallback applied.',
      };
    }
    return {
      parsed: false,
      source: 'circuit_json',
      fields: null,
      warnings: [],
      needsReview: [],
      openQuestions: [],
      confidence: 'low',
      raw: null,
      parseError: 'Could not parse JSON. Ask Circuit to return JSON only (no markdown).',
    };
  }

  const primary = mapUseCases(json.primaryUseCases, warnings, 'primary use case');
  const secondary = mapUseCases(json.secondaryUseCases, warnings, 'secondary use case');
  const useCases = [...new Set([...primary.matched, ...secondary.matched])];
  needsReview.push(...primary.unmatched, ...secondary.unmatched);

  const apps = mapSplunkApps(json.splunkApps, warnings);
  needsReview.push(...apps.unmatchedLabels);

  const deploymentType = normalizeDeploymentType(json.deploymentType);
  if (json.deploymentType && deploymentType === 'unknown' && String(json.deploymentType).toLowerCase() !== 'unknown') {
    warnings.push(`Unrecognized deploymentType: ${json.deploymentType}`);
    needsReview.push(`Deployment: ${json.deploymentType}`);
  }

  let budget = null;
  if (json.budget != null && json.budget !== '') {
    const num = Number(String(json.budget).replace(/[,$]/g, ''));
    if (!Number.isNaN(num) && num > 0) budget = num;
    else warnings.push(`Invalid budget value: ${json.budget}`);
  }

  const crawlGoalPresetId = mapGoalPresetId('crawl', json.crawlGoalPresetId, warnings) ||
    (json.crawlGoalPresetId ? '' : '');
  const walkGoalPresetId = mapGoalPresetId('walk', json.walkGoalPresetId, warnings) ||
    (json.walkGoalPresetId ? '' : '');
  const runGoalPresetId = mapGoalPresetId('run', json.runGoalPresetId, warnings) ||
    (json.runGoalPresetId ? '' : '');

  const sourceHints = mapSourceHints(json.dataSources, warnings);
  const pathBudgetPercentages = mapPathBudgetPercentages(json.pathBudgetPercentages, warnings);
  const openQuestions = (json.openQuestions || []).map((q) => String(q).trim()).filter(Boolean);
  const confidence = json.confidence?.overall || 'medium';

  if (confidence === 'low') {
    needsReview.push('Circuit reported low overall confidence.');
  }
  if (json.confidence?.notes) {
    warnings.push(`Circuit confidence note: ${json.confidence.notes}`);
  }
  if (budget != null) {
    needsReview.push(`Budget ${budget} — confirm before applying to planning budget.`);
  }

  return {
    parsed: true,
    source: 'circuit_json',
    fields: {
      customerName: json.customerName ? String(json.customerName).trim() : '',
      deploymentType,
      budget,
      discoveryNotes: buildDiscoveryNotes(json, sourceHints),
      customUseCases: '',
      useCases,
      desiredApps: apps.ids,
      crawlGoalPresetId,
      walkGoalPresetId,
      runGoalPresetId,
      pathBudgetPercentages,
      sourceHints,
    },
    warnings,
    needsReview,
    openQuestions,
    confidence,
    raw: json,
    parseError: null,
  };
}

function buildHeuristicNotes(heuristic) {
  const bits = [];
  if (heuristic.vendors?.length) bits.push(`Vendors noted: ${heuristic.vendors.join(', ')}`);
  if (heuristic.dataSources?.length) bits.push(`Data sources: ${heuristic.dataSources.join(', ')}`);
  if (heuristic.unknowns?.length) bits.push(`Confirm during intake: ${heuristic.unknowns.join('; ')}`);
  return bits.join('\n');
}

export function getDefaultGoalPresetIds() {
  return { ...DEFAULT_GOAL_PRESET_IDS };
}

export function resolveGoalPresetLabel(phase, id) {
  const preset = getGoalPresetById(phase, id);
  return preset?.label ?? id ?? '';
}
