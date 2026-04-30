/**
 * Residual aggregation and cross-checking utilities.
 *
 * DIAGNOSTIC / PRESENTATION ONLY — nothing in this module should be imported
 * by buildSolveRequest.ts or any solver-facing code. These functions exist
 * solely for balance-sheet validation and UI display.
 */
import type { ResidualOverlayRow, ResolvedMethodYearRow } from './types.ts';

export const GRID_LOSSES_OWN_USE_FAMILY_ID = 'electricity_grid_losses_own_use';
export const RESIDUAL_LULUCF_SINK_FAMILY_ID = 'residual_lulucf_sink';

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
  residualFinalElectricityTwh?: number;
  gridLossesOwnUseElectricityTwh?: number;
  includedResidualFamilyCount?: number;
  energyResidualFamilyCount?: number;
  nonEnergyResidualFamilyCount?: number;
  sinkResidualFamilyCount?: number;
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

function sumEmissionsMt(entries: ResolvedMethodYearRow['energy_emissions_by_pollutant']): number {
  return entries.reduce((sum, entry) => sum + entry.value, 0) / 1_000_000;
}

function inputCoefficientToPj(coefficient: number, unit: string): number {
  if (unit.startsWith('GJ/')) {
    return coefficient / 1_000_000;
  }
  if (unit.startsWith('MWh/')) {
    return coefficient * 0.0036 / 1000;
  }
  return 0;
}

function inputCoefficientToElectricityTwh(
  commodityId: string,
  coefficient: number,
  unit: string,
): number {
  if (commodityId !== 'electricity' || !unit.startsWith('MWh/')) {
    return 0;
  }
  return coefficient / 1_000_000;
}

function residualFamilyRows(resolvedMethodYears: ResolvedMethodYearRow[]): ResolvedMethodYearRow[] {
  const rowsByFamily = new Map<string, ResolvedMethodYearRow>();

  for (const row of resolvedMethodYears) {
    if (row.family_resolution !== 'residual_stub' || row.year !== 2025) {
      continue;
    }
    if (!rowsByFamily.has(row.family_id) || row.is_default_incumbent_2025) {
      rowsByFamily.set(row.family_id, row);
    }
  }

  return Array.from(rowsByFamily.values()).sort((left, right) =>
    left.family_id.localeCompare(right.family_id),
  );
}

function defaultIncludedResidualFamilyIds(rows: ResolvedMethodYearRow[]): Set<string> {
  return new Set(
    rows
      .filter((row) => row.family_id !== RESIDUAL_LULUCF_SINK_FAMILY_ID)
      .map((row) => row.family_id),
  );
}

export function summarizeResidualFamilyTotals(
  resolvedMethodYears: ResolvedMethodYearRow[],
  includedFamilyIds?: Set<string>,
): OverlayTotalsSummary {
  const rows = residualFamilyRows(resolvedMethodYears);
  const included = includedFamilyIds ?? defaultIncludedResidualFamilyIds(rows);

  let totalResidualEnergyPj = 0;
  let totalResidualEnergyEmissions = 0;
  let totalResidualNonEnergyEmissions = 0;
  let totalCarbonBillableEmissionsMtco2e = 0;
  let residualFinalElectricityTwh = 0;
  let gridLossesOwnUseElectricityTwh = 0;
  let lulucfSinkMtco2e: number | null = null;
  let energyResidualFamilyCount = 0;
  let nonEnergyResidualFamilyCount = 0;
  let sinkResidualFamilyCount = 0;

  for (const row of rows) {
    const inputPj = row.input_coefficients.reduce(
      (sum, coefficient, index) => sum + inputCoefficientToPj(coefficient, row.input_units[index] ?? ''),
      0,
    );
    const inputElectricityTwh = row.input_coefficients.reduce(
      (sum, coefficient, index) => sum + inputCoefficientToElectricityTwh(
        row.input_commodities[index] ?? '',
        coefficient,
        row.input_units[index] ?? '',
      ),
      0,
    );
    const energyEmissionsMt = sumEmissionsMt(row.energy_emissions_by_pollutant);
    const processEmissionsMt = sumEmissionsMt(row.process_emissions_by_pollutant);

    if (row.family_id === RESIDUAL_LULUCF_SINK_FAMILY_ID) {
      lulucfSinkMtco2e = (lulucfSinkMtco2e ?? 0) + energyEmissionsMt + processEmissionsMt;
      sinkResidualFamilyCount += 1;
      continue;
    }

    if (!included.has(row.family_id)) {
      continue;
    }

    if (row.family_id === GRID_LOSSES_OWN_USE_FAMILY_ID) {
      gridLossesOwnUseElectricityTwh += inputElectricityTwh;
    } else {
      totalResidualEnergyPj += inputPj;
      residualFinalElectricityTwh += inputElectricityTwh;
    }

    totalResidualEnergyEmissions += energyEmissionsMt;
    totalResidualNonEnergyEmissions += processEmissionsMt;
    totalCarbonBillableEmissionsMtco2e += energyEmissionsMt + processEmissionsMt;

    if (inputPj > 0 && row.family_id !== GRID_LOSSES_OWN_USE_FAMILY_ID) {
      energyResidualFamilyCount += 1;
    }
    if (processEmissionsMt > 0) {
      nonEnergyResidualFamilyCount += 1;
    }
  }

  return {
    totalResidualEnergyPj,
    totalResidualEnergyEmissions,
    totalResidualNonEnergyEmissions,
    lulucfSinkMtco2e,
    totalCarbonBillableEmissionsMtco2e,
    totalOverlayCommodityCostAudm2024: 0,
    totalOverlayFixedCostAudm2024: 0,
    residualFinalElectricityTwh,
    gridLossesOwnUseElectricityTwh,
    includedResidualFamilyCount: included.size,
    energyResidualFamilyCount,
    nonEnergyResidualFamilyCount,
    sinkResidualFamilyCount,
  };
}
