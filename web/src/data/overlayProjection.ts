import type { ResidualOverlayDomain, ResidualOverlayRow } from './types.ts';

export const OVERLAY_GROWTH_PROXY: Record<string, string[]> = {
  residential_other: ['residential_building_services'],
  commercial_other: ['commercial_building_services'],
  transport_other: ['passenger_road_transport', 'freight_road_transport'],
  manufacturing_other: [
    'crude_steel',
    'cement_equivalent',
  ],
  mining_other: [],
  construction_other: [],
  water_waste_other: [],
  other_other: [],
  residual_agriculture_other: [
    'livestock_output_bundle',
    'cropping_horticulture_output_bundle',
  ],
  residual_fugitives: [],
  residual_ippu_other: [
    'crude_steel',
    'cement_equivalent',
  ],
  residual_waste: [],
  residual_lulucf_sink: [],
};

export function resolveOverlayGrowthRates(
  overlayIds: string[],
  resolvedServiceGrowthRates: Record<string, number>,
): Record<string, number> {
  const allRates = Object.values(resolvedServiceGrowthRates);
  const presetAverage =
    allRates.length > 0
      ? allRates.reduce((sum, r) => sum + r, 0) / allRates.length
      : 0;

  const result: Record<string, number> = {};

  for (const overlayId of overlayIds) {
    if (overlayId === 'residual_lulucf_sink') {
      result[overlayId] = 0;
      continue;
    }

    const proxyIds = OVERLAY_GROWTH_PROXY[overlayId];

    if (proxyIds === undefined || proxyIds.length === 0) {
      result[overlayId] = presetAverage;
      continue;
    }

    const matched = proxyIds
      .filter((id) => id in resolvedServiceGrowthRates)
      .map((id) => resolvedServiceGrowthRates[id]);

    result[overlayId] =
      matched.length > 0
        ? matched.reduce((sum, r) => sum + r, 0) / matched.length
        : presetAverage;
  }

  return result;
}

export interface ProjectedOverlayRow {
  overlayId: string;
  overlayLabel: string;
  overlayDomain: ResidualOverlayDomain;
  officialAccountingBucket: string;
  year: number;
  commodity: string | null;
  finalEnergyPj: number | null;
  nativeQuantity: number | null;
  directEnergyEmissionsMtco2e: number | null;
  otherEmissionsMtco2e: number | null;
  carbonBillableEmissionsMtco2e: number | null;
  commodityCostAudm2024: number | null;
  fixedNonCommodityCostAudm2024: number | null;
  totalCostExCarbonAudm2024: number | null;
}

function scaleNullable(value: number | null, factor: number): number | null {
  return value === null ? null : value * factor;
}

export function projectOverlayRows(
  rows: ResidualOverlayRow[],
  years: number[],
  growthRates: Record<string, number>,
): ProjectedOverlayRow[] {
  const projected: ProjectedOverlayRow[] = [];

  for (const row of rows) {
    const rate = growthRates[row.overlay_id] ?? 0;

    for (const year of years) {
      const factor = (1 + rate / 100) ** (year - 2025);

      projected.push({
        overlayId: row.overlay_id,
        overlayLabel: row.overlay_label,
        overlayDomain: row.overlay_domain,
        officialAccountingBucket: row.official_accounting_bucket,
        year,
        commodity: row.commodity,
        finalEnergyPj: scaleNullable(row.final_energy_pj_2025, factor),
        nativeQuantity: scaleNullable(row.native_quantity_2025, factor),
        directEnergyEmissionsMtco2e: scaleNullable(row.direct_energy_emissions_mtco2e_2025, factor),
        otherEmissionsMtco2e: scaleNullable(row.other_emissions_mtco2e_2025, factor),
        carbonBillableEmissionsMtco2e: scaleNullable(
          row.carbon_billable_emissions_mtco2e_2025,
          factor,
        ),
        commodityCostAudm2024: scaleNullable(row.default_commodity_cost_audm_2024, factor),
        fixedNonCommodityCostAudm2024: scaleNullable(
          row.default_fixed_noncommodity_cost_audm_2024,
          factor,
        ),
        totalCostExCarbonAudm2024: scaleNullable(row.default_total_cost_ex_carbon_audm_2024, factor),
      });
    }
  }

  return projected;
}
