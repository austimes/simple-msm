import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildAdaptiveAxisNumberFormatter,
  calculateAdaptiveAxisFractionDigits,
} from '../src/pages/library/axisFormatting.ts';

describe('library axis formatting', () => {
  test('keeps one decimal place for ordinary multi-unit ranges', () => {
    const values = [4.2, 4.5, 4.9, 5.4, 6, 7];
    const formatter = buildAdaptiveAxisNumberFormatter(values, { minDomain: 0 });

    assert.equal(calculateAdaptiveAxisFractionDigits(values, { minDomain: 0 }), 1);
    assert.equal(formatter(5.2), '5.2');
    assert.equal(formatter(-0.84), '-0.8');
  });

  test('adds precision for small direct-emissions ranges', () => {
    const values = [0, 0.001205, 0.004472, 0.015438];
    const formatter = buildAdaptiveAxisNumberFormatter(values, { minDomain: 0 });

    assert.equal(calculateAdaptiveAxisFractionDigits(values, { minDomain: 0 }), 4);
    assert.equal(formatter(0.005), '0.005');
    assert.equal(formatter(0.015438), '0.0154');
  });

  test('handles very small transport-scale emissions without collapsing ticks to zero', () => {
    const values = [0, 0.000141, 0.000177];
    const formatter = buildAdaptiveAxisNumberFormatter(values, { minDomain: 0 });

    assert.equal(calculateAdaptiveAxisFractionDigits(values, { minDomain: 0 }), 6);
    assert.equal(formatter(0.00005), '0.00005');
  });

  test('retains compact notation for large ranges', () => {
    const values = [1443.388703, 1982.315112];
    const formatter = buildAdaptiveAxisNumberFormatter(values);

    assert.equal(formatter(1500), '1.5K');
  });
});
