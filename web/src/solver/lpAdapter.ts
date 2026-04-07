import { solve, type Model, type Solution } from 'yalps';
import type {
  CommoditySolveMode,
  NormalizedSolverRow,
  RawSolveVariableValue,
  ResolvedSolveControl,
  SolveCommodityBalanceSummary,
  SolveDiagnostic,
  SolveReportingSummary,
  SolveRequest,
  SolveRequestSummary,
  SolveResult,
  SolveStateShareSummary,
} from './contract';

const SCENARIO_OBJECTIVE_KEY = 'total_cost';
const SCENARIO_DIRECTION = 'minimize' as const;
const SHARE_TOLERANCE = 1e-6;

type ConstraintBounds = { equal?: number; min?: number; max?: number };

interface RequiredServiceGroup {
  outputId: string;
  year: number;
  demand: number;
  control: ResolvedSolveControl;
  rows: NormalizedSolverRow[];
}

interface SupplyCommodityGroup {
  commodityId: string;
  year: number;
  control: ResolvedSolveControl;
  externalDemand: number;
  rows: NormalizedSolverRow[];
}

interface ScenarioLpBuild {
  model: Model<string, string>;
  diagnostics: SolveDiagnostic[];
  notes: string[];
  hasUnmodeledFeatures: boolean;
  activeRows: NormalizedSolverRow[];
  supplyGroups: SupplyCommodityGroup[];
  balancedCommodityKeys: Set<string>;
}

function yearKey(year: number): string {
  return String(year);
}

function commodityYearKey(commodityId: string, year: number): string {
  return `${commodityId}::${year}`;
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

function commodityBalanceConstraintId(commodityId: string, year: number): string {
  return `commodity_balance:${commodityId}:${year}`;
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

function emptyReporting(): SolveReportingSummary {
  return {
    commodityBalances: [],
    stateShares: [],
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

function resolveRowObjectiveCost(
  request: SolveRequest,
  row: NormalizedSolverRow,
  balancedCommodityKeys: Set<string>,
): number {
  const conversionCost = row.conversionCostPerUnit ?? 0;
  const commodityCost = row.inputs.reduce((total, input) => {
    if (balancedCommodityKeys.has(commodityYearKey(input.commodityId, row.year))) {
      return total;
    }

    return total + input.coefficient * resolveCommodityPrice(request, input.commodityId, row.year);
  }, 0);
  const carbonCost = sumDirectEmissionsPerUnit(row) * (request.scenario.carbonPriceByYear[yearKey(row.year)] ?? 0);

  return conversionCost + commodityCost + carbonCost;
}

function addConstraint(
  constraints: Record<string, ConstraintBounds>,
  variables: Record<string, Record<string, number>>,
  variableId: string,
  constraintId: string,
  constraint: ConstraintBounds,
): void {
  constraints[constraintId] = constraint;
  variables[variableId][constraintId] = 1;
}

function addShareConstraint(
  constraints: Record<string, ConstraintBounds>,
  variables: Record<string, Record<string, number>>,
  groupVariableIds: string[],
  constrainedVariableId: string,
  share: number,
  constraintId: string,
  constraint: ConstraintBounds,
): void {
  constraints[constraintId] = constraint;

  for (const groupVariableId of groupVariableIds) {
    const coefficient = groupVariableId === constrainedVariableId ? 1 - share : -share;
    variables[groupVariableId][constraintId] = coefficient;
  }
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

    const key = commodityYearKey(row.outputId, row.year);
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

function collectSupplyCommodityGroups(request: SolveRequest): SupplyCommodityGroup[] {
  const groups = new Map<string, SupplyCommodityGroup>();

  for (const row of request.rows) {
    if (row.outputRole !== 'endogenous_supply_commodity') {
      continue;
    }

    const control = request.scenario.controlsByOutput[row.outputId]?.[yearKey(row.year)];

    if (!control) {
      throw new Error(
        `Missing resolved control for supply commodity ${JSON.stringify(row.outputId)} in ${row.year}.`,
      );
    }

    const key = commodityYearKey(row.outputId, row.year);
    const existing = groups.get(key);

    if (existing) {
      existing.rows.push(row);
      continue;
    }

    groups.set(key, {
      commodityId: row.outputId,
      year: row.year,
      control,
      externalDemand: request.scenario.externalCommodityDemandByCommodity[row.outputId]?.[yearKey(row.year)] ?? 0,
      rows: [row],
    });
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.year !== right.year) {
      return left.year - right.year;
    }

    return left.commodityId.localeCompare(right.commodityId);
  });
}

function validateFixedShareControl(
  outputId: string,
  year: number,
  rows: NormalizedSolverRow[],
  control: ResolvedSolveControl,
  controlLabel: string,
): SolveDiagnostic[] {
  const diagnostics: SolveDiagnostic[] = [];
  const availableStateIds = new Set(rows.map((row) => row.stateId));
  const disabledStateIds = new Set(control.disabledStateIds);
  const shares = control.fixedShares;

  if (!shares || Object.keys(shares).length === 0) {
    diagnostics.push({
      code: 'missing_fixed_shares',
      severity: 'error',
      message: `${controlLabel} for ${outputId} in ${year} requires at least one state share.`,
      outputId,
      year,
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
        message: `Fixed-share state ${JSON.stringify(stateId)} is not available for ${outputId} in ${year}.`,
        outputId,
        year,
        stateId,
      });
    }

    if (disabledStateIds.has(stateId)) {
      diagnostics.push({
        code: 'disabled_fixed_share_state',
        severity: 'error',
        message: `Fixed-share state ${JSON.stringify(stateId)} is disabled for ${outputId} in ${year}.`,
        outputId,
        year,
        stateId,
      });
    }

    if (share < 0) {
      diagnostics.push({
        code: 'negative_fixed_share',
        severity: 'error',
        message: `Fixed share for ${JSON.stringify(stateId)} in ${outputId} ${year} must be non-negative.`,
        outputId,
        year,
        stateId,
      });
    }
  }

  if (Math.abs(shareTotal - 1) > SHARE_TOLERANCE) {
    diagnostics.push({
      code: 'fixed_share_total_must_equal_one',
      severity: 'error',
      message: `Fixed shares for ${outputId} in ${year} sum to ${shareTotal.toFixed(6)} instead of 1.`,
      outputId,
      year,
    });
  }

  return diagnostics;
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

  if (group.control.mode === 'fixed_shares') {
    diagnostics.push(
      ...validateFixedShareControl(
        group.outputId,
        group.year,
        group.rows,
        group.control,
        'Fixed-share control',
      ),
    );
  }

  return diagnostics;
}

function validateSupplyCommodityGroup(group: SupplyCommodityGroup): SolveDiagnostic[] {
  const diagnostics: SolveDiagnostic[] = [];

  if (group.control.mode === 'externalized' || group.control.mode === 'optimize') {
    return diagnostics;
  }

  if (group.control.mode === 'fixed_shares') {
    diagnostics.push(
      ...validateFixedShareControl(
        group.commodityId,
        group.year,
        group.rows,
        group.control,
        'Fixed-share supply control',
      ),
    );
    return diagnostics;
  }

  diagnostics.push({
    code: 'invalid_supply_control_mode',
    severity: 'error',
    message: `Supply commodity ${group.commodityId} in ${group.year} must use fixed_shares, optimize, or externalized mode.`,
    outputId: group.commodityId,
    year: group.year,
  });

  return diagnostics;
}

function buildScenarioLpModel(request: SolveRequest): ScenarioLpBuild {
  const constraints: Record<string, ConstraintBounds> = {};
  const variables: Record<string, Record<string, number>> = {};
  const diagnostics: SolveDiagnostic[] = [];
  const notes: string[] = [];
  const requiredServiceGroups = collectRequiredServiceGroups(request);
  const supplyGroups = collectSupplyCommodityGroups(request);

  if (requiredServiceGroups.length === 0) {
    throw new Error('Solve request does not include any required-service rows to optimize.');
  }

  for (const group of requiredServiceGroups) {
    diagnostics.push(...validateRequiredServiceGroup(group));
  }

  for (const group of supplyGroups) {
    diagnostics.push(...validateSupplyCommodityGroup(group));
  }

  const ignoredRows = request.rows.filter((row) => row.outputRole === 'optional_removals');
  const hasUnmodeledFeatures = ignoredRows.length > 0 || request.scenario.options.shareSmoothing.enabled;

  if (ignoredRows.length > 0) {
    const ignoredOutputCount = new Set(ignoredRows.map((row) => row.outputId)).size;
    diagnostics.push({
      code: 'optional_rows_pending',
      severity: 'warning',
      message: `${ignoredRows.length} optional-removal rows across ${ignoredOutputCount} outputs remain outside the current LP core and are ignored for this solve.`,
    });
  }

  if (request.scenario.options.shareSmoothing.enabled) {
    diagnostics.push({
      code: 'share_smoothing_pending',
      severity: 'warning',
      message: 'Share smoothing is enabled in the scenario, but the rollout proxy is not yet enforced in the LP core.',
    });
  }

  const balancedCommodityKeys = new Set(
    supplyGroups
      .filter((group) => group.control.mode !== 'externalized')
      .map((group) => commodityYearKey(group.commodityId, group.year)),
  );

  const activeRows = request.rows.filter((row) => row.outputRole !== 'optional_removals');

  for (const row of activeRows) {
    variables[activityVariableId(row)] = {
      [SCENARIO_OBJECTIVE_KEY]: resolveRowObjectiveCost(request, row, balancedCommodityKeys),
    };
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
      activeRows,
      supplyGroups,
      balancedCommodityKeys,
    };
  }

  for (const group of requiredServiceGroups) {
    const demandId = demandConstraintId(group.outputId, group.year);
    const disabledStateIds = new Set(group.control.disabledStateIds);
    const fixedShares = group.control.fixedShares ?? {};

    constraints[demandId] = { equal: group.demand };

    for (const row of group.rows) {
      const variableId = activityVariableId(row);
      variables[variableId][demandId] = 1;

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

  for (const group of supplyGroups) {
    const variableIds = group.rows.map((row) => activityVariableId(row));
    const disabledStateIds = new Set(group.control.disabledStateIds);
    const fixedShares = group.control.fixedShares ?? {};

    if (group.control.mode === 'externalized') {
      for (const row of group.rows) {
        addConstraint(
          constraints,
          variables,
          activityVariableId(row),
          stateConstraintId('externalized', row),
          { equal: 0 },
        );
      }

      continue;
    }

    const balanceId = commodityBalanceConstraintId(group.commodityId, group.year);
    constraints[balanceId] = { equal: group.externalDemand };

    for (const row of activeRows) {
      if (row.year !== group.year || row.outputId === group.commodityId) {
        continue;
      }

      const coefficient = row.inputs.reduce((total, input) => {
        return input.commodityId === group.commodityId ? total + input.coefficient : total;
      }, 0);

      if (coefficient !== 0) {
        variables[activityVariableId(row)][balanceId] = -coefficient;
      }
    }

    for (const row of group.rows) {
      const variableId = activityVariableId(row);
      variables[variableId][balanceId] = (variables[variableId][balanceId] ?? 0) + 1;

      if (disabledStateIds.has(row.stateId)) {
        addConstraint(constraints, variables, variableId, stateConstraintId('disabled', row), { equal: 0 });
        continue;
      }

      if (group.control.mode === 'fixed_shares') {
        addShareConstraint(
          constraints,
          variables,
          variableIds,
          variableId,
          fixedShares[row.stateId] ?? 0,
          stateConstraintId('fixed_share', row),
          { equal: 0 },
        );
      }

      if (row.bounds.minShare != null) {
        addShareConstraint(
          constraints,
          variables,
          variableIds,
          variableId,
          row.bounds.minShare,
          stateConstraintId('min_share', row),
          { min: 0 },
        );
      }

      if (request.scenario.options.respectMaxShare && row.bounds.maxShare != null) {
        addShareConstraint(
          constraints,
          variables,
          variableIds,
          variableId,
          row.bounds.maxShare,
          stateConstraintId('max_share', row),
          { max: 0 },
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

  const endogenousSupplyGroupCount = supplyGroups.filter((group) => group.control.mode !== 'externalized').length;
  const externalizedSupplyGroupCount = supplyGroups.length - endogenousSupplyGroupCount;

  notes.push(
    `Built a generic LP over ${requiredServiceGroups.length} required-service groups, ${endogenousSupplyGroupCount} endogenous-supply groups, and ${Object.keys(variables).length} activity variables.`,
  );
  notes.push(
    'Objective coefficients combine row conversion cost, exogenously priced non-balanced commodity inputs, and direct-emissions carbon cost using the resolved scenario tables.',
  );
  notes.push(
    `Electricity-style supply commodities enforce balance when they stay in-model; ${externalizedSupplyGroupCount} supply-year groups are externalized and fixed to zero activity.`,
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
    activeRows,
    supplyGroups,
    balancedCommodityKeys,
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
    code: 'service_and_supply_lp_completed',
    severity: solution.status === 'optimal' ? 'info' : 'warning',
    message: `The service-and-supply LP core completed with status ${solution.status}.`,
  });

  if (solution.status !== 'optimal') {
    diagnostics.push({
      code: 'service_and_supply_lp_not_optimal',
      severity: 'error',
      message: 'The current LP core could not find an optimal feasible solution for the required-service and endogenous-supply constraints.',
    });
  }

  if (build.hasUnmodeledFeatures && solution.status === 'optimal') {
    diagnostics.push({
      code: 'partial_domain_coverage',
      severity: 'warning',
      message: 'The LP solved required services and in-model supply commodities, but removals or rollout smoothing still need downstream tasks.',
    });
  }

  return diagnostics;
}

function buildVariableValueMap(solution: Solution<string>): Map<string, number> {
  return new Map(solution.variables);
}

function buildStateShareSummary(
  rows: NormalizedSolverRow[],
  variableValues: Map<string, number>,
): SolveStateShareSummary[] {
  const groupedRows = new Map<string, { outputId: string; outputLabel: string; year: number; rows: NormalizedSolverRow[] }>();

  for (const row of rows) {
    const key = commodityYearKey(row.outputId, row.year);
    const existing = groupedRows.get(key);

    if (existing) {
      existing.rows.push(row);
      continue;
    }

    groupedRows.set(key, {
      outputId: row.outputId,
      outputLabel: row.outputLabel,
      year: row.year,
      rows: [row],
    });
  }

  return Array.from(groupedRows.values())
    .sort((left, right) => {
      if (left.year !== right.year) {
        return left.year - right.year;
      }

      return left.outputId.localeCompare(right.outputId);
    })
    .flatMap((group) => {
      const totalActivity = group.rows.reduce((total, row) => {
        return total + (variableValues.get(activityVariableId(row)) ?? 0);
      }, 0);

      return [...group.rows]
        .sort((left, right) => left.stateLabel.localeCompare(right.stateLabel))
        .map((row) => {
          const activity = variableValues.get(activityVariableId(row)) ?? 0;
          return {
            outputId: group.outputId,
            outputLabel: group.outputLabel,
            year: group.year,
            stateId: row.stateId,
            stateLabel: row.stateLabel,
            activity,
            share: totalActivity > 0 ? activity / totalActivity : null,
          } satisfies SolveStateShareSummary;
        });
    });
}

function buildCommodityBalanceSummary(
  request: SolveRequest,
  build: ScenarioLpBuild,
  variableValues: Map<string, number>,
): SolveCommodityBalanceSummary[] {
  return build.supplyGroups.map((group) => {
    const mode: CommoditySolveMode = group.control.mode === 'externalized' ? 'externalized' : 'endogenous';
    const supply = group.rows.reduce((total, row) => {
      return total + (variableValues.get(activityVariableId(row)) ?? 0);
    }, 0);
    const modeledDemand = build.activeRows.reduce((total, row) => {
      if (row.year !== group.year || row.outputId === group.commodityId) {
        return total;
      }

      const activity = variableValues.get(activityVariableId(row)) ?? 0;
      if (activity === 0) {
        return total;
      }

      const rowDemand = row.inputs.reduce((rowTotal, input) => {
        return input.commodityId === group.commodityId
          ? rowTotal + input.coefficient * activity
          : rowTotal;
      }, 0);

      return total + rowDemand;
    }, 0);
    const totalDemand = modeledDemand + group.externalDemand;
    const averageSupplyCost = supply > 0
      ? group.rows.reduce((total, row) => {
        const activity = variableValues.get(activityVariableId(row)) ?? 0;
        return total + resolveRowObjectiveCost(request, row, build.balancedCommodityKeys) * activity;
      }, 0) / supply
      : mode === 'externalized'
        ? resolveCommodityPrice(request, group.commodityId, group.year)
        : null;
    const averageDirectEmissionsIntensity = supply > 0
      ? group.rows.reduce((total, row) => {
        const activity = variableValues.get(activityVariableId(row)) ?? 0;
        return total + sumDirectEmissionsPerUnit(row) * activity;
      }, 0) / supply
      : null;

    return {
      commodityId: group.commodityId,
      year: group.year,
      mode,
      supply,
      modeledDemand,
      externalDemand: group.externalDemand,
      totalDemand,
      pricedExogenousDemand: mode === 'externalized' ? totalDemand : 0,
      balanceGap: mode === 'endogenous' ? supply - totalDemand : null,
      averageSupplyCost,
      averageDirectEmissionsIntensity,
    } satisfies SolveCommodityBalanceSummary;
  });
}

function buildReportingSummary(
  request: SolveRequest,
  solution: Solution<string>,
  build: ScenarioLpBuild,
): SolveReportingSummary {
  const variableValues = buildVariableValueMap(solution);

  return {
    commodityBalances: buildCommodityBalanceSummary(request, build, variableValues),
    stateShares: buildStateShareSummary(build.activeRows, variableValues),
  };
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
    reporting: emptyReporting(),
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
    reporting: buildReportingSummary(request, solution, build),
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
