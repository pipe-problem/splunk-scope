/**
 * Full session export/import — every field the user entered is included.
 */

/**
 * @param {object} state - full AppContext state
 * @returns {object}
 */
export function buildFullSessionExport(state) {
  return {
    schemaVersion: state.schemaVersion,
    exportedAt: new Date().toISOString(),
    app: 'splunk-scope',
    appVersion: state.appVersion,
    sessionId: state.sessionId,
    currentStep: state.currentStep,
    theme: state.theme,
    intake: { ...state.intake },
    sources: { ...state.sources },
    interpretation: state.interpretation,
    interpretationIntakeKey: state.interpretationIntakeKey,
    plans: state.plans,
    selectedPlanIndex: state.selectedPlanIndex,
    reportPathExplicit: state.reportPathExplicit ?? state.selectedPlanIndex != null,
    suppressPathRecommendation: state.suppressPathRecommendation ?? false,
    bufferPercent: state.bufferPercent,
    overlapDecisions: { ...state.overlapDecisions },
    showAllDomains: state.showAllDomains,
    reviewAcknowledgedSourceIds: { ...state.reviewAcknowledgedSourceIds },
    pendingSourceNavigation: state.pendingSourceNavigation,
    scenarios: state.scenarios,
    activeScenarioId: state.activeScenarioId,
    activeTemplateId: state.activeTemplateId,
    lastSaved: state.lastSaved,
  };
}

/**
 * @param {object} state
 * @param {string} [filenameHint]
 */
export function downloadSessionJson(state, filenameHint = 'splunk-scope-session') {
  const payload = buildFullSessionExport(state);
  const safeName = (state.intake?.customerName || 'session').replace(/[^\w.-]+/g, '_').slice(0, 40);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameHint}-${safeName}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return payload;
}
