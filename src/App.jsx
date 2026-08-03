import { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext';
import { useToast } from './components/layout/Toast';
import ErrorBoundary from './components/layout/ErrorBoundary';
import HomePage from './pages/HomePage';
import IntakePage from './pages/IntakePage';
import InterpretationPage from './pages/InterpretationPage';
import SourceWorkflowPage from './pages/SourceWorkflowPage';
import CoveragePage from './pages/CoveragePage';
import ReviewPage from './pages/ReviewPage';
import PlansPage from './pages/PlansPage';
import ReportPage from './pages/ReportPage';
import ScenarioComparisonPage from './pages/ScenarioComparisonPage';
import SourceReferenceLibraryPage from './pages/SourceReferenceLibraryPage';
import ScopeLogo from './components/layout/ScopeLogo';
import { SHOW_COVERAGE_PAGE } from './config/featureFlags.js';
import { WORKFLOW_STEP_DEFS, getSourcesRequiredFromStep } from './config/workflowSteps.js';
import {
  Download,
  Upload,
  RotateCcw,
  BookmarkPlus,
  Moon,
  Sun,
  Settings,
  Check,
  ClipboardList,
  Lightbulb,
  Database,
  TableProperties,
  Shield,
  GitBranch,
  GitCompare,
  FileText,
  X,
  BookMarked,
} from 'lucide-react';

const STEP_ICONS = {
  intake: ClipboardList,
  interpretation: Lightbulb,
  sources: Database,
  review: TableProperties,
  coverage: Shield,
  plans: GitBranch,
  report: FileText,
};

const STEPS = [{ id: 'home', label: 'Home', hidden: true, path: '/' }];
for (const def of WORKFLOW_STEP_DEFS) {
  STEPS[def.stepIndex] = {
    id: def.id,
    label: def.label,
    icon: STEP_ICONS[def.id],
    path: def.path,
    hidden: !def.navVisible,
  };
}

const NAV_STEPS = STEPS.filter((s) => s && !s.hidden);

/** Routes outside the step-sync loop (no forced redirect to currentStep). */
const AUXILIARY_PATHS = new Set([
  '/reference',
  '/compare',
  ...(!SHOW_COVERAGE_PAGE ? ['/coverage'] : []),
]);

function App() {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentStep, theme } = state;
  const fileInputRef = useRef(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    if (AUXILIARY_PATHS.has(location.pathname)) return;
    const stepPath = STEPS[currentStep]?.path || '/';
    if (location.pathname !== stepPath) {
      navigate(stepPath, { replace: true });
    }
  }, [currentStep]);

  useEffect(() => {
    if (AUXILIARY_PATHS.has(location.pathname)) return;
    const idx = STEPS.findIndex((s) => s.path === location.pathname);
    if (idx !== -1 && idx !== currentStep) {
      dispatch({ type: 'SET_STEP', payload: idx });
    }
  }, [location.pathname]);

  const railStepIndex = currentStep > 0 ? currentStep - 1 : 0;

  function countConfiguredSources(sources) {
    return Object.values(sources || {}).filter((s) => s.status === 'current' || s.status === 'future').length;
  }

  function goHome() {
    navigate('/');
    dispatch({ type: 'SET_STEP', payload: 0 });
  }

  function goToStep(stepIndex) {
    const isForward = stepIndex > currentStep;
    if (isForward && stepIndex >= getSourcesRequiredFromStep() && countConfiguredSources(state.sources) === 0) {
      toast.warning(
        SHOW_COVERAGE_PAGE
          ? 'No sources configured yet — configure sources before coverage and paths for meaningful estimates.'
          : 'No sources configured yet — configure sources before paths for meaningful estimates.',
      );
    }
    dispatch({ type: 'SET_STEP', payload: stepIndex });
  }

  function exportSession() {
    const data = { ...state, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `splunk-scope-${state.intake.customerName || 'session'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Session exported.');
  }

  function importSession(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        dispatch({ type: 'LOAD_SESSION', payload: data });
        toast.success('Session imported successfully.');
      } catch {
        toast.error('Invalid session file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function saveScenario() {
    if (!scenarioName.trim()) return;
    dispatch({ type: 'SAVE_SCENARIO', payload: { name: scenarioName.trim() } });
    toast.success(`Scenario "${scenarioName.trim()}" saved.`);
    setScenarioName('');
  }

  function handleResetClick() {
    if (!resetConfirm) { setResetConfirm(true); return; }
    dispatch({ type: 'RESET_SESSION' });
    setResetConfirm(false);
    setToolsOpen(false);
    toast.info('Session reset.');
  }

  const sidebar = (
    <aside className="no-print sidebar-desktop w-[var(--sidebar-width)] border-r border-[var(--cast-border)] bg-[var(--cast-panel)] flex flex-col shrink-0 relative group/sidebar">
      {/* Logo — home navigation (session preserved) */}
      <button
        type="button"
        onClick={goHome}
        aria-label="Splunk Scope home"
        className="flex items-center justify-center py-3 w-full mx-auto max-w-[calc(100%-12px)] rounded-lg hover:bg-[var(--cast-panel-alt)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cast-accent)]/40"
      >
        <ScopeLogo gradientId="sidebar-logo-grad" />
      </button>

      {/* Nav steps */}
      <nav className="flex-1 flex flex-col items-center gap-1 px-1.5 py-2">
        {NAV_STEPS.map((step, index) => {
          const isCompleted = index < railStepIndex;
          const isActive = index === railStepIndex;
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => goToStep(index + 1)}
              aria-label={step.label}
              aria-current={isActive ? 'step' : undefined}
              title={step.label}
              className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 group/step ${
                isActive
                  ? 'bg-[var(--cast-accent-muted)] text-[var(--cast-accent)]'
                  : isCompleted
                    ? 'text-[var(--cast-accent)] hover:bg-[var(--cast-panel-alt)]'
                    : 'text-[var(--cast-text-muted)] hover:bg-[var(--cast-panel-alt)] hover:text-[var(--cast-text-secondary)]'
              }`}
            >
              {isCompleted ? (
                <Check size={15} />
              ) : (
                <Icon size={15} />
              )}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--cast-accent)]" />
              )}
              <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-[var(--cast-panel)] border border-[var(--cast-border)] text-badge text-[var(--cast-text)] whitespace-nowrap opacity-0 pointer-events-none group-hover/step:opacity-100 transition-opacity z-50 shadow-lg">
                {step.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* SE tools — outside customer workflow stepper */}
      {location.pathname !== '/' && (
        <div className="px-1.5 pb-1 flex flex-col gap-1">
          {!SHOW_COVERAGE_PAGE && (
            <button
              type="button"
              onClick={() => navigate('/coverage')}
              aria-label="Coverage Analysis"
              title="Coverage Analysis (SE power user)"
              className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 group/step ${
                location.pathname === '/coverage'
                  ? 'bg-[var(--cast-accent-muted)] text-[var(--cast-accent)]'
                  : 'text-[var(--cast-text-muted)] hover:bg-[var(--cast-panel-alt)] hover:text-[var(--cast-accent)]'
              }`}
            >
              <Shield size={15} />
              <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-[var(--cast-panel)] border border-[var(--cast-border)] text-badge text-[var(--cast-text)] whitespace-nowrap opacity-0 pointer-events-none group-hover/step:opacity-100 transition-opacity z-50 shadow-lg">
                Coverage (SE)
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/reference')}
            aria-label="Source Reference Library"
            title="Source Reference Library (SE)"
            className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 group/step ${
              location.pathname === '/reference'
                ? 'bg-[var(--cast-accent-muted)] text-[var(--cast-accent)]'
                : 'text-[var(--cast-text-muted)] hover:bg-[var(--cast-panel-alt)] hover:text-[var(--cast-accent)]'
            }`}
          >
            <BookMarked size={15} />
            <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-[var(--cast-panel)] border border-[var(--cast-border)] text-badge text-[var(--cast-text)] whitespace-nowrap opacity-0 pointer-events-none group-hover/step:opacity-100 transition-opacity z-50 shadow-lg">
              Source library (SE)
            </span>
          </button>
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-1.5 pb-3 px-1.5">
        <button
          type="button"
          onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--cast-text-muted)] hover:text-[var(--cast-accent)] hover:bg-[var(--cast-panel-alt)] transition-all group/step"
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-[var(--cast-panel)] border border-[var(--cast-border)] text-badge text-[var(--cast-text)] whitespace-nowrap opacity-0 pointer-events-none group-hover/step:opacity-100 transition-opacity z-50 shadow-lg">
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => { setToolsOpen(!toolsOpen); setResetConfirm(false); }}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all group/step ${
            toolsOpen ? 'text-[var(--cast-accent)] bg-[var(--cast-accent-muted)]' : 'text-[var(--cast-text-muted)] hover:text-[var(--cast-accent)] hover:bg-[var(--cast-panel-alt)]'
          }`}
          title="Session tools"
        >
          <Settings size={15} />
          <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-[var(--cast-panel)] border border-[var(--cast-border)] text-badge text-[var(--cast-text)] whitespace-nowrap opacity-0 pointer-events-none group-hover/step:opacity-100 transition-opacity z-50 shadow-lg">
            Tools
          </span>
        </button>
      </div>

      {/* Tools popover */}
      {toolsOpen && (
        <div className="absolute left-full bottom-0 ml-1 w-56 z-50 animate-slide-in">
          <div className="card-glass shadow-xl border border-[var(--cast-border-strong)] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-badge font-semibold text-[var(--cast-text)] uppercase tracking-wide">Session Tools</span>
              <button type="button" onClick={() => setToolsOpen(false)} aria-label="Close session tools" className="text-[var(--cast-text-muted)] hover:text-[var(--cast-text)] p-0.5">
                <X size={12} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button type="button" onClick={exportSession} className="flex flex-col items-center gap-1 p-2 rounded-lg border border-[var(--cast-border)] hover:border-[var(--cast-accent)]/40 transition-colors">
                <Download size={13} className="text-[var(--cast-text-muted)]" />
                <span className="text-tiny text-[var(--cast-text-secondary)]">Export</span>
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1 p-2 rounded-lg border border-[var(--cast-border)] hover:border-[var(--cast-accent)]/40 transition-colors">
                <Upload size={13} className="text-[var(--cast-text-muted)]" />
                <span className="text-tiny text-[var(--cast-text-secondary)]">Import</span>
              </button>
              <button type="button" onClick={handleResetClick}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                  resetConfirm ? 'border-[var(--cast-critical)] bg-[var(--cast-critical)]/5' : 'border-[var(--cast-border)] hover:border-[var(--cast-critical)]/40'
                }`}>
                <RotateCcw size={13} className={resetConfirm ? 'text-[var(--cast-critical)]' : 'text-[var(--cast-text-muted)]'} />
                <span className={`text-tiny ${resetConfirm ? 'text-[var(--cast-critical)]' : 'text-[var(--cast-text-secondary)]'}`}>{resetConfirm ? 'Confirm' : 'Reset'}</span>
              </button>
            </div>

            <div className="border-t border-[var(--cast-border)] pt-2">
              <div className="flex items-center gap-1 mb-1.5">
                <BookmarkPlus size={11} className="text-[var(--cast-accent)]" />
                <span className="text-tiny font-medium text-[var(--cast-text-secondary)]">Scenarios ({state.scenarios?.length || 0})</span>
              </div>
              <div className="flex gap-1">
                <input
                  className="input-field !py-1 !text-tiny flex-1 min-w-0"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="Save as..."
                  aria-label="Scenario name"
                  onKeyDown={(e) => e.key === 'Enter' && saveScenario()}
                />
                <button type="button" onClick={saveScenario} className="text-tiny font-medium text-[var(--cast-accent)] px-2 py-1 rounded hover:bg-[var(--cast-panel-alt)]">
                  Save
                </button>
              </div>
              {(state.scenarios || []).length > 0 && (
                <>
                  <ul className="mt-1.5 space-y-0.5 max-h-24 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                    {(state.scenarios || []).map((s) => (
                      <li key={s.id} className="flex items-center gap-1 group">
                        <button
                          type="button"
                          onClick={() => { dispatch({ type: 'LOAD_SCENARIO', payload: s.id }); toast.success(`Loaded: ${s.name}`); }}
                          className="text-tiny text-[var(--cast-text-muted)] group-hover:text-[var(--cast-accent)] truncate flex-1 text-left py-0.5"
                          title={s.savedAt ? `Saved ${new Date(s.savedAt).toLocaleString()}` : s.name}
                        >
                          {s.name}
                          {s.savedAt && <span className="ml-1 text-tiny opacity-50">{new Date(s.savedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => { dispatch({ type: 'DELETE_SCENARIO', payload: s.id }); }}
                          aria-label={`Delete scenario ${s.name}`}
                          className="text-tiny text-[var(--cast-text-muted)] hover:text-[var(--cast-critical)] px-1"
                        >
                          x
                        </button>
                      </li>
                    ))}
                  </ul>
                  {(state.scenarios || []).length >= 2 && (
                    <button
                      type="button"
                      onClick={() => navigate('/compare')}
                      className="mt-1.5 w-full flex items-center justify-center gap-1 text-tiny text-[var(--cast-accent)] hover:text-[var(--cast-text)] py-1 rounded bg-[var(--cast-panel-alt)] hover:bg-[var(--cast-bg)] transition-colors"
                    >
                      <GitCompare size={10} /> Compare Scenarios
                    </button>
                  )}
                </>
              )}
            </div>

            {state.lastSaved && (
              <p className="text-tiny text-[var(--cast-text-muted)] text-center opacity-60">
                Auto-saved {new Date(state.lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".json" onChange={importSession} className="hidden" />
    </aside>
  );

  const mobileNav = location.pathname !== '/' ? (
    <>
      {/* Mobile tools panel — slides up above nav */}
      {toolsOpen && (
        <div className="mobile-nav hidden fixed bottom-14 left-0 right-0 z-50 p-3 animate-slide-in">
          <div className="card-glass shadow-xl border border-[var(--cast-border-strong)] p-3 space-y-3 rounded-xl mx-2">
            <div className="flex items-center justify-between">
              <span className="text-badge font-semibold text-[var(--cast-text)] uppercase tracking-wide">Session Tools</span>
              <button type="button" onClick={() => setToolsOpen(false)} className="text-[var(--cast-text-muted)] hover:text-[var(--cast-text)] p-0.5">
                <X size={12} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button type="button" onClick={exportSession} className="flex flex-col items-center gap-1 p-2 rounded-lg border border-[var(--cast-border)] hover:border-[var(--cast-accent)]/40 transition-colors">
                <Download size={13} className="text-[var(--cast-text-muted)]" />
                <span className="text-tiny text-[var(--cast-text-secondary)]">Export</span>
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1 p-2 rounded-lg border border-[var(--cast-border)] hover:border-[var(--cast-accent)]/40 transition-colors">
                <Upload size={13} className="text-[var(--cast-text-muted)]" />
                <span className="text-tiny text-[var(--cast-text-secondary)]">Import</span>
              </button>
              <button type="button" onClick={handleResetClick}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                  resetConfirm ? 'border-[var(--cast-critical)] bg-[var(--cast-critical)]/5' : 'border-[var(--cast-border)] hover:border-[var(--cast-critical)]/40'
                }`}>
                <RotateCcw size={13} className={resetConfirm ? 'text-[var(--cast-critical)]' : 'text-[var(--cast-text-muted)]'} />
                <span className={`text-tiny ${resetConfirm ? 'text-[var(--cast-critical)]' : 'text-[var(--cast-text-secondary)]'}`}>{resetConfirm ? 'Confirm' : 'Reset'}</span>
              </button>
            </div>
            <div className="border-t border-[var(--cast-border)] pt-2">
              <div className="flex gap-1">
                <input
                  className="input-field !py-1 !text-tiny flex-1 min-w-0"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="Save scenario..."
                  onKeyDown={(e) => e.key === 'Enter' && saveScenario()}
                />
                <button type="button" onClick={saveScenario} className="text-tiny font-medium text-[var(--cast-accent)] px-2 py-1 rounded hover:bg-[var(--cast-panel-alt)]">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <nav className="mobile-nav no-print hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--cast-panel)] border-t border-[var(--cast-border)] py-1.5">
        <div className="flex items-center gap-0.5 overflow-x-auto px-1 mobile-nav-scroll" style={{ scrollbarWidth: 'none' }}>
        {NAV_STEPS.map((step, index) => {
          const isActive = index === railStepIndex;
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => goToStep(index + 1)}
              aria-label={step.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors shrink-0 min-w-[3.25rem] ${
                isActive ? 'text-[var(--cast-accent)]' : 'text-[var(--cast-text-muted)]'
              }`}
            >
              <Icon size={16} />
              <span className="text-tiny font-medium">{step.label}</span>
            </button>
          );
        })}
        </div>
        <div className="flex justify-center border-t border-[var(--cast-border)]/50 pt-1">
        <button
          type="button"
          onClick={() => { setToolsOpen(!toolsOpen); setResetConfirm(false); }}
          aria-label="Tools"
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
            toolsOpen ? 'text-[var(--cast-accent)]' : 'text-[var(--cast-text-muted)]'
          }`}
        >
          <Settings size={16} />
          <span className="text-tiny font-medium">Tools</span>
        </button>
        </div>
      </nav>
    </>
  ) : null;

  return (
    <div className="h-full flex flex-col">
      <div className="gradient-line shrink-0" />

      <div className="flex-1 flex min-h-0">
        {location.pathname !== '/' && sidebar}

        <main className={`flex-1 flex flex-col min-w-0 bg-[var(--cast-bg)] overflow-hidden pb-[env(safe-area-inset-bottom)] ${location.pathname === '/reference' ? '' : ''}`}>
          <div className={`flex-1 flex flex-col overflow-hidden md:pb-0 ${location.pathname === '/reference' ? '' : 'pb-14'}`}>
            <Routes>
              <Route path="/" element={<ErrorBoundary fallbackMessage="Home page encountered an error."><HomePage /></ErrorBoundary>} />
              <Route path="/intake" element={<ErrorBoundary fallbackMessage="Customer Intake encountered an error."><IntakePage /></ErrorBoundary>} />
              <Route path="/analysis" element={<ErrorBoundary fallbackMessage="Analysis encountered an error."><InterpretationPage /></ErrorBoundary>} />
              <Route path="/sources" element={<ErrorBoundary fallbackMessage="Data Sources encountered an error."><SourceWorkflowPage /></ErrorBoundary>} />
              <Route path="/review" element={<ErrorBoundary fallbackMessage="Source Review encountered an error."><ReviewPage /></ErrorBoundary>} />
              <Route path="/coverage" element={<ErrorBoundary fallbackMessage="Coverage Analysis encountered an error."><CoveragePage /></ErrorBoundary>} />
              <Route path="/paths" element={<ErrorBoundary fallbackMessage="Architecture Paths encountered an error."><PlansPage /></ErrorBoundary>} />
              <Route path="/report" element={<ErrorBoundary fallbackMessage="Report encountered an error."><ReportPage /></ErrorBoundary>} />
              <Route path="/reference" element={<ErrorBoundary fallbackMessage="Source Reference Library encountered an error."><SourceReferenceLibraryPage /></ErrorBoundary>} />
              <Route path="/compare" element={<ErrorBoundary fallbackMessage="Scenario Comparison encountered an error."><ScenarioComparisonPage /></ErrorBoundary>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>

      {mobileNav}
    </div>
  );
}

export default App;
