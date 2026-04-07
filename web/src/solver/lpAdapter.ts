import { solve, type Model, type Solution } from 'yalps';
import type {
  RawSolveVariableValue,
  SolveDiagnostic,
  SolveRequest,
  SolveRequestSummary,
  SolveResult,
} from './contract';

const PROBE_OBJECTIVE_KEY = 'probe_cost';
const PROBE_DIRECTION = 'minimize' as const;

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

function sumDemandForYear(request: SolveRequest, year: number): number {
  const key = String(year);
  let total = 0;

  for (const table of Object.values(request.scenario.serviceDemandByOutput)) {
    total += table[key] ?? 0;
  }

  for (const table of Object.values(request.scenario.externalCommodityDemandByCommodity)) {
    total += table[key] ?? 0;
  }

  return total;
}

function scaleDemandSignal(totalDemand: number): number {
  if (!Number.isFinite(totalDemand) || totalDemand <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(totalDemand));
  return Number((totalDemand / 10 ** exponent).toFixed(3));
}

function buildEngineProbeModel(request: SolveRequest): Model<string, string> {
  const constraints: Record<string, { equal: number }> = {};
  const variables: Record<string, Record<string, number>> = {};

  for (const year of request.scenario.years) {
    const constraintId = `probe_year:${year}`;
    const variableId = `probe_year_weight:${year}`;
    const yearRowCount = request.rows.filter((row) => row.year === year).length;
    const demandSignal = scaleDemandSignal(sumDemandForYear(request, year));

    constraints[constraintId] = { equal: 1 };
    variables[variableId] = {
      [PROBE_OBJECTIVE_KEY]: Math.max(yearRowCount, 1) + demandSignal,
      [constraintId]: 1,
    };
  }

  return {
    direction: PROBE_DIRECTION,
    objective: PROBE_OBJECTIVE_KEY,
    constraints,
    variables,
  };
}

function toRawVariables(solution: Solution<string>): RawSolveVariableValue[] {
  return solution.variables.map(([id, value]) => ({ id, value }));
}

function buildDiagnostics(request: SolveRequest, solution: Solution<string>): SolveDiagnostic[] {
  const controlModes = new Set<string>();

  for (const controlsByYear of Object.values(request.scenario.controlsByOutput)) {
    for (const control of Object.values(controlsByYear)) {
      controlModes.add(control.mode);
    }
  }

  return [
    {
      code: 'worker_boundary_ready',
      severity: 'info',
      message: 'The solve request was normalized, transferred to a Web Worker, and executed through the LP adapter.',
    },
    {
      code: 'engine_probe_completed',
      severity: solution.status === 'optimal' ? 'info' : 'warning',
      message: `The lightweight LP engine probe completed with status ${solution.status}.`,
    },
    {
      code: 'scenario_lp_pending',
      severity: 'warning',
      message: `The stable contract and worker boundary are active; full scenario-to-LP translation for modes ${Array.from(controlModes).sort().join(', ')} lands in the next solver-core task.`,
    },
  ];
}

export function solveWithLpAdapter(request: SolveRequest): SolveResult {
  const startedAt = performance.now();

  if (request.rows.length === 0) {
    return {
      contractVersion: request.contractVersion,
      requestId: request.requestId,
      status: 'error',
      engine: { name: 'yalps', worker: true },
      summary: summarizeRequest(request),
      raw: null,
      diagnostics: [
        {
          code: 'empty_rows',
          severity: 'error',
          message: 'Solve requests must include at least one normalized library row.',
        },
      ],
      timingsMs: {
        total: performance.now() - startedAt,
        solve: 0,
      },
    };
  }

  const model = buildEngineProbeModel(request);
  const solveStartedAt = performance.now();
  const solution = solve(model);
  const solveDurationMs = performance.now() - solveStartedAt;
  const diagnostics = buildDiagnostics(request, solution);

  return {
    contractVersion: request.contractVersion,
    requestId: request.requestId,
    status: solution.status === 'optimal' ? 'partial' : 'error',
    engine: { name: 'yalps', worker: true },
    summary: summarizeRequest(request),
    raw: {
      kind: 'engine_probe',
      objectiveDirection: PROBE_DIRECTION,
      objectiveKey: PROBE_OBJECTIVE_KEY,
      variableCount: Object.keys(model.variables).length,
      constraintCount: Object.keys(model.constraints).length,
      notes: [
        'Uses one probe variable per scenario milestone year to verify the worker-side LP integration.',
        'Deliberately keeps the domain model outside this issue so the next task can fill in scenario constraints without changing the boundary.',
      ],
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
