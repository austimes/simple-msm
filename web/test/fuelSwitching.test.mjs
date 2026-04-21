import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FuelSwitchingChart from '../src/components/charts/FuelSwitchingChart.tsx';
import {
  buildFuelSwitchAttributionRows,
  buildFuelSwitchChartData,
  buildFuelSwitchDecomposition,
} from '../src/results/fuelSwitching.ts';

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

test('fuel switch decomposition conserves net deltas by fuel', () => {
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
  assert.match(html, /Fuel-mix switching by fuel pair/);
  assert.match(html, /Years: 2030-2035/);
  assert.match(html, /2 fuel-switch pairs/);
  assert.match(html, /Intensity effect: -65\.7 PJ/);
  assert.match(html, /aria-label="Reset y-axis range for Fuel-mix switching by fuel pair"/);
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

test('fuel switching chart uses fuel-mix empty state wording', () => {
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

  assert.match(html, /No fuel-mix switching for the selected basis\./);
});
