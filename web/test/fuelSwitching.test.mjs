import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FuelSwitchingChart from '../src/components/charts/FuelSwitchingChart.tsx';
import {
  buildFuelSwitchAttributionRows,
  buildFuelSwitchChartData,
  buildFuelSwitchDecomposition,
  buildFuelSwitchRouteBasisRows,
} from '../src/results/fuelSwitching.ts';
import { SOLVER_CONTRACT_VERSION } from '../src/solver/contract.ts';

function assertApprox(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function buildFuelContribution({
  year = 2030,
  outputId = 'industrial_heat',
  outputLabel = 'Industrial heat',
  commodityId,
  value,
  sourceKind = 'solver',
}) {
  return {
    metric: 'fuel',
    year,
    value,
    sourceKind,
    outputId: sourceKind === 'solver' ? outputId : null,
    outputLabel: sourceKind === 'solver' ? outputLabel : null,
    sourceId: `${outputId}:${commodityId}`,
    sourceLabel: `${outputLabel} ${commodityId}`,
    sectorId: 'industry',
    sectorLabel: 'Industry',
    subsectorId: outputId,
    subsectorLabel: outputLabel,
    commodityId,
    costComponent: null,
    overlayId: sourceKind === 'overlay' ? outputId : null,
    overlayDomain: sourceKind === 'overlay' ? 'energy_residual' : null,
  };
}

function buildFuelTotalRow({
  year = 2030,
  outputId = 'industrial_heat',
  outputLabel = 'Industrial heat',
  fuelId,
  fuelLabel,
  valuePj,
}) {
  return {
    outputId,
    outputLabel,
    year,
    fuelId,
    fuelLabel: fuelLabel ?? {
      coal: 'Coal',
      electricity: 'Electricity',
      hydrogen: 'Hydrogen',
      natural_gas: 'Natural gas',
      refined_liquid_fuels: 'Refined liquid fuels',
    }[fuelId],
    valuePj,
  };
}

function baseProvenance(stateId, stateLabel = stateId) {
  return {
    kind: 'base_state',
    familyId: 'commercial_building_services',
    baseStateId: stateId,
    baseStateLabel: stateLabel,
    baseRowId: `${stateId}::2030`,
    autonomousTrackIds: [],
  };
}

function packageProvenance(baseStateId, packageId, baseStateLabel = baseStateId) {
  return {
    kind: 'efficiency_package',
    familyId: 'commercial_building_services',
    baseStateId,
    baseStateLabel,
    baseRowId: `${baseStateId}::2030`,
    autonomousTrackIds: [],
    packageId,
    packageClassification: 'pure_efficiency_overlay',
  };
}

function buildSolveRow({
  stateId,
  stateLabel = stateId,
  inputs,
  provenance = baseProvenance(stateId, stateLabel),
}) {
  return {
    rowId: `${stateId}::2030`,
    outputId: 'commercial_services',
    outputRole: 'required_service',
    outputLabel: 'Commercial services',
    year: 2030,
    stateId,
    stateLabel,
    sector: 'commercial',
    subsector: 'commercial_buildings',
    region: 'national',
    outputUnit: 'activity',
    conversionCostPerUnit: 0,
    inputs: inputs.map(([commodityId, coefficient]) => ({
      commodityId,
      coefficient,
      unit: 'PJ',
    })),
    directEmissions: [],
    provenance,
    bounds: {
      minShare: null,
      maxShare: null,
      maxActivity: null,
    },
  };
}

function buildSolveRequest(requestId, rows) {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId,
    rows,
    configuration: {
      name: requestId,
      description: null,
      years: [2030],
      controlsByOutput: {
        commercial_services: {
          2030: {
            mode: 'optimize',
            activeStateIds: null,
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        commercial_services: { 2030: 100 },
      },
      externalCommodityDemandByCommodity: {},
      commodityPriceByCommodity: {},
      carbonPriceByYear: { 2030: 0 },
      options: {
        respectMaxShare: true,
        respectMaxActivity: true,
        softConstraints: false,
        shareSmoothing: {
          enabled: false,
          maxDeltaPp: null,
        },
      },
    },
  };
}

function buildSolveResult(request, activeRows) {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: request.requestId,
    status: 'solved',
    engine: { name: 'yalps', worker: true },
    summary: {
      rowCount: request.rows.length,
      yearCount: 1,
      outputCount: 1,
      serviceDemandOutputCount: 1,
      externalCommodityCount: 0,
    },
    reporting: {
      commodityBalances: [],
      stateShares: activeRows.map(({ row, activity }) => ({
        outputId: row.outputId,
        outputLabel: row.outputLabel,
        year: row.year,
        rowId: row.rowId,
        stateId: row.stateId,
        stateLabel: row.stateLabel,
        pathwayStateId: row.provenance?.baseStateId ?? row.stateId,
        pathwayStateLabel: row.provenance?.baseStateLabel ?? row.stateLabel,
        provenance: row.provenance,
        activity,
        share: activity / 100,
        rawMaxShare: null,
        effectiveMaxShare: null,
      })),
      bindingConstraints: [],
      softConstraintViolations: [],
    },
    raw: null,
    diagnostics: [],
    timingsMs: {
      total: 0,
      solve: 0,
    },
  };
}

test('one-to-one electrification uses focus-total mix basis and tracks scale residual', () => {
  const result = buildFuelSwitchDecomposition(
    [buildFuelContribution({ commodityId: 'natural_gas', value: 15 })],
    [buildFuelContribution({ commodityId: 'electricity', value: 10 })],
  );
  const { switchRows: rows } = result;

  assert.equal(rows.length, 1);
  assert.equal(rows[0].fromFuelId, 'natural_gas');
  assert.equal(rows[0].toFuelId, 'electricity');
  assert.equal(rows[0].toBasisPj, 10);
  assert.equal(rows[0].fromBasisPj, 10);
  assert.equal(rows[0].attributionBasis, 'fuel_mix_focus_total');
  assert.deepEqual(
    result.residualRows.map((row) => [row.fuelId, row.effect, row.valuePj]),
    [['natural_gas', 'scale', -5]],
  );
});

test('multi-fuel switching uses proportional attribution and preserves mix basis totals', () => {
  const rows = buildFuelSwitchAttributionRows(
    [
      buildFuelContribution({ commodityId: 'natural_gas', value: 12 }),
      buildFuelContribution({ commodityId: 'coal', value: 8 }),
    ],
    [
      buildFuelContribution({ commodityId: 'electricity', value: 10 }),
      buildFuelContribution({ commodityId: 'hydrogen', value: 4 }),
    ],
  );

  assert.equal(rows.length, 4);
  assertApprox(
    rows.reduce((sum, row) => sum + row.toBasisPj, 0),
    14,
  );
  assertApprox(
    rows.reduce((sum, row) => sum + row.fromBasisPj, 0),
    14,
  );
  assert.deepEqual(
    rows.find((row) => row.fromFuelId === 'natural_gas' && row.toFuelId === 'electricity'),
    {
      key: '2030::industrial_heat::natural_gas::electricity',
      outputId: 'industrial_heat',
      outputLabel: 'Industrial heat',
      year: 2030,
      fromFuelId: 'natural_gas',
      fromFuelLabel: 'Natural gas',
      toFuelId: 'electricity',
      toFuelLabel: 'Electricity',
      toBasisPj: 6,
      fromBasisPj: 6,
      attributionBasis: 'fuel_mix_focus_total',
    },
  );
});

test('overlay fuel rows are excluded from switching attribution', () => {
  const rows = buildFuelSwitchAttributionRows(
    [
      buildFuelContribution({ commodityId: 'natural_gas', value: 15 }),
      buildFuelContribution({
        commodityId: 'electricity',
        value: 50,
        sourceKind: 'overlay',
        outputId: 'overlay_row',
        outputLabel: 'Overlay row',
      }),
    ],
    [
      buildFuelContribution({ commodityId: 'electricity', value: 10 }),
      buildFuelContribution({
        commodityId: 'electricity',
        value: 90,
        sourceKind: 'overlay',
        outputId: 'overlay_row',
        outputLabel: 'Overlay row',
      }),
    ],
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].toBasisPj, 10);
});

test('all-fuel decrease can still switch gas and liquid shares to electricity', () => {
  const result = buildFuelSwitchDecomposition(
    [
      buildFuelContribution({ commodityId: 'electricity', value: 100 }),
      buildFuelContribution({ commodityId: 'natural_gas', value: 200 }),
      buildFuelContribution({ commodityId: 'refined_liquid_fuels', value: 100 }),
    ],
    [
      buildFuelContribution({ commodityId: 'electricity', value: 90 }),
      buildFuelContribution({ commodityId: 'natural_gas', value: 60 }),
      buildFuelContribution({ commodityId: 'refined_liquid_fuels', value: 30 }),
    ],
    {
      baseActivities: [{
        outputId: 'industrial_heat',
        outputLabel: 'Industrial heat',
        year: 2030,
        activity: 100,
      }],
      focusActivities: [{
        outputId: 'industrial_heat',
        outputLabel: 'Industrial heat',
        year: 2030,
        activity: 100,
      }],
    },
  );

  assert.deepEqual(
    result.switchRows.map((row) => [row.fromFuelId, row.toFuelId]),
    [
      ['natural_gas', 'electricity'],
      ['refined_liquid_fuels', 'electricity'],
    ],
  );
  assertApprox(result.switchRows[0].toBasisPj, 30);
  assertApprox(result.switchRows[0].fromBasisPj, 30);
  assertApprox(result.switchRows[1].toBasisPj, 15);
  assertApprox(result.switchRows[1].fromBasisPj, 15);
  assert.equal(result.residualRows.every((row) => row.effect === 'intensity'), true);
  assertApprox(
    result.residualRows.reduce((sum, row) => sum + row.valuePj, 0),
    -220,
  );
});

test('route basis matching actual fuel totals preserves proportional attribution', () => {
  const result = buildFuelSwitchDecomposition(
    [
      buildFuelContribution({ commodityId: 'natural_gas', value: 12 }),
      buildFuelContribution({ commodityId: 'coal', value: 8 }),
    ],
    [
      buildFuelContribution({ commodityId: 'electricity', value: 10 }),
      buildFuelContribution({ commodityId: 'hydrogen', value: 4 }),
    ],
    {
      baseSwitchBasisRows: [
        buildFuelTotalRow({ fuelId: 'natural_gas', valuePj: 12 }),
        buildFuelTotalRow({ fuelId: 'coal', valuePj: 8 }),
      ],
      focusSwitchBasisRows: [
        buildFuelTotalRow({ fuelId: 'electricity', valuePj: 10 }),
        buildFuelTotalRow({ fuelId: 'hydrogen', valuePj: 4 }),
      ],
    },
  );

  assert.equal(result.switchRows.length, 4);
  assertApprox(
    result.switchRows.reduce((sum, row) => sum + row.toBasisPj, 0),
    14,
  );
  assert.deepEqual(
    result.switchRows.find((row) => row.fromFuelId === 'natural_gas' && row.toFuelId === 'electricity'),
    {
      key: '2030::industrial_heat::natural_gas::electricity',
      outputId: 'industrial_heat',
      outputLabel: 'Industrial heat',
      year: 2030,
      fromFuelId: 'natural_gas',
      fromFuelLabel: 'Natural gas',
      toFuelId: 'electricity',
      toFuelLabel: 'Electricity',
      toBasisPj: 6,
      fromBasisPj: 6,
      attributionBasis: 'route_change_fuel_mix_focus_total',
    },
  );
});

test('same-route electricity efficiency does not create fuel switch pairs', () => {
  const baseRoute = buildSolveRow({
    stateId: 'commercial_o0',
    stateLabel: 'Commercial O0',
    inputs: [
      ['electricity', 1],
      ['natural_gas', 2],
      ['refined_liquid_fuels', 1],
    ],
  });
  const focusPackage = buildSolveRow({
    stateId: 'effpkg:commercial_o0::lighting',
    stateLabel: 'Commercial O0 + lighting efficiency',
    inputs: [
      ['electricity', 0.8],
      ['natural_gas', 2],
      ['refined_liquid_fuels', 1],
    ],
    provenance: packageProvenance('commercial_o0', 'lighting', 'Commercial O0'),
  });
  const baseRequest = buildSolveRequest('commercial-base', [baseRoute]);
  const focusRequest = buildSolveRequest('commercial-efficiency', [baseRoute, focusPackage]);
  const routeBasis = buildFuelSwitchRouteBasisRows(
    baseRequest,
    buildSolveResult(baseRequest, [{ row: baseRoute, activity: 100 }]),
    focusRequest,
    buildSolveResult(focusRequest, [{ row: focusPackage, activity: 100 }]),
  );
  const result = buildFuelSwitchDecomposition(
    [
      buildFuelContribution({
        outputId: 'commercial_services',
        outputLabel: 'Commercial services',
        commodityId: 'electricity',
        value: 100,
      }),
      buildFuelContribution({
        outputId: 'commercial_services',
        outputLabel: 'Commercial services',
        commodityId: 'natural_gas',
        value: 200,
      }),
      buildFuelContribution({
        outputId: 'commercial_services',
        outputLabel: 'Commercial services',
        commodityId: 'refined_liquid_fuels',
        value: 100,
      }),
    ],
    [
      buildFuelContribution({
        outputId: 'commercial_services',
        outputLabel: 'Commercial services',
        commodityId: 'electricity',
        value: 80,
      }),
      buildFuelContribution({
        outputId: 'commercial_services',
        outputLabel: 'Commercial services',
        commodityId: 'natural_gas',
        value: 200,
      }),
      buildFuelContribution({
        outputId: 'commercial_services',
        outputLabel: 'Commercial services',
        commodityId: 'refined_liquid_fuels',
        value: 100,
      }),
    ],
    {
      baseActivities: [{
        outputId: 'commercial_services',
        outputLabel: 'Commercial services',
        year: 2030,
        activity: 100,
      }],
      focusActivities: [{
        outputId: 'commercial_services',
        outputLabel: 'Commercial services',
        year: 2030,
        activity: 100,
      }],
      ...routeBasis,
    },
  );

  assert.deepEqual(
    routeBasis.focusSwitchBasisRows.map((row) => [row.fuelId, row.valuePj]),
    [
      ['electricity', 100],
      ['natural_gas', 200],
      ['refined_liquid_fuels', 100],
    ],
  );
  assert.equal(result.switchRows.length, 0);
  assert.deepEqual(
    result.residualRows.map((row) => [row.fuelId, row.effect, row.valuePj]),
    [['electricity', 'intensity', -20]],
  );
  assert.equal(
    result.switchRows.some((row) =>
      row.fromFuelId === 'electricity'
      && (row.toFuelId === 'natural_gas' || row.toFuelId === 'refined_liquid_fuels')),
    false,
  );
});

test('route change with electricity efficiency only pairs gas and liquids to electricity', () => {
  const baseRoute = buildSolveRow({
    stateId: 'commercial_o0',
    stateLabel: 'Commercial O0',
    inputs: [
      ['electricity', 1],
      ['natural_gas', 2],
      ['refined_liquid_fuels', 1],
    ],
  });
  const focusRoute = buildSolveRow({
    stateId: 'commercial_o1',
    stateLabel: 'Commercial O1',
    inputs: [
      ['electricity', 3],
      ['natural_gas', 0.7],
      ['refined_liquid_fuels', 0.3],
    ],
  });
  const focusPackage = buildSolveRow({
    stateId: 'effpkg:commercial_o1::electrified_efficiency',
    stateLabel: 'Commercial O1 + electrified efficiency',
    inputs: [
      ['electricity', 2.5],
      ['natural_gas', 0.7],
      ['refined_liquid_fuels', 0.3],
    ],
    provenance: packageProvenance('commercial_o1', 'electrified_efficiency', 'Commercial O1'),
  });
  const baseRequest = buildSolveRequest('commercial-base', [baseRoute]);
  const focusRequest = buildSolveRequest('commercial-o1-efficiency', [focusRoute, focusPackage]);
  const routeBasis = buildFuelSwitchRouteBasisRows(
    baseRequest,
    buildSolveResult(baseRequest, [{ row: baseRoute, activity: 100 }]),
    focusRequest,
    buildSolveResult(focusRequest, [{ row: focusPackage, activity: 100 }]),
  );
  const result = buildFuelSwitchDecomposition(
    [
      buildFuelContribution({
        outputId: 'commercial_services',
        outputLabel: 'Commercial services',
        commodityId: 'electricity',
        value: 100,
      }),
      buildFuelContribution({
        outputId: 'commercial_services',
        outputLabel: 'Commercial services',
        commodityId: 'natural_gas',
        value: 200,
      }),
      buildFuelContribution({
        outputId: 'commercial_services',
        outputLabel: 'Commercial services',
        commodityId: 'refined_liquid_fuels',
        value: 100,
      }),
    ],
    [
      buildFuelContribution({
        outputId: 'commercial_services',
        outputLabel: 'Commercial services',
        commodityId: 'electricity',
        value: 250,
      }),
      buildFuelContribution({
        outputId: 'commercial_services',
        outputLabel: 'Commercial services',
        commodityId: 'natural_gas',
        value: 70,
      }),
      buildFuelContribution({
        outputId: 'commercial_services',
        outputLabel: 'Commercial services',
        commodityId: 'refined_liquid_fuels',
        value: 30,
      }),
    ],
    {
      baseActivities: [{
        outputId: 'commercial_services',
        outputLabel: 'Commercial services',
        year: 2030,
        activity: 100,
      }],
      focusActivities: [{
        outputId: 'commercial_services',
        outputLabel: 'Commercial services',
        year: 2030,
        activity: 100,
      }],
      ...routeBasis,
    },
  );

  assert.deepEqual(
    result.switchRows.map((row) => [row.fromFuelId, row.toFuelId]),
    [
      ['natural_gas', 'electricity'],
      ['refined_liquid_fuels', 'electricity'],
    ],
  );
  assert.equal(
    result.switchRows.some((row) => row.fromFuelId === 'electricity'),
    false,
  );
  assert.deepEqual(
    result.residualRows.map((row) => [row.fuelId, row.effect, row.valuePj]),
    [['electricity', 'intensity', -50]],
  );
});

test('fuel switch decomposition conserves net deltas by fuel', () => {
  const result = buildFuelSwitchDecomposition(
    [
      buildFuelContribution({ commodityId: 'electricity', value: 100 }),
      buildFuelContribution({ commodityId: 'natural_gas', value: 200 }),
      buildFuelContribution({ commodityId: 'refined_liquid_fuels', value: 100 }),
    ],
    [
      buildFuelContribution({ commodityId: 'electricity', value: 250 }),
      buildFuelContribution({ commodityId: 'natural_gas', value: 70 }),
      buildFuelContribution({ commodityId: 'refined_liquid_fuels', value: 30 }),
    ],
    {
      baseActivities: [{
        outputId: 'industrial_heat',
        outputLabel: 'Industrial heat',
        year: 2030,
        activity: 100,
      }],
      focusActivities: [{
        outputId: 'industrial_heat',
        outputLabel: 'Industrial heat',
        year: 2030,
        activity: 100,
      }],
      baseSwitchBasisRows: [
        buildFuelTotalRow({ fuelId: 'electricity', valuePj: 100 }),
        buildFuelTotalRow({ fuelId: 'natural_gas', valuePj: 200 }),
        buildFuelTotalRow({ fuelId: 'refined_liquid_fuels', valuePj: 100 }),
      ],
      focusSwitchBasisRows: [
        buildFuelTotalRow({ fuelId: 'electricity', valuePj: 300 }),
        buildFuelTotalRow({ fuelId: 'natural_gas', valuePj: 70 }),
        buildFuelTotalRow({ fuelId: 'refined_liquid_fuels', valuePj: 30 }),
      ],
    },
  );
  const mixByFuel = new Map();
  const residualByFuel = new Map();
  const netByFuel = new Map();

  for (const row of result.switchRows) {
    mixByFuel.set(row.toFuelId, (mixByFuel.get(row.toFuelId) ?? 0) + row.toBasisPj);
    mixByFuel.set(row.fromFuelId, (mixByFuel.get(row.fromFuelId) ?? 0) - row.fromBasisPj);
  }

  for (const row of result.residualRows) {
    residualByFuel.set(row.fuelId, (residualByFuel.get(row.fuelId) ?? 0) + row.valuePj);
  }

  for (const row of result.netDeltaRows) {
    netByFuel.set(row.fuelId, row.valuePj);
  }

  for (const fuelId of new Set([...mixByFuel.keys(), ...residualByFuel.keys(), ...netByFuel.keys()])) {
    assertApprox(
      (mixByFuel.get(fuelId) ?? 0) + (residualByFuel.get(fuelId) ?? 0),
      netByFuel.get(fuelId) ?? 0,
    );
  }
});

test('zero-total base and focus edge cases produce residuals without switch pairs', () => {
  const newDemand = buildFuelSwitchDecomposition(
    [],
    [buildFuelContribution({ commodityId: 'electricity', value: 10 })],
  );
  const avoidedDemand = buildFuelSwitchDecomposition(
    [buildFuelContribution({ commodityId: 'natural_gas', value: 15 })],
    [],
  );

  assert.equal(newDemand.switchRows.length, 0);
  assert.deepEqual(
    newDemand.residualRows.map((row) => [row.fuelId, row.effect, row.valuePj]),
    [['electricity', 'scale', 10]],
  );
  assert.equal(avoidedDemand.switchRows.length, 0);
  assert.deepEqual(
    avoidedDemand.residualRows.map((row) => [row.fuelId, row.effect, row.valuePj]),
    [['natural_gas', 'scale', -15]],
  );
});

test('single-fuel decrease is residual only', () => {
  const result = buildFuelSwitchDecomposition(
    [buildFuelContribution({ commodityId: 'natural_gas', value: 15 })],
    [buildFuelContribution({ commodityId: 'natural_gas', value: 9 })],
  );

  assert.equal(result.switchRows.length, 0);
  assert.deepEqual(
    result.residualRows.map((row) => [row.fuelId, row.effect, row.valuePj]),
    [['natural_gas', 'scale', -6]],
  );
});

test('chart rows sort by displayed basis value and use the requested basis', () => {
  const rows = buildFuelSwitchAttributionRows(
    [
      buildFuelContribution({ outputId: 'heat', outputLabel: 'Heat', commodityId: 'natural_gas', value: 15 }),
      buildFuelContribution({ outputId: 'transport', outputLabel: 'Transport', commodityId: 'coal', value: 8 }),
    ],
    [
      buildFuelContribution({ outputId: 'heat', outputLabel: 'Heat', commodityId: 'electricity', value: 10 }),
      buildFuelContribution({ outputId: 'transport', outputLabel: 'Transport', commodityId: 'hydrogen', value: 4 }),
    ],
  );

  const toChart = buildFuelSwitchChartData(rows, [2030], 'to');
  const fromChart = buildFuelSwitchChartData(rows, [2030], 'from');

  assert.deepEqual(
    toChart.series.map((row) => [row.label, row.values[0].value, row.colorCommodityId]),
    [
      ['Natural gas -> Electricity', 10, 'electricity'],
      ['Coal -> Hydrogen', 4, 'hydrogen'],
    ],
  );
  assert.deepEqual(
    fromChart.series.map((row) => [row.label, row.values[0].value, row.colorCommodityId]),
    [
      ['Natural gas -> Electricity', 10, 'natural_gas'],
      ['Coal -> Hydrogen', 4, 'coal'],
    ],
  );
});

test('chart data aggregates matching fuel pairs across outputs', () => {
  const rows = buildFuelSwitchAttributionRows(
    [
      buildFuelContribution({ outputId: 'heat', outputLabel: 'Heat', commodityId: 'natural_gas', value: 15 }),
      buildFuelContribution({ outputId: 'transport', outputLabel: 'Transport', commodityId: 'natural_gas', value: 5 }),
    ],
    [
      buildFuelContribution({ outputId: 'heat', outputLabel: 'Heat', commodityId: 'electricity', value: 10 }),
      buildFuelContribution({ outputId: 'transport', outputLabel: 'Transport', commodityId: 'electricity', value: 3 }),
    ],
  );

  const toChart = buildFuelSwitchChartData(rows, [2030], 'to');
  const fromChart = buildFuelSwitchChartData(rows, [2030], 'from');

  assert.deepEqual(
    toChart.series.map((row) => [row.label, row.values[0].value]),
    [['Natural gas -> Electricity', 13]],
  );
  assert.deepEqual(
    fromChart.series.map((row) => [row.label, row.values[0].value]),
    [['Natural gas -> Electricity', 13]],
  );
});

test('fuel switching chart renders stacked years on the x-axis with pair-specific legend colors', () => {
  const html = renderToStaticMarkup(
    React.createElement(FuelSwitchingChart, {
      availableYears: [2030, 2035],
      basis: 'to',
      residualRows: [
        {
          key: '2035::heat::natural_gas::intensity',
          outputId: 'heat',
          outputLabel: 'Heat',
          year: 2035,
          fuelId: 'natural_gas',
          fuelLabel: 'Natural gas',
          effect: 'intensity',
          valuePj: -65.7,
        },
      ],
      rows: [
        {
          key: '2030::heat::natural_gas::electricity',
          outputId: 'heat',
          outputLabel: 'Heat',
          year: 2030,
          fromFuelId: 'natural_gas',
          fromFuelLabel: 'Natural gas',
          toFuelId: 'electricity',
          toFuelLabel: 'Electricity',
          toBasisPj: 6,
          fromBasisPj: 8,
        },
        {
          key: '2035::heat::natural_gas::electricity',
          outputId: 'heat',
          outputLabel: 'Heat',
          year: 2035,
          fromFuelId: 'natural_gas',
          fromFuelLabel: 'Natural gas',
          toFuelId: 'electricity',
          toFuelLabel: 'Electricity',
          toBasisPj: 10,
          fromBasisPj: 15,
        },
        {
          key: '2035::transport::coal::electricity',
          outputId: 'transport',
          outputLabel: 'Transport',
          year: 2035,
          fromFuelId: 'coal',
          fromFuelLabel: 'Coal',
          toFuelId: 'electricity',
          toFuelLabel: 'Electricity',
          toBasisPj: 4,
          fromBasisPj: 5,
        },
      ],
      selectedYear: null,
      onBasisChange: () => {},
      onYearChange: () => {},
      yDomainPersistenceKey: 'run:fuel-switching',
    }),
  );

  assert.match(
    html,
    /class="stacked-chart-control-pill stacked-chart-control-pill--active" aria-pressed="true">To fuel</,
  );
  assert.match(html, /role="group" aria-label="Fuel switch basis"/);
  assert.match(html, /Route-change fuel switching by fuel pair/);
  assert.match(html, /Years: 2030-2035/);
  assert.match(html, /2 fuel-switch pairs/);
  assert.match(html, /Intensity effect: -65\.7 PJ/);
  assert.match(html, /aria-label="Reset y-axis range for Route-change fuel switching by fuel pair"/);
  assert.match(html, />Gas -&gt; Elec</);
  assert.match(html, />Coal -&gt; Elec</);
  assert.match(html, /title="Natural gas -&gt; Electricity"/);
  assert.match(html, /title="Coal -&gt; Electricity"/);
  assert.match(
    html,
    /stacked-chart-header-action-group[\s\S]*role="group" aria-label="Fuel switch basis"[\s\S]*stacked-chart-reset-button/,
  );
  assert.doesNotMatch(html, /aria-label="Fuel switch year"/);
  assert.doesNotMatch(html, /workspace-chart-toggle/);
  assert.doesNotMatch(html, /role="tablist"/);
  const swatches = [...html.matchAll(/background-color:([^";]+)/g)].map((match) => match[1]);
  assert.equal(new Set(swatches).size >= 2, true);
  assert.doesNotMatch(html, /background-color:#f59e0b/);
});

test('fuel switching chart hides tiny pairs from the legend while keeping total pair counts', () => {
  const html = renderToStaticMarkup(
    React.createElement(FuelSwitchingChart, {
      availableYears: [2035],
      basis: 'to',
      rows: [
        {
          key: '2035::heat::natural_gas::electricity',
          outputId: 'heat',
          outputLabel: 'Heat',
          year: 2035,
          fromFuelId: 'natural_gas',
          fromFuelLabel: 'Natural gas',
          toFuelId: 'electricity',
          toFuelLabel: 'Electricity',
          toBasisPj: 120,
          fromBasisPj: 140,
        },
        {
          key: '2035::heat::coal::hydrogen',
          outputId: 'heat',
          outputLabel: 'Heat',
          year: 2035,
          fromFuelId: 'coal',
          fromFuelLabel: 'Coal',
          toFuelId: 'hydrogen',
          toFuelLabel: 'Hydrogen',
          toBasisPj: 0.2,
          fromBasisPj: 0.3,
        },
      ],
      selectedYear: null,
      onBasisChange: () => {},
      onYearChange: () => {},
    }),
  );

  assert.match(html, /2 fuel-switch pairs/);
  assert.match(html, /Legend hides 1 minor pairs/);
  assert.match(html, />Gas -&gt; Elec</);
  assert.doesNotMatch(html, />Coal -&gt; H2</);
});

test('fuel switching chart uses route-change empty state wording', () => {
  const html = renderToStaticMarkup(
    React.createElement(FuelSwitchingChart, {
      availableYears: [2035],
      basis: 'to',
      rows: [],
      selectedYear: null,
      onBasisChange: () => {},
      onYearChange: () => {},
    }),
  );

  assert.match(html, /No route-change fuel switching for the selected basis\./);
});
