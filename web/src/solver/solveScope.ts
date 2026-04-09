import { getIncludedOutputIds } from '../data/configurationMetadata';
import { getEnabledStateIds } from '../data/scenarioWorkspaceModel';
import type {
  AppConfigRegistry,
  OutputRole,
  PackageData,
  ScenarioControlMode,
  ScenarioDocument,
} from '../data/types';
import type {
  NormalizedSolverRow,
  ResolvedScenarioForSolve,
  ResolvedSolveControl,
} from './contract.ts';
import { normalizeSolverRows, resolveScenarioForSolve, yearKey } from './solveRequestModel.ts';

export type OutputRunParticipation =
  | 'full_model'
  | 'seed_scope'
  | 'auto_included_dependency'
  | 'excluded_from_run';

export type OutputDemandParticipation =
  | 'active_in_run'
  | 'excluded_from_run'
  | 'not_applicable';

export interface DerivedOutputRunStatus {
  outputId: string;
  outputRole: OutputRole;
  controlMode: ScenarioControlMode;
  enabledStateIds: string[];
  enabledStateCount: number;
  isDisabled: boolean;
  inRun: boolean;
  runParticipation: OutputRunParticipation;
  demandParticipation: OutputDemandParticipation;
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

export function rowMayBeActive(
  row: NormalizedSolverRow,
  control: ResolvedSolveControl | undefined,
): boolean {
  if (!control) {
    return true;
  }

  if (control.mode === 'externalized') {
    return false;
  }

  if (control.disabledStateIds.includes(row.stateId)) {
    return false;
  }

  if (control.mode === 'pinned_single') {
    return row.stateId === control.stateId;
  }

  if (control.mode === 'fixed_shares') {
    const share = control.fixedShares?.[row.stateId] ?? 0;
    return share > 0;
  }

  return true;
}

export function expandIncludedOutputsForDependencies(
  rows: NormalizedSolverRow[],
  scenario: ResolvedScenarioForSolve,
  appConfig: AppConfigRegistry,
  seedOutputIds: Set<string>,
): Set<string> {
  const included = new Set(seedOutputIds);
  let changed = true;

  while (changed) {
    changed = false;

    for (const row of rows) {
      if (!included.has(row.outputId)) {
        continue;
      }

      for (const year of scenario.years) {
        if (row.year !== year) {
          continue;
        }

        const control = scenario.controlsByOutput[row.outputId]?.[yearKey(year)];
        if (!rowMayBeActive(row, control)) {
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
  resolvedScenario: ResolvedScenarioForSolve,
  appConfig: AppConfigRegistry,
  includedOutputIds: string[] | undefined,
): Record<string, DerivedOutputRunStatus> {
  const stateIdsByOutput = collectStateIdsByOutput(rows);
  const hasScopedRun = !!includedOutputIds?.length;
  const seedOutputIds = new Set(includedOutputIds ?? []);
  const expandedOutputIds = hasScopedRun
    ? expandIncludedOutputsForDependencies(rows, resolvedScenario, appConfig, seedOutputIds)
    : null;

  return Array.from(stateIdsByOutput.entries()).reduce<Record<string, DerivedOutputRunStatus>>(
    (statuses, [outputId, allStateIds]) => {
      const outputMetadata = appConfig.output_roles[outputId];
      const enabledStateIds = getEnabledStateIds(scenario, outputId, allStateIds);
      const enabledStateCount = enabledStateIds.length;
      const isFullModel = !hasScopedRun;
      const isSeedScoped = hasScopedRun && seedOutputIds.has(outputId);
      const isAutoIncludedDependency = hasScopedRun
        && !isSeedScoped
        && !!expandedOutputIds?.has(outputId);
      const inRun = isFullModel || isSeedScoped || isAutoIncludedDependency;
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
        enabledStateIds,
        enabledStateCount,
        isDisabled: enabledStateCount === 0,
        inRun,
        runParticipation,
        demandParticipation: outputMetadata.demand_required
          ? (inRun ? 'active_in_run' : 'excluded_from_run')
          : 'not_applicable',
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
  const resolvedScenario = resolveScenarioForSolve(scenario, pkg.appConfig);
  return deriveOutputRunStatuses(
    rows,
    scenario,
    resolvedScenario,
    pkg.appConfig,
    getIncludedOutputIds(scenario),
  );
}
