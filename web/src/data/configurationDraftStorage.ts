import { parseConfigurationDocument } from './configurationLoader';
import type { AppConfigRegistry, ConfigurationDocument } from './types';

export const CONFIGURATION_DRAFT_STORAGE_KEY = 'simple-msm.configuration-draft.v3';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ConfigurationDraftLoadResult {
  configuration: ConfigurationDocument | null;
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
  return `Could not ${action} the browser-local configuration draft: ${detail}`;
}

export function loadPersistedConfigurationDraft(
  appConfig: AppConfigRegistry,
  storage?: StorageLike | null,
): ConfigurationDraftLoadResult {
  const resolvedStorage = resolveStorage(storage);

  if (!resolvedStorage) {
    return {
      configuration: null,
      notice: 'Configuration drafts stay in memory only when browser-local storage is unavailable.',
      error: null,
    };
  }

  let raw: string | null;

  try {
    raw = resolvedStorage.getItem(CONFIGURATION_DRAFT_STORAGE_KEY);
  } catch (error) {
    return {
      configuration: null,
      notice: 'Configuration drafts autosave in this browser when local storage is available.',
      error: formatStorageError('read', error),
    };
  }

  if (!raw) {
    return {
      configuration: null,
      notice: 'Configuration drafts autosave in this browser after you import or edit them.',
      error: null,
    };
  }

  try {
    return {
      configuration: parseConfigurationDocument(raw, appConfig, 'browser-local configuration draft'),
      notice: 'Restored the most recent configuration draft from this browser.',
      error: null,
    };
  } catch {
    try {
      resolvedStorage.removeItem(CONFIGURATION_DRAFT_STORAGE_KEY);
    } catch {
      // Ignore cleanup errors and fall back to the packaged reference configuration.
    }

    return {
      configuration: null,
      notice: 'Ignored an invalid saved draft and fell back to the packaged reference configuration.',
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

export function clearPersistedConfigurationDraft(storage?: StorageLike | null): string | null {
  const resolvedStorage = resolveStorage(storage);

  if (!resolvedStorage) {
    return null;
  }

  try {
    resolvedStorage.removeItem(CONFIGURATION_DRAFT_STORAGE_KEY);
    return null;
  } catch (error) {
    return formatStorageError('clear', error);
  }
}
