import Ajv2020 from 'ajv/dist/2020';
import type { ErrorObject } from 'ajv';
import referenceConfigurationText from '@root/web/src/app_config/reference_configuration.json?raw';
import configurationSchemaText from '@root/web/src/app_config/configuration_schema.json?raw';
import { resolveConfigurationDocument } from './demandResolution.ts';
import type { AppConfigRegistry, ConfigurationDocument, ConfigurationResidualOverlays, ResidualOverlayRow } from './types.ts';

type JsonObject = Record<string, unknown>;

class ConfigurationValidationError extends Error {
  readonly details: string[];

  constructor(label: string, details: string[]) {
    super(`Invalid ${label}:\n- ${details.join('\n- ')}`);
    this.name = 'ConfigurationValidationError';
    this.details = details;
  }
}

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

const configurationSchema = parseJsonObject<JsonObject>(
  configurationSchemaText,
  'configuration_schema.json',
);
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

  return configuration as ConfigurationDocument;
}

export function parseConfigurationDocument(
  raw: string,
  appConfig?: AppConfigRegistry,
  label = 'configuration document',
): ConfigurationDocument {
  const configuration = validateConfigurationDocument(parseJsonObject<unknown>(raw, label), label);
  return appConfig ? resolveConfigurationDocument(configuration, appConfig, label) : configuration;
}

export function buildDefaultResidualOverlays(
  overlayRows: ResidualOverlayRow[],
): ConfigurationResidualOverlays {
  const ids = Array.from(new Set(overlayRows.map((row) => row.overlay_id)));
  return {
    controls_by_overlay_id: Object.fromEntries(
      ids.map((id) => [id, { included: true }]),
    ),
  };
}

export function ensureResidualOverlays(
  configuration: ConfigurationDocument,
  overlayRows: ResidualOverlayRow[],
): ConfigurationDocument {
  const knownIds = Array.from(new Set(overlayRows.map((row) => row.overlay_id)));
  const existing = configuration.residual_overlays?.controls_by_overlay_id ?? {};
  const merged: Record<string, { included: boolean }> = {};

  for (const id of knownIds) {
    merged[id] = { included: existing[id]?.included ?? true };
  }

  return {
    ...configuration,
    residual_overlays: { controls_by_overlay_id: merged },
  };
}

export function loadDefaultConfiguration(appConfig: AppConfigRegistry): ConfigurationDocument {
  return parseConfigurationDocument(referenceConfigurationText, appConfig, 'reference_configuration.json');
}
