import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { AdditionalityReport } from '../src/additionality/additionalityAnalysis.ts';
import {
  buildAdditionalityWaterfallRows,
  getAdditionalityMetricPresentation,
} from '../src/pages/additionalityPageModel.ts';

function buildSequence(
  deltas: Array<{
    key: string;
    label: string;
    objective: number;
    cumulativeEmissions: number;
    electricityDemand2050: number;
  }>,
): AdditionalityReport['sequence'] {
  let objective = 100;
  let cumulativeEmissions = 400;
  let electricityDemand2050 = 120;

  return deltas.map((entry, index) => {
    const metricsBefore = {
      objective,
      cumulativeEmissions,
      electricityDemand2050,
    };
    const metricsAfter = {
      objective: objective + entry.objective,
      cumulativeEmissions: cumulativeEmissions + entry.cumulativeEmissions,
      electricityDemand2050: electricityDemand2050 + entry.electricityDemand2050,
    };

    objective = metricsAfter.objective;
    cumulativeEmissions = metricsAfter.cumulativeEmissions;
    electricityDemand2050 = metricsAfter.electricityDemand2050;

    return {
      step: index + 1,
      atom: {
        key: entry.key,
        outputId: 'test_output',
        outputLabel: 'Test output',
        stateId: `${entry.key}_state`,
        stateLabel: entry.label,
        action: 'enable' as const,
      },
      metricsBefore,
      metricsAfter,
      metricsDeltaFromCurrent: {
        objective: entry.objective,
        cumulativeEmissions: entry.cumulativeEmissions,
        electricityDemand2050: entry.electricityDemand2050,
      },
      absObjectiveDelta: Math.abs(entry.objective),
      skippedCandidateCount: 0,
    };
  });
}

describe('additionalityPageModel', () => {
  test('formats cost presentation values in billions of AUD', () => {
    const metric = getAdditionalityMetricPresentation('objective');

    assert.equal(metric.unitLabel, '$B');
    assert.equal(metric.convertRawToDisplay(12_345_000_000), 12.345);
    assert.equal(metric.formatAbsoluteValue(12_345_000_000), '$12.35B');
    assert.equal(metric.formatSignedValue(640_000_000), '+$0.64B');
    assert.equal(metric.formatSignedValue(-640_000_000), '-$0.64B');
  });

  test('formats emissions presentation values in megatonnes of CO2e', () => {
    const metric = getAdditionalityMetricPresentation('cumulativeEmissions');

    assert.equal(metric.unitLabel, 'MtCO2e');
    assert.equal(metric.convertRawToDisplay(842_110_000), 842.11);
    assert.equal(metric.formatAbsoluteValue(842_110_000), '842.11 MtCO2e');
    assert.equal(metric.formatSignedValue(-42_880_000), '-42.88 MtCO2e');
  });

  test('formats 2050 electricity demand from raw MWh into TWh', () => {
    const metric = getAdditionalityMetricPresentation('electricityDemand2050');

    assert.equal(metric.unitLabel, 'TWh');
    assert.equal(metric.convertRawToDisplay(292_523_236.87), 292.52323687);
    assert.equal(metric.formatAbsoluteValue(292_523_236.87), '292.52 TWh');
    assert.equal(metric.formatSignedValue(85_530_212.12), '+85.53 TWh');
    assert.equal(metric.formatSignedValue(-85_530_212.12), '-85.53 TWh');
  });

  test('builds positive waterfall running totals that end at the total delta', () => {
    const sequence = buildSequence([
      {
        key: 'passenger',
        label: 'Passenger road transport',
        objective: 10,
        cumulativeEmissions: -4,
        electricityDemand2050: 6,
      },
      {
        key: 'heat',
        label: 'Low-temperature heat',
        objective: 8,
        cumulativeEmissions: -7,
        electricityDemand2050: 5,
      },
    ]);

    const rows = buildAdditionalityWaterfallRows(sequence, 'objective', ['Step 1', 'Step 2']);

    assert.deepEqual(rows, [
      {
        key: 'passenger:objective',
        label: 'Step 1',
        delta: 10,
        cumulativeBefore: 0,
        cumulativeAfter: 10,
      },
      {
        key: 'heat:objective',
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
        objective: 3,
        cumulativeEmissions: -5,
        electricityDemand2050: 1,
      },
      {
        key: 'cement',
        label: 'Cement',
        objective: 2,
        cumulativeEmissions: -7,
        electricityDemand2050: 2,
      },
    ]);

    const rows = buildAdditionalityWaterfallRows(sequence, 'cumulativeEmissions', ['Step 1', 'Step 2']);

    assert.deepEqual(rows, [
      {
        key: 'buildings:cumulativeEmissions',
        label: 'Step 1',
        delta: -5,
        cumulativeBefore: 0,
        cumulativeAfter: -5,
      },
      {
        key: 'cement:cumulativeEmissions',
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
        objective: 12,
        cumulativeEmissions: -2,
        electricityDemand2050: 9,
      },
      {
        key: 'industry',
        label: 'Industry',
        objective: -20,
        cumulativeEmissions: 3,
        electricityDemand2050: -12,
      },
      {
        key: 'steady',
        label: 'Steady',
        objective: 0,
        cumulativeEmissions: 0,
        electricityDemand2050: 0,
      },
    ]);

    const rows = buildAdditionalityWaterfallRows(sequence, 'objective', ['Step 1', 'Step 2', 'Step 3']);

    assert.deepEqual(
      rows.map((row) => ({
        label: row.label,
        delta: row.delta,
        cumulativeBefore: row.cumulativeBefore,
        cumulativeAfter: row.cumulativeAfter,
      })),
      [
        {
          label: 'Step 1',
          delta: 12,
          cumulativeBefore: 0,
          cumulativeAfter: 12,
        },
        {
          label: 'Step 2',
          delta: -20,
          cumulativeBefore: 12,
          cumulativeAfter: -8,
        },
        {
          label: 'Step 3',
          delta: 0,
          cumulativeBefore: -8,
          cumulativeAfter: -8,
        },
      ],
    );
    assert.equal(rows.at(-1)?.cumulativeAfter, sequence.at(-1)?.metricsAfter.objective - sequence[0]?.metricsBefore.objective);
  });
});
