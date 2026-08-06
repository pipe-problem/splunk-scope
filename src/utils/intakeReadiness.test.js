import { describe, it, expect } from 'vitest';
import { isIntakeReadyForSourceRelevance } from './intakeReadiness.js';
import { DEFAULT_GOAL_PRESET_IDS } from './goalPresets.js';

describe('isIntakeReadyForSourceRelevance', () => {
  const emptyIntake = {
    customerName: '',
    deploymentType: 'cloud',
    desiredApps: [],
    recommendedApps: [],
    useCases: [],
    customUseCases: '',
    discoveryNotes: '',
    sourceHints: [],
    crawlGoalPresetId: DEFAULT_GOAL_PRESET_IDS.crawl,
    walkGoalPresetId: DEFAULT_GOAL_PRESET_IDS.walk,
    runGoalPresetId: DEFAULT_GOAL_PRESET_IDS.run,
  };

  it('returns false for factory-default intake', () => {
    expect(isIntakeReadyForSourceRelevance(emptyIntake)).toBe(false);
    expect(isIntakeReadyForSourceRelevance({})).toBe(false);
  });

  it('returns false when only deployment type is set', () => {
    expect(isIntakeReadyForSourceRelevance({ ...emptyIntake, deploymentType: 'onprem' })).toBe(false);
  });

  it('returns true when customer name is entered', () => {
    expect(isIntakeReadyForSourceRelevance({ ...emptyIntake, customerName: 'Acme Corp' })).toBe(true);
  });

  it('returns true when a use case is selected', () => {
    expect(isIntakeReadyForSourceRelevance({ ...emptyIntake, useCases: ['Enterprise Security'] })).toBe(true);
  });

  it('returns true when a desired app is selected', () => {
    expect(isIntakeReadyForSourceRelevance({ ...emptyIntake, desiredApps: ['enterprise_security'] })).toBe(true);
  });

  it('returns true when discovery notes are entered', () => {
    expect(isIntakeReadyForSourceRelevance({ ...emptyIntake, discoveryNotes: 'Needs AD and firewall logs' })).toBe(true);
  });

  it('returns true when goal preset differs from default', () => {
    expect(
      isIntakeReadyForSourceRelevance({
        ...emptyIntake,
        crawlGoalPresetId: 'crawl_compliance_first',
      }),
    ).toBe(true);
  });
});
