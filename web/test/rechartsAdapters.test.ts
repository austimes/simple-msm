import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { StackedSeries } from '../src/results/chartData.ts';
import { buildStackedBarRows } from '../src/components/charts/rechartsAdapters.ts';

const positiveSeries: StackedSeries[] = [
  {
    key: 'electricity',
    label: 'Electricity',
    color: '#f59e0b',
    values: [
      { year: 2030, value: 10 },
      { year: 2035, value: 12 },
    ],
  },
  {
    key: 'hydrogen',
    label: 'Hydrogen',
    color: '#06b6d4',
    values: [
      { year: 2030, value: 5 },
      { year: 2035, value: 8 },
    ],
  },
];

describe('buildStackedBarRows', () => {
  test('calculates positive totals for positive-only series', () => {
    const result = buildStackedBarRows([2030, 2035], positiveSeries);

    assert.deepEqual(result.rows, [
      { year: 2030, electricity: 10, hydrogen: 5 },
      { year: 2035, electricity: 12, hydrogen: 8 },
    ]);
    assert.deepEqual(result.positiveTotals, [15, 20]);
    assert.deepEqual(result.negativeTotals, [0, 0]);
    assert.deepEqual(result.netValues, [15, 20]);
    assert.equal(result.netKey, undefined);
    assert.equal(result.hasAnyNonZero, true);
  });

  test('calculates mixed-sign totals and net values when requested', () => {
    const result = buildStackedBarRows(
      [2030, 2035],
      [
        {
          key: 'buildings',
          label: 'Buildings',
          color: '#2563eb',
          values: [
            { year: 2030, value: 25 },
            { year: 2035, value: 18 },
          ],
        },
        {
          key: 'removals',
          label: 'Removals',
          color: '#0f766e',
          values: [
            { year: 2030, value: -6 },
            { year: 2035, value: -9 },
          ],
        },
      ],
      { includeNet: true },
    );

    assert.equal(result.netKey, '__net');
    assert.deepEqual(result.rows, [
      { year: 2030, buildings: 25, removals: -6, __net: 19 },
      { year: 2035, buildings: 18, removals: -9, __net: 9 },
    ]);
    assert.deepEqual(result.positiveTotals, [25, 18]);
    assert.deepEqual(result.negativeTotals, [-6, -9]);
    assert.deepEqual(result.netValues, [19, 9]);
    assert.equal(result.hasAnyNonZero, true);
  });

  test('marks all-zero input as empty', () => {
    const result = buildStackedBarRows(
      [2030, 2035],
      [
        {
          key: 'electricity',
          label: 'Electricity',
          color: '#f59e0b',
          values: [
            { year: 2030, value: 0 },
            { year: 2035, value: 0 },
          ],
        },
      ],
      { includeNet: true },
    );

    assert.deepEqual(result.positiveTotals, [0, 0]);
    assert.deepEqual(result.negativeTotals, [0, 0]);
    assert.deepEqual(result.netValues, [0, 0]);
    assert.equal(result.hasAnyNonZero, false);
  });
});
