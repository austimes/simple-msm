import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveConfigurationDocument } from '../src/data/demandResolution.ts';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';
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
    if (file !== 'reference.json') {
      assert.ok(
        Array.isArray(config.app_metadata?.seed_output_ids),
        `${file} should use app_metadata.seed_output_ids for scoped solves`,
      );
      assert.ok(
        !('included_output_ids' in (config.app_metadata ?? {})),
        `${file} should not keep the legacy app_metadata.included_output_ids field`,
      );
    }

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
    LEGACY_SCENARIO_DRAFT_STORAGE_KEY,
    loadPersistedConfigurationDraft,
    persistConfigMeta,
    persistConfigurationDraft,
  } = await loadViteModule('/src/data/scenarioDraftStorage.ts');
  const storage = createMemoryStorage();
  const configuration = readJson('../src/configurations/buildings-endogenous.json');

  assert.equal(persistConfigurationDraft(configuration, storage), null);
  assert.equal(storage.getItem(CONFIGURATION_DRAFT_STORAGE_KEY), JSON.stringify(configuration));
  assert.equal(storage.getItem(LEGACY_SCENARIO_DRAFT_STORAGE_KEY), null);
  persistConfigMeta({
    activeConfigurationId: configuration.app_metadata.id,
    activeConfigurationReadonly: configuration.app_metadata.readonly === true,
    baseConfiguration: structuredClone(configuration),
  }, storage);

  const restored = loadPersistedConfigurationDraft(appConfig, storage);

  assert.equal(restored.error, null);
  assert.equal(restored.notice, 'Restored the most recent configuration document from this browser.');
  assert.deepEqual(restored.configuration, configuration);
  assert.deepEqual(restored.scenario, configuration);
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

test('configuration-named app config assets stay in sync with legacy scenario filenames', () => {
  const assetPairs = [
    ['../src/app_config/reference_configuration.json', '../src/app_config/reference_scenario.json'],
    ['../src/app_config/configuration_schema.json', '../src/app_config/scenario_schema.json'],
    ['../public/app_config/reference_configuration.json', '../public/app_config/reference_scenario.json'],
    ['../public/app_config/reference_configuration_v02.json', '../public/app_config/reference_scenario_v02.json'],
    ['../public/app_config/configuration_schema.json', '../public/app_config/scenario_schema.json'],
    ['../public/app_config/configuration_schema_v02.json', '../public/app_config/scenario_schema_v02.json'],
  ];

  for (const [configurationPath, legacyPath] of assetPairs) {
    assert.deepEqual(
      readJson(configurationPath),
      readJson(legacyPath),
      `${configurationPath} should match ${legacyPath}`,
    );
  }
});

test('configuration draft loading migrates the legacy scenario key and legacy config meta payloads', async () => {
  const {
    CONFIGURATION_DRAFT_STORAGE_KEY,
    LEGACY_SCENARIO_DRAFT_STORAGE_KEY,
    CONFIG_META_STORAGE_KEY,
    loadPersistedConfigurationDraft,
  } = await loadViteModule('/src/data/scenarioDraftStorage.ts');
  const storage = createMemoryStorage();
  const configuration = readJson('../src/configurations/buildings-endogenous.json');

  storage.setItem(LEGACY_SCENARIO_DRAFT_STORAGE_KEY, JSON.stringify(configuration));
  storage.setItem(CONFIG_META_STORAGE_KEY, JSON.stringify({
    activeConfigurationId: configuration.app_metadata.id,
    activeConfigurationReadonly: configuration.app_metadata.readonly === true,
    baseConfigurationScenario: structuredClone(configuration),
    baseIncludedOutputIds: configuration.app_metadata.seed_output_ids,
  }));

  const restored = loadPersistedConfigurationDraft(appConfig, storage);

  assert.equal(restored.error, null);
  assert.deepEqual(restored.configuration, configuration);
  assert.deepEqual(restored.scenario, configuration);
  assert.deepEqual(restored.configMeta?.baseConfiguration, configuration);
  assert.equal(storage.getItem(CONFIGURATION_DRAFT_STORAGE_KEY), JSON.stringify(configuration));
  assert.equal(storage.getItem(LEGACY_SCENARIO_DRAFT_STORAGE_KEY), null);
});

test('configuration loader accepts legacy included_output_ids and canonicalizes to seed_output_ids', async () => {
  const { parseConfigurationCollection } = await loadViteModule('/src/data/configurationLoader.ts');
  const legacyConfig = readJson('../src/configurations/buildings-endogenous.json');

  legacyConfig.app_metadata = {
    id: legacyConfig.app_metadata.id,
    readonly: true,
    included_output_ids: legacyConfig.app_metadata.seed_output_ids,
  };

  const [parsed] = parseConfigurationCollection(
    {
      '/src/configurations/legacy-buildings-endogenous.json': JSON.stringify(legacyConfig),
    },
    true,
  );

  assert.deepEqual(
    parsed.app_metadata?.seed_output_ids,
    readJson('../src/configurations/buildings-endogenous.json').app_metadata.seed_output_ids,
  );
  assert.ok(!('included_output_ids' in (parsed.app_metadata ?? {})));
});

test('configuration loader prefers the canonical filename when duplicate config ids exist', async () => {
  const { parseConfigurationCollection } = await loadViteModule('/src/data/configurationLoader.ts');
  const canonicalConfig = readJson('../src/configurations/user/buildings-dlg.json');
  const duplicateConfig = structuredClone(canonicalConfig);

  duplicateConfig.service_controls.residential_building_services = {
    mode: 'optimize',
    state_id: null,
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

test('editing a loaded user configuration marks the workspace dirty for Save overwrite', async () => {
  const { usePackageStore } = await loadViteModule('/src/data/packageStore.ts');
  const { loadUserConfigurations } = await loadViteModule('/src/data/configurationLoader.ts');
  const userConfiguration = loadUserConfigurations()[0];

  assert.ok(userConfiguration, 'expected at least one bundled user configuration fixture');

  usePackageStore.getState().loadConfiguration(userConfiguration);

  assert.equal(usePackageStore.getState().activeConfigurationReadonly, false);
  assert.equal(usePackageStore.getState().isConfigurationDirty, false);

  const currentPresetId = usePackageStore.getState().currentConfiguration.demand_generation.preset_id;
  const nextPresetId = Object.keys(appConfig.demand_growth_presets)
    .find((presetId) => presetId !== currentPresetId);

  assert.ok(nextPresetId, 'expected an alternate demand preset for the dirty-state regression test');

  usePackageStore.getState().setDemandPreset(nextPresetId);

  assert.equal(usePackageStore.getState().isConfigurationDirty, true);
  assert.equal(usePackageStore.getState().activeConfigurationId, userConfiguration.app_metadata.id);
  assert.equal(usePackageStore.getState().activeConfigurationReadonly, false);
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
