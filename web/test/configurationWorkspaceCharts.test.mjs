import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ConfigurationWorkspaceCenter from '../src/components/workspace/ConfigurationWorkspaceCenter.tsx';
import { SOLVER_CONTRACT_VERSION } from '../src/solver/contract.ts';

function buildSolveState({
  phase = 'solved',
  request = buildRequest(),
  result = buildResult(),
  solvedConfiguration = request?.configuration ?? null,
  error = null,
  failure = null,
} = {}) {
  return {
    phase,
    request,
    result,
    solvedConfiguration,
    error,
    failure,
    solve: () => {},
  };
}

function buildCenterProps(overrides = {}) {
  const focusRequest = buildRequest();

  return {
    baseConfigId: null,
    baseSelectionMode: 'none',
    baseSolve: buildSolveState({
      phase: 'idle',
      request: null,
      result: null,
      solvedConfiguration: null,
    }),
    commonComparisonYears: [],
    comparisonEnabled: false,
    efficiencyAttributionSafe: false,
    configurationOptions: [
      { id: 'reference-baseline', label: 'Reference baseline' },
      { id: 'reference-efficiency-open', label: 'Reference efficiency open' },
    ],
    focusConfigurationLabel: focusRequest.configuration.name,
    focusSolve: buildSolveState({
      request: focusRequest,
      result: buildResult(),
      solvedConfiguration: focusRequest.configuration,
    }),
    fuelSwitchBasis: 'to',
    onBaseConfigChange: () => {},
    onBaseSelectionModeChange: () => {},
    onFuelSwitchBasisChange: () => {},
    onFuelSwitchYearChange: () => {},
    selectedFuelSwitchYear: null,
    ...overrides,
  };
}

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

function buildFuelSwitchRequest(commodityId) {
  const request = buildRequest();

  return {
    ...request,
    rows: request.rows.map((row) => {
      if (row.outputId !== 'industry_heat') {
        return row;
      }

      return {
        ...row,
        inputs: [{ commodityId, coefficient: 1, unit: 'PJ' }],
      };
    }),
  };
}

function buildEfficiencyAttributionRequest({
  requestId,
  rowId,
  stateId,
  stateLabel,
  inputCoefficient,
  emissionsPerUnit,
  provenance,
}) {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId,
    rows: [
      {
        rowId,
        outputId: 'heat',
        outputRole: 'required_service',
        outputLabel: 'Heat',
        year: 2030,
        stateId,
        stateLabel,
        sector: 'industry',
        subsector: 'low_temperature_heat',
        region: 'national',
        outputUnit: 'PJ',
        conversionCostPerUnit: 1,
        inputs: [{ commodityId: 'natural_gas', coefficient: inputCoefficient, unit: 'PJ' }],
        directEmissions: [{ pollutant: 'co2', value: emissionsPerUnit, source: 'energy' }],
        provenance,
        bounds: {
          minShare: null,
          maxShare: null,
          maxActivity: null,
        },
      },
    ],
    configuration: {
      name: requestId,
      description: null,
      years: [2030],
      controlsByOutput: {
        heat: {
          2030: {
            mode: 'optimize',
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        heat: { 2030: 10 },
      },
      externalCommodityDemandByCommodity: {},
      commodityPriceByCommodity: {
        natural_gas: {
          unit: 'AUD/PJ',
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

function buildEfficiencyAttributionResult(request) {
  const [row] = request.rows;
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: request.requestId,
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
      stateShares: [
        {
          outputId: row.outputId,
          outputLabel: row.outputLabel,
          year: row.year,
          rowId: row.rowId,
          stateId: row.stateId,
          stateLabel: row.stateLabel,
          pathwayStateId: row.provenance?.baseStateId ?? row.stateId,
          pathwayStateLabel: row.provenance?.baseStateLabel ?? row.stateLabel,
          provenance: row.provenance,
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

test('solved workspace renders Cost by Component with diverging chart net metadata', () => {
  const html = renderToStaticMarkup(
    React.createElement(ConfigurationWorkspaceCenter, buildCenterProps()),
  );

  const netSeriesMatches = html.match(/data-series-key="__net"/g) ?? [];
  const resetMatches = html.match(/stacked-chart-reset-button/g) ?? [];

  assert.match(html, /Explorer comparison pair/);
  assert.match(html, /workspace-chart-grid/);
  assert.match(html, /Cost by Component/);
  assert.match(html, /aria-label="Cost by Component legend"/);
  assert.match(html, /aria-label="Emissions by Sector legend"/);
  assert.match(html, /aria-label="Reset y-axis range for Demand by Sector"/);
  assert.equal(netSeriesMatches.length, 2);
  assert.equal(resetMatches.length, 4);
});

test('comparison-enabled workspace shows the fuel-switching chart with its reset control', () => {
  const focusRequest = buildFuelSwitchRequest('electricity');
  const baseRequest = buildFuelSwitchRequest('natural_gas');
  const html = renderToStaticMarkup(
    React.createElement(ConfigurationWorkspaceCenter, buildCenterProps({
      baseConfigId: 'reference-baseline',
      baseSelectionMode: 'manual',
      comparisonEnabled: true,
      commonComparisonYears: [2030],
      focusSolve: buildSolveState({
        request: focusRequest,
        result: buildResult(),
        solvedConfiguration: focusRequest.configuration,
      }),
      baseSolve: buildSolveState({
        request: baseRequest,
        result: buildResult(),
        solvedConfiguration: baseRequest.configuration,
      }),
    })),
  );

  const resetMatches = html.match(/stacked-chart-reset-button/g) ?? [];

  assert.match(html, /Fuel switching by fuel pair/);
  assert.match(html, /1 fuel-switch pairs/);
  assert.match(html, /aria-label="Reset y-axis range for Fuel switching by fuel pair"/);
  assert.equal(resetMatches.length, 5);
});

test('attribution-safe comparison renders the efficiency attribution section', () => {
  const baseRequest = buildEfficiencyAttributionRequest({
    requestId: 'efficiency-attribution-base',
    rowId: 'heat::2030',
    stateId: 'generic_industrial_heat__low_temperature_heat__fossil',
    stateLabel: 'Fossil heat',
    inputCoefficient: 1,
    emissionsPerUnit: 0.2,
    provenance: {
      kind: 'base_state',
      familyId: 'low_temperature_heat',
      baseStateId: 'generic_industrial_heat__low_temperature_heat__fossil',
      baseStateLabel: 'Fossil heat',
      baseRowId: 'heat::2030',
      autonomousTrackIds: [],
    },
  });
  const focusRequest = buildEfficiencyAttributionRequest({
    requestId: 'efficiency-attribution-focus',
    rowId: 'effpkg:heat::retrofit::2030',
    stateId: 'effpkg:generic_industrial_heat__low_temperature_heat__fossil::retrofit',
    stateLabel: 'Fossil heat + retrofit',
    inputCoefficient: 0.8,
    emissionsPerUnit: 0.1,
    provenance: {
      kind: 'efficiency_package',
      familyId: 'low_temperature_heat',
      baseStateId: 'generic_industrial_heat__low_temperature_heat__fossil',
      baseStateLabel: 'Fossil heat',
      baseRowId: 'heat::2030',
      autonomousTrackIds: [],
      packageId: 'retrofit',
      packageClassification: 'pure_efficiency_overlay',
    },
  });
  const html = renderToStaticMarkup(
    React.createElement(ConfigurationWorkspaceCenter, buildCenterProps({
      baseConfigId: 'reference-baseline',
      baseSelectionMode: 'manual',
      comparisonEnabled: true,
      efficiencyAttributionSafe: true,
      commonComparisonYears: [2030],
      focusSolve: buildSolveState({
        request: focusRequest,
        result: buildEfficiencyAttributionResult(focusRequest),
        solvedConfiguration: focusRequest.configuration,
      }),
      baseSolve: buildSolveState({
        request: baseRequest,
        result: buildEfficiencyAttributionResult(baseRequest),
        solvedConfiguration: baseRequest.configuration,
      }),
    })),
  );

  assert.match(html, /Efficiency attribution/);
  assert.match(html, /Fuel delta by efficiency attribution/);
  assert.match(html, /Emissions delta by efficiency attribution/);
  assert.match(html, /Cost delta by efficiency attribution/);
  assert.match(html, /Pure efficiency package/);
});

test('comparison with a mismatched scenario backbone shows the attribution-safe status message instead of charts', () => {
  const html = renderToStaticMarkup(
    React.createElement(ConfigurationWorkspaceCenter, buildCenterProps({
      baseConfigId: 'reference-baseline',
      baseSelectionMode: 'manual',
      comparisonEnabled: true,
      efficiencyAttributionSafe: false,
      commonComparisonYears: [2030],
      baseSolve: buildSolveState({
        request: buildRequest(),
        result: buildResult(),
        solvedConfiguration: buildRequest().configuration,
      }),
    })),
  );

  assert.match(html, /Efficiency attribution unavailable/);
  assert.match(html, /scenario backbone differs/);
  assert.doesNotMatch(html, /Fuel delta by efficiency attribution/);
});

test('refreshing workspace keeps the previous chart grid mounted without a visible status overlay', () => {
  const html = renderToStaticMarkup(
    React.createElement(ConfigurationWorkspaceCenter, buildCenterProps({
      focusSolve: buildSolveState({
        phase: 'solving',
      }),
    })),
  );

  assert.match(html, /aria-busy="true"/);
  assert.match(html, /workspace-chart-grid/);
  assert.doesNotMatch(html, /Updating plots\.\.\./);
  assert.doesNotMatch(html, /workspace-failure-report/);
});

test('initial workspace solve keeps the center blank while the first result is loading', () => {
  const html = renderToStaticMarkup(
    React.createElement(ConfigurationWorkspaceCenter, buildCenterProps({
      focusSolve: buildSolveState({
        phase: 'solving',
        request: null,
        result: null,
        solvedConfiguration: null,
      }),
    })),
  );

  assert.match(html, /aria-busy="true"/);
  assert.doesNotMatch(html, /Loading plots\.\.\./);
  assert.doesNotMatch(html, /workspace-chart-grid/);
});

test('pathway and removals cards render their titles inside the chart frame', () => {
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
        stateId: 'electricity__grid_supply__incumbent_thermal_mix',
        stateLabel: 'Incumbent thermal-heavy grid mix',
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
        stateId: 'electricity__grid_supply__policy_frontier',
        stateLabel: 'Policy frontier grid supply',
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
        stateId: 'removals_negative_emissions__engineered_removals__daccs',
        stateLabel: 'Direct air capture with storage (DACCS)',
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
          stateId: 'electricity__grid_supply__incumbent_thermal_mix',
          stateLabel: 'Incumbent thermal-heavy grid mix',
          activity: 7,
          share: 0.7,
          rawMaxShare: 0.8,
          effectiveMaxShare: 0.8,
        },
        {
          outputId: 'electricity_supply',
          outputLabel: 'Electricity supply',
          year: 2030,
          stateId: 'electricity__grid_supply__policy_frontier',
          stateLabel: 'Policy frontier grid supply',
          activity: 3,
          share: 0.3,
          rawMaxShare: 0.5,
          effectiveMaxShare: 0.5,
        },
        {
          outputId: 'engineered_removals',
          outputLabel: 'Engineered removals',
          year: 2030,
          stateId: 'removals_negative_emissions__engineered_removals__daccs',
          stateLabel: 'Direct air capture with storage (DACCS)',
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

  const html = renderToStaticMarkup(React.createElement(
    ConfigurationWorkspaceCenter,
    buildCenterProps({
      focusConfigurationLabel: request.configuration.name,
      focusSolve: buildSolveState({
        request,
        result,
        solvedConfiguration: request.configuration,
      }),
    }),
  ));

  assert.match(html, /<span class="stacked-chart-title">Electricity supply<\/span>/);
  assert.match(html, /<span class="stacked-chart-title">Engineered removals<\/span>/);
  assert.doesNotMatch(html, /<h2 class="workspace-chart-card-title">Electricity supply<\/h2>/);
  assert.doesNotMatch(html, /<h2 class="workspace-chart-card-title">Engineered removals<\/h2>/);
  assert.equal((html.match(/stacked-chart-reset-button/g) ?? []).length, 4);
  assert.equal((html.match(/class="workspace-chart-toggle"/g) ?? []).length, 1);
  assert.match(html, /role="group" aria-label="Electricity supply chart mode"/);
  assert.doesNotMatch(html, /Absolute pathway output over time/);
  assert.doesNotMatch(html, /Activity vs max activity over time/);
  assert.doesNotMatch(html, />Electricity supply Pathway Output</);
  assert.doesNotMatch(html, />Engineered removals Pathway Output</);
  assert.match(html, />Incumbent</);
  assert.match(html, />Frontier</);
  assert.match(html, />Activity</);
  assert.match(html, />Max activity</);
  assert.match(html, /title="Incumbent thermal-heavy grid mix"/);
  assert.match(html, /title="Policy frontier grid supply"/);
});

test('base comparison disabled keeps Explorer absolute charts and hides the fuel-switching card', () => {
  const html = renderToStaticMarkup(
    React.createElement(ConfigurationWorkspaceCenter, buildCenterProps({
      baseSelectionMode: 'none',
      comparisonEnabled: false,
    })),
  );

  assert.match(html, /Base comparison is disabled/);
  assert.match(html, /Fuel Consumption/);
  assert.doesNotMatch(html, /Fuel switching by fuel pair/);
});

test('base comparison failure keeps focus charts visible and shows a comparison-only error panel', () => {
  const html = renderToStaticMarkup(
    React.createElement(ConfigurationWorkspaceCenter, buildCenterProps({
      baseConfigId: 'reference-baseline',
      baseSelectionMode: 'manual',
      comparisonEnabled: true,
      commonComparisonYears: [2030],
      baseSolve: buildSolveState({
        phase: 'error',
        request: buildRequest(),
        result: null,
        solvedConfiguration: buildRequest().configuration,
        error: 'Base comparison solve failed.',
      }),
    })),
  );

  assert.match(html, /Base comparison unavailable/);
  assert.match(html, /Base comparison solve failed\./);
  assert.match(html, /workspace-chart-grid/);
});
