import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildConfigurationBuildFailure,
  buildConfigurationSolveFailure,
} from '../src/solver/configurationSolveFailure.ts';
import ConfigurationWorkspaceCenter from '../src/components/workspace/ConfigurationWorkspaceCenter.tsx';
import { SOLVER_CONTRACT_VERSION } from '../src/solver/contract.ts';

function buildSolveState({
  phase = 'solved',
  request = buildRequest(),
  result = null,
  solvedConfiguration = request?.configuration ?? null,
  error = null,
  failure = null,
}: {
  phase?: 'idle' | 'solving' | 'solved' | 'error';
  request?: ReturnType<typeof buildRequest> | null;
  result?: ReturnType<typeof buildErrorResult> | null;
  solvedConfiguration?: ReturnType<typeof buildRequest>['configuration'] | null;
  error?: string | null;
  failure?: ReturnType<typeof buildConfigurationSolveFailure> | ReturnType<typeof buildConfigurationBuildFailure> | null;
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

function buildRequest() {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'configuration-workspace-failure',
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
    ],
    configuration: {
      name: 'Workspace failure regression',
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
        heat: { 2030: 100 },
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
}

function buildErrorResult() {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: 'configuration-workspace-failure',
    status: 'error',
    engine: { name: 'yalps', worker: true },
    summary: {
      rowCount: 2,
      yearCount: 1,
      outputCount: 1,
      serviceDemandOutputCount: 1,
      externalCommodityCount: 0,
    },
    reporting: {
      commodityBalances: [],
      stateShares: [],
      bindingConstraints: [],
      softConstraintViolations: [],
    },
    raw: {
      kind: 'configuration_lp',
      objectiveDirection: 'minimize',
      objectiveKey: 'configuration_cost',
      variableCount: 2,
      constraintCount: 3,
      notes: [],
      solutionStatus: 'infeasible',
      objectiveValue: null,
      variables: [],
    },
    diagnostics: [
      {
        code: 'service_and_supply_lp_not_optimal',
        severity: 'error',
        message: 'The current LP core could not find an optimal feasible solution for the required-service and endogenous-supply constraints.',
      },
      {
        code: 'service_max_share_exhaustion',
        severity: 'error',
        message: 'Heat cannot meet required service under the current max-share caps.',
        outputId: 'heat',
        year: 2030,
        reason: 'share_exhaustion',
        relatedConstraintIds: ['service_demand:heat:2030'],
      },
      {
        code: 'worker_boundary_ready',
        severity: 'info',
        message: 'The solve request was normalized, transferred to a Web Worker, and executed through the LP adapter.',
      },
    ],
    timingsMs: {
      total: 5,
      solve: 2,
    },
  } as const;
}

describe('configuration solve failures', () => {
  test('build failures preserve the main line and detail lines separately', () => {
    const failure = buildConfigurationBuildFailure([
      'Cannot solve because exact-share controls are malformed:',
      '- heat (2030): shares exceed 100%',
      '- electricity (2030): disabled state is still pinned',
    ].join('\n'));

    assert.equal(failure.stage, 'build');
    assert.equal(failure.headline, 'Cannot solve because exact-share controls are malformed:');
    assert.deepEqual(failure.detailLines, [
      '- heat (2030): shares exceed 100%',
      '- electricity (2030): disabled state is still pinned',
    ]);
  });

  test('solve failures use structured diagnostics as the report headline', () => {
    const result = buildErrorResult();
    const failure = buildConfigurationSolveFailure(result);

    assert.equal(failure.stage, 'solve');
    assert.equal(
      failure.headline,
      'The current LP core could not find an optimal feasible solution for the required-service and endogenous-supply constraints.',
    );
    assert.equal(failure.diagnostics.length, 3);
  });

  test('workspace content renders the failure report and suppresses the chart grid', () => {
    const request = buildRequest();
    const failure = buildConfigurationSolveFailure(buildErrorResult());

    const html = renderToStaticMarkup(
      <ConfigurationWorkspaceCenter
        baseConfigId={null}
        baseSelectionMode="none"
        baseSolve={buildSolveState({
          phase: 'idle',
          request: null,
          result: null,
          solvedConfiguration: null,
        })}
        commonComparisonYears={[]}
        comparisonEnabled={false}
        efficiencyAttributionSafe={false}
        configurationOptions={[]}
        focusConfigurationLabel={request.configuration.name}
        focusSolve={buildSolveState({
          phase: 'error',
          request,
          result: null,
          error: failure.headline,
          failure,
        })}
        fuelSwitchBasis="to"
        onBaseConfigChange={() => {}}
        onBaseSelectionModeChange={() => {}}
        onFuelSwitchBasisChange={() => {}}
        onFuelSwitchYearChange={() => {}}
        onSystemFlowChange={() => {}}
        selectedFuelSwitchYear={null}
        systemFlow={{
          selectedYear: null,
          viewMode: 'both',
          collapsedSegmentIds: [],
        }}
      />,
    );

    assert.match(html, /Build failure|Solve failure/);
    assert.match(html, /Solver status: infeasible/i);
    assert.match(html, /Heat cannot meet required service under the current max-share caps\./);
    assert.doesNotMatch(html, /workspace-chart-grid/);
  });
});
