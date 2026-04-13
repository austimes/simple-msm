/**
 * Overlay aggregation and cross-checking utilities.
 *
 * DIAGNOSTIC / PRESENTATION ONLY — nothing in this module should be imported
 * by buildSolveRequest.ts or any solver-facing code. These functions exist
 * solely for balance-sheet validation and UI display.
 */
import type { ResidualEnergyOverlayRow, ResidualNonEnergyEmissionsOverlayRow } from './types.ts';

export function getDefaultIncludedEnergyOverlays(
  overlays: ResidualEnergyOverlayRow[],
): ResidualEnergyOverlayRow[] {
  return overlays.filter((r) => r.default_include === true);
}

export function getDefaultIncludedNonEnergyOverlays(
  overlays: ResidualNonEnergyEmissionsOverlayRow[],
): ResidualNonEnergyEmissionsOverlayRow[] {
  return overlays.filter((r) => r.default_include === true);
}

export interface OverlayTotalsSummary {
  totalResidualEnergyPj: number;
  totalResidualEnergyEmissions: number;
  totalResidualNonEnergyEmissions: number;
  lulucfSinkMtco2e: number | null;
}

export function summarizeOverlayTotals(
  energyOverlays: ResidualEnergyOverlayRow[],
  nonEnergyOverlays: ResidualNonEnergyEmissionsOverlayRow[],
): OverlayTotalsSummary {
  const includedEnergy = getDefaultIncludedEnergyOverlays(energyOverlays);
  const includedNonEnergy = getDefaultIncludedNonEnergyOverlays(nonEnergyOverlays);

  const totalResidualEnergyPj = includedEnergy.reduce(
    (sum, r) => sum + r.total_final_energy_pj_2025,
    0,
  );
  const totalResidualEnergyEmissions = includedEnergy.reduce(
    (sum, r) => sum + r.direct_energy_emissions_mtco2e_2025,
    0,
  );
  const totalResidualNonEnergyEmissions = includedNonEnergy.reduce(
    (sum, r) => sum + r.emissions_mtco2e_2025,
    0,
  );

  const lulucfRow = nonEnergyOverlays.find(
    (r) => r.overlay_id === 'residual_lulucf_sink',
  );
  const lulucfSinkMtco2e = lulucfRow ? lulucfRow.emissions_mtco2e_2025 : null;

  return {
    totalResidualEnergyPj,
    totalResidualEnergyEmissions,
    totalResidualNonEnergyEmissions,
    lulucfSinkMtco2e,
  };
}
