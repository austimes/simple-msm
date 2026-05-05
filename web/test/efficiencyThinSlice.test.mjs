import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveConfigurationDocument } from '../src/data/demandResolution.ts';
import { loadPackage } from '../src/data/packageLoader.ts';
import { runScenario } from '../src/results/runScenario.ts';
import { materializeServiceControlsFromRoleControls } from './roleControlTestUtils.mjs';

const RESIDENTIAL_OUTPUT_ID = 'residential_building_services';
const RESIDENTIAL_INCUMBENT_STATE_ID = 'buildings__residential__incumbent_mixed_fuels';
const RESIDENTIAL_PACKAGE_ID = 'buildings__residential__thermal_shell_retrofit';
const MILESTONE_YEARS = [2025, 2030, 2035, 2040, 2045, 2050];

const EXPECTED_AUTONOMOUS_TRACK_IDS = [
  'buildings__commercial__background_standards_drift',
  'buildings__residential__background_standards_drift',
  'cement__cement_equivalent__background_kiln_grinding_drift',
  'road_transport__freight_road__background_diesel_efficiency_drift',
  'road_transport__passenger_road__background_new_vehicle_efficiency_drift',
  'steel__crude_steel__bf_bof_background_drift',
];

const EXPECTED_PACKAGE_IDS = [
  'buildings__commercial__hvac_tuning_bms',
  'buildings__commercial__lighting_retrofit',
  'buildings__residential__thermal_shell_retrofit',
  'cement__cement_equivalent__grinding_system_upgrade',
  'cement__cement_equivalent__kiln_ai_process_optimisation',
  'electricity__grid_supply__thermal_auxiliary_load_tuning',
  'road_transport__freight_road__fleet_telematics_eco_driving',
  'steel__crude_steel__advanced_process_control',
  'steel__crude_steel__bf_bof_bof_gas_recovery',
  'steel__crude_steel__scrap_eaf_scrap_preheating',
];

function expectCompleteMilestoneCoverage(rows, idField, ids) {
  for (const id of ids) {
    const years = rows
      .filter((row) => row[idField] === id)
      .map((row) => row.year)
      .sort((left, right) => left - right);
    assert.deepEqual(years, MILESTONE_YEARS, `expected complete milestone coverage for ${id}`);
  }
}

function buildThinSliceConfiguration(pkg) {
  const configuration = materializeServiceControlsFromRoleControls(
    structuredClone(pkg.defaultConfiguration),
    { resolvedMethodYears: pkg.resolvedMethodYears },
  );

  for (const outputId of Object.keys(pkg.appConfig.output_roles)) {
    if (outputId === 'electricity') {
      configuration.service_controls[outputId] = { mode: 'externalized' };
      continue;
    }

    configuration.service_controls[outputId] = {
      ...(configuration.service_controls[outputId] ?? { mode: 'optimize' }),
      active_state_ids: [],
    };
  }

  configuration.service_controls[RESIDENTIAL_OUTPUT_ID] = {
    mode: 'optimize',
    active_state_ids: [RESIDENTIAL_INCUMBENT_STATE_ID],
  };
  configuration.efficiency_controls = {
    autonomous_mode: 'baseline',
    package_mode: 'allow_list',
    package_ids: [RESIDENTIAL_PACKAGE_ID],
  };
  configuration.name = 'Efficiency thin slice test';
  configuration.description = 'Residential buildings with authored efficiency artifacts enabled.';

  return resolveConfigurationDocument(configuration, pkg.appConfig, configuration.name);
}

test('loadPackage picks up the canonical efficiency thin slice and existing validation outputs', () => {
  const pkg = loadPackage();

  assert.ok(
    pkg.efficiencyPackages.some((row) => row.package_id === RESIDENTIAL_PACKAGE_ID),
    'expected the residential efficiency package to be present in the canonical package',
  );
  assert.ok(pkg.commodityBalance2025.length > 0, 'expected baseline commodity validation outputs to remain available');
  assert.ok(pkg.emissionsBalance2025.length > 0, 'expected baseline emissions validation outputs to remain available');
});

test('loadPackage exposes the full first-wave canonical efficiency inventory', () => {
  const pkg = loadPackage();

  assert.deepEqual(
    Array.from(new Set(pkg.autonomousEfficiencyTracks.map((row) => row.track_id))).sort(),
    EXPECTED_AUTONOMOUS_TRACK_IDS,
  );
  assert.deepEqual(
    Array.from(new Set(pkg.efficiencyPackages.map((row) => row.package_id))).sort(),
    EXPECTED_PACKAGE_IDS,
  );
  assert.equal(
    pkg.autonomousEfficiencyTracks.length,
    EXPECTED_AUTONOMOUS_TRACK_IDS.length * MILESTONE_YEARS.length,
  );
  assert.equal(
    pkg.efficiencyPackages.length,
    EXPECTED_PACKAGE_IDS.length * MILESTONE_YEARS.length,
  );

  expectCompleteMilestoneCoverage(pkg.autonomousEfficiencyTracks, 'track_id', EXPECTED_AUTONOMOUS_TRACK_IDS);
  expectCompleteMilestoneCoverage(pkg.efficiencyPackages, 'package_id', EXPECTED_PACKAGE_IDS);
});

test('the real efficiency thin slice loads, solves, and carries attribution provenance end to end', () => {
  const pkg = loadPackage();
  const configuration = buildThinSliceConfiguration(pkg);
  const snapshot = runScenario(pkg, configuration);

  assert.equal(snapshot.result.status, 'solved');

  const residentialPackageMethodId = `effpkg:${RESIDENTIAL_INCUMBENT_STATE_ID}::${RESIDENTIAL_PACKAGE_ID}`;
  const residentialPackageShare2050 = snapshot.result.reporting.methodShares.find((row) => {
    return row.year === 2050 && row.outputId === RESIDENTIAL_OUTPUT_ID && row.methodId === residentialPackageMethodId;
  });
  assert.ok(residentialPackageShare2050, 'expected a residential package state-share row in 2050');
  assert.ok((residentialPackageShare2050.activity ?? 0) > 0, 'expected the residential package to carry activity in the thin slice');
  assert.equal(residentialPackageShare2050.provenance?.kind, 'efficiency_package');
  assert.equal(residentialPackageShare2050.provenance?.packageId, RESIDENTIAL_PACKAGE_ID);
});
