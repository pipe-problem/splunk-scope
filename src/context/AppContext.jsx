import { createContext, useContext, useReducer, useEffect } from 'react';
import { migrateSession, isValidSessionState, CURRENT_SCHEMA_VERSION } from '../services/sessionMigrationEngine.js';
import { applyIntakeDefaults, DEFAULT_PATH_BUDGET_PERCENTAGES } from '../config/intakeDefaults.js';

const AppContext = createContext(null);

const STORAGE_KEY = 'splunk-scope-session';

const initialState = {
  currentStep: 0,
  theme: 'dark',
  intake: applyIntakeDefaults({
    customerName: '',
    deploymentType: 'cloud',
    desiredApps: [],
    useCases: [],
    customUseCases: '',
    crawlGoal: '',
    walkGoal: '',
    runGoal: '',
    crawlGoalPresetId: 'crawl_foundational_visibility',
    walkGoalPresetId: 'walk_expand_correlation',
    runGoalPresetId: 'run_optimize_and_mature',
    sourceHints: [],
    aiImportSummary: null,
    discoveryNotes: '',
    importedContext: null,
    opportunityBudgetUsd: '',
    pathBudgetPercentages: { ...DEFAULT_PATH_BUDGET_PERCENTAGES },
    budgetGbDayOverride: null,
    recommendedApps: [],
  }),
  interpretation: null,
  interpretationIntakeKey: null,
  sources: {},
  plans: null,
  selectedPlanIndex: null,
  reportPathExplicit: false,
  suppressPathRecommendation: false,
  sessionId: crypto.randomUUID(),
  lastSaved: null,
  scenarios: [],
  activeScenarioId: null,
  activeTemplateId: null,
  bufferPercent: 20,
  overlapDecisions: {},
  showAllDomains: false,
  reviewAcknowledgedSourceIds: {},
  pendingSourceNavigation: null,
  schemaVersion: CURRENT_SCHEMA_VERSION,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' };
    case 'UPDATE_INTAKE':
      return { ...state, intake: { ...state.intake, ...action.payload } };
    case 'SET_INTERPRETATION':
      return {
        ...state,
        interpretation: action.payload,
        interpretationIntakeKey: action.intakeKey ?? state.interpretationIntakeKey,
      };
    case 'UPDATE_SOURCE': {
      const { sourceId, data } = action.payload;
      return {
        ...state,
        sources: {
          ...state.sources,
          [sourceId]: { ...state.sources[sourceId], ...data },
        },
      };
    }
    case 'APPLY_IMPORTED_SOURCES': {
      const patches = action.payload || {};
      const nextSources = { ...state.sources };
      for (const [sourceId, data] of Object.entries(patches)) {
        if (!sourceId || !data) continue;
        nextSources[sourceId] = { ...nextSources[sourceId], ...data };
      }
      return { ...state, sources: nextSources };
    }
    case 'REMOVE_SOURCE': {
      const { sourceId } = action.payload;
      if (!sourceId) return state;
      const next = { ...state.sources };
      delete next[sourceId];
      return { ...state, sources: next };
    }
    case 'SET_PLANS':
      return { ...state, plans: action.payload };
    case 'SELECT_PLAN':
      return { ...state, selectedPlanIndex: action.payload, reportPathExplicit: true };
    case 'LOAD_SESSION': {
      const { state: migrated, error } = migrateSession(action.payload);
      if (error || !migrated) {
        console.warn('[LOAD_SESSION] Migration failed:', error);
        return state;
      }
      return {
        ...initialState,
        ...migrated,
        intake: { ...initialState.intake, ...(migrated.intake || {}) },
        overlapDecisions: migrated.overlapDecisions || {},
        bufferPercent: migrated.bufferPercent ?? 20,
        theme: migrated.theme || state.theme,
        selectedPlanIndex: migrated.selectedPlanIndex ?? null,
        reportPathExplicit: migrated.reportPathExplicit ?? migrated.selectedPlanIndex != null,
        suppressPathRecommendation: migrated.suppressPathRecommendation ?? false,
        showAllDomains: migrated.showAllDomains ?? false,
        reviewAcknowledgedSourceIds: migrated.reviewAcknowledgedSourceIds || {},
        pendingSourceNavigation: migrated.pendingSourceNavigation ?? null,
        sources: migrated.sources || {},
        scenarios: migrated.scenarios || [],
        lastSaved: new Date().toISOString(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
      };
    }
    case 'RESET_SESSION':
      return { ...initialState, theme: state.theme, sessionId: crypto.randomUUID() };
    case 'APPLY_TEMPLATE': {
      const template = action.payload;
      return {
        ...state,
        intake: { ...state.intake, ...template.intake },
        activeTemplateId: template.id,
      };
    }
    case 'CLEAR_TEMPLATE':
      return {
        ...state,
        intake: { ...initialState.intake, customerName: state.intake.customerName },
        sources: {},
        interpretation: null,
        interpretationIntakeKey: null,
        activeTemplateId: null,
      };
    case 'APPLY_EXAMPLE': {
      const {
        intake,
        sources,
        selectedPlanIndex,
        exampleId,
        overlapDecisions,
        suppressPathRecommendation,
      } = action.payload;
      return {
        ...state,
        intake: { ...initialState.intake, ...intake },
        sources: { ...sources },
        selectedPlanIndex: selectedPlanIndex ?? null,
        reportPathExplicit: false,
        suppressPathRecommendation: suppressPathRecommendation ?? false,
        plans: null,
        interpretation: null,
        interpretationIntakeKey: null,
        activeTemplateId: exampleId || '__example__',
        activeScenarioId: null,
        overlapDecisions: overlapDecisions ? { ...overlapDecisions } : {},
        reviewAcknowledgedSourceIds: {},
        pendingSourceNavigation: null,
      };
    }
    case 'CLEAR_EXAMPLE':
      return {
        ...state,
        intake: { ...initialState.intake },
        sources: {},
        interpretation: null,
        interpretationIntakeKey: null,
        activeTemplateId: null,
        selectedPlanIndex: null,
        reportPathExplicit: false,
        suppressPathRecommendation: false,
        overlapDecisions: {},
      };
    case 'SAVE_SCENARIO': {
      const scenario = {
        id: crypto.randomUUID(),
        name: action.payload.name,
        savedAt: new Date().toISOString(),
        intake: { ...state.intake },
        sources: { ...state.sources },
        plans: state.plans,
      };
      return { ...state, scenarios: [...state.scenarios, scenario] };
    }
    case 'LOAD_SCENARIO': {
      const sc = state.scenarios.find((s) => s.id === action.payload);
      if (!sc) return state;
      return {
        ...state,
        intake: { ...state.intake, ...sc.intake },
        sources: { ...sc.sources },
        plans: sc.plans,
        activeScenarioId: sc.id,
      };
    }
    case 'DELETE_SCENARIO':
      return { ...state, scenarios: state.scenarios.filter((s) => s.id !== action.payload) };
    case 'SET_BUFFER':
      // Deprecated: fixed 20% planning buffer — ignore UI/session updates (backward-compatible load only)
      return state;
    case 'SET_OVERLAP_DECISION': {
      const { pairKey, decision } = action.payload;
      return {
        ...state,
        overlapDecisions: { ...state.overlapDecisions, [pairKey]: decision },
      };
    }
    case 'TOGGLE_SHOW_ALL_DOMAINS':
      return { ...state, showAllDomains: !state.showAllDomains };
    case 'CLEAR_SOURCES_FOR_TEMPLATE':
      return {
        ...state,
        sources: {},
        interpretation: null,
        interpretationIntakeKey: null,
      };
    case 'SET_IMPORTED_CONTEXT':
      return {
        ...state,
        intake: { ...state.intake, importedContext: action.payload },
      };
    case 'ACKNOWLEDGE_SOURCE_REVIEW': {
      const sourceId = action.payload?.sourceId;
      if (!sourceId) return state;
      return {
        ...state,
        reviewAcknowledgedSourceIds: {
          ...state.reviewAcknowledgedSourceIds,
          [sourceId]: true,
        },
      };
    }
    case 'OPEN_SOURCE_FOR_CONFIG': {
      const { sourceId, category } = action.payload || {};
      if (!sourceId) return state;
      return {
        ...state,
        currentStep: 3,
        pendingSourceNavigation: { sourceId, category: category || null },
      };
    }
    case 'CLEAR_PENDING_SOURCE_NAV':
      return { ...state, pendingSourceNavigation: null };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState, (init) => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const { state: migrated, migrated: didMigrate, fromVersion, error } = migrateSession(parsed);

        if (error || !migrated || !isValidSessionState(migrated)) {
          console.warn('[SessionMigration]', error || 'Invalid session state — resetting.');
          return init;
        }

        if (didMigrate) {
          console.info(`[SessionMigration] Migrated session from v${fromVersion ?? 0} to v${CURRENT_SCHEMA_VERSION}`);
        }

        return {
          ...init,
          ...migrated,
          intake: { ...init.intake, ...(migrated.intake || {}) },
          overlapDecisions: migrated.overlapDecisions || {},
          bufferPercent: migrated.bufferPercent ?? 20,
          theme: migrated.theme || 'dark',
          selectedPlanIndex: migrated.selectedPlanIndex ?? null,
          reportPathExplicit: migrated.reportPathExplicit ?? migrated.selectedPlanIndex != null,
          suppressPathRecommendation: migrated.suppressPathRecommendation ?? false,
          showAllDomains: migrated.showAllDomains ?? false,
          schemaVersion: CURRENT_SCHEMA_VERSION,
        };
      }
    } catch {
      console.warn('[SessionMigration] Failed to parse localStorage — starting fresh.');
    }
    return init;
  });

  useEffect(() => {
    const toSave = { ...state, lastSaved: new Date().toISOString(), schemaVersion: CURRENT_SCHEMA_VERSION };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [state]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
