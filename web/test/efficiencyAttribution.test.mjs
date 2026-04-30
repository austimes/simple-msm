import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEfficiencyAttributionRows } from '../src/results/efficiencyAttribution.ts';
import { buildSolverContributionRows } from '../src/results/resultContributions.ts';
import {
  INCUMBENT_STATE_IDS,
  loadPkg,
  solveScoped,
} from './solverTestUtils.mjs';

const COMMERCIAL_OUTPUT_ID = 'commercial_building_services';
const COMMERCIAL_INCUMBENT_STATE_ID = INCUMBENT_STATE_IDS[COMMERCIAL_OUTPUT_ID];
const COMMERCIAL_HVAC_PACKAGE_ID = 'buildings__commercial__hvac_tuning_bms';
const COMMERCIAL_LIGHTING_PACKAGE_ID = 'buildings__commercial__lighting_retrofit';

function buildContribution({
  metric = 'fuel',
  value,
  outputId = 'heat',
  outputLabel = 'Heat',
  year = 2030,
  rowId,
  sourceId,
  pathwayMethodId,
  provenance,
  efficiencyAttributionComponents,
}) {
  return {
    metric,
    year,
    value,
    sourceKind: 'solver',
    rowId,
    outputId,
    outputLabel,
    sourceId,
    sourceLabel: sourceId,
    pathwayMethodId,
    pathwayMethodLabel: pathwayMethodId,
    provenance,
    sectorId: 'industry',
    sectorLabel: 'Industry',
    subsectorId: outputId,
    subsectorLabel: outputLabel,
    commodityId: metric === 'fuel' ? 'natural_gas' : null,
    costComponent: metric === 'cost' ? 'commodity' : null,
    efficiencyAttributionComponents,
    overlayId: null,
    overlayDomain: null,
  };
}

function valueFor(rows, category, metric = 'fuel', year = 2030) {
  return rows.find((row) => (
    row.metric === metric && row.year === year && row.category === category
  ))?.value ?? 0;
}

function assertApprox(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test('package rows split inherited autonomous provenance from package effects', () => {
  const base = [
    buildContribution({
      value: 10,
      rowId: 'heat::2030',
      sourceId: 'generic_industrial_heat__low_temperature_heat__fossil',
      pathwayMethodId: 'generic_industrial_heat__low_temperature_heat__fossil',
      provenance: {
        kind: 'base_state',
        familyId: 'low_temperature_heat',
        baseMethodId: 'generic_industrial_heat__low_temperature_heat__fossil',
        baseMethodLabel: 'Fossil heat',
        baseRowId: 'heat::2030',
        autonomousTrackIds: ['background_drift'],
      },
    }),
  ];
  const focus = [
    buildContribution({
      value: 7,
      rowId: 'effpkg:heat::retrofit::2030',
      sourceId: 'effpkg:generic_industrial_heat__low_temperature_heat__fossil::retrofit',
      pathwayMethodId: 'generic_industrial_heat__low_temperature_heat__fossil',
      provenance: {
        kind: 'efficiency_package',
        familyId: 'low_temperature_heat',
        baseMethodId: 'generic_industrial_heat__low_temperature_heat__fossil',
        baseMethodLabel: 'Fossil heat',
        baseRowId: 'heat::2030',
        autonomousTrackIds: ['background_drift'],
        packageId: 'retrofit',
        packageClassification: 'pure_efficiency_overlay',
      },
      efficiencyAttributionComponents: {
        autonomous_efficiency: -1,
        pure_efficiency_package: -2,
      },
    }),
  ];

  const rows = buildEfficiencyAttributionRows(base, focus);

  assert.deepEqual(rows, [
    {
      metric: 'fuel',
      year: 2030,
      category: 'autonomous_efficiency',
      value: -1,
    },
    {
      metric: 'fuel',
      year: 2030,
      category: 'pure_efficiency_package',
      value: -2,
    },
  ]);
});

test('when the base already has autonomous efficiency, focus package attribution excludes autonomous rollover', () => {
  const autonomousProvenance = {
    kind: 'base_state',
    familyId: 'low_temperature_heat',
    baseMethodId: 'generic_industrial_heat__low_temperature_heat__fossil',
    baseMethodLabel: 'Fossil heat',
    baseRowId: 'heat::2030',
    autonomousTrackIds: ['background_drift'],
  };
  const base = [
    buildContribution({
      value: 9,
      rowId: 'heat::2030',
      sourceId: 'generic_industrial_heat__low_temperature_heat__fossil',
      pathwayMethodId: 'generic_industrial_heat__low_temperature_heat__fossil',
      provenance: autonomousProvenance,
      efficiencyAttributionComponents: {
        autonomous_efficiency: -1,
      },
    }),
  ];
  const focus = [
    buildContribution({
      value: 7,
      rowId: 'effpkg:heat::retrofit::2030',
      sourceId: 'effpkg:generic_industrial_heat__low_temperature_heat__fossil::retrofit',
      pathwayMethodId: 'generic_industrial_heat__low_temperature_heat__fossil',
      provenance: {
        ...autonomousProvenance,
        kind: 'efficiency_package',
        packageId: 'retrofit',
        packageClassification: 'operational_efficiency_overlay',
      },
      efficiencyAttributionComponents: {
        autonomous_efficiency: -1,
        operational_efficiency_package: -2,
      },
    }),
  ];

  const rows = buildEfficiencyAttributionRows(base, focus);

  assert.deepEqual(rows, [
    {
      metric: 'fuel',
      year: 2030,
      category: 'operational_efficiency_package',
      value: -2,
    },
  ]);
});

test('autonomous track deltas stay in the autonomous category', () => {
  const base = [
    buildContribution({
      value: 10,
      rowId: 'heat::2030',
      sourceId: 'road_transport__passenger_road__ice_fleet',
      pathwayMethodId: 'road_transport__passenger_road__ice_fleet',
      provenance: {
        kind: 'base_state',
        familyId: 'passenger_road_transport',
        baseMethodId: 'road_transport__passenger_road__ice_fleet',
        baseMethodLabel: 'ICE fleet',
        baseRowId: 'heat::2030',
        autonomousTrackIds: [],
      },
    }),
  ];
  const focus = [
    buildContribution({
      value: 9,
      rowId: 'heat::2030',
      sourceId: 'road_transport__passenger_road__ice_fleet',
      pathwayMethodId: 'road_transport__passenger_road__ice_fleet',
      provenance: {
        kind: 'base_state',
        familyId: 'passenger_road_transport',
        baseMethodId: 'road_transport__passenger_road__ice_fleet',
        baseMethodLabel: 'ICE fleet',
        baseRowId: 'heat::2030',
        autonomousTrackIds: ['background_new_vehicle_efficiency_drift'],
      },
      efficiencyAttributionComponents: {
        autonomous_efficiency: -1,
      },
    }),
  ];

  const rows = buildEfficiencyAttributionRows(base, focus);

  assert.deepEqual(rows, [
    {
      metric: 'fuel',
      year: 2030,
      category: 'autonomous_efficiency',
      value: -1,
    },
  ]);
});

function buildCommercialConfiguration(pkg, {
  autonomousMode,
  packageIds = [],
}) {
  const defaultConfiguration = pkg.defaultConfiguration;
  const referenceConfiguration = {
    ...defaultConfiguration,
    service_controls: {
      ...defaultConfiguration.service_controls,
      [COMMERCIAL_OUTPUT_ID]: {
        mode: 'optimize',
        active_state_ids: [COMMERCIAL_INCUMBENT_STATE_ID],
      },
    },
    efficiency_controls: {
      autonomous_mode: autonomousMode,
      package_mode: packageIds.length > 0 ? 'allow_list' : 'off',
      package_ids: packageIds,
    },
  };

  return referenceConfiguration;
}

function solveCommercialContributions(pkg, configuration) {
  const snapshot = solveScoped(pkg, configuration, [COMMERCIAL_OUTPUT_ID]);
  assert.equal(snapshot.result.status, 'solved');
  return buildSolverContributionRows(snapshot.request, snapshot.result);
}

test('commercial building efficiency attribution keeps autonomous and package fuel effects separate in 2050', () => {
  const pkg = loadPkg();
  const baseContributions = solveCommercialContributions(
    pkg,
    buildCommercialConfiguration(pkg, { autonomousMode: 'off' }),
  );
  const autonomousContributions = solveCommercialContributions(
    pkg,
    buildCommercialConfiguration(pkg, { autonomousMode: 'baseline' }),
  );
  const hvacContributions = solveCommercialContributions(
    pkg,
    buildCommercialConfiguration(pkg, {
      autonomousMode: 'baseline',
      packageIds: [COMMERCIAL_HVAC_PACKAGE_ID],
    }),
  );
  const lightingContributions = solveCommercialContributions(
    pkg,
    buildCommercialConfiguration(pkg, {
      autonomousMode: 'baseline',
      packageIds: [COMMERCIAL_LIGHTING_PACKAGE_ID],
    }),
  );

  const autonomousRows = buildEfficiencyAttributionRows(baseContributions, autonomousContributions);
  const hvacRows = buildEfficiencyAttributionRows(baseContributions, hvacContributions);
  const lightingRows = buildEfficiencyAttributionRows(baseContributions, lightingContributions);

  assertApprox(valueFor(autonomousRows, 'autonomous_efficiency', 'fuel', 2050), -32.954392);
  assertApprox(valueFor(hvacRows, 'autonomous_efficiency', 'fuel', 2050), -32.954392);
  assertApprox(valueFor(hvacRows, 'operational_efficiency_package', 'fuel', 2050), -4.242605);
  assertApprox(valueFor(lightingRows, 'autonomous_efficiency', 'fuel', 2050), -32.954392);
  assertApprox(valueFor(lightingRows, 'pure_efficiency_package', 'fuel', 2050), -6.383547);
});

test('embodied pathway transitions absorb the untagged incumbent delta after cleanup', () => {
  const base = [
    buildContribution({
      value: 10,
      rowId: 'diesel::2030',
      sourceId: 'road_transport__freight_road__diesel',
      pathwayMethodId: 'road_transport__freight_road__diesel',
      provenance: {
        kind: 'base_state',
        familyId: 'freight_road_transport',
        baseMethodId: 'road_transport__freight_road__diesel',
        baseMethodLabel: 'Diesel',
        baseRowId: 'diesel::2030',
        autonomousTrackIds: [],
      },
    }),
  ];
  const focus = [
    buildContribution({
      value: 2,
      rowId: 'efficient_diesel::2030',
      sourceId: 'road_transport__freight_road__efficient_diesel',
      pathwayMethodId: 'road_transport__freight_road__efficient_diesel',
      provenance: {
        kind: 'base_state',
        familyId: 'freight_road_transport',
        baseMethodId: 'road_transport__freight_road__efficient_diesel',
        baseMethodLabel: 'Efficient diesel',
        baseRowId: 'efficient_diesel::2030',
        autonomousTrackIds: [],
      },
    }),
  ];

  const rows = buildEfficiencyAttributionRows(base, focus);

  assert.deepEqual(rows, [
    {
      metric: 'fuel',
      year: 2030,
      category: 'embodied_efficiency',
      value: -8,
    },
  ]);
});
