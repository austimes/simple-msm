import assert from 'node:assert/strict';
import test from 'node:test';
import { SOLVER_CONTRACT_VERSION } from '../src/solver/contract.ts';
import { buildCostByComponentChart } from '../src/results/chartData.ts';
import { buildSolverContributionRows } from '../src/results/resultContributions.ts';

function buildRequest() {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'cost-by-component-negative-carbon',
    rows: [
      {
        rowId: 'removals_path::2030',
        outputId: 'removals_service',
        outputRole: 'required_service',
        outputLabel: 'Removals service',
        year: 2030,
        stateId: 'removals_path',
        stateLabel: 'Removals path',
        sector: 'removals_negative_emissions',
        subsector: 'land_sequestration',
        region: 'national',
        outputUnit: 'MtCO2e',
        conversionCostPerUnit: 5,
        inputs: [
          {
            commodityId: 'electricity',
            coefficient: 2,
            unit: 'MWh',
          },
        ],
        directEmissions: [
          {
            pollutant: 'co2',
            value: -3,
            source: 'process',
          },
        ],
        bounds: {
          minShare: null,
          maxShare: null,
          maxActivity: null,
        },
      },
      {
        rowId: 'removals_path::2035',
        outputId: 'removals_service',
        outputRole: 'required_service',
        outputLabel: 'Removals service',
        year: 2035,
        stateId: 'removals_path',
        stateLabel: 'Removals path',
        sector: 'removals_negative_emissions',
        subsector: 'land_sequestration',
        region: 'national',
        outputUnit: 'MtCO2e',
        conversionCostPerUnit: 5,
        inputs: [
          {
            commodityId: 'electricity',
            coefficient: 2,
            unit: 'MWh',
          },
        ],
        directEmissions: [
          {
            pollutant: 'co2',
            value: -3,
            source: 'process',
          },
        ],
        bounds: {
          minShare: null,
          maxShare: null,
          maxActivity: null,
        },
      },
    ],
    configuration: {
      name: 'Negative carbon cost regression',
      description: null,
      years: [2030, 2035],
      controlsByOutput: {
        removals_service: {
          2030: {
            mode: 'optimize',
            activeStateIds: null,
            targetValue: null,
          },
          2035: {
            mode: 'optimize',
            activeStateIds: null,
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        removals_service: { 2030: 4, 2035: 6 },
      },
      externalCommodityDemandByCommodity: {},
      commodityPriceByCommodity: {
        electricity: {
          unit: 'AUD/MWh',
          valuesByYear: { 2030: 10, 2035: 10 },
        },
      },
      carbonPriceByYear: { 2030: 20, 2035: 20 },
      options: {
        respectMaxShare: true,
        respectMaxActivity: true,
        softConstraints: false,
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
    requestId: 'cost-by-component-negative-carbon',
    status: 'solved',
    engine: { name: 'yalps', worker: true },
    summary: {
      rowCount: 2,
      yearCount: 2,
      outputCount: 1,
      serviceDemandOutputCount: 1,
      externalCommodityCount: 0,
    },
    reporting: {
      commodityBalances: [],
      stateShares: [
        {
          outputId: 'removals_service',
          outputLabel: 'Removals service',
          year: 2030,
          stateId: 'removals_path',
          stateLabel: 'Removals path',
          activity: 4,
          share: 1,
          rawMaxShare: null,
          effectiveMaxShare: null,
        },
        {
          outputId: 'removals_service',
          outputLabel: 'Removals service',
          year: 2035,
          stateId: 'removals_path',
          stateLabel: 'Removals path',
          activity: 6,
          share: 1,
          rawMaxShare: null,
          effectiveMaxShare: null,
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

test('buildCostByComponentChart preserves negative carbon values for diverging stacks', () => {
  const request = buildRequest();
  const result = buildResult();
  const contributions = buildSolverContributionRows(request, result);
  const years = request.configuration.years;
  const chart = buildCostByComponentChart(contributions, years);

  assert.equal(chart.title, 'Cost by Component');
  assert.equal(chart.yAxisLabel, 'Cost');
  assert.deepEqual(chart.years, [2030, 2035]);
  assert.deepEqual(chart.series.map((series) => series.label), ['Conversion', 'Commodity', 'Carbon']);
  assert.deepEqual(
    chart.series.find((series) => series.label === 'Conversion')?.values,
    [
      { year: 2030, value: 20 },
      { year: 2035, value: 30 },
    ],
  );
  assert.deepEqual(
    chart.series.find((series) => series.label === 'Commodity')?.values,
    [
      { year: 2030, value: 80 },
      { year: 2035, value: 120 },
    ],
  );
  assert.deepEqual(
    chart.series.find((series) => series.label === 'Carbon')?.values,
    [
      { year: 2030, value: -240 },
      { year: 2035, value: -360 },
    ],
  );
});
