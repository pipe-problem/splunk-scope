/**
 * Builds a copyable prompt for Cursor-assisted structured intake extraction.
 * No network calls — SE copies prompt into Cursor manually.
 */
import useCaseProfiles from '../data/useCaseProfiles.json';
import { getAllGoalPresetIds, getGoalPresetsForPhase } from '../utils/goalPresets.js';
import { getAllowedIntakeSplunkAppIds } from './intakeImportHelpers.js';
import { getIntakeSplunkAppsCatalog } from './splunkAppsCatalog.js';
import { buildSourceCatalogAppendix } from './importSourceMapper.js';

const ALLOWED_DEPLOYMENT = ['cloud', 'onprem', 'hybrid', 'unknown'];

function formatPresetList(phase) {
  return getGoalPresetsForPhase(phase)
    .map((p) => `  - ${p.id}: ${p.label}`)
    .join('\n');
}

/**
 * @returns {string} Full prompt text for Cursor-assisted import
 */
export function buildCircuitExtractionPrompt() {
  const useCaseNames = useCaseProfiles.map((p) => p.name);
  const apps = getIntakeSplunkAppsCatalog().flatMap((cat) => cat.apps);
  const appLines = apps.map((a) => `  - ${a.id}: ${a.name}`).join('\n');
  const presetIds = getAllGoalPresetIds();
  const sourceCatalogAppendix = buildSourceCatalogAppendix();

  return [
    'You are helping prepare structured intake for Splunk Scope — a Splunk sales engineering planning tool.',
    '',
    'Analyze the customer notes pasted AFTER this prompt (and any attached PDFs or emails). Return JSON only.',
    'Do not include markdown. Do not include explanations outside JSON.',
    '',
    'Extract only what is stated or strongly implied in the notes.',
    'Do not invent budget, product counts, deployment details, or Splunk apps not mentioned.',
    'If unsure, return null, empty arrays, or generic default preset IDs listed below.',
    '',
    'Return this exact JSON shape:',
    '{',
    '  "customerName": null,',
    '  "deploymentType": "unknown",',
    '  "budget": null,',
    '  "summary": "",',
    '  "discoveryNotes": "",',
    '  "aiSummary": {',
    '    "useCaseAssessment": "",',
    '    "recommendedSplunkCapabilities": [],',
    '    "recommendedAppIds": []',
    '  },',
    '  "primaryUseCases": [],',
    '  "secondaryUseCases": [],',
    '  "splunkApps": [],',
    '  "crawlGoalPresetId": null,',
    '  "walkGoalPresetId": null,',
    '  "runGoalPresetId": null,',
    '  "pathBudgetPercentages": {',
    '    "crawl": 80,',
    '    "walk": 100,',
    '    "run": 110',
    '  },',
    '  "dataSources": [',
    '    {',
    '      "sourceName": "",',
    '      "sourceId": null,',
    '      "vendor": null,',
    '      "product": null,',
    '      "count": null,',
    '      "inputs": {},',
    '      "confidence": "low | medium | high",',
    '      "skipReason": null,',
    '      "environment": "unknown",',
    '      "status": "current",',
    '      "notes": ""',
    '    }',
    '  ],',
    '  "importantRequirements": [],',
    '  "knownGaps": [],',
    '  "openQuestions": [],',
    '  "confidence": {',
    '    "overall": "low | medium | high",',
    '    "notes": ""',
    '  }',
    '}',
    '',
    'Allowed deploymentType values (use exactly one):',
    ALLOWED_DEPLOYMENT.map((d) => `  - ${d}`).join('\n'),
    '',
    'Allowed use case names (use exactly — primaryUseCases and secondaryUseCases):',
    useCaseNames.map((n) => `  - ${n}`).join('\n'),
    '',
    'Allowed Splunk app IDs (splunkApps and aiSummary.recommendedAppIds — use IDs exactly):',
    appLines,
    '',
    'Allowed crawl goal preset IDs (crawlGoalPresetId — use one ID exactly, or null):',
    formatPresetList('crawl'),
    '',
    'Default crawl if unsure: crawl_foundational_visibility',
    '',
    'Allowed walk goal preset IDs (walkGoalPresetId):',
    formatPresetList('walk'),
    '',
    'Default walk if unsure: walk_expand_correlation',
    '',
    'Allowed run goal preset IDs (runGoalPresetId):',
    formatPresetList('run'),
    '',
    'Default run if unsure: run_optimize_and_mature',
    '',
    'All valid preset IDs (reference):',
    `  crawl: ${presetIds.crawl.join(', ')}`,
    `  walk: ${presetIds.walk.join(', ')}`,
    `  run: ${presetIds.run.join(', ')}`,
    '',
    sourceCatalogAppendix,
    '',
    'Source confidence rules (critical):',
    '- Set dataSources[].confidence to "high" ONLY when sourceId, explicit count, and vendor (if required) are clear in the notes.',
    '- Use "medium" when the source is likely but count or vendor needs SE confirmation.',
    '- Use "low" for vague mentions (e.g. "some cloud stuff", "maybe O365") — set skipReason explaining why.',
    '- Populate inputs with catalog primary field names when known (e.g. number_of_endpoints, number_of_dcs).',
    '- Do NOT size sources you cannot map to a catalog sourceId.',
    '',
    'aiSummary rules:',
    '- useCaseAssessment: 2–3 sentences describing what this customer appears to need (SOC, observability, compliance, etc.).',
    '- recommendedSplunkCapabilities: short bullets (Enterprise Security, CIM, SOAR, ITSI, UBA, etc.).',
    '- recommendedAppIds: subset of allowed Splunk app IDs that fit the use case.',
    '',
    'Rules:',
    '- Use only allowed use case names exactly.',
    '- Use only allowed Splunk app IDs exactly in splunkApps.',
    '- Use only allowed goal preset IDs exactly — never invent freeform crawl/walk/run goal text.',
    '- Budget must be numeric USD only if explicitly stated (no currency symbols in JSON number).',
    '- pathBudgetPercentages are percent of ingest budget for Crawl/Walk/Run paths (defaults: 80, 100, 110). Use integers 1–200.',
    '- Preserve important counts and source notes in dataSources and discoveryNotes.',
    '- Put uncertain items in openQuestions.',
    '- Return JSON only.',
    '',
    '--- Paste customer meeting notes, emails, discovery notes, RFP excerpts, or customer details below this line ---',
    '',
  ].join('\n');
}

/** Alias for Cursor-assisted import UI. */
export const buildCursorExtractionPrompt = buildCircuitExtractionPrompt;

export function getAllowedDeploymentTypes() {
  return [...ALLOWED_DEPLOYMENT];
}

export function getAllowedUseCaseNames() {
  return useCaseProfiles.map((p) => p.name);
}

export function getAllowedSplunkAppIds() {
  return getAllowedIntakeSplunkAppIds();
}
