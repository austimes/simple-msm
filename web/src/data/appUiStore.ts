import { create } from 'zustand';
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

interface AppUiStore extends AppUiState {
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
  resetAllUiState: () => void;
}

function cloneDefaultAppUiState(): AppUiState {
  return structuredClone(DEFAULT_APP_UI_STATE);
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

  function commit(nextState: Partial<AppUiStore>): void {
    const mergedState = { ...get(), ...nextState };
    persistAppUiState(pickPersistedAppUiState(mergedState));
    set(nextState);
  }

  return {
    ...initialState,
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
    resetAllUiState: () => {
      commit(cloneDefaultAppUiState());
    },
  };
});
