import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { buildCustomerReportData } from '../services/customerReportDataBuilder.js';
import { sanitizeCustomerReportData } from '../services/customerReportSanitizer.js';

/**
 * @param {{ hideZeroUnconfigured?: boolean }} [options]
 */
export function useCustomerReportData(options = {}) {
  const { state } = useApp();

  return useMemo(() => {
    const raw = buildCustomerReportData(state, options);
    return sanitizeCustomerReportData(raw);
  }, [state, options.hideZeroUnconfigured]);
}
