import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { AdditionalityReport } from '../src/additionality/additionalityAnalysis.ts';
import {
  buildAdditionalityReferenceRows,
  buildAdditionalitySavingsStackRows,
  buildAdditionalityWaterfallRows,
  getAdditionalityMetricPresentation,
} from '../src/pages/additionalityPageModel.ts';

function buildSequence(
  deltas: Array<{
    key: string;
    label: string;
    cost: number;
    emissions: number;
    fuelEnergy: number;
  }>,
): AdditionalityReport['sequence'] {
  let cost = 100;
  let emissions = 400;
  let fuelEnergy = 120;

  return deltas.map((entry, index) => {
    const metricsBefore = {
      cost,
      emissions,
      fuelEnergy,
      byYear: {},
    };
    const metricsAfter = {
      cost: cost + entry.cost,
      emissions: emissions + entry.emissions,
      fuelEnergy: fuelEnergy + entry.fuelEnergy,
      byYear: {},
    };

    cost = metricsAfter.cost;
    emissions = metricsAfter.emissions;
    fuelEnergy = metricsAfter.fuelEnergy;

    return {
      step: index + 1,
      atom: {
        key: entry.key,
        kind: 'state' as const,
        category: 'other_state_change' as const,
        outputId: 'test_output',
        outputLabel: 'Test output',
        stateId: `${entry.key}_state`,
        stateLabel: entry.label,
        label: entry.label,
        action: 'enable' as const,
      },
      metricsBefore,
      metricsAfter,
      metricsDeltaFromCurrent: {
        cost: entry.cost,
        emissions: entry.emissions,
        fuelEnergy: entry.fuelEnergy,
        byYear: {},
      },
      absCostDelta: Math.abs(entry.cost),
      skippedCandidateCount: 0,
    };
  });
}

describe('additionalityPageModel', () => {
  test('formats cost presentation values in billions of AUD', () => {
    const metric = getAdditionalityMetricPresentation('cost');

    assert.equal(metric.unitLabel, '$B');
    assert.equal(metric.convertRawToDisplay(12_345_000_000), 12.345);
    assert.equal(metric.formatAbsoluteValue(12_345_000_000), '$12.35B');
    assert.equal(metric.formatSignedValue(640_000_000), '+$0.64B');
    assert.equal(metric.formatSignedValue(-640_000_000), '-$0.64B');
  });

  test('formats emissions presentation values in megatonnes of CO2e', () => {
    const metric = getAdditionalityMetricPresentation('emissions');

    assert.equal(metric.unitLabel, 'MtCO2e');
    assert.equal(metric.convertRawToDisplay(842_110_000), 842.11);
    assert.equal(metric.formatAbsoluteValue(842_110_000), '842.11 MtCO2e');
    assert.equal(metric.formatSignedValue(-42_880_000), '-42.88 MtCO2e');
  });

  test('formats fuel and energy values in PJ', () => {
    const metric = getAdditionalityMetricPresentation('fuelEnergy');

    assert.equal(metric.unitLabel, 'PJ');
    assert.equal(metric.convertRawToDisplay(292.523), 292.523);
    assert.equal(metric.formatAbsoluteValue(292.523), '292.52 PJ');
    assert.equal(metric.formatSignedValue(85.530), '+85.53 PJ');
    assert.equal(metric.formatSignedValue(-85.530), '-85.53 PJ');
  });

  test('builds positive waterfall running totals that end at the total delta', () => {
    const sequence = buildSequence([
      {
        key: 'passenger',
        label: 'Passenger road transport',
        cost: 10,
        emissions: -4,
        fuelEnergy: 6,
      },
      {
        key: 'heat',
        label: 'Low-temperature heat',
        cost: 8,
        emissions: -7,
        fuelEnergy: 5,
      },
    ]);

    const rows = buildAdditionalityWaterfallRows(sequence, 'cost', ['Step 1', 'Step 2']);

    assert.deepEqual(rows, [
      {
        key: 'passenger:cost',
        interactionKey: 'passenger',
        label: 'Step 1',
        delta: 10,
        cumulativeBefore: 0,
        cumulativeAfter: 10,
      },
      {
        key: 'heat:cost',
        interactionKey: 'heat',
        label: 'Step 2',
        delta: 8,
        cumulativeBefore: 10,
        cumulativeAfter: 18,
      },
    ]);
    assert.equal(rows.at(-1)?.cumulativeAfter, 18);
  });

  test('builds negative waterfall running totals that end at the total delta', () => {
    const sequence = buildSequence([
      {
        key: 'buildings',
        label: 'Buildings',
        cost: 3,
        emissions: -5,
        fuelEnergy: 1,
      },
      {
        key: 'cement',
        label: 'Cement',
        cost: 2,
        emissions: -7,
        fuelEnergy: 2,
      },
    ]);

    const rows = buildAdditionalityWaterfallRows(sequence, 'emissions', ['Step 1', 'Step 2']);

    assert.deepEqual(rows, [
      {
        key: 'buildings:emissions',
        interactionKey: 'buildings',
        label: 'Step 1',
        delta: -5,
        cumulativeBefore: 0,
        cumulativeAfter: -5,
      },
      {
        key: 'cement:emissions',
        interactionKey: 'cement',
        label: 'Step 2',
        delta: -7,
        cumulativeBefore: -5,
        cumulativeAfter: -12,
      },
    ]);
    assert.equal(rows.at(-1)?.cumulativeAfter, -12);
  });

  test('preserves mixed-sign and zero-delta rows while crossing zero', () => {
    const sequence = buildSequence([
      {
        key: 'freight',
        label: 'Freight',
        cost: 12,
        emissions: -2,
        fuelEnergy: 9,
      },
      {
        key: 'industry',
        label: 'Industry',
        cost: -20,
        emissions: 3,
        fuelEnergy: -12,
      },
      {
        key: 'steady',
        label: 'Steady',
        cost: 0,
        emissions: 0,
        fuelEnergy: 0,
      },
    ]);

    const rows = buildAdditionalityWaterfallRows(sequence, 'cost', ['Step 1', 'Step 2', 'Step 3']);

    assert.deepEqual(
      rows.map((row) => ({
        interactionKey: row.interactionKey,
        label: row.label,
        delta: row.delta,
        cumulativeBefore: row.cumulativeBefore,
        cumulativeAfter: row.cumulativeAfter,
      })),
      [
        {
          interactionKey: 'freight',
          label: 'Step 1',
          delta: 12,
          cumulativeBefore: 0,
          cumulativeAfter: 12,
        },
        {
          interactionKey: 'industry',
          label: 'Step 2',
          delta: -20,
          cumulativeBefore: 12,
          cumulativeAfter: -8,
        },
        {
          interactionKey: 'steady',
          label: 'Step 3',
          delta: 0,
          cumulativeBefore: -8,
          cumulativeAfter: -8,
        },
      ],
    );
    assert.equal(rows.at(-1)?.cumulativeAfter, sequence.at(-1)?.metricsAfter.cost - sequence[0]?.metricsBefore.cost);
  });

  test('builds zero-valued reference rows with canonical interaction keys', () => {
    const sequence = buildSequence([
      {
        key: 'passenger',
        label: 'Passenger road transport',
        cost: 10,
        emissions: -4,
        fuelEnergy: 6,
      },
      {
        key: 'heat',
        label: 'Low-temperature heat',
        cost: 8,
        emissions: -7,
        fuelEnergy: 5,
      },
    ]);

    const rows = buildAdditionalityReferenceRows(sequence, ['Step 1', 'Step 2']);

    assert.deepEqual(rows, [
      {
        key: 'passenger:reference',
        interactionKey: 'passenger',
        label: 'Step 1',
        delta: 0,
        cumulativeBefore: 0,
        cumulativeAfter: 0,
      },
      {
        key: 'heat:reference',
        interactionKey: 'heat',
        label: 'Step 2',
        delta: 0,
        cumulativeBefore: 0,
        cumulativeAfter: 0,
      },
    ]);
  });

  test('builds savings stack rows from Focus back to Base', () => {
    const sequence = buildSequence([
      {
        key: 'package',
        label: 'Package',
        cost: -10,
        emissions: -4,
        fuelEnergy: -3,
      },
      {
        key: 'state',
        label: 'State',
        cost: 2,
        emissions: 1,
        fuelEnergy: 0,
      },
    ]);
    const report = {
      baseMetrics: { cost: 100, emissions: 50, fuelEnergy: 20, byYear: {} },
      targetMetrics: { cost: 92, emissions: 47, fuelEnergy: 17, byYear: {} },
      sequence,
    } as AdditionalityReport;

    const rows = buildAdditionalitySavingsStackRows(report, 'cost', ['Package', 'State']);

    assert.deepEqual(rows.map((row) => ({
      interactionKey: row.interactionKey,
      label: row.label,
      delta: row.delta,
      cumulativeBefore: row.cumulativeBefore,
      cumulativeAfter: row.cumulativeAfter,
    })), [
      {
        interactionKey: 'package',
        label: 'Package',
        delta: 10,
        cumulativeBefore: 0,
        cumulativeAfter: 10,
      },
      {
        interactionKey: 'state',
        label: 'State',
        delta: -2,
        cumulativeBefore: 10,
        cumulativeAfter: 8,
      },
    ]);
  });
});
