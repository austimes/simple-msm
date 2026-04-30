import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import {
  buildFamilyEfficiencyOverview,
  buildRoleMethodFamilies,
  buildRoleMethodTrajectory,
} from '../src/data/libraryInsights.ts';
import { DEFAULT_APP_UI_STATE, type AppUiState } from '../src/data/appUiState.ts';
import {
  APP_UI_STATE_STORAGE_KEY,
  persistAppUiState,
} from '../src/data/appUiStateStorage.ts';
import { usePackageStore } from '../src/data/packageStore.ts';

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

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function renderPersistedPageTwice(
  modulePath: string,
  persistedState: AppUiState,
) {
  const storage = createMemoryStorage();
  persistAppUiState(persistedState, storage);

  const previousWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: storage,
  };

  const viteServer = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    logLevel: 'error',
    server: {
      middlewareMode: true,
    },
  });

  try {
    const module = await viteServer.ssrLoadModule(modulePath);
    const Page = module.default as React.ComponentType;

    return {
      first: renderToStaticMarkup(React.createElement(Page)),
      second: renderToStaticMarkup(React.createElement(Page)),
    };
  } finally {
    await viteServer.close();

    if (previousWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }
  }
}

async function withStoreModule<T>(
  persistedState: AppUiState,
  callback: (context: {
    storage: ReturnType<typeof createMemoryStorage>;
    useAppUiStore: typeof import('../src/data/appUiStore.ts').useAppUiStore;
  }) => Promise<T> | T,
): Promise<T> {
  const storage = createMemoryStorage();
  persistAppUiState(persistedState, storage);

  const previousWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: storage,
  };

  const viteServer = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    logLevel: 'error',
    server: {
      middlewareMode: true,
    },
  });

  try {
    const storeModule = await viteServer.ssrLoadModule('/src/data/appUiStore.ts');
    return await callback({
      storage,
      useAppUiStore: storeModule.useAppUiStore,
    });
  } finally {
    await viteServer.close();

    if (previousWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }
  }
}

function assertMatchesBoth(
  htmls: Awaited<ReturnType<typeof renderPersistedPageTwice>>,
  pattern: RegExp,
) {
  assert.match(htmls.first, pattern);
  assert.match(htmls.second, pattern);
}

describe('appUiStore route persistence', () => {
  test('preserves workspace sidebars and left-sidebar section expansion across remount', async () => {
    const persistedState: AppUiState = {
      ...structuredClone(DEFAULT_APP_UI_STATE),
      workspace: {
        leftCollapsed: true,
        rightCollapsed: true,
        expandedSections: {
          ...DEFAULT_APP_UI_STATE.workspace.expandedSections,
          commodityControls: true,
          emissionsPrice: false,
          configurations: false,
        },
        comparison: {
          baseSelectionMode: 'saved',
          selectedBaseConfigId: 'reference-baseline',
          fuelSwitchBasis: 'from',
          selectedFuelSwitchYear: 2050,
        },
      },
    };

    const htmls = await renderPersistedPageTwice(
      '/src/pages/ConfigurationWorkspacePage.tsx',
      persistedState,
    );

    assertMatchesBoth(
      htmls,
      /workspace-layout workspace-layout--left-collapsed workspace-layout--right-collapsed/,
    );
    assertMatchesBoth(htmls, /id="left-sidebar-section-commodityControls"/);
    assert.doesNotMatch(htmls.first, /id="left-sidebar-section-emissionsPrice"/);
    assert.doesNotMatch(htmls.second, /id="left-sidebar-section-emissionsPrice"/);
    assert.doesNotMatch(htmls.first, /id="left-sidebar-section-configurations"/);
    assert.doesNotMatch(htmls.second, /id="left-sidebar-section-configurations"/);

    await withStoreModule(persistedState, ({ useAppUiStore }) => {
      assert.deepEqual(useAppUiStore.getState().workspace.comparison, {
        baseSelectionMode: 'saved',
        selectedBaseConfigId: 'reference-baseline',
        fuelSwitchBasis: 'from',
        selectedFuelSwitchYear: 2050,
      });
    });
  });

  test('preserves library filters, scope selection, trajectory selection, and sidebar collapse across remount', async () => {
    const packageState = usePackageStore.getState();
    const candidate = buildRoleMethodFamilies(packageState.resolvedMethodYears).find((family) => {
      if (
        family.confidenceRatings.length === 0
        || family.sourceIds.length === 0
        || family.assumptionIds.length === 0
        || family.rows.length === 0
      ) {
        return false;
      }

      const efficiency = buildFamilyEfficiencyOverview(
        family.representative.role_id,
        packageState.resolvedMethodYears,
        packageState.autonomousEfficiencyTracks,
        packageState.efficiencyPackages,
      );

      return Boolean(efficiency?.packages.some((pkg) => pkg.classification === 'pure_efficiency_overlay'));
    });

    assert.ok(candidate, 'expected at least one family with confidence, source, and assumption metadata');

    const selectedTrajectoryId = buildRoleMethodTrajectory(candidate).methodId;
    const searchToken = candidate.label.split(/\s+/)[0]?.toLowerCase() ?? candidate.methodId;
    const persistedState: AppUiState = {
      ...structuredClone(DEFAULT_APP_UI_STATE),
      library: {
        sidebarCollapsed: true,
        filters: {
          search: searchToken,
          confidence: candidate.confidenceRatings[0] ?? '',
          region: candidate.rows[0]?.region ?? '',
          sourceId: candidate.sourceIds[0] ?? '',
          assumptionId: candidate.assumptionIds[0] ?? '',
          efficiencyApplicability: 'with_applicable_artifacts',
          efficiencyArtifactType: 'pure_efficiency_overlay',
        },
        selectedRoleId: candidate.representative.role_id,
        selectedRepresentationId: candidate.representative.representation_id,
        selectedMethodId: selectedTrajectoryId,
        roleGraphExpandedNodeIds: [`role:${candidate.representative.role_id}`],
      },
    };

    const htmls = await renderPersistedPageTwice('/src/pages/LibraryPage.tsx', persistedState);

    assertMatchesBoth(htmls, /library-sidebar-layout library-sidebar-layout--collapsed/);
    assertMatchesBoth(htmls, new RegExp(`value="${escapeForRegex(searchToken)}"`));
    assertMatchesBoth(htmls, /Role Graph/);
    assertMatchesBoth(htmls, new RegExp(`Role</dt><dd>${escapeForRegex(candidate.representative.role_label)}</dd>`));
    assertMatchesBoth(
      htmls,
      new RegExp(`option value="${escapeForRegex(candidate.confidenceRatings[0] ?? '')}" selected=""`),
    );
    assertMatchesBoth(
      htmls,
      new RegExp(`option value="${escapeForRegex(candidate.rows[0]?.region ?? '')}" selected=""`),
    );
    assertMatchesBoth(
      htmls,
      new RegExp(`option value="${escapeForRegex(candidate.sourceIds[0] ?? '')}" selected=""`),
    );
    assertMatchesBoth(
      htmls,
      new RegExp(`option value="${escapeForRegex(candidate.assumptionIds[0] ?? '')}" selected=""`),
    );
    assertMatchesBoth(htmls, /option value="with_applicable_artifacts" selected=""/);
    assertMatchesBoth(htmls, /option value="pure_efficiency_overlay" selected=""/);
    assertMatchesBoth(
      htmls,
      new RegExp(`library-state-selector-button library-state-selector-button--active[\\s\\S]*?<span>${escapeForRegex(selectedTrajectoryId)}</span>`),
    );
  });

  test('preserves methods tab and evidence filters across remount', async () => {
    const candidate = buildRoleMethodFamilies(usePackageStore.getState().resolvedMethodYears)[0];
    assert.ok(candidate, 'expected at least one sector-state family');

    const searchToken = candidate.label.split(/\s+/)[0]?.toLowerCase() ?? candidate.methodId;
    const persistedState: AppUiState = {
      ...structuredClone(DEFAULT_APP_UI_STATE),
      methods: {
        activeTab: 'evidence',
        evidenceSearch: searchToken,
        evidenceSector: candidate.sector,
        evidenceConfidence: candidate.confidenceRatings[0] ?? '',
      },
    };

    const htmls = await renderPersistedPageTwice('/src/pages/MethodsPage.tsx', persistedState);

    assertMatchesBoth(
      htmls,
      /methods-tab methods-tab--active[^>]*>Method evidence browser</,
    );
    assertMatchesBoth(htmls, new RegExp(`value="${escapeForRegex(searchToken)}"`));
    assertMatchesBoth(
      htmls,
      new RegExp(`option value="${escapeForRegex(candidate.sector)}" selected=""`),
    );
    assertMatchesBoth(
      htmls,
      new RegExp(`option value="${escapeForRegex(candidate.confidenceRatings[0] ?? '')}" selected=""`),
    );
  });

  test('preserves additionality selections and commodity overrides across remount', async () => {
    const commodityOptions = Object.entries(usePackageStore.getState().appConfig.commodity_price_presets)
      .map(([id, driver]) => ({ id, label: driver.label }))
      .sort((left, right) => left.label.localeCompare(right.label));

    assert.ok(commodityOptions.length >= 2, 'expected at least two commodity price presets');

    const baseConfigId = 'reference-baseline';
    const focusConfigId = 'reference-efficiency-open';
    const persistedState: AppUiState = {
      ...structuredClone(DEFAULT_APP_UI_STATE),
      additionality: {
        selectedBaseConfigId: baseConfigId,
        selectedFocusConfigId: focusConfigId,
        commoditySelectionState: {
          seededFromConfigId: baseConfigId,
          selections: {
            [commodityOptions[0].id]: 'high',
            [commodityOptions[1].id]: 'low',
          },
        },
      },
    };

    const htmls = await renderPersistedPageTwice('/src/pages/AdditionalityPage.tsx', persistedState);

    assertMatchesBoth(
      htmls,
      new RegExp(`option value="${escapeForRegex(baseConfigId)}" selected=""`),
    );
    assertMatchesBoth(
      htmls,
      new RegExp(`option value="${escapeForRegex(focusConfigId)}" selected=""`),
    );
    assertMatchesBoth(
      htmls,
      new RegExp(`Price scenario: ${escapeForRegex(commodityOptions[0].label)}: high \\| ${escapeForRegex(commodityOptions[1].label)}: low`),
    );
  });

  test('keeps additionality runtime cache session-only and clears it on reset', async () => {
    await withStoreModule(structuredClone(DEFAULT_APP_UI_STATE), ({ storage, useAppUiStore }) => {
      const initialSerialized = storage.getItem(APP_UI_STATE_STORAGE_KEY);
      assert.equal(initialSerialized, JSON.stringify(DEFAULT_APP_UI_STATE));

      const runToken = useAppUiStore.getState().beginAdditionalityRun('cache-key', {
        phase: 'loading',
        report: null,
        progress: {
          completed: 0,
          totalExpected: 5,
        },
        error: null,
        validationIssues: [],
      });

      assert.equal(runToken, 1);
      assert.deepEqual(
        Object.keys(useAppUiStore.getState().additionalityRuntime.entriesByKey),
        ['cache-key'],
      );
      assert.equal(storage.getItem(APP_UI_STATE_STORAGE_KEY), initialSerialized);

      useAppUiStore.getState().resetAllUiState();

      assert.deepEqual(useAppUiStore.getState().additionalityRuntime.entriesByKey, {});
      assert.equal(useAppUiStore.getState().additionalityRuntime.activeRunKey, null);
      assert.equal(storage.getItem(APP_UI_STATE_STORAGE_KEY), JSON.stringify(DEFAULT_APP_UI_STATE));
    });
  });
});
