/**
 * Workbook-backed multi-dimensional measurements (ORIGINAL Sizing Calculator).
 * Configure UI may expose extra dimensions only when defined in originalSizingRates.json.
 */
import originalRates from '../data/originalSizingRates.json' with { type: 'json' };

/** Maps catalog log_option.id → optionalSecondaryInputs.field (workbook row). */
const LOG_OPTION_TO_WORKBOOK_FIELD = {
  windows_servers: {
    security_event_log: 'windows_security_log_servers',
    system_event_log: 'windows_system_log_servers',
    application_event_log: 'windows_application_log_servers',
    setup_event_log: 'windows_setup_log_servers',
    performance_metrics: 'windows_performance_log_servers',
  },
};

export function getWorkbookOptionalSecondaryInputs(sourceId) {
  const entry = originalRates.entries?.[sourceId];
  return entry?.optionalSecondaryInputs || [];
}

export function hasWorkbookOptionalSecondaryInputs(sourceId) {
  return getWorkbookOptionalSecondaryInputs(sourceId).length > 0;
}

/**
 * Log channels in sources.json that correspond to workbook optionalSecondaryInputs rows.
 * Only these may appear as configure toggles (e.g. Windows Server event logs).
 */
export function getWorkbookBackedLogOptions(source) {
  if (!source?.id) return [];

  const secondaryFields = new Set(
    getWorkbookOptionalSecondaryInputs(source.id).map((s) => s.field),
  );
  if (!secondaryFields.size) return [];

  const fieldByLogId = LOG_OPTION_TO_WORKBOOK_FIELD[source.id] || {};
  return (source.log_options || []).filter((opt) => {
    const workbookField = fieldByLogId[opt.id];
    return workbookField && secondaryFields.has(workbookField);
  });
}

export function hasWorkbookBackedLogChannelOptions(source) {
  return getWorkbookBackedLogOptions(source).length > 0;
}
