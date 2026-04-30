import {
  materializeEfficiencyConfiguration,
  materializeResidualOverlayConfiguration,
} from './configurationDocumentLoader.ts';
import { normalizeConfigurationRoleControls } from './configurationRoleControls.ts';
import { OVERLAY_GROWTH_PROXY } from './overlayProjection.ts';
import { derivePathwayMethodIdsForRole } from './pathwaySemantics.ts';
import type {
  AppConfigRegistry,
  ConfigurationDocument,
  ConfigurationRoleControl,
  ConfigurationRoleControlYearOverride,
  PackageData,
  ResidualOverlayDomain,
  ResidualOverlayRow,
  ResolvedMethodYearRow,
} from './types.ts';

export const GENERATED_INCUMBENT_BASE_LABEL = 'Generated incumbent base';

export interface SystemStructureGroupDefinition {
  id: string;
  label: string;
  outputIds: string[];
  residualOverlayIds: string[];
}

export const SYSTEM_STRUCTURE_GROUPS: SystemStructureGroupDefinition[] = [
  {
    id: 'buildings',
    label: 'Buildings',
    outputIds: ['residential_building_services', 'commercial_building_services'],
    residualOverlayIds: ['residential_other', 'commercial_other'],
  },
  {
    id: 'road_transport',
    label: 'Road transport',
    outputIds: ['passenger_road_transport', 'freight_road_transport'],
    residualOverlayIds: ['transport_other'],
  },
  {
    id: 'industrial_production',
    label: 'Industrial production',
    outputIds: [
      'low_temperature_heat',
      'medium_temperature_heat',
      'high_temperature_heat',
      'crude_steel',
      'cement_equivalent',
    ],
    residualOverlayIds: ['manufacturing_other', 'residual_ippu_other'],
  },
  {
    id: 'energy_supply',
    label: 'Energy supply',
    outputIds: ['electricity'],
    residualOverlayIds: ['mining_other', 'residual_fugitives'],
  },
  {
    id: 'agriculture',
    label: 'Agriculture',
    outputIds: ['livestock_output_bundle', 'cropping_horticulture_output_bundle'],
    residualOverlayIds: ['residual_agriculture_other'],
  },
  {
    id: 'construction',
    label: 'Construction',
    outputIds: [],
    residualOverlayIds: ['construction_other'],
  },
  {
    id: 'water_waste',
    label: 'Water and waste',
    outputIds: [],
    residualOverlayIds: ['water_waste_other', 'residual_waste'],
  },
  {
    id: 'other_sectors',
    label: 'Other sectors',
    outputIds: [],
    residualOverlayIds: ['other_other'],
  },
  {
    id: 'removals_land',
    label: 'Removals and land',
    outputIds: ['land_sequestration', 'engineered_removals'],
    residualOverlayIds: ['residual_lulucf_sink'],
  },
];

export interface ResidualOverlayCatalogEntry {
  overlayId: string;
  overlayLabel: string;
  overlayDomain: ResidualOverlayDomain;
  officialAccountingBucket: string;
  commodityCount: number;
  totalEnergyPJ: number;
  totalEmissionsMt: number;
  totalCostM: number;
  defaultInclude: boolean;
  proxyOutputIds: string[];
}

export function getSystemStructureGroupForOverlay(
  overlayId: string,
): SystemStructureGroupDefinition | undefined {
  return SYSTEM_STRUCTURE_GROUPS.find((group) => group.residualOverlayIds.includes(overlayId));
}

export function getSystemStructureGroupForOutput(
  outputId: string,
): SystemStructureGroupDefinition | undefined {
  return SYSTEM_STRUCTURE_GROUPS.find((group) => group.outputIds.includes(outputId));
}

export function buildResidualOverlayCatalog(
  rows: ResidualOverlayRow[],
): ResidualOverlayCatalogEntry[] {
  const byId = new Map<string, ResidualOverlayCatalogEntry>();

  for (const row of rows) {
    let entry = byId.get(row.overlay_id);
    if (!entry) {
      entry = {
        overlayId: row.overlay_id,
        overlayLabel: row.overlay_label,
        overlayDomain: row.overlay_domain,
        officialAccountingBucket: row.official_accounting_bucket,
        commodityCount: 0,
        totalEnergyPJ: 0,
        totalEmissionsMt: 0,
        totalCostM: 0,
        defaultInclude: row.default_include,
        proxyOutputIds: OVERLAY_GROWTH_PROXY[row.overlay_id] ?? [],
      };
      byId.set(row.overlay_id, entry);
    }

    entry.commodityCount += 1;
    entry.totalEnergyPJ += row.final_energy_pj_2025 ?? 0;
    entry.totalEmissionsMt += (
      (row.direct_energy_emissions_mtco2e_2025 ?? 0)
      + (row.other_emissions_mtco2e_2025 ?? 0)
    );
    entry.totalCostM += row.default_total_cost_ex_carbon_audm_2024 ?? 0;
    if (!row.default_include) {
      entry.defaultInclude = false;
    }
  }

  const orderByOverlayId = new Map<string, number>();
  SYSTEM_STRUCTURE_GROUPS.forEach((group, groupIndex) => {
    group.residualOverlayIds.forEach((overlayId, overlayIndex) => {
      orderByOverlayId.set(overlayId, groupIndex * 100 + overlayIndex);
    });
  });

  return Array.from(byId.values()).sort((left, right) => (
    (orderByOverlayId.get(left.overlayId) ?? Number.MAX_SAFE_INTEGER)
    - (orderByOverlayId.get(right.overlayId) ?? Number.MAX_SAFE_INTEGER)
    || left.overlayLabel.localeCompare(right.overlayLabel)
  ));
}

function cloneConfiguration(configuration: ConfigurationDocument): ConfigurationDocument {
  return structuredClone(configuration);
}

function collectMethodIdsByOutput(
  resolvedMethodYears: ResolvedMethodYearRow[],
): Map<string, string[]> {
  const byOutput = new Map<string, Set<string>>();

  for (const row of resolvedMethodYears) {
    let methodIds = byOutput.get(row.output_id);
    if (!methodIds) {
      methodIds = new Set<string>();
      byOutput.set(row.output_id, methodIds);
    }
    methodIds.add(row.method_id);
  }

  return new Map(
    Array.from(byOutput.entries()).map(([outputId, methodIds]) => [
      outputId,
      Array.from(methodIds),
    ]),
  );
}

function collectRoleIdByOutput(
  resolvedMethodYears: ResolvedMethodYearRow[],
): Map<string, string> {
  return new Map(resolvedMethodYears.map((row) => [row.output_id, row.role_id] as const));
}

function collectIncumbentMethodIdsByOutput(
  resolvedMethodYears: ResolvedMethodYearRow[],
): Map<string, string> {
  const incumbents = new Map<string, string>();

  for (const row of resolvedMethodYears) {
    if (!row.is_default_incumbent_2025) {
      continue;
    }

    const existing = incumbents.get(row.output_id);
    if (!existing || row.year === 2025) {
      incumbents.set(row.output_id, row.method_id);
    }
  }

  return incumbents;
}

function resolveFocusControl(
  configuration: ConfigurationDocument,
  appConfig: AppConfigRegistry,
  outputId: string,
  roleId: string,
): ConfigurationRoleControl {
  const configuredControl = configuration.role_controls?.[roleId];
  return {
    ...(configuredControl ?? {}),
    mode: configuredControl?.mode ?? appConfig.output_roles[outputId]?.default_control_mode ?? 'optimize',
  };
}

function controlHasExplicitDisabledRoutes(control: ConfigurationRoleControl): boolean {
  return Array.isArray(control.active_method_ids) && control.active_method_ids.length === 0;
}

function buildGeneratedYearOverride(
  override: ConfigurationRoleControlYearOverride,
  incumbentMethodId: string,
  forceDisabled: boolean,
): ConfigurationRoleControlYearOverride {
  const nextOverride: ConfigurationRoleControlYearOverride = { ...override };
  const mode = override.mode;

  if (forceDisabled || (Array.isArray(override.active_method_ids) && override.active_method_ids.length === 0)) {
    nextOverride.active_method_ids = [];
  } else if (mode === 'externalized') {
    delete nextOverride.active_method_ids;
  } else {
    nextOverride.active_method_ids = [incumbentMethodId];
  }

  return nextOverride;
}

function buildGeneratedControl(
  focusControl: ConfigurationRoleControl,
  incumbentMethodId: string,
): ConfigurationRoleControl {
  const disabled = controlHasExplicitDisabledRoutes(focusControl);
  const nextControl: ConfigurationRoleControl = {
    ...focusControl,
    active_method_ids: disabled ? [] : [incumbentMethodId],
  };

  if (focusControl.mode === 'externalized' && !disabled) {
    delete nextControl.active_method_ids;
  }

  if (focusControl.year_overrides) {
    nextControl.year_overrides = Object.fromEntries(
      Object.entries(focusControl.year_overrides)
        .filter((entry): entry is [string, ConfigurationRoleControlYearOverride] => entry[1] != null)
        .map(([year, override]) => [
          year,
          buildGeneratedYearOverride(override, incumbentMethodId, disabled),
        ]),
    );
  }

  return nextControl;
}

function outputHasEnabledRoutes(
  configuration: ConfigurationDocument,
  roleId: string,
  outputId: string,
  allMethodIdsByOutput: Map<string, string[]>,
): boolean {
  const allMethodIds = allMethodIdsByOutput.get(outputId) ?? [];
  if (allMethodIds.length === 0) {
    return false;
  }

  return derivePathwayMethodIdsForRole(
    configuration,
    roleId,
    allMethodIds,
  ).activeMethodIds.length > 0;
}

function buildGeneratedResidualControls(
  focusConfiguration: ConfigurationDocument,
  generatedRoleControls: NonNullable<ConfigurationDocument['role_controls']>,
  packageData: Pick<PackageData, 'resolvedMethodYears' | 'residualOverlays2025'>,
): NonNullable<ConfigurationDocument['residual_overlays']> {
  const materializedFocus = materializeResidualOverlayConfiguration(
    focusConfiguration,
    packageData.residualOverlays2025,
  );
  const focusControls = materializedFocus.residual_overlays?.controls_by_overlay_id ?? {};
  const residualCatalog = buildResidualOverlayCatalog(packageData.residualOverlays2025);
  const allMethodIdsByOutput = collectMethodIdsByOutput(packageData.resolvedMethodYears);
  const roleIdByOutput = collectRoleIdByOutput(packageData.resolvedMethodYears);
  const generatedRouteConfiguration: ConfigurationDocument = {
    ...focusConfiguration,
    role_controls: generatedRoleControls,
  };
  const controlsByOverlayId: Record<string, { included: boolean }> = {};

  for (const residual of residualCatalog) {
    const group = getSystemStructureGroupForOverlay(residual.overlayId);
    const focusIncluded = focusControls[residual.overlayId]?.included ?? residual.defaultInclude;

    if (!group || group.outputIds.length === 0 || residual.overlayDomain === 'net_sink') {
      controlsByOverlayId[residual.overlayId] = { included: focusIncluded };
      continue;
    }

    controlsByOverlayId[residual.overlayId] = {
      included: group.outputIds.some((outputId) =>
        outputHasEnabledRoutes(
          generatedRouteConfiguration,
          roleIdByOutput.get(outputId) ?? outputId,
          outputId,
          allMethodIdsByOutput,
        ),
      ),
    };
  }

  return { controls_by_overlay_id: controlsByOverlayId };
}

export function buildGeneratedIncumbentBaseConfiguration(
  focusConfiguration: ConfigurationDocument,
  packageData: Pick<
    PackageData,
    'appConfig' | 'resolvedMethodYears' | 'autonomousEfficiencyTracks' | 'efficiencyPackages' | 'residualOverlays2025'
  >,
): ConfigurationDocument {
  const focusWithResidualCompatibility = packageData.residualOverlays2025.length > 0
    ? materializeResidualOverlayConfiguration(
      cloneConfiguration(focusConfiguration),
      packageData.residualOverlays2025,
    )
    : cloneConfiguration(focusConfiguration);
  const materializedFocus = materializeEfficiencyConfiguration(
    normalizeConfigurationRoleControls(focusWithResidualCompatibility, {
      resolvedMethodYears: packageData.resolvedMethodYears,
    }),
    packageData.autonomousEfficiencyTracks,
    packageData.efficiencyPackages,
    packageData.resolvedMethodYears,
  );
  const allMethodIdsByOutput = collectMethodIdsByOutput(packageData.resolvedMethodYears);
  const incumbentMethodIdsByOutput = collectIncumbentMethodIdsByOutput(packageData.resolvedMethodYears);
  const roleIdByOutput = collectRoleIdByOutput(packageData.resolvedMethodYears);
  const roleControls: NonNullable<ConfigurationDocument['role_controls']> = {
    ...(materializedFocus.role_controls ?? {}),
  };

  for (const [outputId, allMethodIds] of allMethodIdsByOutput) {
    const incumbentMethodId = incumbentMethodIdsByOutput.get(outputId) ?? allMethodIds[0];
    if (!incumbentMethodId) {
      continue;
    }

    const roleId = roleIdByOutput.get(outputId) ?? outputId;
    roleControls[roleId] = buildGeneratedControl(
      resolveFocusControl(materializedFocus, packageData.appConfig, outputId, roleId),
      incumbentMethodId,
    );
  }

  const generatedConfiguration: ConfigurationDocument = {
    ...materializedFocus,
    name: GENERATED_INCUMBENT_BASE_LABEL,
    description: 'Generated comparison base using the focus levers with enabled modeled outputs held to incumbent routes, efficiency packages off, and residuals aligned to system structure.',
    role_controls: roleControls,
    efficiency_controls: {
      autonomous_mode: 'baseline',
      autonomous_modes_by_role: {},
      package_mode: 'off',
      package_ids: [],
    },
  };

  if (packageData.residualOverlays2025.length > 0) {
    generatedConfiguration.residual_overlays = buildGeneratedResidualControls(
      materializedFocus,
      roleControls,
      packageData,
    );
  } else {
    delete generatedConfiguration.residual_overlays;
  }

  delete generatedConfiguration.app_metadata;

  return generatedConfiguration;
}
