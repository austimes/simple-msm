import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isEfficiencyAttributionSafePair } from '../src/data/configurationPairModel.ts';
import { materializeServiceControlsFromRoleControls } from '../src/data/configurationRoleControls.ts';
import { resolveConfigurationDocument } from '../src/data/demandResolution.ts';
import { loadPackage } from '../src/data/packageLoader.ts';
import { runScenario } from '../src/results/runScenario.ts';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';

const CONFIG_EXPECTATIONS = [
  {
    id: 'reference-baseline',
    autonomousMode: 'baseline',
    packageMode: 'off',
  },
  {
    id: 'reference-efficiency-open',
    autonomousMode: 'baseline',
    packageMode: 'all',
  },
  {
    id: 'reference-efficiency-off',
    autonomousMode: 'off',
    packageMode: 'off',
  },
];

const DEMO_EXPECTATIONS = [
  {
    id: 'demo-buildings-efficiency',
    packageIds: [
      'buildings__commercial__hvac_tuning_bms',
      'buildings__commercial__lighting_retrofit',
      'buildings__residential__thermal_shell_retrofit',
      'electricity__grid_supply__thermal_auxiliary_load_tuning',
    ],
    controls: {
      electricity: {
        mode: 'optimize',
        activeStateIds: [
          'electricity__grid_supply__incumbent_thermal_mix',
          'electricity__grid_supply__policy_frontier',
          'electricity__grid_supply__deep_clean_firmed',
        ],
      },
      residential_building_services: {
        mode: 'optimize',
        activeStateIds: [
          'buildings__residential__incumbent_mixed_fuels',
          'buildings__residential__electrified_efficiency',
          'buildings__residential__deep_electric',
        ],
      },
      commercial_building_services: {
        mode: 'optimize',
        activeStateIds: [
          'buildings__commercial__incumbent_mixed_fuels',
          'buildings__commercial__electrified_efficiency',
          'buildings__commercial__deep_electric',
        ],
      },
    },
  },
  {
    id: 'demo-freight-efficiency',
    packageIds: [
      'road_transport__freight_road__fleet_telematics_eco_driving',
    ],
    controls: {
      electricity: {
        mode: 'externalized',
      },
      freight_road_transport: {
        mode: 'optimize',
        activeStateIds: [
          'road_transport__freight_road__diesel',
          'road_transport__freight_road__efficient_diesel',
        ],
      },
    },
  },
  {
    id: 'demo-industrial-heat-efficiency',
    packageIds: [
      'electricity__grid_supply__thermal_auxiliary_load_tuning',
      'industrial_heat__high_temperature__combustion_heat_recovery',
      'industrial_heat__high_temperature__controls_tuning',
      'industrial_heat__low_temperature__controls_tuning',
      'industrial_heat__low_temperature__thermal_system_retrofit',
      'industrial_heat__medium_temperature__controls_tuning',
      'industrial_heat__medium_temperature__thermal_system_retrofit',
    ],
    controls: {
      electricity: {
        mode: 'optimize',
        activeStateIds: [
          'electricity__grid_supply__incumbent_thermal_mix',
          'electricity__grid_supply__policy_frontier',
          'electricity__grid_supply__deep_clean_firmed',
        ],
      },
      low_temperature_heat: {
        mode: 'optimize',
        activeStateIds: [
          'generic_industrial_heat__low_temperature_heat__fossil',
          'generic_industrial_heat__low_temperature_heat__electrified',
          'generic_industrial_heat__low_temperature_heat__low_carbon_fuels',
        ],
      },
      medium_temperature_heat: {
        mode: 'optimize',
        activeStateIds: [
          'generic_industrial_heat__medium_temperature_heat__fossil',
          'generic_industrial_heat__medium_temperature_heat__electrified',
          'generic_industrial_heat__medium_temperature_heat__low_carbon_fuels',
        ],
      },
      high_temperature_heat: {
        mode: 'optimize',
        activeStateIds: [
          'generic_industrial_heat__high_temperature_heat__fossil',
          'generic_industrial_heat__high_temperature_heat__electrified',
          'generic_industrial_heat__high_temperature_heat__low_carbon_fuels',
        ],
      },
    },
  },
  {
    id: 'demo-heavy-industry-efficiency',
    packageIds: [
      'cement__cement_equivalent__grinding_system_upgrade',
      'cement__cement_equivalent__kiln_ai_process_optimisation',
      'electricity__grid_supply__thermal_auxiliary_load_tuning',
      'steel__crude_steel__advanced_process_control',
      'steel__crude_steel__bf_bof_bof_gas_recovery',
      'steel__crude_steel__scrap_eaf_scrap_preheating',
    ],
    controls: {
      electricity: {
        mode: 'optimize',
        activeStateIds: [
          'electricity__grid_supply__incumbent_thermal_mix',
          'electricity__grid_supply__policy_frontier',
          'electricity__grid_supply__deep_clean_firmed',
        ],
      },
      crude_steel: {
        mode: 'optimize',
        activeStateIds: [
          'steel__crude_steel__bf_bof_conventional',
          'steel__crude_steel__bf_bof_ccs_transition',
          'steel__crude_steel__scrap_eaf',
          'steel__crude_steel__h2_dri_electric',
        ],
      },
      cement_equivalent: {
        mode: 'optimize',
        activeStateIds: [
          'cement_clinker__cement_equivalent__conventional',
          'cement_clinker__cement_equivalent__low_clinker_alt_fuels',
          'cement_clinker__cement_equivalent__ccs_deep',
        ],
      },
    },
  },
];

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

function loadConfiguration(pkg, id) {
  return materializeServiceControlsFromRoleControls(
    resolveConfigurationDocument(
      readJson(`../src/configurations/${id}.json`),
      pkg.appConfig,
      id,
    ),
    { sectorStates: pkg.sectorStates },
  );
}

function stripScenarioIdentity(configuration) {
  const normalized = structuredClone(configuration);
  delete normalized.name;
  delete normalized.description;
  delete normalized.efficiency_controls;
  delete normalized.app_metadata;
  return normalized;
}

function assertDemoControls(configuration, controls, pkg) {
  for (const [outputId, control] of Object.entries(configuration.service_controls)) {
    const expected = controls[outputId];
    if (!expected) {
      const familyMetadata = pkg.familyMetadata.find((family) => family.family_id === outputId);
      if (familyMetadata?.family_resolution === 'residual_stub') {
        assert.equal(control.mode, 'optimize', `${outputId} residual family should stay in optimize mode`);
        if (outputId === 'residual_lulucf_sink') {
          assert.deepEqual(control.active_state_ids, [], `${outputId} should remain optional by default`);
        } else {
          assert.deepEqual(
            control.active_state_ids,
            [`${outputId}__residual_incumbent`],
            `${outputId} should keep its residual incumbent closure route`,
          );
        }
        continue;
      }

      assert.equal(control.mode, 'optimize', `${outputId} should stay in optimize mode when inactive`);
      assert.deepEqual(control.active_state_ids, [], `${outputId} should be inactive`);
      continue;
    }

    assert.equal(control.mode, expected.mode, `${outputId} should use the expected mode`);
    if ('activeStateIds' in expected) {
      assert.deepEqual(control.active_state_ids, expected.activeStateIds, `${outputId} should keep the authored state scope`);
    } else {
      assert.equal('active_state_ids' in control, false, `${outputId} should not carry active states when externalized`);
    }
  }
}

test('core reference efficiency configs share one scenario backbone and solve under their authored efficiency modes', () => {
  const pkg = loadPackage();
  const configurations = CONFIG_EXPECTATIONS.map((expectation) => ({
    ...expectation,
    configuration: loadConfiguration(pkg, expectation.id),
  }));
  const baselineScenario = stripScenarioIdentity(configurations[0].configuration);
  const allTrackIds = Array.from(
    new Set(pkg.autonomousEfficiencyTracks.map((track) => track.track_id)),
  ).sort((left, right) => left.localeCompare(right));
  const allPackageIds = Array.from(
    new Set(pkg.efficiencyPackages.map((row) => row.package_id)),
  ).sort((left, right) => left.localeCompare(right));

  for (const entry of configurations) {
    assert.deepEqual(stripScenarioIdentity(entry.configuration), baselineScenario);
    assert.equal(isEfficiencyAttributionSafePair(configurations[0].configuration, entry.configuration), true);

    const request = buildSolveRequest(pkg, entry.configuration);
    assert.equal(request.configuration.efficiency?.autonomousMode, entry.autonomousMode);
    assert.equal(request.configuration.efficiency?.packageMode, entry.packageMode);
    assert.deepEqual(
      request.configuration.efficiency?.activeTrackIds,
      entry.autonomousMode === 'off' ? [] : allTrackIds,
    );
    assert.deepEqual(
      request.configuration.efficiency?.activePackageIds,
      entry.packageMode === 'all' ? allPackageIds : [],
    );

    const snapshot = runScenario(pkg, entry.configuration);
    assert.equal(snapshot.result.status, 'solved', `${entry.id} should solve`);
  }
});

test('efficiency attribution safety fails when the non-efficiency scenario backbone changes', () => {
  const pkg = loadPackage();
  const baseline = loadConfiguration(pkg, 'reference-baseline');
  const changedBackbone = structuredClone(baseline);

  changedBackbone.service_demands.electricity = {
    ...changedBackbone.service_demands.electricity,
    2030: (changedBackbone.service_demands.electricity?.[2030] ?? 0) + 1,
  };

  assert.equal(isEfficiencyAttributionSafePair(baseline, changedBackbone), false);
});

test('focused efficiency demos keep a tight sector scope and solve with only their authored packages', () => {
  const pkg = loadPackage();

  for (const expectation of DEMO_EXPECTATIONS) {
    const configuration = loadConfiguration(pkg, expectation.id);
    assert.equal(configuration.efficiency_controls?.autonomous_mode, 'baseline');
    assert.equal(configuration.efficiency_controls?.package_mode, 'allow_list');
    assert.deepEqual(configuration.efficiency_controls?.package_ids, expectation.packageIds);
    assertDemoControls(configuration, expectation.controls, pkg);

    const request = buildSolveRequest(pkg, configuration);
    assert.equal(request.configuration.efficiency?.autonomousMode, 'baseline');
    assert.equal(request.configuration.efficiency?.packageMode, 'allow_list');
    assert.deepEqual(request.configuration.efficiency?.activePackageIds, expectation.packageIds);

    const snapshot = runScenario(pkg, configuration);
    assert.equal(snapshot.result.status, 'solved', `${expectation.id} should solve`);
  }
});
