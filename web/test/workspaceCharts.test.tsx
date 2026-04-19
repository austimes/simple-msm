import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LineChartData, PathwayCapChartData, StackedChartData } from '../src/results/chartData.ts';
import LineChart from '../src/components/charts/LineChart.tsx';
import PathwayCapChart from '../src/components/charts/PathwayCapChart.tsx';
import StackedBarChart from '../src/components/charts/StackedBarChart.tsx';

const emissionsChart: StackedChartData = {
  title: 'Emissions by Sector',
  yAxisLabel: 'Emissions (tCO2e)',
  years: [2030, 2035],
  series: [
    {
      key: 'buildings',
      label: 'Buildings sector total',
      legendLabel: 'Buildings',
      color: '#2563eb',
      values: [
        { year: 2030, value: 52 },
        { year: 2035, value: 31 },
      ],
    },
    {
      key: 'removals',
      label: 'Removals negative emissions',
      legendLabel: 'Removals',
      color: '#0f766e',
      values: [
        { year: 2030, value: -14 },
        { year: 2035, value: -18 },
      ],
    },
  ],
};

const consumptionChart: StackedChartData = {
  title: 'Fuel Consumption',
  yAxisLabel: 'PJ',
  years: [2030, 2035],
  series: [
    {
      key: 'electricity',
      label: 'Electricity consumption',
      legendLabel: 'Elec',
      color: '#f59e0b',
      values: [
        { year: 2030, value: 52 },
        { year: 2035, value: 48 },
      ],
    },
    {
      key: 'hydrogen',
      label: 'Hydrogen consumption',
      legendLabel: 'H2',
      color: '#06b6d4',
      values: [
        { year: 2030, value: 9 },
        { year: 2035, value: 18 },
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
      label: 'Generic industrial heat',
      legendLabel: 'Ind heat',
      color: '#7c3aed',
      values: [
        { year: 2030, value: 100 },
        { year: 2035, value: 112 },
      ],
    },
    {
      key: 'transport',
      label: 'Road transport',
      legendLabel: 'Transport',
      color: '#d97706',
      values: [
        { year: 2030, value: 100 },
        { year: 2035, value: 119 },
      ],
    },
  ],
};

const pathwayCapChart: PathwayCapChartData = {
  title: 'Industry Heat Pathway Cap',
  yAxisLabel: 'Share of output (%)',
  years: [2030, 2035],
  series: [
    {
      key: 'incumbent',
      label: 'Incumbent fossil heat',
      legendLabel: 'Incumbent',
      color: '#991b1b',
      capValues: [
        { year: 2030, value: 30 },
        { year: 2035, value: 20 },
      ],
      shareValues: [
        { year: 2030, value: 28 },
        { year: 2035, value: 14 },
      ],
    },
    {
      key: 'electrified',
      label: 'Electrified heat',
      legendLabel: 'Electrified',
      color: '#2563eb',
      capValues: [
        { year: 2030, value: 75 },
        { year: 2035, value: 90 },
      ],
      shareValues: [
        { year: 2030, value: 72 },
        { year: 2035, value: 86 },
      ],
    },
  ],
};

describe('workspace Recharts wrappers', () => {
  test('positive-only stacked charts render the shared stacked-bar legend labels inside the chart shell', () => {
    const html = renderToStaticMarkup(
      <StackedBarChart
        data={consumptionChart}
        yDomainPersistenceKey="run:fuel-consumption"
      />,
    );

    assert.match(html, /class="stacked-chart-shell"/);
    assert.match(html, /Axis: PJ/);
    assert.match(html, /aria-label="Fuel Consumption legend"/);
    assert.match(html, /aria-label="Reset y-axis range for Fuel Consumption"/);
    assert.match(html, />Elec</);
    assert.match(html, />H2</);
    assert.match(html, /title="Electricity consumption"/);
    assert.match(html, /title="Hydrogen consumption"/);
    assert.doesNotMatch(html, />Net</);
  });

  test('mixed-sign stacked charts retain the axis label, negative series metadata, and net legend item', () => {
    const html = renderToStaticMarkup(
      <StackedBarChart
        data={emissionsChart}
        yDomainPersistenceKey="run:emissions-by-sector"
        showNetLine={true}
      />,
    );

    assert.match(html, /Axis: Emissions \(tCO2e\)/);
    assert.match(html, /aria-label="Emissions by Sector legend"/);
    assert.match(html, /aria-label="Reset y-axis range for Emissions by Sector"/);
    assert.match(html, />Buildings</);
    assert.match(html, />Removals</);
    assert.match(html, />Net</);
    assert.match(html, /title="Buildings sector total"/);
    assert.match(html, /title="Removals negative emissions"/);
    assert.match(html, /data-series-key="removals"/);
    assert.match(html, /data-negative-points="2"/);
    assert.match(html, /data-series-key="__net"/);
  });

  test('stacked bar charts keep the reset control visible when the internal chart title is hidden', () => {
    const html = renderToStaticMarkup(
      <StackedBarChart
        data={consumptionChart}
        showTitle={false}
        yDomainPersistenceKey="run:fuel-consumption"
      />,
    );

    assert.doesNotMatch(html, /<figcaption/);
    assert.match(html, /class="stacked-chart-header stacked-chart-header--action-only"/);
    assert.match(html, /aria-label="Reset y-axis range for Fuel Consumption"/);
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
    assert.match(html, />Ind heat</);
    assert.match(html, />Transport</);
    assert.match(html, /title="Generic industrial heat"/);
    assert.match(html, /title="Road transport"/);
  });

  test('pathway cap charts render combined solved-share fills and cap lines in the chart shell', () => {
    const html = renderToStaticMarkup(
      <PathwayCapChart
        data={pathwayCapChart}
        showTitle={false}
        yDomainPersistenceKey="run:pathway-cap:industry-heat"
      />,
    );

    assert.doesNotMatch(html, /<figcaption/);
    assert.match(html, /class="stacked-chart-header stacked-chart-header--action-only"/);
    assert.match(html, /Axis: Share of output \(%\)/);
    assert.match(html, /aria-label="Industry Heat Pathway Cap legend"/);
    assert.match(html, /aria-label="Reset y-axis range for Industry Heat Pathway Cap"/);
    assert.match(html, />Incumbent</);
    assert.match(html, />Electrified</);
    assert.match(html, /title="Incumbent fossil heat"/);
    assert.match(html, /title="Electrified heat"/);
  });

  test('empty-state charts keep the existing message without rendering a reset control', () => {
    const html = renderToStaticMarkup(
      <StackedBarChart
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

  test('empty-state pathway cap charts keep the existing message without rendering a reset control', () => {
    const html = renderToStaticMarkup(
      <PathwayCapChart
        data={{
          title: 'Heat Pathway Cap',
          yAxisLabel: 'Share of output (%)',
          years: [],
          series: [],
        }}
        yDomainPersistenceKey="run:pathway-cap:heat"
      />,
    );

    assert.match(html, /No data available for this chart\./);
    assert.doesNotMatch(html, /Reset y-axis range/);
  });
});
