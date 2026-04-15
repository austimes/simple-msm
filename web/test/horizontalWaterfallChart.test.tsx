import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HorizontalWaterfallChart from '../src/components/charts/HorizontalWaterfallChart.tsx';

void React;

const mixedData = [
  {
    key: 'step-1',
    interactionKey: 'step-1',
    label: 'Passenger road transport',
    delta: 12,
    cumulativeBefore: 0,
    cumulativeAfter: 12,
  },
  {
    key: 'step-2',
    interactionKey: 'step-2',
    label: 'High-temperature heat',
    delta: -20,
    cumulativeBefore: 12,
    cumulativeAfter: -8,
  },
  {
    key: 'step-3',
    interactionKey: 'step-3',
    label: 'Steady state',
    delta: 0,
    cumulativeBefore: -8,
    cumulativeAfter: -8,
  },
];

describe('HorizontalWaterfallChart', () => {
  test('renders legend labels, header summaries, zero reference line, and mixed-sign bars', () => {
    const html = renderToStaticMarkup(
      <HorizontalWaterfallChart
        title="Objective delta waterfall"
        data={mixedData}
        height={320}
        baseValue={100}
        targetValue={92}
        totalDelta={-8}
        valueFormatter={(value) => `delta(${value})`}
        absoluteValueFormatter={(value) => `abs(${value})`}
        positiveLegendLabel="Increase objective"
        negativeLegendLabel="Decrease objective"
        showCategoryAxis={false}
      />,
    );

    assert.match(html, /aria-label="Objective delta waterfall legend"/);
    assert.match(html, />Increase objective</);
    assert.match(html, />Decrease objective</);
    assert.match(html, /Base abs\(100\)/);
    assert.match(html, /Target abs\(92\)/);
    assert.match(html, /Δ delta\(-8\)/);
    assert.match(html, /Base: abs\(100\)/);
    assert.match(html, /Target: abs\(92\)/);
    assert.match(html, /Total delta: delta\(-8\)/);
    assert.match(html, /preserveAspectRatio="xMinYMin meet"/);
    assert.match(html, /class="waterfall-chart-zero-line"/);
    assert.match(html, /class="waterfall-chart-connector"/);
    assert.match(html, /data-delta="12"/);
    assert.match(html, /data-delta="-20"/);
    assert.match(html, /data-delta="0"/);
    assert.match(html, /data-interaction-key="step-1"/);
    assert.match(html, /data-active="false"/);
    assert.match(html, /data-dimmed="false"/);
    assert.match(html, /Passenger road transport: delta\(12\)/);
    assert.match(html, /High-temperature heat: delta\(-20\)/);
    assert.match(html, /Steady state: delta\(0\)/);
  });

  test('renders category-axis labels when requested', () => {
    const html = renderToStaticMarkup(
      <HorizontalWaterfallChart
        title="Cumulative emissions delta waterfall"
        data={mixedData}
        height={320}
        baseValue={400}
        targetValue={392}
        totalDelta={-8}
        positiveLegendLabel="Increase emissions"
        negativeLegendLabel="Decrease emissions"
      />,
    );

    assert.match(html, /class="waterfall-chart-step-label"[^>]*>Passenger road transport</);
    assert.match(html, /class="waterfall-chart-step-label"[^>]*>High-temperature heat</);
    assert.match(html, /class="waterfall-chart-step-label"[^>]*>Steady state</);
  });

  test('can hide the legend, header summary, and x-axis ticks for the reference panel', () => {
    const html = renderToStaticMarkup(
      <HorizontalWaterfallChart
        title="Ordered steps reference"
        data={mixedData}
        height={320}
        baseValue={0}
        targetValue={0}
        totalDelta={0}
        pinZeroToLeft={true}
        showActiveValueLabel={false}
        showHeaderSummary={false}
        showLegend={false}
        showXAxisTicks={false}
      />,
    );

    assert.doesNotMatch(html, /Ordered steps reference legend/);
    assert.doesNotMatch(html, /waterfall-chart-header-summary/);
    assert.doesNotMatch(html, /waterfall-chart-grid-line/);
    assert.match(html, /class="waterfall-chart-zero-line"/);
  });

  test('marks the active row and dims the others when a shared interaction key is provided', () => {
    const html = renderToStaticMarkup(
      <HorizontalWaterfallChart
        title="Objective delta waterfall"
        data={mixedData}
        height={320}
        baseValue={100}
        targetValue={92}
        totalDelta={-8}
        activeInteractionKey="step-2"
      />,
    );

    assert.match(html, /data-interaction-key="step-1" data-active="false" data-dimmed="true"/);
    assert.match(html, /data-interaction-key="step-2" data-active="true" data-dimmed="false"/);
    assert.match(html, /data-interaction-key="step-3" data-active="false" data-dimmed="true"/);
    assert.match(html, /class="waterfall-chart-row-hit-area"/);
    assert.match(html, /data-value-label="-20\.00"/);
  });

  test('renders the existing empty state message without a chart shell when no rows are present', () => {
    const html = renderToStaticMarkup(
      <HorizontalWaterfallChart
        title="2050 electricity demand delta waterfall"
        data={[]}
        baseValue={120}
        targetValue={120}
        totalDelta={0}
      />,
    );

    assert.match(html, /No additionality steps available for this chart\./);
    assert.doesNotMatch(html, /waterfall-chart-zero-line/);
  });
});
