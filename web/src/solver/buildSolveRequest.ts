import type {
  ConfigurationDocument,
  PackageData,
  ResolvedActiveRoleStructure,
  RoleMetadata,
  ResolvedMethodYearRow,
} from '../data/types.ts';
import {
  filterResolvedMethodYearRowsByActiveRoleStructure,
  hasRoleTopologyInputs,
  resolveActiveRoleStructure,
} from '../data/roleTopologyResolver.ts';
import { normalizeConfigurationRoleControls } from '../data/configurationRoleControls.ts';
import {
  SOLVER_CONTRACT_VERSION,
  type NormalizedSolverRow,
  type ResolvedConfigurationForSolve,
  type ResolvedSolveControl,
  type SolveObjectiveCostMetadata,
  type SolveRoleTopology,
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

type SolvePackageData = Pick<PackageData, 'resolvedMethodYears' | 'appConfig'>
  & Partial<Pick<
    PackageData,
    | 'autonomousEfficiencyTracks'
    | 'efficiencyPackages'
    | 'roleMetadata'
    | 'representations'
    | 'roleDecompositionEdges'
    | 'methods'
  >>;

function collectOutputIdByRoleId(resolvedMethodYears: ResolvedMethodYearRow[]): Map<string, string> {
  const outputIdByRoleId = new Map<string, string>();

  for (const row of resolvedMethodYears) {
    if (!outputIdByRoleId.has(row.role_id)) {
      outputIdByRoleId.set(row.role_id, row.output_id);
    }
  }

  return outputIdByRoleId;
}

function stripLeadingRoleVerb(roleId: string): string | null {
  const match = /^(produce|make|supply|deliver|remove|account)_(.+)$/.exec(roleId);
  return match?.[2] ?? null;
}

function inferIntermediateCommodityId(
  role: RoleMetadata,
  outputIdByRoleId: Map<string, string>,
  activeRows: ResolvedMethodYearRow[],
): string | null {
  if (role.balance_type !== 'intermediate_material') {
    return null;
  }

  const activeInputCommodityIds = new Set(activeRows.flatMap((row) => row.input_commodities));
  const candidates = [
    outputIdByRoleId.get(role.role_id),
    stripLeadingRoleVerb(role.role_id),
    role.role_id,
  ].filter((candidate): candidate is string => !!candidate);

  return candidates.find((candidate) => activeInputCommodityIds.has(candidate))
    ?? candidates.find((candidate) => candidate !== role.role_id)
    ?? null;
}

function buildRoleTopologyForSolve(
  pkg: SolvePackageData & Required<Pick<
    PackageData,
    'roleMetadata'
  >>,
  activeStructure: ResolvedActiveRoleStructure,
  activeResolvedMethodYearRows: ResolvedMethodYearRow[],
): SolveRoleTopology {
  const outputIdByRoleId = collectOutputIdByRoleId(pkg.resolvedMethodYears);
  const rolesById = pkg.roleMetadata.reduce<SolveRoleTopology['rolesById']>((resolved, role) => {
    resolved[role.role_id] = {
      roleId: role.role_id,
      outputId: outputIdByRoleId.get(role.role_id) ?? role.role_id,
      roleLabel: role.role_label,
      balanceType: role.balance_type,
      outputUnit: role.output_unit,
      parentRoleId: role.parent_role_id,
    };
    return resolved;
  }, {});
  const roleById = new Map(pkg.roleMetadata.map((role) => [role.role_id, role]));
  const intermediateCommodityByRole: Record<string, string> = {};

  for (const roleId of activeStructure.activeRoleIds) {
    const role = roleById.get(roleId);
    if (!role) {
      continue;
    }

    const commodityId = inferIntermediateCommodityId(role, outputIdByRoleId, activeResolvedMethodYearRows);
    if (commodityId) {
      intermediateCommodityByRole[roleId] = commodityId;
    }
  }

  return {
    activeRoleIds: activeStructure.activeRoleIds,
    activeRepresentationByRole: activeStructure.activeRepresentationByRole,
    rolesById,
    decompositions: activeStructure.roles
      .filter((role) => role.representationKind === 'role_decomposition')
      .map((role) => ({
        parentRoleId: role.roleId,
        parentOutputId: rolesById[role.roleId]?.outputId ?? role.roleId,
        childRoleIds: role.activeChildRoleIds,
      })),
    intermediateCommodityByRole,
  };
}

function resolveObjectiveCostMetadata(
  rows: NormalizedSolverRow[],
): SolveObjectiveCostMetadata {
  let metadata: SolveObjectiveCostMetadata | null = null;

  for (const row of rows) {
    if (!row.currency) {
      throw new Error(`Missing objective cost currency for row ${JSON.stringify(row.rowId)}.`);
    }

    const rowMetadata = {
      currency: row.currency,
      costBasisYear: row.costBasisYear ?? null,
    } satisfies SolveObjectiveCostMetadata;

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

function expandActiveMethodIdsForDerivedRows(
  rows: NormalizedSolverRow[],
  configuration: ResolvedConfigurationForSolve,
): ResolvedConfigurationForSolve {
  const derivedMethodIdsByOutputYearBase = new Map<string, Map<string, Set<string>>>();

  for (const row of rows) {
    if (row.provenance?.kind !== 'efficiency_package') {
      continue;
    }

    const outputYearKey = `${row.outputId}::${row.year}`;
    const byBaseMethodId = derivedMethodIdsByOutputYearBase.get(outputYearKey) ?? new Map<string, Set<string>>();
    const methodIds = byBaseMethodId.get(row.provenance.baseMethodId) ?? new Set<string>();
    methodIds.add(row.methodId);
    byBaseMethodId.set(row.provenance.baseMethodId, methodIds);
    derivedMethodIdsByOutputYearBase.set(outputYearKey, byBaseMethodId);
  }

  const controlsByOutput = Object.entries(configuration.controlsByOutput).reduce<
    Record<string, Record<string, ResolvedSolveControl>>
  >((resolved, [outputId, controlsByYear]) => {
    resolved[outputId] = Object.entries(controlsByYear).reduce<Record<string, ResolvedSolveControl>>(
      (controls, [year, control]) => {
        if (!control.activeMethodIds || Number(year) === 2025) {
          controls[year] = control;
          return controls;
        }

        const byBaseMethodId = derivedMethodIdsByOutputYearBase.get(`${outputId}::${Number(year)}`);
        if (!byBaseMethodId) {
          controls[year] = control;
          return controls;
        }

        const expandedActiveMethodIds = new Set(control.activeMethodIds);
        for (const activeMethodId of control.activeMethodIds) {
          for (const derivedMethodId of byBaseMethodId.get(activeMethodId) ?? []) {
            expandedActiveMethodIds.add(derivedMethodId);
          }
        }

        controls[year] = {
          ...control,
          activeMethodIds: Array.from(expandedActiveMethodIds),
        };
        return controls;
      },
      {},
    );
    return resolved;
  }, {});

  return {
    ...configuration,
    controlsByOutput,
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
      if (row.reportingSectorId && sectors.has(row.reportingSectorId)) {
        outputIds.add(row.outputId);
      }
    }
  }

  if (selection.subsectors) {
    const subsectors = new Set(selection.subsectors);
    for (const row of rows) {
      if (row.reportingSubsectorId && subsectors.has(row.reportingSubsectorId)) {
        outputIds.add(row.outputId);
      }
    }
  }

  return Array.from(outputIds);
}

export function buildSolveRequest(
  pkg: SolvePackageData,
  configuration: ConfigurationDocument,
): SolveRequest {
  const roleNativeConfiguration = normalizeConfigurationRoleControls(configuration, {
    resolvedMethodYears: pkg.resolvedMethodYears,
  });
  const activeRoleStructure = hasRoleTopologyInputs(pkg)
    ? resolveActiveRoleStructure(pkg, roleNativeConfiguration)
    : null;
  const resolvedMethodYears = activeRoleStructure
    ? filterResolvedMethodYearRowsByActiveRoleStructure(pkg.resolvedMethodYears, activeRoleStructure)
    : pkg.resolvedMethodYears;
  const resolvedConfiguration = resolveConfigurationForSolve(
    roleNativeConfiguration,
    pkg.appConfig,
    resolvedMethodYears,
    {
      autonomousEfficiencyTracks: pkg.autonomousEfficiencyTracks,
      efficiencyPackages: pkg.efficiencyPackages,
    },
  );
  const allRows = normalizeSolverRows({ ...pkg, resolvedMethodYears }, resolvedConfiguration.efficiency);
  const expandedConfiguration = expandActiveMethodIdsForDerivedRows(allRows, resolvedConfiguration);
  const roleTopology = activeRoleStructure && hasRoleTopologyInputs(pkg)
    ? buildRoleTopologyForSolve(pkg, activeRoleStructure, resolvedMethodYears)
    : undefined;

  const includedOutputIds = deriveIncludedOutputIds(allRows, expandedConfiguration, pkg.appConfig);
  for (const decomposition of roleTopology?.decompositions ?? []) {
    includedOutputIds.add(decomposition.parentOutputId);
  }
  const filtered = filterSolveRequestForOutputs(
    allRows,
    expandedConfiguration,
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
    objectiveCost: resolveObjectiveCostMetadata(filtered.rows),
    roleTopology,
  };
}
