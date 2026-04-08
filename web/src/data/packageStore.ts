import { create } from 'zustand';
import {
  clearPersistedScenarioDraft,
  loadPersistedScenarioDraft,
  persistScenarioDraft,
} from './scenarioDraftStorage';
import { loadPackage } from './packageLoader';
import type { PackageData, ScenarioControlMode, ScenarioDocument, ScenarioServiceControl } from './types';

export type ScenarioDraftSource = 'reference' | 'local_draft' | 'imported' | 'draft';

interface PackageStore extends PackageData {
  loaded: boolean;
  currentScenario: ScenarioDocument;
  currentScenarioSource: ScenarioDraftSource;
  persistenceNotice: string | null;
  persistenceError: string | null;
  replaceCurrentScenario: (
    scenario: ScenarioDocument,
    source?: Exclude<ScenarioDraftSource, 'reference'>,
    notice?: string | null,
  ) => void;
  updateScenarioMetadata: (updates: { name?: string; description?: string }) => void;
  resetCurrentScenario: () => void;
  setCommodityPricePreset: (presetId: string) => void;
  toggleStateEnabled: (outputId: string, stateId: string) => void;
  setOutputControlMode: (outputId: string, mode: ScenarioControlMode) => void;
  setDemandPreset: (presetId: string) => void;
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
        persistenceNotice: 'Reset to the packaged reference scenario and cleared the local draft.',
        persistenceError,
      });
    },
    setCommodityPricePreset: (presetId) => {
      const nextScenario = cloneScenario(get().currentScenario);
      nextScenario.commodity_pricing.preset_id = presetId;
      nextScenario.commodity_pricing.overrides = {};
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

      if (enabledIds.length === 1) {
        control.mode = 'pinned_single';
        control.state_id = enabledIds[0];
      } else {
        control.mode = 'optimize';
        control.state_id = null;
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
  };
});
