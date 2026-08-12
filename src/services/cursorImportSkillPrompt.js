/**
 * Preamble embedded in the copyable Cursor extraction prompt.
 * Keep in sync with .cursor/skills/splunk-scope-import/SKILL.md
 */
export const CURSOR_IMPORT_SKILL_PREAMBLE = [
  'CURSOR SKILL: splunk-scope-import (required)',
  '',
  'When running inside Cursor with this Splunk Scope repository open:',
  '1. Read and follow .cursor/skills/splunk-scope-import/SKILL.md (or invoke @splunk-scope-import).',
  '2. Read customer materials attached or pasted after this prompt.',
  '3. Cross-check sourceId, app IDs, and use case names against repo catalogs — never invent IDs.',
  '4. Return JSON only (no markdown fences, no commentary).',
  '5. Before handoff, mentally validate against scripts/validate-import-json.mjs rules:',
  '   - high confidence only with explicit counts and valid sourceId',
  '   - medium/low rows include skipReason when count or mapping is uncertain',
  '   - aiSummary.useCaseAssessment plus recommendedSplunkCapabilities and recommendedAppIds',
  '',
  'Customer content stays in Cursor; only structured JSON is pasted into Splunk Scope Intake.',
  '',
].join('\n');
