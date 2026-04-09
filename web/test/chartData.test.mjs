import assert from 'node:assert/strict';
import test from 'node:test';
import { SOLVER_CONTRACT_VERSION } from '../src/solver/contract.ts';
import { buildPathwayChartCards } from '../src/results/chartData.ts';

function buildRequest(respectMaxShare) {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: `chart-data-${respectMaxShare ? 'capped' : 'uncapped'}`,
    rows: [
      {
        rowId: 'heat_a::2030',
        outputId: 'heat',
        outputRole: 'required_service',
        outputLabel: 'Heat',
        year: 2030,
        stateId: 'heat_a',
        stateLabel: 'Heat A',
        sector: 'test',
        subsector: 'test',
        region: 'national',
        outputUnit: 'PJ',
        conversionCostPerUnit: 1,
        inputs: [],
        directEmissions: [],
        bounds: {
          minShare: null,
          maxShare: 0.4,
          maxActivity: null,
        },
      },
      {
        rowId: 'heat_b::2030',
        outputId: 'heat',
        outputRole: 'required_service',
        outputLabel: 'Heat',
        year: 2030,
        stateId: 'heat_b',
        stateLabel: 'Heat B',
        sector: 'test',
        subsector: 'test',
        region: 'national',
        outputUnit: 'PJ',
        conversionCostPerUnit: 2,
        inputs: [],
        directEmissions: [],
        bounds: {
          minShare: null,
          maxShare: null,
          maxActivity: null,
        },
      },
      {
        rowId: 'heat_a::2035',
        outputId: 'heat',
        outputRole: 'required_service',
        outputLabel: 'Heat',
        year: 2035,
        stateId: 'heat_a',
        stateLabel: 'Heat A',
        sector: 'test',
        subsector: 'test',
        region: 'national',
        outputUnit: 'PJ',
        conversionCostPerUnit: 1,
        inputs: [],
        directEmissions: [],
        bounds: {
          minShare: null,
          maxShare: 0.2,
          maxActivity: null,
        },
      },
      {
        rowId: 'heat_b::2035',
        outputId: 'heat',
        outputRole: 'required_service',
        outputLabel: 'Heat',
        year: 2035,
        stateId: 'heat_b',
        stateLabel: 'Heat B',
        sector: 'test',
        subsector: 'test',
        region: 'national',
        outputUnit: 'PJ',
        conversionCostPerUnit: 2,
        inputs: [],
        directEmissions: [],
        bounds: {
          minShare: null,
          maxShare: null,
          maxActivity: null,
        },
      },
    ],
    configuration: {
      name: 'Chart data regression',
      description: null,
      years: [2030, 2035],
      controlsByOutput: {
        heat: {
          2030: {
            mode: 'optimize',
            stateId: null,
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
          2035: {
            mode: 'optimize',
            stateId: null,
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        heat: { 2030: 100, 2035: 100 },
      },
      externalCommodityDemandByCommodity: {},
      commodityPriceByCommodity: {},
      carbonPriceByYear: { 2030: 0, 2035: 0 },
      options: {
        respectMaxShare,
        respectMaxActivity: true,
        softConstraints: false,
        allowRemovalsCredit: false,
        shareSmoothing: {
          enabled: false,
          maxDeltaPp: null,
        },
      },
    },
  };
}

function buildResult() {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'chart-data-regression',
    status: 'solved',
    engine: { name: 'yalps', worker: true },
    summary: {
      rowCount: 4,
      yearCount: 2,
      outputCount: 1,
      serviceDemandOutputCount: 1,
      externalCommodityCount: 0,
    },
    reporting: {
      commodityBalances: [],
      stateShares: [
        {
          outputId: 'heat',
          outputLabel: 'Heat',
          year: 2030,
          stateId: 'heat_a',
          stateLabel: 'Heat A',
          activity: 80,
          share: 0.8,
          rawMaxShare: 0.4,
          effectiveMaxShare: 0.2857142857142857,
        },
        {
          outputId: 'heat',
          outputLabel: 'Heat',
          year: 2030,
          stateId: 'heat_b',
          stateLabel: 'Heat B',
          activity: 20,
          share: 0.2,
          rawMaxShare: null,
          effectiveMaxShare: 0.7142857142857143,
        },
        {
          outputId: 'heat',
          outputLabel: 'Heat',
          year: 2035,
          stateId: 'heat_a',
          stateLabel: 'Heat A',
          activity: 40,
          share: 0.4,
          rawMaxShare: 0.2,
          effectiveMaxShare: 0.16666666666666669,
        },
        {
          outputId: 'heat',
          outputLabel: 'Heat',
          year: 2035,
          stateId: 'heat_b',
          stateLabel: 'Heat B',
          activity: 60,
          share: 0.6,
          rawMaxShare: null,
          effectiveMaxShare: 0.8333333333333334,
        },
      ],
      bindingConstraints: [],
      softConstraintViolations: [],
    },
    raw: null,
    diagnostics: [],
    timingsMs: {
      total: 0,
      solve: 0,
    },
  };
}

test('buildPathwayChartCards returns output and cap views for selectable outputs', () => {
  const cards = buildPathwayChartCards(buildRequest(true), buildResult());

  assert.equal(cards.length, 1);
  assert.equal(cards[0].outputId, 'heat');
  assert.equal(cards[0].outputChart.yAxisLabel, 'PJ');
  assert.equal(cards[0].outputChart.series.length, 2);
  assert.deepEqual(
    cards[0].outputChart.series.find((series) => series.label === 'Heat A')?.values,
    [
      { year: 2030, value: 80 },
      { year: 2035, value: 40 },
    ],
  );
  assert.deepEqual(
    cards[0].capChart.series.find((series) => series.label === 'Heat A')?.values,
    [
      { year: 2030, value: 28.57142857142857 },
      { year: 2035, value: 16.666666666666668 },
    ],
  );
  assert.match(cards[0].note, /normalizing the enabled pathways/i);
});

test('buildPathwayChartCards keeps cap context visible when max-share enforcement is off', () => {
  const cards = buildPathwayChartCards(buildRequest(false), buildResult());

  assert.equal(cards.length, 1);
  assert.equal(cards[0].respectMaxShare, false);
  assert.match(cards[0].note, /ignored in this solve/i);
  assert.deepEqual(
    cards[0].capChart.series.find((series) => series.label === 'Heat B')?.values,
    [
      { year: 2030, value: 71.42857142857143 },
      { year: 2035, value: 83.33333333333334 },
    ],
  );
});
