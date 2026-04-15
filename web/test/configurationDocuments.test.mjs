import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveConfigurationDocument } from '../src/data/demandResolution.ts';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';
import { deriveOutputRunStatusesForConfiguration } from '../src/solver/solveScope.ts';
import { createServer } from 'vite';
import { loadPkg } from './solverTestUtils.mjs';

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

function loadAppConfig() {
  return {
    output_roles: readJson('../public/app_config/output_roles.json'),
    baseline_activity_anchors: readJson('../public/app_config/baseline_activity_anchors.json'),
    demand_growth_presets: readJson('../public/app_config/demand_growth_presets.json'),
    commodity_price_presets: readJson('../public/app_config/commodity_price_presets.json'),
    explanation_tag_rules: readJson('../public/app_config/explanation_tag_rules.json'),
  };
}

const appConfig = loadAppConfig();
const pkg = loadPkg();
const configDir = new URL('../src/configurations/', import.meta.url);
const configFiles = readdirSync(configDir)
  .filter((name) => name.endsWith('.json') && !name.startsWith('_'))
  .sort();
let viteServer;

before(async () => {
  viteServer = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    logLevel: 'error',
    server: {
      middlewareMode: true,
    },
  });
});

after(async () => {
  await viteServer?.close();
});

async function loadViteModule(modulePath) {
  assert.ok(viteServer, 'expected Vite SSR server to be available for module loading');
  return viteServer.ssrLoadModule(modulePath);
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test('bundled configurations are full documents with app metadata', () => {
  for (const file of configFiles) {
    const config = readJson(`../src/configurations/${file}`);

    assert.equal(typeof config.name, 'string', `${file} should have a name`);
    assert.ok(Array.isArray(config.years), `${file} should include milestone years`);
    assert.equal(typeof config.service_controls, 'object', `${file} should include service_controls`);
    assert.equal(typeof config.service_demands, 'object', `${file} should include service_demands`);
    assert.equal(typeof config.demand_generation, 'object', `${file} should include demand_generation`);
    assert.equal(typeof config.commodity_pricing, 'object', `${file} should include commodity_pricing`);
    assert.equal(typeof config.carbon_price, 'object', `${file} should include carbon_price`);
    assert.equal(typeof config.app_metadata?.id, 'string', `${file} should include app_metadata.id`);
    assert.equal(config.app_metadata?.readonly, true, `${file} should be readonly`);
    assert.ok(!('seed_output_ids' in (config.app_metadata ?? {})), `${file} should not keep dead app_metadata.seed_output_ids`);
    assert.ok(!('included_output_ids' in (config.app_metadata ?? {})), `${file} should not keep dead app_metadata.included_output_ids`);

    assert.ok(!('id' in config), `${file} should not keep legacy top-level id`);
    assert.ok(!('readonly' in config), `${file} should not keep legacy top-level readonly`);
    assert.ok(!('includedOutputIds' in config), `${file} should not keep legacy includedOutputIds`);
    assert.ok(!('serviceControls' in config), `${file} should not keep legacy serviceControls`);
    assert.ok(!('solverOptions' in config), `${file} should not keep legacy solverOptions`);

    resolveConfigurationDocument(config, appConfig, file);
  }
});

test('configuration documents round-trip through browser persistence into scoped solve requests', async () => {
  const {
    CONFIGURATION_DRAFT_STORAGE_KEY,
    CONFIG_META_STORAGE_KEY,
    loadPersistedConfigurationDraft,
    persistConfigMeta,
    persistConfigurationDraft,
  } = await loadViteModule('/src/data/configurationDraftStorage.ts');
  const storage = createMemoryStorage();
  const configuration = readJson('../src/configurations/buildings-endogenous.json');

  assert.equal(persistConfigurationDraft(configuration, storage), null);
  assert.equal(storage.getItem(CONFIGURATION_DRAFT_STORAGE_KEY), JSON.stringify(configuration));
  persistConfigMeta({
    activeConfigurationId: configuration.app_metadata.id,
    activeConfigurationReadonly: configuration.app_metadata.readonly === true,
    baseConfiguration: structuredClone(configuration),
  }, storage);
  assert.ok(storage.getItem(CONFIG_META_STORAGE_KEY));

  const restored = loadPersistedConfigurationDraft(appConfig, storage);
  const resolved = resolveConfigurationDocument(structuredClone(configuration), appConfig);

  assert.equal(restored.error, null);
  assert.equal(restored.notice, 'Restored the most recent configuration document from this browser.');
  assert.deepEqual(restored.configuration, resolved);
  assert.deepEqual(restored.configMeta?.baseConfiguration, configuration);

  const request = buildSolveRequest(pkg, restored.configuration);
  const outputsInRequest = new Set(request.rows.map((row) => row.outputId));

  assert.equal(request.configuration.controlsByOutput.electricity['2025'].mode, 'optimize');
  assert.equal(
    request.configuration.serviceDemandByOutput.residential_building_services['2050'],
    configuration.service_demands.residential_building_services['2050'],
  );
  assert.ok(outputsInRequest.has('residential_building_services'));
  assert.ok(outputsInRequest.has('commercial_building_services'));
  assert.ok(outputsInRequest.has('electricity'));
  assert.ok(!outputsInRequest.has('cement_equivalent'));
});

test('residual overlay materialization backfills CSV-driven defaults and aggregated display mode', async () => {
  const { materializeResidualOverlayConfiguration } = await loadViteModule('/src/data/configurationDocumentLoader.ts');
  const { usePackageStore } = await loadViteModule('/src/data/packageStore.ts');
  const configuration = readJson('../src/configurations/reference.json');
  const overlayRows = usePackageStore.getState().residualOverlays2025;

  delete configuration.residual_overlays;
  delete configuration.presentation_options;

  const materialized = materializeResidualOverlayConfiguration(
    structuredClone(configuration),
    overlayRows,
  );
  const controls = materialized.residual_overlays?.controls_by_overlay_id ?? {};
  const overlayIdsByDomain = overlayRows.reduce((groups, row) => {
    if (!groups[row.overlay_domain]) {
      groups[row.overlay_domain] = new Set();
    }
    groups[row.overlay_domain].add(row.overlay_id);
    return groups;
  }, {});

  for (const overlayId of overlayIdsByDomain.energy_residual ?? []) {
    assert.equal(controls[overlayId]?.included, true, `${overlayId} should default on`);
  }
  for (const overlayId of overlayIdsByDomain.nonenergy_residual ?? []) {
    assert.equal(controls[overlayId]?.included, true, `${overlayId} should default on`);
  }
  for (const overlayId of overlayIdsByDomain.net_sink ?? []) {
    assert.equal(controls[overlayId]?.included, false, `${overlayId} should default off`);
  }

  assert.equal(
    materialized.presentation_options?.residual_overlay_display_mode,
    'aggregated_non_sink',
  );
});

test('configuration id helper prefers app metadata ids and falls back to legacy top-level ids', async () => {
  const { getConfigurationDocumentId } = await loadViteModule('/src/data/configurationMetadata.ts');

  assert.equal(
    getConfigurationDocumentId({
      id: 'legacy-id',
      app_metadata: { id: ' user-config-id ' },
    }),
    'user-config-id',
  );
  assert.equal(getConfigurationDocumentId({ id: ' legacy-id ' }), 'legacy-id');
  assert.equal(getConfigurationDocumentId({ app_metadata: {} }), null);
});

test('configuration loader prefers the canonical filename when duplicate config ids exist', async () => {
  const { parseConfigurationCollection } = await loadViteModule('/src/data/configurationLoader.ts');
  const canonicalConfig = structuredClone(readJson('../src/configurations/buildings-endogenous.json'));
  const duplicateConfig = structuredClone(canonicalConfig);

  canonicalConfig.app_metadata = {
    ...(canonicalConfig.app_metadata ?? {}),
    id: 'buildings-dlg',
    readonly: false,
  };
  duplicateConfig.app_metadata = {
    ...(canonicalConfig.app_metadata ?? {}),
  };

  duplicateConfig.service_controls.residential_building_services = {
    mode: 'optimize',
    disabled_state_ids: ['buildings__residential__deep_electric'],
  };

  const parsed = parseConfigurationCollection(
    {
      '/src/configurations/user/undefined.json': JSON.stringify(duplicateConfig),
      '/src/configurations/user/buildings-dlg.json': JSON.stringify(canonicalConfig),
    },
    false,
  );

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].app_metadata?.id, 'buildings-dlg');
  assert.equal(
    parsed[0].service_controls.residential_building_services.disabled_state_ids,
    undefined,
  );
});

test('configuration loader rejects partial overlay documents instead of merging them with a reference config', async () => {
  const { parseConfigurationCollection } = await loadViteModule('/src/data/configurationLoader.ts');
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(String(message));

  try {
    const parsed = parseConfigurationCollection(
      {
        '/src/configurations/overlay-like.json': JSON.stringify({
          name: 'Overlay-like configuration',
          description: 'Deliberately incomplete regression fixture.',
          service_controls: {
            electricity: { mode: 'optimize' },
          },
          app_metadata: {
            id: 'overlay-like',
          },
        }),
      },
      true,
    );

    assert.deepEqual(parsed, []);
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(warnings, ['Failed to parse configuration document: /src/configurations/overlay-like.json']);
});

test('builtin configuration loader follows the tracked index list', async () => {
  const { loadBuiltinConfigurations } = await loadViteModule('/src/data/configurationLoader.ts');
  const builtinIds = loadBuiltinConfigurations()
    .map((config) => config.app_metadata?.id)
    .filter((id) => typeof id === 'string');

  assert.deepEqual(builtinIds, readJson('../src/configurations/_index.json'));
});

test('editing a loaded user configuration marks the workspace dirty for Save overwrite', async () => {
  const { usePackageStore } = await loadViteModule('/src/data/packageStore.ts');
  const userConfiguration = structuredClone(readJson('../src/configurations/buildings-endogenous.json'));
  userConfiguration.app_metadata = {
    ...(userConfiguration.app_metadata ?? {}),
    id: 'test-user-configuration',
    readonly: false,
  };

  usePackageStore.getState().loadConfiguration(userConfiguration);

  assert.equal(usePackageStore.getState().activeConfigurationReadonly, false);
  assert.equal(usePackageStore.getState().isConfigurationDirty, false);

  const currentPresetId = usePackageStore.getState().currentConfiguration.demand_generation.preset_id;
  const nextPresetId = Object.keys(appConfig.demand_growth_presets)
    .find((presetId) => presetId !== currentPresetId);

  assert.ok(nextPresetId, 'expected an alternate demand preset for the dirty-state regression test');

  usePackageStore.getState().setDemandPreset(nextPresetId);

  const packageState = usePackageStore.getState();
  const updatedConfiguration = usePackageStore.getState().currentConfiguration;

  assert.equal(usePackageStore.getState().isConfigurationDirty, true);
  assert.equal(usePackageStore.getState().activeConfigurationId, userConfiguration.app_metadata.id);
  assert.equal(usePackageStore.getState().activeConfigurationReadonly, false);
  assert.equal(updatedConfiguration.demand_generation.preset_id, nextPresetId);
  assert.equal(updatedConfiguration.demand_generation.service_growth_rates_pct_per_year, null);
  assert.equal(updatedConfiguration.demand_generation.external_commodity_growth_rates_pct_per_year, null);
  assert.doesNotThrow(() => deriveOutputRunStatusesForConfiguration(packageState, updatedConfiguration));
  assert.doesNotThrow(() => buildSolveRequest(packageState, updatedConfiguration));
});
test('user configuration API saves files using app_metadata.id', async () => {
  const server = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    logLevel: 'error',
  });
  const config = structuredClone(readJson('../src/configurations/buildings-endogenous.json'));
  const configId = 'user-config-api-save-test';
  const canonicalPath = fileURLToPath(new URL(`../src/configurations/user/${configId}.json`, import.meta.url));

  config.name = 'User config API save test';
  config.app_metadata = {
    ...(config.app_metadata ?? {}),
    id: configId,
    readonly: false,
  };

  rmSync(canonicalPath, { force: true });

  try {
    await server.listen();
    const url = server.resolvedUrls?.local[0];

    assert.ok(url, 'expected Vite dev server to expose a local URL');

    const saveResponse = await fetch(`${url}api/user-configurations`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    assert.equal(saveResponse.status, 200);
    assert.ok(existsSync(canonicalPath), 'expected canonical user config file to be created');

    const saved = JSON.parse(readFileSync(canonicalPath, 'utf8'));
    assert.equal(saved.app_metadata?.id, configId);
  } finally {
    await server.close();
    rmSync(canonicalPath, { force: true });
  }
});

test('bundled configurations and reference assets default respect_max_share to true', () => {
  for (const file of configFiles) {
    const config = readJson(`../src/configurations/${file}`);
    assert.equal(
      config.solver_options?.respect_max_share,
      true,
      `${file} should ship with respect_max_share enabled`,
    );
  }

  const referenceAssetPaths = [
    '../public/app_config/reference_configuration.json',
    '../public/app_config/reference_configuration_v02.json',
  ];

  for (const assetPath of referenceAssetPaths) {
    assert.equal(
      readJson(assetPath).solver_options?.respect_max_share,
      true,
      `${assetPath} should ship with respect_max_share enabled`,
    );
  }
});

test('respect_max_share defaults to true when omitted and can be toggled in the store', async () => {
  const { usePackageStore } = await loadViteModule('/src/data/packageStore.ts');
  const configuration = readJson('../src/configurations/buildings-endogenous.json');

  delete configuration.solver_options.respect_max_share;
  usePackageStore.getState().replaceCurrentConfiguration(configuration);

  assert.equal(
    buildSolveRequest(pkg, usePackageStore.getState().currentConfiguration).configuration.options.respectMaxShare,
    true,
  );

  usePackageStore.getState().setRespectMaxShare(false);
  assert.equal(usePackageStore.getState().currentConfiguration.solver_options?.respect_max_share, false);
  assert.equal(usePackageStore.getState().isConfigurationDirty, false);

  usePackageStore.getState().setRespectMaxShare(true);
  assert.equal(usePackageStore.getState().currentConfiguration.solver_options?.respect_max_share, true);
});

test('left sidebar uses the requested default collapsed sections and restores all commodity price controls', async () => {
  const { default: LeftSidebar } = await loadViteModule('/src/components/workspace/LeftSidebar.tsx');
  const { usePackageStore } = await loadViteModule('/src/data/packageStore.ts');
  const configuration = readJson('../src/configurations/buildings-endogenous.json');

  delete configuration.solver_options.respect_max_share;
  usePackageStore.getState().replaceCurrentConfiguration(configuration);

  const html = renderToStaticMarkup(React.createElement(LeftSidebar));

  assert.match(html, /aria-expanded="false" aria-controls="left-sidebar-section-options"/);
  assert.match(html, /aria-expanded="false" aria-controls="left-sidebar-section-demandGrowth"/);
  assert.match(html, /aria-expanded="false" aria-controls="left-sidebar-section-commodityControls"/);
  assert.match(html, /aria-expanded="true" aria-controls="left-sidebar-section-emissionsPrice"/);
  assert.match(html, /aria-expanded="false" aria-controls="left-sidebar-section-overlays"/);
  assert.match(html, /aria-expanded="true" aria-controls="left-sidebar-section-configurations"/);

  assert.ok(html.includes('Options'));
  assert.ok(html.includes('Demand Growth'));
  assert.ok(html.includes('Commodity Controls'));
  assert.ok(html.includes('Emissions Price'));
  assert.ok(html.includes('Overlays'));
  assert.ok(html.includes('Configurations'));

  assert.ok(!html.includes('Respect max-share caps'));
  assert.ok(!html.includes('Simple sector growth - central'));
  assert.ok(!html.includes('Electricity supply'));
  assert.ok(!html.includes('Exogenous purchase price path for this commodity.'));
  assert.ok(!html.includes('All on'));
  assert.ok(!html.includes('Energy residuals'));
  assert.doesNotMatch(html, /workspace-mode-badge--modeled/);
  assert.doesNotMatch(html, />in model<\/span>/i);
});

test('left sidebar renders the residual aggregate summary, display toggle, and separate net sinks block', async () => {
  const { default: LeftSidebar } = await loadViteModule('/src/components/workspace/LeftSidebar.tsx');
  const { usePackageStore } = await loadViteModule('/src/data/packageStore.ts');

  usePackageStore.getState().replaceCurrentConfiguration(readJson('../src/configurations/reference-base.json'));

  const html = renderToStaticMarkup(
    React.createElement(LeftSidebar, {
      initialExpandedSections: {
        overlays: true,
        emissionsPrice: false,
        configurations: false,
      },
    }),
  );

  assert.match(html, /Unmodelled residuals/);
  assert.match(html, /Aggregated/);
  assert.match(html, /Individual/);
  assert.match(html, /components enabled/);
  assert.match(html, /Net sinks/);
  assert.match(html, /Residual LULUCF sink/);
});
