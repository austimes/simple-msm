export interface EmbodiedEfficiencyPathwayEntry {
  conceptId: string;
  familyIds: string[];
  methodIds: string[];
  rationale: string;
}

export const embodiedEfficiencyPathwayEntries: EmbodiedEfficiencyPathwayEntry[] = [
  {
    conceptId: 'buildings__residential__electrified_service_bundle',
    familyIds: ['residential_building_services'],
    methodIds: [
      'buildings__residential__electrified_efficiency',
      'buildings__residential__deep_electric',
    ],
    rationale: 'Carrier-switching heat-pump and appliance changes are inseparable from the transition-state narratives.',
  },
  {
    conceptId: 'buildings__commercial__electrified_service_bundle',
    familyIds: ['commercial_building_services'],
    methodIds: [
      'buildings__commercial__electrified_efficiency',
      'buildings__commercial__deep_electric',
    ],
    rationale: 'Major HVAC and hot-water electrification is a route change, not an add-on efficiency overlay.',
  },
  {
    conceptId: 'road_transport__passenger_road__hybridisation_bundle',
    familyIds: ['passenger_road_transport'],
    methodIds: ['road_transport__passenger_road__hybrid_transition'],
    rationale: 'Hybrid drivetrain efficiency is inseparable from drivetrain choice.',
  },
  {
    conceptId: 'road_transport__passenger_road__bev_drivetrain_shift',
    familyIds: ['passenger_road_transport'],
    methodIds: ['road_transport__passenger_road__bev'],
    rationale: 'The efficiency gain comes with a carrier and drivetrain shift.',
  },
  {
    conceptId: 'road_transport__freight_road__efficient_diesel_bundle',
    familyIds: ['freight_road_transport'],
    methodIds: ['road_transport__freight_road__efficient_diesel'],
    rationale: 'The existing state already bundles better vehicle efficiency, logistics, and utilisation.',
  },
  {
    conceptId: 'road_transport__freight_road__bev_drivetrain_shift',
    familyIds: ['freight_road_transport'],
    methodIds: ['road_transport__freight_road__bev'],
    rationale: 'Freight BEV efficiency is inseparable from electrification and duty-cycle suitability.',
  },
  {
    conceptId: 'road_transport__freight_road__fcev_h2_drivetrain_shift',
    familyIds: ['freight_road_transport'],
    methodIds: ['road_transport__freight_road__fcev_h2'],
    rationale: 'Fuel-cell efficiency is inseparable from hydrogen-route choice.',
  },
  {
    conceptId: 'industrial_heat__low_temperature__electrification_route',
    familyIds: ['low_temperature_heat'],
    methodIds: ['generic_industrial_heat__low_temperature_heat__electrified'],
    rationale: 'Heat pumps and electric boilers are route changes.',
  },
  {
    conceptId: 'industrial_heat__medium_temperature__electrification_route',
    familyIds: ['medium_temperature_heat'],
    methodIds: ['generic_industrial_heat__medium_temperature_heat__electrified'],
    rationale: 'Electric-route gains stay in the existing state definition.',
  },
  {
    conceptId: 'industrial_heat__high_temperature__electrification_route',
    familyIds: ['high_temperature_heat'],
    methodIds: ['generic_industrial_heat__high_temperature_heat__electrified'],
    rationale: 'High-temperature electrification is especially route-specific.',
  },
  {
    conceptId: 'industrial_heat__all_temperatures__low_carbon_fuel_route',
    familyIds: ['low_temperature_heat', 'medium_temperature_heat', 'high_temperature_heat'],
    methodIds: [
      'generic_industrial_heat__low_temperature_heat__low_carbon_fuels',
      'generic_industrial_heat__medium_temperature_heat__low_carbon_fuels',
      'generic_industrial_heat__high_temperature_heat__low_carbon_fuels',
    ],
    rationale: 'Hydrogen and biomass route changes alter carrier and infrastructure requirements.',
  },
  {
    conceptId: 'steel__crude_steel__route_shift_and_ccs_bundle',
    familyIds: ['crude_steel'],
    methodIds: [
      'steel__crude_steel__scrap_eaf',
      'steel__crude_steel__h2_dri_electric',
      'steel__crude_steel__bf_bof_ccs_transition',
    ],
    rationale: 'Major steel intensity changes come from route change and CCS, not portable efficiency.',
  },
  {
    conceptId: 'cement__cement_equivalent__composition_fuel_switch_and_ccs_bundle',
    familyIds: ['cement_equivalent'],
    methodIds: [
      'cement_clinker__cement_equivalent__low_clinker_alt_fuels',
      'cement_clinker__cement_equivalent__ccs_deep',
    ],
    rationale: 'Clinker-factor reduction, fuel switching, and CCS are not portable efficiency overlays.',
  },
  {
    conceptId: 'agriculture__cropping_horticulture__mitigated_bundle',
    familyIds: ['cropping_horticulture_output_bundle'],
    methodIds: ['agriculture__cropping_horticulture__mitigated'],
    rationale: 'The limited direct-energy improvement remains bundled with agronomic and process-emissions changes.',
  },
  {
    conceptId: 'agriculture__livestock__mitigated_bundle',
    familyIds: ['livestock_output_bundle'],
    methodIds: ['agriculture__livestock__mitigated'],
    rationale: 'The energy effect remains bundled with methane, manure, and productivity changes.',
  },
  {
    conceptId: 'electricity__grid_supply__pathway_shift_bundle',
    familyIds: ['electricity'],
    methodIds: [
      'electricity__grid_supply__policy_frontier',
      'electricity__grid_supply__deep_clean_firmed',
    ],
    rationale: 'Large fuel and emissions improvements come from supply-pathway change, not a portable efficiency package.',
  },
];

export const embodiedEfficiencyPathwayMethodIds = new Set(
  embodiedEfficiencyPathwayEntries.flatMap((entry) => entry.methodIds),
);

export function getEmbodiedEfficiencyPathwayEntry(
  methodId: string | null | undefined,
): EmbodiedEfficiencyPathwayEntry | null {
  if (methodId == null) {
    return null;
  }

  return embodiedEfficiencyPathwayEntries.find((entry) => entry.methodIds.includes(methodId)) ?? null;
}

export function isEmbodiedEfficiencyPathwayMethod(methodId: string | null | undefined): boolean {
  return getEmbodiedEfficiencyPathwayEntry(methodId) != null;
}
