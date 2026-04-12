import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LineChart, { type LineChartSeries } from '../src/pages/library/LineChart.tsx';

const years = [2030, 2035, 2040];

const series: LineChartSeries[] = [
  {
    key: 'state-a',
    label: 'State A',
    color: '#0f766e',
    active: true,
    values: [
      { year: 2030, value: 14 },
      { year: 2035, value: null },
      { year: 2040, value: 19 },
    ],
  },
  {
    key: 'state-b',
    label: 'State B',
    color: '#b45309',
    dashArray: '7 5',
    active: false,
    values: [
      { year: 2030, value: 16 },
      { year: 2035, value: 15 },
      { year: 2040, value: 13 },
    ],
  },
];

describe('library Recharts line chart wrapper', () => {
  test('hidden legend mode suppresses the legend and preserves null-gap metadata', () => {
    const html = renderToStaticMarkup(
      <LineChart
        ariaLabel="Cost trajectories"
        years={years}
        series={series}
        valueFormatter={(value) => value.toFixed(0)}
        yAxisLabel="AUD per unit"
        legendMode="hidden"
      />,
    );

    assert.doesNotMatch(html, /library-chart-legend/);
    assert.match(html, /data-series-key="state-a"/);
    assert.match(html, /data-null-points="1"/);
    assert.match(html, /data-active="true"/);
  });

  test('active series styling still appears when the legend is shown', () => {
    const html = renderToStaticMarkup(
      <LineChart
        ariaLabel="Cost trajectories"
        years={years}
        series={series}
        valueFormatter={(value) => value.toFixed(0)}
        axisFormatter={(value) => value.toFixed(0)}
        yAxisLabel="AUD per unit"
        legendMode="full"
      />,
    );

    assert.match(html, /class="library-chart-legend"/);
    assert.match(html, /library-chart-legend-item library-chart-legend-item--active library-chart-legend-item--static/);
    assert.match(html, /library-chart-legend-swatch--dash/);
    assert.match(html, />State A</);
    assert.match(html, />State B</);
  });
});
