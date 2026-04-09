/**
 * Loads full configuration documents from:
 * 1. Built-in configs shipped in src/configurations/ (readonly)
 * 2. User configs persisted to localStorage (editable)
 */
import { parseScenarioDocument } from './scenarioLoader';
import { normalizeSeedOutputIds } from './configurationMetadata';
import type { ScenarioDocument } from './types';

export { getIncludedOutputIds, getSeedOutputIds } from './configurationMetadata';

// --- Built-in configuration loading (Vite eager import) ---

const builtinConfigModules = import.meta.glob<string>(
  '/src/configurations/*.json',
  { eager: true, import: 'default', query: '?raw' },
);

function normalizeConfigurationMetadata(configuration: ScenarioDocument): ScenarioDocument {
  const configurationWithoutMetadata = { ...configuration };
  delete configurationWithoutMetadata.app_metadata;

  const seedOutputIds = normalizeSeedOutputIds(
    configuration.app_metadata?.seed_output_ids
    ?? configuration.app_metadata?.included_output_ids,
  );
  const id = configuration.app_metadata?.id?.trim() || undefined;
  const readonly = configuration.app_metadata?.readonly === true;

  const appMetadata = [id, readonly, seedOutputIds?.length].some(Boolean)
    ? {
        ...(id ? { id } : {}),
        ...(readonly ? { readonly: true } : {}),
        ...(seedOutputIds ? { seed_output_ids: seedOutputIds } : {}),
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

export function parseConfigurationCollection(
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
      console.warn(`Failed to parse configuration document: ${path}`);
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

export function withIncludedOutputIds(
  configuration: ScenarioDocument,
  includedOutputIds: string[] | undefined,
): ScenarioDocument {
  return withSeedOutputIds(configuration, includedOutputIds);
}

export function withSeedOutputIds(
  configuration: ScenarioDocument,
  seedOutputIds: string[] | undefined,
): ScenarioDocument {
  return withConfigurationMetadata(configuration, { seed_output_ids: seedOutputIds });
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
  seedOutputIds: string[] | undefined,
): ScenarioDocument {
  return withConfigurationMetadata(structuredClone(scenario), {
    id: slugifyConfigurationName(scenario.name),
    readonly: false,
    seed_output_ids: seedOutputIds,
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
