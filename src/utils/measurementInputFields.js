/**
 * Pure resolver for measurement modal fields — shared by SourceConfigModal and audit script.
 */

function titleCaseUnit(unitLabel) {
  if (!unitLabel) return 'Quantity';
  return String(unitLabel).charAt(0).toUpperCase() + String(unitLabel).slice(1);
}

function primaryInputRootKey(primaryInputField) {
  if (!primaryInputField) return null;
  return String(primaryInputField).split('.')[0];
}

function fieldMatchesPrimary(fieldKey, primaryInputField) {
  if (!primaryInputField || !fieldKey) return false;
  if (fieldKey === primaryInputField) return true;
  const root = primaryInputRootKey(primaryInputField);
  return fieldKey === root || fieldKey.startsWith(`${root}.`) || primaryInputField.startsWith(`${fieldKey}.`);
}

function syntheticNumberField(key, { label, helper, synthetic = true }) {
  return { type: 'number', key, label, helper, synthetic };
}

export function resolveMeasurementInputFields(sourceId, source, measurement, originalRate) {
  const primaryKey = measurement?.primaryInputField || originalRate?.primaryInputField;

  const catalogNumbers = (source?.input_fields || []).filter(
    (f) => f.type === 'number' && !String(f.key).includes('manual'),
  );
  const catalogSelects = (source?.input_fields || []).filter((f) => f.type === 'select').slice(0, 2);

  const numbers = [...catalogNumbers];
  const hasPrimaryCoverage = primaryKey
    ? numbers.some((f) => fieldMatchesPrimary(f.key, primaryKey))
    : numbers.length > 0;

  const primaryLabel = titleCaseUnit(measurement?.unitLabel || originalRate?.unitLabel);
  const primaryHelper = measurement?.helperText || originalRate?.notes || '';

  if (primaryKey && !hasPrimaryCoverage) {
    numbers.unshift(syntheticNumberField(primaryKey, { label: primaryLabel, helper: primaryHelper }));
  } else if (!numbers.length && primaryKey) {
    numbers.push(syntheticNumberField(primaryKey, { label: primaryLabel, helper: primaryHelper }));
  } else if (!numbers.length && (originalRate || measurement)) {
    const fallbackKey = primaryKey || 'count';
    numbers.push(
      syntheticNumberField(fallbackKey, {
        label: titleCaseUnit(measurement?.unitLabel || originalRate?.unitLabel || 'Count'),
        helper: primaryHelper,
      }),
    );
  }

  // Multi-dimensional workbook measurements use log channel toggles (windows_servers), not extra number fields.

  if (primaryKey) {
    numbers.sort((a, b) => {
      const aPrimary = fieldMatchesPrimary(a.key, primaryKey) ? 0 : 1;
      const bPrimary = fieldMatchesPrimary(b.key, primaryKey) ? 0 : 1;
      return aPrimary - bPrimary;
    });
  }

  return { numbers, selects: catalogSelects };
}

export { primaryInputRootKey, fieldMatchesPrimary };
