import Ajv2020 from 'ajv/dist/2020';
import type { ErrorObject } from 'ajv';
import referenceConfigurationText from '../configurations/reference.json?raw';
import configurationSchemaText from '../app_config/configuration_schema.json?raw';
import {
  DEFAULT_RESIDUAL_OVERLAY_DISPLAY_MODE,
  getResidualOverlayDisplayMode,
} from './residualOverlayPresentation.ts';
import { resolveConfigurationDocument } from './demandResolution.ts';
import type {
  AppConfigRegistry,
  AutonomousEfficiencyTrack,
  ConfigurationDocument,
  ConfigurationResidualOverlays,
  EfficiencyPackage,
  ResidualOverlayRow,
} from './types.ts';

type JsonObject = Record<string, unknown>;

class ConfigurationValidationError extends Error {
  readonly details: string[];

  constructor(label: string, details: string[]) {
    super(`Invalid ${label}:\n- ${details.join('\n- ')}`);
    this.name = 'ConfigurationValidationError';
    this.details = details;
  }
}

function parseJsonObject<T>(raw: unknown, label: string): T {
  if (raw && typeof raw === 'object') {
    return raw as T;
  }

  try {
    return JSON.parse(String(raw)) as T;
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
  raw: string | unknown,
  appConfig?: AppConfigRegistry,
  label = 'configuration document',
): ConfigurationDocument {
  const configuration = validateConfigurationDocument(parseJsonObject<unknown>(raw, label), label);
  return appConfig ? resolveConfigurationDocument(configuration, appConfig, label) : configuration;
}

export function buildDefaultResidualOverlays(
  overlayRows: ResidualOverlayRow[],
): ConfigurationResidualOverlays {
  const includeById = new Map<string, boolean>();
  for (const row of overlayRows) {
    const current = includeById.get(row.overlay_id);
    includeById.set(row.overlay_id, current === undefined ? row.default_include : current && row.default_include);
  }

  return {
    controls_by_overlay_id: Object.fromEntries(
      Array.from(includeById.entries()).map(([id, included]) => [id, { included }]),
    ),
  };
}

export function materializeResidualOverlayConfiguration(
  configuration: ConfigurationDocument,
  overlayRows: ResidualOverlayRow[],
): ConfigurationDocument {
  const defaults = buildDefaultResidualOverlays(overlayRows).controls_by_overlay_id;
  const knownIds = Object.keys(defaults);
  const existing = configuration.residual_overlays?.controls_by_overlay_id ?? {};
  const merged: Record<string, { included: boolean }> = {};

  for (const id of knownIds) {
    merged[id] = { included: existing[id]?.included ?? defaults[id]?.included ?? false };
  }

  const displayMode = getResidualOverlayDisplayMode(configuration);

  return {
    ...configuration,
    residual_overlays: { controls_by_overlay_id: merged },
    presentation_options: {
      ...(configuration.presentation_options ?? {}),
      residual_overlay_display_mode: displayMode ?? DEFAULT_RESIDUAL_OVERLAY_DISPLAY_MODE,
    },
  };
}

function normalizeConfiguredPackageIds(packageIds: string[] | null | undefined): string[] {
  return Array.from(
    new Set(
      (packageIds ?? [])
        .filter((packageId): packageId is string => typeof packageId === 'string')
        .map((packageId) => packageId.trim())
        .filter((packageId) => packageId.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function buildPackageFamiliesById(
  efficiencyPackages: Pick<EfficiencyPackage, 'family_id' | 'package_id'>[],
): Map<string, Set<string>> {
  return efficiencyPackages.reduce<Map<string, Set<string>>>((familiesById, row) => {
    const families = familiesById.get(row.package_id) ?? new Set<string>();
    families.add(row.family_id);
    familiesById.set(row.package_id, families);
    return familiesById;
  }, new Map<string, Set<string>>());
}

export function materializeEfficiencyConfiguration(
  configuration: ConfigurationDocument,
  _autonomousEfficiencyTracks: Pick<AutonomousEfficiencyTrack, 'track_id'>[],
  efficiencyPackages: Pick<EfficiencyPackage, 'family_id' | 'package_id'>[],
): ConfigurationDocument {
  const autonomousMode = configuration.efficiency_controls?.autonomous_mode ?? 'baseline';
  const packageMode = configuration.efficiency_controls?.package_mode ?? 'off';
  const configuredPackageIds = normalizeConfiguredPackageIds(
    configuration.efficiency_controls?.package_ids,
  );
  const packageFamiliesById = buildPackageFamiliesById(efficiencyPackages);

  if (packageMode === 'allow_list' || packageMode === 'deny_list') {
    for (const packageId of configuredPackageIds) {
      const families = packageFamiliesById.get(packageId);
      if (!families) {
        throw new Error(`Unknown efficiency package id ${JSON.stringify(packageId)} in efficiency_controls.package_ids.`);
      }

      if (families.size > 1) {
        throw new Error(
          `Ambiguous efficiency package id ${JSON.stringify(packageId)} is shared by families ${Array.from(families).sort().join(', ')}.`,
        );
      }
    }
  }

  return {
    ...configuration,
    efficiency_controls: {
      autonomous_mode: autonomousMode,
      package_mode: packageMode,
      package_ids: packageMode === 'allow_list' || packageMode === 'deny_list'
        ? configuredPackageIds
        : [],
    },
  };
}

export function loadDefaultConfiguration(appConfig: AppConfigRegistry): ConfigurationDocument {
  return parseConfigurationDocument(referenceConfigurationText, appConfig, 'reference_configuration.json');
}
