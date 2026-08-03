import { SHOW_COVERAGE_PAGE } from './featureFlags.js'

const pathsStepIndex = SHOW_COVERAGE_PAGE ? 6 : 5
const reportStepIndex = SHOW_COVERAGE_PAGE ? 7 : 6

/** Session `currentStep` indices (home = 0). */
export const STEP = {
  HOME: 0,
  INTAKE: 1,
  ANALYSIS: 2,
  SOURCES: 3,
  REVIEW: 4,
  COVERAGE: SHOW_COVERAGE_PAGE ? 5 : null,
  PATHS: pathsStepIndex,
  REPORT: reportStepIndex,
}

/** Pre-v6 step indices (coverage always at 5). */
export const LEGACY_STEP = {
  COVERAGE: 5,
  PATHS: 6,
  REPORT: 7,
}

/** Workflow steps in customer-facing order (coverage omitted when archived). */
export const WORKFLOW_STEP_DEFS = [
  { id: 'intake', label: 'Intake', path: '/intake', stepIndex: STEP.INTAKE, navVisible: true },
  { id: 'interpretation', label: 'Analysis', path: '/analysis', stepIndex: STEP.ANALYSIS, navVisible: true },
  { id: 'sources', label: 'Sources', path: '/sources', stepIndex: STEP.SOURCES, navVisible: true },
  { id: 'review', label: 'Review', path: '/review', stepIndex: STEP.REVIEW, navVisible: true },
  ...(SHOW_COVERAGE_PAGE
    ? [{ id: 'coverage', label: 'Coverage', path: '/coverage', stepIndex: STEP.COVERAGE, navVisible: true }]
    : []),
  { id: 'plans', label: 'Paths', path: '/paths', stepIndex: STEP.PATHS, navVisible: true },
  { id: 'report', label: 'Report', path: '/report', stepIndex: STEP.REPORT, navVisible: true },
]

export const VISIBLE_WORKFLOW_STEPS = WORKFLOW_STEP_DEFS.filter((def) => def.navVisible)

/** First forward step that expects configured sources (Coverage when shown, else Paths). */
export function getSourcesRequiredFromStep() {
  return SHOW_COVERAGE_PAGE ? STEP.COVERAGE : STEP.PATHS
}

export function getStepPath(stepIndex) {
  return WORKFLOW_STEP_DEFS.find((def) => def.stepIndex === stepIndex)?.path ?? null
}

/** Maps session `currentStep` → resume URL (index aligns with step number). */
export function getResumePaths() {
  const paths = ['/']
  for (let stepIndex = STEP.INTAKE; stepIndex <= STEP.REPORT; stepIndex += 1) {
    paths[stepIndex] = getStepPath(stepIndex) || '/intake'
  }
  return paths
}

export function getVisibleStepPosition(currentStep) {
  const index = VISIBLE_WORKFLOW_STEPS.findIndex((def) => def.stepIndex === currentStep)
  if (index === -1) return null
  return {
    index,
    step: VISIBLE_WORKFLOW_STEPS[index],
    total: VISIBLE_WORKFLOW_STEPS.length,
  }
}

/**
 * Remap v5 `currentStep` when Coverage is removed from the visible flow.
 * @param {number} step
 * @param {{ coverageHidden?: boolean }} [options]
 */
export function remapLegacyCurrentStep(step, options = {}) {
  const coverageHidden = options.coverageHidden ?? !SHOW_COVERAGE_PAGE
  if (typeof step !== 'number' || !coverageHidden) return step
  if (step >= LEGACY_STEP.COVERAGE) return step - 1
  return step
}
