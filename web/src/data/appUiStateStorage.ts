import {
  ADDITIONALITY_SHAPLEY_SAMPLE_COUNTS,
  DEFAULT_ADDITIONALITY_METHOD,
  DEFAULT_ADDITIONALITY_SHAPLEY_SAMPLE_COUNT,
  type AdditionalityOrderingMethod,
} from '../additionality/additionalityAnalysis.ts';
import type { StorageLike } from './configurationDraftStorage.ts';
import {
  DEFAULT_APP_UI_STATE,
  LEFT_SIDEBAR_SECTION_KEYS,
  METHODS_TABS,
  type AdditionalityCommoditySelectionState,
  type AppUiState,
  type LeftSidebarSectionState,
  type LibraryFilters,
  type MethodsTab,
  type WorkspaceComparisonBaseSelectionMode,
} from './appUiState.ts';
import { PRICE_LEVELS, type PriceLevel } from './types.ts';

export const APP_UI_STATE_STORAGE_KEY = 'simple-msm.app-ui-state.v1';

function cloneDefaultAppUiState(): AppUiState {
  return structuredClone(DEFAULT_APP_UI_STATE);
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function resolveStorage(storage: StorageLike | null | undefined): StorageLike | null {
  if (storage !== undefined) {
    return storage;
  }

  return getBrowserStorage();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function readNullableString(value: unknown, fallback: string | null): string | null {
  if (value === null) {
    return null;
  }

  return typeof value === 'string' ? value : fallback;
}

function readStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readNullableNumber(value: unknown, fallback: number | null): number | null {
  if (value === null) {
    return null;
  }

  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readAdditionalityOrderingMethod(value: unknown): AdditionalityOrderingMethod {
  return value === 'shapley_permutation_sample'
    ? 'shapley_permutation_sample'
    : DEFAULT_ADDITIONALITY_METHOD;
}

function readAdditionalityShapleySampleCount(value: unknown): number {
  return typeof value === 'number'
    && ADDITIONALITY_SHAPLEY_SAMPLE_COUNTS.includes(value as (typeof ADDITIONALITY_SHAPLEY_SAMPLE_COUNTS)[number])
    ? value
    : DEFAULT_ADDITIONALITY_SHAPLEY_SAMPLE_COUNT;
}

function isMethodsTab(value: unknown): value is MethodsTab {
  return typeof value === 'string' && METHODS_TABS.includes(value as MethodsTab);
}

function isPriceLevel(value: unknown): value is PriceLevel {
  return typeof value === 'string' && PRICE_LEVELS.includes(value as PriceLevel);
}

function isWorkspaceComparisonBaseSelectionMode(
  value: unknown,
): value is WorkspaceComparisonBaseSelectionMode {
  return value === 'auto' || value === 'manual' || value === 'none';
}

function sanitizeWorkspaceExpandedSections(value: unknown): LeftSidebarSectionState {
  const fallback = DEFAULT_APP_UI_STATE.workspace.expandedSections;
  const nextState = structuredClone(fallback);

  if (!isRecord(value)) {
    return nextState;
  }

  for (const section of LEFT_SIDEBAR_SECTION_KEYS) {
    nextState[section] = readBoolean(value[section], fallback[section]);
  }

  return nextState;
}

function sanitizeWorkspaceComparisonState(
  value: unknown,
): AppUiState['workspace']['comparison'] {
  const fallback = DEFAULT_APP_UI_STATE.workspace.comparison;

  if (!isRecord(value)) {
    return structuredClone(fallback);
  }

  return {
    baseSelectionMode: isWorkspaceComparisonBaseSelectionMode(value.baseSelectionMode)
      ? value.baseSelectionMode
      : fallback.baseSelectionMode,
    selectedBaseConfigId: readNullableString(
      value.selectedBaseConfigId,
      fallback.selectedBaseConfigId,
    ),
    fuelSwitchBasis: value.fuelSwitchBasis === 'from' ? 'from' : fallback.fuelSwitchBasis,
    selectedFuelSwitchYear: readNullableNumber(
      value.selectedFuelSwitchYear,
      fallback.selectedFuelSwitchYear,
    ),
  };
}

function sanitizeLibraryFilters(value: unknown): LibraryFilters {
  const fallback = DEFAULT_APP_UI_STATE.library.filters;

  if (!isRecord(value)) {
    return structuredClone(fallback);
  }

  return {
    search: readString(value.search, fallback.search),
    confidence: readString(value.confidence, fallback.confidence),
    region: readString(value.region, fallback.region),
    sourceId: readString(value.sourceId, fallback.sourceId),
    assumptionId: readString(value.assumptionId, fallback.assumptionId),
    efficiencyApplicability: readString(
      value.efficiencyApplicability,
      fallback.efficiencyApplicability,
    ),
    efficiencyArtifactType: readString(
      value.efficiencyArtifactType,
      fallback.efficiencyArtifactType,
    ),
  };
}

function sanitizeAdditionalityCommoditySelectionState(
  value: unknown,
): AdditionalityCommoditySelectionState {
  const fallback = DEFAULT_APP_UI_STATE.additionality.commoditySelectionState;

  if (!isRecord(value)) {
    return structuredClone(fallback);
  }

  const selectionEntries = isRecord(value.selections)
    ? Object.entries(value.selections)
      .filter((entry): entry is [string, PriceLevel] => isPriceLevel(entry[1]))
    : [];

  return {
    seededFromConfigId: readNullableString(value.seededFromConfigId, fallback.seededFromConfigId),
    selections: Object.fromEntries(selectionEntries),
  };
}

function sanitizeParsedAppUiState(value: unknown): AppUiState {
  const fallback = cloneDefaultAppUiState();

  if (!isRecord(value)) {
    return fallback;
  }

  const workspace = isRecord(value.workspace) ? value.workspace : {};
  const library = isRecord(value.library) ? value.library : {};
  const methods = isRecord(value.methods) ? value.methods : {};
  const additionality = isRecord(value.additionality) ? value.additionality : {};

  return {
    workspace: {
      leftCollapsed: readBoolean(
        workspace.leftCollapsed,
        fallback.workspace.leftCollapsed,
      ),
      rightCollapsed: readBoolean(
        workspace.rightCollapsed,
        fallback.workspace.rightCollapsed,
      ),
      expandedSections: sanitizeWorkspaceExpandedSections(workspace.expandedSections),
      comparison: sanitizeWorkspaceComparisonState(workspace.comparison),
    },
    library: {
      sidebarCollapsed: readBoolean(
        library.sidebarCollapsed,
        fallback.library.sidebarCollapsed,
      ),
      filters: sanitizeLibraryFilters(library.filters),
      selectedSector: readString(library.selectedSector, fallback.library.selectedSector),
      selectedSubsector: readString(
        library.selectedSubsector,
        fallback.library.selectedSubsector,
      ),
      selectedTrajectoryId: readNullableString(
        library.selectedTrajectoryId,
        fallback.library.selectedTrajectoryId,
      ),
    },
    methods: {
      activeTab: isMethodsTab(methods.activeTab)
        ? methods.activeTab
        : fallback.methods.activeTab,
      evidenceSearch: readString(
        methods.evidenceSearch,
        fallback.methods.evidenceSearch,
      ),
      evidenceSector: readString(
        methods.evidenceSector,
        fallback.methods.evidenceSector,
      ),
      evidenceConfidence: readString(
        methods.evidenceConfidence,
        fallback.methods.evidenceConfidence,
      ),
    },
    additionality: {
      selectedBaseConfigId: readNullableString(
        additionality.selectedBaseConfigId,
        fallback.additionality.selectedBaseConfigId,
      ),
      selectedFocusConfigId: readNullableString(
        additionality.selectedFocusConfigId ?? additionality.selectedTargetConfigId,
        fallback.additionality.selectedFocusConfigId,
      ),
      selectedFocusConfigIds: readStringArray(
        additionality.selectedFocusConfigIds,
        readNullableString(
          additionality.selectedFocusConfigId ?? additionality.selectedTargetConfigId,
          fallback.additionality.selectedFocusConfigId,
        )
          ? [readNullableString(
            additionality.selectedFocusConfigId ?? additionality.selectedTargetConfigId,
            fallback.additionality.selectedFocusConfigId,
          ) as string]
          : fallback.additionality.selectedFocusConfigIds,
      ).slice(0, 3),
      orderingMethod: readAdditionalityOrderingMethod(additionality.orderingMethod),
      shapleySampleCount: readAdditionalityShapleySampleCount(additionality.shapleySampleCount),
      commoditySelectionState: sanitizeAdditionalityCommoditySelectionState(
        additionality.commoditySelectionState,
      ),
    },
  };
}

export function loadPersistedAppUiState(storage?: StorageLike | null): AppUiState {
  const resolvedStorage = resolveStorage(storage);

  if (!resolvedStorage) {
    return cloneDefaultAppUiState();
  }

  let raw: string | null;

  try {
    raw = resolvedStorage.getItem(APP_UI_STATE_STORAGE_KEY);
  } catch {
    return cloneDefaultAppUiState();
  }

  if (!raw) {
    return cloneDefaultAppUiState();
  }

  try {
    return sanitizeParsedAppUiState(JSON.parse(raw));
  } catch {
    return cloneDefaultAppUiState();
  }
}

export function persistAppUiState(
  state: AppUiState,
  storage?: StorageLike | null,
): void {
  const resolvedStorage = resolveStorage(storage);

  if (!resolvedStorage) {
    return;
  }

  try {
    resolvedStorage.setItem(
      APP_UI_STATE_STORAGE_KEY,
      JSON.stringify(sanitizeParsedAppUiState(state)),
    );
  } catch {
    // Best-effort persistence only.
  }
}
