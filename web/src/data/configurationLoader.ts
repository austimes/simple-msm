/**
 * Loads full configuration documents from:
 * 1. Built-in configs shipped in src/configurations/ (readonly)
 * 2. User configs persisted to localStorage (editable)
 */
import { parseConfigurationDocument } from './configurationDocumentLoader.ts';
import {
  getConfigurationDocumentId,
} from './configurationMetadata.ts';
import type { ConfigurationDocument } from './types.ts';

// --- Built-in configuration loading (Vite eager import) ---

interface NodeDirectoryEntryLike {
  isDirectory(): boolean;
  name: string;
}

interface NodeFsLike {
  existsSync(path: string): boolean;
  readdirSync(path: string, options: { withFileTypes: true }): NodeDirectoryEntryLike[];
  readFileSync(path: string, encoding: 'utf8'): string;
}

interface NodePathLike {
  dirname(path: string): string;
  join(...paths: string[]): string;
  resolve(...paths: string[]): string;
}

interface NodeUrlLike {
  fileURLToPath(url: string | URL): string;
}

function getNodeBuiltin<T>(specifier: string): T | null {
  const processLike = (globalThis as { process?: { getBuiltinModule?: (name: string) => T | undefined } }).process;
  if (!processLike?.getBuiltinModule) {
    return null;
  }

  return processLike.getBuiltinModule(specifier)
    ?? processLike.getBuiltinModule(specifier.replace(/^node:/, ''))
    ?? null;
}

function loadConfigurationModulesFromFileSystem(
  relativeDirectory: string,
  keyPrefix: string,
): Record<string, string> {
  const fs = getNodeBuiltin<NodeFsLike>('node:fs');
  const path = getNodeBuiltin<NodePathLike>('node:path');
  const url = getNodeBuiltin<NodeUrlLike>('node:url');

  if (!fs || !path || !url) {
    return {};
  }

  const moduleDir = path.dirname(url.fileURLToPath(import.meta.url));
  const rootDir = path.resolve(moduleDir, relativeDirectory);
  if (!fs.existsSync(rootDir)) {
    return {};
  }

  const modules: Record<string, string> = {};
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (entry.isDirectory() || !entry.name.endsWith('.json')) {
      continue;
    }

    const absolutePath = path.join(rootDir, entry.name);
    modules[`${keyPrefix}/${entry.name}`] = fs.readFileSync(absolutePath, 'utf8');
  }

  return modules;
}

const builtinConfigModules = await (async () => {
  try {
    const lazyModules = import.meta.glob<string>('/src/configurations/*.json', {
      import: 'default',
      query: '?raw',
    });
    const entries = await Promise.all(
      Object.entries(lazyModules).map(
        async ([key, loader]) => [key, await loader()] as const,
      ),
    );
    return Object.fromEntries(entries) as Record<string, string>;
  } catch {
    return loadConfigurationModulesFromFileSystem('../configurations', '/src/configurations');
  }
})();

function parseConfigurationIndex(modules: Record<string, string>): string[] | null {
  const entry = Object.entries(modules).find(([path]) => path.endsWith('/_index.json') || path.endsWith('_index.json'));
  if (!entry) {
    return null;
  }

  try {
    const parsed = JSON.parse(entry[1]) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim());
  } catch {
    console.warn(`Failed to parse configuration index: ${entry[0]}`);
    return null;
  }
}

interface ConfigurationCollectionEntry {
  source: string;
  configuration: ConfigurationDocument;
}

interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function normalizeConfigurationMetadata(configuration: ConfigurationDocument): ConfigurationDocument {
  const configurationWithoutMetadata = { ...configuration };
  delete configurationWithoutMetadata.app_metadata;

  const id = configuration.app_metadata?.id?.trim() || undefined;
  const readonly = configuration.app_metadata?.readonly === true;

  const appMetadata = [id, readonly].some(Boolean)
    ? {
        ...(id ? { id } : {}),
        ...(readonly ? { readonly: true } : {}),
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

function mergeConfigurationCollections(
  ...collections: ConfigurationDocument[][]
): ConfigurationDocument[] {
  return dedupeConfigurationEntries(
    collections.flatMap((configs, collectionIndex) =>
      configs.map((configuration, configIndex) => ({
        source: `merged:${collectionIndex}:${configIndex}`,
        configuration,
      })),
    ),
  );
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

export function loadBuiltinConfigurations(): ConfigurationDocument[] {
  if (!cachedBuiltinConfigs) {
    const parsed = parseConfigurationCollection(builtinConfigModules, true);
    const index = parseConfigurationIndex(builtinConfigModules);

    if (index) {
      const configsById = new Map<string, ConfigurationDocument>();
      for (const config of parsed) {
        const id = getConfigurationDocumentId(config);
        if (id) {
          configsById.set(id, config);
        }
      }
      cachedBuiltinConfigs = index
        .map((id) => configsById.get(id) ?? null)
        .filter((config): config is ConfigurationDocument => config != null);
    } else {
      cachedBuiltinConfigs = parsed;
    }
  }

  return cachedBuiltinConfigs;
}

// --- User configuration persistence (repo-backed via dev server API) ---

export const BROWSER_USER_CONFIG_STORAGE_KEY = 'simple-msm.user-configurations.v1';

// Bundled user configs loaded at build time (for production / static builds)
const userConfigModules = await (
  async () => {
    const fileSystemModules = loadConfigurationModulesFromFileSystem(
      '../configurations/user',
      '/src/configurations/user',
    );
    if (getNodeBuiltin<NodeFsLike>('node:fs')) {
      return fileSystemModules;
    }

    try {
      const lazyModules = import.meta.glob<string>('/src/configurations/user/*.json', {
        import: 'default',
        query: '?raw',
      });
      const entries = await Promise.all(
        Object.entries(lazyModules).map(async ([key, loader]) => {
          try {
            return [key, await loader()] as const;
          } catch {
            return null;
          }
        }),
      );
      return Object.fromEntries(
        entries.filter((entry): entry is readonly [string, string] => entry != null),
      );
    } catch {
      return fileSystemModules;
    }
  }
)();

function getBrowserStorage(): BrowserStorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getConfigurationStorageKey(configuration: ConfigurationDocument): string {
  return getConfigurationId(configuration) ?? configuration.name;
}

function loadBrowserUserConfigurations(): ConfigurationDocument[] {
  const storage = getBrowserStorage();
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(BROWSER_USER_CONFIG_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return dedupeConfigurationEntries(
      parsed.flatMap((configuration, index) => {
        if (!configuration || typeof configuration !== 'object') {
          return [];
        }

        return [{
          source: `browser:${index}`,
          configuration: withConfigurationMetadata(configuration as ConfigurationDocument, { readonly: false }),
        }];
      }),
    );
  } catch {
    return [];
  }
}

function persistBrowserUserConfigurations(configurations: ConfigurationDocument[]): string | null {
  const storage = getBrowserStorage();
  if (!storage) {
    return 'Browser-local saved configurations are unavailable here.';
  }

  try {
    storage.setItem(
      BROWSER_USER_CONFIG_STORAGE_KEY,
      JSON.stringify(
        configurations.map((configuration) =>
          withConfigurationMetadata(configuration, { readonly: false }),
        ),
      ),
    );
    return null;
  } catch (error) {
    return error instanceof Error
      ? `Could not update browser-local saved configurations: ${error.message}`
      : 'Could not update browser-local saved configurations.';
  }
}

function saveBrowserUserConfiguration(configuration: ConfigurationDocument): string | null {
  const key = getConfigurationStorageKey(configuration);
  const nextConfigurations = [
    ...loadBrowserUserConfigurations().filter(
      (existingConfiguration) => getConfigurationStorageKey(existingConfiguration) !== key,
    ),
    withConfigurationMetadata(configuration, { readonly: false }),
  ];

  return persistBrowserUserConfigurations(nextConfigurations);
}

function removeBrowserUserConfiguration(configId: string): string | null {
  const nextConfigurations = loadBrowserUserConfigurations().filter(
    (configuration) => getConfigurationStorageKey(configuration) !== configId,
  );

  return persistBrowserUserConfigurations(nextConfigurations);
}

function shouldUseBrowserUserConfigurationFallback(status: number): boolean {
  return status === 404 || status === 405;
}

export function loadUserConfigurations(): ConfigurationDocument[] {
  return mergeConfigurationCollections(
    parseConfigurationCollection(userConfigModules, false),
    loadBrowserUserConfigurations(),
  );
}

export async function fetchUserConfigurations(): Promise<ConfigurationDocument[]> {
  try {
    const res = await fetch('/api/user-configurations');
    if (!res.ok) return loadUserConfigurations();
    const configs = (await res.json()) as ConfigurationDocument[];
    return mergeConfigurationCollections(
      dedupeConfigurationEntries(
        configs.map((config, index) => ({
          source: `remote:${index}`,
          configuration: withConfigurationMetadata(config, { readonly: false }),
        })),
      ),
      loadBrowserUserConfigurations(),
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
      if (shouldUseBrowserUserConfigurationFallback(res.status)) {
        return saveBrowserUserConfiguration(toSave);
      }

      const data = await res.json().catch(() => ({}));
      return (data as { error?: string }).error ?? 'Failed to save configuration.';
    }

    saveBrowserUserConfiguration(toSave);
    return null;
  } catch {
    return saveBrowserUserConfiguration(toSave);
  }
}

export async function deleteUserConfiguration(configId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/user-configurations?id=${encodeURIComponent(configId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      if (shouldUseBrowserUserConfigurationFallback(res.status)) {
        return removeBrowserUserConfiguration(configId);
      }

      const data = await res.json().catch(() => ({}));
      return (data as { error?: string }).error ?? 'Failed to delete configuration.';
    }

    removeBrowserUserConfiguration(configId);
    return null;
  } catch {
    return removeBrowserUserConfiguration(configId);
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
