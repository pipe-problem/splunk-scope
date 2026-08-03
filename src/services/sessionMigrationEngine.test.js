import { describe, it, expect } from 'vitest';
import {
  migrateSession,
  migrateV5ToV6,
  CURRENT_SCHEMA_VERSION,
} from './sessionMigrationEngine.js';
import { LEGACY_STEP, STEP, remapLegacyCurrentStep } from '../config/workflowSteps.js';

const baseSession = {
  intake: { customerName: 'Acme' },
  sources: {},
};

describe('remapLegacyCurrentStep', () => {
  it('maps v5 steps ≥5 down by 1 when coverage is hidden', () => {
    expect(remapLegacyCurrentStep(4, { coverageHidden: true })).toBe(4);
    expect(remapLegacyCurrentStep(LEGACY_STEP.COVERAGE, { coverageHidden: true })).toBe(STEP.REVIEW);
    expect(remapLegacyCurrentStep(LEGACY_STEP.PATHS, { coverageHidden: true })).toBe(STEP.PATHS);
    expect(remapLegacyCurrentStep(LEGACY_STEP.REPORT, { coverageHidden: true })).toBe(STEP.REPORT);
  });

  it('leaves steps unchanged when coverage remains in the flow', () => {
    expect(remapLegacyCurrentStep(LEGACY_STEP.REPORT, { coverageHidden: false })).toBe(LEGACY_STEP.REPORT);
  });
});

describe('migrateV5ToV6', () => {
  it('remaps currentStep from legacy coverage-era indices', () => {
    const migrated = migrateV5ToV6({ ...baseSession, currentStep: LEGACY_STEP.PATHS, schemaVersion: 5 });
    expect(migrated.currentStep).toBe(STEP.PATHS);
    expect(migrated.schemaVersion).toBe(6);
  });

  it('remaps report step 7 → 6', () => {
    const migrated = migrateV5ToV6({ ...baseSession, currentStep: LEGACY_STEP.REPORT, schemaVersion: 5 });
    expect(migrated.currentStep).toBe(STEP.REPORT);
  });

  it('remaps coverage step 5 → review (4)', () => {
    const migrated = migrateV5ToV6({ ...baseSession, currentStep: LEGACY_STEP.COVERAGE, schemaVersion: 5 });
    expect(migrated.currentStep).toBe(STEP.REVIEW);
  });
});

describe('migrateSession v5→v6', () => {
  it('bumps schemaVersion to current and remaps steps', () => {
    const { state, migrated } = migrateSession({
      ...baseSession,
      schemaVersion: 5,
      currentStep: LEGACY_STEP.REPORT,
    });
    expect(migrated).toBe(true);
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(state.currentStep).toBe(STEP.REPORT);
  });

  it('current v6 session loads without migration', () => {
    const { state, migrated } = migrateSession({
      ...baseSession,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      currentStep: STEP.PATHS,
    });
    expect(migrated).toBe(false);
    expect(state.currentStep).toBe(STEP.PATHS);
  });

  it('applies intake defaults on v6 session load', () => {
    const { state } = migrateSession({
      ...baseSession,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      currentStep: STEP.INTAKE,
    });
    expect(state.intake.pathBudgetPercentages).toEqual({ crawl: 80, walk: 100, run: 110 });
    expect(state.intake.budgetGbDayOverride).toBeNull();
    expect(Array.isArray(state.intake.recommendedApps)).toBe(true);
  });
});
