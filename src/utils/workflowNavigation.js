import { getStepPath } from '../config/workflowSteps.js';

/** URL for a session step index (home = `/`). */
export function getWorkflowStepUrl(stepIndex) {
  if (stepIndex === 0) return '/';
  return getStepPath(stepIndex) || '/';
}

/** Update session step and navigate — works from auxiliary routes (/reference, /coverage, /compare). */
export function navigateToWorkflowStep(navigate, dispatch, stepIndex) {
  dispatch({ type: 'SET_STEP', payload: stepIndex });
  const path = getWorkflowStepUrl(stepIndex);
  navigate(path);
}
