import Ajv2020 from 'ajv/dist/2020';
import type { ErrorObject } from 'ajv';
import referenceConfigurationText from '@root/web/src/app_config/reference_scenario.json?raw';
import configurationSchemaText from '@root/web/src/app_config/scenario_schema.json?raw';
import { resolveConfigurationDocument } from './demandResolution.ts';
import type { AppConfigRegistry, ConfigurationDocument } from './types';

type JsonObject = Record<string, unknown>;

class ConfigurationValidationError extends Error {
  readonly details: string[];

  constructor(label: string, details: string[]) {
    super(`Invalid ${label}:\n- ${details.join('\n- ')}`);
    this.name = 'ConfigurationValidationError';
    this.details = details;
  }
}

const builtinConfigurationModules = import.meta.glob<string>(
  '/public/configurations/*.json',
  { eager: true, import: 'default', query: '?raw' },
);

const userConfigurationModules = import.meta.glob<string>(
  '/public/configurations/user/*.json',
  { eager: true, import: 'default', query: '?raw' },
);

let cachedBuiltinConfigurations: ConfigurationDocument[] | null = null;

function parseJsonObject<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown parse failure';
    throw new Error(`Failed to parse ${label}: ${detail}`);
  }
}

function decodeJsonPointer(segment: string): string {
  return segment.replaceAll('~1', '/').replaceAll('~0', '~');
}

function formatErrorPath(error: ErrorObject): string {
  const pathSegments = error.instancePath
    .split('/')
    .filter(Boolean)
    .map(decodeJsonPointer);
  const basePath = pathSegments.join('.');

  if (error.keyword === 'required') {
    const { missingProperty } = error.params as { missingProperty: string };
    return basePath ? `${basePath}.${missingProperty}` : missingProperty;
  }

  if (error.keyword === 'additionalProperties') {
    const { additionalProperty } = error.params as { additionalProperty: string };
    return basePath ? `${basePath}.${additionalProperty}` : additionalProperty;
  }

  return basePath || '$';
}

function formatValidationError(error: ErrorObject): string {
  const path = formatErrorPath(error);

  switch (error.keyword) {
    case 'enum': {
      const { allowedValues } = error.params as { allowedValues?: unknown[] };
      return `${path}: must be one of ${allowedValues?.join(', ') ?? 'the allowed values'}`;
    }
    case 'type': {
      const { type } = error.params as { type?: string };
      return `${path}: must be ${type ?? 'the expected type'}`;
    }
    case 'required':
      return `${path}: is required`;
    case 'additionalProperties': {
      const { additionalProperty } = error.params as { additionalProperty?: string };
      return `${path}: unexpected property ${JSON.stringify(additionalProperty)}`;
    }
    case 'minimum': {
      const { limit } = error.params as { limit?: number };
      return `${path}: must be greater than or equal to ${limit}`;
    }
    case 'maximum': {
      const { limit } = error.params as { limit?: number };
      return `${path}: must be less than or equal to ${limit}`;
    }
    case 'minItems': {
      const { limit } = error.params as { limit?: number };
      return `${path}: must contain at least ${limit} item${limit === 1 ? '' : 's'}`;
    }
    default:
      return `${path}: ${error.message ?? 'is invalid'}`;
  }
}

function normalizeIncludedOutputIds(value: string[] | undefined): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = Array.from(
    new Set(value.filter((entry) => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)),
  );

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeConfigurationMetadata(configuration: ConfigurationDocument): ConfigurationDocument {
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
  configuration: ConfigurationDocument,
  metadata: Partial<NonNullable<ConfigurationDocument['app_metadata']>>,
): ConfigurationDocument {
  const nextMetadata = {
    ...(configuration.app_metadata ?? {}),
    ...metadata,
  };

  return normalizeConfigurationMetadata({
    ...configuration,
    app_metadata: nextMetadata,
  });
}

function parseConfigurationCollection(
  modules: Record<string, string>,
  readonly: boolean,
): ConfigurationDocument[] {
  const configurations: ConfigurationDocument[] = [];

  for (const [path, raw] of Object.entries(modules)) {
    if (path.includes('_index.json')) {
      continue;
    }

    try {
      const configuration = parseConfigurationDocument(raw, undefined, path);
      configurations.push(withConfigurationMetadata(configuration, { readonly }));
    } catch {
      console.warn(`Failed to parse bundled configuration: ${path}`);
    }
  }

  return configurations.sort((left, right) => left.name.localeCompare(right.name));
}

const configurationSchema = parseJsonObject<JsonObject>(configurationSchemaText, 'scenario_schema.json');
const validator = new Ajv2020({ allErrors: true, strict: false }).compile(configurationSchema);

export function loadConfigurationSchema(): JsonObject {
  return configurationSchema;
}

export function validateConfigurationDocument(
  configuration: unknown,
  label = 'configuration document',
): ConfigurationDocument {
  if (!validator(configuration)) {
    const details = Array.from(
      new Set((validator.errors ?? []).map(formatValidationError)),
    );
    throw new ConfigurationValidationError(label, details);
  }

  return normalizeConfigurationMetadata(configuration as ConfigurationDocument);
}

export function parseConfigurationDocument(
  raw: string,
  appConfig?: AppConfigRegistry,
  label = 'configuration document',
): ConfigurationDocument {
  const configuration = validateConfigurationDocument(parseJsonObject<unknown>(raw, label), label);
  return appConfig ? resolveConfigurationDocument(configuration, appConfig, label) : configuration;
}

export function cloneConfigurationDocument(configuration: ConfigurationDocument): ConfigurationDocument {
  return structuredClone(configuration);
}

export function loadDefaultConfiguration(appConfig: AppConfigRegistry): ConfigurationDocument {
  return parseConfigurationDocument(referenceConfigurationText, appConfig, 'reference_scenario.json');
}

export function getConfigurationId(configuration: ConfigurationDocument): string | null {
  return configuration.app_metadata?.id ?? null;
}

export function isReadonlyConfiguration(configuration: ConfigurationDocument): boolean {
  return configuration.app_metadata?.readonly === true;
}

export function getIncludedOutputIds(configuration: ConfigurationDocument): string[] | undefined {
  return normalizeIncludedOutputIds(configuration.app_metadata?.included_output_ids);
}

export function withIncludedOutputIds(
  configuration: ConfigurationDocument,
  includedOutputIds: string[] | undefined,
): ConfigurationDocument {
  return withConfigurationMetadata(configuration, { included_output_ids: includedOutputIds });
}

export function loadBuiltinConfigurations(): ConfigurationDocument[] {
  if (!cachedBuiltinConfigurations) {
    cachedBuiltinConfigurations = parseConfigurationCollection(builtinConfigurationModules, true);
  }

  return cachedBuiltinConfigurations;
}

export function loadUserConfigurations(): ConfigurationDocument[] {
  return parseConfigurationCollection(userConfigurationModules, false);
}

export async function fetchUserConfigurations(): Promise<ConfigurationDocument[]> {
  try {
    const response = await fetch('/api/user-configurations');
    if (!response.ok) {
      return loadUserConfigurations();
    }

    const configurations = (await response.json()) as ConfigurationDocument[];
    return configurations.map((configuration) => withConfigurationMetadata(configuration, { readonly: false }));
  } catch {
    return loadUserConfigurations();
  }
}

export async function saveUserConfiguration(configuration: ConfigurationDocument): Promise<string | null> {
  const toSave = withConfigurationMetadata(configuration, { readonly: false });

  try {
    const response = await fetch('/api/user-configurations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSave),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return (data as { error?: string }).error ?? 'Failed to save configuration.';
    }

    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Failed to save configuration.';
  }
}

export async function deleteUserConfiguration(configurationId: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/user-configurations?id=${encodeURIComponent(configurationId)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return (data as { error?: string }).error ?? 'Failed to delete configuration.';
    }

    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Failed to delete configuration.';
  }
}

export function loadAllConfigurations(): ConfigurationDocument[] {
  return [...loadBuiltinConfigurations(), ...loadUserConfigurations()];
}

export function findConfiguration(configurationId: string): ConfigurationDocument | null {
  return loadAllConfigurations().find((configuration) => getConfigurationId(configuration) === configurationId) ?? null;
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
