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
  maxShare = null,
}) {
  return {
    rowId,
    outputId,
    outputRole: 'required_service',
    outputLabel: outputId,
    year,
    stateId,
    stateLabel: stateId,
    sector: 'test',
    subsector: 'test',
    region: 'national',
    outputUnit: 'unit',
    conversionCostPerUnit: cost,
    inputs: [],
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
