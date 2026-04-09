import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolveScenarioDocument } from '../src/data/demandResolution.ts';

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
const configDir = new URL('../src/configurations/', import.meta.url);
const configFiles = readdirSync(configDir)
  .filter((name) => name.endsWith('.json') && !name.startsWith('_'))
  .sort();

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

    assert.ok(!('id' in config), `${file} should not keep legacy top-level id`);
    assert.ok(!('readonly' in config), `${file} should not keep legacy top-level readonly`);
    assert.ok(!('includedOutputIds' in config), `${file} should not keep legacy includedOutputIds`);
    assert.ok(!('serviceControls' in config), `${file} should not keep legacy serviceControls`);
    assert.ok(!('solverOptions' in config), `${file} should not keep legacy solverOptions`);

    resolveScenarioDocument(config, appConfig, file);
  }
});
