import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
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
    loadPersistedConfigurationDraft,
    persistConfigMeta,
    persistConfigurationDraft,
  } = await loadViteModule('/src/data/scenarioDraftStorage.ts');
  const storage = createMemoryStorage();
  const configuration = readJson('../src/configurations/buildings-endogenous.json');

  assert.equal(persistConfigurationDraft(configuration, storage), null);
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

  assert.equal(request.scenario.controlsByOutput.electricity['2025'].mode, 'optimize');
  assert.equal(
    request.scenario.serviceDemandByOutput.residential_building_services['2050'],
    configuration.service_demands.residential_building_services['2050'],
  );
  assert.ok(outputsInRequest.has('residential_building_services'));
  assert.ok(outputsInRequest.has('commercial_building_services'));
  assert.ok(outputsInRequest.has('electricity'));
  assert.ok(!outputsInRequest.has('cement_equivalent'));
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
