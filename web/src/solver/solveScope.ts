import { getSeedOutputIds } from '../data/configurationMetadata.ts';
import { derivePathwayStateIds } from '../data/pathwaySemantics.ts';
import type {
  AppConfigRegistry,
  OutputRole,
  PackageData,
  ScenarioControlMode,
  ScenarioDocument,
} from '../data/types.ts';
import type {
  NormalizedSolverRow,
  ResolvedConfigurationForSolve,
  ResolvedSolveControl,
} from './contract.ts';
import { normalizeSolverRows, resolveConfigurationForSolve, yearKey } from './solveRequestModel.ts';

export type OutputRunParticipation =
  | 'full_model'
  | 'seed_scope'
  | 'auto_included_dependency'
  | 'excluded_from_run';

export type OutputDemandParticipation =
  | 'active_in_run'
  | 'no_enabled_pathways'
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
  controlMode: ScenarioControlMode;
  availableStateIds: string[];
  availableStateCount: number;
  activeStateIds: string[];
  activeStateCount: number;
  capEligibleStateIds: string[];
  capEligibleStateCount: number;
  isDisabled: boolean;
  inRun: boolean;
  runParticipation: OutputRunParticipation;
  demandParticipation: OutputDemandParticipation;
  supplyParticipation: OutputSupplyParticipation;
  hasPositiveDemandInRun: boolean;
  hasDemandValidationError: boolean;
  isSeedScoped: boolean;
  isAutoIncludedDependency: boolean;
  isExcludedFromRun: boolean;
  isFullModel: boolean;
}

function collectStateIdsByOutput(rows: NormalizedSolverRow[]): Map<string, string[]> {
  const byOutput = new Map<string, Set<string>>();

  for (const row of rows) {
    let stateIds = byOutput.get(row.outputId);
    if (!stateIds) {
      stateIds = new Set<string>();
      byOutput.set(row.outputId, stateIds);
    }
    stateIds.add(row.stateId);
  }

  return new Map(
    Array.from(byOutput.entries()).map(([outputId, stateIds]) => [outputId, Array.from(stateIds)]),
  );
}

function getControlMode(
  scenario: ScenarioDocument,
  appConfig: AppConfigRegistry,
  outputId: string,
): ScenarioControlMode {
  return (
    scenario.service_controls[outputId]?.mode
    ?? appConfig.output_roles[outputId]?.default_control_mode
    ?? 'optimize'
  );
}

function filterOrderedStateIds(allStateIds: string[], includedStateIds: ReadonlySet<string>): string[] {
  return allStateIds.filter((stateId) => includedStateIds.has(stateId));
}

function collectStateIdsByOutputYear(rows: NormalizedSolverRow[]): Map<string, Map<number, string[]>> {
  const byOutputYear = new Map<string, Map<number, Set<string>>>();

  for (const row of rows) {
    let byYear = byOutputYear.get(row.outputId);
    if (!byYear) {
      byYear = new Map<number, Set<string>>();
      byOutputYear.set(row.outputId, byYear);
    }

    let stateIds = byYear.get(row.year);
    if (!stateIds) {
      stateIds = new Set<string>();
      byYear.set(row.year, stateIds);
    }

    stateIds.add(row.stateId);
  }

  return new Map(
    Array.from(byOutputYear.entries()).map(([outputId, byYear]) => [
      outputId,
      new Map(
        Array.from(byYear.entries()).map(([year, stateIds]) => [year, Array.from(stateIds)]),
      ),
    ]),
  );
}

function isRowActiveInSolveControl(
  row: NormalizedSolverRow,
  control: ResolvedSolveControl | undefined,
  stateIdsForOutputYear: string[],
): boolean {
  return derivePathwayStateIds(stateIdsForOutputYear, control).activeStateIds.includes(row.stateId);
}

function deriveOutputPathwayStateIds(
  outputId: string,
  allStateIds: string[],
  resolvedConfiguration: ResolvedConfigurationForSolve,
): Pick<
  DerivedOutputRunStatus,
  | 'availableStateIds'
  | 'availableStateCount'
  | 'activeStateIds'
  | 'activeStateCount'
  | 'capEligibleStateIds'
  | 'capEligibleStateCount'
> {
  const baselineControl = resolvedConfiguration.years.length > 0
    ? resolvedConfiguration.controlsByOutput[outputId]?.[yearKey(resolvedConfiguration.years[0])]
    : undefined;
  const availableStateIds = derivePathwayStateIds(allStateIds, baselineControl).availableStateIds;
  const activeStateIdSet = new Set<string>();
  const capEligibleStateIdSet = new Set<string>();

  for (const year of resolvedConfiguration.years) {
    const control = resolvedConfiguration.controlsByOutput[outputId]?.[yearKey(year)];
    const pathwayStateIds = derivePathwayStateIds(allStateIds, control);
    for (const stateId of pathwayStateIds.activeStateIds) {
      activeStateIdSet.add(stateId);
    }
    for (const stateId of pathwayStateIds.capEligibleStateIds) {
      capEligibleStateIdSet.add(stateId);
    }
  }

  const activeStateIds = filterOrderedStateIds(allStateIds, activeStateIdSet);
  const capEligibleStateIds = filterOrderedStateIds(allStateIds, capEligibleStateIdSet);

  return {
    availableStateIds,
    availableStateCount: availableStateIds.length,
    activeStateIds,
    activeStateCount: activeStateIds.length,
    capEligibleStateIds,
    capEligibleStateCount: capEligibleStateIds.length,
  };
}

export function expandIncludedOutputsForDependencies(
  rows: NormalizedSolverRow[],
  configuration: ResolvedConfigurationForSolve,
  appConfig: AppConfigRegistry,
  seedOutputIds: Set<string>,
): Set<string> {
  const included = new Set(seedOutputIds);
  const stateIdsByOutputYear = collectStateIdsByOutputYear(rows);
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
        const stateIdsForOutputYear = stateIdsByOutputYear.get(row.outputId)?.get(year) ?? [];
        if (!isRowActiveInSolveControl(row, control, stateIdsForOutputYear)) {
          continue;
        }

        for (const input of row.inputs) {
          const inputMetadata = appConfig.output_roles[input.commodityId];
          if (!inputMetadata || inputMetadata.output_role !== 'endogenous_supply_commodity') {
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

export function deriveOutputRunStatuses(
  rows: NormalizedSolverRow[],
  scenario: ScenarioDocument,
  resolvedConfiguration: ResolvedConfigurationForSolve,
  appConfig: AppConfigRegistry,
  seedOutputIdsFromMetadata: string[] | undefined,
): Record<string, DerivedOutputRunStatus> {
  const stateIdsByOutput = collectStateIdsByOutput(rows);
  const hasScopedRun = !!seedOutputIdsFromMetadata?.length;
  const seedOutputIds = new Set(seedOutputIdsFromMetadata ?? []);
  // Seed scope comes directly from configuration metadata. The effective run
  // may be larger after endogenous supply dependencies are auto-included.
  const expandedOutputIds = hasScopedRun
    ? expandIncludedOutputsForDependencies(rows, resolvedConfiguration, appConfig, seedOutputIds)
    : null;

  return Array.from(stateIdsByOutput.entries()).reduce<Record<string, DerivedOutputRunStatus>>(
    (statuses, [outputId, allStateIds]) => {
      const outputMetadata = appConfig.output_roles[outputId];
      const pathwayStateIds = deriveOutputPathwayStateIds(
        outputId,
        allStateIds,
        resolvedConfiguration,
      );
      const isFullModel = !hasScopedRun;
      const isSeedScoped = hasScopedRun && seedOutputIds.has(outputId);
      const isAutoIncludedDependency = hasScopedRun
        && !isSeedScoped
        && !!expandedOutputIds?.has(outputId);
      const inRun = isFullModel || isSeedScoped || isAutoIncludedDependency;
      const hasPositiveDemandInRun = outputMetadata.demand_required
        && inRun
        && Object.values(resolvedConfiguration.serviceDemandByOutput[outputId] ?? {})
          .some((value) => value > 0);
      const hasDemandValidationError = outputMetadata.demand_required
        && hasPositiveDemandInRun
        && pathwayStateIds.availableStateCount === 0;
      const runParticipation: OutputRunParticipation = isFullModel
        ? 'full_model'
        : isSeedScoped
          ? 'seed_scope'
          : isAutoIncludedDependency
            ? 'auto_included_dependency'
            : 'excluded_from_run';

      statuses[outputId] = {
        outputId,
        outputRole: outputMetadata.output_role,
        controlMode: getControlMode(scenario, appConfig, outputId),
        ...pathwayStateIds,
        isDisabled: pathwayStateIds.availableStateCount === 0,
        inRun,
        runParticipation,
        demandParticipation: outputMetadata.demand_required
          ? (inRun
              ? (pathwayStateIds.availableStateCount === 0 ? 'no_enabled_pathways' : 'active_in_run')
              : 'excluded_from_run')
          : 'not_applicable',
        supplyParticipation: outputMetadata.output_role === 'endogenous_supply_commodity'
          ? (inRun
              ? (getControlMode(scenario, appConfig, outputId) === 'externalized'
                  ? 'externalized_in_run'
                  : 'endogenous_in_run')
              : 'excluded_from_run')
          : 'not_applicable',
        hasPositiveDemandInRun,
        hasDemandValidationError,
        isSeedScoped,
        isAutoIncludedDependency,
        isExcludedFromRun: !inRun,
        isFullModel,
      };
      return statuses;
    },
    {},
  );
}

export function deriveOutputRunStatusesForConfiguration(
  pkg: Pick<PackageData, 'sectorStates' | 'appConfig'>,
  scenario: ScenarioDocument,
): Record<string, DerivedOutputRunStatus> {
  const rows = normalizeSolverRows(pkg);
  const resolvedConfiguration = resolveConfigurationForSolve(scenario, pkg.appConfig);
  return deriveOutputRunStatuses(
    rows,
    scenario,
    resolvedConfiguration,
    pkg.appConfig,
    getSeedOutputIds(scenario),
  );
}
