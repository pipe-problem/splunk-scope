import { describe, expect, it, vi } from 'vitest';
import { getWorkflowStepUrl, navigateToWorkflowStep } from './workflowNavigation.js';
import { STEP } from '../config/workflowSteps.js';

describe('workflowNavigation', () => {
  it('maps step indices to workflow URLs', () => {
    expect(getWorkflowStepUrl(STEP.HOME)).toBe('/');
    expect(getWorkflowStepUrl(STEP.INTAKE)).toBe('/intake');
    expect(getWorkflowStepUrl(STEP.SOURCES)).toBe('/sources');
    expect(getWorkflowStepUrl(STEP.REVIEW)).toBe('/review');
  });

  it('dispatches SET_STEP and navigates even when step is unchanged', () => {
    const navigate = vi.fn();
    const dispatch = vi.fn();

    navigateToWorkflowStep(navigate, dispatch, STEP.SOURCES);

    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_STEP', payload: STEP.SOURCES });
    expect(navigate).toHaveBeenCalledWith('/sources');
  });
});
