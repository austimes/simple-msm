import { getIncludedOutputIds } from '../data/configurationMetadata';
import type { PackageData, ScenarioDocument } from '../data/types';
import {
  SOLVER_CONTRACT_VERSION,
  type NormalizedSolverRow,
  type ResolvedScenarioForSolve,
  type ResolvedSolveControl,
  type SolveRequest,
} from './contract.ts';
import { expandIncludedOutputsForDependencies } from './solveScope.ts';
import {
  normalizeSolverRows,
  resolveScenarioForSolve,
} from './solveRequestModel.ts';

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `solve-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface BuildSolveRequestOptions {
  includedOutputIds?: string[];
}

function filterSolveRequestForOutputs(
  rows: NormalizedSolverRow[],
  scenario: ResolvedScenarioForSolve,
  includedOutputIds: Set<string>,
  seedOutputIds: Set<string>,
): { rows: NormalizedSolverRow[]; scenario: ResolvedScenarioForSolve } {
  const filteredRows = rows.filter((row) => includedOutputIds.has(row.outputId));

  const filteredControlsByOutput: Record<string, Record<string, ResolvedSolveControl>> = {};
  for (const outputId of includedOutputIds) {
    if (scenario.controlsByOutput[outputId]) {
      filteredControlsByOutput[outputId] = scenario.controlsByOutput[outputId];
    }
  }

  const filteredServiceDemandByOutput: Record<string, Record<string, number>> = {};
  for (const outputId of includedOutputIds) {
    if (scenario.serviceDemandByOutput[outputId]) {
      filteredServiceDemandByOutput[outputId] = scenario.serviceDemandByOutput[outputId];
    }
  }

  const filteredExternalCommodityDemandByCommodity: Record<string, Record<string, number>> = {};
  for (const outputId of seedOutputIds) {
    if (scenario.externalCommodityDemandByCommodity[outputId]) {
      filteredExternalCommodityDemandByCommodity[outputId] = scenario.externalCommodityDemandByCommodity[outputId];
    }
  }

  return {
    rows: filteredRows,
    scenario: {
      ...scenario,
      controlsByOutput: filteredControlsByOutput,
      serviceDemandByOutput: filteredServiceDemandByOutput,
      externalCommodityDemandByCommodity: filteredExternalCommodityDemandByCommodity,
    },
  };
}

export function collectOutputIdsForSelection(
  rows: NormalizedSolverRow[],
  selection: { sectors?: string[]; subsectors?: string[]; outputIds?: string[] },
): string[] {
  const outputIds = new Set<string>();

  if (selection.outputIds) {
    for (const outputId of selection.outputIds) {
      outputIds.add(outputId);
    }
  }

  if (selection.sectors) {
    const sectors = new Set(selection.sectors);
    for (const row of rows) {
      if (sectors.has(row.sector)) {
        outputIds.add(row.outputId);
      }
    }
  }

  if (selection.subsectors) {
    const subsectors = new Set(selection.subsectors);
    for (const row of rows) {
      if (subsectors.has(row.subsector)) {
        outputIds.add(row.outputId);
      }
    }
  }

  return Array.from(outputIds);
}

export function buildSolveRequest(
  pkg: Pick<PackageData, 'sectorStates' | 'appConfig'>,
  configuration: ScenarioDocument,
  options: BuildSolveRequestOptions = {},
): SolveRequest {
  const allRows = normalizeSolverRows(pkg);
  const resolvedScenario = resolveScenarioForSolve(configuration, pkg.appConfig);
  const includedOutputIds = options.includedOutputIds ?? getIncludedOutputIds(configuration);

  if (!includedOutputIds || includedOutputIds.length === 0) {
    return {
      contractVersion: SOLVER_CONTRACT_VERSION,
      requestId: createRequestId(),
      rows: allRows,
      scenario: resolvedScenario,
    };
  }

  const seedOutputIds = new Set(includedOutputIds);
  const expandedOutputIds = expandIncludedOutputsForDependencies(
    allRows,
    resolvedScenario,
    pkg.appConfig,
    seedOutputIds,
  );
  const filtered = filterSolveRequestForOutputs(allRows, resolvedScenario, expandedOutputIds, seedOutputIds);

  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: createRequestId(),
    rows: filtered.rows,
    scenario: filtered.scenario,
  };
}
