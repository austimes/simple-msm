import { derivePathwayMethodIds } from '../data/pathwaySemantics.ts';
import { normalizeConfigurationRoleControls } from '../data/configurationRoleControls.ts';
import { resolveActiveResolvedMethodYearRowsForConfiguration } from '../data/roleTopologyResolver.ts';
import type {
  AppConfigRegistry,
  OutputRole,
  PackageData,
  ConfigurationControlMode,
  ConfigurationDocument,
} from '../data/types.ts';
import type {
  NormalizedSolverRow,
  ResolvedConfigurationForSolve,
  ResolvedSolveControl,
} from './contract.ts';
import { normalizeSolverRows, resolveConfigurationForSolve, yearKey } from './solveRequestModel.ts';

export type OutputRunParticipation =
  | 'active_pathways'
  | 'auto_included_dependency'
  | 'excluded_from_run';

export type OutputDemandParticipation =
  | 'active_in_run'
  | 'excluded_from_run'
  | 'not_applicable';

export type OutputSupplyParticipation =
  | 'endogenous_in_run'
  | 'externalized_in_run'
  | 'excluded_from_run'
  | 'not_applicable';

export interface DerivedOutputRunStatus {
  outputId: string;
  outputRole: OutputRole;
  controlMode: ConfigurationControlMode;
  activeMethodIds: string[];
  activeStateCount: number;
  isDisabled: boolean;
  inRun: boolean;
  runParticipation: OutputRunParticipation;
  demandParticipation: OutputDemandParticipation;
  supplyParticipation: OutputSupplyParticipation;
  hasPositiveDemandInRun: boolean;
  isDirectlyActive: boolean;
  isAutoIncludedDependency: boolean;
  isExcludedFromRun: boolean;
}

function collectMethodIdsByOutput(rows: NormalizedSolverRow[]): Map<string, string[]> {
  const byOutput = new Map<string, Set<string>>();

  for (const row of rows) {
    let methodIds = byOutput.get(row.outputId);
    if (!methodIds) {
      methodIds = new Set<string>();
      byOutput.set(row.outputId, methodIds);
    }
    methodIds.add(row.methodId);
  }

  return new Map(
    Array.from(byOutput.entries()).map(([outputId, methodIds]) => [outputId, Array.from(methodIds)]),
  );
}

function getControlMode(
  configuration: ConfigurationDocument,
  appConfig: AppConfigRegistry,
  outputId: string,
  roleId: string,
): ConfigurationControlMode {
  return (
    configuration.role_controls?.[roleId]?.mode
    ?? appConfig.output_roles[outputId]?.default_control_mode
    ?? 'optimize'
  );
}

function filterOrderedMethodIds(allMethodIds: string[], includedMethodIds: ReadonlySet<string>): string[] {
  return allMethodIds.filter((methodId) => includedMethodIds.has(methodId));
}

function collectMethodIdsByOutputYear(rows: NormalizedSolverRow[]): Map<string, Map<number, string[]>> {
  const byOutputYear = new Map<string, Map<number, Set<string>>>();

  for (const row of rows) {
    let byYear = byOutputYear.get(row.outputId);
    if (!byYear) {
      byYear = new Map<number, Set<string>>();
      byOutputYear.set(row.outputId, byYear);
    }

    let methodIds = byYear.get(row.year);
    if (!methodIds) {
      methodIds = new Set<string>();
      byYear.set(row.year, methodIds);
    }

    methodIds.add(row.methodId);
  }

  return new Map(
    Array.from(byOutputYear.entries()).map(([outputId, byYear]) => [
      outputId,
      new Map(
        Array.from(byYear.entries()).map(([year, methodIds]) => [year, Array.from(methodIds)]),
      ),
    ]),
  );
}

function isRowActiveInSolveControl(
  row: NormalizedSolverRow,
  control: ResolvedSolveControl | undefined,
  methodIdsForOutputYear: string[],
): boolean {
  return derivePathwayMethodIds(methodIdsForOutputYear, control).activeMethodIds.includes(row.methodId);
}

function deriveOutputPathwayMethodIds(
  outputId: string,
  allMethodIds: string[],
  resolvedConfiguration: ResolvedConfigurationForSolve,
): Pick<DerivedOutputRunStatus, 'activeMethodIds' | 'activeStateCount'> {
  const activeMethodIdSet = new Set<string>();

  for (const year of resolvedConfiguration.years) {
    const control = resolvedConfiguration.controlsByOutput[outputId]?.[yearKey(year)];
    const pathwayMethodIds = derivePathwayMethodIds(allMethodIds, control);
    for (const methodId of pathwayMethodIds.activeMethodIds) {
      activeMethodIdSet.add(methodId);
    }
  }

  const activeMethodIds = filterOrderedMethodIds(allMethodIds, activeMethodIdSet);

  return {
    activeMethodIds,
    activeStateCount: activeMethodIds.length,
  };
}

export function expandIncludedOutputsForDependencies(
  rows: NormalizedSolverRow[],
  configuration: ResolvedConfigurationForSolve,
  appConfig: AppConfigRegistry,
  seedOutputIds: Set<string>,
): Set<string> {
  const included = new Set(seedOutputIds);
  const methodIdsByOutputYear = collectMethodIdsByOutputYear(rows);
  let changed = true;

  while (changed) {
    changed = false;

    for (const row of rows) {
      if (!included.has(row.outputId)) {
        continue;
      }

      for (const year of configuration.years) {
        if (row.year !== year) {
          continue;
        }

        const control = configuration.controlsByOutput[row.outputId]?.[yearKey(year)];
        const methodIdsForOutputYear = methodIdsByOutputYear.get(row.outputId)?.get(year) ?? [];
        if (!isRowActiveInSolveControl(row, control, methodIdsForOutputYear)) {
          continue;
        }

        for (const input of row.inputs) {
          const inputMetadata = appConfig.output_roles[input.commodityId];
          if (!inputMetadata || !inputMetadata.participates_in_commodity_balance) {
            continue;
          }

          if (input.coefficient !== 0 && !included.has(input.commodityId)) {
            included.add(input.commodityId);
            changed = true;
          }
        }
      }
    }
  }

  return included;
}

export function deriveDirectlyIncludedOutputIds(
  rows: NormalizedSolverRow[],
  resolvedConfiguration: ResolvedConfigurationForSolve,
): Set<string> {
  const methodIdsByOutput = collectMethodIdsByOutput(rows);
  const included = new Set<string>();
  for (const [outputId, allMethodIds] of methodIdsByOutput) {
    const { activeStateCount } = deriveOutputPathwayMethodIds(outputId, allMethodIds, resolvedConfiguration);
    if (activeStateCount > 0) {
      included.add(outputId);
    }
  }
  return included;
}

export function deriveIncludedOutputIds(
  rows: NormalizedSolverRow[],
  resolvedConfiguration: ResolvedConfigurationForSolve,
  appConfig: AppConfigRegistry,
): Set<string> {
  const directlyIncluded = deriveDirectlyIncludedOutputIds(rows, resolvedConfiguration);
  return expandIncludedOutputsForDependencies(rows, resolvedConfiguration, appConfig, directlyIncluded);
}

export function deriveOutputRunStatuses(
  rows: NormalizedSolverRow[],
  configuration: ConfigurationDocument,
  resolvedConfiguration: ResolvedConfigurationForSolve,
  appConfig: AppConfigRegistry,
): Record<string, DerivedOutputRunStatus> {
  const methodIdsByOutput = collectMethodIdsByOutput(rows);
  const includedOutputIds = deriveIncludedOutputIds(rows, resolvedConfiguration, appConfig);
  const roleIdByOutput = new Map(rows.map((row) => [row.outputId, row.roleId ?? row.outputId] as const));

  return Array.from(methodIdsByOutput.entries()).reduce<Record<string, DerivedOutputRunStatus>>(
    (statuses, [outputId, allMethodIds]) => {
      const outputMetadata = appConfig.output_roles[outputId];
      const pathwayMethodIds = deriveOutputPathwayMethodIds(
        outputId,
        allMethodIds,
        resolvedConfiguration,
      );
      const directlyActive = pathwayMethodIds.activeStateCount > 0;
      const isAutoIncludedDependency = !directlyActive && includedOutputIds.has(outputId);
      const inRun = directlyActive || isAutoIncludedDependency;
      const hasDemand = !!resolvedConfiguration.serviceDemandByOutput[outputId];
      const hasPositiveDemandInRun = hasDemand
        && inRun
        && Object.values(resolvedConfiguration.serviceDemandByOutput[outputId] ?? {})
          .some((value) => value > 0);
      const runParticipation: OutputRunParticipation = directlyActive
        ? 'active_pathways'
        : isAutoIncludedDependency
          ? 'auto_included_dependency'
          : 'excluded_from_run';

      statuses[outputId] = {
        outputId,
        outputRole: outputMetadata.output_role,
        controlMode: getControlMode(configuration, appConfig, outputId, roleIdByOutput.get(outputId) ?? outputId),
        ...pathwayMethodIds,
        isDisabled: pathwayMethodIds.activeStateCount === 0,
        inRun,
        runParticipation,
        demandParticipation: hasDemand
          ? (inRun ? 'active_in_run' : 'excluded_from_run')
          : 'not_applicable',
        supplyParticipation: outputMetadata.output_role === 'endogenous_supply_commodity'
          ? (inRun
              ? (getControlMode(configuration, appConfig, outputId, roleIdByOutput.get(outputId) ?? outputId) === 'externalized'
                  ? 'externalized_in_run'
                  : 'endogenous_in_run')
              : 'excluded_from_run')
          : 'not_applicable',
        hasPositiveDemandInRun,
        isDirectlyActive: directlyActive,
        isAutoIncludedDependency,
        isExcludedFromRun: !inRun,
      };
      return statuses;
    },
    {},
  );
}

export function deriveOutputRunStatusesForConfiguration(
  pkg: Pick<
    PackageData,
    | 'resolvedMethodYears'
    | 'appConfig'
    | 'autonomousEfficiencyTracks'
    | 'efficiencyPackages'
  > & Partial<Pick<
    PackageData,
    | 'roleMetadata'
    | 'representations'
    | 'roleDecompositionEdges'
    | 'methods'
  >>,
  configuration: ConfigurationDocument,
): Record<string, DerivedOutputRunStatus> {
  const roleNativeConfiguration = normalizeConfigurationRoleControls(configuration, {
    resolvedMethodYears: pkg.resolvedMethodYears,
  });
  const resolvedMethodYears = resolveActiveResolvedMethodYearRowsForConfiguration(pkg, roleNativeConfiguration);
  const rows = normalizeSolverRows({ ...pkg, resolvedMethodYears });
  const resolvedConfiguration = resolveConfigurationForSolve(
    roleNativeConfiguration,
    pkg.appConfig,
    resolvedMethodYears,
    {
      autonomousEfficiencyTracks: pkg.autonomousEfficiencyTracks,
      efficiencyPackages: pkg.efficiencyPackages,
    },
  );
  return deriveOutputRunStatuses(
    rows,
    roleNativeConfiguration,
    resolvedConfiguration,
    pkg.appConfig,
  );
}
