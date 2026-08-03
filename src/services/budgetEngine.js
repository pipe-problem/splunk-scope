/**
 * Internal planning budget from customer opportunity amount.
 * Rates are NOT shown in customer-facing UI.
 */

const RATE_ONPREM_USD_PER_GB = 650;
const RATE_CLOUD_USD_PER_GB = 1000;

/**
 * USD/GB/day by deployment type (internal only).
 * @param {string} deploymentType
 * @returns {number}
 */
export function getIngestRateUsdPerGb(deploymentType) {
  if (deploymentType === 'onprem') return RATE_ONPREM_USD_PER_GB;
  if (deploymentType === 'cloud') return RATE_CLOUD_USD_PER_GB;
  if (deploymentType === 'hybrid') return RATE_CLOUD_USD_PER_GB;
  return RATE_CLOUD_USD_PER_GB;
}

function parseBudgetGbDayOverride(intake) {
  const raw = intake?.budgetGbDayOverride;
  if (raw == null || raw === '') return null;
  const gb = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[,$]/g, ''));
  if (!Number.isFinite(gb) || gb <= 0) return null;
  return gb;
}

/**
 * @param {{ opportunityBudgetUsd?: string|number, budgetGbDayOverride?: string|number|null, deploymentType?: string }} intake
 * @returns {{ budgetGbDay: number, rateUsdPerGb: number, source: 'override'|'usd' }|null}
 */
export function computeIngestBudgetFromIntake(intake) {
  const rate = getIngestRateUsdPerGb(intake?.deploymentType || 'cloud');
  const overrideGb = parseBudgetGbDayOverride(intake);
  if (overrideGb != null) {
    return {
      budgetGbDay: overrideGb,
      rateUsdPerGb: rate,
      source: 'override',
    };
  }

  const raw = intake?.opportunityBudgetUsd;
  const amount = typeof raw === 'number' ? raw : parseFloat(String(raw || '').replace(/[,$]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    budgetGbDay: amount / rate,
    rateUsdPerGb: rate,
    source: 'usd',
  };
}
