import { create } from 'zustand';
import type { AdditionalityAnalysisState } from '../additionality/additionalityAnalysis.ts';
import {
  DEFAULT_APP_UI_STATE,
  type AdditionalityUiState,
  type AppUiState,
  type LeftSidebarSectionKey,
  type LibraryFilters,
  type LibraryUiState,
  type MethodsUiState,
  type WorkspaceUiState,
} from './appUiState.ts';
import {
  loadPersistedAppUiState,
  persistAppUiState,
} from './appUiStateStorage.ts';
import type { PriceLevel } from './types.ts';

export interface AdditionalityRuntimeEntry {
  inFlight: boolean;
  runToken: number | null;
  state: AdditionalityAnalysisState;
}

export interface AdditionalityRuntimeState {
  activeRunKey: string | null;
  entriesByKey: Record<string, AdditionalityRuntimeEntry>;
  nextRunToken: number;
}

interface AppUiStore extends AppUiState {
  additionalityRuntime: AdditionalityRuntimeState;
  updateWorkspaceUi: (updates: Partial<WorkspaceUiState>) => void;
  setWorkspaceSectionExpanded: (
    section: LeftSidebarSectionKey,
    expanded: boolean,
  ) => void;
  updateLibraryUi: (updates: Partial<LibraryUiState>) => void;
  setLibraryFilters: (updates: Partial<LibraryFilters>) => void;
  resetLibraryUi: () => void;
  updateMethodsUi: (updates: Partial<MethodsUiState>) => void;
  updateAdditionalityUi: (updates: Partial<AdditionalityUiState>) => void;
  setAdditionalityCommodityLevel: (
    commodityId: string,
    level: PriceLevel,
    seededFromConfigId: string | null,
  ) => void;
  beginAdditionalityRun: (
    key: string,
    initialState: AdditionalityAnalysisState,
  ) => number;
  updateAdditionalityRunProgress: (
    key: string,
    runToken: number,
    progress: AdditionalityAnalysisState['progress'],
  ) => void;
  finishAdditionalityRun: (
    key: string,
    runToken: number,
    nextState: AdditionalityAnalysisState,
  ) => void;
  clearAdditionalityRuntime: () => void;
  resetAllUiState: () => void;
}

function cloneDefaultAppUiState(): AppUiState {
  return structuredClone(DEFAULT_APP_UI_STATE);
}

function createDefaultAdditionalityRuntimeState(): AdditionalityRuntimeState {
  return {
    activeRunKey: null,
    entriesByKey: {},
    nextRunToken: 0,
  };
}

function pickPersistedAppUiState(state: Pick<AppUiStore, keyof AppUiState>): AppUiState {
  return {
    workspace: state.workspace,
    library: state.library,
    methods: state.methods,
    additionality: state.additionality,
  };
}

export const useAppUiStore = create<AppUiStore>((set, get) => {
  const initialState = loadPersistedAppUiState();
  const initialAdditionalityRuntime = createDefaultAdditionalityRuntimeState();

  function commit(nextState: Partial<AppUiStore>): void {
    const mergedState = { ...get(), ...nextState };
    persistAppUiState(pickPersistedAppUiState(mergedState));
    set(nextState);
  }

  return {
    ...initialState,
    additionalityRuntime: initialAdditionalityRuntime,
    updateWorkspaceUi: (updates) => {
      const current = get().workspace;
      commit({
        workspace: {
          ...current,
          ...updates,
          expandedSections: updates.expandedSections
            ? {
              ...current.expandedSections,
              ...updates.expandedSections,
            }
            : current.expandedSections,
          comparison: updates.comparison
            ? {
              ...current.comparison,
              ...updates.comparison,
            }
            : current.comparison,
          systemFlow: updates.systemFlow
            ? {
              ...current.systemFlow,
              ...updates.systemFlow,
            }
            : current.systemFlow,
        },
      });
    },
    setWorkspaceSectionExpanded: (section, expanded) => {
      const current = get().workspace;
      commit({
        workspace: {
          ...current,
          expandedSections: {
            ...current.expandedSections,
            [section]: expanded,
          },
        },
      });
    },
    updateLibraryUi: (updates) => {
      const current = get().library;
      commit({
        library: {
          ...current,
          ...updates,
          filters: updates.filters
            ? {
              ...current.filters,
              ...updates.filters,
            }
            : current.filters,
        },
      });
    },
    setLibraryFilters: (updates) => {
      const current = get().library;
      commit({
        library: {
          ...current,
          filters: {
            ...current.filters,
            ...updates,
          },
        },
      });
    },
    resetLibraryUi: () => {
      commit({
        library: structuredClone(DEFAULT_APP_UI_STATE.library),
      });
    },
    updateMethodsUi: (updates) => {
      commit({
        methods: {
          ...get().methods,
          ...updates,
        },
      });
    },
    updateAdditionalityUi: (updates) => {
      commit({
        additionality: {
          ...get().additionality,
          ...updates,
        },
      });
    },
    setAdditionalityCommodityLevel: (commodityId, level, seededFromConfigId) => {
      const current = get().additionality;
      commit({
        additionality: {
          ...current,
          commoditySelectionState: {
            seededFromConfigId,
            selections: {
              ...current.commoditySelectionState.selections,
              [commodityId]: level,
            },
          },
        },
      });
    },
    beginAdditionalityRun: (key, initialState) => {
      const currentRuntime = get().additionalityRuntime;
      const nextRunToken = currentRuntime.nextRunToken + 1;

      set({
        additionalityRuntime: {
          activeRunKey: key,
          nextRunToken,
          entriesByKey: {
            ...currentRuntime.entriesByKey,
            [key]: {
              inFlight: true,
              runToken: nextRunToken,
              state: structuredClone(initialState),
            },
          },
        },
      });

      return nextRunToken;
    },
    updateAdditionalityRunProgress: (key, runToken, progress) => {
      const currentRuntime = get().additionalityRuntime;
      const currentEntry = currentRuntime.entriesByKey[key];

      if (!currentEntry || currentEntry.runToken !== runToken || !currentEntry.inFlight) {
        return;
      }

      set({
        additionalityRuntime: {
          ...currentRuntime,
          entriesByKey: {
            ...currentRuntime.entriesByKey,
            [key]: {
              ...currentEntry,
              state: {
                ...currentEntry.state,
                phase: 'loading',
                progress,
                error: null,
                validationIssues: [],
              },
            },
          },
        },
      });
    },
    finishAdditionalityRun: (key, runToken, nextState) => {
      const currentRuntime = get().additionalityRuntime;
      const currentEntry = currentRuntime.entriesByKey[key];

      if (!currentEntry || currentEntry.runToken !== runToken) {
        return;
      }

      set({
        additionalityRuntime: {
          ...currentRuntime,
          activeRunKey: currentRuntime.activeRunKey === key
            ? null
            : currentRuntime.activeRunKey,
          entriesByKey: {
            ...currentRuntime.entriesByKey,
            [key]: {
              inFlight: false,
              runToken,
              state: structuredClone(nextState),
            },
          },
        },
      });
    },
    clearAdditionalityRuntime: () => {
      set({
        additionalityRuntime: createDefaultAdditionalityRuntimeState(),
      });
    },
    resetAllUiState: () => {
      commit({
        ...cloneDefaultAppUiState(),
        additionalityRuntime: createDefaultAdditionalityRuntimeState(),
      });
    },
  };
});
