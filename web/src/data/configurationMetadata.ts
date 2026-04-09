import type { ScenarioDocument } from './types';

export function normalizeIncludedOutputIds(value: string[] | undefined): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = Array.from(
    new Set(value.filter((entry) => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)),
  );

  return normalized.length > 0 ? normalized : undefined;
}

export function getIncludedOutputIds(configuration: ScenarioDocument): string[] | undefined {
  return normalizeIncludedOutputIds(configuration.app_metadata?.included_output_ids);
}
