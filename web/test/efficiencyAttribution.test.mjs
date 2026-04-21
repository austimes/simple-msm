import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEfficiencyAttributionRows } from '../src/results/efficiencyAttribution.ts';

function buildContribution({
  metric = 'fuel',
  value,
  outputId = 'heat',
  outputLabel = 'Heat',
  year = 2030,
  rowId,
  sourceId,
  pathwayStateId,
  provenance,
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
    pathwayStateId,
    pathwayStateLabel: pathwayStateId,
    provenance,
    sectorId: 'industry',
    sectorLabel: 'Industry',
    subsectorId: outputId,
    subsectorLabel: outputLabel,
    commodityId: metric === 'fuel' ? 'natural_gas' : null,
    costComponent: metric === 'cost' ? 'commodity' : null,
    overlayId: null,
    overlayDomain: null,
  };
}

test('package attribution owns lineages even when package rows inherit autonomous provenance', () => {
  const base = [
    buildContribution({
      value: 10,
      rowId: 'heat::2030',
      sourceId: 'generic_industrial_heat__low_temperature_heat__fossil',
      pathwayStateId: 'generic_industrial_heat__low_temperature_heat__fossil',
      provenance: {
        kind: 'base_state',
        familyId: 'low_temperature_heat',
        baseStateId: 'generic_industrial_heat__low_temperature_heat__fossil',
        baseStateLabel: 'Fossil heat',
        baseRowId: 'heat::2030',
        autonomousTrackIds: ['background_drift'],
      },
    }),
  ];
  const focus = [
    buildContribution({
      value: 8,
      rowId: 'effpkg:heat::retrofit::2030',
      sourceId: 'effpkg:generic_industrial_heat__low_temperature_heat__fossil::retrofit',
      pathwayStateId: 'generic_industrial_heat__low_temperature_heat__fossil',
      provenance: {
        kind: 'efficiency_package',
        familyId: 'low_temperature_heat',
        baseStateId: 'generic_industrial_heat__low_temperature_heat__fossil',
        baseStateLabel: 'Fossil heat',
        baseRowId: 'heat::2030',
        autonomousTrackIds: ['background_drift'],
        packageId: 'retrofit',
        packageClassification: 'pure_efficiency_overlay',
      },
    }),
  ];

  const rows = buildEfficiencyAttributionRows(base, focus);

  assert.deepEqual(rows, [
    {
      metric: 'fuel',
      year: 2030,
      category: 'pure_efficiency_package',
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
      pathwayStateId: 'road_transport__passenger_road__ice_fleet',
      provenance: {
        kind: 'base_state',
        familyId: 'passenger_road_transport',
        baseStateId: 'road_transport__passenger_road__ice_fleet',
        baseStateLabel: 'ICE fleet',
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
      pathwayStateId: 'road_transport__passenger_road__ice_fleet',
      provenance: {
        kind: 'base_state',
        familyId: 'passenger_road_transport',
        baseStateId: 'road_transport__passenger_road__ice_fleet',
        baseStateLabel: 'ICE fleet',
        baseRowId: 'heat::2030',
        autonomousTrackIds: ['background_new_vehicle_efficiency_drift'],
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

test('embodied pathway transitions absorb the untagged incumbent delta after cleanup', () => {
  const base = [
    buildContribution({
      value: 10,
      rowId: 'diesel::2030',
      sourceId: 'road_transport__freight_road__diesel',
      pathwayStateId: 'road_transport__freight_road__diesel',
      provenance: {
        kind: 'base_state',
        familyId: 'freight_road_transport',
        baseStateId: 'road_transport__freight_road__diesel',
        baseStateLabel: 'Diesel',
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
      pathwayStateId: 'road_transport__freight_road__efficient_diesel',
      provenance: {
        kind: 'base_state',
        familyId: 'freight_road_transport',
        baseStateId: 'road_transport__freight_road__efficient_diesel',
        baseStateLabel: 'Efficient diesel',
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
