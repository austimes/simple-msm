import { create } from 'zustand';
import {
  clearPersistedScenarioDraft,
  loadPersistedScenarioDraft,
  persistScenarioDraft,
} from './scenarioDraftStorage';
import { loadPackage } from './packageLoader';
import type { PackageData, ScenarioDocument } from './types';

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
  };
});
