import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ConfigurationWorkspaceCenter from '../src/components/workspace/ConfigurationWorkspaceCenter.tsx';
import { SOLVER_CONTRACT_VERSION } from '../src/solver/contract.ts';

function buildRequest() {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'workspace-cost-chart-regression',
    rows: [
      {
        rowId: 'industry_heat::2030',
        outputId: 'industry_heat',
        outputRole: 'required_service',
        outputLabel: 'Industry heat',
        year: 2030,
        stateId: 'industry_heat_path',
        stateLabel: 'Industry heat path',
        sector: 'industry',
        subsector: 'generic_industrial_heat',
        region: 'national',
        outputUnit: 'PJ',
        conversionCostPerUnit: 4,
        inputs: [],
        directEmissions: [
          {
            pollutant: 'co2',
            value: 2,
            source: 'energy',
          },
        ],
        bounds: {
          minShare: null,
          maxShare: null,
          maxActivity: null,
        },
      },
      {
        rowId: 'land_removals::2030',
        outputId: 'land_removals',
        outputRole: 'required_service',
        outputLabel: 'Land removals',
        year: 2030,
        stateId: 'land_removals_path',
        stateLabel: 'Land removals path',
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
      name: 'Workspace chart regression',
      description: null,
      years: [2030],
      controlsByOutput: {
        industry_heat: {
          2030: {
            mode: 'optimize',
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
        land_removals: {
          2030: {
            mode: 'optimize',
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        industry_heat: { 2030: 10 },
        land_removals: { 2030: 4 },
      },
      externalCommodityDemandByCommodity: {},
      commodityPriceByCommodity: {
        electricity: {
          unit: 'AUD/MWh',
          valuesByYear: { 2030: 10 },
        },
      },
      carbonPriceByYear: { 2030: 20 },
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
    requestId: 'workspace-cost-chart-regression',
    status: 'solved',
    engine: { name: 'yalps', worker: true },
    summary: {
      rowCount: 2,
      yearCount: 1,
      outputCount: 2,
      serviceDemandOutputCount: 2,
      externalCommodityCount: 0,
    },
    reporting: {
      commodityBalances: [],
      stateShares: [
        {
          outputId: 'industry_heat',
          outputLabel: 'Industry heat',
          year: 2030,
          stateId: 'industry_heat_path',
          stateLabel: 'Industry heat path',
          activity: 10,
          share: 1,
          rawMaxShare: null,
          effectiveMaxShare: null,
        },
        {
          outputId: 'land_removals',
          outputLabel: 'Land removals',
          year: 2030,
          stateId: 'land_removals_path',
          stateLabel: 'Land removals path',
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
}

test('solved workspace renders Cost by Component with diverging chart net metadata', () => {
  const html = renderToStaticMarkup(
    React.createElement(ConfigurationWorkspaceCenter, {
      phase: 'solved',
      result: buildResult(),
      request: buildRequest(),
      error: null,
      failure: null,
    }),
  );

  const netSeriesMatches = html.match(/data-series-key="__net"/g) ?? [];
  const resetMatches = html.match(/class="stacked-chart-reset-button"/g) ?? [];

  assert.match(html, /workspace-chart-grid/);
  assert.match(html, /Cost by Component/);
  assert.match(html, /aria-label="Cost by Component legend"/);
  assert.match(html, /aria-label="Emissions by Sector legend"/);
  assert.match(html, /aria-label="Reset y-axis range for Demand by Sector"/);
  assert.equal(netSeriesMatches.length, 2);
  assert.equal(resetMatches.length, 4);
});

test('refreshing workspace keeps the previous chart grid mounted and surfaces a non-blocking status', () => {
  const html = renderToStaticMarkup(
    React.createElement(ConfigurationWorkspaceCenter, {
      phase: 'solving',
      result: buildResult(),
      request: buildRequest(),
      error: null,
      failure: null,
    }),
  );

  assert.match(html, /aria-busy="true"/);
  assert.match(html, /workspace-chart-grid/);
  assert.match(html, /Updating plots\.\.\./);
  assert.doesNotMatch(html, /workspace-failure-report/);
});

test('initial workspace solve shows a loading state before the first result arrives', () => {
  const html = renderToStaticMarkup(
    React.createElement(ConfigurationWorkspaceCenter, {
      phase: 'solving',
      result: null,
      request: null,
      error: null,
      failure: null,
    }),
  );

  assert.match(html, /aria-busy="true"/);
  assert.match(html, /Loading plots\.\.\./);
  assert.doesNotMatch(html, /workspace-chart-grid/);
});

test('pathway and removals cards keep only the card heading on the run page', () => {
  const request = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'workspace-card-heading-regression',
    rows: [
      {
        rowId: 'electricity_grid::2030',
        outputId: 'electricity_supply',
        outputRole: 'required_service',
        outputLabel: 'Electricity supply',
        year: 2030,
        stateId: 'electricity_grid',
        stateLabel: 'Grid mix',
        sector: 'power',
        subsector: 'electricity_supply',
        region: 'national',
        outputUnit: 'MWh',
        conversionCostPerUnit: 1,
        inputs: [],
        directEmissions: [],
        bounds: {
          minShare: null,
          maxShare: 0.8,
          maxActivity: null,
        },
      },
      {
        rowId: 'electricity_peaker::2030',
        outputId: 'electricity_supply',
        outputRole: 'required_service',
        outputLabel: 'Electricity supply',
        year: 2030,
        stateId: 'electricity_peaker',
        stateLabel: 'Peaker fleet',
        sector: 'power',
        subsector: 'electricity_supply',
        region: 'national',
        outputUnit: 'MWh',
        conversionCostPerUnit: 2,
        inputs: [],
        directEmissions: [],
        bounds: {
          minShare: null,
          maxShare: 0.5,
          maxActivity: null,
        },
      },
      {
        rowId: 'engineered_removals::2030',
        outputId: 'engineered_removals',
        outputRole: 'optional_activity',
        outputLabel: 'Engineered removals',
        year: 2030,
        stateId: 'dac',
        stateLabel: 'DAC',
        sector: 'removals_negative_emissions',
        subsector: 'engineered_removals',
        region: 'national',
        outputUnit: 'tCO2',
        conversionCostPerUnit: 3,
        inputs: [],
        directEmissions: [],
        bounds: {
          minShare: null,
          maxShare: null,
          maxActivity: 12,
        },
      },
    ],
    configuration: {
      name: 'Workspace heading regression',
      description: null,
      years: [2030],
      controlsByOutput: {
        electricity_supply: {
          2030: {
            mode: 'optimize',
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
        engineered_removals: {
          2030: {
            mode: 'optimize',
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        electricity_supply: { 2030: 10 },
        engineered_removals: { 2030: 0 },
      },
      externalCommodityDemandByCommodity: {},
      commodityPriceByCommodity: {},
      carbonPriceByYear: { 2030: 20 },
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
    requestId: 'workspace-card-heading-regression',
    status: 'solved',
    engine: { name: 'yalps', worker: true },
    summary: {
      rowCount: 3,
      yearCount: 1,
      outputCount: 2,
      serviceDemandOutputCount: 2,
      externalCommodityCount: 0,
    },
    reporting: {
      commodityBalances: [],
      stateShares: [
        {
          outputId: 'electricity_supply',
          outputLabel: 'Electricity supply',
          year: 2030,
          stateId: 'electricity_grid',
          stateLabel: 'Grid mix',
          activity: 7,
          share: 0.7,
          rawMaxShare: 0.8,
          effectiveMaxShare: 0.8,
        },
        {
          outputId: 'electricity_supply',
          outputLabel: 'Electricity supply',
          year: 2030,
          stateId: 'electricity_peaker',
          stateLabel: 'Peaker fleet',
          activity: 3,
          share: 0.3,
          rawMaxShare: 0.5,
          effectiveMaxShare: 0.5,
        },
        {
          outputId: 'engineered_removals',
          outputLabel: 'Engineered removals',
          year: 2030,
          stateId: 'dac',
          stateLabel: 'DAC',
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

  const html = renderToStaticMarkup(
    React.createElement(ConfigurationWorkspaceCenter, {
      phase: 'solved',
      result,
      request,
      error: null,
      failure: null,
    }),
  );

  assert.match(html, /<h2 class="workspace-chart-card-title">Electricity supply<\/h2>/);
  assert.match(html, /<h2 class="workspace-chart-card-title">Engineered removals<\/h2>/);
  assert.equal((html.match(/class="stacked-chart-reset-button"/g) ?? []).length, 4);
  assert.doesNotMatch(html, /Absolute pathway output over time/);
  assert.doesNotMatch(html, /Activity vs max activity over time/);
  assert.doesNotMatch(html, /<figcaption class="stacked-chart-title">Electricity supply Pathway Output<\/figcaption>/);
  assert.doesNotMatch(html, /<figcaption class="stacked-chart-title">Engineered removals<\/figcaption>/);
});
