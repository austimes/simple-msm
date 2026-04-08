import { create } from 'zustand';
import {
  clearPersistedScenarioDraft,
  loadPersistedScenarioDraft,
  persistScenarioDraft,
} from './scenarioDraftStorage';
import { loadPackage } from './packageLoader';
import type { PackageData, PriceLevel, ScenarioControlMode, ScenarioDocument, ScenarioServiceControl } from './types';
import type { SolveConfiguration } from './configurationTypes';
import { applyConfigurationToScenario } from './configurationLoader';

export type ScenarioDraftSource = 'reference' | 'local_draft' | 'imported' | 'draft' | 'configuration';

interface PackageStore extends PackageData {
  loaded: boolean;
  currentScenario: ScenarioDocument;
  currentScenarioSource: ScenarioDraftSource;
  activeConfigurationId: string | null;
  includedOutputIds: string[] | undefined;
  persistenceNotice: string | null;
  persistenceError: string | null;
  replaceCurrentScenario: (
    scenario: ScenarioDocument,
    source?: Exclude<ScenarioDraftSource, 'reference'>,
    notice?: string | null,
  ) => void;
  updateScenarioMetadata: (updates: { name?: string; description?: string }) => void;
  resetCurrentScenario: () => void;
  setCommodityPriceLevel: (commodityId: string, level: PriceLevel) => void;
  setCarbonPricePreset: (presetId: string) => void;
  toggleStateEnabled: (outputId: string, stateId: string) => void;
  setOutputControlMode: (outputId: string, mode: ScenarioControlMode) => void;
  setDemandPreset: (presetId: string) => void;
  loadConfiguration: (config: SolveConfiguration) => void;
  setIncludedOutputIds: (outputIds: string[] | undefined) => void;
}

function cloneScenario(scenario: ScenarioDocument): ScenarioDocument {
  return structuredClone(scenario);
}

function normalizeDescription(description: string | undefined): string | undefined {
  return description?.trim() ? description : undefined;
}

export const usePackageStore = create<PackageStore>((set, get) => {
  const pkg = loadPackage();
  const persistedDraft = loadPersistedScenarioDraft(pkg.appConfig);
  const initialScenario = persistedDraft.scenario
    ? cloneScenario(persistedDraft.scenario)
    : cloneScenario(pkg.defaultScenario);

  return {
    ...pkg,
    loaded: true,
    currentScenario: initialScenario,
    currentScenarioSource: persistedDraft.scenario ? 'local_draft' : 'reference',
    activeConfigurationId: null,
    includedOutputIds: undefined,
    persistenceNotice: persistedDraft.notice,
    persistenceError: persistedDraft.error,
    replaceCurrentScenario: (scenario, source = 'draft', notice = null) => {
      const nextScenario = cloneScenario(scenario);
      const persistenceError = persistScenarioDraft(nextScenario);

      set({
        currentScenario: nextScenario,
        currentScenarioSource: source,
        persistenceNotice: notice ?? 'Scenario draft autosaved in this browser.',
        persistenceError,
      });
    },
    updateScenarioMetadata: (updates) => {
      const nextScenario = cloneScenario(get().currentScenario);

      if (updates.name !== undefined) {
        nextScenario.name = updates.name;
      }

      if (updates.description !== undefined) {
        const description = normalizeDescription(updates.description);

        if (description) {
          nextScenario.description = description;
        } else {
          delete nextScenario.description;
        }
      }

      const persistenceError = persistScenarioDraft(nextScenario);

      set({
        currentScenario: nextScenario,
        currentScenarioSource: 'draft',
        persistenceNotice: 'Scenario draft autosaves in this browser as you edit it.',
        persistenceError,
      });
    },
    resetCurrentScenario: () => {
      const nextScenario = cloneScenario(get().defaultScenario);
      const persistenceError = clearPersistedScenarioDraft();

      set({
        currentScenario: nextScenario,
        currentScenarioSource: 'reference',
        activeConfigurationId: null,
        includedOutputIds: undefined,
        persistenceNotice: 'Reset to the packaged reference scenario and cleared the local draft.',
        persistenceError,
      });
    },
    setCommodityPriceLevel: (commodityId, level) => {
      const nextScenario = cloneScenario(get().currentScenario);
      nextScenario.commodity_pricing.selections_by_commodity = {
        ...nextScenario.commodity_pricing.selections_by_commodity,
        [commodityId]: level,
      };
      delete nextScenario.commodity_pricing.overrides[commodityId];
      const persistenceError = persistScenarioDraft(nextScenario);

      set({
        currentScenario: nextScenario,
        currentScenarioSource: 'draft',
        persistenceError,
      });
    },
    setCarbonPricePreset: (presetId) => {
      const preset = get().appConfig.carbon_price_presets[presetId];
      if (!preset) return;
      const nextScenario = cloneScenario(get().currentScenario);
      nextScenario.carbon_price = { ...preset.values_by_year };
      const persistenceError = persistScenarioDraft(nextScenario);

      set({
        currentScenario: nextScenario,
        currentScenarioSource: 'draft',
        persistenceError,
      });
    },
    toggleStateEnabled: (outputId, stateId) => {
      const nextScenario = cloneScenario(get().currentScenario);

      let control: ScenarioServiceControl = nextScenario.service_controls[outputId] ?? {
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

      // Collect all state IDs for this output from sector states
      const allStateIds = new Set<string>();
      for (const row of get().sectorStates) {
        if (row.service_or_output_name === outputId) {
          allStateIds.add(row.state_id);
        }
      }

      const enabledIds = Array.from(allStateIds).filter((id) => !disabled.has(id));

      if (enabledIds.length === 0) {
        return;
      }

      control.disabled_state_ids = disabled.size > 0 ? Array.from(disabled) : [];

      const metadata = get().appConfig.output_roles[outputId];
      const allowed = new Set(metadata?.allowed_control_modes ?? []);

      if (enabledIds.length === 1) {
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
        if (allowed.has('optimize')) {
          control.mode = 'optimize';
        } else {
          control.mode = metadata?.default_control_mode ?? 'optimize';
        }
        control.state_id = null;
        if (control.mode !== 'fixed_shares') {
          control.fixed_shares = null;
        }
      }

      nextScenario.service_controls[outputId] = control;
      const persistenceError = persistScenarioDraft(nextScenario);

      set({
        currentScenario: nextScenario,
        currentScenarioSource: 'draft',
        persistenceError,
      });
    },
    setOutputControlMode: (outputId, mode) => {
      const metadata = get().appConfig.output_roles[outputId];
      const allowed = metadata?.allowed_control_modes ?? [];
      if (allowed.length > 0 && !allowed.includes(mode)) {
        return;
      }

      const nextScenario = cloneScenario(get().currentScenario);

      const control: ScenarioServiceControl = nextScenario.service_controls[outputId] ?? {
        mode: 'optimize',
        disabled_state_ids: [],
      };

      nextScenario.service_controls[outputId] = { ...control, mode };
      const persistenceError = persistScenarioDraft(nextScenario);

      set({
        currentScenario: nextScenario,
        currentScenarioSource: 'draft',
        persistenceError,
      });
    },
    setDemandPreset: (presetId) => {
      const nextScenario = cloneScenario(get().currentScenario);
      nextScenario.demand_generation.preset_id = presetId;

      if (nextScenario.demand_generation.mode === 'manual_table') {
        nextScenario.demand_generation.mode = 'anchor_plus_preset';
      }

      nextScenario.demand_generation.service_growth_rates_pct_per_year = null;
      nextScenario.demand_generation.external_commodity_growth_rates_pct_per_year = null;
      const persistenceError = persistScenarioDraft(nextScenario);

      set({
        currentScenario: nextScenario,
        currentScenarioSource: 'draft',
        persistenceError,
      });
    },
    loadConfiguration: (config) => {
      const { scenario, includedOutputIds } = applyConfigurationToScenario(
        config,
        get().defaultScenario,
      );
      const nextScenario = cloneScenario(scenario);
      const persistenceError = persistScenarioDraft(nextScenario);

      set({
        currentScenario: nextScenario,
        currentScenarioSource: 'configuration',
        activeConfigurationId: config.id,
        includedOutputIds,
        persistenceNotice: `Loaded configuration "${config.name}".`,
        persistenceError,
      });
    },
    setIncludedOutputIds: (outputIds) => {
      set({ includedOutputIds: outputIds });
    },
  };
});
