/**
 * Overlay aggregation and cross-checking utilities.
 *
 * DIAGNOSTIC / PRESENTATION ONLY — nothing in this module should be imported
 * by buildSolveRequest.ts or any solver-facing code. These functions exist
 * solely for balance-sheet validation and UI display.
 *
 * TODO(3g6.3): Refactor to work with the unified ResidualOverlayRow type.
 * Currently uses the unified type but filters by overlay_domain to preserve
 * the existing API surface for BaselineClosureDiagnosticsCard.
 */
import type { ResidualOverlayRow } from './types.ts';

export function getDefaultIncludedEnergyOverlays(
  overlays: ResidualOverlayRow[],
): ResidualOverlayRow[] {
  return overlays.filter((r) => r.overlay_domain === 'energy_residual' && r.default_include === true);
}

export function getDefaultIncludedNonEnergyOverlays(
  overlays: ResidualOverlayRow[],
): ResidualOverlayRow[] {
  return overlays.filter((r) => r.overlay_domain !== 'energy_residual' && r.default_include === true);
}

export interface OverlayTotalsSummary {
  totalResidualEnergyPj: number;
  totalResidualEnergyEmissions: number;
  totalResidualNonEnergyEmissions: number;
  lulucfSinkMtco2e: number | null;
}

export function summarizeOverlayTotals(
  overlays: ResidualOverlayRow[],
): OverlayTotalsSummary {
  const includedEnergy = getDefaultIncludedEnergyOverlays(overlays);
  const includedNonEnergy = getDefaultIncludedNonEnergyOverlays(overlays);

  const totalResidualEnergyPj = includedEnergy.reduce(
    (sum, r) => sum + (r.final_energy_pj_2025 ?? 0),
    0,
  );
  const totalResidualEnergyEmissions = includedEnergy.reduce(
    (sum, r) => sum + (r.direct_energy_emissions_mtco2e_2025 ?? 0),
    0,
  );
  const totalResidualNonEnergyEmissions = includedNonEnergy.reduce(
    (sum, r) => sum + (r.other_emissions_mtco2e_2025 ?? 0),
    0,
  );

  const lulucfRow = overlays.find(
    (r) => r.overlay_id === 'residual_lulucf_sink',
  );
  const lulucfSinkMtco2e = lulucfRow ? (lulucfRow.other_emissions_mtco2e_2025 ?? lulucfRow.carbon_billable_emissions_mtco2e_2025) : null;

  return {
    totalResidualEnergyPj,
    totalResidualEnergyEmissions,
    totalResidualNonEnergyEmissions,
    lulucfSinkMtco2e,
  };
}
