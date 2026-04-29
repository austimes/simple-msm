import { parseConfigurationDocument } from './configurationDocumentLoader.ts';
import type { AppConfigRegistry, ConfigurationDocument } from './types.ts';

export const CONFIGURATION_DRAFT_STORAGE_KEY = 'simple-msm.configuration-draft.v4';
export const CONFIG_META_STORAGE_KEY = 'simple-msm.config-meta.v3';

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

export interface ConfigurationDraftLoadResult {
  configuration: ConfigurationDocument | null;
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

export function loadPersistedConfigurationDraft(
  appConfig: AppConfigRegistry,
  storage?: StorageLike | null,
): ConfigurationDraftLoadResult {
  const resolvedStorage = resolveStorage(storage);

  if (!resolvedStorage) {
    return {
      configuration: null,
      configMeta: null,
      notice: 'Configuration documents stay in memory only when browser-local storage is unavailable.',
      error: null,
    };
  }

  let configurationRaw: string | null;

  try {
    configurationRaw = resolvedStorage.getItem(CONFIGURATION_DRAFT_STORAGE_KEY);
  } catch (error) {
    return {
      configuration: null,
      configMeta: null,
      notice: 'Configuration documents autosave in this browser when local storage is available.',
      error: formatStorageError('read', error),
    };
  }

  if (!configurationRaw) {
    return {
      configuration: null,
      configMeta: null,
      notice: 'Configuration documents autosave in this browser after you import or edit them.',
      error: null,
    };
  }

  try {
    const configuration = parseConfigurationDocument(
      configurationRaw,
      appConfig,
      'browser-local configuration document',
    );
    const configMeta = loadPersistedConfigMeta(resolvedStorage);
    return {
      configuration,
      configMeta,
      notice: 'Restored the most recent configuration document from this browser.',
      error: null,
    };
  } catch {
    try {
      resolvedStorage.removeItem(CONFIGURATION_DRAFT_STORAGE_KEY);
      resolvedStorage.removeItem(CONFIG_META_STORAGE_KEY);
    } catch {
      // Ignore cleanup errors and fall back to the packaged reference configuration.
    }

    return {
      configuration: null,
      configMeta: null,
      notice: 'Ignored an invalid saved document and fell back to the packaged reference configuration.',
      error: null,
    };
  }
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
    // Best-effort; config meta is non-critical.
  }
}

function loadPersistedConfigMeta(storage: StorageLike): PersistedConfigMeta | null {
  try {
    const raw = storage.getItem(CONFIG_META_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedConfigMeta;

    if (!parsed.activeConfigurationId || !parsed.baseConfiguration) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function clearPersistedConfigurationDraft(storage?: StorageLike | null): string | null {
  const resolvedStorage = resolveStorage(storage);

  if (!resolvedStorage) {
    return null;
  }

  try {
    resolvedStorage.removeItem(CONFIGURATION_DRAFT_STORAGE_KEY);
    resolvedStorage.removeItem(CONFIG_META_STORAGE_KEY);
    return null;
  } catch (error) {
    return formatStorageError('clear', error);
  }
}
