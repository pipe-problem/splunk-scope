import { formatSourceCounts } from '../services/reportExportEngine.js';
import { getNestedValue } from './draftPathUtils.js';
import { getLogOptions } from '../services/sourceHierarchyEngine.js';

/**
 * Short human-readable summary of configured sizing inputs for grid cards.
 * @returns {string|null}
 */
export function formatConfiguredSourceSummary(source, ss) {
  if (!source || !ss || ss.status !== 'current') return null;

  const parts = [];
  const { count } = formatSourceCounts(source.id, ss, source);
  if (count && count !== 'Needs validation') {
    parts.push(count);
  }

  for (const field of (source.input_fields || []).filter((f) => f.type === 'select')) {
    const value = getNestedValue(ss, field.key);
    if (value != null && value !== '') {
      parts.push(String(value));
    }
  }

  const basicLogs = getLogOptions(source).filter((o) => o.group === 'basic');
  if (basicLogs.length > 1) {
    const selected = ss.selectedLogOptions || {};
    const enabled = basicLogs.filter((opt) => selected[opt.id] !== false);
    if (enabled.length > 0 && enabled.length < basicLogs.length) {
      parts.push(`${enabled.length} log types enabled`);
    }
  }

  if (ss.logging_scope && ss.logging_scope !== 'default') {
    parts.push(String(ss.logging_scope).replace(/_/g, ' '));
  }

  return parts.length ? parts.join(' · ') : null;
}
