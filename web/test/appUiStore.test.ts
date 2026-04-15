import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { buildSectorStateFamilies, buildSectorStateTrajectory } from '../src/data/libraryInsights.ts';
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
  });

  test('preserves library filters, scope selection, trajectory selection, and sidebar collapse across remount', async () => {
    const candidate = buildSectorStateFamilies(usePackageStore.getState().sectorStates).find((family) => (
      family.confidenceRatings.length > 0
      && family.sourceIds.length > 0
      && family.assumptionIds.length > 0
      && family.rows.length > 0
    ));

    assert.ok(candidate, 'expected at least one family with confidence, source, and assumption metadata');

    const selectedTrajectoryId = buildSectorStateTrajectory(candidate).stateId;
    const searchToken = candidate.label.split(/\s+/)[0]?.toLowerCase() ?? candidate.stateId;
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
        },
        selectedSector: candidate.sector,
        selectedSubsector: candidate.subsector,
        selectedTrajectoryId,
      },
    };

    const htmls = await renderPersistedPageTwice('/src/pages/LibraryPage.tsx', persistedState);

    assertMatchesBoth(htmls, /library-sidebar-layout library-sidebar-layout--collapsed/);
    assertMatchesBoth(htmls, new RegExp(`value="${escapeForRegex(searchToken)}"`));
    assertMatchesBoth(
      htmls,
      new RegExp(`library-chip library-chip--active">${escapeForRegex(candidate.sector)}<`),
    );
    assertMatchesBoth(
      htmls,
      new RegExp(`library-chip library-chip--active">${escapeForRegex(candidate.subsector)}<`),
    );
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
    assertMatchesBoth(
      htmls,
      new RegExp(`library-state-selector-button library-state-selector-button--active[\\s\\S]*?<span>${escapeForRegex(selectedTrajectoryId)}</span>`),
    );
  });

  test('preserves methods tab and evidence filters across remount', async () => {
    const candidate = buildSectorStateFamilies(usePackageStore.getState().sectorStates)[0];
    assert.ok(candidate, 'expected at least one sector-state family');

    const searchToken = candidate.label.split(/\s+/)[0]?.toLowerCase() ?? candidate.stateId;
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
      /methods-tab methods-tab--active[^>]*>State evidence browser</,
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

    const baseConfigId = 'reference-base';
    const targetConfigId = 'reference-all';
    const persistedState: AppUiState = {
      ...structuredClone(DEFAULT_APP_UI_STATE),
      additionality: {
        selectedBaseConfigId: baseConfigId,
        selectedTargetConfigId: targetConfigId,
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
      new RegExp(`option value="${escapeForRegex(targetConfigId)}" selected=""`),
    );
    assertMatchesBoth(
      htmls,
      new RegExp(`Price scenario: ${escapeForRegex(commodityOptions[0].label)}: high \\| ${escapeForRegex(commodityOptions[1].label)}: low`),
    );
  });
});
