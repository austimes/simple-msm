import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import {
  buildFamilyEfficiencyOverview,
  buildSectorStateFamilies,
} from '../src/data/libraryInsights.ts';
import { DEFAULT_APP_UI_STATE, type AppUiState } from '../src/data/appUiState.ts';
import { persistAppUiState } from '../src/data/appUiStateStorage.ts';
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

async function renderLibraryPage(persistedState: AppUiState): Promise<string> {
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
    const module = await viteServer.ssrLoadModule('/src/pages/LibraryPage.tsx');
    const Page = module.default as React.ComponentType;
    return renderToStaticMarkup(React.createElement(Page));
  } finally {
    await viteServer.close();

    if (previousWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }
  }
}

describe('LibraryPage efficiency search and filters', () => {
  test('shows a data package download action when trajectories are visible', async () => {
    const persistedState: AppUiState = {
      ...structuredClone(DEFAULT_APP_UI_STATE),
      library: {
        ...structuredClone(DEFAULT_APP_UI_STATE.library),
        selectedSector: 'electricity_supply',
        selectedSubsector: 'grid_supply',
        selectedTrajectoryId: 'electricity__grid_supply__policy_frontier',
      },
    };

    const html = await renderLibraryPage(persistedState);

    assert.match(html, /Download data package/);
  });

  test('searches applicable efficiency artifacts and filters states by applicability and artifact type', async () => {
    const packageState = usePackageStore.getState();
    const candidate = buildSectorStateFamilies(packageState.sectorStates)
      .map((family) => ({
        family,
        overview: buildFamilyEfficiencyOverview(
          family.representative.family_id,
          packageState.sectorStates,
          packageState.autonomousEfficiencyTracks,
          packageState.efficiencyPackages,
        ),
      }))
      .find(({ overview }) => {
        return Boolean(
          overview?.packages.find(
            (pkg) => pkg.classification === 'pure_efficiency_overlay'
              && pkg.applicableStateIds.length > 0
              && overview.orderedStateIds.some((stateId) => !pkg.applicableStateIds.includes(stateId)),
          ),
        );
      });

    assert.ok(candidate, 'expected a family with a pure efficiency package that excludes at least one state');
    if (!candidate?.overview) {
      return;
    }

    const pkg = candidate.overview.packages.find(
      (entry) => entry.classification === 'pure_efficiency_overlay'
        && candidate.overview?.orderedStateIds.some((stateId) => !entry.applicableStateIds.includes(stateId)),
    );

    assert.ok(pkg, 'expected a pure efficiency package for the candidate family');
    if (!pkg) {
      return;
    }

    const nonApplicableStateId = candidate.overview.orderedStateIds.find(
      (stateId) => !pkg.applicableStateIds.includes(stateId),
    );

    assert.ok(nonApplicableStateId, 'expected a non-applicable state in the candidate family');
    if (!nonApplicableStateId) {
      return;
    }

    const persistedState: AppUiState = {
      ...structuredClone(DEFAULT_APP_UI_STATE),
      library: {
        sidebarCollapsed: false,
        filters: {
          ...DEFAULT_APP_UI_STATE.library.filters,
          search: pkg.packageId,
          efficiencyApplicability: 'with_applicable_artifacts',
          efficiencyArtifactType: 'pure_efficiency_overlay',
        },
        selectedSector: candidate.family.sector,
        selectedSubsector: candidate.family.subsector,
        selectedTrajectoryId: pkg.applicableStateIds[0] ?? candidate.family.stateId,
      },
    };

    const html = await renderLibraryPage(persistedState);

    assert.doesNotMatch(html, /No trajectories match the current filters/);
    for (const applicableStateId of pkg.applicableStateIds) {
      assert.match(html, new RegExp(escapeForRegex(applicableStateId)));
    }
    assert.doesNotMatch(html, new RegExp(escapeForRegex(nonApplicableStateId)));
  });

  test('shows canonical embodied-efficiency copy for pathway states that use the shared registry', async () => {
    const persistedState: AppUiState = {
      ...structuredClone(DEFAULT_APP_UI_STATE),
      library: {
        ...structuredClone(DEFAULT_APP_UI_STATE.library),
        selectedSector: 'buildings',
        selectedSubsector: 'commercial',
        selectedTrajectoryId: 'buildings__commercial__deep_electric',
      },
    };

    const html = await renderLibraryPage(persistedState);

    assert.match(html, /Efficiency artifacts/);
    assert.match(html, /Embodied efficiency in pathway choice/);
    assert.match(html, /Major HVAC and hot-water electrification is a route change, not an add-on efficiency overlay\./);
    assert.doesNotMatch(html, /Embedded in pathway state/);
  });
});
