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

  assert.match(html, /workspace-chart-grid/);
  assert.match(html, /Cost by Component/);
  assert.match(html, /aria-label="Cost by Component legend"/);
  assert.match(html, /aria-label="Emissions by Sector legend"/);
  assert.equal(netSeriesMatches.length, 2);
});
