/** Default path budget percentages (% of ingest budget per maturity path). */
export const DEFAULT_PATH_BUDGET_PERCENTAGES = {
  crawl: 80,
  walk: 100,
  run: 110,
};

/**
 * @param {object} intake
 * @returns {object}
 */
export function applyIntakeDefaults(intake = {}) {
  const merged = { ...intake };
  if (!merged.pathBudgetPercentages || typeof merged.pathBudgetPercentages !== 'object') {
    merged.pathBudgetPercentages = { ...DEFAULT_PATH_BUDGET_PERCENTAGES };
  } else {
    merged.pathBudgetPercentages = {
      ...DEFAULT_PATH_BUDGET_PERCENTAGES,
      ...merged.pathBudgetPercentages,
    };
  }
  if (merged.budgetGbDayOverride === undefined) {
    merged.budgetGbDayOverride = null;
  }
  if (!Array.isArray(merged.recommendedApps)) {
    merged.recommendedApps = [];
  }
  return merged;
}
