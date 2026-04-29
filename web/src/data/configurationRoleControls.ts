import type {
  ConfigurationDocument,
  ConfigurationRoleControl,
  ConfigurationRoleControlYearOverride,
  ConfigurationServiceControl,
  ConfigurationServiceControlYearOverride,
  SectorState,
} from './types.ts';

export interface RoleControlMappingInputs {
  sectorStates: Pick<SectorState, 'role_id' | 'service_or_output_name'>[];
}

function toServiceYearOverride(
  override: ConfigurationRoleControlYearOverride,
): ConfigurationServiceControlYearOverride {
  const nextOverride: ConfigurationServiceControlYearOverride = {};

  if (override.mode !== undefined) {
    nextOverride.mode = override.mode;
  }
  if (override.target_value !== undefined) {
    nextOverride.target_value = override.target_value;
  }
  if (override.active_method_ids !== undefined) {
    nextOverride.active_state_ids = override.active_method_ids;
  }

  return nextOverride;
}

function toServiceControl(control: ConfigurationRoleControl): ConfigurationServiceControl {
  const nextControl: ConfigurationServiceControl = {
    mode: control.mode,
  };

  if (control.target_value !== undefined) {
    nextControl.target_value = control.target_value;
  }
  if (control.active_method_ids !== undefined) {
    nextControl.active_state_ids = control.active_method_ids;
  }
  if (control.year_overrides !== undefined) {
    nextControl.year_overrides = control.year_overrides
      ? Object.fromEntries(
          Object.entries(control.year_overrides).map(([year, override]) => [
            year,
            toServiceYearOverride(override),
          ]),
        )
      : null;
  }

  return nextControl;
}

export function buildOutputIdByRoleId(
  inputs: RoleControlMappingInputs,
): Map<string, string> {
  const outputIdByRoleId = new Map<string, string>();

  for (const row of inputs.sectorStates) {
    if (!row.role_id) {
      continue;
    }
    const existing = outputIdByRoleId.get(row.role_id);
    if (existing && existing !== row.service_or_output_name) {
      throw new Error(
        `Role ${JSON.stringify(row.role_id)} maps to multiple output ids: ${JSON.stringify(existing)} and ${JSON.stringify(row.service_or_output_name)}.`,
      );
    }
    outputIdByRoleId.set(row.role_id, row.service_or_output_name);
  }

  return outputIdByRoleId;
}

export function materializeServiceControlsFromRoleControls(
  configuration: ConfigurationDocument,
  inputs: RoleControlMappingInputs,
): ConfigurationDocument {
  const roleControls = configuration.role_controls;
  if (!roleControls) {
    if (configuration.service_controls) {
      return configuration;
    }
    return {
      ...configuration,
      service_controls: {},
    };
  }

  const outputIdByRoleId = buildOutputIdByRoleId(inputs);
  const roleDerivedServiceControls = outputIdByRoleId.size === 0
    ? {}
    : Object.entries(roleControls).reduce<
        Record<string, ConfigurationServiceControl>
      >((controls, [roleId, control]) => {
        const outputId = outputIdByRoleId.get(roleId) ?? roleId;
        controls[outputId] = toServiceControl(control);
        return controls;
      }, {});

  const existingServiceControls = configuration.service_controls ?? {};
  const serviceControls = {
    ...roleDerivedServiceControls,
    ...existingServiceControls,
  };

  return {
    ...configuration,
    service_controls: serviceControls,
  };
}
