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
  provenance = undefined,
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
    provenance,
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

function findStateShare(result, outputId, year, stateId) {
  return result.reporting.stateShares.find((share) => {
    return share.outputId === outputId && share.year === year && share.stateId === stateId;
  });
}

function packageProvenance(baseStateId, packageId, group) {
  return {
    kind: 'efficiency_package',
    familyId: 'service',
    baseStateId,
    baseStateLabel: baseStateId,
    baseRowId: `${baseStateId}::2030`,
    autonomousTrackIds: [],
    packageId,
    packageClassification: 'pure_efficiency_overlay',
    packageNonStackingGroup: group,
  };
}

test('required-service LP solves exact-share and optimize controls generically', () => {
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
        maxShare: 0.25,
      }),
      createRow({
        rowId: 'heat_electric::2030',
        outputId: 'heat',
        year: 2030,
        stateId: 'heat_electric',
        cost: 2,
        maxShare: 0.75,
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
    configuration: {
      name: 'LP adapter regression',
      description: null,
      years: [2025, 2030],
      controlsByOutput: {
        heat: {
          2025: {
            mode: 'optimize',
            activeStateIds: ['heat_fossil'],
            targetValue: null,
          },
          2030: {
            mode: 'optimize',
            activeStateIds: ['heat_fossil', 'heat_electric'],
            targetValue: null,
          },
        },
        transport: {
          2025: {
            mode: 'optimize',
            activeStateIds: ['transport_diesel'],
            targetValue: null,
          },
          2030: {
            mode: 'optimize',
            activeStateIds: ['transport_ev'],
            targetValue: null,
          },
        },
        process: {
          2025: {
            mode: 'optimize',
            activeStateIds: ['process_transition'],
            targetValue: null,
          },
          2030: {
            mode: 'optimize',
            activeStateIds: ['process_incumbent', 'process_transition'],
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
  assert.equal(result.raw.kind, 'configuration_lp');
  assert.equal(result.raw.solutionStatus, 'optimal');
  assert.ok(result.diagnostics.every((diagnostic) => diagnostic.severity !== 'error'));

  assertClose(variables.get('activity:heat_fossil::2025'), 60, '2025 heat single-active row');
  assertClose(variables.get('activity:heat_electric::2025'), 0, '2025 heat inactive row');
  assertClose(variables.get('activity:transport_diesel::2025'), 40, '2025 transport single-active row');
  assertClose(variables.get('activity:transport_ev::2025'), 0, '2025 transport inactive row');
  assertClose(variables.get('activity:process_transition::2025'), 30, '2025 process single-active row');
  assertClose(variables.get('activity:process_incumbent::2025'), 0, '2025 process inactive row');
  assertClose(variables.get('activity:process_hydrogen::2025'), 0, '2025 process inactive extra row');

  assertClose(variables.get('activity:heat_fossil::2030'), 20, '2030 heat optimize capped fossil row');
  assertClose(variables.get('activity:heat_electric::2030'), 60, '2030 heat optimize residual electric row');
  assertClose(variables.get('activity:transport_diesel::2030'), 0, '2030 transport inactive row');
  assertClose(variables.get('activity:transport_ev::2030'), 50, '2030 transport single-active row');
  assertClose(variables.get('activity:process_incumbent::2030'), 60, '2030 process optimize low-cost capped row');
  assertClose(variables.get('activity:process_transition::2030'), 40, '2030 process optimize residual row');
  assertClose(variables.get('activity:process_hydrogen::2030'), 0, '2030 process inactive row');

  const incumbentShare = findStateShare(result, 'process', 2030, 'process_incumbent');
  const transitionShare = findStateShare(result, 'process', 2030, 'process_transition');
  assertClose(incumbentShare?.rawMaxShare, 0.6, 'raw incumbent max share is reported');
  assertClose(incumbentShare?.effectiveMaxShare, 0.6, 'effective incumbent max share when total weight > 1');
  assert.equal(transitionShare?.rawMaxShare, null);
  assertClose(transitionShare?.effectiveMaxShare, 1, 'null raw max share contributes weight 1.0');

  const bindingConstraintIds = new Set(
    result.reporting.bindingConstraints.map((constraint) => constraint.constraintId),
  );

  assert.ok(bindingConstraintIds.has('inactive:heat_electric::2025'));
  assert.ok(bindingConstraintIds.has('max_share:heat_fossil::2030'));
  assert.ok(bindingConstraintIds.has('max_share:process_incumbent::2030'));
  assert.ok(bindingConstraintIds.has('inactive:process_hydrogen::2030'));
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
        maxShare: 0,
      }),
      createRow({
        rowId: 'process_electric::2030',
        outputId: 'process',
        year: 2030,
        stateId: 'process_electric',
        cost: 1,
        maxShare: 1,
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
        maxShare: 0.25,
      }),
      createRow({
        rowId: 'grid_firmed::2030',
        outputId: 'electricity',
        outputRole: 'endogenous_supply_commodity',
        year: 2030,
        stateId: 'grid_firmed',
        cost: 1,
        maxShare: 0.75,
      }),
    ],
    configuration: {
      name: 'Endogenous electricity regression',
      description: null,
      years: [2030],
      controlsByOutput: {
        process: {
          2030: {
            mode: 'optimize',
            activeStateIds: null,
            targetValue: null,
          },
        },
        electricity: {
          2030: {
            mode: 'optimize',
            activeStateIds: ['grid_clean', 'grid_firmed'],
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
        maxShare: 1,
      }),
      createRow({
        rowId: 'process_electric::2030',
        outputId: 'process',
        year: 2030,
        stateId: 'process_electric',
        cost: 1,
        maxShare: 0,
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
    configuration: {
      name: 'Externalized electricity regression',
      description: null,
      years: [2030],
      controlsByOutput: {
        process: {
          2030: {
            mode: 'optimize',
            activeStateIds: null,
            targetValue: null,
          },
        },
        electricity: {
          2030: {
            mode: 'externalized',
            activeStateIds: null,
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
        minShare: 0.6,
      }),
      createRow({
        rowId: 'share_b::2030',
        outputId: 'share_service',
        year: 2030,
        stateId: 'share_b',
        cost: 2,
        minShare: 0.6,
      }),
      createRow({
        rowId: 'activity_a::2030',
        outputId: 'activity_service',
        year: 2030,
        stateId: 'activity_a',
        cost: 1,
        maxShare: 0.8,
        maxActivity: 30,
      }),
      createRow({
        rowId: 'activity_b::2030',
        outputId: 'activity_service',
        year: 2030,
        stateId: 'activity_b',
        cost: 2,
        maxShare: 0.2,
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
    configuration: {
      name: 'Infeasibility diagnostics regression',
      description: null,
      years: [2030],
      controlsByOutput: {
        pin_service: {
          2030: {
            mode: 'optimize',
            activeStateIds: ['pin_locked', 'pin_flexible'],
            targetValue: null,
          },
        },
        share_service: {
          2030: {
            mode: 'optimize',
            activeStateIds: null,
            targetValue: null,
          },
        },
        activity_service: {
          2030: {
            mode: 'optimize',
            activeStateIds: null,
            targetValue: null,
          },
        },
        disabled_service: {
          2030: {
            mode: 'optimize',
            activeStateIds: [],
            targetValue: null,
          },
        },
        process_service: {
          2030: {
            mode: 'optimize',
            activeStateIds: null,
            targetValue: null,
          },
        },
        electricity: {
          2030: {
            mode: 'optimize',
            activeStateIds: null,
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
    findDiagnostic(result, 'service_min_share_exhaustion', 'share_service')?.reason,
    'share_exhaustion',
  );
  assert.equal(
    findDiagnostic(result, 'service_max_activity_exhaustion', 'activity_service')?.reason,
    'activity_exhaustion',
  );
  assert.equal(
    findDiagnostic(result, 'service_states_inactive', 'disabled_service')?.reason,
    'inactive_states',
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
      }),
      createRow({
        rowId: 'activity_a::2030',
        outputId: 'activity_service',
        year: 2030,
        stateId: 'activity_a',
        cost: 1,
        maxShare: 0.8,
        maxActivity: 30,
      }),
      createRow({
        rowId: 'activity_b::2030',
        outputId: 'activity_service',
        year: 2030,
        stateId: 'activity_b',
        cost: 2,
        maxShare: 0.2,
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
    configuration: {
      name: 'Soft constraints regression',
      description: null,
      years: [2030],
      controlsByOutput: {
        share_service: {
          2030: {
            mode: 'optimize',
            activeStateIds: ['share_a', 'share_b'],
            targetValue: null,
          },
        },
        activity_service: {
          2030: {
            mode: 'optimize',
            activeStateIds: null,
            targetValue: null,
          },
        },
        process_service: {
          2030: {
            mode: 'optimize',
            activeStateIds: null,
            targetValue: null,
          },
        },
        electricity: {
          2030: {
            mode: 'optimize',
            activeStateIds: null,
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

  assertClose(variables.get('activity:share_a::2030'), 40, 'soft share service capped at effective max share');
  assertClose(variables.get('activity:share_b::2030'), 60, 'soft share service residual');
  assertClose(variables.get('activity:activity_a::2030'), 80, 'soft activity service exceeds cheapest cap');
  assertClose(variables.get('activity:activity_b::2030'), 20, 'soft activity service stays on expensive capped row');
  assertClose(variables.get('activity:grid_limited::2030'), 60, 'soft electricity supply covers modeled and external demand');

  assert.equal(result.reporting.softConstraintViolations.length, 2);
  assertClose(activitySlack?.slack, 50, 'activity slack');
  assertClose(activitySlack?.actualValue, 80, 'activity actual output');
  assertClose(electricitySlack?.slack, 20, 'electricity slack');
  assertClose(electricitySlack?.actualValue, 60, 'electricity actual output');
  assertClose(activitySlack?.totalPenalty, (activitySlack?.penaltyPerUnit ?? 0) * 50, 'activity total penalty');
  assertClose(electricitySlack?.totalPenalty, (electricitySlack?.penaltyPerUnit ?? 0) * 20, 'electricity total penalty');

  assert.equal(findDiagnostic(result, 'soft_constraints_enabled')?.severity, 'info');
  assert.equal(findDiagnostic(result, 'soft_max_activity_relaxed', 'activity_service')?.reason, 'activity_exhaustion');
  assert.equal(findDiagnostic(result, 'soft_max_activity_relaxed', 'electricity')?.reason, 'activity_exhaustion');
  assertClose(electricitySummary?.supply, 60, 'soft electricity supply');
  assertClose(electricitySummary?.totalDemand, 60, 'soft electricity demand');
  assertClose(electricitySummary?.balanceGap, 0, 'soft electricity balance');
});

test('max-share normalization keeps subset runs feasible and reports raw versus effective caps', () => {
  const request = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'lp-adapter-max-share-normalization',
    rows: [
      createRow({
        rowId: 'subset_enabled::2030',
        outputId: 'subset_service',
        year: 2030,
        stateId: 'subset_enabled',
        cost: 1,
        maxShare: 0.03,
      }),
      createRow({
        rowId: 'subset_disabled::2030',
        outputId: 'subset_service',
        year: 2030,
        stateId: 'subset_disabled',
        cost: 2,
        maxShare: 0.97,
      }),
    ],
    configuration: {
      name: 'Max-share normalization regression',
      description: null,
      years: [2030],
      controlsByOutput: {
        subset_service: {
          2030: {
            mode: 'optimize',
            activeStateIds: ['subset_enabled'],
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        subset_service: { 2030: 100 },
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

  const result = solveWithLpAdapter(request);
  const variables = getVariableMap(result);
  const enabledShare = findStateShare(result, 'subset_service', 2030, 'subset_enabled');
  const disabledShare = findStateShare(result, 'subset_service', 2030, 'subset_disabled');
  const maxConstraint = result.reporting.bindingConstraints.find(
    (constraint) => constraint.constraintId === 'max_share:subset_enabled::2030',
  );

  assert.equal(result.status, 'solved');
  assertClose(variables.get('activity:subset_enabled::2030'), 100, 'single enabled pathway can cover the full demand');
  assertClose(variables.get('activity:subset_disabled::2030'), 0, 'disabled pathway stays inactive');
  assertClose(enabledShare?.rawMaxShare, 0.03, 'raw enabled max share is reported');
  assertClose(enabledShare?.effectiveMaxShare, 1, 'effective enabled max share is normalized to 100%');
  assertClose(disabledShare?.rawMaxShare, 0.97, 'raw disabled max share is still reported');
  assert.equal(disabledShare?.effectiveMaxShare, null, 'disabled pathways are excluded from normalization');
  assertClose(maxConstraint?.boundValue, 100, 'hard max-share constraint uses the normalized effective cap');
});

test('zero raw max shares with both states active results in infeasibility when maxShare is respected', () => {
  const request = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'lp-adapter-zero-max-share-fallback',
    rows: [
      createRow({
        rowId: 'equal_a::2030',
        outputId: 'equal_service',
        year: 2030,
        stateId: 'equal_a',
        cost: 1,
        maxShare: 0,
      }),
      createRow({
        rowId: 'equal_b::2030',
        outputId: 'equal_service',
        year: 2030,
        stateId: 'equal_b',
        cost: 2,
        maxShare: 0,
      }),
    ],
    configuration: {
      name: 'Zero max-share fallback regression',
      description: null,
      years: [2030],
      controlsByOutput: {
        equal_service: {
          2030: {
            mode: 'optimize',
            activeStateIds: ['equal_a', 'equal_b'],
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        equal_service: { 2030: 80 },
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

  const result = solveWithLpAdapter(request);

  assert.equal(result.status, 'error');
  assert.equal(result.raw?.solutionStatus, 'infeasible');
});

test('one-hot exact-share controls normalize caps over active states', () => {
  const request = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'lp-adapter-exact-share-cap-denominator',
    rows: [
      createRow({
        rowId: 'selected_a::2030',
        outputId: 'exact_share_service',
        year: 2030,
        stateId: 'selected_a',
        cost: 1,
        maxShare: 0.2,
      }),
      createRow({
        rowId: 'available_b::2030',
        outputId: 'exact_share_service',
        year: 2030,
        stateId: 'available_b',
        cost: 3,
      }),
    ],
    configuration: {
      name: 'Exact-share denominator regression',
      description: null,
      years: [2030],
      controlsByOutput: {
        exact_share_service: {
          2030: {
            mode: 'optimize',
            activeStateIds: ['selected_a', 'available_b'],
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

  const result = solveWithLpAdapter(request);
  const variables = getVariableMap(result);
  const selectedShare = findStateShare(result, 'exact_share_service', 2030, 'selected_a');
  const availableShare = findStateShare(result, 'exact_share_service', 2030, 'available_b');

  assert.equal(result.status, 'solved');
  assertClose(variables.get('activity:selected_a::2030'), 20, 'cheaper state capped at its effective max share');
  assertClose(variables.get('activity:available_b::2030'), 80, 'remaining demand on the uncapped state');
  assertClose(selectedShare?.effectiveMaxShare, 0.2, 'selected state effective max share unchanged when total weight > 1');
  assertClose(availableShare?.effectiveMaxShare, 1, 'uncapped state retains full effective share');
});

test('efficiency package rows in the same non-stacking group share the group cap', () => {
  const request = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'lp-adapter-efficiency-non-stacking-service',
    rows: [
      createRow({
        rowId: 'base::2030',
        outputId: 'service',
        year: 2030,
        stateId: 'base',
        cost: 10,
      }),
      createRow({
        rowId: 'effpkg:base::pkg_a::2030',
        outputId: 'service',
        year: 2030,
        stateId: 'effpkg:base::pkg_a',
        cost: 1,
        maxShare: 0.35,
        provenance: packageProvenance('base', 'pkg_a', 'retrofit'),
      }),
      createRow({
        rowId: 'effpkg:base::pkg_b::2030',
        outputId: 'service',
        year: 2030,
        stateId: 'effpkg:base::pkg_b',
        cost: 0.5,
        maxShare: 0.35,
        provenance: packageProvenance('base', 'pkg_b', 'retrofit'),
      }),
    ],
    configuration: {
      name: 'Non-stacking required service regression',
      description: null,
      years: [2030],
      controlsByOutput: {
        service: {
          2030: {
            mode: 'optimize',
            activeStateIds: ['base', 'effpkg:base::pkg_a', 'effpkg:base::pkg_b'],
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        service: { 2030: 100 },
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

  const result = solveWithLpAdapter(request);
  const variables = getVariableMap(result);
  const packageTotal =
    (variables.get('activity:effpkg:base::pkg_a::2030') ?? 0)
    + (variables.get('activity:effpkg:base::pkg_b::2030') ?? 0);
  const nonStackingConstraint = result.reporting.bindingConstraints.find((constraint) => {
    return constraint.kind === 'efficiency_non_stacking_group';
  });

  assert.equal(result.status, 'solved');
  assertClose(packageTotal, 35, 'same-group package total');
  assertClose(nonStackingConstraint?.boundValue, 35, 'non-stacking group cap');
  assertClose(nonStackingConstraint?.actualValue, 35, 'non-stacking group activity');
});

test('efficiency package rows in different non-stacking groups remain independently available', () => {
  const request = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'lp-adapter-efficiency-independent-groups',
    rows: [
      createRow({
        rowId: 'base::2030',
        outputId: 'service',
        year: 2030,
        stateId: 'base',
        cost: 10,
      }),
      createRow({
        rowId: 'effpkg:base::pkg_a::2030',
        outputId: 'service',
        year: 2030,
        stateId: 'effpkg:base::pkg_a',
        cost: 1,
        maxShare: 0.35,
        provenance: packageProvenance('base', 'pkg_a', 'retrofit_a'),
      }),
      createRow({
        rowId: 'effpkg:base::pkg_b::2030',
        outputId: 'service',
        year: 2030,
        stateId: 'effpkg:base::pkg_b',
        cost: 0.5,
        maxShare: 0.35,
        provenance: packageProvenance('base', 'pkg_b', 'retrofit_b'),
      }),
    ],
    configuration: {
      name: 'Independent non-stacking groups regression',
      description: null,
      years: [2030],
      controlsByOutput: {
        service: {
          2030: {
            mode: 'optimize',
            activeStateIds: ['base', 'effpkg:base::pkg_a', 'effpkg:base::pkg_b'],
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        service: { 2030: 100 },
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

  const result = solveWithLpAdapter(request);
  const variables = getVariableMap(result);
  const packageTotal =
    (variables.get('activity:effpkg:base::pkg_a::2030') ?? 0)
    + (variables.get('activity:effpkg:base::pkg_b::2030') ?? 0);

  assert.equal(result.status, 'solved');
  assertClose(packageTotal, 70, 'different-group package total');
});

test('endogenous supply efficiency package non-stacking groups use total supply share', () => {
  const request = {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'lp-adapter-efficiency-non-stacking-supply',
    rows: [
      createRow({
        rowId: 'process::2030',
        outputId: 'process',
        year: 2030,
        stateId: 'process',
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
        rowId: 'grid_base::2030',
        outputId: 'electricity',
        outputRole: 'endogenous_supply_commodity',
        year: 2030,
        stateId: 'grid_base',
        cost: 10,
      }),
      createRow({
        rowId: 'effpkg:grid_base::grid_pkg_a::2030',
        outputId: 'electricity',
        outputRole: 'endogenous_supply_commodity',
        year: 2030,
        stateId: 'effpkg:grid_base::grid_pkg_a',
        cost: 1,
        maxShare: 0.35,
        provenance: packageProvenance('grid_base', 'grid_pkg_a', 'grid_retrofit'),
      }),
      createRow({
        rowId: 'effpkg:grid_base::grid_pkg_b::2030',
        outputId: 'electricity',
        outputRole: 'endogenous_supply_commodity',
        year: 2030,
        stateId: 'effpkg:grid_base::grid_pkg_b',
        cost: 0.5,
        maxShare: 0.35,
        provenance: packageProvenance('grid_base', 'grid_pkg_b', 'grid_retrofit'),
      }),
    ],
    configuration: {
      name: 'Non-stacking supply regression',
      description: null,
      years: [2030],
      controlsByOutput: {
        process: {
          2030: {
            mode: 'optimize',
            activeStateIds: ['process'],
            targetValue: null,
          },
        },
        electricity: {
          2030: {
            mode: 'optimize',
            activeStateIds: ['grid_base', 'effpkg:grid_base::grid_pkg_a', 'effpkg:grid_base::grid_pkg_b'],
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        process: { 2030: 100 },
      },
      externalCommodityDemandByCommodity: {
        electricity: { 2030: 0 },
      },
      commodityPriceByCommodity: {
        electricity: {
          unit: 'AUD/MWh',
          valuesByYear: { 2030: 0 },
        },
      },
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

  const result = solveWithLpAdapter(request);
  const variables = getVariableMap(result);
  const packageTotal =
    (variables.get('activity:effpkg:grid_base::grid_pkg_a::2030') ?? 0)
    + (variables.get('activity:effpkg:grid_base::grid_pkg_b::2030') ?? 0);
  const electricitySummary = result.reporting.commodityBalances.find(
    (summary) => summary.commodityId === 'electricity',
  );

  assert.equal(result.status, 'solved');
  assertClose(electricitySummary?.supply, 100, 'electricity supply');
  assertClose(packageTotal, 35, 'supply package group share');
});
