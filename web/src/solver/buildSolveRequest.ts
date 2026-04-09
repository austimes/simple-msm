import { getSeedOutputIds } from '../data/configurationMetadata.ts';
import type { PackageData, ScenarioDocument } from '../data/types.ts';
import {
  SOLVER_CONTRACT_VERSION,
  type NormalizedSolverRow,
  type ResolvedConfigurationForSolve,
  type ResolvedSolveControl,
  type SolveRequest,
} from './contract.ts';
import {
  deriveOutputRunStatuses,
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

export interface BuildSolveRequestOptions {
  seedOutputIds?: string[];
  /**
   * Backward-compatible alias for `seedOutputIds`.
   */
  includedOutputIds?: string[];
}

function buildDemandValidationMessage(
  configuration: ResolvedConfigurationForSolve,
  invalidStatuses: ReturnType<typeof deriveOutputRunStatuses>,
): string {
  const details = Object.values(invalidStatuses).map((status) => {
    const activeYears = configuration.years.filter(
      (year) => (configuration.serviceDemandByOutput[status.outputId]?.[String(year)] ?? 0) > 0,
    );
    const yearsLabel = activeYears.length > 0 ? ` (${activeYears.join(', ')})` : '';
    return `${status.outputId}${yearsLabel}`;
  });

  return `Cannot solve because required-service outputs have positive in-run demand but no available pathways: ${details.join(', ')}.`;
}

function validateRequiredServiceCoverage(
  rows: NormalizedSolverRow[],
  configuration: ScenarioDocument,
  resolvedConfiguration: ResolvedConfigurationForSolve,
  appConfig: PackageData['appConfig'],
  seedOutputIds: string[] | undefined,
): void {
  const invalidStatuses = Object.fromEntries(
    Object.entries(
      deriveOutputRunStatuses(rows, configuration, resolvedConfiguration, appConfig, seedOutputIds),
    ).filter(([, status]) => status.hasDemandValidationError),
  );

  if (Object.keys(invalidStatuses).length === 0) {
    return;
  }

  throw new Error(buildDemandValidationMessage(resolvedConfiguration, invalidStatuses));
}

function filterSolveRequestForOutputs(
  rows: NormalizedSolverRow[],
  configuration: ResolvedConfigurationForSolve,
  effectiveOutputIds: Set<string>,
  seedOutputIds: Set<string>,
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
  for (const outputId of seedOutputIds) {
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
  configuration: ScenarioDocument,
  options: BuildSolveRequestOptions = {},
): SolveRequest {
  const allRows = normalizeSolverRows(pkg);
  const resolvedConfiguration = resolveConfigurationForSolve(configuration, pkg.appConfig);
  const seedOutputIds = options.seedOutputIds
    ?? options.includedOutputIds
    ?? getSeedOutputIds(configuration);
  validateRequiredServiceCoverage(
    allRows,
    configuration,
    resolvedConfiguration,
    pkg.appConfig,
    seedOutputIds,
  );

  if (!seedOutputIds || seedOutputIds.length === 0) {
    return {
      contractVersion: SOLVER_CONTRACT_VERSION,
      requestId: createRequestId(),
      rows: allRows,
      configuration: resolvedConfiguration,
    };
  }

  const seedOutputIdSet = new Set(seedOutputIds);
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
