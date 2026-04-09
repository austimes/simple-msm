/**
 * Loads solve configurations from:
 * 1. Built-in configs shipped in src/configurations/ (readonly)
 * 2. User configs persisted to localStorage (editable)
 */
import { parseScenarioDocument } from './scenarioLoader';
import type { ScenarioDocument } from './types';

// --- Built-in configuration loading (Vite eager import) ---

const builtinConfigModules = import.meta.glob<string>(
  '/src/configurations/*.json',
  { eager: true, import: 'default', query: '?raw' },
);

function normalizeIncludedOutputIds(value: string[] | undefined): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = Array.from(
    new Set(value.filter((entry) => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)),
  );

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeConfigurationMetadata(configuration: ScenarioDocument): ScenarioDocument {
  const configurationWithoutMetadata = { ...configuration };
  delete configurationWithoutMetadata.app_metadata;

  const includedOutputIds = normalizeIncludedOutputIds(configuration.app_metadata?.included_output_ids);
  const id = configuration.app_metadata?.id?.trim() || undefined;
  const readonly = configuration.app_metadata?.readonly === true;

  const appMetadata = [id, readonly, includedOutputIds?.length].some(Boolean)
    ? {
        ...(id ? { id } : {}),
        ...(readonly ? { readonly: true } : {}),
        ...(includedOutputIds ? { included_output_ids: includedOutputIds } : {}),
      }
    : undefined;

  return {
    ...configurationWithoutMetadata,
    ...(appMetadata ? { app_metadata: appMetadata } : {}),
  };
}

function withConfigurationMetadata(
  configuration: ScenarioDocument,
  metadata: Partial<NonNullable<ScenarioDocument['app_metadata']>>,
): ScenarioDocument {
  return normalizeConfigurationMetadata({
    ...configuration,
    app_metadata: {
      ...(configuration.app_metadata ?? {}),
      ...metadata,
    },
  });
}

function parseConfigurationCollection(
  modules: Record<string, string>,
  readonly: boolean,
): ScenarioDocument[] {
  const configs: ScenarioDocument[] = [];

  for (const [path, raw] of Object.entries(modules)) {
    if (path.includes('_index.json')) continue;

    try {
      const parsed = parseScenarioDocument(raw, undefined, path);
      configs.push(withConfigurationMetadata(parsed, { readonly }));
    } catch {
      console.warn(`Failed to parse built-in configuration: ${path}`);
    }
  }

  return configs.sort((a, b) => a.name.localeCompare(b.name));
}

let cachedBuiltinConfigs: ScenarioDocument[] | null = null;

export function cloneConfigurationDocument(configuration: ScenarioDocument): ScenarioDocument {
  return structuredClone(configuration);
}

export function getConfigurationId(configuration: ScenarioDocument): string | null {
  return configuration.app_metadata?.id ?? null;
}

export function isReadonlyConfiguration(configuration: ScenarioDocument): boolean {
  return configuration.app_metadata?.readonly === true;
}

export function getIncludedOutputIds(configuration: ScenarioDocument): string[] | undefined {
  return normalizeIncludedOutputIds(configuration.app_metadata?.included_output_ids);
}

export function withIncludedOutputIds(
  configuration: ScenarioDocument,
  includedOutputIds: string[] | undefined,
): ScenarioDocument {
  return withConfigurationMetadata(configuration, { included_output_ids: includedOutputIds });
}

export function loadBuiltinConfigurations(): ScenarioDocument[] {
  if (!cachedBuiltinConfigs) {
    cachedBuiltinConfigs = parseConfigurationCollection(builtinConfigModules, true);
  }

  return cachedBuiltinConfigs;
}

// --- User configuration persistence (repo-backed via dev server API) ---

// Bundled user configs loaded at build time (for production / static builds)
const userConfigModules = import.meta.glob<string>(
  '/src/configurations/user/*.json',
  { eager: true, import: 'default', query: '?raw' },
);

export function loadUserConfigurations(): ScenarioDocument[] {
  return parseConfigurationCollection(userConfigModules, false);
}

export async function fetchUserConfigurations(): Promise<ScenarioDocument[]> {
  try {
    const res = await fetch('/api/user-configurations');
    if (!res.ok) return loadUserConfigurations();
    const configs = (await res.json()) as ScenarioDocument[];
    return configs.map((config) => withConfigurationMetadata(config, { readonly: false }));
  } catch {
    return loadUserConfigurations();
  }
}

export async function saveUserConfiguration(config: ScenarioDocument): Promise<string | null> {
  const toSave = withConfigurationMetadata(config, { readonly: false });
  try {
    const res = await fetch('/api/user-configurations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSave),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return (data as { error?: string }).error ?? 'Failed to save configuration.';
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Failed to save configuration.';
  }
}

export async function deleteUserConfiguration(configId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/user-configurations?id=${encodeURIComponent(configId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return (data as { error?: string }).error ?? 'Failed to delete configuration.';
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Failed to delete configuration.';
  }
}

// --- Combined loading ---

export function loadAllConfigurations(): ScenarioDocument[] {
  return [...loadBuiltinConfigurations(), ...loadUserConfigurations()];
}

export function findConfiguration(id: string): ScenarioDocument | null {
  return loadAllConfigurations().find((config) => getConfigurationId(config) === id) ?? null;
}

// --- Create configuration from current state ---

export function createConfigurationFromScenario(
  scenario: ScenarioDocument,
  includedOutputIds: string[] | undefined,
): ScenarioDocument {
  return withConfigurationMetadata(structuredClone(scenario), {
    id: slugifyConfigurationName(scenario.name),
    readonly: false,
    included_output_ids: includedOutputIds,
  });
}

export function slugifyConfigurationName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-+|-+$/g, '') || `config-${Date.now()}`
  );
}
