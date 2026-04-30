import type { ResolvedSolveControl } from '../solver/contract.ts';
import type {
  ConfigurationControlMode,
  ConfigurationRoleControl,
} from './types.ts';

export interface PathwayControlInput {
  mode?: ConfigurationControlMode | null;
  activeMethodIds?: readonly string[] | null;
}

export interface DerivedPathwayMethodIds {
  allMethodIds: string[];
  activeMethodIds: string[];
}

type SupportedPathwayControl =
  | ConfigurationRoleControl
  | PathwayControlInput
  | ResolvedSolveControl
  | null
  | undefined;

function dedupeMethodIds(methodIds: readonly string[]): string[] {
  return Array.from(new Set(methodIds));
}

export function toPathwayControlInput(
  control: SupportedPathwayControl,
): PathwayControlInput | undefined {
  if (!control) {
    return undefined;
  }

  if ('activeMethodIds' in control) {
    return {
      mode: control.mode ?? null,
      activeMethodIds: (control as PathwayControlInput).activeMethodIds ?? null,
    };
  }

  if ('active_method_ids' in control) {
    const roleControl = control as ConfigurationRoleControl;
    return {
      mode: roleControl.mode,
      activeMethodIds: roleControl.active_method_ids ?? null,
    };
  }

  return undefined;
}

function deriveActiveMethodIds(
  allMethodIds: string[],
  control: PathwayControlInput | undefined,
): string[] {
  if (!control?.mode) {
    if (control?.activeMethodIds) {
      const allowed = new Set(control.activeMethodIds);
      return allMethodIds.filter((id) => allowed.has(id));
    }
    return allMethodIds;
  }

  switch (control.mode) {
    case 'externalized':
      return [];
    default:
      if (control.activeMethodIds) {
        const allowed = new Set(control.activeMethodIds);
        return allMethodIds.filter((id) => allowed.has(id));
      }
      return allMethodIds;
  }
}

export function derivePathwayMethodIds(
  allMethodIds: readonly string[],
  control: SupportedPathwayControl,
): DerivedPathwayMethodIds {
  const uniqueMethodIds = dedupeMethodIds(allMethodIds);
  const normalizedControl = toPathwayControlInput(control);
  const activeMethodIds = deriveActiveMethodIds(uniqueMethodIds, normalizedControl);

  return {
    allMethodIds: uniqueMethodIds,
    activeMethodIds,
  };
}

export function derivePathwayMethodIdsForRole(
  configuration: { role_controls?: Record<string, ConfigurationRoleControl> },
  roleId: string,
  allMethodIds: readonly string[],
): DerivedPathwayMethodIds {
  return derivePathwayMethodIds(allMethodIds, configuration.role_controls?.[roleId]);
}
