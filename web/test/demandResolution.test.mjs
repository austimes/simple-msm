import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolveConfigurationDocument } from '../src/data/demandResolution.ts';

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
const referenceConfiguration = readJson('../src/configurations/reference-baseline.json');

test('reference configuration demand metadata reproduces the stored demand tables', () => {
  const resolved = resolveConfigurationDocument(referenceConfiguration, appConfig, 'reference-baseline.json');

  // Originally-stored service demand tables must round-trip exactly.
  for (const [id, table] of Object.entries(referenceConfiguration.service_demands)) {
    assert.deepEqual(resolved.service_demands[id], table, `service_demands.${id} mismatch`);
  }

  // The resolver may add zero-demand tables for services that exist in the
  // package but had no demand configured (e.g. land_sequestration). Verify any
  // extra keys are all-zero.
  for (const [id, table] of Object.entries(resolved.service_demands)) {
    if (!(id in referenceConfiguration.service_demands)) {
      const values = Object.values(table);
      assert.ok(values.length > 0, `zero-demand table ${id} should have year entries`);
      assert.ok(values.every((v) => v === 0), `extra service_demands.${id} should be all zeros`);
    }
  }

  assert.deepEqual(
    resolved.external_commodity_demands,
    referenceConfiguration.external_commodity_demands,
  );
  assert.equal(
    appConfig.demand_growth_presets[resolved.demand_generation.preset_id].provenance_note,
    'App-owned convenience preset. Not part of the research library evidence.',
  );
});

test('manual-table configurations normalize every milestone year the solver consumes', () => {
  const manualConfiguration = {
    ...structuredClone(referenceConfiguration),
    years: [2025, 2030],
    service_demands: {
      residential_building_services: {
        2025: 10,
      },
    },
    external_commodity_demands: {
      electricity: {
        2030: 5,
      },
    },
    demand_generation: {
      mode: 'manual_table',
      anchor_year: 2025,
      preset_id: null,
      service_anchors: {},
      notes: 'Manual demand entry for regression coverage.',
    },
  };

  const resolved = resolveConfigurationDocument(manualConfiguration, appConfig, 'manual configuration');

  assert.deepEqual(resolved.service_demands.residential_building_services, {
    2025: 10,
    2030: 0,
  });
  assert.deepEqual(resolved.service_demands.commercial_building_services, {
    2025: 0,
    2030: 0,
  });
  assert.deepEqual(resolved.external_commodity_demands.electricity, {
    2025: 0,
    2030: 5,
  });
});

test('anchor-plus-preset-with-overrides merges baseline anchors, overrides, and year edits', () => {
  const overrideConfiguration = {
    ...structuredClone(referenceConfiguration),
    years: [2025, 2030, 2035],
    service_demands: {},
    external_commodity_demands: {},
    demand_generation: {
      ...structuredClone(referenceConfiguration.demand_generation),
      mode: 'anchor_plus_preset_with_overrides',
      service_anchors: {
        residential_building_services: 100,
      },
      service_growth_rates_pct_per_year: {
        residential_building_services: 2,
      },
      external_commodity_anchors: {
        electricity: 50,
      },
      external_commodity_growth_rates_pct_per_year: {
        electricity: 1,
      },
      year_overrides: {
        2035: {
          residential_building_services: 130,
          electricity: 70,
        },
      },
    },
  };

  const resolved = resolveConfigurationDocument(overrideConfiguration, appConfig, 'override configuration');

  assert.deepEqual(resolved.service_demands.residential_building_services, {
    2025: 100,
    2030: 110,
    2035: 130,
  });
  assert.deepEqual(resolved.external_commodity_demands.electricity, {
    2025: 50,
    2030: 53,
    2035: 70,
  });
  assert.equal(
    resolved.demand_generation.service_growth_rates_pct_per_year.residential_building_services,
    2,
  );
});
