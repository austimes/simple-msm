import { parseScenarioDocument } from './scenarioLoader';
import type { AppConfigRegistry, ScenarioDocument } from './types';
import { withIncludedOutputIds } from './configurationLoader';

export const SCENARIO_DRAFT_STORAGE_KEY = 'simple-msm.scenario-draft.v2';
export const CONFIG_META_STORAGE_KEY = 'simple-msm.config-meta.v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PersistedConfigMeta {
  activeConfigurationId: string;
  activeConfigurationReadonly: boolean;
  baseConfiguration: ScenarioDocument;
}

interface LegacyPersistedConfigMeta {
  activeConfigurationId: string;
  activeConfigurationReadonly: boolean;
  baseConfigurationScenario: ScenarioDocument;
  baseIncludedOutputIds?: string[];
}

export interface ScenarioDraftLoadResult {
  scenario: ScenarioDocument | null;
  configMeta: PersistedConfigMeta | null;
  notice: string | null;
  error: string | null;
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function resolveStorage(storage: StorageLike | null | undefined): StorageLike | null {
  if (storage !== undefined) {
    return storage;
  }

  return getBrowserStorage();
}

function formatStorageError(action: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : 'Unknown browser storage failure.';
  return `Could not ${action} the browser-local scenario draft: ${detail}`;
}

export function loadPersistedScenarioDraft(
  appConfig: AppConfigRegistry,
  storage?: StorageLike | null,
): ScenarioDraftLoadResult {
  const resolvedStorage = resolveStorage(storage);

  if (!resolvedStorage) {
    return {
      scenario: null,
      configMeta: null,
      notice: 'Scenario drafts stay in memory only when browser-local storage is unavailable.',
      error: null,
    };
  }

  let raw: string | null;

  try {
    raw = resolvedStorage.getItem(SCENARIO_DRAFT_STORAGE_KEY);
  } catch (error) {
    return {
      scenario: null,
      configMeta: null,
      notice: 'Scenario drafts autosave in this browser when local storage is available.',
      error: formatStorageError('read', error),
    };
  }

  if (!raw) {
    return {
      scenario: null,
      configMeta: null,
      notice: 'Scenario drafts autosave in this browser after you import or edit them.',
      error: null,
    };
  }

  try {
    const scenario = parseScenarioDocument(raw, appConfig, 'browser-local scenario draft');
    const configMeta = loadPersistedConfigMeta(resolvedStorage);
    return {
      scenario,
      configMeta,
      notice: 'Restored the most recent scenario draft from this browser.',
      error: null,
    };
  } catch {
    try {
      resolvedStorage.removeItem(SCENARIO_DRAFT_STORAGE_KEY);
      resolvedStorage.removeItem(CONFIG_META_STORAGE_KEY);
    } catch {
      // Ignore cleanup errors and fall back to the packaged reference scenario.
    }

    return {
      scenario: null,
      configMeta: null,
      notice: 'Ignored an invalid saved draft and fell back to the packaged reference scenario.',
      error: null,
    };
  }
}

export function persistScenarioDraft(
  scenario: ScenarioDocument,
  storage?: StorageLike | null,
): string | null {
  const resolvedStorage = resolveStorage(storage);

  if (!resolvedStorage) {
    return null;
  }

  try {
    resolvedStorage.setItem(SCENARIO_DRAFT_STORAGE_KEY, JSON.stringify(scenario));
    return null;
  } catch (error) {
    return formatStorageError('save', error);
  }
}

export function persistConfigMeta(
  meta: PersistedConfigMeta | null,
  storage?: StorageLike | null,
): void {
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) return;

  try {
    if (meta) {
      resolvedStorage.setItem(CONFIG_META_STORAGE_KEY, JSON.stringify(meta));
    } else {
      resolvedStorage.removeItem(CONFIG_META_STORAGE_KEY);
    }
  } catch {
    // Best-effort; config meta is non-critical
  }
}

function loadPersistedConfigMeta(
  storage: StorageLike,
): PersistedConfigMeta | null {
  try {
    const raw = storage.getItem(CONFIG_META_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedConfigMeta | LegacyPersistedConfigMeta;

    if (!parsed.activeConfigurationId) {
      return null;
    }

    if ('baseConfiguration' in parsed && parsed.baseConfiguration) {
      return parsed;
    }

    if ('baseConfigurationScenario' in parsed && parsed.baseConfigurationScenario) {
      return {
        activeConfigurationId: parsed.activeConfigurationId,
        activeConfigurationReadonly: parsed.activeConfigurationReadonly,
        baseConfiguration: withIncludedOutputIds(
          structuredClone(parsed.baseConfigurationScenario),
          parsed.baseIncludedOutputIds,
        ),
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function clearPersistedScenarioDraft(storage?: StorageLike | null): string | null {
  const resolvedStorage = resolveStorage(storage);

  if (!resolvedStorage) {
    return null;
  }

  try {
    resolvedStorage.removeItem(SCENARIO_DRAFT_STORAGE_KEY);
    resolvedStorage.removeItem(CONFIG_META_STORAGE_KEY);
    return null;
  } catch (error) {
    return formatStorageError('clear', error);
  }
}
