import type {
  ConfigurationDocument,
  ConfigurationRoleControl,
  ConfigurationRoleControlYearOverride,
  ResolvedMethodYearRow,
} from './types.ts';

export interface RoleControlMappingInputs {
  resolvedMethodYears: Pick<ResolvedMethodYearRow, 'role_id' | 'output_id'>[];
}

export interface SolverOutputControlYearOverride {
  mode?: ConfigurationRoleControlYearOverride['mode'];
  targetValue?: number | null;
  activeMethodIds?: string[] | null;
}

export interface SolverOutputControl {
  mode: ConfigurationRoleControl['mode'];
  targetValue?: number | null;
  activeMethodIds?: string[] | null;
  yearOverrides?: Record<string, SolverOutputControlYearOverride> | null;
}

const LEGACY_OUTPUT_CONTROLS_KEY = ['service', 'controls'].join('_');
const LEGACY_ACTIVE_METHOD_IDS_KEY = ['active', 'state', 'ids'].join('_');
const CANONICAL_ACTIVE_METHOD_IDS_KEY = ['active', 'method', 'ids'].join('_');

type UnknownControl = Record<string, unknown>;

function isObjectRecord(value: unknown): value is UnknownControl {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toOutputYearOverride(
  override: ConfigurationRoleControlYearOverride,
): SolverOutputControlYearOverride {
  const nextOverride: SolverOutputControlYearOverride = {};

  if (override.mode !== undefined) {
    nextOverride.mode = override.mode;
  }
  if (override.target_value !== undefined) {
    nextOverride.targetValue = override.target_value;
  }
  if (override.active_method_ids !== undefined) {
    nextOverride.activeMethodIds = override.active_method_ids;
  }

  return nextOverride;
}

function toOutputControl(control: ConfigurationRoleControl): SolverOutputControl {
  const nextControl: SolverOutputControl = {
    mode: control.mode,
  };

  if (control.target_value !== undefined) {
    nextControl.targetValue = control.target_value;
  }
  if (control.active_method_ids !== undefined) {
    nextControl.activeMethodIds = control.active_method_ids;
  }
  if (control.year_overrides !== undefined) {
    nextControl.yearOverrides = control.year_overrides
      ? Object.fromEntries(
          Object.entries(control.year_overrides).map(([year, override]) => [
            year,
            toOutputYearOverride(override),
          ]),
        )
      : null;
  }

  return nextControl;
}

function toCanonicalRoleControl(control: unknown): ConfigurationRoleControl | null {
  if (!isObjectRecord(control)) {
    return null;
  }

  const nextControl: UnknownControl = { ...control };
  const legacyActiveMethodIds = nextControl[LEGACY_ACTIVE_METHOD_IDS_KEY];
  if (legacyActiveMethodIds !== undefined && nextControl[CANONICAL_ACTIVE_METHOD_IDS_KEY] === undefined) {
    nextControl[CANONICAL_ACTIVE_METHOD_IDS_KEY] = legacyActiveMethodIds;
  }
  delete nextControl[LEGACY_ACTIVE_METHOD_IDS_KEY];
  delete nextControl[['disabled', 'state', 'ids'].join('_')];
  delete nextControl[['fixed', 'shares'].join('_')];

  if (nextControl.mode !== 'optimize' && nextControl.mode !== 'externalized' && nextControl.mode !== 'target') {
    nextControl.mode = 'optimize';
  }

  if (isObjectRecord(nextControl.year_overrides)) {
    nextControl.year_overrides = Object.fromEntries(
      Object.entries(nextControl.year_overrides).map(([year, override]) => {
        const nextOverride = isObjectRecord(override) ? { ...override } : {};
        const overrideLegacyActiveMethodIds = nextOverride[LEGACY_ACTIVE_METHOD_IDS_KEY];
        if (
          overrideLegacyActiveMethodIds !== undefined
          && nextOverride[CANONICAL_ACTIVE_METHOD_IDS_KEY] === undefined
        ) {
          nextOverride[CANONICAL_ACTIVE_METHOD_IDS_KEY] = overrideLegacyActiveMethodIds;
        }
        delete nextOverride[LEGACY_ACTIVE_METHOD_IDS_KEY];
        delete nextOverride[['disabled', 'state', 'ids'].join('_')];
        delete nextOverride[['fixed', 'shares'].join('_')];
        return [year, nextOverride];
      }),
    );
  }

  return nextControl as unknown as ConfigurationRoleControl;
}

function buildRoleIdByControlId(
  inputs: RoleControlMappingInputs,
): Map<string, string> {
  const roleIdByControlId = new Map<string, string>();

  for (const row of inputs.resolvedMethodYears) {
    if (row.role_id) {
      roleIdByControlId.set(row.role_id, row.role_id);
    }
    if (row.output_id && row.role_id && !roleIdByControlId.has(row.output_id)) {
      roleIdByControlId.set(row.output_id, row.role_id);
    }
  }

  return roleIdByControlId;
}

export function normalizeConfigurationRoleControls(
  configuration: ConfigurationDocument,
  inputs: RoleControlMappingInputs,
): ConfigurationDocument {
  const legacyControls = (configuration as unknown as Record<string, unknown>)[LEGACY_OUTPUT_CONTROLS_KEY];
  if (!isObjectRecord(legacyControls)) {
    return configuration;
  }

  const roleIdByControlId = buildRoleIdByControlId(inputs);
  const roleControls = { ...(configuration.role_controls ?? {}) };

  for (const [controlId, control] of Object.entries(legacyControls)) {
    const roleId = roleIdByControlId.get(controlId) ?? controlId;
    const canonicalControl = toCanonicalRoleControl(control);
    if (canonicalControl) {
      roleControls[roleId] = canonicalControl;
    }
  }

  return {
    ...configuration,
    role_controls: roleControls,
  };
}

export function buildOutputIdByRoleId(
  inputs: RoleControlMappingInputs,
): Map<string, string> {
  const outputIdByRoleId = new Map<string, string>();

  for (const row of inputs.resolvedMethodYears) {
    if (!row.role_id) {
      continue;
    }
    const existing = outputIdByRoleId.get(row.role_id);
    if (existing && existing !== row.output_id) {
      throw new Error(
        `Role ${JSON.stringify(row.role_id)} maps to multiple role ids: ${JSON.stringify(existing)} and ${JSON.stringify(row.output_id)}.`,
      );
    }
    outputIdByRoleId.set(row.role_id, row.output_id);
  }

  return outputIdByRoleId;
}

export function resolveOutputControlsFromRoleControls(
  configuration: ConfigurationDocument,
  inputs: RoleControlMappingInputs,
): Record<string, SolverOutputControl> {
  const roleControls = normalizeConfigurationRoleControls(configuration, inputs).role_controls ?? {};
  const outputIdByRoleId = buildOutputIdByRoleId(inputs);

  return Object.entries(roleControls).reduce<Record<string, SolverOutputControl>>(
    (controls, [roleId, control]) => {
      const outputId = outputIdByRoleId.get(roleId) ?? roleId;
      controls[outputId] = toOutputControl(control);
      return controls;
    },
    {},
  );
}
