import type { PackageData, ConfigurationDocument } from '../data/types.ts';
import {
  SOLVER_CONTRACT_VERSION,
  type NormalizedSolverRow,
  type ResolvedConfigurationForSolve,
  type ResolvedSolveControl,
  type SolveObjectiveCostMetadata,
  type SolveRequest,
} from './contract.ts';
import {
  deriveIncludedOutputIds,
} from './solveScope.ts';
import {
  normalizeSolverRows,
  resolveConfigurationForSolve,
} from './solveRequestModel.ts';

export { normalizeSolverRows, resolveConfigurationForSolve } from './solveRequestModel.ts';

function buildObjectiveCostLookup(
  sectorStates: PackageData['sectorStates'],
): Map<string, SolveObjectiveCostMetadata> {
  const lookup = new Map<string, SolveObjectiveCostMetadata>();

  for (const row of sectorStates) {
    lookup.set(`${row.state_id}::${row.year}`, {
      currency: row.currency,
      costBasisYear: row.cost_basis_year,
    });
  }

  return lookup;
}

function resolveObjectiveCostMetadata(
  rows: NormalizedSolverRow[],
  lookup: ReadonlyMap<string, SolveObjectiveCostMetadata>,
): SolveObjectiveCostMetadata {
  let metadata: SolveObjectiveCostMetadata | null = null;

  for (const row of rows) {
    const rowMetadata = lookup.get(row.rowId);

    if (!rowMetadata) {
      throw new Error(`Missing objective cost metadata for row ${JSON.stringify(row.rowId)}.`);
    }

    if (!metadata) {
      metadata = rowMetadata;
      continue;
    }

    if (
      metadata.currency !== rowMetadata.currency
      || metadata.costBasisYear !== rowMetadata.costBasisYear
    ) {
      throw new Error(
        `Inconsistent objective cost metadata across solve rows: ${metadata.currency}/${metadata.costBasisYear ?? 'unknown'} vs ${rowMetadata.currency}/${rowMetadata.costBasisYear ?? 'unknown'}.`,
      );
    }
  }

  if (!metadata) {
    throw new Error('Cannot resolve objective cost metadata for an empty solve request.');
  }

  return metadata;
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `solve-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function filterSolveRequestForOutputs(
  rows: NormalizedSolverRow[],
  configuration: ResolvedConfigurationForSolve,
  includedOutputIds: Set<string>,
): { rows: NormalizedSolverRow[]; configuration: ResolvedConfigurationForSolve } {
  const filteredRows = rows.filter((row) => includedOutputIds.has(row.outputId));

  const filteredControlsByOutput: Record<string, Record<string, ResolvedSolveControl>> = {};
  for (const outputId of includedOutputIds) {
    if (configuration.controlsByOutput[outputId]) {
      filteredControlsByOutput[outputId] = configuration.controlsByOutput[outputId];
    }
  }

  const filteredServiceDemandByOutput: Record<string, Record<string, number>> = {};
  for (const outputId of includedOutputIds) {
    if (configuration.serviceDemandByOutput[outputId]) {
      filteredServiceDemandByOutput[outputId] = configuration.serviceDemandByOutput[outputId];
    }
  }

  const filteredExternalCommodityDemandByCommodity: Record<string, Record<string, number>> = {};
  for (const outputId of includedOutputIds) {
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
  const objectiveCostLookup = buildObjectiveCostLookup(pkg.sectorStates);
  const resolvedConfiguration = resolveConfigurationForSolve(configuration, pkg.appConfig);

  const includedOutputIds = deriveIncludedOutputIds(allRows, resolvedConfiguration, pkg.appConfig);
  const filtered = filterSolveRequestForOutputs(
    allRows,
    resolvedConfiguration,
    includedOutputIds,
  );

  if (filtered.rows.length === 0) {
    throw new Error('No outputs are active in this solve configuration.');
  }

  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: createRequestId(),
    rows: filtered.rows,
    configuration: filtered.configuration,
    objectiveCost: resolveObjectiveCostMetadata(filtered.rows, objectiveCostLookup),
  };
}
