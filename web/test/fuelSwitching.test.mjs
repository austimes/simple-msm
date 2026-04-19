import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FuelSwitchingChart from '../src/components/charts/FuelSwitchingChart.tsx';
import {
  buildFuelSwitchAttributionRows,
  buildFuelSwitchChartData,
} from '../src/results/fuelSwitching.ts';

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

test('one-to-one electrification preserves to-fuel and from-fuel bases', () => {
  const rows = buildFuelSwitchAttributionRows(
    [buildFuelContribution({ commodityId: 'natural_gas', value: 15 })],
    [buildFuelContribution({ commodityId: 'electricity', value: 10 })],
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].fromFuelId, 'natural_gas');
  assert.equal(rows[0].toFuelId, 'electricity');
  assert.equal(rows[0].toBasisPj, 10);
  assert.equal(rows[0].fromBasisPj, 15);
});

test('multi-fuel switching uses proportional attribution and preserves basis totals', () => {
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
  assert.equal(
    rows.reduce((sum, row) => sum + row.toBasisPj, 0),
    14,
  );
  assert.equal(
    rows.reduce((sum, row) => sum + row.fromBasisPj, 0),
    20,
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
      fromBasisPj: 120 / 14,
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
      ['Natural gas -> Electricity', 15, 'natural_gas'],
      ['Coal -> Hydrogen', 8, 'coal'],
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
    [['Natural gas -> Electricity', 20]],
  );
});

test('fuel switching chart renders stacked years on the x-axis with pair-specific legend colors', () => {
  const html = renderToStaticMarkup(
    React.createElement(FuelSwitchingChart, {
      availableYears: [2030, 2035],
      basis: 'to',
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
    }),
  );

  assert.match(
    html,
    /workspace-chart-toggle-button workspace-chart-toggle-button--active" aria-pressed="true">To fuel</,
  );
  assert.match(html, /Fuel switching by fuel pair/);
  assert.match(html, /Years: 2030-2035/);
  assert.match(html, /2 fuel-switch pairs/);
  assert.match(html, />Gas -&gt; Elec</);
  assert.match(html, />Coal -&gt; Elec</);
  assert.match(html, /title="Natural gas -&gt; Electricity"/);
  assert.match(html, /title="Coal -&gt; Electricity"/);
  assert.doesNotMatch(html, /aria-label="Fuel switch year"/);
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
