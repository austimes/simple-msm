import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveConfigurationDocument } from '../src/data/demandResolution.ts';
import { loadPackage } from '../src/data/packageLoader.ts';
import { runScenario } from '../src/results/runScenario.ts';

const RESIDENTIAL_OUTPUT_ID = 'residential_building_services';
const LOW_TEMPERATURE_OUTPUT_ID = 'low_temperature_heat';
const RESIDENTIAL_INCUMBENT_STATE_ID = 'buildings__residential__incumbent_mixed_fuels';
const LOW_TEMPERATURE_INCUMBENT_STATE_ID = 'generic_industrial_heat__low_temperature_heat__fossil';
const RESIDENTIAL_PACKAGE_ID = 'buildings__residential__thermal_shell_retrofit';
const LOW_TEMPERATURE_TRACK_ID = 'industrial_heat__low_temperature__background_thermal_drift';
const LOW_TEMPERATURE_PACKAGE_ID = 'industrial_heat__low_temperature__thermal_system_retrofit';

function buildThinSliceConfiguration(pkg) {
  const configuration = structuredClone(pkg.defaultConfiguration);

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
  configuration.service_controls[LOW_TEMPERATURE_OUTPUT_ID] = {
    mode: 'optimize',
    active_state_ids: [LOW_TEMPERATURE_INCUMBENT_STATE_ID],
  };
  configuration.efficiency_controls = {
    autonomous_mode: 'baseline',
    package_mode: 'allow_list',
    package_ids: [RESIDENTIAL_PACKAGE_ID, LOW_TEMPERATURE_PACKAGE_ID],
  };
  configuration.name = 'Efficiency thin slice test';
  configuration.description = 'Residential buildings plus low-temperature industrial heat with authored efficiency artifacts enabled.';

  return resolveConfigurationDocument(configuration, pkg.appConfig, configuration.name);
}

test('loadPackage picks up the canonical efficiency thin slice and existing validation outputs', () => {
  const pkg = loadPackage();

  assert.ok(
    pkg.autonomousEfficiencyTracks.some((row) => row.track_id === LOW_TEMPERATURE_TRACK_ID),
    'expected the low-temperature autonomous track to be present in the canonical package',
  );
  assert.ok(
    pkg.efficiencyPackages.some((row) => row.package_id === RESIDENTIAL_PACKAGE_ID),
    'expected the residential efficiency package to be present in the canonical package',
  );
  assert.ok(
    pkg.efficiencyPackages.some((row) => row.package_id === LOW_TEMPERATURE_PACKAGE_ID),
    'expected the low-temperature efficiency package to be present in the canonical package',
  );
  assert.ok(pkg.commodityBalance2025.length > 0, 'expected baseline commodity validation outputs to remain available');
  assert.ok(pkg.emissionsBalance2025.length > 0, 'expected baseline emissions validation outputs to remain available');
});

test('the real efficiency thin slice loads, solves, and carries attribution provenance end to end', () => {
  const pkg = loadPackage();
  const configuration = buildThinSliceConfiguration(pkg);
  const snapshot = runScenario(pkg, configuration);

  assert.equal(snapshot.result.status, 'solved');

  const lowTemperatureBase2030 = snapshot.request.rows.find(
    (row) => row.rowId === `${LOW_TEMPERATURE_INCUMBENT_STATE_ID}::2030`,
  );
  assert.ok(lowTemperatureBase2030, 'expected the low-temperature fossil base row in the request');
  assert.deepEqual(lowTemperatureBase2030.provenance?.autonomousTrackIds, [LOW_TEMPERATURE_TRACK_ID]);

  const gasInput2030 = lowTemperatureBase2030.inputs.find((input) => input.commodityId === 'natural_gas');
  assert.ok(gasInput2030, 'expected low-temperature fossil gas input to be present');
  assert.ok(Math.abs(gasInput2030.coefficient - 1.08) < 1e-6);

  const lowTemperatureEmissions2030 = lowTemperatureBase2030.directEmissions.find((entry) => entry.source === 'energy');
  assert.ok(lowTemperatureEmissions2030, 'expected low-temperature fossil combustion emissions to be present');
  assert.ok(Math.abs(lowTemperatureEmissions2030.value - 0.0556524) < 1e-6);

  const residentialPackageStateId = `effpkg:${RESIDENTIAL_INCUMBENT_STATE_ID}::${RESIDENTIAL_PACKAGE_ID}`;
  const residentialPackageShare2050 = snapshot.result.reporting.stateShares.find((row) => {
    return row.year === 2050 && row.outputId === RESIDENTIAL_OUTPUT_ID && row.stateId === residentialPackageStateId;
  });
  assert.ok(residentialPackageShare2050, 'expected a residential package state-share row in 2050');
  assert.ok((residentialPackageShare2050.activity ?? 0) > 0, 'expected the residential package to carry activity in the thin slice');
  assert.equal(residentialPackageShare2050.provenance?.kind, 'efficiency_package');
  assert.equal(residentialPackageShare2050.provenance?.packageId, RESIDENTIAL_PACKAGE_ID);

  const lowTemperaturePackageStateId = `effpkg:${LOW_TEMPERATURE_INCUMBENT_STATE_ID}::${LOW_TEMPERATURE_PACKAGE_ID}`;
  const lowTemperaturePackageFuelContribution = snapshot.contributions.find((row) => {
    return row.metric === 'fuel' && row.year === 2050 && row.sourceId === lowTemperaturePackageStateId;
  });
  assert.ok(lowTemperaturePackageFuelContribution, 'expected a low-temperature package fuel contribution row in 2050');
  assert.equal(lowTemperaturePackageFuelContribution.provenance?.kind, 'efficiency_package');
  assert.equal(lowTemperaturePackageFuelContribution.provenance?.packageId, LOW_TEMPERATURE_PACKAGE_ID);
  assert.deepEqual(lowTemperaturePackageFuelContribution.provenance?.autonomousTrackIds, [LOW_TEMPERATURE_TRACK_ID]);
});
