import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStateCommodityLegendLabel,
  buildStateMetricLegendLabel,
  CHART_PRESENTATION_MAP,
  getPresentation,
  MAX_VISIBLE_LEGEND_LABEL_LENGTH,
} from '../src/data/chartPresentation.ts';

test('all curated chart presentation labels fit within the visible legend cap', () => {
  for (const registry of Object.values(CHART_PRESENTATION_MAP)) {
    for (const entry of Object.values(registry)) {
      assert.ok(
        entry.legendLabel.length <= MAX_VISIBLE_LEGEND_LABEL_LENGTH,
        `expected ${entry.legendLabel} to fit within ${MAX_VISIBLE_LEGEND_LABEL_LENGTH} characters`,
      );
    }
  }
});

test('state metric legend labels stay within the visible legend cap', () => {
  for (const stateId of Object.keys(CHART_PRESENTATION_MAP.state)) {
    assert.ok(buildStateMetricLegendLabel(stateId, 'energy').length <= MAX_VISIBLE_LEGEND_LABEL_LENGTH);
    assert.ok(buildStateMetricLegendLabel(stateId, 'process').length <= MAX_VISIBLE_LEGEND_LABEL_LENGTH);
  }
});

test('state commodity legend labels stay within the visible legend cap', () => {
  for (const stateId of Object.keys(CHART_PRESENTATION_MAP.state)) {
    for (const commodityId of Object.keys(CHART_PRESENTATION_MAP.commodity)) {
      const legendLabel = buildStateCommodityLegendLabel(stateId, commodityId);
      assert.ok(
        legendLabel.length <= MAX_VISIBLE_LEGEND_LABEL_LENGTH,
        `expected ${stateId}/${commodityId} composite ${legendLabel} to fit within ${MAX_VISIBLE_LEGEND_LABEL_LENGTH} characters`,
      );
    }
  }
});

test('fallback chart presentation stays deterministic and capped', () => {
  const first = getPresentation('state', 'unknown_state', 'Unknown extremely verbose fallback label');
  const second = getPresentation('state', 'unknown_state', 'Unknown extremely verbose fallback label');

  assert.equal(first.color, second.color);
  assert.equal(first.legendLabel, second.legendLabel);
  assert.ok(first.legendLabel.length <= MAX_VISIBLE_LEGEND_LABEL_LENGTH);
});
