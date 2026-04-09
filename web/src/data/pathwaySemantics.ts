import type { ResolvedSolveControl } from '../solver/contract.ts';
import type {
  ConfigurationControlMode,
  ConfigurationDocument,
  ConfigurationServiceControl,
} from './types.ts';

export interface PathwayControlInput {
  mode?: ConfigurationControlMode | null;
  stateId?: string | null;
  fixedShares?: Record<string, number> | null;
  disabledStateIds?: readonly string[] | null;
}

export interface DerivedPathwayStateIds {
  allStateIds: string[];
  availableStateIds: string[];
  activeStateIds: string[];
  capEligibleStateIds: string[];
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

  if (
    'disabledStateIds' in control
    || 'stateId' in control
    || 'fixedShares' in control
  ) {
    return {
      mode: control.mode ?? null,
      stateId: control.stateId ?? null,
      fixedShares: control.fixedShares ?? null,
      disabledStateIds: control.disabledStateIds ?? [],
    };
  }

  if (
    'disabled_state_ids' in control
    || 'state_id' in control
    || 'fixed_shares' in control
  ) {
    return {
      mode: control.mode,
      stateId: control.state_id ?? null,
      fixedShares: control.fixed_shares ?? null,
      disabledStateIds: control.disabled_state_ids ?? [],
    };
  }

  return undefined;
}

function deriveActiveStateIds(
  availableStateIds: string[],
  control: PathwayControlInput | undefined,
): string[] {
  if (!control?.mode) {
    return availableStateIds;
  }

  switch (control.mode) {
    case 'externalized':
    case 'off':
      return [];
    case 'pinned_single':
      return control.stateId && availableStateIds.includes(control.stateId)
        ? [control.stateId]
        : [];
    case 'fixed_shares':
      return availableStateIds.filter((stateId) => (control.fixedShares?.[stateId] ?? 0) > 0);
    default:
      return availableStateIds;
  }
}

export function derivePathwayStateIds(
  allStateIds: readonly string[],
  control: SupportedPathwayControl,
): DerivedPathwayStateIds {
  const uniqueStateIds = dedupeStateIds(allStateIds);
  const normalizedControl = toPathwayControlInput(control);
  const disabledStateIds = new Set(normalizedControl?.disabledStateIds ?? []);
  const availableStateIds = uniqueStateIds.filter((stateId) => !disabledStateIds.has(stateId));
  const activeStateIds = deriveActiveStateIds(availableStateIds, normalizedControl);

  return {
    allStateIds: uniqueStateIds,
    availableStateIds,
    activeStateIds,
    // Exact controls do not redefine the cap denominator in Phase 1.
    capEligibleStateIds: availableStateIds,
  };
}

export function derivePathwayStateIdsForOutput(
  configuration: ConfigurationDocument,
  outputId: string,
  allStateIds: readonly string[],
): DerivedPathwayStateIds {
  return derivePathwayStateIds(allStateIds, configuration.service_controls[outputId]);
}
