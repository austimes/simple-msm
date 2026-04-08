/**
 * Loads solve configurations from:
 * 1. Built-in configs shipped in public/configurations/ (readonly)
 * 2. User configs persisted to localStorage (editable)
 */
import type { SolveConfiguration } from './configurationTypes';
import type { AppConfigRegistry, ScenarioDocument, ScenarioServiceControl } from './types';

const USER_CONFIGS_STORAGE_KEY = 'simple-msm.user-configurations.v1';

// --- Built-in configuration loading (Vite eager import) ---

const builtinConfigModules = import.meta.glob<string>(
  '/public/configurations/*.json',
  { eager: true, import: 'default', query: '?raw' },
);

function parseBuiltinConfigs(): SolveConfiguration[] {
  const configs: SolveConfiguration[] = [];

  for (const [path, raw] of Object.entries(builtinConfigModules)) {
    if (path.includes('_index.json')) continue;

    try {
      const parsed = JSON.parse(raw) as SolveConfiguration;
      parsed.readonly = true;
      configs.push(parsed);
    } catch {
      console.warn(`Failed to parse built-in configuration: ${path}`);
    }
  }

  return configs.sort((a, b) => a.name.localeCompare(b.name));
}

let cachedBuiltinConfigs: SolveConfiguration[] | null = null;

export function loadBuiltinConfigurations(): SolveConfiguration[] {
  if (!cachedBuiltinConfigs) {
    cachedBuiltinConfigs = parseBuiltinConfigs();
  }

  return cachedBuiltinConfigs;
}

// --- User configuration persistence ---

export function loadUserConfigurations(): SolveConfiguration[] {
  try {
    const raw = localStorage.getItem(USER_CONFIGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SolveConfiguration[];
    return parsed.map((c) => ({ ...c, readonly: false }));
  } catch {
    return [];
  }
}

export function saveUserConfigurations(configs: SolveConfiguration[]): string | null {
  try {
    const toSave = configs.map((c) => ({ ...c, readonly: false }));
    localStorage.setItem(USER_CONFIGS_STORAGE_KEY, JSON.stringify(toSave));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Failed to save configurations.';
  }
}

export function saveUserConfiguration(config: SolveConfiguration): string | null {
  const existing = loadUserConfigurations();
  const index = existing.findIndex((c) => c.id === config.id);

  if (index >= 0) {
    existing[index] = { ...config, readonly: false };
  } else {
    existing.push({ ...config, readonly: false });
  }

  return saveUserConfigurations(existing);
}

export function deleteUserConfiguration(configId: string): string | null {
  const existing = loadUserConfigurations();
  return saveUserConfigurations(existing.filter((c) => c.id !== configId));
}

// --- Combined loading ---

export function loadAllConfigurations(): SolveConfiguration[] {
  return [...loadBuiltinConfigurations(), ...loadUserConfigurations()];
}

export function findConfiguration(id: string): SolveConfiguration | null {
  return loadAllConfigurations().find((c) => c.id === id) ?? null;
}

// --- Apply configuration to a scenario ---

export function applyConfigurationToScenario(
  config: SolveConfiguration,
  referenceScenario: ScenarioDocument,
): { scenario: ScenarioDocument; includedOutputIds: string[] | undefined } {
  const scenario: ScenarioDocument = structuredClone(referenceScenario);

  scenario.name = config.name;
  if (config.description) {
    scenario.description = config.description;
  }

  // Merge service controls
  const mergedControls: Record<string, ScenarioServiceControl> = {
    ...scenario.service_controls,
  };

  for (const [outputId, control] of Object.entries(config.serviceControls)) {
    mergedControls[outputId] = {
      ...mergedControls[outputId],
      ...control,
    };
  }

  scenario.service_controls = mergedControls;

  // Apply demand preset
  if (config.demandPresetId) {
    scenario.demand_generation.preset_id = config.demandPresetId;
    if (scenario.demand_generation.mode === 'manual_table') {
      scenario.demand_generation.mode = 'anchor_plus_preset';
    }
    scenario.demand_generation.service_growth_rates_pct_per_year = null;
    scenario.demand_generation.external_commodity_growth_rates_pct_per_year = null;
  }

  // Apply commodity price selections
  if (config.commodityPriceSelections) {
    scenario.commodity_pricing.selections_by_commodity = {
      ...scenario.commodity_pricing.selections_by_commodity,
      ...config.commodityPriceSelections,
    };
    scenario.commodity_pricing.overrides = {};
  } else if (config.commodityPricePresetId) {
    // Legacy migration: map old preset IDs to per-commodity selections
    const legacyMap: Record<string, import('./types').PriceLevel> = {
      central_placeholder_2024aud: 'medium',
      fossil_shock: 'high',
      cheap_clean_energy: 'low',
    };
    const level = legacyMap[config.commodityPricePresetId] ?? 'medium';
    const allCommodityIds = Object.keys(scenario.commodity_pricing.selections_by_commodity ?? {});
    const selections: Partial<Record<string, import('./types').PriceLevel>> = {};
    for (const id of allCommodityIds) {
      selections[id] = level;
    }
    scenario.commodity_pricing.selections_by_commodity = selections;
    scenario.commodity_pricing.overrides = {};
  }

  // Merge solver options
  if (config.solverOptions) {
    scenario.solver_options = {
      ...scenario.solver_options,
      ...config.solverOptions,
    };
  }

  return {
    scenario,
    includedOutputIds: config.includedOutputIds,
  };
}

// --- Create configuration from current state ---

export function createConfigurationFromScenario(
  scenario: ScenarioDocument,
  referenceScenario: ScenarioDocument,
  includedOutputIds: string[] | undefined,
  appConfig: AppConfigRegistry,
): SolveConfiguration {
  const id = slugify(scenario.name);

  // Extract service control overrides that differ from reference
  const serviceControls: SolveConfiguration['serviceControls'] = {};
  const allOutputIds = Object.keys(appConfig.output_roles);

  for (const outputId of allOutputIds) {
    const current = scenario.service_controls[outputId];
    const reference = referenceScenario.service_controls[outputId];

    if (!current) continue;

    const differs =
      !reference ||
      current.mode !== reference.mode ||
      current.state_id !== reference.state_id;

    if (differs) {
      serviceControls[outputId] = {
        mode: current.mode,
        ...(current.state_id ? { state_id: current.state_id } : {}),
        ...(current.fixed_shares ? { fixed_shares: current.fixed_shares } : {}),
        ...(current.disabled_state_ids?.length
          ? { disabled_state_ids: current.disabled_state_ids }
          : {}),
      };
    }
  }

  // Capture preset overrides that differ from reference
  const demandPresetId =
    scenario.demand_generation.preset_id !== referenceScenario.demand_generation.preset_id
      ? (scenario.demand_generation.preset_id ?? undefined)
      : undefined;

  // Capture per-commodity selections that differ from reference
  const refSelections = referenceScenario.commodity_pricing.selections_by_commodity ?? {};
  const curSelections = scenario.commodity_pricing.selections_by_commodity ?? {};
  const diffSelections: Partial<Record<string, import('./types').PriceLevel>> = {};
  for (const [id, level] of Object.entries(curSelections)) {
    if (refSelections[id] !== level) {
      diffSelections[id] = level;
    }
  }
  const commodityPriceSelections = Object.keys(diffSelections).length > 0 ? diffSelections : undefined;

  return {
    id,
    name: scenario.name,
    description: scenario.description,
    readonly: false,
    includedOutputIds,
    serviceControls,
    demandPresetId,
    commodityPriceSelections,
    solverOptions: scenario.solver_options,
  };
}

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-+|-+$/g, '') || `config-${Date.now()}`
  );
}
