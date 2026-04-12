import type { PackageData, ConfigurationDocument } from '../data/types.ts';
import {
  SOLVER_CONTRACT_VERSION,
  type NormalizedSolverRow,
  type ResolvedConfigurationForSolve,
  type ResolvedSolveControl,
  type SolveRequest,
} from './contract.ts';
import {
  deriveSeedOutputIds,
  expandIncludedOutputsForDependencies,
} from './solveScope.ts';
import {
  normalizeSolverRows,
  resolveConfigurationForSolve,
} from './solveRequestModel.ts';

export { normalizeSolverRows, resolveConfigurationForSolve } from './solveRequestModel.ts';

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `solve-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function filterSolveRequestForOutputs(
  rows: NormalizedSolverRow[],
  configuration: ResolvedConfigurationForSolve,
  effectiveOutputIds: Set<string>,
  activeRequiredServiceIds: Set<string>,
): { rows: NormalizedSolverRow[]; configuration: ResolvedConfigurationForSolve } {
  const filteredRows = rows.filter((row) => effectiveOutputIds.has(row.outputId));

  const filteredControlsByOutput: Record<string, Record<string, ResolvedSolveControl>> = {};
  for (const outputId of effectiveOutputIds) {
    if (configuration.controlsByOutput[outputId]) {
      filteredControlsByOutput[outputId] = configuration.controlsByOutput[outputId];
    }
  }

  const filteredServiceDemandByOutput: Record<string, Record<string, number>> = {};
  for (const outputId of effectiveOutputIds) {
    if (configuration.serviceDemandByOutput[outputId]) {
      filteredServiceDemandByOutput[outputId] = configuration.serviceDemandByOutput[outputId];
    }
  }

  const filteredExternalCommodityDemandByCommodity: Record<string, Record<string, number>> = {};
  for (const outputId of activeRequiredServiceIds) {
    if (configuration.externalCommodityDemandByCommodity[outputId]) {
      filteredExternalCommodityDemandByCommodity[outputId]
        = configuration.externalCommodityDemandByCommodity[outputId];
    }
  }

  return {
    rows: filteredRows,
    configuration: {
      ...configuration,
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
  configuration: ConfigurationDocument,
): SolveRequest {
  const allRows = normalizeSolverRows(pkg);
  const resolvedConfiguration = resolveConfigurationForSolve(configuration, pkg.appConfig);

  // Scope is derived from active pathways — required-service outputs with at
  // least one active pathway form the seed set.
  const derivedSeeds = deriveSeedOutputIds(allRows, resolvedConfiguration, pkg.appConfig);

  if (!derivedSeeds) {
    // Full-model run — every required-service output has active pathways.
    return {
      contractVersion: SOLVER_CONTRACT_VERSION,
      requestId: createRequestId(),
      rows: allRows,
      configuration: resolvedConfiguration,
    };
  }

  const seedOutputIdSet = new Set(derivedSeeds);
  const expandedOutputIds = expandIncludedOutputsForDependencies(
    allRows,
    resolvedConfiguration,
    pkg.appConfig,
    seedOutputIdSet,
  );
  const filtered = filterSolveRequestForOutputs(
    allRows,
    resolvedConfiguration,
    expandedOutputIds,
    seedOutputIdSet,
  );
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: createRequestId(),
    rows: filtered.rows,
    configuration: filtered.configuration,
  };
}
