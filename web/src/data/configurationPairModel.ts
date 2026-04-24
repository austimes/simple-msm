import { getConfigurationId } from './configurationLoader.ts';
import {
  buildGeneratedIncumbentBaseConfiguration,
  GENERATED_INCUMBENT_BASE_LABEL,
} from './systemStructureModel.ts';
import type {
  ConfigurationDocument,
  PackageData,
} from './types.ts';
import type { WorkspaceComparisonBaseSelectionMode } from './appUiState.ts';

export interface ResolvedConfigurationEndpoint {
  configId: string | null;
  configuration: ConfigurationDocument | null;
  label: string;
  source: 'saved' | 'working' | 'generated';
}

export interface ResolvedConfigurationPair {
  base: ResolvedConfigurationEndpoint | null;
  focus: ResolvedConfigurationEndpoint;
  commonYears: number[];
  comparisonEnabled: boolean;
  efficiencyAttributionSafe: boolean;
}

export interface SavedConfigurationPairSelection {
  baseConfigId: string | null;
  focusConfigId: string | null;
}

interface ResolveAdditionalityPairOptions {
  configurations: ConfigurationDocument[];
  configurationsById: Record<string, ConfigurationDocument>;
  selectedBaseConfigId: string | null;
  selectedFocusConfigId: string | null;
}

interface ResolveWorkspacePairOptions {
  activeConfigurationId: string | null;
  baseSelectionMode: WorkspaceComparisonBaseSelectionMode;
  configurationsById: Record<string, ConfigurationDocument>;
  focusConfiguration: ConfigurationDocument;
  focusConfigId: string | null;
  packageData: Pick<
    PackageData,
    'appConfig' | 'sectorStates' | 'autonomousEfficiencyTracks' | 'efficiencyPackages' | 'residualOverlays2025'
  >;
  selectedBaseConfigId: string | null;
}

export interface ResolvedAdditionalityPair extends ResolvedConfigurationPair {
  baseConfigId: string | null;
  focusConfigId: string | null;
}

export interface ResolvedWorkspacePair extends ResolvedConfigurationPair {
  baseConfigId: string | null;
  baseSelectionMode: WorkspaceComparisonBaseSelectionMode;
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((sorted, key) => {
        const entry = (value as Record<string, unknown>)[key];
        if (entry !== undefined) {
          sorted[key] = sortJsonValue(entry);
        }
        return sorted;
      }, {});
  }

  return value;
}

export function normalizeConfigurationForEfficiencyAttributionComparison(
  configuration: ConfigurationDocument,
): unknown {
  const comparisonBackbone: Partial<ConfigurationDocument> = structuredClone(configuration);
  delete comparisonBackbone.name;
  delete comparisonBackbone.description;
  delete comparisonBackbone.efficiency_controls;
  delete comparisonBackbone.app_metadata;
  return sortJsonValue(comparisonBackbone);
}

export function isEfficiencyAttributionSafePair(
  baseConfiguration: ConfigurationDocument | null,
  focusConfiguration: ConfigurationDocument | null,
): boolean {
  if (!baseConfiguration || !focusConfiguration) {
    return false;
  }

  return JSON.stringify(normalizeConfigurationForEfficiencyAttributionComparison(baseConfiguration))
    === JSON.stringify(normalizeConfigurationForEfficiencyAttributionComparison(focusConfiguration));
}

function buildCommonYears(
  baseConfiguration: ConfigurationDocument | null,
  focusConfiguration: ConfigurationDocument | null,
): number[] {
  if (!baseConfiguration || !focusConfiguration) {
    return [];
  }

  const focusYears = new Set(focusConfiguration.years);
  return baseConfiguration.years.filter((year) => focusYears.has(year));
}

function buildSavedEndpoint(
  configuration: ConfigurationDocument | null,
  configId: string | null,
): ResolvedConfigurationEndpoint | null {
  if (!configuration) {
    return null;
  }

  return {
    configId,
    configuration,
    label: configuration.name,
    source: 'saved',
  };
}

export function selectInitialSavedPair(
  configurations: ConfigurationDocument[],
): SavedConfigurationPairSelection {
  const ids = configurations
    .map((configuration) => getConfigurationId(configuration))
    .filter((id): id is string => id != null);

  if (ids.includes('reference-baseline') && ids.includes('reference-efficiency-open')) {
    return {
      baseConfigId: 'reference-baseline',
      focusConfigId: 'reference-efficiency-open',
    };
  }

  return {
    baseConfigId: ids[0] ?? null,
    focusConfigId: ids.find((id) => id !== ids[0]) ?? ids[0] ?? null,
  };
}

export function resolveAdditionalityPair(
  options: ResolveAdditionalityPairOptions,
): ResolvedAdditionalityPair {
  const initialPair = selectInitialSavedPair(options.configurations);
  const baseConfigId =
    options.selectedBaseConfigId && options.configurationsById[options.selectedBaseConfigId]
      ? options.selectedBaseConfigId
      : initialPair.baseConfigId;
  const focusConfigId =
    options.selectedFocusConfigId && options.configurationsById[options.selectedFocusConfigId]
      ? options.selectedFocusConfigId
      : initialPair.focusConfigId;
  const baseConfiguration = baseConfigId ? options.configurationsById[baseConfigId] ?? null : null;
  const focusConfiguration = focusConfigId ? options.configurationsById[focusConfigId] ?? null : null;

  return {
    base: buildSavedEndpoint(baseConfiguration, baseConfigId),
    focus: {
      configId: focusConfigId,
      configuration: focusConfiguration,
      label: focusConfiguration?.name ?? 'Focus configuration unavailable',
      source: 'saved',
    },
    baseConfigId,
    focusConfigId,
    commonYears: buildCommonYears(baseConfiguration, focusConfiguration),
    comparisonEnabled: Boolean(baseConfiguration && focusConfiguration),
    efficiencyAttributionSafe: isEfficiencyAttributionSafePair(baseConfiguration, focusConfiguration),
  };
}

export function resolveWorkspacePair(
  options: ResolveWorkspacePairOptions,
): ResolvedWorkspacePair {
  const focus = {
    configId: options.focusConfigId,
    configuration: options.focusConfiguration,
    label: options.focusConfiguration.name,
    source: 'working' as const,
  };

  let baseConfigId: string | null = null;
  let baseConfiguration: ConfigurationDocument | null = null;
  let baseEndpoint: ResolvedConfigurationEndpoint | null = null;

  if (options.baseSelectionMode === 'generated') {
    baseConfiguration = buildGeneratedIncumbentBaseConfiguration(
      options.focusConfiguration,
      options.packageData,
    );
    baseEndpoint = {
      configId: null,
      configuration: baseConfiguration,
      label: GENERATED_INCUMBENT_BASE_LABEL,
      source: 'generated',
    };
  } else if (options.baseSelectionMode === 'saved') {
    baseConfigId =
      options.selectedBaseConfigId && options.configurationsById[options.selectedBaseConfigId]
        ? options.selectedBaseConfigId
        : null;
    baseConfiguration = baseConfigId ? options.configurationsById[baseConfigId] ?? null : null;
    baseEndpoint = buildSavedEndpoint(baseConfiguration, baseConfigId);
  }

  return {
    base: baseEndpoint,
    focus,
    baseConfigId,
    baseSelectionMode: options.baseSelectionMode,
    commonYears: buildCommonYears(baseConfiguration, options.focusConfiguration),
    comparisonEnabled: Boolean(baseConfiguration),
    efficiencyAttributionSafe: isEfficiencyAttributionSafePair(baseConfiguration, options.focusConfiguration),
  };
}
