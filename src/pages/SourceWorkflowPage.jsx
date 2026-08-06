import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog } from '../services/sizingEngine';
import { resolveUseCaseProfiles } from '../services/useCaseResolver';
import { classifyAndSortSources } from '../services/sourceRecommendationEngine';
import { rankCategoriesByRelevance } from '../services/sourcePrioritizationEngine';
import { getSourceWorkflowDisplayMeta } from '../services/analysisSourcePriorityEngine.js';
import { searchSourceCatalog } from '../services/sourceSearchEngine.js';
import { OVERLAP_GROUPS, getOverlapPromptForSource } from '../services/overlapEngine';
import SourceFilterBar from '../components/sources/SourceFilterBar';
import SourceGridCard from '../components/sources/SourceGridCard';
import SourceConfigPanel from '../components/sources/SourceConfigPanel';
import CustomSourceModal from '../components/sources/CustomSourceModal';
import CustomConfigDrawer from '../components/sources/CustomConfigDrawer';
import {
  CUSTOM_SOURCE_CATEGORY,
  createCustomSourceId,
  customSourceCatalogEntry,
  listCustomSourcesFromSession,
  defaultCustomSourceState,
} from '../utils/customSources';
import { isIntakeReadyForSourceRelevance } from '../utils/intakeReadiness.js';
import PageHeaderActions from '../components/layout/PageHeaderActions';
import WorkflowStepIndicator from '../components/layout/WorkflowStepIndicator';
import { STEP } from '../config/workflowSteps.js';
import { AlertCircle } from 'lucide-react';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const categories = [...new Set(flatCatalog.map((s) => s.category).filter(Boolean))];

function categoryConfiguredCount(cat, sources) {
  if (cat === CUSTOM_SOURCE_CATEGORY) {
    return Object.entries(sources).filter(([id, s]) => id.startsWith('custom_') && s?.status === 'current').length;
  }
  const list = flatCatalog.filter((s) => s.category === cat);
  return list.filter((s) => sources[s.id]?.status === 'current').length;
}

function sortSourcesForGrid(sources, sourceStates, displayMetaById, intakeReady) {
  return [...sources].sort((a, b) => {
    const aConfigured = sourceStates[a.id]?.status === 'current' ? 1 : 0;
    const bConfigured = sourceStates[b.id]?.status === 'current' ? 1 : 0;
    if (bConfigured !== aConfigured) return bConfigured - aConfigured;
    if (intakeReady) {
      const aScore = displayMetaById.get(a.id)?.relevanceScore1to10 ?? 0;
      const bScore = displayMetaById.get(b.id)?.relevanceScore1to10 ?? 0;
      if (bScore !== aScore) return bScore - aScore;
    }
    return (a.name || '').localeCompare(b.name || '');
  });
}

export default function SourceWorkflowPage() {
  const { state, dispatch } = useApp();
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const [openedSourceId, setOpenedSourceId] = useState(null);
  const [panelAnchorRect, setPanelAnchorRect] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [overlapPrompt, setOverlapPrompt] = useState(null);
  const [overlapResolvedOnce, setOverlapResolvedOnce] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const didResetCategoryTab = useRef(false);

  const useCases = useMemo(() => resolveUseCaseProfiles(state.intake).profiles, [state.intake]);
  const intake = state.intake;
  const intakeReady = useMemo(() => isIntakeReadyForSourceRelevance(intake), [intake]);

  const prioritizedCatalog = useMemo(
    () =>
      classifyAndSortSources(
        flatCatalog,
        useCases,
        intake.desiredApps,
        flatCatalog,
        state.sources,
        state.overlapDecisions,
        OVERLAP_GROUPS,
        intake,
      ),
    [useCases, intake, state.sources, state.overlapDecisions],
  );

  const displayMetaById = useMemo(() => {
    const map = new Map();
    const metaOpts = {
      intake,
      desiredApps: intake.desiredApps,
      recommendedApps: intake.recommendedApps,
    };
    for (const s of prioritizedCatalog) {
      map.set(s.id, getSourceWorkflowDisplayMeta(s, metaOpts));
    }
    return map;
  }, [prioritizedCatalog, intake]);

  const customSources = useMemo(() => listCustomSourcesFromSession(state.sources), [state.sources]);

  const sortedCategories = useMemo(() => {
    const base = intakeReady
      ? (() => {
          const ranked = rankCategoriesByRelevance(prioritizedCatalog);
          const rankedSet = new Set(ranked);
          const remainder = categories.filter((c) => !rankedSet.has(c));
          return [...ranked, ...remainder];
        })()
      : [...categories];
    return base.includes(CUSTOM_SOURCE_CATEGORY) ? base : [...base, CUSTOM_SOURCE_CATEGORY];
  }, [prioritizedCatalog, intakeReady]);

  useEffect(() => {
    if (!intakeReady && statusFilter === 'high_priority') {
      setStatusFilter('all');
    }
  }, [intakeReady, statusFilter]);

  useEffect(() => {
    if (!didResetCategoryTab.current && sortedCategories.length > 0) {
      setActiveCategory(sortedCategories[0]);
      didResetCategoryTab.current = true;
    }
  }, [sortedCategories]);

  useEffect(() => {
    if (!sortedCategories.includes(activeCategory)) {
      setActiveCategory(sortedCategories[0] || categories[0]);
    }
  }, [sortedCategories, activeCategory]);

  const allSources = useMemo(
    () => [
      ...flatCatalog.map((s) => ({ ...s, isCustom: false })),
      ...customSources,
    ],
    [customSources],
  );

  const filteredSources = useMemo(() => {
    let sources = allSources;
    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      const catalogOnly = sources.filter((s) => !s.isCustom);
      const customOnly = sources.filter((s) => s.isCustom);
      const matchedCatalog = searchSourceCatalog(catalogOnly, q);
      const matchedCustom = customOnly.filter((s) => {
        const blob = [s.name, s.category, s.description, s.vendor].filter(Boolean).join(' ').toLowerCase();
        return blob.includes(q.toLowerCase());
      });
      sources = [...matchedCatalog, ...matchedCustom];
    } else {
      sources = sources.filter((s) => s.category === activeCategory);
    }

    const catalogOnly = sources.filter((s) => !s.isCustom);
    const customOnly = sources.filter((s) => s.isCustom);
    let classified = classifyAndSortSources(
      catalogOnly,
      useCases,
      intake.desiredApps,
      flatCatalog,
      state.sources,
      state.overlapDecisions,
      OVERLAP_GROUPS,
      intake,
    );
    if (customOnly.length) {
      classified = [
        ...customOnly.map((s) => ({
          ...s,
          relevance: {
            label: 'optional',
            classification: 'optional',
            priorityScore: 0,
            reason: 'Custom user-defined source',
          },
        })),
        ...classified,
      ];
    }

    if (statusFilter === 'high_priority') {
      classified = classified.filter(
        (s) => (displayMetaById.get(s.id)?.relevanceScore1to10 ?? 0) >= 7,
      );
    } else if (statusFilter === 'current') {
      classified = classified.filter((s) => state.sources[s.id]?.status === 'current');
    } else if (statusFilter === 'unknown') {
      classified = classified.filter((s) => (state.sources[s.id]?.status || 'unknown') === 'unknown');
    } else if (statusFilter !== 'all') {
      classified = classified.filter((s) => (state.sources[s.id]?.status || 'unknown') === statusFilter);
    }

    return sortSourcesForGrid(classified, state.sources, displayMetaById, intakeReady);
  }, [allSources, searchQuery, activeCategory, statusFilter, state.sources, useCases, intake, state.overlapDecisions, displayMetaById, intakeReady]);

  const openedSource = useMemo(() => {
    if (!openedSourceId) return null;
    if (openedSourceId.startsWith('custom_')) {
      const ss = state.sources[openedSourceId] || {};
      return customSourceCatalogEntry(openedSourceId, ss);
    }
    const base = prioritizedCatalog.find((s) => s.id === openedSourceId) || flatCatalog.find((s) => s.id === openedSourceId);
    if (!base) return null;
    return base;
  }, [openedSourceId, prioritizedCatalog, state.sources]);

  const openedIsCustom = !!(openedSourceId && openedSourceId.startsWith('custom_'));

  const jumpToSource = useCallback((sourceId, category) => {
    if (category) setActiveCategory(category);
    setSearchQuery('');
    setOpenedSourceId(sourceId);
    setPanelAnchorRect(null);
  }, []);

  const toggleSourcePanel = useCallback((sourceId, event) => {
    if (openedSourceId === sourceId) {
      setOpenedSourceId(null);
      setPanelAnchorRect(null);
      return;
    }
    const rect = event?.currentTarget?.getBoundingClientRect?.() ?? null;
    setPanelAnchorRect(rect);
    setOpenedSourceId(sourceId);
  }, [openedSourceId]);

  useEffect(() => {
    const pending = state.pendingSourceNavigation;
    if (!pending?.sourceId) return;
    jumpToSource(pending.sourceId, pending.category);
    dispatch({ type: 'CLEAR_PENDING_SOURCE_NAV' });
  }, [state.pendingSourceNavigation, dispatch, jumpToSource]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sourceId = params.get('source');
    if (!sourceId) return;
    const src = allSources.find((s) => s.id === sourceId);
    if (src) jumpToSource(sourceId, src.category);
    params.delete('source');
    const qs = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, [allSources, jumpToSource]);

  const updateSource = useCallback(
    (id, data) => dispatch({ type: 'UPDATE_SOURCE', payload: { sourceId: id, data } }),
    [dispatch],
  );

  const handleModalSave = useCallback(
    (payload) => {
      if (!openedSourceId) return;
      updateSource(openedSourceId, payload);
      const prompts = getOverlapPromptForSource(openedSourceId, {
        ...state.sources,
        [openedSourceId]: { ...state.sources[openedSourceId], ...payload },
      });
      const unres = prompts.filter((p) => !state.overlapDecisions[p.pairKey]);
      if (unres.length) setOverlapPrompt({ sourceId: openedSourceId, prompts: unres });
      setOpenedSourceId(null);
      setPanelAnchorRect(null);
    },
    [openedSourceId, updateSource, state.sources, state.overlapDecisions],
  );

  const handleModalReset = useCallback(
    (payload) => {
      if (!openedSourceId) return;
      updateSource(openedSourceId, payload);
    },
    [openedSourceId, updateSource],
  );

  const resolveOverlap = (pairKey, option) => {
    dispatch({ type: 'SET_OVERLAP_DECISION', payload: { pairKey, decision: { selectedOption: option, resolvedAt: new Date().toISOString() } } });
    setOverlapResolvedOnce(true);
    if (overlapPrompt) {
      const rest = overlapPrompt.prompts.filter((p) => p.pairKey !== pairKey);
      setOverlapPrompt(rest.length ? { ...overlapPrompt, prompts: rest } : null);
    }
  };

  const handleCreateCustom = useCallback(
    (form) => {
      const id = createCustomSourceId();
      const data = defaultCustomSourceState(form);
      dispatch({ type: 'UPDATE_SOURCE', payload: { sourceId: id, data } });
      setActiveCategory(CUSTOM_SOURCE_CATEGORY);
      setOpenedSourceId(id);
      setCustomModalOpen(false);
    },
    [dispatch],
  );

  const handleDeleteCustom = useCallback(
    (sourceId) => {
      dispatch({ type: 'REMOVE_SOURCE', payload: { sourceId } });
      setOpenedSourceId(null);
    },
    [dispatch],
  );

  return (
    <div className="page-viewport">
      <div className="page-header shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h2>Data Sources</h2>
            <WorkflowStepIndicator currentStep={STEP.SOURCES} />
          </div>
          <p className="hidden md:block text-label text-[var(--cast-text-muted)] max-w-md">
            Configure and size sources by relevance to your goals — totals are reviewed before choosing a path.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <PageHeaderActions
            state={state}
            backLabel="Analysis"
            onBack={() => dispatch({ type: 'SET_STEP', payload: STEP.ANALYSIS })}
            continueLabel="Review"
            onContinue={() => dispatch({ type: 'SET_STEP', payload: STEP.REVIEW })}
          />
        </div>
      </div>

      <div className="shrink-0 border-b border-[var(--cast-border)] bg-[var(--cast-panel)] px-4 py-2 sticky top-0 z-20">
        <SourceFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          intakeReady={intakeReady}
        />
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {!searchQuery && (
          <aside className="shrink-0 w-44 sm:w-52 border-r border-[var(--cast-border)] bg-[var(--cast-panel)]/80 overflow-y-auto hidden-scrollbar flex flex-col">
            <nav className="p-2 space-y-0.5 flex-1" aria-label="Source categories">
              {sortedCategories.map((cat) => {
                const n = categoryConfiguredCount(cat, state.sources);
                const active = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-label leading-snug transition-colors ${active ? 'bg-[var(--cast-accent)] text-white font-medium' : 'text-[var(--cast-text-secondary)] hover:bg-[var(--cast-panel-alt)] hover:text-[var(--cast-text)]'}`}
                  >
                    <span className="line-clamp-2">{cat}</span>
                    {n > 0 && (
                      <span className={`block text-tiny mt-0.5 ${active ? 'text-white/80' : 'text-[var(--cast-text-muted)]'}`}>
                        {n} configured
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            {activeCategory === CUSTOM_SOURCE_CATEGORY && (
              <div className="p-2 border-t border-[var(--cast-border)]/80">
                <button type="button" className="btn-primary w-full text-badge !py-1.5" onClick={() => setCustomModalOpen(true)}>
                  + Custom source
                </button>
              </div>
            )}
          </aside>
        )}

        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto hidden-scrollbar p-4 relative source-grid-region">
          {openedSource && !openedIsCustom && (
            <>
              <button
                type="button"
                className="absolute inset-0 z-30 bg-[var(--cast-bg)]/55 backdrop-blur-[2px] cursor-default rounded-lg"
                aria-label="Close configuration panel"
                onClick={() => {
                  setOpenedSourceId(null);
                  setPanelAnchorRect(null);
                }}
              />
              <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none p-4">
                <SourceConfigPanel
                  key={openedSource.id}
                  source={openedSource}
                  ss={state.sources[openedSource.id] || { status: 'unknown' }}
                  displayMeta={displayMetaById.get(openedSource.id)}
                  showRelevance={intakeReady}
                  useCases={useCases}
                  sessionSources={state.sources}
                  anchorRect={panelAnchorRect}
                  onClose={() => {
                    setOpenedSourceId(null);
                    setPanelAnchorRect(null);
                  }}
                  onSave={handleModalSave}
                  onReset={handleModalReset}
                />
              </div>
            </>
          )}

          {overlapPrompt && (
            <div className={`${overlapResolvedOnce ? 'rounded-lg border border-[var(--cast-warning)]/30 bg-[var(--cast-warning)]/5' : 'card border-[var(--cast-warning)]/30 bg-[var(--cast-warning)]/5'} space-y-2 mb-3 p-3`}>
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-[var(--cast-warning)]" />
                <h4 className="text-label font-semibold text-[var(--cast-warning)]">
                  {overlapResolvedOnce ? 'Overlap — choose primary source' : 'Overlap check'}
                </h4>
              </div>
              {overlapPrompt.prompts.map((prompt) => (
                <div key={prompt.pairKey} className="space-y-1.5">
                  <p className="text-label text-[var(--cast-text-secondary)]">{prompt.question}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {prompt.options.map((opt) => (
                      <button key={opt.id} type="button" onClick={() => resolveOverlap(prompt.pairKey, opt)} className="btn-secondary !text-badge !py-1 !px-2">
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searchQuery && activeCategory === CUSTOM_SOURCE_CATEGORY && customSources.length === 0 && (
            <div className="card-compact text-center py-8 mb-4">
              <p className="text-label text-[var(--cast-text-muted)] mb-3">No custom sources yet. Add feeds that are not in the catalog.</p>
              <button type="button" className="btn-primary" onClick={() => setCustomModalOpen(true)}>Create custom source</button>
            </div>
          )}

          <div className="grid gap-3 items-stretch" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {filteredSources.length > 0 ? (
              filteredSources.map((source) => {
                const ss = state.sources[source.id] || { status: 'unknown' };
                const meta = displayMetaById.get(source.id) || {
                  relevanceScore1to10: 1,
                  appLabels: [],
                };
                return (
                  <SourceGridCard
                    key={source.id}
                    source={source}
                    ss={ss}
                    isOpen={openedSourceId === source.id}
                    showRelevance={intakeReady}
                    relevanceScore1to10={meta.relevanceScore1to10}
                    appLabels={meta.appLabels}
                    onToggle={toggleSourcePanel}
                  />
                );
              })
            ) : (
              <div className="col-span-full card-compact text-center py-6">
                <p className="text-[var(--cast-text-muted)] text-label">{searchQuery ? 'No sources match your search.' : 'No sources in this category.'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <CustomSourceModal open={customModalOpen} onClose={() => setCustomModalOpen(false)} onCreate={handleCreateCustom} />

      {openedSource && openedIsCustom && (
        <CustomConfigDrawer
          source={openedSource}
          ss={state.sources[openedSource.id] || {}}
          onClose={() => {
            setOpenedSourceId(null);
            setPanelAnchorRect(null);
          }}
          update={updateSource}
          onStatus={(id, status) => updateSource(id, { status })}
          onDelete={handleDeleteCustom}
        />
      )}
    </div>
  );
}
