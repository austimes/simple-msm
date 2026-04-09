import type { ConfigurationDocument } from './types.ts';

export function normalizeSeedOutputIds(value: string[] | undefined): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = Array.from(
    new Set(value.filter((entry) => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)),
  );

  return normalized.length > 0 ? normalized : undefined;
}

export function getSeedOutputIds(configuration: ConfigurationDocument): string[] | undefined {
  return normalizeSeedOutputIds(
    configuration.app_metadata?.seed_output_ids
    ?? configuration.app_metadata?.included_output_ids,
  );
}

// Backward-compatible alias for older call sites.
export const normalizeIncludedOutputIds = normalizeSeedOutputIds;

// Backward-compatible alias for older call sites.
export const getIncludedOutputIds = getSeedOutputIds;
