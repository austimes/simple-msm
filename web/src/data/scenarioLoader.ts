import Ajv2020 from 'ajv/dist/2020';
import type { ErrorObject } from 'ajv';
import referenceScenarioText from '@root/web/public/app_config/reference_scenario.json?raw';
import scenarioSchemaText from '@root/web/public/app_config/scenario_schema.json?raw';
import type { ScenarioDocument } from './types';

type JsonObject = Record<string, unknown>;

class ScenarioValidationError extends Error {
  readonly details: string[];

  constructor(label: string, details: string[]) {
    super(`Invalid ${label}:\n- ${details.join('\n- ')}`);
    this.name = 'ScenarioValidationError';
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

const scenarioSchema = parseJsonObject<JsonObject>(scenarioSchemaText, 'scenario_schema.json');
const validator = new Ajv2020({ allErrors: true, strict: false }).compile(scenarioSchema);

export function loadScenarioSchema(): JsonObject {
  return scenarioSchema;
}

export function validateScenarioDocument(
  scenario: unknown,
  label = 'scenario document',
): ScenarioDocument {
  if (!validator(scenario)) {
    const details = Array.from(
      new Set((validator.errors ?? []).map(formatValidationError)),
    );
    throw new ScenarioValidationError(label, details);
  }

  return scenario as ScenarioDocument;
}

export function parseScenarioDocument(
  raw: string,
  label = 'scenario document',
): ScenarioDocument {
  return validateScenarioDocument(parseJsonObject<unknown>(raw, label), label);
}

export function loadDefaultScenario(): ScenarioDocument {
  return parseScenarioDocument(referenceScenarioText, 'reference_scenario.json');
}
