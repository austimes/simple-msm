import { create } from 'zustand';
import {
  clearPersistedConfigurationDraft,
  loadPersistedConfigurationDraft,
  persistConfigurationDraft,
} from './configurationDraftStorage';
import {
  cloneConfigurationDocument,
  getConfigurationId,
  withIncludedOutputIds,
} from './configurationLoader';
import { loadPackage } from './packageLoader';
import type {
  ConfigurationControlMode,
  ConfigurationDocument,
  ConfigurationServiceControl,
  PackageData,
  PriceLevel,
} from './types';

export type ConfigurationDraftSource = 'reference' | 'local_draft' | 'imported' | 'draft' | 'configuration';

interface PackageStore extends PackageData {
  loaded: boolean;
  currentConfiguration: ConfigurationDocument;
  currentConfigurationSource: ConfigurationDraftSource;
  activeConfigurationId: string | null;
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
  toggleStateEnabled: (outputId: string, stateId: string) => void;
  setOutputControlMode: (outputId: string, mode: ConfigurationControlMode) => void;
  setDemandPreset: (presetId: string) => void;
  loadConfiguration: (configuration: ConfigurationDocument) => void;
  setIncludedOutputIds: (outputIds: string[] | undefined) => void;
}

function cloneConfiguration(configuration: ConfigurationDocument): ConfigurationDocument {
  return cloneConfigurationDocument(configuration);
}

function detachSavedConfigurationIdentity(configuration: ConfigurationDocument): ConfigurationDocument {
  const draft = cloneConfiguration(configuration);

  if (!draft.app_metadata) {
    return draft;
  }

  const { included_output_ids } = draft.app_metadata;
  draft.app_metadata = included_output_ids ? { included_output_ids } : undefined;
  return draft;
}

function normalizeDescription(description: string | undefined): string | undefined {
  return description?.trim() ? description : undefined;
}

export const usePackageStore = create<PackageStore>((set, get) => {
  const pkg = loadPackage();
  const persistedDraft = loadPersistedConfigurationDraft(pkg.appConfig);
  const initialConfiguration = persistedDraft.configuration
    ? cloneConfiguration(persistedDraft.configuration)
    : cloneConfiguration(pkg.defaultConfiguration);

  function persistDraftConfiguration(
    configuration: ConfigurationDocument,
    source: ConfigurationDraftSource,
    notice?: string | null,
  ): void {
    const persistenceError = persistConfigurationDraft(configuration);

    set({
      currentConfiguration: configuration,
      currentConfigurationSource: source,
      activeConfigurationId: source === 'configuration' ? getConfigurationId(configuration) : null,
      ...(notice !== undefined ? { persistenceNotice: notice } : {}),
      persistenceError,
    });
  }

  return {
    ...pkg,
    loaded: true,
    currentConfiguration: initialConfiguration,
    currentConfigurationSource: persistedDraft.configuration ? 'local_draft' : 'reference',
    activeConfigurationId: null,
    persistenceNotice: persistedDraft.notice,
    persistenceError: persistedDraft.error,
    replaceCurrentConfiguration: (configuration, source = 'draft', notice = null) => {
      const nextConfiguration = source === 'configuration'
        ? cloneConfiguration(configuration)
        : detachSavedConfigurationIdentity(configuration);

      persistDraftConfiguration(
        nextConfiguration,
        source,
        notice ?? 'Configuration draft autosaved in this browser.',
      );
    },
    updateConfigurationMetadata: (updates) => {
      const nextConfiguration = detachSavedConfigurationIdentity(get().currentConfiguration);

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

      persistDraftConfiguration(
        nextConfiguration,
        'draft',
        'Configuration drafts autosave in this browser as you edit them.',
      );
    },
    resetCurrentConfiguration: () => {
      const nextConfiguration = cloneConfiguration(get().defaultConfiguration);
      const persistenceError = clearPersistedConfigurationDraft();

      set({
        currentConfiguration: nextConfiguration,
        currentConfigurationSource: 'reference',
        activeConfigurationId: null,
        persistenceNotice: 'Reset to the packaged reference configuration and cleared the local draft.',
        persistenceError,
      });
    },
    setCommodityPriceLevel: (commodityId, level) => {
      const nextConfiguration = detachSavedConfigurationIdentity(get().currentConfiguration);
      nextConfiguration.commodity_pricing.selections_by_commodity = {
        ...nextConfiguration.commodity_pricing.selections_by_commodity,
        [commodityId]: level,
      };
      delete nextConfiguration.commodity_pricing.overrides[commodityId];

      persistDraftConfiguration(nextConfiguration, 'draft');
    },
    setCarbonPricePreset: (presetId) => {
      const preset = get().appConfig.carbon_price_presets[presetId];
      if (!preset) {
        return;
      }

      const nextConfiguration = detachSavedConfigurationIdentity(get().currentConfiguration);
      nextConfiguration.carbon_price = { ...preset.values_by_year };

      persistDraftConfiguration(nextConfiguration, 'draft');
    },
    toggleStateEnabled: (outputId, stateId) => {
      const nextConfiguration = detachSavedConfigurationIdentity(get().currentConfiguration);

      let control: ConfigurationServiceControl = nextConfiguration.service_controls[outputId] ?? {
        mode: 'optimize',
        disabled_state_ids: [],
      };
      control = { ...control };

      const disabled = new Set(control.disabled_state_ids ?? []);

      if (disabled.has(stateId)) {
        disabled.delete(stateId);
      } else {
        disabled.add(stateId);
      }

      const allStateIds = new Set<string>();
      for (const row of get().sectorStates) {
        if (row.service_or_output_name === outputId) {
          allStateIds.add(row.state_id);
        }
      }

      const enabledIds = Array.from(allStateIds).filter((id) => !disabled.has(id));
      control.disabled_state_ids = disabled.size > 0 ? Array.from(disabled) : [];

      const metadata = get().appConfig.output_roles[outputId];
      const allowed = new Set(metadata?.allowed_control_modes ?? []);

      if (enabledIds.length === 0) {
        control.mode = 'off';
        control.state_id = null;
        control.fixed_shares = null;
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
      persistDraftConfiguration(nextConfiguration, 'draft');
    },
    setOutputControlMode: (outputId, mode) => {
      const metadata = get().appConfig.output_roles[outputId];
      const allowed = metadata?.allowed_control_modes ?? [];
      if (allowed.length > 0 && !allowed.includes(mode)) {
        return;
      }

      const nextConfiguration = detachSavedConfigurationIdentity(get().currentConfiguration);
      const control: ConfigurationServiceControl = nextConfiguration.service_controls[outputId] ?? {
        mode: 'optimize',
        disabled_state_ids: [],
      };

      nextConfiguration.service_controls[outputId] = { ...control, mode };
      persistDraftConfiguration(nextConfiguration, 'draft');
    },
    setDemandPreset: (presetId) => {
      const nextConfiguration = detachSavedConfigurationIdentity(get().currentConfiguration);
      nextConfiguration.demand_generation.preset_id = presetId;

      if (nextConfiguration.demand_generation.mode === 'manual_table') {
        nextConfiguration.demand_generation.mode = 'anchor_plus_preset';
      }

      nextConfiguration.demand_generation.service_growth_rates_pct_per_year = null;
      nextConfiguration.demand_generation.external_commodity_growth_rates_pct_per_year = null;

      persistDraftConfiguration(nextConfiguration, 'draft');
    },
    loadConfiguration: (configuration) => {
      const nextConfiguration = cloneConfiguration(configuration);

      persistDraftConfiguration(
        nextConfiguration,
        'configuration',
        `Loaded configuration "${nextConfiguration.name}".`,
      );
    },
    setIncludedOutputIds: (outputIds) => {
      const nextConfiguration = withIncludedOutputIds(
        detachSavedConfigurationIdentity(get().currentConfiguration),
        outputIds,
      );

      persistDraftConfiguration(nextConfiguration, 'draft');
    },
  };
});
