/**
 * Session Migration Engine
 *
 * Manages localStorage schema versioning and safe migration between app versions.
 * Prevents stale or corrupted state from crashing the app.
 */

import { remapLegacyCurrentStep } from '../config/workflowSteps.js'
import { applyIntakeDefaults } from '../config/intakeDefaults.js'

export const CURRENT_SCHEMA_VERSION = 6

const INITIAL_STATE_SHAPE = {
  currentStep: 0,
  theme: 'dark',
  intake: {
    customerName: '',
    deploymentType: 'cloud',
    desiredApps: [],
    useCases: [],
    customUseCases: '',
    crawlGoal: '',
    walkGoal: '',
    runGoal: '',
    discoveryNotes: '',
    importedContext: null,
    opportunityBudgetUsd: '',
    crawlGoalPresetId: '',
    walkGoalPresetId: '',
    runGoalPresetId: '',
    sourceHints: [],
    pathBudgetPercentages: { crawl: 80, walk: 100, run: 110 },
    budgetGbDayOverride: null,
    recommendedApps: [],
  },
  interpretation: null,
  sources: {},
  plans: null,
  selectedPlanIndex: null,
  reportPathExplicit: false,
  suppressPathRecommendation: false,
  sessionId: '',
  lastSaved: null,
  scenarios: [],
  activeScenarioId: null,
  activeTemplateId: null,
  bufferPercent: 20,
  overlapDecisions: {},
  showAllDomains: false,
  schemaVersion: CURRENT_SCHEMA_VERSION,
}

/**
 * Attempt to migrate a persisted state object to the current schema.
 *
 * @param {object} raw - parsed JSON from localStorage
 * @returns {{ state: object, migrated: boolean, fromVersion: number | null, error: string | null }}
 */
export function migrateSession(raw) {
  if (!raw || typeof raw !== 'object') {
    return { state: null, migrated: false, fromVersion: null, error: 'Invalid session data' }
  }

  const fromVersion = raw.schemaVersion ?? null

  if (fromVersion === CURRENT_SCHEMA_VERSION) {
    return {
      state: finalizeSessionState(raw),
      migrated: false,
      fromVersion,
      error: null,
    }
  }

  try {
    let state = { ...raw }

    if (fromVersion === null || fromVersion === undefined) {
      state = migrateV0ToV1(state)
    }

    if ((state.schemaVersion ?? 0) < 2) {
      state = migrateV1ToV2(state)
    }

    if ((state.schemaVersion ?? 0) < 3) {
      state = migrateV2ToV3(state)
    }

    if ((state.schemaVersion ?? 0) < 4) {
      state = migrateV3ToV4(state)
    }

    if ((state.schemaVersion ?? 0) < 5) {
      state = migrateV4ToV5(state)
    }

    if ((state.schemaVersion ?? 0) < 6) {
      state = migrateV5ToV6(state)
    }

    return { state: finalizeSessionState(state), migrated: true, fromVersion, error: null }
  } catch (err) {
    return { state: null, migrated: false, fromVersion, error: `Migration failed: ${err.message}` }
  }
}

/**
 * v0 (no version) → v1: normalize missing fields
 */
function migrateV0ToV1(state) {
  const migrated = { ...state }

  if (!migrated.intake || typeof migrated.intake !== 'object') {
    migrated.intake = { ...INITIAL_STATE_SHAPE.intake }
  } else {
    migrated.intake = { ...INITIAL_STATE_SHAPE.intake, ...migrated.intake }
  }

  migrated.overlapDecisions = migrated.overlapDecisions || {}
  migrated.bufferPercent = migrated.bufferPercent ?? 20
  if (migrated.selectedPlanIndex === undefined) {
    migrated.selectedPlanIndex = null
  }
  if (migrated.reportPathExplicit === undefined) {
    migrated.reportPathExplicit = migrated.selectedPlanIndex != null
  }
  if (migrated.suppressPathRecommendation === undefined) {
    migrated.suppressPathRecommendation = false
  }
  migrated.showAllDomains = migrated.showAllDomains ?? false
  migrated.scenarios = Array.isArray(migrated.scenarios) ? migrated.scenarios : []
  migrated.sources = migrated.sources && typeof migrated.sources === 'object' ? migrated.sources : {}
  migrated.theme = migrated.theme || 'dark'

  if (migrated.explainMode !== undefined) delete migrated.explainMode
  if (migrated.demoMode !== undefined) delete migrated.demoMode

  migrated.schemaVersion = 1
  return migrated
}

/**
 * v1 → v2: add eligibility-related defaults, clean deprecated fields
 */
function migrateV1ToV2(state) {
  const migrated = { ...state }

  if (typeof migrated.currentStep !== 'number' || migrated.currentStep < 0) {
    migrated.currentStep = 0
  }

  if (!migrated.sessionId) {
    migrated.sessionId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  migrated.schemaVersion = 2
  return migrated
}

/**
 * v2 → v3: no-op migration (schema bump only)
 */
function migrateV2ToV3(state) {
  const migrated = { ...state }
  migrated.schemaVersion = 3
  return migrated
}

function migrateV3ToV4(state) {
  const migrated = { ...state }
  migrated.intake = { ...INITIAL_STATE_SHAPE.intake, ...migrated.intake }
  if (migrated.intake.opportunityBudgetUsd == null) {
    migrated.intake.opportunityBudgetUsd = ''
  }
  migrated.schemaVersion = 4
  return migrated
}

/**
 * v4 → v5: goal preset IDs, source hints; preserve legacy freeform goals in discovery notes.
 */
function migrateV4ToV5(state) {
  const migrated = { ...state }
  migrated.intake = { ...INITIAL_STATE_SHAPE.intake, ...migrated.intake }

  if (!Array.isArray(migrated.intake.sourceHints)) {
    migrated.intake.sourceHints = []
  }
  if (migrated.intake.crawlGoalPresetId == null) migrated.intake.crawlGoalPresetId = ''
  if (migrated.intake.walkGoalPresetId == null) migrated.intake.walkGoalPresetId = ''
  if (migrated.intake.runGoalPresetId == null) migrated.intake.runGoalPresetId = ''

  const legacyNotes = []
  if (migrated.intake.crawlGoal?.trim() && !migrated.intake.crawlGoalPresetId) {
    legacyNotes.push(`Legacy Crawl goal: ${migrated.intake.crawlGoal.trim()}`)
  }
  if (migrated.intake.walkGoal?.trim() && !migrated.intake.walkGoalPresetId) {
    legacyNotes.push(`Legacy Walk goal: ${migrated.intake.walkGoal.trim()}`)
  }
  if (migrated.intake.runGoal?.trim() && !migrated.intake.runGoalPresetId) {
    legacyNotes.push(`Legacy Run goal: ${migrated.intake.runGoal.trim()}`)
  }
  if (legacyNotes.length) {
    migrated.intake.discoveryNotes = [migrated.intake.discoveryNotes, legacyNotes.join('\n')]
      .filter(Boolean)
      .join('\n\n')
      .trim()
  }

  if (!migrated.intake.crawlGoalPresetId) {
    migrated.intake.crawlGoalPresetId = 'crawl_foundational_visibility'
  }
  if (!migrated.intake.walkGoalPresetId) {
    migrated.intake.walkGoalPresetId = 'walk_expand_correlation'
  }
  if (!migrated.intake.runGoalPresetId) {
    migrated.intake.runGoalPresetId = 'run_optimize_and_mature'
  }

  migrated.schemaVersion = 5
  if (migrated.reportPathExplicit === undefined) {
    migrated.reportPathExplicit = migrated.selectedPlanIndex != null
  }
  if (migrated.suppressPathRecommendation === undefined) {
    migrated.suppressPathRecommendation = false
  }
  return migrated
}

/**
 * v5 → v6: renumber workflow steps when Coverage is archived (SHOW_COVERAGE_PAGE=false).
 * Old: intake=1 … review=4, coverage=5, paths=6, report=7
 * New: intake=1 … review=4, paths=5, report=6
 */
export function migrateV5ToV6(state) {
  const migrated = { ...state }
  if (typeof migrated.currentStep === 'number') {
    migrated.currentStep = remapLegacyCurrentStep(migrated.currentStep)
  }
  migrated.schemaVersion = 6
  return migrated
}

/**
 * Apply intake defaults and schema version on every load/migration path.
 * @param {object} state
 */
export function finalizeSessionState(state) {
  const finalized = { ...state }
  finalized.intake = applyIntakeDefaults({
    ...INITIAL_STATE_SHAPE.intake,
    ...(finalized.intake || {}),
  })
  finalized.schemaVersion = CURRENT_SCHEMA_VERSION
  return finalized
}

/**
 * Validate that a state object has the minimum required shape.
 * Returns true if the state is usable, false if it should be reset.
 */
export function isValidSessionState(state) {
  if (!state || typeof state !== 'object') return false
  if (!state.intake || typeof state.intake !== 'object') return false
  if (typeof state.currentStep !== 'number') return false
  if (!state.sources || typeof state.sources !== 'object') return false
  return true
}
