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
  minShare = null,
  maxActivity = null,
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
      minShare,
      maxShare,
      maxActivity,
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

function findDiagnostic(result, code, outputId) {
  return result.diagnostics.find((diagnostic) => {
    return diagnostic.code === code && (outputId == null || diagnostic.outputId === outputId);
  });
}

function findSoftConstraint(result, constraintId) {
  return result.reporting.softConstraintViolations.find((constraint) => constraint.constraintId === constraintId);
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

  const bindingConstraintIds = new Set(
    result.reporting.bindingConstraints.map((constraint) => constraint.constraintId),
  );

  assert.ok(bindingConstraintIds.has('pinned:heat_fossil::2025'));
  assert.ok(bindingConstraintIds.has('fixed_share:heat_electric::2030'));
  assert.ok(bindingConstraintIds.has('max_share:process_incumbent::2030'));
  assert.ok(bindingConstraintIds.has('disabled:process_hydrogen::2030'));
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

test('infeasible runs report deterministic service-year and electricity diagnostics', () => {
  const request = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'lp-adapter-infeasibility-diagnostics',
    rows: [
      createRow({
        rowId: 'pin_locked::2030',
        outputId: 'pin_service',
        year: 2030,
        stateId: 'pin_locked',
        cost: 1,
        maxShare: 0.5,
      }),
      createRow({
        rowId: 'pin_flexible::2030',
        outputId: 'pin_service',
        year: 2030,
        stateId: 'pin_flexible',
        cost: 2,
      }),
      createRow({
        rowId: 'share_a::2030',
        outputId: 'share_service',
        year: 2030,
        stateId: 'share_a',
        cost: 1,
        maxShare: 0.4,
      }),
      createRow({
        rowId: 'share_b::2030',
        outputId: 'share_service',
        year: 2030,
        stateId: 'share_b',
        cost: 2,
        maxShare: 0.4,
      }),
      createRow({
        rowId: 'activity_a::2030',
        outputId: 'activity_service',
        year: 2030,
        stateId: 'activity_a',
        cost: 1,
        maxActivity: 30,
      }),
      createRow({
        rowId: 'activity_b::2030',
        outputId: 'activity_service',
        year: 2030,
        stateId: 'activity_b',
        cost: 2,
        maxActivity: 20,
      }),
      createRow({
        rowId: 'disabled_a::2030',
        outputId: 'disabled_service',
        year: 2030,
        stateId: 'disabled_a',
        cost: 1,
      }),
      createRow({
        rowId: 'disabled_b::2030',
        outputId: 'disabled_service',
        year: 2030,
        stateId: 'disabled_b',
        cost: 2,
      }),
      createRow({
        rowId: 'process_grid::2030',
        outputId: 'process_service',
        year: 2030,
        stateId: 'process_grid',
        cost: 1,
        inputs: [
          {
            commodityId: 'electricity',
            coefficient: 1,
            unit: 'MWh/unit',
          },
        ],
      }),
      createRow({
        rowId: 'grid_limited::2030',
        outputId: 'electricity',
        outputRole: 'endogenous_supply_commodity',
        year: 2030,
        stateId: 'grid_limited',
        cost: 1,
        maxActivity: 40,
      }),
    ],
    scenario: {
      name: 'Infeasibility diagnostics regression',
      description: null,
      years: [2030],
      controlsByOutput: {
        pin_service: {
          2030: {
            mode: 'pinned_single',
            stateId: 'pin_locked',
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
        share_service: {
          2030: {
            mode: 'optimize',
            stateId: null,
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
        activity_service: {
          2030: {
            mode: 'optimize',
            stateId: null,
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
        disabled_service: {
          2030: {
            mode: 'optimize',
            stateId: null,
            fixedShares: null,
            disabledStateIds: ['disabled_a', 'disabled_b'],
            targetValue: null,
          },
        },
        process_service: {
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
            mode: 'optimize',
            stateId: null,
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        pin_service: { 2030: 100 },
        share_service: { 2030: 100 },
        activity_service: { 2030: 100 },
        disabled_service: { 2030: 50 },
        process_service: { 2030: 50 },
      },
      externalCommodityDemandByCommodity: {
        electricity: { 2030: 10 },
      },
      commodityPriceByCommodity: {
        electricity: {
          unit: 'AUD/MWh',
          valuesByYear: { 2030: 2 },
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

  assert.equal(result.status, 'error');
  assert.equal(result.raw?.solutionStatus, 'infeasible');
  assert.deepEqual(result.reporting.bindingConstraints, []);
  assert.deepEqual(result.reporting.softConstraintViolations, []);

  assert.equal(
    findDiagnostic(result, 'exact_control_share_conflict', 'pin_service')?.reason,
    'pinned_fixed_share_conflict',
  );
  assert.equal(findDiagnostic(result, 'exact_control_share_conflict', 'pin_service')?.year, 2030);
  assert.equal(
    findDiagnostic(result, 'service_max_share_exhaustion', 'share_service')?.reason,
    'share_exhaustion',
  );
  assert.equal(
    findDiagnostic(result, 'service_max_activity_exhaustion', 'activity_service')?.reason,
    'activity_exhaustion',
  );
  assert.equal(
    findDiagnostic(result, 'service_states_disabled', 'disabled_service')?.reason,
    'disabled_states',
  );
  assert.equal(
    findDiagnostic(result, 'electricity_balance_shortfall', 'electricity')?.reason,
    'electricity_balance_conflict',
  );
  assert.deepEqual(
    findDiagnostic(result, 'electricity_balance_shortfall', 'electricity')?.relatedConstraintIds,
    ['commodity_balance:electricity:2030'],
  );
});

test('soft-constraint mode restores feasibility and reports slack penalties', () => {
  const request = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'lp-adapter-soft-constraints',
    rows: [
      createRow({
        rowId: 'share_a::2030',
        outputId: 'share_service',
        year: 2030,
        stateId: 'share_a',
        cost: 1,
        maxShare: 0.4,
      }),
      createRow({
        rowId: 'share_b::2030',
        outputId: 'share_service',
        year: 2030,
        stateId: 'share_b',
        cost: 2,
        maxShare: 0.4,
      }),
      createRow({
        rowId: 'activity_a::2030',
        outputId: 'activity_service',
        year: 2030,
        stateId: 'activity_a',
        cost: 1,
        maxActivity: 30,
      }),
      createRow({
        rowId: 'activity_b::2030',
        outputId: 'activity_service',
        year: 2030,
        stateId: 'activity_b',
        cost: 2,
        maxActivity: 20,
      }),
      createRow({
        rowId: 'process_grid::2030',
        outputId: 'process_service',
        year: 2030,
        stateId: 'process_grid',
        cost: 1,
        inputs: [
          {
            commodityId: 'electricity',
            coefficient: 1,
            unit: 'MWh/unit',
          },
        ],
      }),
      createRow({
        rowId: 'grid_limited::2030',
        outputId: 'electricity',
        outputRole: 'endogenous_supply_commodity',
        year: 2030,
        stateId: 'grid_limited',
        cost: 1,
        maxActivity: 40,
      }),
    ],
    scenario: {
      name: 'Soft constraints regression',
      description: null,
      years: [2030],
      controlsByOutput: {
        share_service: {
          2030: {
            mode: 'optimize',
            stateId: null,
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
        activity_service: {
          2030: {
            mode: 'optimize',
            stateId: null,
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
        process_service: {
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
            mode: 'optimize',
            stateId: null,
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        share_service: { 2030: 100 },
        activity_service: { 2030: 100 },
        process_service: { 2030: 50 },
      },
      externalCommodityDemandByCommodity: {
        electricity: { 2030: 10 },
      },
      commodityPriceByCommodity: {
        electricity: {
          unit: 'AUD/MWh',
          valuesByYear: { 2030: 2 },
        },
      },
      carbonPriceByYear: { 2030: 0 },
      options: {
        respectMaxShare: true,
        respectMaxActivity: true,
        softConstraints: true,
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
  const shareSlack = findSoftConstraint(result, 'max_share:share_a::2030');
  const activitySlack = findSoftConstraint(result, 'max_activity:activity_a::2030');
  const electricitySlack = findSoftConstraint(result, 'max_activity:grid_limited::2030');
  const electricitySummary = result.reporting.commodityBalances.find(
    (summary) => summary.commodityId === 'electricity' && summary.year === 2030,
  );

  assert.equal(result.status, 'solved');
  assert.equal(result.raw?.solutionStatus, 'optimal');
  assert.ok(result.diagnostics.every((diagnostic) => diagnostic.severity !== 'error'));

  assertClose(variables.get('activity:share_a::2030'), 60, 'soft share service chooses cheapest excess state');
  assertClose(variables.get('activity:share_b::2030'), 40, 'soft share service residual activity');
  assertClose(variables.get('activity:activity_a::2030'), 80, 'soft activity service exceeds cheapest cap');
  assertClose(variables.get('activity:activity_b::2030'), 20, 'soft activity service stays on expensive capped row');
  assertClose(variables.get('activity:grid_limited::2030'), 60, 'soft electricity supply covers modeled and external demand');

  assert.equal(result.reporting.softConstraintViolations.length, 3);
  assertClose(shareSlack?.slack, 20, 'share slack');
  assertClose(shareSlack?.actualValue, 60, 'share actual activity');
  assertClose(activitySlack?.slack, 50, 'activity slack');
  assertClose(activitySlack?.actualValue, 80, 'activity actual output');
  assertClose(electricitySlack?.slack, 20, 'electricity slack');
  assertClose(electricitySlack?.actualValue, 60, 'electricity actual output');
  assert.ok((shareSlack?.penaltyPerUnit ?? 0) > 0);
  assertClose(shareSlack?.totalPenalty, (shareSlack?.penaltyPerUnit ?? 0) * 20, 'share total penalty');
  assertClose(activitySlack?.totalPenalty, (activitySlack?.penaltyPerUnit ?? 0) * 50, 'activity total penalty');
  assertClose(electricitySlack?.totalPenalty, (electricitySlack?.penaltyPerUnit ?? 0) * 20, 'electricity total penalty');

  assert.equal(findDiagnostic(result, 'soft_constraints_enabled')?.severity, 'info');
  assert.equal(findDiagnostic(result, 'soft_max_share_relaxed', 'share_service')?.reason, 'share_exhaustion');
  assert.equal(findDiagnostic(result, 'soft_max_activity_relaxed', 'activity_service')?.reason, 'activity_exhaustion');
  assert.equal(findDiagnostic(result, 'soft_max_activity_relaxed', 'electricity')?.reason, 'activity_exhaustion');
  assertClose(electricitySummary?.supply, 60, 'soft electricity supply');
  assertClose(electricitySummary?.totalDemand, 60, 'soft electricity demand');
  assertClose(electricitySummary?.balanceGap, 0, 'soft electricity balance');
});
