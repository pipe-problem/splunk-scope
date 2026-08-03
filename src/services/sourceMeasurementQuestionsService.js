import questionsData from '../data/sourceMeasurementQuestions.json';
import originalSizingRates from '../data/originalSizingRates.json';
import { resolveMeasurementInputFields as resolveFieldsCore, primaryInputRootKey } from '../utils/measurementInputFields.js';

export function getMeasurementQuestion(sourceId) {
  return questionsData.questions?.[sourceId] ?? null;
}

export function getOriginalSizingRateEntry(sourceId) {
  return originalSizingRates.entries?.[sourceId] ?? null;
}

export { primaryInputRootKey };

export function resolveMeasurementInputFields(sourceId, source, measurement, originalRate) {
  const resolvedMeasurement = measurement ?? getMeasurementQuestion(sourceId);
  const resolvedRate = originalRate ?? getOriginalSizingRateEntry(sourceId);
  return resolveFieldsCore(sourceId, source, resolvedMeasurement, resolvedRate);
}
