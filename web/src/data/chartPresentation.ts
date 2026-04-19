import { getCommodityMetadata } from './commodityMetadata.ts';

export type ChartPresentationNamespace =
  | 'sector'
  | 'subsector'
  | 'commodity'
  | 'cost_component'
  | 'metric'
  | 'state'
  | 'output';

export interface ChartPresentationEntry {
  color: string;
  legendLabel: string;
  legendToken?: string;
}

type ChartPresentationRegistry = Record<string, ChartPresentationEntry>;

export const MAX_VISIBLE_LEGEND_LABEL_LENGTH = 16;

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

export const SECTOR_PRESENTATION = {
  agriculture: { color: '#65a30d', legendLabel: 'Agriculture' },
  buildings: { color: '#2563eb', legendLabel: 'Buildings' },
  cement_clinker: { color: '#a16207', legendLabel: 'Cement' },
  electricity_supply: { color: '#eab308', legendLabel: 'Power' },
  generic_industrial_heat: { color: '#ea580c', legendLabel: 'Ind heat' },
  removals_negative_emissions: { color: '#0f766e', legendLabel: 'Removals' },
  road_transport: { color: '#4f46e5', legendLabel: 'Transport' },
  steel: { color: '#475569', legendLabel: 'Steel' },
  unmodelled_residuals: { color: '#92400e', legendLabel: 'Unmodelled res' },
} as const satisfies ChartPresentationRegistry;

export const SUBSECTOR_PRESENTATION = {
  commercial: { color: '#1d4ed8', legendLabel: 'Commercial' },
  residential: { color: '#60a5fa', legendLabel: 'Residential' },
  freight_road: { color: '#4338ca', legendLabel: 'Freight rd' },
  passenger_road: { color: '#6366f1', legendLabel: 'Passenger rd' },
  low_temperature_heat: { color: '#fb923c', legendLabel: 'LTH' },
  medium_temperature_heat: { color: '#f97316', legendLabel: 'MTH' },
  high_temperature_heat: { color: '#c2410c', legendLabel: 'HTH' },
  crude_steel: { color: '#475569', legendLabel: 'Steel' },
  cement_equivalent: { color: '#a16207', legendLabel: 'Cement' },
  livestock: { color: '#84cc16', legendLabel: 'Livestock' },
  cropping_horticulture: { color: '#65a30d', legendLabel: 'Crop/hort' },
  grid_supply: { color: '#eab308', legendLabel: 'Grid' },
  land_sequestration: { color: '#16a34a', legendLabel: 'Land seq' },
  engineered_removals: { color: '#0891b2', legendLabel: 'Eng removals' },
  unmodelled_residuals: { color: '#92400e', legendLabel: 'Unmodelled res' },
} as const satisfies ChartPresentationRegistry;

export const OUTPUT_PRESENTATION = {
  residential_building_services: { color: '#60a5fa', legendLabel: 'Res buildings', legendToken: 'Res' },
  commercial_building_services: { color: '#1d4ed8', legendLabel: 'Com buildings', legendToken: 'Com' },
  passenger_road_transport: { color: '#6366f1', legendLabel: 'Passenger rd', legendToken: 'PRd' },
  freight_road_transport: { color: '#4338ca', legendLabel: 'Freight rd', legendToken: 'FRd' },
  low_temperature_heat: { color: '#fb923c', legendLabel: 'LTH', legendToken: 'LTH' },
  medium_temperature_heat: { color: '#f97316', legendLabel: 'MTH', legendToken: 'MTH' },
  high_temperature_heat: { color: '#c2410c', legendLabel: 'HTH', legendToken: 'HTH' },
  crude_steel: { color: '#475569', legendLabel: 'Steel', legendToken: 'Steel' },
  cement_equivalent: { color: '#a16207', legendLabel: 'Cement', legendToken: 'Cem' },
  livestock_output_bundle: { color: '#84cc16', legendLabel: 'Livestock', legendToken: 'Live' },
  cropping_horticulture_output_bundle: { color: '#65a30d', legendLabel: 'Crop/hort', legendToken: 'Crop' },
  electricity: { color: '#eab308', legendLabel: 'Power', legendToken: 'Pwr' },
  land_sequestration: { color: '#16a34a', legendLabel: 'Land seq', legendToken: 'Land' },
  engineered_removals: { color: '#0891b2', legendLabel: 'Eng removals', legendToken: 'Eng' },
} as const satisfies ChartPresentationRegistry;

export const COMMODITY_PRESENTATION = {
  coal: { color: '#1f2937', legendLabel: 'Coal', legendToken: 'Coal' },
  natural_gas: { color: '#6b7280', legendLabel: 'Gas', legendToken: 'Gas' },
  electricity: { color: '#f59e0b', legendLabel: 'Elec', legendToken: 'Elec' },
  refined_liquid_fuels: { color: '#b45309', legendLabel: 'Liq fuels', legendToken: 'Liq' },
  biomass: { color: '#65a30d', legendLabel: 'Bio', legendToken: 'Bio' },
  hydrogen: { color: '#06b6d4', legendLabel: 'H2', legendToken: 'H2' },
  scrap_steel: { color: '#64748b', legendLabel: 'Scrap', legendToken: 'Scrap' },
  iron_ore: { color: '#92400e', legendLabel: 'Iron ore', legendToken: 'Ore' },
  capture_service: { color: '#0f766e', legendLabel: 'Cap svc', legendToken: 'Cap' },
} as const satisfies ChartPresentationRegistry;

export const COST_COMPONENT_PRESENTATION = {
  conversion: { color: '#2563eb', legendLabel: 'Conversion', legendToken: 'Conv' },
  commodity: { color: '#64748b', legendLabel: 'Commodity', legendToken: 'Comm' },
  carbon: { color: '#b91c1c', legendLabel: 'Carbon', legendToken: 'CO2' },
} as const satisfies ChartPresentationRegistry;

export const METRIC_PRESENTATION = {
  activity: { color: '#16a34a', legendLabel: 'Activity', legendToken: 'Act' },
  max_activity: { color: '#475569', legendLabel: 'Max activity', legendToken: 'Max' },
} as const satisfies ChartPresentationRegistry;

export const STATE_PRESENTATION = {
  agriculture__cropping_horticulture__conventional: { color: '#7c5a10', legendLabel: 'Conventional', legendToken: 'Conv' },
  agriculture__cropping_horticulture__mitigated: { color: '#65a30d', legendLabel: 'Mitigated', legendToken: 'Mit' },
  agriculture__livestock__conventional: { color: '#92400e', legendLabel: 'Conventional', legendToken: 'Conv' },
  agriculture__livestock__mitigated: { color: '#16a34a', legendLabel: 'Mitigated', legendToken: 'Mit' },
  buildings__commercial__deep_electric: { color: '#0ea5e9', legendLabel: 'Deep elec', legendToken: 'Deep' },
  buildings__commercial__electrified_efficiency: { color: '#2563eb', legendLabel: 'Efficient', legendToken: 'Eff' },
  buildings__commercial__incumbent_mixed_fuels: { color: '#9a3412', legendLabel: 'Incumbent', legendToken: 'Inc' },
  buildings__residential__deep_electric: { color: '#38bdf8', legendLabel: 'Deep elec', legendToken: 'Deep' },
  buildings__residential__electrified_efficiency: { color: '#3b82f6', legendLabel: 'Efficient', legendToken: 'Eff' },
  buildings__residential__incumbent_mixed_fuels: { color: '#b45309', legendLabel: 'Incumbent', legendToken: 'Inc' },
  cement_clinker__cement_equivalent__ccs_deep: { color: '#7c3aed', legendLabel: 'CCS', legendToken: 'CCS' },
  cement_clinker__cement_equivalent__conventional: { color: '#78716c', legendLabel: 'Incumbent', legendToken: 'Inc' },
  cement_clinker__cement_equivalent__low_clinker_alt_fuels: { color: '#d97706', legendLabel: 'Low-clinker', legendToken: 'Low' },
  electricity__grid_supply__deep_clean_firmed: { color: '#14b8a6', legendLabel: 'Deep clean', legendToken: 'Clean' },
  electricity__grid_supply__incumbent_thermal_mix: { color: '#4b5563', legendLabel: 'Incumbent', legendToken: 'Inc' },
  electricity__grid_supply__policy_frontier: { color: '#eab308', legendLabel: 'Frontier', legendToken: 'Front' },
  generic_industrial_heat__high_temperature_heat__electrified: { color: '#2563eb', legendLabel: 'Electrified', legendToken: 'Elec' },
  generic_industrial_heat__high_temperature_heat__fossil: { color: '#991b1b', legendLabel: 'Incumbent', legendToken: 'Inc' },
  generic_industrial_heat__high_temperature_heat__low_carbon_fuels: { color: '#0f766e', legendLabel: 'Low-carbon', legendToken: 'LC' },
  generic_industrial_heat__medium_temperature_heat__electrified: { color: '#3b82f6', legendLabel: 'Electrified', legendToken: 'Elec' },
  generic_industrial_heat__medium_temperature_heat__fossil: { color: '#b91c1c', legendLabel: 'Incumbent', legendToken: 'Inc' },
  generic_industrial_heat__medium_temperature_heat__low_carbon_fuels: { color: '#0d9488', legendLabel: 'Low-carbon', legendToken: 'LC' },
  generic_industrial_heat__low_temperature_heat__electrified: { color: '#60a5fa', legendLabel: 'Electrified', legendToken: 'Elec' },
  generic_industrial_heat__low_temperature_heat__fossil: { color: '#dc2626', legendLabel: 'Fossil', legendToken: 'Foss' },
  generic_industrial_heat__low_temperature_heat__low_carbon_fuels: { color: '#14b8a6', legendLabel: 'Low-carbon', legendToken: 'LC' },
  removals_negative_emissions__engineered_removals__daccs: { color: '#0891b2', legendLabel: 'DACCS', legendToken: 'DAC' },
  removals_negative_emissions__land_sequestration__biological_sink: { color: '#16a34a', legendLabel: 'Land sink', legendToken: 'Sink' },
  road_transport__freight_road__bev: { color: '#1d4ed8', legendLabel: 'BEV', legendToken: 'BEV' },
  road_transport__freight_road__diesel: { color: '#92400e', legendLabel: 'Diesel', legendToken: 'Diesel' },
  road_transport__freight_road__efficient_diesel: { color: '#d97706', legendLabel: 'Eff diesel', legendToken: 'EDsl' },
  road_transport__freight_road__fcev_h2: { color: '#06b6d4', legendLabel: 'H2 FC', legendToken: 'H2' },
  road_transport__passenger_road__bev: { color: '#2563eb', legendLabel: 'BEV', legendToken: 'BEV' },
  road_transport__passenger_road__hybrid_transition: { color: '#7c3aed', legendLabel: 'Hybrid', legendToken: 'Hyb' },
  road_transport__passenger_road__ice_fleet: { color: '#6b7280', legendLabel: 'ICE', legendToken: 'ICE' },
  steel__crude_steel__bf_bof_ccs_transition: { color: '#7c3aed', legendLabel: 'BF-BOF CCS', legendToken: 'BFCCS' },
  steel__crude_steel__bf_bof_conventional: { color: '#475569', legendLabel: 'BF-BOF', legendToken: 'BF' },
  steel__crude_steel__h2_dri_electric: { color: '#06b6d4', legendLabel: 'H2 DRI', legendToken: 'H2' },
  steel__crude_steel__scrap_eaf: { color: '#16a34a', legendLabel: 'Scrap EAF', legendToken: 'EAF' },
} as const satisfies ChartPresentationRegistry;

export const CHART_PRESENTATION_MAP = {
  sector: SECTOR_PRESENTATION,
  subsector: SUBSECTOR_PRESENTATION,
  commodity: COMMODITY_PRESENTATION,
  cost_component: COST_COMPONENT_PRESENTATION,
  metric: METRIC_PRESENTATION,
  state: STATE_PRESENTATION,
  output: OUTPUT_PRESENTATION,
} as const satisfies Record<ChartPresentationNamespace, ChartPresentationRegistry>;

const warnedMissingPresentation = new Set<string>();

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function shouldWarnForMissingPresentation(): boolean {
  return typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
}

function warnMissingPresentation(namespace: ChartPresentationNamespace, key: string) {
  if (!shouldWarnForMissingPresentation()) {
    return;
  }

  const missingKey = `${namespace}:${key}`;
  if (warnedMissingPresentation.has(missingKey)) {
    return;
  }

  warnedMissingPresentation.add(missingKey);
  console.warn(`Missing chart presentation mapping for ${missingKey}.`);
}

function titleCase(word: string): string {
  if (!word) {
    return word;
  }

  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

function normalizeFallbackLabel(source: string): string {
  const normalized = source
    .replaceAll('::', ' ')
    .replaceAll('__', ' ')
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return 'Unknown';
  }

  if (/[A-Z]/.test(normalized)) {
    return normalized;
  }

  return normalized
    .split(' ')
    .map((word) => titleCase(word))
    .join(' ');
}

function ellipsize(label: string, max = MAX_VISIBLE_LEGEND_LABEL_LENGTH): string {
  if (label.length <= max) {
    return label;
  }

  if (max <= 3) {
    return label.slice(0, max);
  }

  return `${label.slice(0, max - 3).trimEnd()}...`;
}

function buildFallbackToken(source: string): string {
  const parts = normalizeFallbackLabel(source)
    .replace(/\.\.\.$/, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return 'UNK';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 6);
  }

  const initialism = parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
  if (initialism.length > 0 && initialism.length <= 6) {
    return initialism;
  }

  return `${parts[0].slice(0, 3)}${parts[1].slice(0, 3)}`.slice(0, 6);
}

export function composeLegendLabel(
  parts: ReadonlyArray<string>,
  max = MAX_VISIBLE_LEGEND_LABEL_LENGTH,
): string {
  return ellipsize(parts.filter(Boolean).join('/'), max);
}

export function getPresentation(
  namespace: ChartPresentationNamespace,
  key: string,
  fallbackLabel = key,
): ChartPresentationEntry {
  const registry = CHART_PRESENTATION_MAP[namespace] as ChartPresentationRegistry;
  const explicitEntry = registry[key];

  if (explicitEntry) {
    return explicitEntry;
  }

  warnMissingPresentation(namespace, key);
  const normalizedFallbackLabel = normalizeFallbackLabel(fallbackLabel);

  return {
    color: FALLBACK_PALETTE[hashString(`${namespace}:${key}`) % FALLBACK_PALETTE.length],
    legendLabel: ellipsize(normalizedFallbackLabel),
    legendToken: buildFallbackToken(normalizedFallbackLabel),
  };
}

export function getSeriesColor(
  namespace: ChartPresentationNamespace,
  key: string,
  fallbackLabel = key,
): string {
  return getPresentation(namespace, key, fallbackLabel).color;
}

export function getCommodityPresentation(commodityId: string): ChartPresentationEntry {
  const commodityMetadata = getCommodityMetadata(commodityId);

  return getPresentation('commodity', commodityId, commodityMetadata.label);
}

export function buildFuelSwitchLegendLabel(
  fromFuelId: string,
  toFuelId: string,
): string {
  return `${getCommodityPresentation(fromFuelId).legendLabel} -> ${getCommodityPresentation(toFuelId).legendLabel}`;
}

export function buildStateMetricLegendLabel(
  stateId: string,
  kind: 'energy' | 'process',
): string {
  const statePresentation = getPresentation('state', stateId);

  return composeLegendLabel([
    statePresentation.legendToken ?? buildFallbackToken(statePresentation.legendLabel),
    kind === 'energy' ? 'E' : 'P',
  ]);
}

export function buildStateCommodityLegendLabel(
  stateId: string,
  commodityId: string,
): string {
  const statePresentation = getPresentation('state', stateId);
  const commodityPresentation = getPresentation('commodity', commodityId);

  return composeLegendLabel([
    statePresentation.legendToken ?? buildFallbackToken(statePresentation.legendLabel),
    commodityPresentation.legendToken ?? buildFallbackToken(commodityPresentation.legendLabel),
  ]);
}
