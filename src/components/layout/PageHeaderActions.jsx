import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { downloadSessionJson } from '../../utils/sessionExport';
import { useToast } from './Toast';

/**
 * Consistent workflow header actions across pages.
 * Primary (right): Continue / next step
 * Secondary: Save and Quit (resumable session JSON), optional back
 */
export default function PageHeaderActions({
  state,
  backLabel,
  backStep,
  onBack,
  continueLabel = 'Continue',
  onContinue,
  showSaveAndQuit = true,
  children,
}) {
  const toast = useToast();

  function handleSaveAndQuit() {
    if (!state) return;
    downloadSessionJson(state, 'splunk-scope-session');
    toast.success('Session saved. Use Resume & Import on the home page to continue.');
  }

  function handleBack() {
    if (onBack) onBack();
  }

  return (
    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
      {children}
      {backLabel != null && (backStep != null || onBack) && (
        <button
          type="button"
          onClick={handleBack}
          className="btn-secondary interactive-card flex items-center gap-1.5 text-sm cursor-pointer"
        >
          <ChevronLeft size={14} /> {backLabel}
        </button>
      )}
      {showSaveAndQuit && state && (
        <button
          type="button"
          onClick={handleSaveAndQuit}
          className="btn-secondary interactive-card flex items-center gap-1.5 text-sm cursor-pointer"
          title="Save session JSON and exit — resume later via Resume & Import"
        >
          <Save size={14} /> Save and Quit
        </button>
      )}
      {onContinue && (
        <button
          type="button"
          onClick={onContinue}
          className="btn-primary interactive-card flex items-center gap-1.5 text-sm cursor-pointer"
        >
          {continueLabel} <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
