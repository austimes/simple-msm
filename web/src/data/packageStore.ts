import { create } from 'zustand';
import {
  clearPersistedScenarioDraft,
  loadPersistedScenarioDraft,
  persistScenarioDraft,
  persistConfigMeta,
} from './scenarioDraftStorage';
import { loadPackage } from './packageLoader';
import type { PackageData, PriceLevel, ScenarioControlMode, ScenarioDocument, ScenarioServiceControl } from './types';
import {
  getConfigurationId,
  isReadonlyConfiguration,
  loadBuiltinConfigurations,
  withSeedOutputIds,
} from './configurationLoader';
import { getEnabledStateIds } from './scenarioWorkspaceModel';

export type ConfigurationDraftSource = 'reference' | 'local_draft' | 'imported' | 'draft' | 'configuration';

interface PackageStore extends PackageData {
  loaded: boolean;
  currentConfiguration: ScenarioDocument;
  currentConfigurationSource: ConfigurationDraftSource;
  activeConfigurationId: string | null;
  activeConfigurationReadonly: boolean;
  isConfigurationDirty: boolean;
  baseConfiguration: ScenarioDocument | null;
  persistenceNotice: string | null;
  persistenceError: string | null;
  replaceCurrentConfiguration: (
    configuration: ScenarioDocument,
    source?: Exclude<ConfigurationDraftSource, 'reference'>,
    notice?: string | null,
  ) => void;
  updateConfigurationMetadata: (updates: { name?: string; description?: string }) => void;
  resetCurrentConfiguration: () => void;
  setCommodityPriceLevel: (commodityId: string, level: PriceLevel) => void;
  setCarbonPricePreset: (presetId: string) => void;
  toggleStateEnabled: (outputId: string, stateId: string) => void;
  setOutputControlMode: (outputId: string, mode: ScenarioControlMode) => void;
  setDemandPreset: (presetId: string) => void;
  loadConfiguration: (config: ScenarioDocument) => void;
  setIncludedOutputIds: (outputIds: string[] | undefined) => void;
}

function cloneConfiguration(configuration: ScenarioDocument): ScenarioDocument {
  return structuredClone(configuration);
}

function configurationsEqual(a: ScenarioDocument, b: ScenarioDocument): boolean {
  const normalize = (configuration: ScenarioDocument): unknown => {
    const clone = structuredClone(configuration);
    for (const control of Object.values(clone.service_controls ?? {})) {
      if (control?.disabled_state_ids) {
        control.disabled_state_ids = [...control.disabled_state_ids].sort();
      }
    }
    return JSON.stringify(clone, Object.keys(clone).sort());
  };
  return normalize(a) === normalize(b);
}

function normalizeDescription(description: string | undefined): string | undefined {
  return description?.trim() ? description : undefined;
}

function persistActiveConfigurationMeta(state: {
  activeConfigurationId: string | null;
  activeConfigurationReadonly: boolean;
  baseConfiguration: ScenarioDocument | null;
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

export const usePackageStore = create<PackageStore>((set, get) => {
  const pkg = loadPackage();
  const persistedDraft = loadPersistedScenarioDraft(pkg.appConfig);

  // Determine initial state: persisted draft → first builtin config → bare default
  let initialConfiguration: ScenarioDocument;
  let initialSource: ConfigurationDraftSource;
  let initialConfigId: string | null = null;
  let initialConfigReadonly = false;
  let initialBaseConfiguration: ScenarioDocument | null = null;
  let initialDirty = false;

  if (persistedDraft.scenario) {
    initialConfiguration = cloneConfiguration(persistedDraft.scenario);
    initialSource = 'local_draft';

    const restoredMeta = persistedDraft.configMeta;
    if (restoredMeta?.baseConfiguration) {
      initialConfigId = restoredMeta.activeConfigurationId;
      initialConfigReadonly = restoredMeta.activeConfigurationReadonly;
      initialBaseConfiguration = cloneConfiguration(restoredMeta.baseConfiguration);
      initialDirty =
        !configurationsEqual(initialConfiguration, restoredMeta.baseConfiguration);
    }
  } else {
    // No persisted draft — load the first builtin configuration as the default
    const builtins = loadBuiltinConfigurations();
    const defaultConfig = builtins.find((config) => getConfigurationId(config) === 'reference') ?? builtins[0];

    if (defaultConfig) {
      const defaultConfigId = getConfigurationId(defaultConfig) ?? defaultConfig.name;

      initialConfiguration = cloneConfiguration(defaultConfig);
      initialSource = 'configuration';
      initialConfigId = defaultConfigId;
      initialConfigReadonly = isReadonlyConfiguration(defaultConfig);
      initialBaseConfiguration = cloneConfiguration(initialConfiguration);

      persistScenarioDraft(initialConfiguration);
      persistConfigMeta({
        activeConfigurationId: defaultConfigId,
        activeConfigurationReadonly: initialConfigReadonly,
        baseConfiguration: cloneConfiguration(initialConfiguration),
      });
    } else {
      initialConfiguration = cloneConfiguration(pkg.defaultScenario);
      initialSource = 'reference';
    }
  }

  function commitConfigurationEdit(nextConfiguration: ScenarioDocument) {
    const state = get();
    const persistenceError = persistScenarioDraft(nextConfiguration);
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
      const nextConfiguration = cloneConfiguration(configuration);
      const persistenceError = persistScenarioDraft(nextConfiguration);
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
      const nextConfiguration = cloneConfiguration(get().defaultScenario);
      const persistenceError = clearPersistedScenarioDraft();
      persistConfigMeta(null);

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
    toggleStateEnabled: (outputId, stateId) => {
      const nextConfiguration = cloneConfiguration(get().currentConfiguration);

      const allStateIds = Array.from(
        new Set(
          get().sectorStates
            .filter((row) => row.service_or_output_name === outputId)
            .map((row) => row.state_id),
        ),
      );

      const enabled = new Set(getEnabledStateIds(nextConfiguration, outputId, allStateIds));

      if (enabled.has(stateId)) {
        enabled.delete(stateId);
      } else {
        enabled.add(stateId);
      }

      const enabledIds = allStateIds.filter((id) => enabled.has(id));
      const disabledStateIds = allStateIds.filter((id) => !enabled.has(id));

      const metadata = get().appConfig.output_roles[outputId];
      const allowed = new Set(metadata?.allowed_control_modes ?? []);

      const existing = nextConfiguration.service_controls[outputId] ?? {
        mode: 'optimize',
        disabled_state_ids: [],
      };

      const control: ScenarioServiceControl = {
        ...existing,
        disabled_state_ids: disabledStateIds.length > 0 ? disabledStateIds : [],
      };

      if (enabledIds.length === 0) {
        // All states disabled — preserve existing mode/state_id/fixed_shares
        // so they can be restored when the user re-enables a state.
        // If the current mode is 'off' (legacy), promote to a valid mode.
        if (control.mode === 'off') {
          const fallback = metadata?.default_control_mode;
          control.mode = fallback && fallback !== 'off' ? fallback : 'optimize';
        }
      } else if (enabledIds.length === 1) {
        if (allowed.has('pinned_single')) {
          control.mode = 'pinned_single';
          control.state_id = enabledIds[0];
          control.fixed_shares = null;
        } else if (allowed.has('fixed_shares')) {
          control.mode = 'fixed_shares';
          control.fixed_shares = { [enabledIds[0]]: 1 };
          control.state_id = null;
        } else {
          control.mode = metadata?.default_control_mode ?? 'optimize';
          control.state_id = null;
          control.fixed_shares = null;
        }
      } else {
        control.mode = allowed.has('optimize')
          ? 'optimize'
          : (metadata?.default_control_mode ?? 'optimize');
        control.state_id = null;
        if (control.mode !== 'fixed_shares') {
          control.fixed_shares = null;
        }
      }

      nextConfiguration.service_controls[outputId] = control;
      commitConfigurationEdit(nextConfiguration);
    },
    setOutputControlMode: (outputId, mode) => {
      const metadata = get().appConfig.output_roles[outputId];
      const allowed = metadata?.allowed_control_modes ?? [];
      if (allowed.length > 0 && !allowed.includes(mode)) {
        return;
      }

      const nextConfiguration = cloneConfiguration(get().currentConfiguration);

      const control: ScenarioServiceControl = nextConfiguration.service_controls[outputId] ?? {
        mode: 'optimize',
        disabled_state_ids: [],
      };

      nextConfiguration.service_controls[outputId] = { ...control, mode };
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
      commitConfigurationEdit(nextConfiguration);
    },
    loadConfiguration: (config) => {
      const nextConfiguration = cloneConfiguration(config);
      const baseConfiguration = cloneConfiguration(nextConfiguration);
      const configId = getConfigurationId(config) ?? config.name;
      const readonly = isReadonlyConfiguration(config);
      const persistenceError = persistScenarioDraft(nextConfiguration);

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
    setIncludedOutputIds: (outputIds) => {
      const state = get();
      const nextConfiguration = withSeedOutputIds(
        cloneConfiguration(state.currentConfiguration),
        outputIds,
      );
      commitConfigurationEdit(nextConfiguration);
    },
  };
});
