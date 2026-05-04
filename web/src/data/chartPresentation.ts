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
  carbon_management: { color: '#0e7490', legendLabel: 'Carbon mgmt' },
  cement_clinker: { color: '#a16207', legendLabel: 'Cement' },
  construction: { color: '#a3a3a3', legendLabel: 'Construction' },
  electricity_supply: { color: '#eab308', legendLabel: 'Power' },
  energy_supply: { color: '#facc15', legendLabel: 'Energy supply' },
  generic_industrial_heat: { color: '#ea580c', legendLabel: 'Ind heat' },
  lulucf: { color: '#15803d', legendLabel: 'LULUCF' },
  manufacturing: { color: '#7c3aed', legendLabel: 'Manufacturing' },
  other_sectors: { color: '#6b7280', legendLabel: 'Other' },
  removals_negative_emissions: { color: '#0f766e', legendLabel: 'Removals' },
  road_transport: { color: '#4f46e5', legendLabel: 'Transport' },
  steel: { color: '#475569', legendLabel: 'Steel' },
  transport: { color: '#3730a3', legendLabel: 'Other transp' },
  unmodelled_residuals: { color: '#92400e', legendLabel: 'Unmodelled res' },
  waste: { color: '#a16207', legendLabel: 'Waste' },
  water_waste: { color: '#0891b2', legendLabel: 'Water/waste' },
} as const satisfies ChartPresentationRegistry;

export const SUBSECTOR_PRESENTATION = {
  commercial: { color: '#1d4ed8', legendLabel: 'Commercial' },
  commercial_other: { color: '#1d4ed8', legendLabel: 'Com other' },
  residential: { color: '#60a5fa', legendLabel: 'Residential' },
  residential_other: { color: '#60a5fa', legendLabel: 'Res other' },
  residential_water_heating: { color: '#3b82f6', legendLabel: 'Res water' },
  freight_road: { color: '#4338ca', legendLabel: 'Freight rd' },
  freight_rail: { color: '#4338ca', legendLabel: 'Rail freight' },
  freight_marine: { color: '#0e7490', legendLabel: 'Marine fgt' },
  passenger_road: { color: '#6366f1', legendLabel: 'Passenger rd' },
  passenger_rail: { color: '#6366f1', legendLabel: 'Rail pax' },
  passenger_air: { color: '#3730a3', legendLabel: 'Pax air' },
  other_non_road: { color: '#3730a3', legendLabel: 'Other transp' },
  low_temperature_heat: { color: '#fb923c', legendLabel: 'LTH' },
  medium_temperature_heat: { color: '#f97316', legendLabel: 'MTH' },
  high_temperature_heat: { color: '#c2410c', legendLabel: 'HTH' },
  crude_steel: { color: '#475569', legendLabel: 'Steel' },
  crude_steel_non_h2_dri_residual: { color: '#475569', legendLabel: 'NonH2 steel' },
  direct_reduced_iron: { color: '#475569', legendLabel: 'DRI' },
  dri_melt_refine: { color: '#475569', legendLabel: 'DRI melt' },
  cement_equivalent: { color: '#a16207', legendLabel: 'Cement' },
  cement_finish_grind_blend: { color: '#a16207', legendLabel: 'Grnd/blend' },
  cement_kiln_heat: { color: '#d97706', legendLabel: 'Kiln heat' },
  clinker_intermediate: { color: '#a16207', legendLabel: 'Clinker' },
  chemical_products: { color: '#7c3aed', legendLabel: 'Chem prods' },
  other_material_products: { color: '#7c3aed', legendLabel: 'Other matls' },
  livestock: { color: '#84cc16', legendLabel: 'Livestock' },
  livestock_biogenic_emissions: { color: '#84cc16', legendLabel: 'Live bio emis' },
  cropping_horticulture: { color: '#65a30d', legendLabel: 'Crop/hort' },
  soil_fertiliser_residue_emissions: { color: '#65a30d', legendLabel: 'Soil emis' },
  land_carbon_stock_change: { color: '#15803d', legendLabel: 'Land C stock' },
  grid_supply: { color: '#eab308', legendLabel: 'Grid' },
  grid_losses_own_use: { color: '#facc15', legendLabel: 'Grid losses' },
  domestic_bioenergy_supply: { color: '#65a30d', legendLabel: 'Bio supply' },
  domestic_derived_fuel_supply: { color: '#b45309', legendLabel: 'Derived fuels' },
  domestic_gas_supply: { color: '#6b7280', legendLabel: 'Gas supply' },
  domestic_hydrogen_supply: { color: '#06b6d4', legendLabel: 'H2 supply' },
  domestic_liquid_fuel_supply: { color: '#92400e', legendLabel: 'Liq supply' },
  domestic_solid_fuel_supply: { color: '#1f2937', legendLabel: 'Solid supply' },
  export_iron_ore_supply: { color: '#92400e', legendLabel: 'Exp iron ore' },
  export_metallurgical_coal_supply: { color: '#374151', legendLabel: 'Exp met coal' },
  export_thermal_coal_supply: { color: '#1f2937', legendLabel: 'Exp th coal' },
  land_sequestration: { color: '#16a34a', legendLabel: 'Land seq' },
  engineered_removals: { color: '#0891b2', legendLabel: 'Eng removals' },
  point_source_capture: { color: '#0f766e', legendLabel: 'PS capture' },
  co2_storage: { color: '#0f766e', legendLabel: 'CO2 storage' },
  co2_transport: { color: '#0e7490', legendLabel: 'CO2 transp' },
  fugitive_emissions: { color: '#9a3412', legendLabel: 'Fugitives' },
  mining_other: { color: '#a3a3a3', legendLabel: 'Mining' },
  construction_other: { color: '#a3a3a3', legendLabel: 'Constr other' },
  waste_other: { color: '#a16207', legendLabel: 'Waste other' },
  water_waste_other: { color: '#0891b2', legendLabel: 'W/W other' },
  other_other: { color: '#6b7280', legendLabel: 'Other' },
  unmodelled_residuals: { color: '#92400e', legendLabel: 'Unmodelled res' },
} as const satisfies ChartPresentationRegistry;

export const OUTPUT_PRESENTATION = {
  residential_building_services: { color: '#60a5fa', legendLabel: 'Res buildings', legendToken: 'Res' },
  residential_other: { color: '#60a5fa', legendLabel: 'Res other', legendToken: 'RO' },
  provide_residential_water_heating: { color: '#3b82f6', legendLabel: 'Res water', legendToken: 'RWH' },
  commercial_building_services: { color: '#1d4ed8', legendLabel: 'Com buildings', legendToken: 'Com' },
  commercial_other: { color: '#1d4ed8', legendLabel: 'Com other', legendToken: 'CO' },
  construction_other: { color: '#a3a3a3', legendLabel: 'Constr other', legendToken: 'Con' },
  passenger_road_transport: { color: '#6366f1', legendLabel: 'Passenger rd', legendToken: 'PRd' },
  freight_road_transport: { color: '#4338ca', legendLabel: 'Freight rd', legendToken: 'FRd' },
  transport_air_passenger: { color: '#3730a3', legendLabel: 'Pax air', legendToken: 'Air' },
  transport_marine_freight: { color: '#0e7490', legendLabel: 'Marine fgt', legendToken: 'Mar' },
  transport_other_non_road: { color: '#3730a3', legendLabel: 'Other transp', legendToken: 'OTr' },
  transport_rail_freight: { color: '#4338ca', legendLabel: 'Rail freight', legendToken: 'RF' },
  transport_rail_passenger: { color: '#6366f1', legendLabel: 'Rail pax', legendToken: 'RP' },
  transport_other: { color: '#3730a3', legendLabel: 'Other transp', legendToken: 'OTr' },
  low_temperature_heat: { color: '#fb923c', legendLabel: 'LTH', legendToken: 'LTH' },
  medium_temperature_heat: { color: '#f97316', legendLabel: 'MTH', legendToken: 'MTH' },
  high_temperature_heat: { color: '#c2410c', legendLabel: 'HTH', legendToken: 'HTH' },
  crude_steel: { color: '#475569', legendLabel: 'Steel', legendToken: 'Steel' },
  make_direct_reduced_iron: { color: '#475569', legendLabel: 'DRI', legendToken: 'DRI' },
  make_non_h2_dri_crude_steel: { color: '#475569', legendLabel: 'NonH2 steel', legendToken: 'N-St' },
  melt_and_refine_dri_into_crude_steel: { color: '#475569', legendLabel: 'DRI melt', legendToken: 'Mlt' },
  cement_equivalent: { color: '#a16207', legendLabel: 'Cement', legendToken: 'Cem' },
  generate_cement_kiln_heat: { color: '#d97706', legendLabel: 'Kiln heat', legendToken: 'KH' },
  grind_blend_cement_equivalent: { color: '#a16207', legendLabel: 'Cem grind', legendToken: 'Grnd' },
  make_clinker_intermediate: { color: '#a16207', legendLabel: 'Clinker', legendToken: 'Clk' },
  chemical_products: { color: '#7c3aed', legendLabel: 'Chem prods', legendToken: 'Chem' },
  other_material_products: { color: '#7c3aed', legendLabel: 'Other matls', legendToken: 'Mat' },
  manufacturing_other: { color: '#7c3aed', legendLabel: 'Mfg other', legendToken: 'Mfg' },
  livestock_output_bundle: { color: '#84cc16', legendLabel: 'Livestock', legendToken: 'Live' },
  livestock_biogenic_emissions: { color: '#84cc16', legendLabel: 'Live bio emis', legendToken: 'LB' },
  cropping_horticulture_output_bundle: { color: '#65a30d', legendLabel: 'Crop/hort', legendToken: 'Crop' },
  soil_fertiliser_residue_emissions: { color: '#65a30d', legendLabel: 'Soil emis', legendToken: 'Soil' },
  electricity: { color: '#eab308', legendLabel: 'Power', legendToken: 'Pwr' },
  electricity_grid_losses_own_use: { color: '#facc15', legendLabel: 'Grid losses', legendToken: 'GLs' },
  domestic_bioenergy_supply: { color: '#65a30d', legendLabel: 'Bio supply', legendToken: 'Bio' },
  domestic_derived_fuel_supply: { color: '#b45309', legendLabel: 'Derived fuels', legendToken: 'Drv' },
  domestic_gas_supply: { color: '#6b7280', legendLabel: 'Gas supply', legendToken: 'Gas' },
  domestic_hydrogen_supply: { color: '#06b6d4', legendLabel: 'H2 supply', legendToken: 'H2' },
  domestic_liquid_fuel_supply: { color: '#92400e', legendLabel: 'Liq supply', legendToken: 'Liq' },
  domestic_solid_fuel_supply: { color: '#1f2937', legendLabel: 'Solid supply', legendToken: 'Sol' },
  export_iron_ore_supply: { color: '#92400e', legendLabel: 'Exp iron ore', legendToken: 'XOre' },
  export_metallurgical_coal_supply: { color: '#374151', legendLabel: 'Exp met coal', legendToken: 'XMet' },
  export_thermal_coal_supply: { color: '#1f2937', legendLabel: 'Exp th coal', legendToken: 'XThm' },
  land_sequestration: { color: '#16a34a', legendLabel: 'Land seq', legendToken: 'Land' },
  engineered_removals: { color: '#0891b2', legendLabel: 'Eng removals', legendToken: 'Eng' },
  point_source_capture: { color: '#0f766e', legendLabel: 'PS capture', legendToken: 'PSC' },
  co2_storage: { color: '#0f766e', legendLabel: 'CO2 storage', legendToken: 'CO2S' },
  co2_transport: { color: '#0e7490', legendLabel: 'CO2 transp', legendToken: 'CO2T' },
  mining_other: { color: '#a3a3a3', legendLabel: 'Mining', legendToken: 'Min' },
  residual_fugitives: { color: '#9a3412', legendLabel: 'Fugitives', legendToken: 'Fug' },
  residual_lulucf_sink: { color: '#16a34a', legendLabel: 'LULUCF sink', legendToken: 'LULU' },
  residual_waste: { color: '#a16207', legendLabel: 'Waste resid', legendToken: 'Wst' },
  residual_agriculture_other: { color: '#65a30d', legendLabel: 'Ag other', legendToken: 'Ag' },
  residual_ippu_other: { color: '#7c3aed', legendLabel: 'IPPU other', legendToken: 'IPPU' },
  water_waste_other: { color: '#0891b2', legendLabel: 'W/W other', legendToken: 'W/W' },
  other_other: { color: '#6b7280', legendLabel: 'Other', legendToken: 'Oth' },
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
  cement_kiln_heat: { color: '#d97706', legendLabel: 'Kiln heat', legendToken: 'KH' },
  direct_reduced_iron: { color: '#475569', legendLabel: 'DRI', legendToken: 'DRI' },
  make_clinker_intermediate: { color: '#a16207', legendLabel: 'Clinker', legendToken: 'Clk' },
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
  steel__crude_steel_non_h2__bf_bof_ccs_transition: { color: '#7c3aed', legendLabel: 'BF-BOF CCS', legendToken: 'BFCCS' },
  steel__crude_steel_non_h2__bf_bof_conventional: { color: '#475569', legendLabel: 'BF-BOF', legendToken: 'BF' },
  steel__crude_steel_non_h2__scrap_eaf: { color: '#16a34a', legendLabel: 'Scrap EAF', legendToken: 'EAF' },
  steel__dri__gas_shaft_furnace: { color: '#6b7280', legendLabel: 'Gas DRI', legendToken: 'GDRI' },
  steel__dri__h2_shaft_furnace: { color: '#06b6d4', legendLabel: 'H2 DRI', legendToken: 'H2DRI' },
  steel__dri__imported_residual: { color: '#9ca3af', legendLabel: 'Imp DRI', legendToken: 'IDRI' },
  steel__dri_melt_refine__eaf_finishing: { color: '#16a34a', legendLabel: 'EAF finish', legendToken: 'EAFF' },
  steel__dri_melt_refine__electric_smelter: { color: '#0ea5e9', legendLabel: 'Elec smelter', legendToken: 'ESm' },
  cement__clinker__ccs_ready: { color: '#7c3aed', legendLabel: 'CCS clinker', legendToken: 'CCSCl' },
  cement__clinker__conventional: { color: '#78716c', legendLabel: 'Conv clinker', legendToken: 'CnvCl' },
  cement__clinker__low_carbon_calciner: { color: '#0f766e', legendLabel: 'LC calciner', legendToken: 'LCCal' },
  cement__finish__low_clinker_scm_blend: { color: '#d97706', legendLabel: 'SCM blend', legendToken: 'SCM' },
  cement__finish__ordinary_blend: { color: '#a16207', legendLabel: 'Ordinary', legendToken: 'Ord' },
  cement__kiln_heat__alt_fuels: { color: '#d97706', legendLabel: 'Alt fuels', legendToken: 'AltF' },
  cement__kiln_heat__hydrogen_electric: { color: '#06b6d4', legendLabel: 'H2/electric', legendToken: 'H2El' },
  cement__kiln_heat__mixed_fossil: { color: '#991b1b', legendLabel: 'Mixed fossil', legendToken: 'MxFs' },
  buildings__residential_water_heating__electric_heat_pump: { color: '#0ea5e9', legendLabel: 'Heat pump', legendToken: 'HP' },
  buildings__residential_water_heating__gas_storage: { color: '#b45309', legendLabel: 'Gas storage', legendToken: 'GasS' },
  buildings__residential_water_heating__heat_pump_transition: { color: '#0891b2', legendLabel: 'HP transition', legendToken: 'HPTr' },
  buildings__residential_water_heating__incumbent_mixed_fuels: { color: '#9a3412', legendLabel: 'Incumbent', legendToken: 'Inc' },
  buildings__residential_water_heating__near_zero_electric: { color: '#16a34a', legendLabel: 'Near-zero el', legendToken: 'NZE' },
  buildings__residential_water_heating__resistive_electric: { color: '#3b82f6', legendLabel: 'Resistive', legendToken: 'Res' },
  buildings__residential_water_heating__solar_boosted: { color: '#facc15', legendLabel: 'Solar boost', legendToken: 'Sol' },
  carbon_management__co2_storage__placeholder: { color: '#0f766e', legendLabel: 'CO2 storage', legendToken: 'CO2S' },
  carbon_management__co2_transport__placeholder: { color: '#0e7490', legendLabel: 'CO2 transport', legendToken: 'CO2T' },
  carbon_management__point_source_capture__placeholder: { color: '#14b8a6', legendLabel: 'PS capture', legendToken: 'PSC' },
  chemical_products__residual_incumbent: { color: '#7c3aed', legendLabel: 'Chem resid', legendToken: 'Resid' },
  commercial_other__residual_incumbent: { color: '#1d4ed8', legendLabel: 'Com other res', legendToken: 'Resid' },
  construction_other__residual_incumbent: { color: '#a3a3a3', legendLabel: 'Constr resid', legendToken: 'Resid' },
  domestic_bioenergy_supply__residual_incumbent: { color: '#65a30d', legendLabel: 'Bio sup resid', legendToken: 'Resid' },
  domestic_derived_fuel_supply__residual_incumbent: { color: '#b45309', legendLabel: 'Drv sup resid', legendToken: 'Resid' },
  domestic_gas_supply__residual_incumbent: { color: '#6b7280', legendLabel: 'Gas sup resid', legendToken: 'Resid' },
  domestic_hydrogen_supply__residual_incumbent: { color: '#06b6d4', legendLabel: 'H2 sup resid', legendToken: 'Resid' },
  domestic_liquid_fuel_supply__residual_incumbent: { color: '#92400e', legendLabel: 'Liq sup resid', legendToken: 'Resid' },
  domestic_solid_fuel_supply__residual_incumbent: { color: '#1f2937', legendLabel: 'Sol sup resid', legendToken: 'Resid' },
  electricity_grid_losses_own_use__residual_incumbent: { color: '#facc15', legendLabel: 'Grid loss res', legendToken: 'Resid' },
  export_iron_ore_supply__residual_incumbent: { color: '#92400e', legendLabel: 'Exp ore resid', legendToken: 'Resid' },
  export_metallurgical_coal_supply__residual_incumbent: { color: '#374151', legendLabel: 'Exp met resid', legendToken: 'Resid' },
  export_thermal_coal_supply__residual_incumbent: { color: '#1f2937', legendLabel: 'Exp thm resid', legendToken: 'Resid' },
  livestock_biogenic_emissions__residual_incumbent: { color: '#84cc16', legendLabel: 'Live emis res', legendToken: 'Resid' },
  mining_other__residual_incumbent: { color: '#a3a3a3', legendLabel: 'Min other res', legendToken: 'Resid' },
  other_material_products__residual_incumbent: { color: '#7c3aed', legendLabel: 'Other mat res', legendToken: 'Resid' },
  other_other__residual_incumbent: { color: '#6b7280', legendLabel: 'Other resid', legendToken: 'Resid' },
  residential_other__residual_incumbent: { color: '#60a5fa', legendLabel: 'Res other res', legendToken: 'Resid' },
  residual_fugitives__residual_incumbent: { color: '#9a3412', legendLabel: 'Fugitive res', legendToken: 'Resid' },
  residual_lulucf_sink__residual_incumbent: { color: '#16a34a', legendLabel: 'LULUCF res', legendToken: 'Resid' },
  residual_waste__residual_incumbent: { color: '#a16207', legendLabel: 'Waste resid', legendToken: 'Resid' },
  soil_fertiliser_residue_emissions__residual_incumbent: { color: '#65a30d', legendLabel: 'Soil emis res', legendToken: 'Resid' },
  transport_air_passenger__residual_incumbent: { color: '#3730a3', legendLabel: 'Air pax resid', legendToken: 'Resid' },
  transport_marine_freight__residual_incumbent: { color: '#0e7490', legendLabel: 'Marine resid', legendToken: 'Resid' },
  transport_other_non_road__residual_incumbent: { color: '#3730a3', legendLabel: 'Other tr res', legendToken: 'Resid' },
  transport_rail_freight__residual_incumbent: { color: '#4338ca', legendLabel: 'Rail fgt res', legendToken: 'Resid' },
  transport_rail_passenger__residual_incumbent: { color: '#6366f1', legendLabel: 'Rail pax res', legendToken: 'Resid' },
  water_waste_other__residual_incumbent: { color: '#0891b2', legendLabel: 'W/W other res', legendToken: 'Resid' },
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
  methodId: string,
  kind: 'energy' | 'process',
): string {
  const statePresentation = getPresentation('state', methodId);

  return composeLegendLabel([
    statePresentation.legendToken ?? buildFallbackToken(statePresentation.legendLabel),
    kind === 'energy' ? 'E' : 'P',
  ]);
}

export function buildStateCommodityLegendLabel(
  methodId: string,
  commodityId: string,
): string {
  const statePresentation = getPresentation('state', methodId);
  const commodityPresentation = getPresentation('commodity', commodityId);

  return composeLegendLabel([
    statePresentation.legendToken ?? buildFallbackToken(statePresentation.legendLabel),
    commodityPresentation.legendToken ?? buildFallbackToken(commodityPresentation.legendLabel),
  ]);
}
