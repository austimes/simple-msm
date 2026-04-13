import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LineChartData, StackedChartData } from '../src/results/chartData.ts';
import DivergingStackedBarChart from '../src/components/charts/DivergingStackedBarChart.tsx';
import LineChart from '../src/components/charts/LineChart.tsx';
import StackedAreaChart from '../src/components/charts/StackedAreaChart.tsx';

const emissionsChart: StackedChartData = {
  title: 'Emissions by Sector',
  yAxisLabel: 'Emissions (tCO2e)',
  years: [2030, 2035],
  series: [
    {
      key: 'buildings',
      label: 'Buildings',
      color: '#2563eb',
      values: [
        { year: 2030, value: 52 },
        { year: 2035, value: 31 },
      ],
    },
    {
      key: 'removals',
      label: 'Removals',
      color: '#0f766e',
      values: [
        { year: 2030, value: -14 },
        { year: 2035, value: -18 },
      ],
    },
  ],
};

const demandChart: LineChartData = {
  title: 'Demand by Sector',
  yAxisLabel: '% of 2030',
  years: [2030, 2035],
  series: [
    {
      key: 'industry',
      label: 'Industry',
      color: '#7c3aed',
      values: [
        { year: 2030, value: 100 },
        { year: 2035, value: 112 },
      ],
    },
    {
      key: 'transport',
      label: 'Transport',
      color: '#d97706',
      values: [
        { year: 2030, value: 100 },
        { year: 2035, value: 119 },
      ],
    },
  ],
};

describe('workspace Recharts wrappers', () => {
  test('diverging emissions charts retain the axis label, negative series metadata, and net legend item', () => {
    const html = renderToStaticMarkup(
      <DivergingStackedBarChart
        data={emissionsChart}
        yDomainPersistenceKey="run:emissions-by-sector"
      />,
    );

    assert.match(html, /Axis: Emissions \(tCO2e\)/);
    assert.match(html, /aria-label="Emissions by Sector legend"/);
    assert.match(html, /aria-label="Reset y-axis range for Emissions by Sector"/);
    assert.match(html, />Buildings</);
    assert.match(html, />Removals</);
    assert.match(html, />Net</);
    assert.match(html, /data-series-key="removals"/);
    assert.match(html, /data-negative-points="2"/);
    assert.match(html, /data-series-key="__net"/);
  });

  test('workspace charts keep the reset control visible when the internal chart title is hidden', () => {
    const html = renderToStaticMarkup(
      <LineChart
        data={demandChart}
        showTitle={false}
        yDomainPersistenceKey="run:demand-by-sector"
      />,
    );

    assert.doesNotMatch(html, /<figcaption/);
    assert.match(html, /class="stacked-chart-header stacked-chart-header--action-only"/);
    assert.match(html, /aria-label="Reset y-axis range for Demand by Sector"/);
  });

  test('line chart legends render the series labels inside the chart shell', () => {
    const html = renderToStaticMarkup(
      <LineChart
        data={demandChart}
        yDomainPersistenceKey="run:demand-by-sector"
      />,
    );

    assert.match(html, /class="stacked-chart-shell"/);
    assert.match(html, /aria-label="Demand by Sector legend"/);
    assert.match(html, /aria-label="Reset y-axis range for Demand by Sector"/);
    assert.match(html, />Industry</);
    assert.match(html, />Transport</);
  });

  test('empty-state charts keep the existing message without rendering a reset control', () => {
    const html = renderToStaticMarkup(
      <StackedAreaChart
        data={{
          title: 'Commodity Consumption',
          yAxisLabel: 'Consumption',
          years: [],
          series: [],
        }}
        yDomainPersistenceKey="run:fuel-consumption"
      />,
    );

    assert.match(html, /No data available for this chart\./);
    assert.doesNotMatch(html, /Reset y-axis range/);
  });
});
