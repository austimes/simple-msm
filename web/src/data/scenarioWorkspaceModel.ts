import type {
  AppConfigRegistry,
  ConfigurationDocument,
  ConfigurationYearKey,
  PriceLevel,
  SectorState,
} from './types.ts';
import { derivePathwayStateIdsForOutput } from './pathwaySemantics.ts';

export interface StateCatalogEntry {
  stateId: string;
  stateLabel: string;
}

export interface SubsectorCatalogEntry {
  subsector: string;
  outputId: string;
  outputLabel: string;
  states: StateCatalogEntry[];
}

export interface SectorCatalogEntry {
  sector: string;
  subsectors: SubsectorCatalogEntry[];
}

export function buildStateCatalog(
  sectorStates: SectorState[],
  appConfig: AppConfigRegistry,
): SectorCatalogEntry[] {
  const sectorMap = new Map<string, Map<string, Map<string, StateCatalogEntry>>>();

  for (const row of sectorStates) {
    let subsectorMap = sectorMap.get(row.sector);
    if (!subsectorMap) {
      subsectorMap = new Map();
      sectorMap.set(row.sector, subsectorMap);
    }

    let stateMap = subsectorMap.get(row.subsector);
    if (!stateMap) {
      stateMap = new Map();
      subsectorMap.set(row.subsector, stateMap);
    }

    if (!stateMap.has(row.state_id)) {
      stateMap.set(row.state_id, {
        stateId: row.state_id,
        stateLabel: row.state_label,
      });
    }
  }

  const catalog: SectorCatalogEntry[] = [];

  for (const [sector, subsectorMap] of sectorMap) {
    const subsectors: SubsectorCatalogEntry[] = [];

    for (const [subsector, stateMap] of subsectorMap) {
      const firstRow = sectorStates.find(
        (r) => r.sector === sector && r.subsector === subsector,
      );
      const outputId = firstRow?.service_or_output_name ?? subsector;
      const roleMetadata = appConfig.output_roles[outputId];
      const outputLabel = roleMetadata?.display_label ?? outputId;

      subsectors.push({
        subsector,
        outputId,
        outputLabel,
        states: Array.from(stateMap.values()),
      });
    }

    catalog.push({ sector, subsectors });
  }

  return catalog;
}

export function getAvailableStateIds(
  configuration: ConfigurationDocument,
  outputId: string,
  allStateIds: string[],
): string[] {
  return derivePathwayStateIdsForOutput(configuration, outputId, allStateIds).availableStateIds;
}

export const getEnabledStateIds = getAvailableStateIds;

export function getActiveDemandPreset(
  configuration: ConfigurationDocument,
  appConfig: AppConfigRegistry,
): string | null {
  const { mode, preset_id } = configuration.demand_generation;

  if (mode === 'manual_table' || !preset_id) {
    return null;
  }

  if (!appConfig.demand_growth_presets[preset_id]) {
    return null;
  }

  return preset_id;
}

export function getCommodityPriceLevel(
  configuration: ConfigurationDocument,
  commodityId: string,
): PriceLevel {
  return configuration.commodity_pricing.selections_by_commodity?.[commodityId] ?? 'medium';
}

export function getActiveCarbonPricePreset(
  configuration: ConfigurationDocument,
  appConfig: AppConfigRegistry,
): string | null {
  for (const [presetId, preset] of Object.entries(appConfig.carbon_price_presets)) {
    const match = Object.entries(preset.values_by_year).every(
      ([year, value]) => configuration.carbon_price[year as ConfigurationYearKey] === value,
    );
    if (match) return presetId;
  }
  return null;
}
