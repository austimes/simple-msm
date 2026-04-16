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

  const toRows = buildFuelSwitchChartData(rows, 2030, 'to');
  const fromRows = buildFuelSwitchChartData(rows, 2030, 'from');

  assert.deepEqual(
    toRows.map((row) => [row.label, row.value, row.colorCommodityId]),
    [
      ['Heat: Natural gas -> Electricity', 10, 'electricity'],
      ['Transport: Coal -> Hydrogen', 4, 'hydrogen'],
    ],
  );
  assert.deepEqual(
    fromRows.map((row) => [row.label, row.value, row.colorCommodityId]),
    [
      ['Heat: Natural gas -> Electricity', 15, 'natural_gas'],
      ['Transport: Coal -> Hydrogen', 8, 'coal'],
    ],
  );
});

test('fuel switching chart defaults to the latest available year and reuses commodity colors', () => {
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
      ],
      selectedYear: null,
      onBasisChange: () => {},
      onYearChange: () => {},
    }),
  );

  assert.match(
    html,
    /workspace-chart-toggle-button workspace-chart-toggle-button--active" aria-pressed="true">2035</,
  );
  assert.match(html, /Year: 2035/);
  assert.match(html, /background-color:#f59e0b/);
});
