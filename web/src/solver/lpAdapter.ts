import { solve, type Model, type Solution } from 'yalps';
import type {
  NormalizedSolverRow,
  ResolvedSolveControl,
  RawSolveVariableValue,
  SolveDiagnostic,
  SolveRequest,
  SolveRequestSummary,
  SolveResult,
} from './contract';

const SCENARIO_OBJECTIVE_KEY = 'total_cost';
const SCENARIO_DIRECTION = 'minimize' as const;
const SHARE_TOLERANCE = 1e-6;

interface RequiredServiceGroup {
  outputId: string;
  year: number;
  demand: number;
  control: ResolvedSolveControl;
  rows: NormalizedSolverRow[];
}

interface ScenarioLpBuild {
  model: Model<string, string>;
  diagnostics: SolveDiagnostic[];
  notes: string[];
  hasUnmodeledFeatures: boolean;
}

function yearKey(year: number): string {
  return String(year);
}

function activityVariableId(row: NormalizedSolverRow): string {
  return `activity:${row.rowId}`;
}

function stateConstraintId(prefix: string, row: NormalizedSolverRow): string {
  return `${prefix}:${row.rowId}`;
}

function demandConstraintId(outputId: string, year: number): string {
  return `demand:${outputId}:${year}`;
}

function countDistinctOutputs(request: SolveRequest): number {
  return new Set(request.rows.map((row) => row.outputId)).size;
}

function summarizeRequest(request: SolveRequest): SolveRequestSummary {
  return {
    rowCount: request.rows.length,
    yearCount: request.scenario.years.length,
    outputCount: countDistinctOutputs(request),
    serviceDemandOutputCount: Object.keys(request.scenario.serviceDemandByOutput).length,
    externalCommodityCount: Object.keys(request.scenario.externalCommodityDemandByCommodity).length,
  };
}

function toRawVariables(solution: Solution<string>): RawSolveVariableValue[] {
  return solution.variables.map(([id, value]) => ({ id, value }));
}

function sumDirectEmissionsPerUnit(row: NormalizedSolverRow): number {
  return row.directEmissions.reduce((total, emission) => total + emission.value, 0);
}

function resolveCommodityPrice(request: SolveRequest, commodityId: string, year: number): number {
  return request.scenario.commodityPriceByCommodity[commodityId]?.valuesByYear[yearKey(year)] ?? 0;
}

function resolveRowObjectiveCost(request: SolveRequest, row: NormalizedSolverRow): number {
  const conversionCost = row.conversionCostPerUnit ?? 0;
  const commodityCost = row.inputs.reduce((total, input) => {
    return total + input.coefficient * resolveCommodityPrice(request, input.commodityId, row.year);
  }, 0);
  const carbonCost = sumDirectEmissionsPerUnit(row) * (request.scenario.carbonPriceByYear[yearKey(row.year)] ?? 0);

  return conversionCost + commodityCost + carbonCost;
}

function addConstraint(
  constraints: Record<string, { equal?: number; min?: number; max?: number }>,
  variables: Record<string, Record<string, number>>,
  variableId: string,
  constraintId: string,
  constraint: { equal?: number; min?: number; max?: number },
): void {
  constraints[constraintId] = constraint;
  variables[variableId][constraintId] = 1;
}

function collectRequiredServiceGroups(request: SolveRequest): RequiredServiceGroup[] {
  const groups = new Map<string, RequiredServiceGroup>();

  for (const row of request.rows) {
    if (row.outputRole !== 'required_service') {
      continue;
    }

    const demand = request.scenario.serviceDemandByOutput[row.outputId]?.[yearKey(row.year)] ?? 0;
    const control = request.scenario.controlsByOutput[row.outputId]?.[yearKey(row.year)];

    if (!control) {
      throw new Error(
        `Missing resolved control for required service ${JSON.stringify(row.outputId)} in ${row.year}.`,
      );
    }

    const key = `${row.outputId}::${row.year}`;
    const existing = groups.get(key);

    if (existing) {
      existing.rows.push(row);
      continue;
    }

    groups.set(key, {
      outputId: row.outputId,
      year: row.year,
      demand,
      control,
      rows: [row],
    });
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.year !== right.year) {
      return left.year - right.year;
    }

    return left.outputId.localeCompare(right.outputId);
  });
}

function validateRequiredServiceGroup(group: RequiredServiceGroup): SolveDiagnostic[] {
  const diagnostics: SolveDiagnostic[] = [];
  const availableStateIds = new Set(group.rows.map((row) => row.stateId));
  const disabledStateIds = new Set(group.control.disabledStateIds);

  if (group.control.mode === 'pinned_single') {
    if (!group.control.stateId) {
      diagnostics.push({
        code: 'missing_pinned_state',
        severity: 'error',
        message: `Pinned control for ${group.outputId} in ${group.year} is missing state_id.`,
        outputId: group.outputId,
        year: group.year,
      });
      return diagnostics;
    }

    if (!availableStateIds.has(group.control.stateId)) {
      diagnostics.push({
        code: 'unknown_pinned_state',
        severity: 'error',
        message: `Pinned state ${JSON.stringify(group.control.stateId)} is not available for ${group.outputId} in ${group.year}.`,
        outputId: group.outputId,
        year: group.year,
        stateId: group.control.stateId,
      });
    }

    if (disabledStateIds.has(group.control.stateId)) {
      diagnostics.push({
        code: 'disabled_pinned_state',
        severity: 'error',
        message: `Pinned state ${JSON.stringify(group.control.stateId)} is disabled for ${group.outputId} in ${group.year}.`,
        outputId: group.outputId,
        year: group.year,
        stateId: group.control.stateId,
      });
    }

    return diagnostics;
  }

  if (group.control.mode !== 'fixed_shares') {
    return diagnostics;
  }

  const shares = group.control.fixedShares;
  if (!shares || Object.keys(shares).length === 0) {
    diagnostics.push({
      code: 'missing_fixed_shares',
      severity: 'error',
      message: `Fixed-share control for ${group.outputId} in ${group.year} requires at least one state share.`,
      outputId: group.outputId,
      year: group.year,
    });
    return diagnostics;
  }

  let shareTotal = 0;
  for (const [stateId, share] of Object.entries(shares)) {
    shareTotal += share;

    if (!availableStateIds.has(stateId)) {
      diagnostics.push({
        code: 'unknown_fixed_share_state',
        severity: 'error',
        message: `Fixed-share state ${JSON.stringify(stateId)} is not available for ${group.outputId} in ${group.year}.`,
        outputId: group.outputId,
        year: group.year,
        stateId,
      });
    }

    if (disabledStateIds.has(stateId)) {
      diagnostics.push({
        code: 'disabled_fixed_share_state',
        severity: 'error',
        message: `Fixed-share state ${JSON.stringify(stateId)} is disabled for ${group.outputId} in ${group.year}.`,
        outputId: group.outputId,
        year: group.year,
        stateId,
      });
    }

    if (share < 0) {
      diagnostics.push({
        code: 'negative_fixed_share',
        severity: 'error',
        message: `Fixed share for ${JSON.stringify(stateId)} in ${group.outputId} ${group.year} must be non-negative.`,
        outputId: group.outputId,
        year: group.year,
        stateId,
      });
    }
  }

  if (Math.abs(shareTotal - 1) > SHARE_TOLERANCE) {
    diagnostics.push({
      code: 'fixed_share_total_must_equal_one',
      severity: 'error',
      message: `Fixed shares for ${group.outputId} in ${group.year} sum to ${shareTotal.toFixed(6)} instead of 1.`,
      outputId: group.outputId,
      year: group.year,
    });
  }

  return diagnostics;
}

function buildScenarioLpModel(request: SolveRequest): ScenarioLpBuild {
  const constraints: Record<string, { equal?: number; min?: number; max?: number }> = {};
  const variables: Record<string, Record<string, number>> = {};
  const diagnostics: SolveDiagnostic[] = [];
  const notes: string[] = [];
  const groups = collectRequiredServiceGroups(request);

  if (groups.length === 0) {
    throw new Error('Solve request does not include any required-service rows to optimize.');
  }

  for (const group of groups) {
    diagnostics.push(...validateRequiredServiceGroup(group));
  }

  const ignoredRows = request.rows.filter((row) => row.outputRole !== 'required_service');
  const hasUnmodeledFeatures =
    ignoredRows.length > 0
    || Object.keys(request.scenario.externalCommodityDemandByCommodity).length > 0
    || request.scenario.options.shareSmoothing.enabled;

  if (ignoredRows.length > 0) {
    const ignoredOutputCount = new Set(ignoredRows.map((row) => row.outputId)).size;
    diagnostics.push({
      code: 'non_required_rows_pending',
      severity: 'warning',
      message: `${ignoredRows.length} non-required rows across ${ignoredOutputCount} outputs remain outside the current LP core and are ignored for this solve.`,
    });
  }

  if (Object.keys(request.scenario.externalCommodityDemandByCommodity).length > 0) {
    diagnostics.push({
      code: 'commodity_balance_pending',
      severity: 'warning',
      message: 'External commodity demand tables are present, but endogenous commodity-balance constraints are not yet active in this solver core.',
    });
  }

  if (request.scenario.options.shareSmoothing.enabled) {
    diagnostics.push({
      code: 'share_smoothing_pending',
      severity: 'warning',
      message: 'Share smoothing is enabled in the scenario, but the rollout proxy is not yet enforced in the LP core.',
    });
  }

  const validationErrors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  if (validationErrors.length > 0) {
    return {
      model: {
        direction: SCENARIO_DIRECTION,
        objective: SCENARIO_OBJECTIVE_KEY,
        constraints: {},
        variables: {},
      },
      diagnostics,
      notes,
      hasUnmodeledFeatures,
    };
  }

  for (const group of groups) {
    const demandId = demandConstraintId(group.outputId, group.year);
    const disabledStateIds = new Set(group.control.disabledStateIds);
    const fixedShares = group.control.fixedShares ?? {};

    constraints[demandId] = { equal: group.demand };

    for (const row of group.rows) {
      const variableId = activityVariableId(row);
      variables[variableId] = {
        [SCENARIO_OBJECTIVE_KEY]: resolveRowObjectiveCost(request, row),
        [demandId]: 1,
      };

      if (disabledStateIds.has(row.stateId)) {
        addConstraint(constraints, variables, variableId, stateConstraintId('disabled', row), { equal: 0 });
        continue;
      }

      if (group.control.mode === 'pinned_single') {
        addConstraint(
          constraints,
          variables,
          variableId,
          stateConstraintId('pinned', row),
          { equal: row.stateId === group.control.stateId ? group.demand : 0 },
        );
      } else if (group.control.mode === 'fixed_shares') {
        addConstraint(
          constraints,
          variables,
          variableId,
          stateConstraintId('fixed_share', row),
          { equal: (fixedShares[row.stateId] ?? 0) * group.demand },
        );
      }

      if (row.bounds.minShare != null) {
        addConstraint(
          constraints,
          variables,
          variableId,
          stateConstraintId('min_share', row),
          { min: row.bounds.minShare * group.demand },
        );
      }

      if (request.scenario.options.respectMaxShare && row.bounds.maxShare != null) {
        addConstraint(
          constraints,
          variables,
          variableId,
          stateConstraintId('max_share', row),
          { max: row.bounds.maxShare * group.demand },
        );
      }

      if (request.scenario.options.respectMaxActivity && row.bounds.maxActivity != null) {
        addConstraint(
          constraints,
          variables,
          variableId,
          stateConstraintId('max_activity', row),
          { max: row.bounds.maxActivity },
        );
      }
    }
  }

  notes.push(
    `Built a generic required-service LP over ${groups.length} output-year groups and ${Object.keys(variables).length} activity variables.`,
  );
  notes.push(
    'Objective coefficients combine row conversion cost, priced commodity inputs, and direct-emissions carbon cost using the resolved scenario tables.',
  );

  return {
    model: {
      direction: SCENARIO_DIRECTION,
      objective: SCENARIO_OBJECTIVE_KEY,
      constraints,
      variables,
    },
    diagnostics,
    notes,
    hasUnmodeledFeatures,
  };
}

function buildDiagnostics(
  solution: Solution<string> | null,
  build: ScenarioLpBuild,
): SolveDiagnostic[] {
  const diagnostics = [...build.diagnostics];

  diagnostics.unshift({
    code: 'worker_boundary_ready',
    severity: 'info',
    message: 'The solve request was normalized, transferred to a Web Worker, and executed through the LP adapter.',
  });

  if (!solution) {
    return diagnostics;
  }

  diagnostics.push({
    code: 'required_service_lp_completed',
    severity: solution.status === 'optimal' ? 'info' : 'warning',
    message: `The required-service LP core completed with status ${solution.status}.`,
  });

  if (solution.status !== 'optimal') {
    diagnostics.push({
      code: 'required_service_lp_not_optimal',
      severity: 'error',
      message: 'The current LP core could not find an optimal feasible solution for the required-service constraints.',
    });
  }

  if (build.hasUnmodeledFeatures && solution.status === 'optimal') {
    diagnostics.push({
      code: 'partial_domain_coverage',
      severity: 'warning',
      message: 'The LP solved the required-service core, but commodity balances, removals, or rollout smoothing still need downstream tasks.',
    });
  }

  return diagnostics;
}

function buildAdapterErrorResult(
  request: SolveRequest,
  startedAt: number,
  diagnostics: SolveDiagnostic[],
): SolveResult {
  return {
    contractVersion: request.contractVersion,
    requestId: request.requestId,
    status: 'error',
    engine: { name: 'yalps', worker: true },
    summary: summarizeRequest(request),
    raw: null,
    diagnostics,
    timingsMs: {
      total: performance.now() - startedAt,
      solve: 0,
    },
  };
}

export function solveWithLpAdapter(request: SolveRequest): SolveResult {
  const startedAt = performance.now();

  if (request.rows.length === 0) {
    return buildAdapterErrorResult(request, startedAt, [
      {
        code: 'empty_rows',
        severity: 'error',
        message: 'Solve requests must include at least one normalized library row.',
      },
    ]);
  }

  const build = buildScenarioLpModel(request);
  const validationErrors = build.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');

  if (validationErrors.length > 0) {
    return buildAdapterErrorResult(request, startedAt, buildDiagnostics(null, build));
  }

  const solveStartedAt = performance.now();
  const solution = solve(build.model, {
    includeZeroVariables: true,
  });
  const solveDurationMs = performance.now() - solveStartedAt;
  const diagnostics = buildDiagnostics(solution, build);

  return {
    contractVersion: request.contractVersion,
    requestId: request.requestId,
    status: solution.status === 'optimal'
      ? build.hasUnmodeledFeatures
        ? 'partial'
        : 'solved'
      : 'error',
    engine: { name: 'yalps', worker: true },
    summary: summarizeRequest(request),
    raw: {
      kind: 'scenario_lp',
      objectiveDirection: SCENARIO_DIRECTION,
      objectiveKey: SCENARIO_OBJECTIVE_KEY,
      variableCount: Object.keys(build.model.variables).length,
      constraintCount: Object.keys(build.model.constraints).length,
      notes: build.notes,
      solutionStatus: solution.status,
      objectiveValue: Number.isFinite(solution.result) ? solution.result : null,
      variables: toRawVariables(solution),
    },
    diagnostics,
    timingsMs: {
      total: performance.now() - startedAt,
      solve: solveDurationMs,
    },
  };
}
