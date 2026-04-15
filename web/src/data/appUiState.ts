import type { PriceLevel } from './types.ts';

export const METHODS_TABS = ['about', 'conventions', 'confidence', 'phase2', 'evidence'] as const;
export type MethodsTab = (typeof METHODS_TABS)[number];

export interface LibraryFilters {
  search: string;
  confidence: string;
  region: string;
  sourceId: string;
  assumptionId: string;
}

export const LEFT_SIDEBAR_SECTION_KEYS = [
  'options',
  'demandGrowth',
  'commodityControls',
  'emissionsPrice',
  'overlays',
  'configurations',
] as const;
export type LeftSidebarSectionKey = (typeof LEFT_SIDEBAR_SECTION_KEYS)[number];
export type LeftSidebarSectionState = Record<LeftSidebarSectionKey, boolean>;

export interface AdditionalityCommoditySelectionState {
  seededFromConfigId: string | null;
  selections: Record<string, PriceLevel>;
}

export interface WorkspaceUiState {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  expandedSections: LeftSidebarSectionState;
}

export interface LibraryUiState {
  sidebarCollapsed: boolean;
  filters: LibraryFilters;
  selectedSector: string;
  selectedSubsector: string;
  selectedTrajectoryId: string | null;
}

export interface MethodsUiState {
  activeTab: MethodsTab;
  evidenceSearch: string;
  evidenceSector: string;
  evidenceConfidence: string;
}

export interface AdditionalityUiState {
  selectedBaseConfigId: string | null;
  selectedTargetConfigId: string | null;
  commoditySelectionState: AdditionalityCommoditySelectionState;
}

export interface AppUiState {
  workspace: WorkspaceUiState;
  library: LibraryUiState;
  methods: MethodsUiState;
  additionality: AdditionalityUiState;
}

export const DEFAULT_APP_UI_STATE: AppUiState = {
  workspace: {
    leftCollapsed: false,
    rightCollapsed: false,
    expandedSections: {
      options: false,
      demandGrowth: false,
      commodityControls: false,
      emissionsPrice: true,
      overlays: false,
      configurations: true,
    },
  },
  library: {
    sidebarCollapsed: false,
    filters: {
      search: '',
      confidence: '',
      region: '',
      sourceId: '',
      assumptionId: '',
    },
    selectedSector: '',
    selectedSubsector: '',
    selectedTrajectoryId: null,
  },
  methods: {
    activeTab: 'about',
    evidenceSearch: '',
    evidenceSector: '',
    evidenceConfidence: '',
  },
  additionality: {
    selectedBaseConfigId: null,
    selectedTargetConfigId: null,
    commoditySelectionState: {
      seededFromConfigId: null,
      selections: {},
    },
  },
};
