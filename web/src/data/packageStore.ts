import { create } from 'zustand';
import {
  clearPersistedScenarioDraft,
  loadPersistedScenarioDraft,
  persistScenarioDraft,
  persistConfigMeta,
} from './scenarioDraftStorage';
import { loadPackage } from './packageLoader';
import type { PackageData, PriceLevel, ScenarioControlMode, ScenarioDocument, ScenarioServiceControl } from './types';
import type { SolveConfiguration } from './configurationTypes';
import { applyConfigurationToScenario, loadBuiltinConfigurations } from './configurationLoader';
import { getEnabledStateIds } from './scenarioWorkspaceModel';

export type ScenarioDraftSource = 'reference' | 'local_draft' | 'imported' | 'draft' | 'configuration';

interface PackageStore extends PackageData {
  loaded: boolean;
  currentScenario: ScenarioDocument;
  currentScenarioSource: ScenarioDraftSource;
  activeConfigurationId: string | null;
  activeConfigurationReadonly: boolean;
  isConfigurationDirty: boolean;
  baseConfigurationScenario: ScenarioDocument | null;
  baseIncludedOutputIds: string[] | undefined;
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

function scenariosEqual(a: ScenarioDocument, b: ScenarioDocument): boolean {
  const normalize = (s: ScenarioDocument): unknown => {
    const clone = structuredClone(s);
    for (const control of Object.values(clone.service_controls ?? {})) {
      if (control?.disabled_state_ids) {
        control.disabled_state_ids = [...control.disabled_state_ids].sort();
      }
    }
    return JSON.stringify(clone, Object.keys(clone).sort());
  };
  return normalize(a) === normalize(b);
}

function includedOutputIdsEqual(
  a: string[] | undefined,
  b: string[] | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

function normalizeDescription(description: string | undefined): string | undefined {
  return description?.trim() ? description : undefined;
}

export const usePackageStore = create<PackageStore>((set, get) => {
  const pkg = loadPackage();
  const persistedDraft = loadPersistedScenarioDraft(pkg.appConfig);

  // Determine initial state: persisted draft → first builtin config → bare default
  let initialScenario: ScenarioDocument;
  let initialSource: ScenarioDraftSource;
  let initialConfigId: string | null = null;
  let initialConfigReadonly = false;
  let initialBaseScenario: ScenarioDocument | null = null;
  let initialBaseIncludedOutputIds: string[] | undefined;
  let initialIncludedOutputIds: string[] | undefined;
  let initialDirty = false;

  if (persistedDraft.scenario) {
    initialScenario = cloneScenario(persistedDraft.scenario);
    initialSource = 'local_draft';

    const restoredMeta = persistedDraft.configMeta;
    if (restoredMeta?.baseConfigurationScenario) {
      initialConfigId = restoredMeta.activeConfigurationId;
      initialConfigReadonly = restoredMeta.activeConfigurationReadonly;
      initialBaseScenario = cloneScenario(restoredMeta.baseConfigurationScenario);
      initialBaseIncludedOutputIds = restoredMeta.baseIncludedOutputIds;
      initialIncludedOutputIds = restoredMeta.includedOutputIds;
      initialDirty =
        !scenariosEqual(initialScenario, restoredMeta.baseConfigurationScenario) ||
        !includedOutputIdsEqual(restoredMeta.includedOutputIds, restoredMeta.baseIncludedOutputIds);
    }
  } else {
    // No persisted draft — load the first builtin configuration as the default
    const builtins = loadBuiltinConfigurations();
    const defaultConfig = builtins.find((c) => c.id === 'reference') ?? builtins[0];

    if (defaultConfig) {
      const { scenario, includedOutputIds } = applyConfigurationToScenario(
        defaultConfig,
        pkg.defaultScenario,
      );
      initialScenario = cloneScenario(scenario);
      initialSource = 'configuration';
      initialConfigId = defaultConfig.id;
      initialConfigReadonly = true;
      initialBaseScenario = cloneScenario(initialScenario);
      initialBaseIncludedOutputIds = includedOutputIds;
      initialIncludedOutputIds = includedOutputIds;

      persistScenarioDraft(initialScenario);
      persistConfigMeta({
        activeConfigurationId: defaultConfig.id,
        activeConfigurationReadonly: true,
        baseConfigurationScenario: cloneScenario(initialScenario),
        baseIncludedOutputIds: includedOutputIds,
        includedOutputIds,
      });
    } else {
      initialScenario = cloneScenario(pkg.defaultScenario);
      initialSource = 'reference';
    }
  }

  function commitScenarioEdit(nextScenario: ScenarioDocument) {
    const state = get();
    const persistenceError = persistScenarioDraft(nextScenario);
    const dirty = state.baseConfigurationScenario
      ? !scenariosEqual(nextScenario, state.baseConfigurationScenario) ||
        !includedOutputIdsEqual(state.includedOutputIds, state.baseIncludedOutputIds)
      : false;

    set({
      currentScenario: nextScenario,
      currentScenarioSource: 'draft',
      isConfigurationDirty: dirty,
      persistenceNotice: 'Scenario draft autosaves in this browser as you edit it.',
      persistenceError,
    });
  }

  return {
    ...pkg,
    loaded: true,
    currentScenario: initialScenario,
    currentScenarioSource: initialSource,
    activeConfigurationId: initialConfigId,
    activeConfigurationReadonly: initialConfigReadonly,
    isConfigurationDirty: initialDirty,
    baseConfigurationScenario: initialBaseScenario,
    baseIncludedOutputIds: initialBaseIncludedOutputIds,
    includedOutputIds: initialIncludedOutputIds,
    persistenceNotice: persistedDraft.notice,
    persistenceError: persistedDraft.error,
    replaceCurrentScenario: (scenario, source = 'draft', notice = null) => {
      const nextScenario = cloneScenario(scenario);
      const persistenceError = persistScenarioDraft(nextScenario);
      persistConfigMeta(null);

      set({
        currentScenario: nextScenario,
        currentScenarioSource: source,
        activeConfigurationId: null,
        activeConfigurationReadonly: false,
        baseConfigurationScenario: null,
        baseIncludedOutputIds: undefined,
        isConfigurationDirty: false,
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

      commitScenarioEdit(nextScenario);
    },
    resetCurrentScenario: () => {
      const nextScenario = cloneScenario(get().defaultScenario);
      const persistenceError = clearPersistedScenarioDraft();
      persistConfigMeta(null);

      set({
        currentScenario: nextScenario,
        currentScenarioSource: 'reference',
        activeConfigurationId: null,
        activeConfigurationReadonly: false,
        baseConfigurationScenario: null,
        baseIncludedOutputIds: undefined,
        isConfigurationDirty: false,
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
      commitScenarioEdit(nextScenario);
    },
    setCarbonPricePreset: (presetId) => {
      const preset = get().appConfig.carbon_price_presets[presetId];
      if (!preset) return;
      const nextScenario = cloneScenario(get().currentScenario);
      nextScenario.carbon_price = { ...preset.values_by_year };
      commitScenarioEdit(nextScenario);
    },
    toggleStateEnabled: (outputId, stateId) => {
      const nextScenario = cloneScenario(get().currentScenario);

      const allStateIds = Array.from(
        new Set(
          get().sectorStates
            .filter((row) => row.service_or_output_name === outputId)
            .map((row) => row.state_id),
        ),
      );

      const enabled = new Set(getEnabledStateIds(nextScenario, outputId, allStateIds));

      if (enabled.has(stateId)) {
        enabled.delete(stateId);
      } else {
        enabled.add(stateId);
      }

      const enabledIds = allStateIds.filter((id) => enabled.has(id));
      const disabledStateIds = allStateIds.filter((id) => !enabled.has(id));

      const metadata = get().appConfig.output_roles[outputId];
      const allowed = new Set(metadata?.allowed_control_modes ?? []);

      const existing = nextScenario.service_controls[outputId] ?? {
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

      nextScenario.service_controls[outputId] = control;
      commitScenarioEdit(nextScenario);
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
      commitScenarioEdit(nextScenario);
    },
    setDemandPreset: (presetId) => {
      const nextScenario = cloneScenario(get().currentScenario);
      nextScenario.demand_generation.preset_id = presetId;

      if (nextScenario.demand_generation.mode === 'manual_table') {
        nextScenario.demand_generation.mode = 'anchor_plus_preset';
      }

      nextScenario.demand_generation.service_growth_rates_pct_per_year = null;
      nextScenario.demand_generation.external_commodity_growth_rates_pct_per_year = null;
      commitScenarioEdit(nextScenario);
    },
    loadConfiguration: (config) => {
      const { scenario, includedOutputIds } = applyConfigurationToScenario(
        config,
        get().defaultScenario,
      );
      const nextScenario = cloneScenario(scenario);
      const baseScenario = cloneScenario(nextScenario);
      const persistenceError = persistScenarioDraft(nextScenario);

      persistConfigMeta({
        activeConfigurationId: config.id,
        activeConfigurationReadonly: config.readonly,
        baseConfigurationScenario: baseScenario,
        baseIncludedOutputIds: includedOutputIds,
        includedOutputIds,
      });

      set({
        currentScenario: nextScenario,
        currentScenarioSource: 'configuration',
        activeConfigurationId: config.id,
        activeConfigurationReadonly: config.readonly,
        baseConfigurationScenario: cloneScenario(baseScenario),
        baseIncludedOutputIds: includedOutputIds,
        isConfigurationDirty: false,
        includedOutputIds,
        persistenceNotice: `Loaded configuration "${config.name}".`,
        persistenceError,
      });
    },
    setIncludedOutputIds: (outputIds) => {
      const state = get();
      const dirty = state.baseConfigurationScenario
        ? !scenariosEqual(state.currentScenario, state.baseConfigurationScenario) ||
          !includedOutputIdsEqual(outputIds, state.baseIncludedOutputIds)
        : false;
      set({ includedOutputIds: outputIds, isConfigurationDirty: dirty });
    },
  };
});
