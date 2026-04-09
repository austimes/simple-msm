import { parseConfigurationDocument } from './scenarioLoader.ts';
import type { AppConfigRegistry, ConfigurationDocument } from './types.ts';
import { withSeedOutputIds } from './configurationLoader.ts';

export const CONFIGURATION_DRAFT_STORAGE_KEY = 'simple-msm.configuration-draft.v2';
export const LEGACY_SCENARIO_DRAFT_STORAGE_KEY = 'simple-msm.scenario-draft.v2';
export const CONFIG_META_STORAGE_KEY = 'simple-msm.config-meta.v1';
export const SCENARIO_DRAFT_STORAGE_KEY = LEGACY_SCENARIO_DRAFT_STORAGE_KEY;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PersistedConfigMeta {
  activeConfigurationId: string;
  activeConfigurationReadonly: boolean;
  baseConfiguration: ConfigurationDocument;
}

interface LegacyPersistedConfigMeta {
  activeConfigurationId: string;
  activeConfigurationReadonly: boolean;
  // Read-only compatibility shim for older browser-local metadata.
  baseConfigurationScenario: ConfigurationDocument;
  baseIncludedOutputIds?: string[];
}

export interface ConfigurationDraftLoadResult {
  configuration: ConfigurationDocument | null;
  // Backward-compatible alias for older callers.
  scenario: ConfigurationDocument | null;
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
  return `Could not ${action} the browser-local configuration document: ${detail}`;
}

function promoteLegacyDraftStorage(
  storage: StorageLike,
  configuration: ConfigurationDocument,
  source: 'configuration' | 'scenario',
): void {
  try {
    if (source === 'scenario') {
      storage.setItem(CONFIGURATION_DRAFT_STORAGE_KEY, JSON.stringify(configuration));
    }
    storage.removeItem(LEGACY_SCENARIO_DRAFT_STORAGE_KEY);
  } catch {
    // Keep the legacy key if migration fails; the restored draft is still usable in-memory.
  }
}

export function loadPersistedConfigurationDraft(
  appConfig: AppConfigRegistry,
  storage?: StorageLike | null,
): ConfigurationDraftLoadResult {
  const resolvedStorage = resolveStorage(storage);

  if (!resolvedStorage) {
    return {
      configuration: null,
      scenario: null,
      configMeta: null,
      notice: 'Configuration documents stay in memory only when browser-local storage is unavailable.',
      error: null,
    };
  }

  let configurationRaw: string | null;
  let legacyScenarioRaw: string | null;

  try {
    configurationRaw = resolvedStorage.getItem(CONFIGURATION_DRAFT_STORAGE_KEY);
    legacyScenarioRaw = resolvedStorage.getItem(LEGACY_SCENARIO_DRAFT_STORAGE_KEY);
  } catch (error) {
    return {
      configuration: null,
      scenario: null,
      configMeta: null,
      notice: 'Configuration documents autosave in this browser when local storage is available.',
      error: formatStorageError('read', error),
    };
  }

  if (!configurationRaw && !legacyScenarioRaw) {
    return {
      configuration: null,
      scenario: null,
      configMeta: null,
      notice: 'Configuration documents autosave in this browser after you import or edit them.',
      error: null,
    };
  }

  const draftCandidates = [
    { raw: configurationRaw, source: 'configuration' as const },
    { raw: legacyScenarioRaw, source: 'scenario' as const },
  ];

  for (const candidate of draftCandidates) {
    if (!candidate.raw) {
      continue;
    }

    try {
      const configuration = parseConfigurationDocument(
        candidate.raw,
        appConfig,
        'browser-local configuration document',
      );
      const configMeta = loadPersistedConfigMeta(resolvedStorage);
      promoteLegacyDraftStorage(resolvedStorage, configuration, candidate.source);
      return {
        configuration,
        scenario: configuration,
        configMeta,
        notice: 'Restored the most recent configuration document from this browser.',
        error: null,
      };
    } catch {
      continue;
    }
  }

  try {
    resolvedStorage.removeItem(CONFIGURATION_DRAFT_STORAGE_KEY);
    resolvedStorage.removeItem(LEGACY_SCENARIO_DRAFT_STORAGE_KEY);
    resolvedStorage.removeItem(CONFIG_META_STORAGE_KEY);
  } catch {
    // Ignore cleanup errors and fall back to the packaged reference configuration.
  }

  return {
    configuration: null,
    scenario: null,
    configMeta: null,
    notice: 'Ignored an invalid saved document and fell back to the packaged reference configuration.',
    error: null,
  };
}

export function persistConfigurationDraft(
  configuration: ConfigurationDocument,
  storage?: StorageLike | null,
): string | null {
  const resolvedStorage = resolveStorage(storage);

  if (!resolvedStorage) {
    return null;
  }

  try {
    resolvedStorage.setItem(CONFIGURATION_DRAFT_STORAGE_KEY, JSON.stringify(configuration));
    resolvedStorage.removeItem(LEGACY_SCENARIO_DRAFT_STORAGE_KEY);
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
        baseConfiguration: withSeedOutputIds(
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
  return clearPersistedConfigurationDraft(storage);
}

export function clearPersistedConfigurationDraft(storage?: StorageLike | null): string | null {
  const resolvedStorage = resolveStorage(storage);

  if (!resolvedStorage) {
    return null;
  }

  try {
    resolvedStorage.removeItem(CONFIGURATION_DRAFT_STORAGE_KEY);
    resolvedStorage.removeItem(LEGACY_SCENARIO_DRAFT_STORAGE_KEY);
    resolvedStorage.removeItem(CONFIG_META_STORAGE_KEY);
    return null;
  } catch (error) {
    return formatStorageError('clear', error);
  }
}

export const loadPersistedScenarioDraft = loadPersistedConfigurationDraft;
export const persistScenarioDraft = persistConfigurationDraft;
export type ScenarioDraftLoadResult = ConfigurationDraftLoadResult;
