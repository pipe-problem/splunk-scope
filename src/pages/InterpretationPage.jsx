import { useEffect, useState, useMemo } from 'react';
import {
  ArrowRight,
  Boxes,
  Cloud,
  ClipboardCheck,
  Database,
  ExternalLink,
  RefreshCw,
  Scale,
  Settings,
  Shield,
  Sparkles,
  Target,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useWorkflowNavigation } from '../hooks/useWorkflowNavigation.js';
import { interpretInputs } from '../services/interpretationEngine';
import { recommendApps } from '../services/appRecommendationEngine';
import { getGoalsForIntake, APPS_BY_ID } from '../services/goalAppSourceKnowledge.js';
import { getAnalysisSourcePriorities } from '../services/analysisSourcePriorityEngine.js';
import { resolveSplunkbaseLink } from '../services/splunkbaseCatalog.js';
import { getFlatSplunkApps } from '../services/splunkAppsCatalog.js';
import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog } from '../services/sizingEngine.js';
import { filterIntakeAppIds } from '../services/intakeImportHelpers.js';
import { mapToIntakeSplunkAppId } from '../services/intakeRecommendations.js';
import { resolveUseCaseProfiles } from '../services/useCaseResolver.js';
import PageHeaderActions from '../components/layout/PageHeaderActions';
import WorkflowStepIndicator from '../components/layout/WorkflowStepIndicator';
import { STEP } from '../config/workflowSteps.js';
import { truncateSubtitle } from '../utils/displayLabels.js';

const FLAT_SOURCES = flattenSourceCatalog(sourceCatalog);

const DEPLOYMENT_LABELS = {
  cloud: 'Splunk Cloud',
  onprem: 'On-premises',
  hybrid: 'Hybrid',
};

const GOAL_ICONS = {
  siem: Shield,
  rba: Scale,
  compliance: ClipboardCheck,
  cloud_security: Cloud,
  platform_admin: Settings,
  ml_analytics: Sparkles,
};

const CATEGORY_DOT_COLORS = [
  'var(--cast-accent)',
  'var(--cast-success)',
  'var(--cast-warning)',
  'var(--cast-info)',
  '#9B59B6',
  '#FB7428',
];

function intakeKey(intake) {
  return JSON.stringify([
    intake.useCases,
    intake.customUseCases,
    intake.desiredApps,
    intake.recommendedApps,
    intake.deploymentType,
    intake.crawlGoalPresetId,
    intake.walkGoalPresetId,
    intake.runGoalPresetId,
  ]);
}

function categoryDotColor(category = '') {
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash + category.charCodeAt(i) * (i + 1)) % CATEGORY_DOT_COLORS.length;
  return CATEGORY_DOT_COLORS[hash] || CATEGORY_DOT_COLORS[0];
}

function resolveAppLink(appId) {
  const flat = getFlatSplunkApps().find((a) => a.id === appId);
  const knowledge = APPS_BY_ID.get(appId);
  const catalogKey = flat?.catalogId || knowledge?.splunkbaseCatalogId || appId;
  const link = resolveSplunkbaseLink(catalogKey);
  return {
    id: appId,
    name: flat?.name || knowledge?.name || appId,
    url: link?.customerUrl || null,
  };
}

function AnalysisSection({ title, icon: Icon, children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-[var(--cast-border)] bg-[var(--cast-panel)]/90 p-4 sm:p-5 shadow-sm ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        {Icon && (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--cast-panel-alt)] text-[var(--cast-accent)]">
            <Icon size={16} aria-hidden />
          </span>
        )}
        <h3 className="text-card-title m-0">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function GoalCard({ goal }) {
  const Icon = GOAL_ICONS[goal.id] || Target;
  return (
    <li className="flex gap-3 rounded-xl border border-[var(--cast-border)]/80 bg-[var(--cast-bg)]/60 px-3 py-2.5">
      <span className="inline-flex shrink-0 items-center justify-center w-9 h-9 rounded-lg bg-[var(--cast-accent-muted)] text-[var(--cast-accent)]">
        <Icon size={17} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--cast-text)] leading-snug">{goal.name}</p>
        <p className="text-label text-[var(--cast-text-secondary)] mt-0.5 leading-snug line-clamp-1">
          {truncateSubtitle(goal.shortExplanation, 1)}
        </p>
      </div>
    </li>
  );
}

function SolutionRow({ app, tag }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-2.5 border-b border-[var(--cast-border)]/50 last:border-0">
      {app.url ? (
        <a
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--cast-text)] hover:text-[var(--cast-accent)] min-w-0"
        >
          <span className="truncate">{app.name}</span>
          <ExternalLink size={12} className="opacity-60 shrink-0" />
        </a>
      ) : (
        <span className="text-sm font-medium text-[var(--cast-text)] truncate">{app.name}</span>
      )}
      <span
        className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0 ${
          tag === 'Requested'
            ? 'border-[var(--cast-accent)]/35 bg-[var(--cast-accent-muted)] text-[var(--cast-accent)]'
            : 'border-[var(--cast-border)] bg-[var(--cast-panel-alt)] text-[var(--cast-text-muted)]'
        }`}
      >
        {tag}
      </span>
    </li>
  );
}

function RelevanceBar({ score }) {
  const pct = Math.max(10, Math.min(100, (score / 10) * 100));
  return (
    <div className="flex items-center gap-2 min-w-[5.5rem]">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--cast-panel-alt)] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--cast-accent)] to-[var(--cast-success)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-bold tabular-nums text-[var(--cast-text-muted)] w-7 text-right">{score}/10</span>
    </div>
  );
}

function PrioritySourceRow({ row, category }) {
  const appLabels = row.appsPowered?.slice(0, 2).map((id) => {
    const flat = getFlatSplunkApps().find((a) => a.id === id);
    return flat?.name || APPS_BY_ID.get(id)?.name || id;
  }) || [];

  return (
    <li className="rounded-xl border border-[var(--cast-border)]/80 bg-[var(--cast-bg)]/50 px-3 py-3 sm:px-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {category && (
            <span
              className="mt-1.5 w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: categoryDotColor(category) }}
              title={category}
              aria-hidden
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm font-semibold text-[var(--cast-text)]">{row.sourceName}</p>
              <RelevanceBar score={row.relevanceScore1to10} />
            </div>
            {appLabels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {appLabels.map((label) => (
                  <span
                    key={label}
                    className="text-[11px] px-1.5 py-0.5 rounded border border-[var(--cast-border)] bg-[var(--cast-panel-alt)] text-[var(--cast-text-secondary)]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
            <p className="text-label text-[var(--cast-text-secondary)] mt-1.5 leading-snug line-clamp-1">
              {truncateSubtitle(row.whyOneLine, 1)}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function InterpretationPage() {
  const { state, dispatch } = useApp();
  const { goToStep } = useWorkflowNavigation();
  const { intake } = state;
  const currentIntakeKey = useMemo(() => intakeKey(intake), [intake]);
  const isStale = !!(
    state.interpretation &&
    state.interpretationIntakeKey &&
    state.interpretationIntakeKey !== currentIntakeKey
  );

  const [result, setResult] = useState(state.interpretation);
  const [reanalyzed, setReanalyzed] = useState(false);

  const { profiles } = useMemo(() => resolveUseCaseProfiles(intake), [intake]);
  const goals = useMemo(() => getGoalsForIntake(intake), [intake]);
  const desiredAppIds = useMemo(() => filterIntakeAppIds(intake.desiredApps || []), [intake.desiredApps]);

  const appRecommendations = useMemo(
    () => recommendApps({ intake, sourceStatuses: state.sources, useCaseProfiles: profiles }),
    [intake, state.sources, profiles],
  );

  const recommendedAppIds = useMemo(() => {
    const fromEngine = [
      ...(appRecommendations.recommendedSolutions || []),
      ...(appRecommendations.helpfulApps || []),
    ]
      .map((r) => mapToIntakeSplunkAppId(r.appId))
      .filter(Boolean);
    const merged = [...new Set([...(intake.recommendedApps || []), ...fromEngine])];
    return filterIntakeAppIds(merged).filter((id) => !desiredAppIds.includes(id));
  }, [appRecommendations, intake.recommendedApps, desiredAppIds]);

  const mergedSolutions = useMemo(() => {
    const byId = new Map();
    for (const id of desiredAppIds) {
      byId.set(id, { ...resolveAppLink(id), tag: 'Requested' });
    }
    for (const id of recommendedAppIds) {
      if (!byId.has(id)) {
        byId.set(id, { ...resolveAppLink(id), tag: 'Suggested' });
      }
    }
    return [...byId.values()];
  }, [desiredAppIds, recommendedAppIds]);

  const sourcePriorities = useMemo(
    () =>
      getAnalysisSourcePriorities({
        intake,
        desiredApps: desiredAppIds,
        recommendedApps: recommendedAppIds,
        useCaseProfiles: profiles,
        sourceStates: state.sources,
        overlapDecisions: state.overlapDecisions,
        limit: 8,
      }),
    [intake, desiredAppIds, recommendedAppIds, profiles, state.sources, state.overlapDecisions],
  );

  const sourceCategoryById = useMemo(
    () => new Map(FLAT_SOURCES.map((s) => [s.id, s.category || ''])),
    [],
  );

  useEffect(() => {
    if (!result) {
      const interpretation = interpretInputs({ ...intake, sourceStatuses: state.sources });
      setResult(interpretation);
      dispatch({ type: 'SET_INTERPRETATION', payload: interpretation, intakeKey: currentIntakeKey });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showStale = isStale && !reanalyzed;
  const customer = intake.customerName?.trim();
  const deploymentLabel = DEPLOYMENT_LABELS[intake.deploymentType] || null;

  function handleReanalyze() {
    const interpretation = interpretInputs({ ...intake, sourceStatuses: state.sources });
    setResult(interpretation);
    setReanalyzed(true);
    dispatch({ type: 'SET_INTERPRETATION', payload: interpretation, intakeKey: currentIntakeKey });
  }

  function goSources() {
    if (result) {
      dispatch({ type: 'SET_INTERPRETATION', payload: result, intakeKey: currentIntakeKey });
    }
    goToStep(STEP.SOURCES);
  }

  if (!result) {
    return (
      <div className="page-viewport items-center justify-center">
        <p className="text-[var(--cast-text-muted)]">Preparing your analysis…</p>
      </div>
    );
  }

  return (
    <div className="page-viewport">
      <div className="page-header shrink-0 no-print">
        <div className="min-w-0">
          <h2>Analysis</h2>
          <WorkflowStepIndicator currentStep={STEP.ANALYSIS} />
          <p className="text-label text-[var(--cast-text-muted)]">Workshop summary from your intake.</p>
        </div>
        <PageHeaderActions
          state={state}
          backLabel="Intake"
          onBack={() => goToStep(STEP.INTAKE)}
          continueLabel="Begin sizing"
          onContinue={goSources}
        >
          {showStale && (
            <button
              type="button"
              onClick={handleReanalyze}
              className="btn-secondary flex items-center gap-1.5 !border-[var(--cast-warning)]/40 !text-[var(--cast-warning)]"
            >
              <RefreshCw size={14} /> Refresh analysis
            </button>
          )}
        </PageHeaderActions>
      </div>

      <div className="page-scroll p-4 sm:p-5">
        {showStale && (
          <div className="page-content-width mb-4 p-2.5 rounded-lg border border-[var(--cast-warning)]/40 bg-[var(--cast-warning)]/10">
            <p className="text-label text-[var(--cast-warning)]">
              Intake changed — refresh to update this summary.
            </p>
          </div>
        )}

        <div className="page-content-width space-y-5">
          <section className="rounded-2xl border border-[var(--cast-border)] bg-gradient-to-br from-[var(--cast-panel)] to-[var(--cast-panel-alt)]/40 px-4 py-4 sm:px-6 sm:py-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h3 className="text-xl sm:text-2xl font-bold text-[var(--cast-text)] m-0">
                {customer || 'Customer scope'}
              </h3>
              {deploymentLabel && (
                <span className="text-badge px-2.5 py-1 rounded-full border border-[var(--cast-border)] bg-[var(--cast-panel-alt)] text-[var(--cast-text-secondary)] font-medium">
                  {deploymentLabel}
                </span>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnalysisSection title="Your objectives" icon={Target} className="bg-[var(--cast-panel-alt)]/25">
              {goals.length > 0 ? (
                <ul className="space-y-2">
                  {goals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} />
                  ))}
                </ul>
              ) : (
                <p className="text-label text-[var(--cast-text-muted)]">
                  Add use cases or Splunk apps on Intake to anchor objectives here.
                </p>
              )}
            </AnalysisSection>

            <AnalysisSection title="Splunk solutions" icon={Boxes}>
              {mergedSolutions.length > 0 ? (
                <ul>
                  {mergedSolutions.map((app) => (
                    <SolutionRow key={app.id} app={app} tag={app.tag} />
                  ))}
                </ul>
              ) : (
                <p className="text-label text-[var(--cast-text-muted)]">
                  Select Splunk apps on Intake or refresh recommendations to populate solutions.
                </p>
              )}
            </AnalysisSection>
          </div>

          <AnalysisSection title="Priority data sources" icon={Database}>
            {sourcePriorities.length > 0 ? (
              <ul className="space-y-2">
                {sourcePriorities.map((row) => (
                  <PrioritySourceRow
                    key={row.sourceId}
                    row={row}
                    category={sourceCategoryById.get(row.sourceId)}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-label text-[var(--cast-text-muted)]">
                Select objectives and apps on Intake to see prioritized sources.
              </p>
            )}
          </AnalysisSection>
        </div>
      </div>
    </div>
  );
}
