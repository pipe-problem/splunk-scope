import { useMemo, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import sourceCatalog from '../data/sources.json';
import { generatePlans } from '../services/planEngine';
import { computeIngestBudgetFromIntake } from '../services/budgetEngine';
import PageHeaderActions from '../components/layout/PageHeaderActions';
import WorkflowStepIndicator from '../components/layout/WorkflowStepIndicator';
import { SHOW_COVERAGE_PAGE } from '../config/featureFlags.js';
import { STEP } from '../config/workflowSteps.js';
import PathCarousel from '../components/architecture-paths/PathCarousel';
import PathTechnicalDetails from '../components/architecture-paths/PathTechnicalDetails';
import { flattenSourceCatalog } from '../services/sizingEngine';
import { resolveUseCaseProfiles } from '../services/useCaseResolver';
import { PLANNING_BUFFER_FRACTION } from '../utils/bufferBand.js';
import {
  findRecommendedPlanIndex,
  buildPathSourceRows,
  getPathDelta,
  getPlanIngestGb,
} from '../services/pathDisplayHelpers.js';
import { AlertTriangle } from 'lucide-react';

const flatCatalog = flattenSourceCatalog(sourceCatalog);

export default function PlansPage() {
  const { state, dispatch } = useApp();

  const useCases = useMemo(() => resolveUseCaseProfiles(state.intake).profiles, [state.intake]);

  const customSources = useMemo(() => {
    return Object.entries(state.sources)
      .filter(([id, s]) => id.startsWith('custom_') && (s.status === 'current' || s.status === 'future'))
      .map(([id, s]) => ({ id, name: s.name || 'Custom', ...s, telemetryDomains: s.telemetryDomains || {} }));
  }, [state.sources]);

  const budgetGbDay = useMemo(() => {
    const b = computeIngestBudgetFromIntake(state.intake);
    return b?.budgetGbDay ?? null;
  }, [state.intake]);

  const plans = useMemo(
    () =>
      generatePlans(
        flatCatalog,
        state.sources,
        useCases,
        customSources,
        state.overlapDecisions,
        PLANNING_BUFFER_FRACTION,
        {
          budgetGbDay,
          primaryProfileId: state.interpretation?.primaryUseCase?.id ?? null,
          intake: state.intake,
        },
      ),
    [
      state.sources,
      useCases,
      customSources,
      state.overlapDecisions,
      budgetGbDay,
      state.interpretation?.primaryUseCase?.id,
    ],
  );

  const hasReportPath = state.reportPathExplicit && state.selectedPlanIndex != null;
  const reportPathIndex = hasReportPath && plans.length
    ? Math.min(Math.max(0, state.selectedPlanIndex), plans.length - 1)
    : -1;

  const [viewIndex, setViewIndex] = useState(1);
  const [viewBootstrapped, setViewBootstrapped] = useState(false);

  useEffect(() => {
    if (!plans.length || viewBootstrapped) return;
    const walkIdx = findRecommendedPlanIndex(plans);
    const initial = hasReportPath
      ? Math.min(Math.max(0, state.selectedPlanIndex), plans.length - 1)
      : walkIdx >= 0
        ? walkIdx
        : 0;
    setViewIndex(initial);
    setViewBootstrapped(true);
  }, [plans.length, hasReportPath, state.selectedPlanIndex, viewBootstrapped, plans]);

  const isEmpty = plans.every((p) => p.sources.length === 0);

  const viewPlan = plans[viewIndex];
  const viewPrevPlan = viewIndex > 0 ? plans[viewIndex - 1] : null;
  const viewDelta = viewPlan ? getPathDelta(viewPlan, viewPrevPlan) : null;

  const { allRows: sourceRows, pathExpected } = useMemo(() => {
    if (!viewPlan) return { allRows: [], pathExpected: 0 };
    return buildPathSourceRows(viewPlan, state.sources, viewPrevPlan);
  }, [viewPlan, state.sources, viewPrevPlan]);

  function setReportPath(idx) {
    dispatch({ type: 'SELECT_PLAN', payload: idx });
  }

  return (
    <div className="page-viewport page-viewport--paths">
      <div className="page-header shrink-0 page-header--compact">
        <div className="min-w-0">
          <h2>Architecture Paths</h2>
          <p className="text-label text-[var(--cast-text-muted)] mt-0.5">
            Compare phased Splunk roadmaps and select a report path.
          </p>
          <WorkflowStepIndicator currentStep={STEP.PATHS} />
        </div>
        <PageHeaderActions
          state={state}
          backLabel={SHOW_COVERAGE_PAGE ? 'Coverage' : 'Review'}
          backStep={SHOW_COVERAGE_PAGE ? STEP.COVERAGE : STEP.REVIEW}
          onBack={() => dispatch({ type: 'SET_STEP', payload: SHOW_COVERAGE_PAGE ? STEP.COVERAGE : STEP.REVIEW })}
          continueLabel="Report"
          onContinue={() => dispatch({ type: 'SET_STEP', payload: STEP.REPORT })}
        />
      </div>

      <div className="page-scroll page-scroll--paths py-4">
        {isEmpty && (
          <div className="page-content-width">
          <div className="card-compact border-[var(--cast-warning)]/20 text-center py-6 max-w-md mx-auto">
            <AlertTriangle className="text-[var(--cast-warning)] mx-auto mb-2" size={20} />
            <p className="text-empty-title">No sources configured</p>
            <p className="text-empty-body mt-1">Add sources in Data Sources, then return here.</p>
          </div>
          </div>
        )}

        {!isEmpty && (
          <>
            <div className="path-carousel-viewport">
              <PathCarousel
                plans={plans}
                viewIndex={viewIndex}
                reportPathIndex={reportPathIndex}
                sourceStates={state.sources}
                onViewIndexChange={setViewIndex}
                onUseInReport={setReportPath}
              />
            </div>

            <div className="page-content-width">
              {viewPlan && (
                <PathTechnicalDetails
                  plan={viewPlan}
                  sourceRows={sourceRows}
                  pathExpected={pathExpected}
                  delta={viewDelta}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { getPlanIngestGb, buildPathSourceRows, findRecommendedPlanIndex };
