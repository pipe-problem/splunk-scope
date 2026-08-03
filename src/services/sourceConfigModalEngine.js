/**
 * Save / reset payloads for SourceConfigModal — testable without DOM.
 */

export function applySourceConfigSave(draftFields = {}) {
  return { ...draftFields, status: 'current' };
}

export function applySourceConfigReset(source) {
  const cleared = { status: 'unknown' };
  for (const f of source?.input_fields || []) {
    if (f.type === 'number' || f.type === 'select' || f.type === 'text') {
      cleared[f.key] = '';
    }
  }
  cleared.selectedLogOptions = {};
  cleared.override = '';
  cleared.manual_gb_day = '';
  cleared.notes = '';
  cleared.owner = '';
  return cleared;
}

export function isSourceConfigured(sourceState) {
  return sourceState?.status === 'current';
}
