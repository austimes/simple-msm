import type { ResolvedSolveControl } from '../solver/contract.ts';
import type {
  ConfigurationControlMode,
  ConfigurationDocument,
  ConfigurationServiceControl,
} from './types.ts';

export interface PathwayControlInput {
  mode?: ConfigurationControlMode | null;
  fixedShares?: Record<string, number> | null;
  activeStateIds?: readonly string[] | null;
}

export interface DerivedPathwayStateIds {
  allStateIds: string[];
  activeStateIds: string[];
}

type SupportedPathwayControl =
  | ConfigurationServiceControl
  | PathwayControlInput
  | ResolvedSolveControl
  | null
  | undefined;

function dedupeStateIds(stateIds: readonly string[]): string[] {
  return Array.from(new Set(stateIds));
}

export function toPathwayControlInput(
  control: SupportedPathwayControl,
): PathwayControlInput | undefined {
  if (!control) {
    return undefined;
  }

  // ResolvedSolveControl or PathwayControlInput (camelCase with activeStateIds)
  if ('activeStateIds' in control || 'fixedShares' in control) {
    return {
      mode: control.mode ?? null,
      fixedShares: control.fixedShares ?? null,
      activeStateIds: (control as PathwayControlInput).activeStateIds ?? null,
    };
  }

  // ConfigurationServiceControl (snake_case)
  if ('active_state_ids' in control || 'fixed_shares' in control) {
    const svc = control as ConfigurationServiceControl;
    return {
      mode: svc.mode,
      fixedShares: svc.fixed_shares ?? null,
      activeStateIds: svc.active_state_ids ?? null,
    };
  }

  return undefined;
}

function deriveActiveStateIds(
  allStateIds: string[],
  control: PathwayControlInput | undefined,
): string[] {
  if (!control?.mode) {
    if (control?.activeStateIds) {
      const allowed = new Set(control.activeStateIds);
      return allStateIds.filter((id) => allowed.has(id));
    }
    return allStateIds;
  }

  switch (control.mode) {
    case 'externalized':
      return [];
    case 'fixed_shares':
      return allStateIds.filter((stateId) => (control.fixedShares?.[stateId] ?? 0) > 0);
    default:
      if (control.activeStateIds) {
        const allowed = new Set(control.activeStateIds);
        return allStateIds.filter((id) => allowed.has(id));
      }
      return allStateIds;
  }
}

export function derivePathwayStateIds(
  allStateIds: readonly string[],
  control: SupportedPathwayControl,
): DerivedPathwayStateIds {
  const uniqueStateIds = dedupeStateIds(allStateIds);
  const normalizedControl = toPathwayControlInput(control);
  const activeStateIds = deriveActiveStateIds(uniqueStateIds, normalizedControl);

  return {
    allStateIds: uniqueStateIds,
    activeStateIds,
  };
}

export function derivePathwayStateIdsForOutput(
  configuration: ConfigurationDocument,
  outputId: string,
  allStateIds: readonly string[],
): DerivedPathwayStateIds {
  return derivePathwayStateIds(allStateIds, configuration.service_controls[outputId]);
}
