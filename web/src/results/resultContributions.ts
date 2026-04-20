import type {
  NormalizedSolverRowProvenance,
  SolveRequest,
  SolveResult,
  SolveStateShareSummary,
} from '../solver/contract.ts';
import type {
  ConfigurationDocument,
  ResidualOverlayDomain,
  ResidualOverlayRow,
} from '../data/types.ts';
import type { ProjectedOverlayRow } from '../data/overlayProjection.ts';
import {
  resolveOverlayGrowthRates,
  projectOverlayRows,
} from '../data/overlayProjection.ts';
import {
  convertUnitQuantity,
  getCommodityMetadata,
  parseUnitRatio,
} from '../data/commodityMetadata.ts';

export interface ResultContributionRow {
  metric: 'emissions' | 'fuel' | 'cost';
  year: number;
  value: number;
  sourceKind: 'solver' | 'overlay';
  rowId?: string | null;
  outputId: string | null;
  outputLabel: string | null;
  sourceId: string;
  sourceLabel: string;
  pathwayStateId?: string | null;
  pathwayStateLabel?: string | null;
  provenance?: NormalizedSolverRowProvenance;
  sectorId: string;
  sectorLabel: string;
  subsectorId: string | null;
  subsectorLabel: string | null;
  commodityId: string | null;
  costComponent: 'conversion' | 'commodity' | 'carbon' | null;
  overlayId: string | null;
  overlayDomain: ResidualOverlayDomain | null;
}

type ShareLookupKey = string;

function shareKey(outputId: string, year: number, stateId: string): ShareLookupKey {
  return `${outputId}::${year}::${stateId}`;
}

function buildShareLookup(
  stateShares: SolveStateShareSummary[],
): Map<ShareLookupKey, SolveStateShareSummary> {
  const map = new Map<ShareLookupKey, SolveStateShareSummary>();
  for (const ss of stateShares) {
    map.set(shareKey(ss.outputId, ss.year, ss.stateId), ss);
  }
  return map;
}

function convertFuelConsumptionToPj(value: number, unit: string): number {
  const { numerator } = parseUnitRatio(unit);
  return convertUnitQuantity(value, numerator as 'GJ' | 'MWh' | 'PJ', 'PJ');
}

export function buildSolverContributionRows(
  request: SolveRequest,
  result: SolveResult,
): ResultContributionRow[] {
  const rows: ResultContributionRow[] = [];
  const lookup = buildShareLookup(result.reporting.stateShares);

  const balancedCommodityKeys = new Set(
    result.reporting.commodityBalances
      .filter((cb) => cb.mode !== 'externalized')
      .map((cb) => `${cb.commodityId}::${cb.year}`),
  );

  for (const row of request.rows) {
    const ss = lookup.get(shareKey(row.outputId, row.year, row.stateId));
    if (!ss || ss.activity === 0) continue;

    const solverBase = {
      sourceKind: 'solver' as const,
      rowId: ss.rowId ?? row.rowId,
      outputId: row.outputId,
      outputLabel: row.outputLabel,
      sourceId: row.stateId,
      sourceLabel: row.stateLabel,
      pathwayStateId: ss.pathwayStateId ?? row.provenance?.baseStateId ?? row.stateId,
      pathwayStateLabel: ss.pathwayStateLabel ?? row.provenance?.baseStateLabel ?? row.stateLabel,
      provenance: ss.provenance ?? row.provenance,
      sectorId: row.sector,
      sectorLabel: row.sector,
      subsectorId: row.subsector,
      subsectorLabel: row.subsector,
      overlayId: null,
      overlayDomain: null,
    };

    // Emissions by sector (tCO2e — no conversion needed)
    const totalEmissions = row.directEmissions.reduce((sum, e) => sum + e.value, 0);
    if (totalEmissions !== 0) {
      rows.push({
        metric: 'emissions',
        year: row.year,
        value: ss.activity * totalEmissions,
        ...solverBase,
        commodityId: null,
        costComponent: null,
      });
    }

    // Fuel consumption by commodity (PJ)
    for (const input of row.inputs) {
      const metadata = getCommodityMetadata(input.commodityId);
      if (metadata.kind !== 'fuel') continue;

      const consumption = convertFuelConsumptionToPj(ss.activity * input.coefficient, input.unit);
      if (consumption === 0) continue;

      rows.push({
        metric: 'fuel',
        year: row.year,
        value: consumption,
        ...solverBase,
        commodityId: input.commodityId,
        costComponent: null,
      });
    }

    // Cost: conversion component
    const conversion = ss.activity * (row.conversionCostPerUnit ?? 0);
    if (conversion !== 0) {
      rows.push({
        metric: 'cost',
        year: row.year,
        value: conversion,
        ...solverBase,
        commodityId: null,
        costComponent: 'conversion',
      });
    }

    // Cost: commodity component
    const commodity = ss.activity * row.inputs.reduce((total, input) => {
      if (balancedCommodityKeys.has(`${input.commodityId}::${row.year}`)) {
        return total;
      }
      const price =
        request.configuration.commodityPriceByCommodity[input.commodityId]
          ?.valuesByYear[String(row.year)] ?? 0;
      return total + input.coefficient * price;
    }, 0);
    if (commodity !== 0) {
      rows.push({
        metric: 'cost',
        year: row.year,
        value: commodity,
        ...solverBase,
        commodityId: null,
        costComponent: 'commodity',
      });
    }

    // Cost: carbon component
    const emissionsPerUnit = row.directEmissions.reduce((sum, e) => sum + e.value, 0);
    const carbon =
      ss.activity *
      emissionsPerUnit *
      (request.configuration.carbonPriceByYear[String(row.year)] ?? 0);
    if (carbon !== 0) {
      rows.push({
        metric: 'cost',
        year: row.year,
        value: carbon,
        ...solverBase,
        commodityId: null,
        costComponent: 'carbon',
      });
    }
  }

  return rows;
}

export function buildOverlayContributionRows(
  projectedRows: ProjectedOverlayRow[],
  carbonPriceByYear: Record<string, number>,
): ResultContributionRow[] {
  const rows: ResultContributionRow[] = [];

  for (const p of projectedRows) {
    // Emissions row: convert MtCO2e → tCO2e
    const directEmissions = p.directEnergyEmissionsMtco2e ?? 0;
    const otherEmissions = p.otherEmissionsMtco2e ?? 0;
    const totalEmissionsMt = directEmissions + otherEmissions;
    if (totalEmissionsMt !== 0) {
      rows.push({
        metric: 'emissions',
        year: p.year,
        value: totalEmissionsMt * 1_000_000,
        sourceKind: 'overlay',
        rowId: null,
        outputId: null,
        outputLabel: null,
        sourceId: p.overlayId,
        sourceLabel: p.overlayLabel,
        pathwayStateId: null,
        pathwayStateLabel: null,
        sectorId: p.overlayId,
        sectorLabel: p.overlayLabel,
        subsectorId: p.overlayId,
        subsectorLabel: p.overlayLabel,
        commodityId: null,
        costComponent: null,
        overlayId: p.overlayId,
        overlayDomain: p.overlayDomain,
      });
    }

    // Fuel row: energy_residual only, where commodity is not null and finalEnergyPj > 0
    if (
      p.overlayDomain === 'energy_residual' &&
      p.commodity !== null &&
      p.finalEnergyPj !== null &&
      p.finalEnergyPj > 0
    ) {
      rows.push({
        metric: 'fuel',
        year: p.year,
        value: p.finalEnergyPj,
        sourceKind: 'overlay',
        rowId: null,
        outputId: null,
        outputLabel: null,
        sourceId: p.overlayId,
        sourceLabel: p.overlayLabel,
        pathwayStateId: null,
        pathwayStateLabel: null,
        sectorId: p.overlayId,
        sectorLabel: p.overlayLabel,
        subsectorId: p.overlayId,
        subsectorLabel: p.overlayLabel,
        commodityId: p.commodity,
        costComponent: null,
        overlayId: p.overlayId,
        overlayDomain: p.overlayDomain,
      });
    }

    // Cost: commodity component
    const commodityCost = p.commodityCostAudm2024 ?? 0;
    if (commodityCost !== 0) {
      rows.push({
        metric: 'cost',
        year: p.year,
        value: commodityCost,
        sourceKind: 'overlay',
        rowId: null,
        outputId: null,
        outputLabel: null,
        sourceId: p.overlayId,
        sourceLabel: p.overlayLabel,
        pathwayStateId: null,
        pathwayStateLabel: null,
        sectorId: p.overlayId,
        sectorLabel: p.overlayLabel,
        subsectorId: p.overlayId,
        subsectorLabel: p.overlayLabel,
        commodityId: null,
        costComponent: 'commodity',
        overlayId: p.overlayId,
        overlayDomain: p.overlayDomain,
      });
    }

    // Cost: conversion component
    const conversionCost = p.fixedNonCommodityCostAudm2024 ?? 0;
    if (conversionCost !== 0) {
      rows.push({
        metric: 'cost',
        year: p.year,
        value: conversionCost,
        sourceKind: 'overlay',
        rowId: null,
        outputId: null,
        outputLabel: null,
        sourceId: p.overlayId,
        sourceLabel: p.overlayLabel,
        pathwayStateId: null,
        pathwayStateLabel: null,
        sectorId: p.overlayId,
        sectorLabel: p.overlayLabel,
        subsectorId: p.overlayId,
        subsectorLabel: p.overlayLabel,
        commodityId: null,
        costComponent: 'conversion',
        overlayId: p.overlayId,
        overlayDomain: p.overlayDomain,
      });
    }

    // Cost: carbon component
    // carbonBillableEmissionsMtco2e × carbonPrice(AUD/tCO2e) = AUD millions (1e6 factors cancel)
    const billableMt = p.carbonBillableEmissionsMtco2e ?? 0;
    const carbonPrice = carbonPriceByYear[String(p.year)] ?? 0;
    const carbonCost = billableMt * carbonPrice;
    if (carbonCost !== 0) {
      rows.push({
        metric: 'cost',
        year: p.year,
        value: carbonCost,
        sourceKind: 'overlay',
        rowId: null,
        outputId: null,
        outputLabel: null,
        sourceId: p.overlayId,
        sourceLabel: p.overlayLabel,
        pathwayStateId: null,
        pathwayStateLabel: null,
        sectorId: p.overlayId,
        sectorLabel: p.overlayLabel,
        subsectorId: p.overlayId,
        subsectorLabel: p.overlayLabel,
        commodityId: null,
        costComponent: 'carbon',
        overlayId: p.overlayId,
        overlayDomain: p.overlayDomain,
      });
    }
  }

  return rows;
}

function resolveIncludedOverlayIds(configuration: ConfigurationDocument): Set<string> {
  const controls = configuration.residual_overlays?.controls_by_overlay_id ?? {};
  const included = new Set<string>();
  for (const [id, control] of Object.entries(controls)) {
    if (control.included !== false) {
      included.add(id);
    }
  }
  return included;
}

function resolveServiceGrowthRates(configuration: ConfigurationDocument): Record<string, number> {
  return configuration.demand_generation.service_growth_rates_pct_per_year ?? {};
}

export function buildAllContributionRows(
  request: SolveRequest,
  result: SolveResult,
  residualOverlays2025: ResidualOverlayRow[],
  configuration: ConfigurationDocument,
): ResultContributionRow[] {
  const solverRows = buildSolverContributionRows(request, result);

  const includedIds = resolveIncludedOverlayIds(configuration);
  const includedOverlayRows = residualOverlays2025.filter((r) => includedIds.has(r.overlay_id));

  if (includedOverlayRows.length === 0) {
    return solverRows;
  }

  const serviceGrowthRates = resolveServiceGrowthRates(configuration);
  const overlayIds = Array.from(new Set(includedOverlayRows.map((r) => r.overlay_id)));
  const growthRates = resolveOverlayGrowthRates(overlayIds, serviceGrowthRates);

  const years = configuration.years.map(Number);
  const projected = projectOverlayRows(includedOverlayRows, years, growthRates);

  const overlayRows = buildOverlayContributionRows(
    projected,
    request.configuration.carbonPriceByYear,
  );

  return [...solverRows, ...overlayRows];
}
