import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DEFAULT_APP_UI_STATE, type AppUiState } from '../src/data/appUiState.ts';
import {
  APP_UI_STATE_STORAGE_KEY,
  loadPersistedAppUiState,
  persistAppUiState,
} from '../src/data/appUiStateStorage.ts';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

function buildSampleState(): AppUiState {
  return {
    workspace: {
      leftCollapsed: true,
      rightCollapsed: true,
      expandedSections: {
        options: true,
        demandGrowth: false,
        commodityControls: true,
        emissionsPrice: false,
        overlays: true,
        configurations: false,
      },
      comparison: {
        baseSelectionMode: 'saved',
        selectedBaseConfigId: 'reference-baseline',
        fuelSwitchBasis: 'from',
        selectedFuelSwitchYear: 2050,
      },
      systemFlow: {
        selectedYear: 2040,
        viewMode: 'solved',
        collapsedSegmentIds: ['segment:conversion:electricity'],
      },
    },
    library: {
      sidebarCollapsed: true,
      filters: {
        search: 'road',
        confidence: 'Medium',
        region: 'AU',
        sourceId: 'SRC-1',
        assumptionId: 'ASM-2',
        efficiencyApplicability: 'with_applicable_artifacts',
        efficiencyArtifactType: 'pure_efficiency_overlay',
      },
      selectedRoleId: 'deliver_passenger_road_transport',
      selectedRepresentationId: 'deliver_passenger_road_transport__pathway_bundle',
      selectedMethodId: 'road_transport__passenger_road__bev',
      roleGraphExpandedNodeIds: ['role:deliver_passenger_road_transport'],
    },
    methods: {
      activeTab: 'evidence',
      evidenceSearch: 'battery',
      evidenceSector: 'transport',
      evidenceConfidence: 'High',
    },
    additionality: {
      selectedBaseConfigId: 'reference-baseline',
      selectedFocusConfigId: 'reference-efficiency-open',
      selectedFocusConfigIds: [
        'reference-efficiency-open',
        'demo-buildings-efficiency',
      ],
      orderingMethod: 'shapley_permutation_sample',
      shapleySampleCount: 64,
      commoditySelectionState: {
        seededFromConfigId: 'reference-baseline',
        selections: {
          electricity: 'high',
          natural_gas: 'low',
        },
      },
    },
  };
}

describe('appUiStateStorage', () => {
  test('round-trips the persisted UI state for all page slices', () => {
    const storage = createMemoryStorage();
    const state = buildSampleState();

    persistAppUiState(state, storage);

    assert.equal(
      storage.getItem(APP_UI_STATE_STORAGE_KEY),
      JSON.stringify(state),
    );
    assert.deepEqual(loadPersistedAppUiState(storage), state);
  });

  test('falls back to defaults for invalid JSON and unreadable storage', () => {
    const storage = createMemoryStorage();
    storage.setItem(APP_UI_STATE_STORAGE_KEY, '{not valid json');

    assert.deepEqual(loadPersistedAppUiState(storage), DEFAULT_APP_UI_STATE);
    assert.deepEqual(
      loadPersistedAppUiState({
        getItem() {
          throw new Error('storage blocked');
        },
        setItem() {
          throw new Error('storage blocked');
        },
        removeItem() {},
      }),
      DEFAULT_APP_UI_STATE,
    );
  });

  test('sanitizes partial payloads, unknown enum values, and malformed nested objects', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      APP_UI_STATE_STORAGE_KEY,
      JSON.stringify({
        workspace: {
          leftCollapsed: true,
          rightCollapsed: 'no',
          expandedSections: {
            commodityControls: true,
            emissionsPrice: 'false',
            unknown: true,
          },
          comparison: {
            baseSelectionMode: 'unsupported',
            selectedBaseConfigId: 'reference-baseline',
            fuelSwitchBasis: 'sideways',
            selectedFuelSwitchYear: '2050',
          },
          systemFlow: {
            selectedYear: 2030,
            viewMode: 'unsupported',
            collapsedSegmentIds: ['segment:a', 42, 'segment:b'],
          },
        },
        library: {
          filters: {
            search: 'cement',
            confidence: 42,
            region: 'AU',
            sourceId: null,
            efficiencyApplicability: true,
          },
          selectedSector: 'Industry',
          selectedSubsector: ['bad'],
          selectedTrajectoryId: 99,
          extra: 'ignored',
        },
        methods: {
          activeTab: 'unknown',
          evidenceSearch: 'review',
          evidenceSector: true,
          evidenceConfidence: 'Low',
        },
        additionality: {
          selectedBaseConfigId: 'reference-baseline',
          selectedTargetConfigId: false,
          selectedFocusConfigIds: ['focus-a', 42, 'focus-b', 'focus-c', 'focus-d'],
          orderingMethod: 'unknown',
          shapleySampleCount: 99,
          commoditySelectionState: {
            seededFromConfigId: ['bad'],
            selections: {
              electricity: 'high',
              natural_gas: 'unsupported',
              biomass: true,
            },
          },
        },
        ignoredTopLevel: {
          nope: true,
        },
      }),
    );

    assert.deepEqual(loadPersistedAppUiState(storage), {
      workspace: {
        leftCollapsed: true,
        rightCollapsed: DEFAULT_APP_UI_STATE.workspace.rightCollapsed,
        expandedSections: {
          ...DEFAULT_APP_UI_STATE.workspace.expandedSections,
          commodityControls: true,
        },
        comparison: {
          ...DEFAULT_APP_UI_STATE.workspace.comparison,
          selectedBaseConfigId: 'reference-baseline',
        },
        systemFlow: {
          ...DEFAULT_APP_UI_STATE.workspace.systemFlow,
          selectedYear: 2030,
          collapsedSegmentIds: ['segment:a', 'segment:b'],
        },
      },
      library: {
        sidebarCollapsed: DEFAULT_APP_UI_STATE.library.sidebarCollapsed,
        filters: {
          ...DEFAULT_APP_UI_STATE.library.filters,
          search: 'cement',
          region: 'AU',
        },
        selectedRoleId: DEFAULT_APP_UI_STATE.library.selectedRoleId,
          selectedRepresentationId: DEFAULT_APP_UI_STATE.library.selectedRepresentationId,
          selectedMethodId: DEFAULT_APP_UI_STATE.library.selectedMethodId,
          roleGraphExpandedNodeIds: DEFAULT_APP_UI_STATE.library.roleGraphExpandedNodeIds,
      },
      methods: {
        activeTab: DEFAULT_APP_UI_STATE.methods.activeTab,
        evidenceSearch: 'review',
        evidenceSector: DEFAULT_APP_UI_STATE.methods.evidenceSector,
        evidenceConfidence: 'Low',
      },
      additionality: {
        selectedBaseConfigId: 'reference-baseline',
        selectedFocusConfigId: DEFAULT_APP_UI_STATE.additionality.selectedFocusConfigId,
        selectedFocusConfigIds: ['focus-a', 'focus-b', 'focus-c'],
        orderingMethod: DEFAULT_APP_UI_STATE.additionality.orderingMethod,
        shapleySampleCount: DEFAULT_APP_UI_STATE.additionality.shapleySampleCount,
        commoditySelectionState: {
          seededFromConfigId: DEFAULT_APP_UI_STATE.additionality.commoditySelectionState.seededFromConfigId,
          selections: {
            electricity: 'high',
          },
        },
      },
    });
  });

  test('migrates legacy workspace comparison modes', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      APP_UI_STATE_STORAGE_KEY,
      JSON.stringify({
        workspace: {
          comparison: {
            baseSelectionMode: 'auto',
          },
        },
      }),
    );

    assert.equal(
      loadPersistedAppUiState(storage).workspace.comparison.baseSelectionMode,
      'generated',
    );

    storage.setItem(
      APP_UI_STATE_STORAGE_KEY,
      JSON.stringify({
        workspace: {
          comparison: {
            baseSelectionMode: 'manual',
          },
        },
      }),
    );

    assert.equal(
      loadPersistedAppUiState(storage).workspace.comparison.baseSelectionMode,
      'saved',
    );
  });

  test('hydrates legacy selectedTargetConfigId payloads into selectedFocusConfigId', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      APP_UI_STATE_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_APP_UI_STATE,
        additionality: {
          selectedBaseConfigId: 'reference-baseline',
          selectedTargetConfigId: 'reference-efficiency-open',
          commoditySelectionState: {
            seededFromConfigId: 'reference-baseline',
            selections: {},
          },
        },
      }),
    );

    assert.equal(
      loadPersistedAppUiState(storage).additionality.selectedFocusConfigId,
      'reference-efficiency-open',
    );
    assert.deepEqual(
      loadPersistedAppUiState(storage).additionality.selectedFocusConfigIds,
      ['reference-efficiency-open'],
    );
  });

  test('sanitizes systemFlow view mode, selected year, and collapsed segment ids', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      APP_UI_STATE_STORAGE_KEY,
      JSON.stringify({
        workspace: {
          systemFlow: {
            selectedYear: 2050,
            viewMode: 'topology',
            collapsedSegmentIds: ['segment:one', false, 'segment:two'],
          },
        },
      }),
    );

    assert.deepEqual(loadPersistedAppUiState(storage).workspace.systemFlow, {
      selectedYear: 2050,
      viewMode: 'topology',
      collapsedSegmentIds: ['segment:one', 'segment:two'],
    });

    storage.setItem(
      APP_UI_STATE_STORAGE_KEY,
      JSON.stringify({
        workspace: {
          systemFlow: {
            selectedYear: '2050',
            viewMode: 'diagram',
            collapsedSegmentIds: [1, 2],
          },
        },
      }),
    );

    assert.deepEqual(
      loadPersistedAppUiState(storage).workspace.systemFlow,
      DEFAULT_APP_UI_STATE.workspace.systemFlow,
    );
  });
});
