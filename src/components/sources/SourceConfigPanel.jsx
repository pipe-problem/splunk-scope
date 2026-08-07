import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import vendorModels from '../../data/vendorModels.json';
import { getMeasurementQuestion, resolveMeasurementInputFields } from '../../services/sourceMeasurementQuestionsService.js';
import { hasWorkbookBackedLogChannelOptions, getWorkbookBackedLogOptions } from '../../utils/workbookMeasurementDimensions.js';
import { applySourceConfigSave, applySourceConfigReset } from '../../services/sourceConfigModalEngine.js';
import { getNestedValue, patchDraftField } from '../../utils/draftPathUtils.js';
import { fieldMatchesPrimary } from '../../utils/measurementInputFields.js';
import SourceMoreInfoPanel from './SourceMoreInfoPanel.jsx';

function resolveSelectOptions(optionsSource) {
  if (!optionsSource) return [];
  let obj = vendorModels;
  for (const p of optionsSource.split('.')) {
    if (p === 'vendorModels') continue;
    obj = obj?.[p];
  }
  return Array.isArray(obj) ? obj.map((v) => (typeof v === 'string' ? v : v.name || v.id)) : [];
}

function normalizeCopy(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fieldLabelRepeatsQuestion(field, question, primaryInputField) {
  if (!question) return false;
  if (primaryInputField && fieldMatchesPrimary(field.key, primaryInputField)) return true;
  const q = normalizeCopy(question);
  const l = normalizeCopy(field.label);
  if (!l) return false;
  if (q.includes(l) || l.includes(q)) return true;
  const qWords = new Set(q.split(' ').filter((w) => w.length > 2));
  const lWords = l.split(' ').filter((w) => w.length > 2);
  if (!lWords.length) return false;
  const overlap = lWords.filter((w) => qWords.has(w)).length;
  return overlap / lWords.length >= 0.5;
}

function helperRepeatsQuestionHelper(field, helperText) {
  if (!helperText || !field.helper) return false;
  return normalizeCopy(field.helper) === normalizeCopy(helperText);
}

function sanitizePanelHelper(text) {
  if (!text) return '';
  return String(text)
    .replace(/\s*[\d.]+\s*GB\/day[^.]*\.?/gi, '')
    .replace(/GB\/day/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function FieldInput({ field, value, onChange, hideLabel, hideHelper, ariaLabel }) {
  const helper = hideHelper ? '' : sanitizePanelHelper(field.helper);
  if (field.type === 'select') {
    const opts = field.options || resolveSelectOptions(field.options_source);
    return (
      <div className="source-config-field">
        {!hideLabel && (
          <label className="text-sm block mb-2 font-medium text-[var(--cast-text)]">{field.label}</label>
        )}
        <select
          className="input-field w-full"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          aria-label={hideLabel ? ariaLabel || field.label : undefined}
        >
          <option value="">Select…</option>
          {opts.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        {helper && <p className="text-sm text-[var(--cast-text-muted)] mt-2 leading-relaxed">{helper}</p>}
      </div>
    );
  }
  return (
    <div className="source-config-field">
      {!hideLabel && (
        <label className="text-sm block mb-2 font-medium text-[var(--cast-text)]">{field.label}</label>
      )}
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        className="input-field w-full"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.type === 'number' ? '0' : ''}
        aria-label={hideLabel ? ariaLabel || field.label : undefined}
      />
      {helper && <p className="text-sm text-[var(--cast-text-muted)] mt-2 leading-relaxed">{helper}</p>}
    </div>
  );
}

export default function SourceConfigPanel({
  source,
  ss,
  displayMeta,
  showRelevance = false,
  useCases,
  sessionSources,
  anchorRect,
  onClose,
  onSave,
  onReset,
}) {
  const measurement = getMeasurementQuestion(source.id);
  const { numbers, selects } = resolveMeasurementInputFields(source.id, source, measurement);
  const primaryInputField = measurement?.primaryInputField;
  const showQuestion = Boolean(measurement?.question);
  const showLogToggles = hasWorkbookBackedLogChannelOptions(source);
  const logOpts = showLogToggles ? getWorkbookBackedLogOptions(source) : [];

  const [draft, setDraft] = useState(() => ({ ...ss }));
  const panelRef = useRef(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setDraft({ ...ss });
  }, [source.id, ss]);

  useLayoutEffect(() => {
    setEntered(false);
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [source.id, anchorRect]);

  const patchDraft = (patch) => setDraft((prev) => ({ ...prev, ...patch }));
  const patchField = (key, value) => setDraft((prev) => patchDraftField(prev, key, value));

  const toggleLog = (optionId) => {
    const selected = { ...(draft.selectedLogOptions || {}) };
    const opt = logOpts.find((o) => o.id === optionId);
    const isAdvanced = opt?.group === 'advanced';
    const currentlyOn = isAdvanced
      ? selected[optionId] === true
      : selected[optionId] !== false;
    selected[optionId] = currentlyOn ? false : true;
    patchDraft({ selectedLogOptions: selected });
  };

  const handleSave = () => onSave(applySourceConfigSave(draft));

  const handleReset = () => {
    const resetPayload = applySourceConfigReset(source);
    setDraft(resetPayload);
    onReset(resetPayload);
  };

  const configured = ss?.status === 'current';
  const appLabels = displayMeta?.appLabels || [];
  const visibleAppLabels = appLabels.slice(0, 2);
  const overflowAppCount = Math.max(0, appLabels.length - visibleAppLabels.length);

  const sizingFields = [...numbers, ...selects];
  const multiField = sizingFields.length > 1;

  const transformOrigin = 'center center';

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Configure ${source.name}`}
      className={`source-config-panel card-compact !p-0 pointer-events-auto z-40 w-[min(92vw,68rem)] max-h-[min(88dvh,calc(100dvh-5rem))] flex flex-col shadow-[var(--shadow-glow)] ring-1 ring-[var(--cast-accent)]/20 transition-all duration-300 ease-out ${
        entered ? 'scale-100 opacity-100' : 'scale-[0.96] opacity-0'
      }`}
      style={{ transformOrigin }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="sticky top-0 z-10 shrink-0 border-b border-[var(--cast-border)]/80 bg-[var(--cast-panel)] px-5 py-4 sm:px-7 sm:py-5 flex items-start justify-between gap-4 rounded-t-xl">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--cast-text)] leading-snug pr-2">{source.name}</h2>
          {(source.customerSummary || source.description) && (
            <p className="text-sm text-[var(--cast-text-secondary)] mt-2 leading-relaxed line-clamp-2">
              {source.customerSummary || source.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span
              className={`text-badge px-2.5 py-0.5 rounded-full border font-semibold ${
                showRelevance
                  ? 'bg-[var(--cast-accent-muted)] text-[var(--cast-accent)] border-[var(--cast-accent)]/25'
                  : 'bg-[var(--cast-panel-alt)] text-[var(--cast-text-muted)] border-[var(--cast-border)]'
              }`}
              title={showRelevance ? 'Relevance to your goals' : 'Complete intake (use case or app) to score relevance'}
            >
              Relevance {showRelevance ? (displayMeta?.relevanceScore1to10 ?? '—') : '—'}/10
            </span>
            <span
              className={`text-badge px-2.5 py-0.5 rounded-full border ${
                configured
                  ? 'bg-[var(--cast-success)]/15 text-[var(--cast-success)] border-[var(--cast-success)]/30'
                  : 'bg-[var(--cast-panel-alt)] text-[var(--cast-text-muted)] border-[var(--cast-border)]'
              }`}
            >
              {configured ? 'Configured' : 'Not configured'}
            </span>
            {visibleAppLabels.map((label) => (
              <span
                key={label}
                className="text-badge px-2.5 py-0.5 rounded-full bg-[var(--cast-panel-alt)] text-[var(--cast-text-secondary)] border border-[var(--cast-border)]"
              >
                {label}
              </span>
            ))}
            {overflowAppCount > 0 && (
              <span className="text-badge px-2.5 py-0.5 rounded-full bg-[var(--cast-panel-alt)] text-[var(--cast-text-muted)] border border-[var(--cast-border)]">
                +{overflowAppCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-[var(--cast-panel-alt)] text-[var(--cast-text-muted)]"
            onClick={handleReset}
            aria-label="Reset"
            title="Reset"
          >
            <RotateCcw size={17} />
          </button>
          <button
            type="button"
            className="p-2 rounded-lg bg-[var(--cast-accent)] text-white hover:opacity-90"
            onClick={handleSave}
            aria-label="Save"
            title="Save"
          >
            <Check size={18} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--cast-panel-alt)]"
            aria-label="Close"
          >
            <X size={18} className="text-[var(--cast-text-muted)]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hidden-scrollbar px-5 py-6 sm:px-7 sm:py-8 space-y-8">
        <section className="source-config-section" aria-labelledby="source-config-sizing-heading">
          <h3 id="source-config-sizing-heading" className="text-xs font-bold uppercase tracking-widest text-[var(--cast-text-muted)] mb-4">
            Sizing
          </h3>

          {showQuestion && (
            <div className="rounded-xl border border-[var(--cast-border)] bg-[var(--cast-panel-alt)]/40 px-5 py-4 sm:px-6 sm:py-5 mb-5">
              <p className="text-base sm:text-lg font-medium text-[var(--cast-text)] leading-relaxed">{measurement.question}</p>
              {measurement.helperText && (
                <p className="text-sm text-[var(--cast-text-muted)] mt-3 leading-relaxed max-w-3xl">{measurement.helperText}</p>
              )}
            </div>
          )}

          {sizingFields.length > 0 ? (
            <div
              className={
                multiField
                  ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6'
                  : 'max-w-md'
              }
            >
              {numbers.map((f) => {
                const isPrimary =
                  primaryInputField && fieldMatchesPrimary(f.key, primaryInputField);
                const hideLabel = showQuestion && isPrimary && fieldLabelRepeatsQuestion(f, measurement.question, primaryInputField);
                const hideHelper =
                  showQuestion && isPrimary && helperRepeatsQuestionHelper(f, measurement.helperText);
                return (
                <FieldInput
                  key={f.key}
                  field={f}
                  value={getNestedValue(draft, f.key)}
                  onChange={(v) => {
                    patchField(f.key, v);
                    if (f.key === 'ssoActiveUserCount' || f.key === 'officeActiveUserCount' || f.key === 'crmActiveUserCount') {
                      patchField('count', v);
                    }
                  }}
                  hideLabel={hideLabel}
                  hideHelper={hideHelper}
                  ariaLabel={measurement.question}
                />
              );})}
              {selects.map((f) => (
                <FieldInput
                  key={f.key}
                  field={f}
                  value={getNestedValue(draft, f.key)}
                  onChange={(v) => patchField(f.key, v)}
                  hideLabel={false}
                  hideHelper={false}
                  ariaLabel={measurement?.question || f.label}
                />
              ))}
            </div>
          ) : null}

          {showLogToggles && logOpts.length > 0 && (
            <div className="rounded-xl border border-[var(--cast-border)] bg-[var(--cast-panel-alt)]/30 px-5 py-4 sm:px-6 sm:py-5 mt-6 space-y-3">
              <h4 className="text-sm font-semibold text-[var(--cast-text)]">Log channels to collect</h4>
              <p className="text-sm text-[var(--cast-text-muted)] leading-relaxed">
                Select which Windows event logs to forward — rates align with the sizing calculator per server.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {logOpts.map((opt) => {
                  const isAdvanced = opt.group === 'advanced';
                  const on = isAdvanced
                    ? (draft.selectedLogOptions || {})[opt.id] === true
                    : (draft.selectedLogOptions || {})[opt.id] !== false;
                  return (
                    <label key={opt.id} className="flex items-start gap-2.5 text-sm text-[var(--cast-text-secondary)] cursor-pointer leading-relaxed">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleLog(opt.id)}
                        className="accent-[var(--cast-accent)] mt-0.5 shrink-0"
                      />
                      <span>{opt.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <div className="border-t border-[var(--cast-border)]/60 pt-8">
          <SourceMoreInfoPanel source={source} useCases={useCases} sourceStates={sessionSources} />
        </div>
      </div>
    </div>
  );
}
