import { getVisibleStepPosition } from '../../config/workflowSteps.js';

/** Compact "Review · 4/6" indicator for screen-share workflow pages. */
export default function WorkflowStepIndicator({ currentStep }) {
  const position = getVisibleStepPosition(currentStep);
  if (!position) return null;
  const { index, step, total } = position;
  return (
    <p className="text-label text-[var(--cast-text-muted)] mt-0.5" aria-live="polite">
      {step.label} · {index + 1}/{total}
    </p>
  );
}
