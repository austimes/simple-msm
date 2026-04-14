import assert from 'node:assert/strict';
import test from 'node:test';
import { getSeriesColor } from '../src/data/seriesColors.ts';

test('series color registry returns explicit colors for each namespace', () => {
  assert.equal(getSeriesColor('sector', 'buildings'), '#2563eb');
  assert.equal(getSeriesColor('subsector', 'engineered_removals'), '#0891b2');
  assert.equal(getSeriesColor('commodity', 'coal'), '#1f2937');
  assert.equal(getSeriesColor('cost_component', 'carbon'), '#b91c1c');
  assert.equal(getSeriesColor('metric', 'activity'), '#16a34a');
  assert.equal(
    getSeriesColor('state', 'electricity__grid_supply__policy_frontier'),
    '#eab308',
  );
});

test('series color registry uses deterministic fallback colors for unknown ids', () => {
  const first = getSeriesColor('state', 'unknown_state_id');
  const second = getSeriesColor('state', 'unknown_state_id');
  const different = getSeriesColor('state', 'different_unknown_state_id');

  assert.equal(first, second);
  assert.notEqual(first, '');
  assert.notEqual(different, '');
});
