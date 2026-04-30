import assert from 'node:assert/strict';
import test from 'node:test';
import { SOLVER_CONTRACT_VERSION } from '../src/solver/contract.ts';
import { normalizeSolverRows } from '../src/solver/buildSolveRequest.ts';
import { solveWithLpAdapter } from '../src/solver/lpAdapter.ts';
import {
  buildCostByComponentChart,
  buildEmissionsBySectorChart,
  buildEmissionsBySubsectorChart,
  buildFuelConsumptionChart,
  buildPathwayChartCards,
  buildRemovalsChartCards,
} from '../src/results/chartData.ts';
import { buildSolverContributionRows } from '../src/results/resultContributions.ts';
import { loadPkg } from './solverTestUtils.mjs';

const PATHWAY_INCUMBENT_ID = 'generic_industrial_heat__medium_temperature_heat__fossil';
const PATHWAY_INCUMBENT_LABEL = 'Medium-temperature incumbent mixed-fuel heat';
const PATHWAY_ELECTRIFIED_ID = 'generic_industrial_heat__medium_temperature_heat__electrified';
const PATHWAY_ELECTRIFIED_LABEL = 'Medium-temperature electrified heat';

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
        methodId: PATHWAY_INCUMBENT_ID,
        methodLabel: PATHWAY_INCUMBENT_LABEL,
        methodSortKey: '01_incumbent',
        methodOptionRank: 0,
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
        methodId: PATHWAY_ELECTRIFIED_ID,
        methodLabel: PATHWAY_ELECTRIFIED_LABEL,
        methodSortKey: '02_ambition1',
        methodOptionRank: 1,
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
        methodId: PATHWAY_INCUMBENT_ID,
        methodLabel: PATHWAY_INCUMBENT_LABEL,
        methodSortKey: '01_incumbent',
        methodOptionRank: 0,
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
        methodId: PATHWAY_ELECTRIFIED_ID,
        methodLabel: PATHWAY_ELECTRIFIED_LABEL,
        methodSortKey: '02_ambition1',
        methodOptionRank: 1,
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
            activeMethodIds: null,
            targetValue: null,
          },
          2035: {
            mode: 'optimize',
            activeMethodIds: null,
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
      methodShares: [
        {
          outputId: 'heat',
          outputLabel: 'Heat',
          year: 2030,
          methodId: PATHWAY_INCUMBENT_ID,
          methodLabel: PATHWAY_INCUMBENT_LABEL,
          activity: 80,
          share: 0.8,
          rawMaxShare: 0.4,
          effectiveMaxShare: 0.2857142857142857,
        },
        {
          outputId: 'heat',
          outputLabel: 'Heat',
          year: 2030,
          methodId: PATHWAY_ELECTRIFIED_ID,
          methodLabel: PATHWAY_ELECTRIFIED_LABEL,
          activity: 20,
          share: 0.2,
          rawMaxShare: null,
          effectiveMaxShare: 0.7142857142857143,
        },
        {
          outputId: 'heat',
          outputLabel: 'Heat',
          year: 2035,
          methodId: PATHWAY_INCUMBENT_ID,
          methodLabel: PATHWAY_INCUMBENT_LABEL,
          activity: 40,
          share: 0.4,
          rawMaxShare: 0.2,
          effectiveMaxShare: 0.16666666666666669,
        },
        {
          outputId: 'heat',
          outputLabel: 'Heat',
          year: 2035,
          methodId: PATHWAY_ELECTRIFIED_ID,
          methodLabel: PATHWAY_ELECTRIFIED_LABEL,
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
        methodId: 'buildings_incumbent',
        methodLabel: 'Buildings incumbent',
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
        methodId: 'removals_daccs',
        methodLabel: 'DACCS',
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
        methodId: 'buildings_incumbent',
        methodLabel: 'Buildings incumbent',
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
        methodId: 'removals_daccs',
        methodLabel: 'DACCS',
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
      methodShares: [
        {
          outputId: 'buildings_service',
          outputLabel: 'Buildings service',
          year: 2030,
          methodId: 'buildings_incumbent',
          methodLabel: 'Buildings incumbent',
          activity: 100,
          share: 1,
          rawMaxShare: null,
          effectiveMaxShare: null,
        },
        {
          outputId: 'removals_service',
          outputLabel: 'Removals service',
          year: 2030,
          methodId: 'removals_daccs',
          methodLabel: 'DACCS',
          activity: 20,
          share: 1,
          rawMaxShare: null,
          effectiveMaxShare: null,
        },
        {
          outputId: 'buildings_service',
          outputLabel: 'Buildings service',
          year: 2035,
          methodId: 'buildings_incumbent',
          methodLabel: 'Buildings incumbent',
          activity: 80,
          share: 1,
          rawMaxShare: null,
          effectiveMaxShare: null,
        },
        {
          outputId: 'removals_service',
          outputLabel: 'Removals service',
          year: 2035,
          methodId: 'removals_daccs',
          methodLabel: 'DACCS',
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
  assert.equal(
    sectorChart.series.find((series) => series.key === 'buildings')?.color,
    '#2563eb',
  );
  assert.equal(
    sectorChart.series.find((series) => series.key === 'buildings')?.legendLabel,
    'Buildings',
  );
  assert.deepEqual(
    sectorChart.series.find((series) => series.label === 'removals_negative_emissions')?.values,
    [
      { year: 2030, value: -20 },
      { year: 2035, value: -5 },
    ],
  );
  assert.equal(
    sectorChart.series.find((series) => series.key === 'removals_negative_emissions')?.color,
    '#0f766e',
  );
  assert.equal(
    sectorChart.series.find((series) => series.key === 'removals_negative_emissions')?.legendLabel,
    'Removals',
  );
  assert.deepEqual(
    subsectorChart.series.find((series) => series.label === 'engineered_removals')?.values,
    [
      { year: 2030, value: -20 },
      { year: 2035, value: -5 },
    ],
  );
  assert.equal(
    subsectorChart.series.find((series) => series.key === 'engineered_removals')?.color,
    '#0891b2',
  );
  assert.equal(
    subsectorChart.series.find((series) => series.key === 'engineered_removals')?.legendLabel,
    'Eng removals',
  );
});

test('emissions charts aggregate non-sink residual overlays in aggregated mode and keep net sinks separate', () => {
  const contributions = [
    {
      metric: 'emissions',
      year: 2030,
      value: 20,
      sourceKind: 'solver',
      sourceId: 'buildings_incumbent',
      sourceLabel: 'Buildings incumbent',
      sectorId: 'buildings',
      sectorLabel: 'buildings',
      subsectorId: 'residential',
      subsectorLabel: 'residential',
      commodityId: null,
      costComponent: null,
      overlayId: null,
      overlayDomain: null,
    },
    {
      metric: 'emissions',
      year: 2035,
      value: 21,
      sourceKind: 'solver',
      sourceId: 'buildings_incumbent',
      sourceLabel: 'Buildings incumbent',
      sectorId: 'buildings',
      sectorLabel: 'buildings',
      subsectorId: 'residential',
      subsectorLabel: 'residential',
      commodityId: null,
      costComponent: null,
      overlayId: null,
      overlayDomain: null,
    },
    {
      metric: 'emissions',
      year: 2030,
      value: 10,
      sourceKind: 'overlay',
      sourceId: 'commercial_other',
      sourceLabel: 'Residual commercial other',
      sectorId: 'commercial_other',
      sectorLabel: 'Residual commercial other',
      subsectorId: 'commercial_other',
      subsectorLabel: 'Residual commercial other',
      commodityId: null,
      costComponent: null,
      overlayId: 'commercial_other',
      overlayDomain: 'energy_residual',
    },
    {
      metric: 'emissions',
      year: 2035,
      value: 11,
      sourceKind: 'overlay',
      sourceId: 'commercial_other',
      sourceLabel: 'Residual commercial other',
      sectorId: 'commercial_other',
      sectorLabel: 'Residual commercial other',
      subsectorId: 'commercial_other',
      subsectorLabel: 'Residual commercial other',
      commodityId: null,
      costComponent: null,
      overlayId: 'commercial_other',
      overlayDomain: 'energy_residual',
    },
    {
      metric: 'emissions',
      year: 2030,
      value: 5,
      sourceKind: 'overlay',
      sourceId: 'residual_waste',
      sourceLabel: 'Residual waste emissions',
      sectorId: 'residual_waste',
      sectorLabel: 'Residual waste emissions',
      subsectorId: 'residual_waste',
      subsectorLabel: 'Residual waste emissions',
      commodityId: null,
      costComponent: null,
      overlayId: 'residual_waste',
      overlayDomain: 'nonenergy_residual',
    },
    {
      metric: 'emissions',
      year: 2035,
      value: 6,
      sourceKind: 'overlay',
      sourceId: 'residual_waste',
      sourceLabel: 'Residual waste emissions',
      sectorId: 'residual_waste',
      sectorLabel: 'Residual waste emissions',
      subsectorId: 'residual_waste',
      subsectorLabel: 'Residual waste emissions',
      commodityId: null,
      costComponent: null,
      overlayId: 'residual_waste',
      overlayDomain: 'nonenergy_residual',
    },
    {
      metric: 'emissions',
      year: 2030,
      value: -3,
      sourceKind: 'overlay',
      sourceId: 'residual_lulucf_sink',
      sourceLabel: 'Residual LULUCF sink',
      sectorId: 'residual_lulucf_sink',
      sectorLabel: 'Residual LULUCF sink',
      subsectorId: 'residual_lulucf_sink',
      subsectorLabel: 'Residual LULUCF sink',
      commodityId: null,
      costComponent: null,
      overlayId: 'residual_lulucf_sink',
      overlayDomain: 'net_sink',
    },
    {
      metric: 'emissions',
      year: 2035,
      value: -4,
      sourceKind: 'overlay',
      sourceId: 'residual_lulucf_sink',
      sourceLabel: 'Residual LULUCF sink',
      sectorId: 'residual_lulucf_sink',
      sectorLabel: 'Residual LULUCF sink',
      subsectorId: 'residual_lulucf_sink',
      subsectorLabel: 'Residual LULUCF sink',
      commodityId: null,
      costComponent: null,
      overlayId: 'residual_lulucf_sink',
      overlayDomain: 'net_sink',
    },
  ];
  const years = [2030, 2035];

  const aggregatedSectorChart = buildEmissionsBySectorChart(contributions, years, 'aggregated_non_sink');
  const individualSectorChart = buildEmissionsBySectorChart(contributions, years, 'individual');
  const aggregatedSubsectorChart = buildEmissionsBySubsectorChart(contributions, years, 'aggregated_non_sink');
  const individualSubsectorChart = buildEmissionsBySubsectorChart(contributions, years, 'individual');

  assert.deepEqual(
    aggregatedSectorChart.series.find((series) => series.key === 'overlay:unmodelled_residuals')?.values,
    [
      { year: 2030, value: 15 },
      { year: 2035, value: 17 },
    ],
  );
  assert.equal(
    aggregatedSectorChart.series.find((series) => series.key === 'overlay:unmodelled_residuals')?.label,
    'Unmodelled residuals',
  );
  assert.equal(
    aggregatedSectorChart.series.find((series) => series.key === 'overlay:unmodelled_residuals')?.color,
    '#92400e',
  );
  assert.equal(
    aggregatedSectorChart.series.find((series) => series.key === 'overlay:unmodelled_residuals')?.legendLabel,
    'Unmodelled res',
  );
  assert.deepEqual(
    aggregatedSectorChart.series.find((series) => series.key === 'overlay:residual_lulucf_sink')?.values,
    [
      { year: 2030, value: -3 },
      { year: 2035, value: -4 },
    ],
  );
  assert.equal(
    individualSectorChart.series.find((series) => series.key === 'overlay:commercial_other')?.label,
    'Residual commercial other',
  );
  assert.equal(
    individualSectorChart.series.find((series) => series.key === 'overlay:residual_waste')?.label,
    'Residual waste emissions',
  );
  assert.equal(
    individualSectorChart.series.find((series) => series.key === 'overlay:residual_lulucf_sink')?.label,
    'Residual LULUCF sink',
  );
  assert.equal(
    individualSectorChart.series.some((series) => series.key === 'overlay:unmodelled_residuals'),
    false,
  );

  assert.deepEqual(
    aggregatedSubsectorChart.series.find((series) => series.key === 'overlay:unmodelled_residuals')?.values,
    [
      { year: 2030, value: 15 },
      { year: 2035, value: 17 },
    ],
  );
  assert.equal(
    individualSubsectorChart.series.find((series) => series.key === 'overlay:commercial_other')?.label,
    'Residual commercial other',
  );
  assert.equal(
    aggregatedSubsectorChart.series.some((series) => series.key === 'overlay:residual_lulucf_sink'),
    true,
  );
});

test('buildPathwayChartCards returns output and cap views for selectable outputs', () => {
  const cards = buildPathwayChartCards(buildRequest(true), buildResult());

  assert.equal(cards.length, 1);
  assert.equal(cards[0].outputId, 'heat');
  assert.equal(cards[0].outputChart.yAxisLabel, 'PJ');
  assert.equal(cards[0].capChart.yAxisLabel, 'Share of output (%)');
  assert.equal(cards[0].respectMaxShare, true);
  assert.match(cards[0].note, /normalizing across active pathways/i);
  assert.equal(cards[0].outputChart.series.length, 2);
  assert.equal(cards[0].outputChart.series[0]?.key, PATHWAY_INCUMBENT_ID);
  assert.deepEqual(
    cards[0].outputChart.series.find((series) => series.label === PATHWAY_INCUMBENT_LABEL)?.values,
    [
      { year: 2030, value: 80 },
      { year: 2035, value: 40 },
    ],
  );
  assert.equal(
    cards[0].outputChart.series.find((series) => series.key === PATHWAY_INCUMBENT_ID)?.legendLabel,
    'Incumbent',
  );
  assert.deepEqual(
    cards[0].capChart.series.find((series) => series.label === PATHWAY_INCUMBENT_LABEL)?.capValues,
    [
      { year: 2030, value: 28.57142857142857 },
      { year: 2035, value: 16.666666666666668 },
    ],
  );
  assert.deepEqual(
    cards[0].capChart.series.find((series) => series.label === PATHWAY_INCUMBENT_LABEL)?.shareValues,
    [
      { year: 2030, value: 80 },
      { year: 2035, value: 40 },
    ],
  );
});

test('buildPathwayChartCards keeps cap context visible when max-share enforcement is off', () => {
  const cards = buildPathwayChartCards(buildRequest(false), buildResult());

  assert.equal(cards.length, 1);
  assert.equal(cards[0].respectMaxShare, false);
  assert.match(cards[0].note, /ignored in this solve/i);
  assert.deepEqual(
    cards[0].capChart.series.find((series) => series.label === PATHWAY_ELECTRIFIED_LABEL)?.capValues,
    [
      { year: 2030, value: 71.42857142857143 },
      { year: 2035, value: 83.33333333333334 },
    ],
  );
  assert.deepEqual(
    cards[0].capChart.series.find((series) => series.label === PATHWAY_ELECTRIFIED_LABEL)?.shareValues,
    [
      { year: 2030, value: 20 },
      { year: 2035, value: 60 },
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
        methodId: 'selected_a',
        methodLabel: 'Selected A',
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
        methodId: 'available_b',
        methodLabel: 'Available B',
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
            activeMethodIds: ['selected_a'],
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
  const selectedShare = result.reporting.methodShares.find((share) => share.methodId === 'selected_a');
  const availableShare = result.reporting.methodShares.find((share) => share.methodId === 'available_b');
  const card = cards[0];
  const selectedSeries = card.capChart.series.find((series) => series.label === 'Selected A');
  const availableSeries = card.capChart.series.find((series) => series.label === 'Available B');
  const selectedCap = selectedSeries?.capValues[0]?.value;
  const selectedSolvedShare = selectedSeries?.shareValues[0]?.value;

  assert.equal(result.status, 'solved');
  assert.equal(cards.length, 1);
  assert.ok(selectedShare?.effectiveMaxShare != null, 'expected selected exact-share cap');
  assert.equal(availableShare?.effectiveMaxShare, null, 'inactive pathways are excluded from cap normalization');
  assert.ok(Math.abs(selectedCap - (selectedShare.effectiveMaxShare * 100)) < 1e-9);
  assert.ok(Math.abs(selectedSolvedShare - (selectedShare.share * 100)) < 1e-9);
  assert.equal(availableShare?.share, 0);
  assert.equal(availableSeries, undefined);
});

test('buildPathwayChartCards excludes pathways whose cap and solved share stay at zero', () => {
  const request = buildRequest(true);
  const result = buildResult();

  request.rows.push(
    {
      rowId: 'heat_c::2030',
      outputId: 'heat',
      outputRole: 'required_service',
      outputLabel: 'Heat',
      year: 2030,
      methodId: 'generic_industrial_heat__medium_temperature_heat__standby',
      methodLabel: 'Standby heat',
      sector: 'test',
      subsector: 'test',
      region: 'national',
      outputUnit: 'PJ',
      conversionCostPerUnit: 3,
      inputs: [],
      directEmissions: [],
      bounds: {
        minShare: null,
        maxShare: null,
        maxActivity: null,
      },
    },
    {
      rowId: 'heat_c::2035',
      outputId: 'heat',
      outputRole: 'required_service',
      outputLabel: 'Heat',
      year: 2035,
      methodId: 'generic_industrial_heat__medium_temperature_heat__standby',
      methodLabel: 'Standby heat',
      sector: 'test',
      subsector: 'test',
      region: 'national',
      outputUnit: 'PJ',
      conversionCostPerUnit: 3,
      inputs: [],
      directEmissions: [],
      bounds: {
        minShare: null,
        maxShare: null,
        maxActivity: null,
      },
    },
  );
  result.reporting.methodShares.push(
    {
      outputId: 'heat',
      outputLabel: 'Heat',
      year: 2030,
      methodId: 'generic_industrial_heat__medium_temperature_heat__standby',
      methodLabel: 'Standby heat',
      activity: 0,
      share: 0,
      rawMaxShare: null,
      effectiveMaxShare: null,
    },
    {
      outputId: 'heat',
      outputLabel: 'Heat',
      year: 2035,
      methodId: 'generic_industrial_heat__medium_temperature_heat__standby',
      methodLabel: 'Standby heat',
      activity: 0,
      share: 0,
      rawMaxShare: null,
      effectiveMaxShare: null,
    },
  );

  const cards = buildPathwayChartCards(request, result);

  assert.equal(cards.length, 1);
  assert.equal(
    cards[0].capChart.series.some((series) => series.label === 'Standby heat'),
    false,
  );
});

test('buildPathwayChartCards orders package pathways by metadata and prefers standardized labels', () => {
  const pkg = loadPkg();
  const rows = normalizeSolverRows(pkg)
    .filter((row) => row.outputId === 'crude_steel' && row.year === 2025);
  const request = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'package-pathway-ordering',
    rows,
    configuration: {
      name: 'Package pathway ordering',
      description: null,
      years: [2025],
      controlsByOutput: {
        crude_steel: {
          2025: {
            mode: 'optimize',
            activeMethodIds: null,
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        crude_steel: { 2025: 100 },
      },
      externalCommodityDemandByCommodity: {},
      commodityPriceByCommodity: {},
      carbonPriceByYear: { 2025: 0 },
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
  const result = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'package-pathway-ordering',
    status: 'solved',
    engine: { name: 'yalps', worker: true },
    summary: {
      rowCount: rows.length,
      yearCount: 1,
      outputCount: 1,
      serviceDemandOutputCount: 1,
      externalCommodityCount: 0,
    },
    reporting: {
      commodityBalances: [],
      methodShares: [
        {
          outputId: 'crude_steel',
          outputLabel: 'Crude steel',
          year: 2025,
          methodId: 'steel__crude_steel__h2_dri_electric',
          methodLabel: 'Hydrogen DRI-electric steel',
          activity: 10,
          share: 0.1,
          rawMaxShare: 0.2,
          effectiveMaxShare: 0.2,
        },
        {
          outputId: 'crude_steel',
          outputLabel: 'Crude steel',
          year: 2025,
          methodId: 'steel__crude_steel__bf_bof_ccs_transition',
          methodLabel: 'CCS-influenced BF-BOF steel',
          activity: 20,
          share: 0.2,
          rawMaxShare: 0.3,
          effectiveMaxShare: 0.3,
        },
        {
          outputId: 'crude_steel',
          outputLabel: 'Crude steel',
          year: 2025,
          methodId: 'steel__crude_steel__scrap_eaf',
          methodLabel: 'Scrap EAF steel',
          activity: 30,
          share: 0.3,
          rawMaxShare: 0.4,
          effectiveMaxShare: 0.4,
        },
        {
          outputId: 'crude_steel',
          outputLabel: 'Crude steel',
          year: 2025,
          methodId: 'steel__crude_steel__bf_bof_conventional',
          methodLabel: 'Conventional BF-BOF steel',
          activity: 40,
          share: 0.4,
          rawMaxShare: 0.5,
          effectiveMaxShare: 0.5,
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

  const cards = buildPathwayChartCards(request, result);
  const steelCard = cards.find((card) => card.outputId === 'crude_steel');

  assert.ok(steelCard, 'expected crude steel pathway chart card');
  assert.deepEqual(
    steelCard.outputChart.series.map((series) => series.key),
    [
      'steel__crude_steel__bf_bof_conventional',
      'steel__crude_steel__scrap_eaf',
      'steel__crude_steel__bf_bof_ccs_transition',
      'steel__crude_steel__h2_dri_electric',
    ],
  );
  assert.deepEqual(
    steelCard.outputChart.series.map((series) => series.label),
    [
      'Conventional BF-BOF steel',
      'Scrap EAF steel',
      'CCS-influenced BF-BOF steel',
      'Hydrogen DRI-electric steel',
    ],
  );
  assert.deepEqual(
    steelCard.capChart.series.map((series) => series.key),
    steelCard.outputChart.series.map((series) => series.key),
  );
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
        methodId: 'fuel_mix',
        methodLabel: 'Fuel Mix',
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
        methodId: 'fuel_mix',
        methodLabel: 'Fuel Mix',
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
          { commodityId: 'capture_service', coefficient: 5, unit: 'tCO2_stored/unit' },
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
      methodShares: [
        {
          outputId: 'test_service',
          outputLabel: 'Test service',
          year: 2030,
          methodId: 'fuel_mix',
          methodLabel: 'Fuel Mix',
          activity: 1,
          share: 1,
          rawMaxShare: null,
          effectiveMaxShare: null,
        },
        {
          outputId: 'test_service',
          outputLabel: 'Test service',
          year: 2035,
          methodId: 'fuel_mix',
          methodLabel: 'Fuel Mix',
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
  assert.ok(!chart.series.some((series) => series.label === 'Capture service'));
  assert.deepEqual(
    chart.series.find((series) => series.label === 'Coal')?.values,
    [
      { year: 2030, value: 1 },
      { year: 2035, value: 0 },
    ],
  );
  assert.equal(chart.series.find((series) => series.key === 'coal')?.color, '#1f2937');
  assert.equal(chart.series.find((series) => series.key === 'natural_gas')?.color, '#6b7280');
  assert.equal(chart.series.find((series) => series.key === 'natural_gas')?.legendLabel, 'Gas');
  assert.deepEqual(
    chart.series.find((series) => series.label === 'Electricity')?.values,
    [
      { year: 2030, value: 0.36 },
      { year: 2035, value: 0 },
    ],
  );
  assert.equal(chart.series.find((series) => series.key === 'electricity')?.color, '#f59e0b');
  assert.equal(chart.series.find((series) => series.key === 'electricity')?.legendLabel, 'Elec');
});

test('cost by component chart exposes the objective cost unit on the y-axis', () => {
  const request = buildFuelAndCostRequest();
  const result = buildFuelAndCostResult();
  const contributions = buildSolverContributionRows(request, result);
  const years = request.configuration.years;
  const chart = buildCostByComponentChart(contributions, years, request.objectiveCost);

  assert.equal(chart.title, 'Cost by Component');
  assert.equal(chart.yAxisLabel, 'AUD 2024');
  assert.equal(chart.series.find((series) => series.key === 'conversion')?.color, '#2563eb');
  assert.equal(chart.series.find((series) => series.key === 'commodity')?.color, '#64748b');
  assert.equal(chart.series.find((series) => series.key === 'carbon')?.color, '#b91c1c');
  assert.equal(chart.series.find((series) => series.key === 'conversion')?.legendLabel, 'Conversion');
});

test('removals charts use canonical metric ids with fixed colors', () => {
  const request = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'chart-data-removals-metrics',
    rows: [
      {
        rowId: 'dac::2030',
        outputId: 'engineered_removals',
        outputRole: 'optional_activity',
        outputLabel: 'Engineered removals',
        year: 2030,
        methodId: 'removals_negative_emissions__engineered_removals__daccs',
        methodLabel: 'DACCS',
        sector: 'removals_negative_emissions',
        subsector: 'engineered_removals',
        region: 'national',
        outputUnit: 'tCO2',
        conversionCostPerUnit: 1,
        inputs: [],
        directEmissions: [],
        bounds: {
          minShare: null,
          maxShare: null,
          maxActivity: 12,
        },
      },
    ],
    objectiveCost: {
      currency: 'AUD_2024',
      costBasisYear: 2024,
    },
    configuration: {
      name: 'Removals metric colors',
      description: null,
      years: [2030],
      controlsByOutput: {},
      serviceDemandByOutput: {
        engineered_removals: { 2030: 0 },
      },
      externalCommodityDemandByCommodity: {},
      commodityPriceByCommodity: {},
      carbonPriceByYear: { 2030: 0 },
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

  const result = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'chart-data-removals-metrics',
    status: 'solved',
    engine: { name: 'yalps', worker: true },
    summary: {
      rowCount: 1,
      yearCount: 1,
      outputCount: 1,
      serviceDemandOutputCount: 1,
      externalCommodityCount: 0,
    },
    reporting: {
      commodityBalances: [],
      methodShares: [
        {
          outputId: 'engineered_removals',
          outputLabel: 'Engineered removals',
          year: 2030,
          methodId: 'removals_negative_emissions__engineered_removals__daccs',
          methodLabel: 'DACCS',
          activity: 4,
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

  const cards = buildRemovalsChartCards(request, result);
  const series = cards[0]?.activityChart.series ?? [];

  assert.equal(series.find((entry) => entry.key === 'activity')?.color, '#16a34a');
  assert.equal(series.find((entry) => entry.key === 'max_activity')?.color, '#475569');
  assert.equal(series.find((entry) => entry.key === 'activity')?.legendLabel, 'Activity');
  assert.equal(series.find((entry) => entry.key === 'max_activity')?.legendLabel, 'Max activity');
});
