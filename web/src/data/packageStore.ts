import { create } from 'zustand';
import {
  clearPersistedConfigurationDraft,
  loadPersistedConfigurationDraft,
  persistConfigurationDraft,
  persistConfigMeta,
} from './configurationDraftStorage.ts';
import { resolveConfigurationDocument } from './demandResolution.ts';
import { loadPackage } from './packageLoader.ts';
import type {
  ConfigurationControlMode,
  ConfigurationDocument,
  ResidualOverlayDisplayMode,
  PackageData,
  PriceLevel,
} from './types.ts';
import {
  getConfigurationId,
  isReadonlyConfiguration,
  loadBuiltinConfigurations,
} from './configurationLoader.ts';
import {
  materializeEfficiencyConfiguration,
  materializeResidualOverlayConfiguration,
} from './configurationDocumentLoader.ts';
import { materializeConfigurationRoleControls } from './configurationRoleControls.ts';
import { buildNextPackageAllowList } from './efficiencyControlModel.ts';
import { isAggregatableResidualOverlay } from './residualOverlayPresentation.ts';
import { getActiveMethodIds } from './configurationWorkspaceModel.ts';

export type ConfigurationDraftSource = 'reference' | 'local_draft' | 'imported' | 'draft' | 'configuration';

interface PackageStore extends PackageData {
  loaded: boolean;
  currentConfiguration: ConfigurationDocument;
  currentConfigurationSource: ConfigurationDraftSource;
  activeConfigurationId: string | null;
  activeConfigurationReadonly: boolean;
  isConfigurationDirty: boolean;
  baseConfiguration: ConfigurationDocument | null;
  persistenceNotice: string | null;
  persistenceError: string | null;
  replaceCurrentConfiguration: (
    configuration: ConfigurationDocument,
    source?: Exclude<ConfigurationDraftSource, 'reference'>,
    notice?: string | null,
  ) => void;
  updateConfigurationMetadata: (updates: { name?: string; description?: string }) => void;
  resetCurrentConfiguration: () => void;
  setCommodityPriceLevel: (commodityId: string, level: PriceLevel) => void;
  setCarbonPricePreset: (presetId: string) => void;
  toggleMethodActive: (roleId: string, methodId: string) => void;
  setRoleRepresentation: (roleId: string, representationId: string) => void;
  setRoleControlMode: (roleId: string, mode: ConfigurationControlMode) => void;
  setAutonomousEfficiencyForRole: (roleId: string, mode: 'baseline' | 'off') => void;
  setEfficiencyPackageEnabled: (packageId: string, enabled: boolean) => void;
  setAllEfficiencyPackagesForRole: (roleId: string, enabled: boolean) => void;

  setResidualOverlayIncluded: (overlayId: string, included: boolean) => void;
  setResidualOverlayGroupIncluded: (overlayIds: string[], included: boolean) => void;
  setAllResidualOverlaysIncluded: (included: boolean) => void;
  setResidualOverlayDisplayMode: (mode: ResidualOverlayDisplayMode) => void;
  setDemandPreset: (presetId: string) => void;
  setRespectMaxShare: (enabled: boolean) => void;
  setRespectMaxActivity: (enabled: boolean) => void;
  loadConfiguration: (config: ConfigurationDocument) => void;
}

function cloneConfiguration(configuration: ConfigurationDocument): ConfigurationDocument {
  return structuredClone(configuration);
}

function getDefaultBuiltinConfiguration(): ConfigurationDocument | null {
  const builtins = loadBuiltinConfigurations();
  return builtins.find((config) => getConfigurationId(config) === 'reference-baseline') ?? builtins[0] ?? null;
}

function sortNestedValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortNestedValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortNestedValue(nestedValue)]),
    );
  }

  return value;
}

function configurationsEqual(a: ConfigurationDocument, b: ConfigurationDocument): boolean {
  const normalize = (configuration: ConfigurationDocument): unknown => {
    const clone = structuredClone(configuration);
    for (const control of Object.values(clone.role_controls ?? {})) {
      if (control?.active_method_ids) {
        control.active_method_ids = [...control.active_method_ids].sort();
      }
    }
    return JSON.stringify(sortNestedValue(clone));
  };
  return normalize(a) === normalize(b);
}

function normalizeDescription(description: string | undefined): string | undefined {
  return description?.trim() ? description : undefined;
}

function getAllMethodIdsForRole(
  resolvedMethodYears: PackageData['resolvedMethodYears'],
  roleId: string,
): string[] {
  return Array.from(
    new Set(
      resolvedMethodYears
        .filter((row) => row.role_id === roleId)
        .map((row) => row.method_id),
    ),
  );
}

function getOutputIdForRole(
  resolvedMethodYears: PackageData['resolvedMethodYears'],
  roleId: string,
): string {
  return resolvedMethodYears.find((row) => row.role_id === roleId)?.output_id ?? roleId;
}

function persistActiveConfigurationMeta(state: {
  activeConfigurationId: string | null;
  activeConfigurationReadonly: boolean;
  baseConfiguration: ConfigurationDocument | null;
}): void {
  if (!state.activeConfigurationId || !state.baseConfiguration) {
    return;
  }

  persistConfigMeta({
    activeConfigurationId: state.activeConfigurationId,
    activeConfigurationReadonly: state.activeConfigurationReadonly,
    baseConfiguration: cloneConfiguration(state.baseConfiguration),
  });
}

function materializeConfiguration(
  configuration: ConfigurationDocument,
  resolvedMethodYears: PackageData['resolvedMethodYears'],
  autonomousEfficiencyTracks: PackageData['autonomousEfficiencyTracks'],
  efficiencyPackages: PackageData['efficiencyPackages'],
  residualOverlays2025: PackageData['residualOverlays2025'],
  defaultConfiguration?: Pick<ConfigurationDocument, 'role_controls'>,
): ConfigurationDocument {
  return materializeEfficiencyConfiguration(
    materializeResidualOverlayConfiguration(
      materializeConfigurationRoleControls(
        configuration,
        { resolvedMethodYears },
        defaultConfiguration,
      ),
      residualOverlays2025,
    ),
    autonomousEfficiencyTracks,
    efficiencyPackages,
    resolvedMethodYears,
  );
}

export const usePackageStore = create<PackageStore>((set, get) => {
  const pkg = loadPackage();
  const persistedDraft = loadPersistedConfigurationDraft(pkg.appConfig);

  // Determine initial state: persisted draft → first builtin config → bare default
  let initialConfiguration: ConfigurationDocument;
  let initialSource: ConfigurationDraftSource;
  let initialConfigId: string | null = null;
  let initialConfigReadonly = false;
  let initialBaseConfiguration: ConfigurationDocument | null = null;
  let initialDirty = false;

  if (persistedDraft.configuration) {
      initialConfiguration = materializeConfiguration(
        cloneConfiguration(persistedDraft.configuration),
        pkg.resolvedMethodYears,
        pkg.autonomousEfficiencyTracks,
        pkg.efficiencyPackages,
        pkg.residualOverlays2025,
        pkg.defaultConfiguration,
    );
    initialSource = 'local_draft';

    const restoredMeta = persistedDraft.configMeta;
    if (restoredMeta?.baseConfiguration) {
      initialConfigId = restoredMeta.activeConfigurationId;
      initialConfigReadonly = restoredMeta.activeConfigurationReadonly;
      initialBaseConfiguration = materializeConfiguration(
        cloneConfiguration(restoredMeta.baseConfiguration),
        pkg.resolvedMethodYears,
        pkg.autonomousEfficiencyTracks,
        pkg.efficiencyPackages,
        pkg.residualOverlays2025,
        pkg.defaultConfiguration,
      );
      initialDirty =
        !configurationsEqual(initialConfiguration, initialBaseConfiguration);
    }
  } else {
    // No persisted draft — load the first builtin configuration as the default
    const defaultConfig = getDefaultBuiltinConfiguration();

    if (defaultConfig) {
      const defaultConfigId = getConfigurationId(defaultConfig) ?? defaultConfig.name;

      initialConfiguration = materializeConfiguration(
        cloneConfiguration(defaultConfig),
        pkg.resolvedMethodYears,
        pkg.autonomousEfficiencyTracks,
        pkg.efficiencyPackages,
        pkg.residualOverlays2025,
        pkg.defaultConfiguration,
      );
      initialSource = 'configuration';
      initialConfigId = defaultConfigId;
      initialConfigReadonly = isReadonlyConfiguration(defaultConfig);
      initialBaseConfiguration = cloneConfiguration(initialConfiguration);

      persistConfigurationDraft(initialConfiguration);
      persistConfigMeta({
        activeConfigurationId: defaultConfigId,
        activeConfigurationReadonly: initialConfigReadonly,
        baseConfiguration: cloneConfiguration(initialConfiguration),
      });
    } else {
      initialConfiguration = materializeConfiguration(
        cloneConfiguration(pkg.defaultConfiguration),
        pkg.resolvedMethodYears,
        pkg.autonomousEfficiencyTracks,
        pkg.efficiencyPackages,
        pkg.residualOverlays2025,
        pkg.defaultConfiguration,
      );
      initialSource = 'reference';
    }
  }

  function commitConfigurationEdit(nextConfiguration: ConfigurationDocument) {
    const state = get();
    const persistenceError = persistConfigurationDraft(nextConfiguration);
    const dirty = state.baseConfiguration
      ? !configurationsEqual(nextConfiguration, state.baseConfiguration)
      : false;

    persistActiveConfigurationMeta({
      activeConfigurationId: state.activeConfigurationId,
      activeConfigurationReadonly: state.activeConfigurationReadonly,
      baseConfiguration: state.baseConfiguration,
    });

    set({
      currentConfiguration: nextConfiguration,
      currentConfigurationSource: 'draft',
      isConfigurationDirty: dirty,
      persistenceNotice: 'The active configuration autosaves in this browser as you edit it.',
      persistenceError,
    });
  }

  return {
    ...pkg,
    loaded: true,
    currentConfiguration: initialConfiguration,
    currentConfigurationSource: initialSource,
    activeConfigurationId: initialConfigId,
    activeConfigurationReadonly: initialConfigReadonly,
    isConfigurationDirty: initialDirty,
    baseConfiguration: initialBaseConfiguration,
    persistenceNotice: persistedDraft.notice,
    persistenceError: persistedDraft.error,
    replaceCurrentConfiguration: (configuration, source = 'draft', notice = null) => {
      const nextConfiguration = materializeConfiguration(
        cloneConfiguration(configuration),
        get().resolvedMethodYears,
        get().autonomousEfficiencyTracks,
        get().efficiencyPackages,
        get().residualOverlays2025,
        get().defaultConfiguration,
      );
      const persistenceError = persistConfigurationDraft(nextConfiguration);
      persistConfigMeta(null);

      set({
        currentConfiguration: nextConfiguration,
        currentConfigurationSource: source,
        activeConfigurationId: null,
        activeConfigurationReadonly: false,
        baseConfiguration: null,
        isConfigurationDirty: false,
        persistenceNotice: notice ?? 'The active configuration autosaved in this browser.',
        persistenceError,
      });
    },
    updateConfigurationMetadata: (updates) => {
      const nextConfiguration = cloneConfiguration(get().currentConfiguration);

      if (updates.name !== undefined) {
        nextConfiguration.name = updates.name;
      }

      if (updates.description !== undefined) {
        const description = normalizeDescription(updates.description);

        if (description) {
          nextConfiguration.description = description;
        } else {
          delete nextConfiguration.description;
        }
      }

      commitConfigurationEdit(nextConfiguration);
    },
    resetCurrentConfiguration: () => {
      const persistenceError = clearPersistedConfigurationDraft();
      persistConfigMeta(null);

      const defaultConfig = getDefaultBuiltinConfiguration();
      if (defaultConfig) {
        const defaultConfigId = getConfigurationId(defaultConfig) ?? defaultConfig.name;
        const nextConfiguration = materializeConfiguration(
          cloneConfiguration(defaultConfig),
          get().resolvedMethodYears,
          get().autonomousEfficiencyTracks,
          get().efficiencyPackages,
          get().residualOverlays2025,
          get().defaultConfiguration,
        );

        set({
          currentConfiguration: nextConfiguration,
          currentConfigurationSource: 'configuration',
          activeConfigurationId: defaultConfigId,
          activeConfigurationReadonly: isReadonlyConfiguration(defaultConfig),
          baseConfiguration: cloneConfiguration(nextConfiguration),
          isConfigurationDirty: false,
          persistenceNotice: 'Reset to the default built-in configuration and cleared the browser-local document.',
          persistenceError,
        });
        return;
      }

      const nextConfiguration = materializeConfiguration(
        cloneConfiguration(get().defaultConfiguration),
        get().resolvedMethodYears,
        get().autonomousEfficiencyTracks,
        get().efficiencyPackages,
        get().residualOverlays2025,
        get().defaultConfiguration,
      );

      set({
        currentConfiguration: nextConfiguration,
        currentConfigurationSource: 'reference',
        activeConfigurationId: null,
        activeConfigurationReadonly: false,
        baseConfiguration: null,
        isConfigurationDirty: false,
        persistenceNotice: 'Reset to the packaged reference configuration and cleared the browser-local document.',
        persistenceError,
      });
    },
    setCommodityPriceLevel: (commodityId, level) => {
      const nextConfiguration = cloneConfiguration(get().currentConfiguration);
      nextConfiguration.commodity_pricing.selections_by_commodity = {
        ...nextConfiguration.commodity_pricing.selections_by_commodity,
        [commodityId]: level,
      };
      delete nextConfiguration.commodity_pricing.overrides[commodityId];
      commitConfigurationEdit(nextConfiguration);
    },
    setCarbonPricePreset: (presetId) => {
      const preset = get().appConfig.carbon_price_presets[presetId];
      if (!preset) return;
      const nextConfiguration = cloneConfiguration(get().currentConfiguration);
      nextConfiguration.carbon_price = { ...preset.values_by_year };
      commitConfigurationEdit(nextConfiguration);
    },
    toggleMethodActive: (roleId, methodId) => {
      const nextConfiguration = cloneConfiguration(get().currentConfiguration);
      const allMethodIds = getAllMethodIdsForRole(get().resolvedMethodYears, roleId);
      const currentActiveIds = new Set(
        getActiveMethodIds(nextConfiguration, roleId, allMethodIds),
      );

      if (currentActiveIds.has(methodId)) {
        currentActiveIds.delete(methodId);
      } else {
        currentActiveIds.add(methodId);
      }

      const activeMethodIds = allMethodIds.filter((id) => currentActiveIds.has(id));

      const existing = nextConfiguration.role_controls?.[roleId] ?? {
        mode: 'optimize',
      };

      nextConfiguration.role_controls = {
        ...(nextConfiguration.role_controls ?? {}),
        [roleId]: {
          ...existing,
          active_method_ids: activeMethodIds.length === allMethodIds.length ? null : activeMethodIds,
        },
      };
      commitConfigurationEdit(nextConfiguration);
    },
    setRoleRepresentation: (roleId, representationId) => {
      const nextConfiguration = cloneConfiguration(get().currentConfiguration);
      nextConfiguration.representation_by_role = {
        ...(nextConfiguration.representation_by_role ?? {}),
        [roleId]: representationId,
      };
      commitConfigurationEdit(nextConfiguration);
    },
    setRoleControlMode: (roleId, mode) => {
      const outputId = getOutputIdForRole(get().resolvedMethodYears, roleId);
      const metadata = get().appConfig.output_roles[outputId];
      const allowed = metadata?.allowed_control_modes ?? [];
      if (allowed.length > 0 && !allowed.includes(mode)) {
        return;
      }

      const nextConfiguration = cloneConfiguration(get().currentConfiguration);
      const control = nextConfiguration.role_controls?.[roleId] ?? {
        mode: 'optimize',
      };

      nextConfiguration.role_controls = {
        ...(nextConfiguration.role_controls ?? {}),
        [roleId]: {
          ...control,
          mode,
        },
      };
      commitConfigurationEdit(nextConfiguration);
    },
    setAutonomousEfficiencyForRole: (roleId, mode) => {
      const nextConfiguration = cloneConfiguration(get().currentConfiguration);
      const existingControls = nextConfiguration.efficiency_controls ?? {};
      nextConfiguration.efficiency_controls = {
        autonomous_mode: existingControls.autonomous_mode ?? 'baseline',
        autonomous_modes_by_role: {
          ...(existingControls.autonomous_modes_by_role ?? {}),
          [roleId]: mode,
        },
        package_mode: existingControls.package_mode ?? 'off',
        package_ids: existingControls.package_ids ?? [],
      };
      commitConfigurationEdit(nextConfiguration);
    },
    setEfficiencyPackageEnabled: (packageId, enabled) => {
      const nextConfiguration = cloneConfiguration(get().currentConfiguration);
      const existingControls = nextConfiguration.efficiency_controls ?? {};
      const packageIds = buildNextPackageAllowList(
        existingControls,
        get().efficiencyPackages,
        { packageId, enabled },
      );

      nextConfiguration.efficiency_controls = {
        autonomous_mode: existingControls.autonomous_mode ?? 'baseline',
        autonomous_modes_by_role: existingControls.autonomous_modes_by_role ?? {},
        package_mode: 'allow_list',
        package_ids: packageIds,
      };
      commitConfigurationEdit(nextConfiguration);
    },
    setAllEfficiencyPackagesForRole: (roleId, enabled) => {
      const nextConfiguration = cloneConfiguration(get().currentConfiguration);
      const existingControls = nextConfiguration.efficiency_controls ?? {};
      const packageIds = buildNextPackageAllowList(
        existingControls,
        get().efficiencyPackages,
        { outputId: getOutputIdForRole(get().resolvedMethodYears, roleId), roleId, enabled },
      );

      nextConfiguration.efficiency_controls = {
        autonomous_mode: existingControls.autonomous_mode ?? 'baseline',
        autonomous_modes_by_role: existingControls.autonomous_modes_by_role ?? {},
        package_mode: 'allow_list',
        package_ids: packageIds,
      };
      commitConfigurationEdit(nextConfiguration);
    },
    setResidualOverlayIncluded: (overlayId, included) => {
      const nextConfiguration = cloneConfiguration(get().currentConfiguration);
      nextConfiguration.residual_overlays = {
        ...nextConfiguration.residual_overlays,
        controls_by_overlay_id: {
          ...nextConfiguration.residual_overlays?.controls_by_overlay_id,
          [overlayId]: { included },
        },
      };
      commitConfigurationEdit(nextConfiguration);
    },
    setResidualOverlayGroupIncluded: (overlayIds, included) => {
      const nextConfiguration = cloneConfiguration(get().currentConfiguration);
      nextConfiguration.residual_overlays = {
        ...nextConfiguration.residual_overlays,
        controls_by_overlay_id: {
          ...nextConfiguration.residual_overlays?.controls_by_overlay_id,
          ...Object.fromEntries(
            Array.from(new Set(overlayIds)).map((overlayId) => [overlayId, { included }]),
          ),
        },
      };
      commitConfigurationEdit(nextConfiguration);
    },
    setAllResidualOverlaysIncluded: (included) => {
      const nextConfiguration = cloneConfiguration(get().currentConfiguration);
      const controls = nextConfiguration.residual_overlays?.controls_by_overlay_id ?? {};
      const nonSinkOverlayIds = Array.from(
        new Set(
          get().residualOverlays2025
            .filter((row) => isAggregatableResidualOverlay(row.overlay_domain))
            .map((row) => row.overlay_id),
        ),
      );
      nextConfiguration.residual_overlays = {
        controls_by_overlay_id: Object.fromEntries(
          Object.keys(controls).map((id) => [
            id,
            { included: nonSinkOverlayIds.includes(id) ? included : (controls[id]?.included ?? false) },
          ]),
        ),
      };
      commitConfigurationEdit(nextConfiguration);
    },
    setResidualOverlayDisplayMode: (mode) => {
      const nextConfiguration = cloneConfiguration(get().currentConfiguration);
      nextConfiguration.presentation_options = {
        ...(nextConfiguration.presentation_options ?? {}),
        residual_overlay_display_mode: mode,
      };
      commitConfigurationEdit(nextConfiguration);
    },
    setDemandPreset: (presetId) => {
      const nextConfiguration = cloneConfiguration(get().currentConfiguration);
      nextConfiguration.demand_generation.preset_id = presetId;

      if (nextConfiguration.demand_generation.mode === 'manual_table') {
        nextConfiguration.demand_generation.mode = 'anchor_plus_preset';
      }

      nextConfiguration.demand_generation.service_growth_rates_pct_per_year = null;
      nextConfiguration.demand_generation.external_commodity_growth_rates_pct_per_year = null;
      const resolvedConfiguration = resolveConfigurationDocument(
        nextConfiguration,
        get().appConfig,
        'active configuration',
        { allowMismatchedResolvedTables: true },
      );
      resolvedConfiguration.demand_generation.service_growth_rates_pct_per_year = null;
      resolvedConfiguration.demand_generation.external_commodity_growth_rates_pct_per_year = null;
      commitConfigurationEdit(resolvedConfiguration);
    },
    setRespectMaxShare: (enabled) => {
      const nextConfiguration = cloneConfiguration(get().currentConfiguration);
      nextConfiguration.solver_options = {
        ...(nextConfiguration.solver_options ?? {}),
        respect_max_share: enabled,
      };
      commitConfigurationEdit(nextConfiguration);
    },
    setRespectMaxActivity: (enabled) => {
      const nextConfiguration = cloneConfiguration(get().currentConfiguration);
      nextConfiguration.solver_options = {
        ...(nextConfiguration.solver_options ?? {}),
        respect_max_activity: enabled,
      };
      commitConfigurationEdit(nextConfiguration);
    },
    loadConfiguration: (config) => {
      const nextConfiguration = materializeConfiguration(
        cloneConfiguration(config),
        get().resolvedMethodYears,
        get().autonomousEfficiencyTracks,
        get().efficiencyPackages,
        get().residualOverlays2025,
        get().defaultConfiguration,
      );
      const baseConfiguration = cloneConfiguration(nextConfiguration);
      const configId = getConfigurationId(config) ?? config.name;
      const readonly = isReadonlyConfiguration(config);
      const persistenceError = persistConfigurationDraft(nextConfiguration);

      persistConfigMeta({
        activeConfigurationId: configId,
        activeConfigurationReadonly: readonly,
        baseConfiguration,
      });

      set({
        currentConfiguration: nextConfiguration,
        currentConfigurationSource: 'configuration',
        activeConfigurationId: configId,
        activeConfigurationReadonly: readonly,
        baseConfiguration: cloneConfiguration(baseConfiguration),
        isConfigurationDirty: false,
        persistenceNotice: `Loaded configuration "${config.name}".`,
        persistenceError,
      });
    },
  };
});
