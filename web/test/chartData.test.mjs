import assert from 'node:assert/strict';
import test from 'node:test';
import { SOLVER_CONTRACT_VERSION } from '../src/solver/contract.ts';
import { solveWithLpAdapter } from '../src/solver/lpAdapter.ts';
import {
  buildCostByComponentChart,
  buildEmissionsBySectorChart,
  buildEmissionsBySubsectorChart,
  buildFuelConsumptionChart,
  buildPathwayChartCards,
} from '../src/results/chartData.ts';
import { buildSolverContributionRows } from '../src/results/resultContributions.ts';

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
    objectiveCost: {
      currency: 'AUD_2024',
      costBasisYear: 2024,
    },
    configuration: {
      name: 'Chart data regression',
      description: null,
      years: [2030, 2035],
      controlsByOutput: {
        heat: {
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
        heat: { 2030: 100, 2035: 100 },
      },
      externalCommodityDemandByCommodity: {},
      commodityPriceByCommodity: {},
      carbonPriceByYear: { 2030: 0, 2035: 0 },
      options: {
        respectMaxShare,
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

function buildEmissionsRequest() {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'chart-data-emissions',
    rows: [
      {
        rowId: 'buildings_incumbent::2030',
        outputId: 'buildings_service',
        outputRole: 'required_service',
        outputLabel: 'Buildings service',
        year: 2030,
        stateId: 'buildings_incumbent',
        stateLabel: 'Buildings incumbent',
        sector: 'buildings',
        subsector: 'residential_buildings',
        region: 'national',
        outputUnit: 'GJ_service_eq',
        conversionCostPerUnit: 1,
        inputs: [],
        directEmissions: [
          { pollutant: 'CO2e', value: 0.5, source: 'energy' },
        ],
        bounds: {
          minShare: null,
          maxShare: null,
          maxActivity: null,
        },
      },
      {
        rowId: 'removals_daccs::2030',
        outputId: 'removals_service',
        outputRole: 'optional_activity',
        outputLabel: 'Removals service',
        year: 2030,
        stateId: 'removals_daccs',
        stateLabel: 'DACCS',
        sector: 'removals_negative_emissions',
        subsector: 'engineered_removals',
        region: 'national',
        outputUnit: 'tCO2_removed',
        conversionCostPerUnit: 1,
        inputs: [],
        directEmissions: [
          { pollutant: 'CO2e', value: -1, source: 'process' },
        ],
        bounds: {
          minShare: null,
          maxShare: null,
          maxActivity: null,
        },
      },
      {
        rowId: 'buildings_incumbent::2035',
        outputId: 'buildings_service',
        outputRole: 'required_service',
        outputLabel: 'Buildings service',
        year: 2035,
        stateId: 'buildings_incumbent',
        stateLabel: 'Buildings incumbent',
        sector: 'buildings',
        subsector: 'residential_buildings',
        region: 'national',
        outputUnit: 'GJ_service_eq',
        conversionCostPerUnit: 1,
        inputs: [],
        directEmissions: [
          { pollutant: 'CO2e', value: 0.3, source: 'energy' },
        ],
        bounds: {
          minShare: null,
          maxShare: null,
          maxActivity: null,
        },
      },
      {
        rowId: 'removals_daccs::2035',
        outputId: 'removals_service',
        outputRole: 'optional_activity',
        outputLabel: 'Removals service',
        year: 2035,
        stateId: 'removals_daccs',
        stateLabel: 'DACCS',
        sector: 'removals_negative_emissions',
        subsector: 'engineered_removals',
        region: 'national',
        outputUnit: 'tCO2_removed',
        conversionCostPerUnit: 1,
        inputs: [],
        directEmissions: [
          { pollutant: 'CO2e', value: -0.5, source: 'process' },
        ],
        bounds: {
          minShare: null,
          maxShare: null,
          maxActivity: null,
        },
      },
    ],
    objectiveCost: {
      currency: 'AUD_2024',
      costBasisYear: 2024,
    },
    configuration: {
      name: 'Emissions chart regression',
      description: null,
      years: [2030, 2035],
      controlsByOutput: {},
      serviceDemandByOutput: {},
      externalCommodityDemandByCommodity: {},
      commodityPriceByCommodity: {},
      carbonPriceByYear: { 2030: 0, 2035: 0 },
      options: {
        respectMaxShare: true,
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

function buildEmissionsResult() {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'chart-data-emissions',
    status: 'solved',
    engine: { name: 'yalps', worker: true },
    summary: {
      rowCount: 4,
      yearCount: 2,
      outputCount: 2,
      serviceDemandOutputCount: 1,
      externalCommodityCount: 0,
    },
    reporting: {
      commodityBalances: [],
      stateShares: [
        {
          outputId: 'buildings_service',
          outputLabel: 'Buildings service',
          year: 2030,
          stateId: 'buildings_incumbent',
          stateLabel: 'Buildings incumbent',
          activity: 100,
          share: 1,
          rawMaxShare: null,
          effectiveMaxShare: null,
        },
        {
          outputId: 'removals_service',
          outputLabel: 'Removals service',
          year: 2030,
          stateId: 'removals_daccs',
          stateLabel: 'DACCS',
          activity: 20,
          share: 1,
          rawMaxShare: null,
          effectiveMaxShare: null,
        },
        {
          outputId: 'buildings_service',
          outputLabel: 'Buildings service',
          year: 2035,
          stateId: 'buildings_incumbent',
          stateLabel: 'Buildings incumbent',
          activity: 80,
          share: 1,
          rawMaxShare: null,
          effectiveMaxShare: null,
        },
        {
          outputId: 'removals_service',
          outputLabel: 'Removals service',
          year: 2035,
          stateId: 'removals_daccs',
          stateLabel: 'DACCS',
          activity: 10,
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

test('emissions charts expose tCO2e axis labels and preserve negative removals', () => {
  const request = buildEmissionsRequest();
  const result = buildEmissionsResult();
  const contributions = buildSolverContributionRows(request, result);
  const years = request.configuration.years;

  const sectorChart = buildEmissionsBySectorChart(contributions, years);
  const subsectorChart = buildEmissionsBySubsectorChart(contributions, years);

  assert.equal(sectorChart.yAxisLabel, 'Emissions (tCO2e)');
  assert.equal(subsectorChart.yAxisLabel, 'Emissions (tCO2e)');
  assert.deepEqual(
    sectorChart.series.find((series) => series.label === 'buildings')?.values,
    [
      { year: 2030, value: 50 },
      { year: 2035, value: 24 },
    ],
  );
  assert.deepEqual(
    sectorChart.series.find((series) => series.label === 'removals_negative_emissions')?.values,
    [
      { year: 2030, value: -20 },
      { year: 2035, value: -5 },
    ],
  );
  assert.deepEqual(
    subsectorChart.series.find((series) => series.label === 'removals_negative_emissions')?.values,
    [
      { year: 2030, value: -20 },
      { year: 2035, value: -5 },
    ],
  );
});

test('buildPathwayChartCards returns output and cap views for selectable outputs', () => {
  const cards = buildPathwayChartCards(buildRequest(true), buildResult());

  assert.equal(cards.length, 1);
  assert.equal(cards[0].outputId, 'heat');
  assert.equal(cards[0].outputChart.yAxisLabel, 'PJ');
  assert.match(cards[0].capChart.yAxisLabel, /current cap denominator/i);
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
});

test('buildPathwayChartCards keeps cap context visible when max-share enforcement is off', () => {
  const cards = buildPathwayChartCards(buildRequest(false), buildResult());

  assert.equal(cards.length, 1);
  assert.deepEqual(
    cards[0].capChart.series.find((series) => series.label === 'Heat B')?.values,
    [
      { year: 2030, value: 71.42857142857143 },
      { year: 2035, value: 83.33333333333334 },
    ],
  );
});

test('buildPathwayChartCards matches solver-reported effective caps for exact-share runs', () => {
  const request = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'chart-data-exact-share-cap-alignment',
    rows: [
      {
        rowId: 'selected_a::2030',
        outputId: 'exact_share_service',
        outputRole: 'required_service',
        outputLabel: 'Exact Share Service',
        year: 2030,
        stateId: 'selected_a',
        stateLabel: 'Selected A',
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
        rowId: 'available_b::2030',
        outputId: 'exact_share_service',
        outputRole: 'required_service',
        outputLabel: 'Exact Share Service',
        year: 2030,
        stateId: 'available_b',
        stateLabel: 'Available B',
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
    objectiveCost: {
      currency: 'AUD_2024',
      costBasisYear: 2024,
    },
    configuration: {
      name: 'Exact-share CAP alignment',
      description: null,
      years: [2030],
      controlsByOutput: {
        exact_share_service: {
          2030: {
            mode: 'fixed_shares',
            activeStateIds: ['selected_a'],
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        exact_share_service: { 2030: 100 },
      },
      externalCommodityDemandByCommodity: {},
      commodityPriceByCommodity: {},
      carbonPriceByYear: { 2030: 0 },
      options: {
        respectMaxShare: false,
        respectMaxActivity: true,
        softConstraints: false,
        shareSmoothing: {
          enabled: false,
          maxDeltaPp: null,
        },
      },
    },
  };

  const result = solveWithLpAdapter(request);
  const cards = buildPathwayChartCards(request, result);
  const selectedShare = result.reporting.stateShares.find((share) => share.stateId === 'selected_a');
  const availableShare = result.reporting.stateShares.find((share) => share.stateId === 'available_b');
  const card = cards[0];
  const selectedCap = card.capChart.series.find((series) => series.label === 'Selected A')?.values[0]?.value;
  const availableCap = card.capChart.series.find((series) => series.label === 'Available B')?.values[0]?.value;

  assert.equal(result.status, 'solved');
  assert.equal(cards.length, 1);
  assert.ok(selectedShare?.effectiveMaxShare != null, 'expected selected exact-share cap');
  assert.equal(availableShare?.effectiveMaxShare, null, 'inactive pathways are excluded from cap normalization');
  assert.ok(Math.abs(selectedCap - (selectedShare.effectiveMaxShare * 100)) < 1e-9);
});

function buildFuelAndCostRequest() {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'chart-data-fuel-and-cost',
    rows: [
      {
        rowId: 'fuel_mix::2030',
        outputId: 'test_service',
        outputRole: 'required_service',
        outputLabel: 'Test service',
        year: 2030,
        stateId: 'fuel_mix',
        stateLabel: 'Fuel Mix',
        sector: 'test',
        subsector: 'test',
        region: 'national',
        outputUnit: 'unit',
        conversionCostPerUnit: 25,
        inputs: [
          { commodityId: 'coal', coefficient: 1_000_000, unit: 'GJ/unit' },
          { commodityId: 'natural_gas', coefficient: 500_000, unit: 'GJ/unit' },
          { commodityId: 'electricity', coefficient: 100_000, unit: 'MWh/unit' },
          { commodityId: 'iron_ore', coefficient: 25, unit: 't/unit' },
        ],
        directEmissions: [{ pollutant: 'CO2e', value: 2, source: 'energy' }],
        bounds: {
          minShare: null,
          maxShare: null,
          maxActivity: null,
        },
      },
      {
        rowId: 'fuel_mix::2035',
        outputId: 'test_service',
        outputRole: 'required_service',
        outputLabel: 'Test service',
        year: 2035,
        stateId: 'fuel_mix',
        stateLabel: 'Fuel Mix',
        sector: 'test',
        subsector: 'test',
        region: 'national',
        outputUnit: 'unit',
        conversionCostPerUnit: 30,
        inputs: [
          { commodityId: 'refined_liquid_fuels', coefficient: 250_000, unit: 'GJ/unit' },
          { commodityId: 'biomass', coefficient: 125_000, unit: 'GJ/unit' },
          { commodityId: 'hydrogen', coefficient: 80_000, unit: 'GJ/unit' },
          { commodityId: 'scrap_steel', coefficient: 10, unit: 't/unit' },
          { commodityId: 'sequestration_service', coefficient: 5, unit: 'tCO2_stored/unit' },
        ],
        directEmissions: [{ pollutant: 'CO2e', value: 1, source: 'energy' }],
        bounds: {
          minShare: null,
          maxShare: null,
          maxActivity: null,
        },
      },
    ],
    objectiveCost: {
      currency: 'AUD_2024',
      costBasisYear: 2024,
    },
    configuration: {
      name: 'Fuel chart regression',
      description: null,
      years: [2030, 2035],
      controlsByOutput: {},
      serviceDemandByOutput: {
        test_service: { 2030: 1, 2035: 1 },
      },
      externalCommodityDemandByCommodity: {},
      commodityPriceByCommodity: {
        coal: { unit: 'AUD_2024_per_GJ', valuesByYear: { 2030: 1, 2035: 1 } },
        natural_gas: { unit: 'AUD_2024_per_GJ', valuesByYear: { 2030: 2, 2035: 2 } },
        electricity: { unit: 'AUD_2024_per_MWh', valuesByYear: { 2030: 3, 2035: 3 } },
        refined_liquid_fuels: { unit: 'AUD_2024_per_GJ', valuesByYear: { 2030: 4, 2035: 4 } },
        biomass: { unit: 'AUD_2024_per_GJ', valuesByYear: { 2030: 5, 2035: 5 } },
        hydrogen: { unit: 'AUD_2024_per_GJ', valuesByYear: { 2030: 6, 2035: 6 } },
      },
      carbonPriceByYear: { 2030: 10, 2035: 10 },
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

function buildFuelAndCostResult() {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'chart-data-fuel-and-cost',
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
          outputId: 'test_service',
          outputLabel: 'Test service',
          year: 2030,
          stateId: 'fuel_mix',
          stateLabel: 'Fuel Mix',
          activity: 1,
          share: 1,
          rawMaxShare: null,
          effectiveMaxShare: null,
        },
        {
          outputId: 'test_service',
          outputLabel: 'Test service',
          year: 2035,
          stateId: 'fuel_mix',
          stateLabel: 'Fuel Mix',
          activity: 1,
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

test('fuel consumption chart keeps only fuels and converts all series to PJ', () => {
  const request = buildFuelAndCostRequest();
  const result = buildFuelAndCostResult();
  const contributions = buildSolverContributionRows(request, result);
  const years = request.configuration.years;
  const chart = buildFuelConsumptionChart(contributions, years);

  assert.equal(chart.title, 'Fuel Consumption');
  assert.equal(chart.yAxisLabel, 'PJ');
  assert.deepEqual(
    chart.series.map((series) => series.label),
    ['Coal', 'Natural gas', 'Electricity', 'Refined liquid fuels', 'Biomass', 'Hydrogen'],
  );
  assert.ok(!chart.series.some((series) => series.label === 'Iron ore'));
  assert.ok(!chart.series.some((series) => series.label === 'Scrap steel'));
  assert.ok(!chart.series.some((series) => series.label === 'Sequestration service'));
  assert.deepEqual(
    chart.series.find((series) => series.label === 'Coal')?.values,
    [
      { year: 2030, value: 1 },
      { year: 2035, value: 0 },
    ],
  );
  assert.deepEqual(
    chart.series.find((series) => series.label === 'Electricity')?.values,
    [
      { year: 2030, value: 0.36 },
      { year: 2035, value: 0 },
    ],
  );
});

test('cost by component chart exposes the objective cost unit on the y-axis', () => {
  const request = buildFuelAndCostRequest();
  const result = buildFuelAndCostResult();
  const contributions = buildSolverContributionRows(request, result);
  const years = request.configuration.years;
  const chart = buildCostByComponentChart(contributions, years, request.objectiveCost);

  assert.equal(chart.title, 'Cost by Component');
  assert.equal(chart.yAxisLabel, 'AUD 2024');
});
