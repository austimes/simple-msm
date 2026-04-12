/**
 * Loads full configuration documents from:
 * 1. Built-in configs shipped in src/configurations/ (readonly)
 * 2. User configs persisted to localStorage (editable)
 */
import { parseConfigurationDocument } from './configurationDocumentLoader.ts';
import {
  getConfigurationDocumentId,
  normalizeSeedOutputIds,
} from './configurationMetadata.ts';
import type { ConfigurationDocument } from './types.ts';

export { getIncludedOutputIds, getSeedOutputIds } from './configurationMetadata.ts';

// --- Built-in configuration loading (Vite eager import) ---

const builtinConfigModules = import.meta.glob<string>(
  '/src/configurations/*.json',
  { eager: true, import: 'default', query: '?raw' },
);

interface ConfigurationCollectionEntry {
  source: string;
  configuration: ConfigurationDocument;
}

function normalizeConfigurationMetadata(configuration: ConfigurationDocument): ConfigurationDocument {
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
  configuration: ConfigurationDocument,
  metadata: Partial<NonNullable<ConfigurationDocument['app_metadata']>>,
): ConfigurationDocument {
  return normalizeConfigurationMetadata({
    ...configuration,
    app_metadata: {
      ...(configuration.app_metadata ?? {}),
      ...metadata,
    },
  });
}

function isCanonicalConfigurationSource(source: string, id: string | undefined): boolean {
  if (!id) {
    return false;
  }

  const filename = source.split('/').pop()?.toLowerCase();
  return filename === `${id.toLowerCase()}.json`;
}

function dedupeConfigurationEntries(
  entries: ConfigurationCollectionEntry[],
): ConfigurationDocument[] {
  const deduped = new Map<string, ConfigurationCollectionEntry>();

  for (const entry of entries) {
    const id = entry.configuration.app_metadata?.id;
    const key = id ? `id:${id}` : `source:${entry.source}`;
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, entry);
      continue;
    }

    const candidateIsCanonical = isCanonicalConfigurationSource(entry.source, id);
    const existingIsCanonical = isCanonicalConfigurationSource(existing.source, id);

    if (candidateIsCanonical && !existingIsCanonical) {
      deduped.set(key, entry);
    }
  }

  return Array.from(deduped.values())
    .map((entry) => entry.configuration)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function parseConfigurationCollection(
  modules: Record<string, string>,
  readonly: boolean,
): ConfigurationDocument[] {
  const entries: ConfigurationCollectionEntry[] = [];

  for (const [path, raw] of Object.entries(modules)) {
    if (path.includes('_index.json')) continue;

    try {
      const parsed = parseConfigurationDocument(raw, undefined, path);
      entries.push({
        source: path,
        configuration: withConfigurationMetadata(parsed, { readonly }),
      });
    } catch {
      console.warn(`Failed to parse configuration document: ${path}`);
    }
  }

  return dedupeConfigurationEntries(entries);
}

let cachedBuiltinConfigs: ConfigurationDocument[] | null = null;

export function cloneConfigurationDocument(configuration: ConfigurationDocument): ConfigurationDocument {
  return structuredClone(configuration);
}

export function getConfigurationId(configuration: ConfigurationDocument): string | null {
  return getConfigurationDocumentId(configuration);
}

export function isReadonlyConfiguration(configuration: ConfigurationDocument): boolean {
  return configuration.app_metadata?.readonly === true;
}

export function withIncludedOutputIds(
  configuration: ConfigurationDocument,
  includedOutputIds: string[] | undefined,
): ConfigurationDocument {
  return withSeedOutputIds(configuration, includedOutputIds);
}

export function withSeedOutputIds(
  configuration: ConfigurationDocument,
  seedOutputIds: string[] | undefined,
): ConfigurationDocument {
  return withConfigurationMetadata(configuration, { seed_output_ids: seedOutputIds });
}

export function loadBuiltinConfigurations(): ConfigurationDocument[] {
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

export function loadUserConfigurations(): ConfigurationDocument[] {
  return parseConfigurationCollection(userConfigModules, false);
}

export async function fetchUserConfigurations(): Promise<ConfigurationDocument[]> {
  try {
    const res = await fetch('/api/user-configurations');
    if (!res.ok) return loadUserConfigurations();
    const configs = (await res.json()) as ConfigurationDocument[];
    return dedupeConfigurationEntries(
      configs.map((config, index) => ({
        source: `remote:${index}`,
        configuration: withConfigurationMetadata(config, { readonly: false }),
      })),
    );
  } catch {
    return loadUserConfigurations();
  }
}

export async function saveUserConfiguration(config: ConfigurationDocument): Promise<string | null> {
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

export function loadAllConfigurations(): ConfigurationDocument[] {
  return [...loadBuiltinConfigurations(), ...loadUserConfigurations()];
}

export function findConfiguration(id: string): ConfigurationDocument | null {
  return loadAllConfigurations().find((config) => getConfigurationId(config) === id) ?? null;
}

// --- Create configuration from current state ---

export function createConfigurationFromDocument(
  configuration: ConfigurationDocument,
): ConfigurationDocument {
  return withConfigurationMetadata(structuredClone(configuration), {
    id: slugifyConfigurationName(configuration.name),
    readonly: false,
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
