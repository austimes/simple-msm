/**
 * Overlay aggregation and cross-checking utilities.
 *
 * DIAGNOSTIC / PRESENTATION ONLY — nothing in this module should be imported
 * by buildSolveRequest.ts or any solver-facing code. These functions exist
 * solely for balance-sheet validation and UI display.
 */
import type { ResidualOverlayRow } from './types.ts';

export function getDefaultIncludedResidualOverlays(
  overlays: ResidualOverlayRow[],
): ResidualOverlayRow[] {
  return overlays.filter((r) => r.default_include === true);
}

export interface OverlayTotalsSummary {
  totalResidualEnergyPj: number;
  totalResidualEnergyEmissions: number;
  totalResidualNonEnergyEmissions: number;
  lulucfSinkMtco2e: number | null;
  totalCarbonBillableEmissionsMtco2e: number;
  totalOverlayCommodityCostAudm2024: number;
  totalOverlayFixedCostAudm2024: number;
}

export function summarizeOverlayTotals(
  overlays: ResidualOverlayRow[],
): OverlayTotalsSummary {
  const included = getDefaultIncludedResidualOverlays(overlays);

  const energyRows = included.filter((r) => r.overlay_domain === 'energy_residual');
  const nonEnergyRows = included.filter((r) => r.overlay_domain === 'nonenergy_residual');

  const totalResidualEnergyPj = energyRows.reduce(
    (sum, r) => sum + (r.final_energy_pj_2025 ?? 0),
    0,
  );
  const totalResidualEnergyEmissions = energyRows.reduce(
    (sum, r) => sum + (r.direct_energy_emissions_mtco2e_2025 ?? 0),
    0,
  );
  const totalResidualNonEnergyEmissions = nonEnergyRows.reduce(
    (sum, r) => sum + (r.other_emissions_mtco2e_2025 ?? 0),
    0,
  );

  const sinkRows = overlays.filter((r) => r.overlay_domain === 'net_sink');
  const lulucfSinkMtco2e = sinkRows.length > 0
    ? sinkRows.reduce((sum, r) => sum + (r.other_emissions_mtco2e_2025 ?? r.carbon_billable_emissions_mtco2e_2025 ?? 0), 0)
    : null;

  const totalCarbonBillableEmissionsMtco2e = included.reduce(
    (sum, r) => sum + (r.carbon_billable_emissions_mtco2e_2025 ?? 0),
    0,
  );

  const totalOverlayCommodityCostAudm2024 = included.reduce(
    (sum, r) => sum + (r.default_commodity_cost_audm_2024 ?? 0),
    0,
  );
  const totalOverlayFixedCostAudm2024 = included.reduce(
    (sum, r) => sum + (r.default_fixed_noncommodity_cost_audm_2024 ?? 0),
    0,
  );

  return {
    totalResidualEnergyPj,
    totalResidualEnergyEmissions,
    totalResidualNonEnergyEmissions,
    lulucfSinkMtco2e,
    totalCarbonBillableEmissionsMtco2e,
    totalOverlayCommodityCostAudm2024,
    totalOverlayFixedCostAudm2024,
  };
}
