import { normalizeConfigurationRoleControls } from '../src/data/configurationRoleControls.ts';

function buildOutputIdByRoleId(resolvedMethodYears) {
  const outputIdByRoleId = new Map();
  for (const row of resolvedMethodYears) {
    if (row.role_id && row.output_id && !outputIdByRoleId.has(row.role_id)) {
      outputIdByRoleId.set(row.role_id, row.output_id);
    }
  }
  return outputIdByRoleId;
}

function toLegacyControl(control) {
  const next = {
    ...control,
  };
  if ('active_method_ids' in next) {
    next.active_state_ids = next.active_method_ids;
    delete next.active_method_ids;
  }
  if (next.year_overrides) {
    next.year_overrides = Object.fromEntries(
      Object.entries(next.year_overrides).map(([year, override]) => {
        const nextOverride = { ...override };
        if ('active_method_ids' in nextOverride) {
          nextOverride.active_state_ids = nextOverride.active_method_ids;
          delete nextOverride.active_method_ids;
        }
        return [year, nextOverride];
      }),
    );
  }
  return next;
}

export function materializeServiceControlsFromRoleControls(configuration, inputs) {
  const normalized = normalizeConfigurationRoleControls(configuration, inputs);
  const outputIdByRoleId = buildOutputIdByRoleId(inputs.resolvedMethodYears);
  const serviceControls = Object.fromEntries(
    Object.entries(normalized.role_controls ?? {}).map(([roleId, control]) => [
      outputIdByRoleId.get(roleId) ?? roleId,
      toLegacyControl(control),
    ]),
  );

  const withLegacyMirror = {
    ...normalized,
  };
  Object.defineProperty(withLegacyMirror, 'service_controls', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: serviceControls,
  });

  return withLegacyMirror;
}
