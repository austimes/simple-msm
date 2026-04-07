import assert from 'node:assert/strict';
import test from 'node:test';
import { SOLVER_CONTRACT_VERSION } from '../src/solver/contract.ts';
import { solveWithLpAdapter } from '../src/solver/lpAdapter.ts';

function createRow({
  rowId,
  outputId,
  year,
  stateId,
  cost,
  outputRole = 'required_service',
  inputs = [],
  maxShare = null,
}) {
  return {
    rowId,
    outputId,
    outputRole,
    outputLabel: outputId,
    year,
    stateId,
    stateLabel: stateId,
    sector: 'test',
    subsector: 'test',
    region: 'national',
    outputUnit: 'unit',
    conversionCostPerUnit: cost,
    inputs,
    directEmissions: [],
    bounds: {
      minShare: null,
      maxShare,
      maxActivity: null,
    },
  };
}

function getVariableMap(result) {
  return new Map(result.raw.variables.map((entry) => [entry.id, entry.value]));
}

function assertClose(actual, expected, message) {
  assert.ok(
    Math.abs((actual ?? Number.NaN) - expected) < 1e-9,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

test('required-service LP solves pinned, fixed-share, and optimize controls generically', () => {
  const request = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'lp-adapter-regression',
    rows: [
      createRow({
        rowId: 'heat_fossil::2025',
        outputId: 'heat',
        year: 2025,
        stateId: 'heat_fossil',
        cost: 5,
      }),
      createRow({
        rowId: 'heat_electric::2025',
        outputId: 'heat',
        year: 2025,
        stateId: 'heat_electric',
        cost: 2,
      }),
      createRow({
        rowId: 'heat_fossil::2030',
        outputId: 'heat',
        year: 2030,
        stateId: 'heat_fossil',
        cost: 5,
      }),
      createRow({
        rowId: 'heat_electric::2030',
        outputId: 'heat',
        year: 2030,
        stateId: 'heat_electric',
        cost: 2,
      }),
      createRow({
        rowId: 'transport_diesel::2025',
        outputId: 'transport',
        year: 2025,
        stateId: 'transport_diesel',
        cost: 4,
      }),
      createRow({
        rowId: 'transport_ev::2025',
        outputId: 'transport',
        year: 2025,
        stateId: 'transport_ev',
        cost: 1,
      }),
      createRow({
        rowId: 'transport_diesel::2030',
        outputId: 'transport',
        year: 2030,
        stateId: 'transport_diesel',
        cost: 4,
      }),
      createRow({
        rowId: 'transport_ev::2030',
        outputId: 'transport',
        year: 2030,
        stateId: 'transport_ev',
        cost: 1,
      }),
      createRow({
        rowId: 'process_incumbent::2025',
        outputId: 'process',
        year: 2025,
        stateId: 'process_incumbent',
        cost: 3,
      }),
      createRow({
        rowId: 'process_transition::2025',
        outputId: 'process',
        year: 2025,
        stateId: 'process_transition',
        cost: 2,
      }),
      createRow({
        rowId: 'process_hydrogen::2025',
        outputId: 'process',
        year: 2025,
        stateId: 'process_hydrogen',
        cost: 1,
      }),
      createRow({
        rowId: 'process_incumbent::2030',
        outputId: 'process',
        year: 2030,
        stateId: 'process_incumbent',
        cost: 1,
        maxShare: 0.6,
      }),
      createRow({
        rowId: 'process_transition::2030',
        outputId: 'process',
        year: 2030,
        stateId: 'process_transition',
        cost: 3,
      }),
      createRow({
        rowId: 'process_hydrogen::2030',
        outputId: 'process',
        year: 2030,
        stateId: 'process_hydrogen',
        cost: 0.5,
      }),
    ],
    scenario: {
      name: 'LP adapter regression',
      description: null,
      years: [2025, 2030],
      controlsByOutput: {
        heat: {
          2025: {
            mode: 'pinned_single',
            stateId: 'heat_fossil',
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
          2030: {
            mode: 'fixed_shares',
            stateId: null,
            fixedShares: {
              heat_fossil: 0.25,
              heat_electric: 0.75,
            },
            disabledStateIds: [],
            targetValue: null,
          },
        },
        transport: {
          2025: {
            mode: 'pinned_single',
            stateId: 'transport_diesel',
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
          2030: {
            mode: 'pinned_single',
            stateId: 'transport_ev',
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
        process: {
          2025: {
            mode: 'pinned_single',
            stateId: 'process_transition',
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
          2030: {
            mode: 'optimize',
            stateId: null,
            fixedShares: null,
            disabledStateIds: ['process_hydrogen'],
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        heat: { 2025: 60, 2030: 80 },
        transport: { 2025: 40, 2030: 50 },
        process: { 2025: 30, 2030: 100 },
      },
      externalCommodityDemandByCommodity: {},
      commodityPriceByCommodity: {},
      carbonPriceByYear: { 2025: 0, 2030: 0 },
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

  const result = solveWithLpAdapter(request);
  const variables = getVariableMap(result);

  assert.equal(result.status, 'solved');
  assert.equal(result.raw.kind, 'scenario_lp');
  assert.equal(result.raw.solutionStatus, 'optimal');
  assert.ok(result.diagnostics.every((diagnostic) => diagnostic.severity !== 'error'));

  assertClose(variables.get('activity:heat_fossil::2025'), 60, '2025 heat pinned row');
  assertClose(variables.get('activity:heat_electric::2025'), 0, '2025 heat non-pinned row');
  assertClose(variables.get('activity:transport_diesel::2025'), 40, '2025 transport pinned row');
  assertClose(variables.get('activity:transport_ev::2025'), 0, '2025 transport non-pinned row');
  assertClose(variables.get('activity:process_transition::2025'), 30, '2025 process pinned row');
  assertClose(variables.get('activity:process_incumbent::2025'), 0, '2025 process non-pinned row');
  assertClose(variables.get('activity:process_hydrogen::2025'), 0, '2025 process extra row');

  assertClose(variables.get('activity:heat_fossil::2030'), 20, '2030 heat fixed-share fossil row');
  assertClose(variables.get('activity:heat_electric::2030'), 60, '2030 heat fixed-share electric row');
  assertClose(variables.get('activity:transport_diesel::2030'), 0, '2030 transport non-pinned row');
  assertClose(variables.get('activity:transport_ev::2030'), 50, '2030 transport pinned row');
  assertClose(variables.get('activity:process_incumbent::2030'), 60, '2030 process optimize low-cost capped row');
  assertClose(variables.get('activity:process_transition::2030'), 40, '2030 process optimize residual row');
  assertClose(variables.get('activity:process_hydrogen::2030'), 0, '2030 process disabled row');
});

test('endogenous electricity enforces balance and removes exogenous electricity double counting', () => {
  const request = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'lp-adapter-electricity-endogenous',
    rows: [
      createRow({
        rowId: 'process_fossil::2030',
        outputId: 'process',
        year: 2030,
        stateId: 'process_fossil',
        cost: 5,
      }),
      createRow({
        rowId: 'process_electric::2030',
        outputId: 'process',
        year: 2030,
        stateId: 'process_electric',
        cost: 1,
        inputs: [
          {
            commodityId: 'electricity',
            coefficient: 2,
            unit: 'MWh/unit',
          },
        ],
      }),
      createRow({
        rowId: 'grid_clean::2030',
        outputId: 'electricity',
        outputRole: 'endogenous_supply_commodity',
        year: 2030,
        stateId: 'grid_clean',
        cost: 1,
      }),
      createRow({
        rowId: 'grid_firmed::2030',
        outputId: 'electricity',
        outputRole: 'endogenous_supply_commodity',
        year: 2030,
        stateId: 'grid_firmed',
        cost: 1,
      }),
    ],
    scenario: {
      name: 'Endogenous electricity regression',
      description: null,
      years: [2030],
      controlsByOutput: {
        process: {
          2030: {
            mode: 'optimize',
            stateId: null,
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
        electricity: {
          2030: {
            mode: 'fixed_shares',
            stateId: null,
            fixedShares: {
              grid_clean: 0.25,
              grid_firmed: 0.75,
            },
            disabledStateIds: [],
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        process: { 2030: 100 },
      },
      externalCommodityDemandByCommodity: {
        electricity: { 2030: 50 },
      },
      commodityPriceByCommodity: {
        electricity: {
          unit: 'AUD/MWh',
          valuesByYear: { 2030: 4 },
        },
      },
      carbonPriceByYear: { 2030: 0 },
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

  const result = solveWithLpAdapter(request);
  const variables = getVariableMap(result);
  const electricitySummary = result.reporting.commodityBalances.find(
    (summary) => summary.commodityId === 'electricity' && summary.year === 2030,
  );

  assert.equal(result.status, 'solved');
  assert.equal(result.raw.solutionStatus, 'optimal');
  assertClose(result.raw.objectiveValue, 350, 'endogenous electricity objective');
  assertClose(variables.get('activity:process_fossil::2030'), 0, 'fossil process activity');
  assertClose(variables.get('activity:process_electric::2030'), 100, 'electric process activity');
  assertClose(variables.get('activity:grid_clean::2030'), 62.5, 'clean grid activity');
  assertClose(variables.get('activity:grid_firmed::2030'), 187.5, 'firmed grid activity');
  assert.equal(electricitySummary?.mode, 'endogenous');
  assertClose(electricitySummary?.supply, 250, 'electricity supply');
  assertClose(electricitySummary?.modeledDemand, 200, 'modeled electricity demand');
  assertClose(electricitySummary?.externalDemand, 50, 'external electricity demand');
  assertClose(electricitySummary?.totalDemand, 250, 'total electricity demand');
  assertClose(electricitySummary?.balanceGap, 0, 'electricity balance gap');
  assertClose(electricitySummary?.pricedExogenousDemand, 0, 'exogenous electricity purchases');
});

test('externalized electricity bypasses supply states and prices electricity exogenously', () => {
  const request = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'lp-adapter-electricity-externalized',
    rows: [
      createRow({
        rowId: 'process_fossil::2030',
        outputId: 'process',
        year: 2030,
        stateId: 'process_fossil',
        cost: 5,
      }),
      createRow({
        rowId: 'process_electric::2030',
        outputId: 'process',
        year: 2030,
        stateId: 'process_electric',
        cost: 1,
        inputs: [
          {
            commodityId: 'electricity',
            coefficient: 2,
            unit: 'MWh/unit',
          },
        ],
      }),
      createRow({
        rowId: 'grid_clean::2030',
        outputId: 'electricity',
        outputRole: 'endogenous_supply_commodity',
        year: 2030,
        stateId: 'grid_clean',
        cost: 1,
      }),
      createRow({
        rowId: 'grid_firmed::2030',
        outputId: 'electricity',
        outputRole: 'endogenous_supply_commodity',
        year: 2030,
        stateId: 'grid_firmed',
        cost: 1,
      }),
    ],
    scenario: {
      name: 'Externalized electricity regression',
      description: null,
      years: [2030],
      controlsByOutput: {
        process: {
          2030: {
            mode: 'optimize',
            stateId: null,
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
        electricity: {
          2030: {
            mode: 'externalized',
            stateId: null,
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        process: { 2030: 100 },
      },
      externalCommodityDemandByCommodity: {
        electricity: { 2030: 50 },
      },
      commodityPriceByCommodity: {
        electricity: {
          unit: 'AUD/MWh',
          valuesByYear: { 2030: 4 },
        },
      },
      carbonPriceByYear: { 2030: 0 },
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

  const result = solveWithLpAdapter(request);
  const variables = getVariableMap(result);
  const electricitySummary = result.reporting.commodityBalances.find(
    (summary) => summary.commodityId === 'electricity' && summary.year === 2030,
  );

  assert.equal(result.status, 'solved');
  assert.equal(result.raw.solutionStatus, 'optimal');
  assertClose(result.raw.objectiveValue, 500, 'externalized electricity objective');
  assertClose(variables.get('activity:process_fossil::2030'), 100, 'fossil process activity');
  assertClose(variables.get('activity:process_electric::2030'), 0, 'electric process activity');
  assertClose(variables.get('activity:grid_clean::2030'), 0, 'externalized clean grid activity');
  assertClose(variables.get('activity:grid_firmed::2030'), 0, 'externalized firmed grid activity');
  assert.equal(electricitySummary?.mode, 'externalized');
  assertClose(electricitySummary?.supply, 0, 'externalized electricity supply');
  assertClose(electricitySummary?.modeledDemand, 0, 'externalized modeled demand');
  assertClose(electricitySummary?.externalDemand, 50, 'externalized external demand');
  assertClose(electricitySummary?.totalDemand, 50, 'externalized total electricity demand');
  assert.equal(electricitySummary?.balanceGap, null);
  assertClose(electricitySummary?.pricedExogenousDemand, 50, 'externalized exogenous purchases');
  assertClose(electricitySummary?.averageSupplyCost, 4, 'externalized electricity price');
});
