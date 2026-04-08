import { parseScenarioDocument } from './scenarioLoader';
import type { AppConfigRegistry, ScenarioDocument } from './types';

export const SCENARIO_DRAFT_STORAGE_KEY = 'simple-msm.scenario-draft.v2';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ScenarioDraftLoadResult {
  scenario: ScenarioDocument | null;
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
      notice: 'Scenario drafts autosave in this browser when local storage is available.',
      error: formatStorageError('read', error),
    };
  }

  if (!raw) {
    return {
      scenario: null,
      notice: 'Scenario drafts autosave in this browser after you import or edit them.',
      error: null,
    };
  }

  try {
    return {
      scenario: parseScenarioDocument(raw, appConfig, 'browser-local scenario draft'),
      notice: 'Restored the most recent scenario draft from this browser.',
      error: null,
    };
  } catch {
    try {
      resolvedStorage.removeItem(SCENARIO_DRAFT_STORAGE_KEY);
    } catch {
      // Ignore cleanup errors and fall back to the packaged reference scenario.
    }

    return {
      scenario: null,
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

export function clearPersistedScenarioDraft(storage?: StorageLike | null): string | null {
  const resolvedStorage = resolveStorage(storage);

  if (!resolvedStorage) {
    return null;
  }

  try {
    resolvedStorage.removeItem(SCENARIO_DRAFT_STORAGE_KEY);
    return null;
  } catch (error) {
    return formatStorageError('clear', error);
  }
}
