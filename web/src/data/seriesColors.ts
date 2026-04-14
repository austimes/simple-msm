export type SeriesColorNamespace =
  | 'sector'
  | 'subsector'
  | 'commodity'
  | 'cost_component'
  | 'metric'
  | 'state';

const FALLBACK_PALETTE = [
  '#334155',
  '#2563eb',
  '#0f766e',
  '#d97706',
  '#7c3aed',
  '#be123c',
  '#0891b2',
  '#65a30d',
] as const;

export const SERIES_COLOR_MAP = {
  sector: {
    agriculture: '#65a30d',
    buildings: '#2563eb',
    cement_clinker: '#a16207',
    electricity_supply: '#eab308',
    generic_industrial_heat: '#ea580c',
    removals_negative_emissions: '#0f766e',
    road_transport: '#4f46e5',
    steel: '#475569',
  },
  subsector: {
    cropping_horticulture: '#65a30d',
    livestock: '#84cc16',
    commercial: '#1d4ed8',
    residential: '#60a5fa',
    cement_equivalent: '#a16207',
    grid_supply: '#eab308',
    high_temperature_heat: '#c2410c',
    medium_temperature_heat: '#f97316',
    low_temperature_heat: '#fb923c',
    engineered_removals: '#0891b2',
    land_sequestration: '#16a34a',
    freight_road: '#4338ca',
    passenger_road: '#6366f1',
    crude_steel: '#475569',
  },
  commodity: {
    coal: '#1f2937',
    natural_gas: '#6b7280',
    electricity: '#f59e0b',
    refined_liquid_fuels: '#b45309',
    biomass: '#65a30d',
    hydrogen: '#06b6d4',
    scrap_steel: '#64748b',
    iron_ore: '#92400e',
    sequestration_service: '#0f766e',
  },
  cost_component: {
    conversion: '#2563eb',
    commodity: '#64748b',
    carbon: '#b91c1c',
  },
  metric: {
    activity: '#16a34a',
    max_activity: '#475569',
  },
  state: {
    agriculture__cropping_horticulture__conventional: '#7c5a10',
    agriculture__cropping_horticulture__mitigated: '#65a30d',
    agriculture__livestock__conventional: '#92400e',
    agriculture__livestock__mitigated: '#16a34a',
    buildings__commercial__deep_electric: '#0ea5e9',
    buildings__commercial__electrified_efficiency: '#2563eb',
    buildings__commercial__incumbent_mixed_fuels: '#9a3412',
    buildings__residential__deep_electric: '#38bdf8',
    buildings__residential__electrified_efficiency: '#3b82f6',
    buildings__residential__incumbent_mixed_fuels: '#b45309',
    cement_clinker__cement_equivalent__ccs_deep: '#7c3aed',
    cement_clinker__cement_equivalent__conventional: '#78716c',
    cement_clinker__cement_equivalent__low_clinker_alt_fuels: '#d97706',
    electricity__grid_supply__deep_clean_firmed: '#14b8a6',
    electricity__grid_supply__incumbent_thermal_mix: '#4b5563',
    electricity__grid_supply__policy_frontier: '#eab308',
    generic_industrial_heat__high_temperature_heat__electrified: '#2563eb',
    generic_industrial_heat__high_temperature_heat__fossil: '#991b1b',
    generic_industrial_heat__high_temperature_heat__low_carbon_fuels: '#0f766e',
    generic_industrial_heat__medium_temperature_heat__electrified: '#3b82f6',
    generic_industrial_heat__medium_temperature_heat__fossil: '#b91c1c',
    generic_industrial_heat__medium_temperature_heat__low_carbon_fuels: '#0d9488',
    generic_industrial_heat__low_temperature_heat__electrified: '#60a5fa',
    generic_industrial_heat__low_temperature_heat__fossil: '#dc2626',
    generic_industrial_heat__low_temperature_heat__low_carbon_fuels: '#14b8a6',
    removals_negative_emissions__engineered_removals__daccs: '#0891b2',
    removals_negative_emissions__land_sequestration__biological_sink: '#16a34a',
    road_transport__freight_road__bev: '#1d4ed8',
    road_transport__freight_road__diesel: '#92400e',
    road_transport__freight_road__efficient_diesel: '#d97706',
    road_transport__freight_road__fcev_h2: '#06b6d4',
    road_transport__passenger_road__bev: '#2563eb',
    road_transport__passenger_road__hybrid_transition: '#7c3aed',
    road_transport__passenger_road__ice_fleet: '#6b7280',
    steel__crude_steel__bf_bof_ccs_transition: '#7c3aed',
    steel__crude_steel__bf_bof_conventional: '#475569',
    steel__crude_steel__h2_dri_electric: '#06b6d4',
    steel__crude_steel__scrap_eaf: '#16a34a',
  },
} as const;

const warnedMissingSeriesColors = new Set<string>();

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function shouldWarnForMissingSeriesColor(): boolean {
  return typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
}

function warnMissingSeriesColor(namespace: SeriesColorNamespace, key: string) {
  if (!shouldWarnForMissingSeriesColor()) {
    return;
  }

  const missingKey = `${namespace}:${key}`;
  if (warnedMissingSeriesColors.has(missingKey)) {
    return;
  }

  warnedMissingSeriesColors.add(missingKey);
  console.warn(`Missing series color mapping for ${missingKey}.`);
}

export function getSeriesColor(namespace: SeriesColorNamespace, key: string): string {
  const namespaceColors = SERIES_COLOR_MAP[namespace] as Record<string, string>;
  const explicitColor = namespaceColors[key];

  if (explicitColor) {
    return explicitColor;
  }

  warnMissingSeriesColor(namespace, key);
  return FALLBACK_PALETTE[hashString(`${namespace}:${key}`) % FALLBACK_PALETTE.length];
}
