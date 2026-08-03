import { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/layout/Toast';
import { ChevronRight, ChevronDown, Copy, Upload, AlertTriangle, X, ClipboardList } from 'lucide-react';
import SearchableMultiSelect from '../components/SearchableMultiSelect';
import UseCaseSelect from '../components/UseCaseSelect';
import AutoTextarea from '../components/AutoTextarea';
import { getIntakeSplunkAppsCatalog } from '../services/splunkAppsCatalog.js';
import { formatImportReviewLabel } from '../utils/displayLabels.js';
import { filterIntakeAppIds } from '../services/intakeImportHelpers.js';
import { suggestRecommendedAppIds } from '../services/intakeRecommendations.js';
import { DEFAULT_PATH_BUDGET_PERCENTAGES } from '../config/intakeDefaults.js';
import { ADVANCED_INTAKE } from '../config/featureFlags.js';
import sampleScenarios, { getSampleScenarioById } from '../data/sampleScenarios';
import { parseCustomerContext, formatExtractionSummary } from '../services/contextImportEngine';
import { buildCircuitExtractionPrompt } from '../services/circuitPromptBuilder.js';
import { processCircuitResponse } from '../services/circuitResponseProcessor.js';
import { matchParsedSplunkLabelToAppId } from '../services/intakeImportHelpers.js';
import {
  getGoalPresetsForPhase,
  getGoalPresetById,
  DEFAULT_GOAL_PRESET_IDS,
} from '../utils/goalPresets.js';
import WorkflowStepIndicator from '../components/layout/WorkflowStepIndicator';
import { STEP } from '../config/workflowSteps.js';

const DEPLOYMENT_TYPES = [
  { id: 'cloud', label: 'Splunk Cloud' },
  { id: 'onprem', label: 'On-premises' },
  { id: 'hybrid', label: 'Hybrid' },
];

function confidenceStyle(level) {
  if (level === 'high') return { fg: 'var(--cast-success)', bg: 'color-mix(in srgb, var(--cast-success) 15%, transparent)' };
  if (level === 'medium') return { fg: 'var(--cast-warning)', bg: 'color-mix(in srgb, var(--cast-warning) 15%, transparent)' };
  return { fg: 'var(--cast-text-muted)', bg: 'var(--cast-panel-alt)' };
}

function IntakeCard({ title, description, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-[var(--cast-border)] bg-[var(--cast-panel)]/90 px-4 py-3.5 sm:px-5 sm:py-4 shadow-sm ${className}`}>
      <h3 className="text-card-title mb-1">{title}</h3>
      {description && (
        <p className="text-badge text-[var(--cast-text-muted)] mb-3 leading-snug">{description}</p>
      )}
      {!description && <div className="mb-3" />}
      {children}
    </section>
  );
}

function PathBudgetInput({ label, hint, value, defaultValue, onChange }) {
  return (
    <div>
      <label className="text-label block mb-0.5">
        {label}
        {hint && <span className="text-badge opacity-70 font-normal ml-1">{hint}</span>}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          max={200}
          className="input-field w-24 text-sm"
          value={value ?? defaultValue}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="text-sm text-[var(--cast-text-muted)]">%</span>
      </div>
    </div>
  );
}

function CircuitImportSection({ children }) {
  return (
    <section className="rounded-2xl border border-[var(--cast-border)] bg-[var(--cast-panel)]/90 px-4 py-3.5 sm:px-5 sm:py-4 shadow-sm">
      {children}
    </section>
  );
}

function GoalPresetSelect({ phase, value, onChange, hint }) {
  const presets = getGoalPresetsForPhase(phase);
  const selected = getGoalPresetById(phase, value);
  return (
    <div>
      <label className="text-label block mb-0.5">
        {phase === 'crawl' ? 'Crawl' : phase === 'walk' ? 'Walk' : 'Run'}
        <span className="text-badge opacity-70 font-normal ml-1">{hint}</span>
      </label>
      <select
        className="input-field w-full text-sm"
        value={value || DEFAULT_GOAL_PRESET_IDS[phase]}
        onChange={(e) => onChange(e.target.value)}
      >
        {presets.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      {selected?.description && (
        <p className="text-badge text-[var(--cast-text-muted)] mt-1 leading-snug">{selected.description}</p>
      )}
      {selected?.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.tags.slice(0, 4).map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--cast-border)] text-[var(--cast-text-muted)]">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IntakePage() {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const { intake } = state;
  const fileInputRef = useRef(null);

  const [circuitDraft, setCircuitDraft] = useState('');
  const [circuitResult, setCircuitResult] = useState(null);
  const [applyBudget, setApplyBudget] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [contextDraft, setContextDraft] = useState('');
  const [heuristicResult, setHeuristicResult] = useState(null);

  const [previewEdits, setPreviewEdits] = useState(null);

  function update(field, value) {
    dispatch({ type: 'UPDATE_INTAKE', payload: { [field]: value } });
  }

  function handleNext() {
    dispatch({ type: 'SET_STEP', payload: STEP.ANALYSIS });
  }

  const [exampleMenuOpen, setExampleMenuOpen] = useState(false);
  const exampleMenuRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (exampleMenuRef.current && !exampleMenuRef.current.contains(e.target)) {
        setExampleMenuOpen(false);
      }
    }
    if (exampleMenuOpen) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [exampleMenuOpen]);

  function loadExample(scenarioId) {
    const activeId = state.activeTemplateId?.startsWith('example:')
      ? state.activeTemplateId.replace('example:', '')
      : state.activeTemplateId === '__example__'
        ? sampleScenarios[0]?.id
        : null;
    if (activeId === scenarioId) {
      dispatch({ type: 'CLEAR_EXAMPLE' });
      toast.info('Example cleared.');
      setExampleMenuOpen(false);
      return;
    }
    const scenario = getSampleScenarioById(scenarioId);
    if (!scenario) return;
    if (state.activeTemplateId) dispatch({ type: 'CLEAR_TEMPLATE' });
    dispatch({
      type: 'APPLY_EXAMPLE',
      payload: {
        intake: scenario.intake,
        sources: scenario.sources,
        selectedPlanIndex: scenario.selectedPlanIndex ?? null,
        exampleId: `example:${scenario.id}`,
        overlapDecisions: scenario.overlapDecisions ?? {},
        suppressPathRecommendation: scenario.suppressPathRecommendation ?? false,
      },
    });
    setExampleMenuOpen(false);
    toast.success('Example loaded');
  }

  async function handleCopyCircuitPrompt() {
    const prompt = buildCircuitExtractionPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success('Circuit prompt copied');
    } catch {
      toast.error('Could not copy to clipboard — select and copy manually.');
    }
  }

  function handleProcessCircuit() {
    const text = circuitDraft.trim();
    if (!text) {
      setCircuitResult(null);
      setPreviewEdits(null);
      return;
    }
    const result = processCircuitResponse(text);
    setCircuitResult(result);
    if (result.parsed && result.fields) {
      setPreviewEdits({
        customerName: result.fields.customerName || '',
        deploymentType: result.fields.deploymentType || 'unknown',
        budget: result.fields.budget,
        discoveryNotes: result.fields.discoveryNotes || '',
        useCases: [...(result.fields.useCases || [])],
        desiredApps: [...(result.fields.desiredApps || [])],
        crawlGoalPresetId: result.fields.crawlGoalPresetId || DEFAULT_GOAL_PRESET_IDS.crawl,
        walkGoalPresetId: result.fields.walkGoalPresetId || DEFAULT_GOAL_PRESET_IDS.walk,
        runGoalPresetId: result.fields.runGoalPresetId || DEFAULT_GOAL_PRESET_IDS.run,
        pathBudgetPercentages: result.fields.pathBudgetPercentages || { ...DEFAULT_PATH_BUDGET_PERCENTAGES },
        sourceHints: result.fields.sourceHints || [],
      });
      setApplyBudget(result.fields.budget != null);
    } else {
      setPreviewEdits(null);
    }
    if (!result.parsed && result.parseError) {
      toast.error(result.parseError);
    }
  }

  function handleApplyCircuit() {
    if (!circuitResult?.parsed || !previewEdits) return;
    const updates = {};
    if (previewEdits.customerName?.trim()) updates.customerName = previewEdits.customerName.trim();
    if (previewEdits.deploymentType && previewEdits.deploymentType !== 'unknown') {
      updates.deploymentType = previewEdits.deploymentType;
    }
    if (applyBudget && previewEdits.budget != null) {
      updates.opportunityBudgetUsd = String(previewEdits.budget);
    }
    if (previewEdits.discoveryNotes?.trim()) {
      updates.discoveryNotes = [intake.discoveryNotes, previewEdits.discoveryNotes.trim()]
        .filter(Boolean)
        .join('\n\n')
        .trim();
    }
    const prevUc = intake.useCases || [];
    updates.useCases = [...new Set([...prevUc, ...(previewEdits.useCases || [])])];
    const prevApps = intake.desiredApps || [];
    updates.desiredApps = filterIntakeAppIds([...new Set([...prevApps, ...(previewEdits.desiredApps || [])])]);
    if (previewEdits.crawlGoalPresetId) updates.crawlGoalPresetId = previewEdits.crawlGoalPresetId;
    if (previewEdits.walkGoalPresetId) updates.walkGoalPresetId = previewEdits.walkGoalPresetId;
    if (previewEdits.runGoalPresetId) updates.runGoalPresetId = previewEdits.runGoalPresetId;
    if (previewEdits.pathBudgetPercentages) {
      updates.pathBudgetPercentages = {
        ...pathBudgetPercentages,
        ...previewEdits.pathBudgetPercentages,
      };
    }
    if (previewEdits.sourceHints?.length) {
      updates.sourceHints = [...(intake.sourceHints || []), ...previewEdits.sourceHints];
    }
    dispatch({ type: 'UPDATE_INTAKE', payload: updates });
    dispatch({
      type: 'SET_IMPORTED_CONTEXT',
      payload: {
        result: circuitResult.raw,
        summary: `Circuit-assisted import (${circuitResult.source})`,
        appliedAt: new Date().toISOString(),
        source: circuitResult.source,
      },
    });
    setCircuitResult(null);
    setPreviewEdits(null);
    setCircuitDraft('');
    toast.success('Circuit findings applied to intake.');
  }

  function handleDismissCircuit() {
    setCircuitResult(null);
    setPreviewEdits(null);
  }

  function handleHeuristicExtract() {
    const text = contextDraft.trim();
    if (!text) {
      setHeuristicResult(null);
      return;
    }
    setHeuristicResult(parseCustomerContext(text));
  }

  function handleApplyHeuristic() {
    if (!heuristicResult) return;
    const updates = {};
    if (heuristicResult.customerName) updates.customerName = heuristicResult.customerName;
    const dm = heuristicResult.deploymentModel;
    if (dm && dm !== 'unknown') updates.deploymentType = dm;
    const prevUc = intake.useCases || [];
    updates.useCases = [...new Set([...prevUc, ...(heuristicResult.useCases || [])])];
    const prevApps = intake.desiredApps || [];
    const newIds = [];
    for (const lbl of heuristicResult.splunkApps || []) {
      const id = matchParsedSplunkLabelToAppId(lbl);
      newIds.push(id || `custom:${lbl}`);
    }
    updates.desiredApps = filterIntakeAppIds([...new Set([...prevApps, ...newIds])]);
    const noteBits = [];
    if (heuristicResult.vendors?.length) noteBits.push(`Vendors noted: ${heuristicResult.vendors.join(', ')}`);
    if (heuristicResult.dataSources?.length) noteBits.push(`Data sources: ${heuristicResult.dataSources.join(', ')}`);
    if (heuristicResult.unknowns?.length) noteBits.push(`Pattern import — ${formatImportReviewLabel()}: ${heuristicResult.unknowns.join('; ')}`);
    if (noteBits.length) {
      updates.discoveryNotes = [intake.discoveryNotes, noteBits.join('\n')].filter(Boolean).join('\n\n').trim();
    }
    dispatch({ type: 'UPDATE_INTAKE', payload: updates });
    dispatch({
      type: 'SET_IMPORTED_CONTEXT',
      payload: {
        result: heuristicResult,
        summary: formatExtractionSummary(heuristicResult),
        appliedAt: new Date().toISOString(),
        source: 'heuristic_fallback',
      },
    });
    setHeuristicResult(null);
    setContextDraft('');
    toast.success('Pattern-matching findings applied.');
  }

  function handleFileChange(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setCircuitDraft((prev) => (prev ? `${prev}\n\n${text}` : text));
    };
    reader.readAsText(file);
  }

  const isExampleActive = state.activeTemplateId?.startsWith('example:') || state.activeTemplateId === '__example__';
  const activeExampleId = state.activeTemplateId?.startsWith('example:')
    ? state.activeTemplateId.replace('example:', '')
    : state.activeTemplateId === '__example__'
      ? sampleScenarios[0]?.id
      : null;

  const conf = circuitResult?.parsed ? confidenceStyle(circuitResult.confidence) : null;
  const intakeAppsCatalog = useMemo(() => getIntakeSplunkAppsCatalog(), []);
  const pathBudgetPercentages = intake.pathBudgetPercentages || DEFAULT_PATH_BUDGET_PERCENTAGES;

  function updatePathBudgetPercent(phase, raw) {
    const num = parseInt(String(raw), 10);
    const pct = Number.isFinite(num) ? num : DEFAULT_PATH_BUDGET_PERCENTAGES[phase];
    update('pathBudgetPercentages', {
      ...pathBudgetPercentages,
      [phase]: pct,
    });
  }

  function handleSuggestRecommendedApps() {
    const ids = suggestRecommendedAppIds(intake, state.sources);
    update('recommendedApps', ids);
    toast.success(ids.length ? 'Recommended apps updated.' : 'No app recommendations for current intake.');
  }

  return (
    <div className="page-viewport">
      <div className="page-header shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h2>Customer Intake</h2>
            <WorkflowStepIndicator currentStep={STEP.INTAKE} />
          </div>
          <p className="hidden md:block page-subtitle">Capture customer context with Circuit-assisted structured import or manual entry</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <div className="relative" ref={exampleMenuRef}>
            <button
              type="button"
              onClick={() => setExampleMenuOpen((v) => !v)}
              className="px-3 py-1.5 rounded-full text-sm font-medium border border-[var(--cast-border)] text-[var(--cast-text-secondary)] hover:border-[var(--cast-accent)]/40 hover:text-[var(--cast-text)]"
            >
              {isExampleActive ? 'Example ▾' : 'Load Example ▾'}
            </button>
            {exampleMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[240px] rounded-xl border border-[var(--cast-border)] bg-[var(--cast-panel)] shadow-lg py-1">
                {sampleScenarios.map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--cast-panel-alt)] ${activeExampleId === sc.id ? 'text-[var(--cast-accent)] font-medium' : 'text-[var(--cast-text-secondary)]'}`}
                    onClick={() => loadExample(sc.id)}
                  >
                    {sc.label || sc.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={handleNext} className="btn-primary flex items-center gap-1.5">
            Continue to analysis <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="page-scroll py-4 sm:py-5">
        <div className="page-content-width page-content-width--intake space-y-4 scroll-mt-3">
          {/* Circuit-assisted import */}
          <CircuitImportSection>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <ClipboardList size={14} className="text-[var(--cast-accent)] shrink-0" aria-hidden="true" />
              <h3 className="text-card-title m-0">Circuit-assisted import</h3>
              <span className="text-badge uppercase tracking-wider text-[var(--cast-text-muted)] px-1.5 py-0.5 rounded border border-[var(--cast-border)]/80">Structured import</span>
            </div>
            <p className="text-label text-[var(--cast-text-secondary)] mb-3 leading-snug">
              Copy the extraction prompt into Cisco Circuit, paste customer notes there, then paste Circuit&apos;s JSON response below.
              Customer data stays in Circuit — Scope only parses structured JSON locally.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <button type="button" className="btn-secondary flex items-center gap-1.5 text-badge" onClick={handleCopyCircuitPrompt}>
                <Copy size={12} /> Copy Circuit Extraction Prompt
              </button>
              <input ref={fileInputRef} type="file" accept=".txt,.md,.json,text/plain,application/json" className="hidden" onChange={handleFileChange} />
              <button type="button" className="btn-secondary flex items-center gap-1.5 text-badge" onClick={() => fileInputRef.current?.click()}>
                <Upload size={12} /> Upload response file
              </button>
            </div>
            <label className="text-label block mb-1">Paste Circuit response here</label>
            <AutoTextarea
              className="font-mono text-[13px]"
              value={circuitDraft}
              onChange={(e) => setCircuitDraft(e.target.value)}
              placeholder="Paste JSON returned by Circuit (JSON only, no markdown)…"
              minRows={4}
              maxRows={14}
            />
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button type="button" className="btn-primary text-badge" onClick={handleProcessCircuit}>Process Circuit Output</button>
            </div>
            {circuitResult?.parsed && previewEdits && conf && (
              <div className="mt-3">
                <CircuitPreview
                  result={circuitResult}
                  conf={conf}
                  previewEdits={previewEdits}
                  setPreviewEdits={setPreviewEdits}
                  applyBudget={applyBudget}
                  setApplyBudget={setApplyBudget}
                  onApply={handleApplyCircuit}
                  onDismiss={handleDismissCircuit}
                />
              </div>
            )}
            {circuitResult && !circuitResult.parsed && circuitResult.parseError && (
              <p className="text-badge text-[var(--cast-warning)] mt-2">{circuitResult.parseError}</p>
            )}
          </CircuitImportSection>

          {/* Customer */}
          <IntakeCard title="Customer">
            <div className="space-y-3">
              <div>
                <label className="text-label block mb-1">Customer name</label>
                <input
                  className="input-field w-full"
                  value={intake.customerName}
                  onChange={(e) => update('customerName', e.target.value)}
                  placeholder="Organization name"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                />
              </div>
              <div>
                <label className="text-label block mb-2">Deployment</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {DEPLOYMENT_TYPES.map((dt) => (
                    <button
                      type="button"
                      key={dt.id}
                      onClick={() => update('deploymentType', dt.id)}
                      className={`py-2 rounded-lg border text-center text-label font-medium leading-tight ${intake.deploymentType === dt.id ? 'border-[var(--cast-accent)] bg-[var(--cast-accent-muted)] text-[var(--cast-accent)]' : 'border-[var(--cast-border)] text-[var(--cast-text-secondary)] hover:border-[var(--cast-accent)]/40'}`}
                    >
                      {dt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </IntakeCard>

          {/* Budget */}
          <IntakeCard
            title="Budget"
            description="Internal planning inputs — dollar budget converts to GB/day unless override is set."
          >
            <div className="space-y-3">
              <div>
                <label className="text-label block mb-1">Planning budget (USD)</label>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--cast-text-muted)] text-sm">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input-field flex-1 max-w-xs"
                    value={intake.opportunityBudgetUsd ?? ''}
                    onChange={(e) => update('opportunityBudgetUsd', e.target.value)}
                    placeholder="e.g. 250000"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                  />
                </div>
              </div>
              <div>
                <label className="text-label block mb-1">GB/day override (optional)</label>
                <p className="text-badge text-[var(--cast-text-muted)] mb-1 leading-snug">Overrides dollar conversion.</p>
                <input
                  type="text"
                  inputMode="decimal"
                  className="input-field max-w-xs"
                  value={intake.budgetGbDayOverride ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    update('budgetGbDayOverride', v === '' ? null : v);
                  }}
                  placeholder="e.g. 120"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                />
              </div>
            </div>
          </IntakeCard>

          {/* Apps */}
          <IntakeCard title="Apps">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 min-w-0">
                  <label className="text-label">Use cases</label>
                  <UseCaseSelect selected={intake.useCases || []} onChange={(val) => update('useCases', val)} placeholder="Add use cases…" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <label className="text-label">Desired Splunk apps</label>
                  <SearchableMultiSelect
                    options={intakeAppsCatalog}
                    selected={filterIntakeAppIds(intake.desiredApps || [])}
                    onChange={(val) => update('desiredApps', filterIntakeAppIds(val))}
                    placeholder="Add apps…"
                    allowCustom={true}
                  />
                </div>
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-label">Recommended apps</label>
                  <button type="button" className="btn-secondary text-badge" onClick={handleSuggestRecommendedApps}>
                    Refresh from engine
                  </button>
                </div>
                <p className="text-badge text-[var(--cast-text-muted)] leading-snug">
                  Engine suggestions based on use cases and intake — editable before analysis.
                </p>
                <SearchableMultiSelect
                  options={intakeAppsCatalog}
                  selected={filterIntakeAppIds(intake.recommendedApps || [])}
                  onChange={(val) => update('recommendedApps', filterIntakeAppIds(val))}
                  placeholder="Recommended apps…"
                  allowCustom={false}
                />
              </div>
            </div>
          </IntakeCard>

          {/* Path targets */}
          <IntakeCard
            title="Path targets"
            description="Percent of ingest budget allocated to each maturity path (defaults: Crawl 80%, Walk 100%, Run 110%)."
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <PathBudgetInput
                label="Crawl"
                hint="Day 1"
                value={pathBudgetPercentages.crawl}
                defaultValue={DEFAULT_PATH_BUDGET_PERCENTAGES.crawl}
                onChange={(v) => updatePathBudgetPercent('crawl', v)}
              />
              <PathBudgetInput
                label="Walk"
                hint="3–6 mo"
                value={pathBudgetPercentages.walk}
                defaultValue={DEFAULT_PATH_BUDGET_PERCENTAGES.walk}
                onChange={(v) => updatePathBudgetPercent('walk', v)}
              />
              <PathBudgetInput
                label="Run"
                hint="12+ mo"
                value={pathBudgetPercentages.run}
                defaultValue={DEFAULT_PATH_BUDGET_PERCENTAGES.run}
                onChange={(v) => updatePathBudgetPercent('run', v)}
              />
            </div>
          </IntakeCard>

          {ADVANCED_INTAKE && (
            <section className="rounded-2xl border border-[var(--cast-border)] bg-[var(--cast-panel)]/90 px-4 py-3 sm:px-5 shadow-sm">
              <button
                type="button"
                className="flex items-center gap-2 text-label text-[var(--cast-text-secondary)] hover:text-[var(--cast-text)]"
                onClick={() => setAdvancedOpen((v) => !v)}
              >
                <ChevronDown size={14} className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                Edit advanced intake fields
              </button>
              {advancedOpen && (
                <div className="mt-3 space-y-3 border-t border-[var(--cast-border)]/60 pt-3">
                  <div>
                    <label className="text-label block mb-1">Discovery notes / context</label>
                    <AutoTextarea
                      value={intake.discoveryNotes}
                      onChange={(e) => update('discoveryNotes', e.target.value)}
                      placeholder="Environment, constraints, stakeholders, source/vendor counts…"
                      minRows={3}
                      maxRows={12}
                    />
                  </div>
                  <div>
                    <label className="text-label block mb-1">Additional goals (freeform)</label>
                    <AutoTextarea
                      value={intake.customUseCases || ''}
                      onChange={(e) => update('customUseCases', e.target.value)}
                      placeholder="e.g. MTTR targets, insider risk, board reporting…"
                      minRows={2}
                      maxRows={6}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <GoalPresetSelect
                      phase="crawl"
                      hint="Day 1"
                      value={intake.crawlGoalPresetId || DEFAULT_GOAL_PRESET_IDS.crawl}
                      onChange={(v) => update('crawlGoalPresetId', v)}
                    />
                    <GoalPresetSelect
                      phase="walk"
                      hint="3–6 mo"
                      value={intake.walkGoalPresetId || DEFAULT_GOAL_PRESET_IDS.walk}
                      onChange={(v) => update('walkGoalPresetId', v)}
                    />
                    <GoalPresetSelect
                      phase="run"
                      hint="12+ mo"
                      value={intake.runGoalPresetId || DEFAULT_GOAL_PRESET_IDS.run}
                      onChange={(v) => update('runGoalPresetId', v)}
                    />
                  </div>
                  {(intake.crawlGoal || intake.walkGoal || intake.runGoal) && (
                    <div className="rounded-lg border border-[var(--cast-border)] p-2 text-badge text-[var(--cast-text-muted)]">
                      <p className="font-medium text-[var(--cast-text-secondary)] mb-1">Legacy freeform goals (preserved in session)</p>
                      {intake.crawlGoal && <p>Crawl: {intake.crawlGoal}</p>}
                      {intake.walkGoal && <p>Walk: {intake.walkGoal}</p>}
                      {intake.runGoal && <p>Run: {intake.runGoal}</p>}
                    </div>
                  )}
                  {(intake.sourceHints?.length > 0) && (
                    <div className="rounded-lg border border-[var(--cast-border)] p-2">
                      <p className="text-badge font-medium text-[var(--cast-text-secondary)] mb-1">Source hints (from import)</p>
                      <ul className="text-badge text-[var(--cast-text-muted)] space-y-0.5 list-disc pl-4">
                        {intake.sourceHints.slice(-8).map((h, i) => (
                          <li key={i}>
                            {[h.sourceName || h.sourceId, h.vendor, h.count != null ? `${h.count} units` : null, h.notes].filter(Boolean).join(' · ')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <button
                      type="button"
                      className="text-badge text-[var(--cast-accent)] hover:underline"
                      onClick={() => setFallbackOpen((v) => !v)}
                    >
                      {fallbackOpen ? 'Hide' : 'Show'} unstructured text fallback (pattern matching)
                    </button>
                    {fallbackOpen && (
                      <div className="mt-2 space-y-2">
                        <p className="text-badge text-[var(--cast-text-muted)]">
                          For pasted notes without Circuit JSON — local regex/heuristic extraction only.
                        </p>
                        <AutoTextarea
                          className="font-mono text-[13px]"
                          value={contextDraft}
                          onChange={(e) => setContextDraft(e.target.value)}
                          placeholder="Paste unstructured meeting notes…"
                          minRows={3}
                          maxRows={10}
                        />
                        <div className="flex gap-2">
                          <button type="button" className="btn-secondary text-badge" onClick={handleHeuristicExtract}>Extract (pattern matching)</button>
                          {heuristicResult && (
                            <button type="button" className="btn-primary text-badge" onClick={handleApplyHeuristic}>Apply findings</button>
                          )}
                        </div>
                        {heuristicResult && (
                          <p className="text-badge text-[var(--cast-text-muted)]">
                            Confidence: {heuristicResult.confidence} — {heuristicResult.useCases?.join('; ') || 'no use cases detected'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function CircuitPreview({ result, conf, previewEdits, setPreviewEdits, applyBudget, setApplyBudget, onApply, onDismiss }) {
  const toggleUseCase = (name) => {
    const set = new Set(previewEdits.useCases || []);
    if (set.has(name)) set.delete(name);
    else set.add(name);
    setPreviewEdits({ ...previewEdits, useCases: [...set] });
  };

  return (
    <div className="card-alt border border-[var(--cast-border-strong)] p-3 space-y-2 relative">
      <button type="button" className="absolute top-2 right-2 p-1 rounded-md text-[var(--cast-text-muted)] hover:bg-[var(--cast-panel-alt)]" aria-label="Dismiss" onClick={onDismiss}>
        <X size={14} />
      </button>
      <div className="flex flex-wrap items-center gap-2 pr-6">
        <span className="text-badge font-medium text-[var(--cast-text)]">Extraction preview</span>
        <span className="text-badge px-2 py-0.5 rounded-full font-medium capitalize" style={{ color: conf.fg, backgroundColor: conf.bg }}>
          {result.confidence}
        </span>
        {result.source === 'heuristic_fallback' && (
          <span className="text-badge text-[var(--cast-warning)]">Pattern-matching fallback</span>
        )}
      </div>

      <div className="grid gap-2 text-label">
        <label className="block">
          <span className="text-badge text-[var(--cast-text-muted)] uppercase">Customer</span>
          <input className="input-field w-full mt-0.5" value={previewEdits.customerName} onChange={(e) => setPreviewEdits({ ...previewEdits, customerName: e.target.value })} />
        </label>
        <div>
          <span className="text-badge text-[var(--cast-text-muted)] uppercase">Deployment</span>
          <select
            className="input-field w-full mt-0.5"
            value={previewEdits.deploymentType}
            onChange={(e) => setPreviewEdits({ ...previewEdits, deploymentType: e.target.value })}
          >
            <option value="unknown">Unknown</option>
            <option value="cloud">Splunk Cloud</option>
            <option value="onprem">On-premises</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
        {previewEdits.budget != null && (
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={applyBudget} onChange={(e) => setApplyBudget(e.target.checked)} id="apply-budget" />
            <label htmlFor="apply-budget" className="text-label">Apply budget ${previewEdits.budget} to planning budget</label>
          </div>
        )}
        {(previewEdits.useCases?.length > 0) && (
          <div>
            <span className="text-badge text-[var(--cast-text-muted)] uppercase">Use cases</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {previewEdits.useCases.map((uc) => (
                <button
                  key={uc}
                  type="button"
                  className="text-badge px-2 py-0.5 rounded border border-[var(--cast-accent)]/40 bg-[var(--cast-accent-muted)]"
                  onClick={() => toggleUseCase(uc)}
                >
                  {uc} ×
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <span className="text-badge text-[var(--cast-text-muted)] uppercase">Crawl preset</span>
            <select
              className="input-field w-full mt-0.5 text-sm"
              value={previewEdits.crawlGoalPresetId}
              onChange={(e) => setPreviewEdits({ ...previewEdits, crawlGoalPresetId: e.target.value })}
            >
              {getGoalPresetsForPhase('crawl').map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-badge text-[var(--cast-text-muted)] uppercase">Walk preset</span>
            <select
              className="input-field w-full mt-0.5 text-sm"
              value={previewEdits.walkGoalPresetId}
              onChange={(e) => setPreviewEdits({ ...previewEdits, walkGoalPresetId: e.target.value })}
            >
              {getGoalPresetsForPhase('walk').map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-badge text-[var(--cast-text-muted)] uppercase">Run preset</span>
            <select
              className="input-field w-full mt-0.5 text-sm"
              value={previewEdits.runGoalPresetId}
              onChange={(e) => setPreviewEdits({ ...previewEdits, runGoalPresetId: e.target.value })}
            >
              {getGoalPresetsForPhase('run').map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
        {(previewEdits.sourceHints?.length > 0) && (
          <div>
            <span className="text-badge text-[var(--cast-text-muted)] uppercase">Data sources found</span>
            <ul className="text-badge text-[var(--cast-text-secondary)] list-disc pl-4 mt-1">
              {previewEdits.sourceHints.map((h, i) => (
                <li key={i}>{[h.sourceName, h.sourceId, h.vendor, h.count != null ? `count: ${h.count}` : null].filter(Boolean).join(' · ')}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {(result.warnings?.length > 0 || result.needsReview?.length > 0 || result.openQuestions?.length > 0) && (
        <div className="rounded-lg border border-[var(--cast-warning)]/35 bg-[var(--cast-panel-alt)] p-2 space-y-1">
          <div className="flex items-center gap-1.5 text-[var(--cast-warning)] text-badge font-medium">
            <AlertTriangle size={12} /> {formatImportReviewLabel()}
          </div>
          <ul className="space-y-0.5 text-badge text-[var(--cast-text-secondary)] list-disc pl-4">
            {result.warnings?.map((w, i) => <li key={`w-${i}`}>{w}</li>)}
            {result.needsReview?.map((w, i) => <li key={`n-${i}`}>{w}</li>)}
          </ul>
          {result.openQuestions?.length > 0 && (
            <div className="mt-2">
              <p className="text-badge font-medium text-[var(--cast-text-secondary)]">Open questions</p>
              <ul className="text-badge list-disc pl-4">
                {result.openQuestions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
              <button
                type="button"
                className="text-badge text-[var(--cast-accent)] mt-1 hover:underline"
                onClick={() => navigator.clipboard.writeText(result.openQuestions.join('\n'))}
              >
                Copy open questions
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" className="btn-primary text-badge" onClick={onApply}>Apply to Intake</button>
        <button type="button" className="btn-secondary text-badge" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
}
