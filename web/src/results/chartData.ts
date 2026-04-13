import type {
  NormalizedSolverRow,
  SolveObjectiveCostMetadata,
  SolveRequest,
  SolveResult,
  SolveStateShareSummary,
} from '../solver/contract';
import { getCommodityMetadata } from '../data/commodityMetadata.ts';
import type { ResultContributionRow } from './resultContributions.ts';

const CHART_PALETTE = [
  '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed',
  '#db2777', '#0891b2', '#65a30d', '#ea580c', '#4f46e5',
  '#0d9488', '#ca8a04',
];
const ABSOLUTE_EMISSIONS_AXIS_LABEL = 'Emissions (tCO2e)';
const FUEL_CONSUMPTION_AXIS_LABEL = 'PJ';

export interface StackedSeries {
  key: string;
  label: string;
  color: string;
  values: Array<{ year: number; value: number }>;
}

export interface StackedChartData {
  title: string;
  yAxisLabel: string;
  years: number[];
  series: StackedSeries[];
}

export interface LineChartData {
  title: string;
  yAxisLabel: string;
  years: number[];
  series: StackedSeries[];
}

export interface PathwayChartCardData {
  outputId: string;
  outputLabel: string;
  outputChart: StackedChartData;
  capChart: LineChartData;
}

export interface RemovalsChartCardData {
  outputId: string;
  outputLabel: string;
  outputUnit: string;
  activityChart: LineChartData;
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

function assignColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

function buildSeries(
  grouped: Map<string, Map<number, number>>,
  years: number[],
  labelFn: (key: string) => string,
): StackedSeries[] {
  const series: StackedSeries[] = [];
  let colorIdx = 0;

  for (const [key, yearMap] of grouped) {
    const values = years.map((y) => ({ year: y, value: yearMap.get(y) ?? 0 }));
    const hasNonZero = values.some((v) => v.value !== 0);
    if (!hasNonZero) continue;

    series.push({
      key,
      label: labelFn(key),
      color: assignColor(colorIdx),
      values,
    });
    colorIdx++;
  }

  return series;
}

function formatObjectiveCostAxisLabelFromMetadata(objectiveCost?: SolveObjectiveCostMetadata): string {
  if (!objectiveCost?.currency) {
    return 'Cost';
  }

  const parsedCurrency = objectiveCost.currency.match(/^(.*?)(?:_(\d{4}))?$/);
  const currencyBase = (parsedCurrency?.[1] ?? objectiveCost.currency).replaceAll('_', ' ').trim();
  const year = objectiveCost.costBasisYear ?? (
    parsedCurrency?.[2] ? Number(parsedCurrency[2]) : null
  );

  return year ? `${currencyBase} ${year}` : currencyBase;
}

export function buildEmissionsBySectorChart(
  contributions: ResultContributionRow[],
  years: number[],
): StackedChartData {
  const grouped = new Map<string, Map<number, number>>();

  for (const row of contributions) {
    if (row.metric !== 'emissions') continue;

    const key = row.sourceKind === 'overlay' ? `overlay:${row.sectorId}` : row.sectorId;
    let yearMap = grouped.get(key);
    if (!yearMap) {
      yearMap = new Map<number, number>();
      grouped.set(key, yearMap);
    }
    yearMap.set(row.year, (yearMap.get(row.year) ?? 0) + row.value);
  }

  const labelLookup = new Map<string, string>();
  for (const row of contributions) {
    if (row.metric !== 'emissions') continue;
    const key = row.sourceKind === 'overlay' ? `overlay:${row.sectorId}` : row.sectorId;
    if (!labelLookup.has(key)) labelLookup.set(key, row.sectorLabel);
  }

  return {
    title: 'Emissions by Sector',
    yAxisLabel: ABSOLUTE_EMISSIONS_AXIS_LABEL,
    years,
    series: buildSeries(grouped, years, (key) => labelLookup.get(key) ?? key),
  };
}

export function buildFuelConsumptionChart(
  contributions: ResultContributionRow[],
  years: number[],
): StackedChartData {
  const grouped = new Map<string, Map<number, number>>();

  for (const row of contributions) {
    if (row.metric !== 'fuel' || row.commodityId === null) continue;

    let yearMap = grouped.get(row.commodityId);
    if (!yearMap) {
      yearMap = new Map<number, number>();
      grouped.set(row.commodityId, yearMap);
    }
    yearMap.set(row.year, (yearMap.get(row.year) ?? 0) + row.value);
  }

  return {
    title: 'Fuel Consumption',
    yAxisLabel: FUEL_CONSUMPTION_AXIS_LABEL,
    years,
    series: buildSeries(grouped, years, (key) => getCommodityMetadata(key).label),
  };
}

export function buildDemandOverTimeChart(request: SolveRequest): StackedChartData {
  const years = request.configuration.years;
  const demandByOutput = request.configuration.serviceDemandByOutput;
  const grouped = new Map<string, Map<number, number>>();

  for (const [outputId, yearTable] of Object.entries(demandByOutput)) {
    const yearMap = new Map<number, number>();
    for (const year of years) {
      const value = yearTable[String(year)] ?? 0;
      yearMap.set(year, value);
    }
    grouped.set(outputId, yearMap);
  }

  return {
    title: 'Service Demand Over Time',
    yAxisLabel: 'Demand',
    years,
    series: buildSeries(grouped, years, (key) => key),
  };
}

function resolveOutputSubsector(
  request: SolveRequest,
  outputId: string,
): string {
  const subsectors = new Set<string>();
  for (const row of request.rows) {
    if (row.outputId === outputId) subsectors.add(row.subsector);
  }
  if (subsectors.size === 1) return [...subsectors][0];
  // Ambiguous mapping — fall back to the output label from the first matching row
  const first = request.rows.find((r) => r.outputId === outputId);
  return first?.outputLabel ?? outputId;
}

function resolveOutputSector(
  request: SolveRequest,
  outputId: string,
): string {
  const sectors = new Set<string>();
  for (const row of request.rows) {
    if (row.outputId === outputId) sectors.add(row.sector);
  }
  if (sectors.size === 1) return [...sectors][0];
  const first = request.rows.find((r) => r.outputId === outputId);
  return first?.sector ?? outputId;
}

export function buildDemandBySectorChart(request: SolveRequest): LineChartData {
  const years = request.configuration.years;
  const demandByOutput = request.configuration.serviceDemandByOutput;

  const outputToSector = new Map<string, string>();
  for (const outputId of Object.keys(demandByOutput)) {
    outputToSector.set(outputId, resolveOutputSector(request, outputId));
  }

  // Aggregate absolute demand by sector
  const grouped = new Map<string, Map<number, number>>();
  for (const [outputId, yearTable] of Object.entries(demandByOutput)) {
    const sector = outputToSector.get(outputId)!;
    let yearMap = grouped.get(sector);
    if (!yearMap) {
      yearMap = new Map<number, number>();
      grouped.set(sector, yearMap);
    }
    for (const year of years) {
      const value = yearTable[String(year)] ?? 0;
      yearMap.set(year, (yearMap.get(year) ?? 0) + value);
    }
  }

  // Convert to percentage relative to the first year
  const baseYear = years[0];
  for (const [, yearMap] of grouped) {
    const baseValue = yearMap.get(baseYear) ?? 0;
    if (baseValue === 0) continue;
    for (const year of years) {
      const raw = yearMap.get(year) ?? 0;
      yearMap.set(year, (raw / baseValue) * 100);
    }
  }

  return {
    title: 'Demand by Sector',
    yAxisLabel: `% of ${baseYear}`,
    years,
    series: buildSeries(grouped, years, (key) => key),
  };
}

export function buildDemandBySubsectorChart(request: SolveRequest): StackedChartData {
  const years = request.configuration.years;
  const demandByOutput = request.configuration.serviceDemandByOutput;

  // Map each outputId to its subsector
  const outputToSubsector = new Map<string, string>();
  for (const outputId of Object.keys(demandByOutput)) {
    outputToSubsector.set(outputId, resolveOutputSubsector(request, outputId));
  }

  const grouped = new Map<string, Map<number, number>>();
  for (const [outputId, yearTable] of Object.entries(demandByOutput)) {
    const subsector = outputToSubsector.get(outputId)!;
    let yearMap = grouped.get(subsector);
    if (!yearMap) {
      yearMap = new Map<number, number>();
      grouped.set(subsector, yearMap);
    }
    for (const year of years) {
      const value = yearTable[String(year)] ?? 0;
      yearMap.set(year, (yearMap.get(year) ?? 0) + value);
    }
  }

  return {
    title: 'Demand by Sub-sector',
    yAxisLabel: 'Demand',
    years,
    series: buildSeries(grouped, years, (key) => key),
  };
}

export function buildEmissionsBySubsectorChart(
  contributions: ResultContributionRow[],
  years: number[],
): StackedChartData {
  const grouped = new Map<string, Map<number, number>>();

  for (const row of contributions) {
    if (row.metric !== 'emissions') continue;

    const key = row.sourceKind === 'overlay' ? `overlay:${row.overlayId}` : row.sectorId;
    let yearMap = grouped.get(key);
    if (!yearMap) {
      yearMap = new Map<number, number>();
      grouped.set(key, yearMap);
    }
    yearMap.set(row.year, (yearMap.get(row.year) ?? 0) + row.value);
  }

  const labelLookup = new Map<string, string>();
  for (const row of contributions) {
    if (row.metric !== 'emissions') continue;
    const key = row.sourceKind === 'overlay' ? `overlay:${row.overlayId}` : row.sectorId;
    if (!labelLookup.has(key)) labelLookup.set(key, row.sourceKind === 'overlay' ? row.sourceLabel : row.sectorLabel);
  }

  return {
    title: 'Emissions by Sub-sector',
    yAxisLabel: ABSOLUTE_EMISSIONS_AXIS_LABEL,
    years,
    series: buildSeries(grouped, years, (key) => labelLookup.get(key) ?? key),
  };
}

export function buildCostByComponentChart(
  contributions: ResultContributionRow[],
  years: number[],
  objectiveCost?: SolveObjectiveCostMetadata,
): StackedChartData {
  const componentLabels: Record<string, string> = {
    conversion: 'Conversion',
    commodity: 'Commodity',
    carbon: 'Carbon',
  };

  const grouped = new Map<string, Map<number, number>>();

  for (const row of contributions) {
    if (row.metric !== 'cost' || row.costComponent === null) continue;

    const label = componentLabels[row.costComponent] ?? row.costComponent;
    let yearMap = grouped.get(label);
    if (!yearMap) {
      yearMap = new Map<number, number>();
      grouped.set(label, yearMap);
    }
    yearMap.set(row.year, (yearMap.get(row.year) ?? 0) + row.value);
  }

  return {
    title: 'Cost by Component',
    yAxisLabel: formatObjectiveCostAxisLabelFromMetadata(objectiveCost),
    years,
    series: buildSeries(grouped, years, (key) => key),
  };
}

export function buildPathwayChartCards(
  request: SolveRequest,
  result: SolveResult,
): PathwayChartCardData[] {
  const years = request.configuration.years;
  const outputRows = new Map<string, { outputLabel: string; outputUnit: string; stateIds: Set<string> }>();

  for (const row of request.rows) {
    const existing = outputRows.get(row.outputId);
    if (existing) {
      existing.stateIds.add(row.stateId);
      continue;
    }

    outputRows.set(row.outputId, {
      outputLabel: row.outputLabel,
      outputUnit: row.outputUnit,
      stateIds: new Set([row.stateId]),
    });
  }

  return Array.from(outputRows.entries())
    .filter(([, metadata]) => metadata.stateIds.size > 1)
    .map(([outputId, metadata]) => {
      const outputGrouped = new Map<string, Map<number, number>>();
      const capGrouped = new Map<string, Map<number, number>>();

      for (const share of result.reporting.stateShares) {
        if (share.outputId !== outputId) {
          continue;
        }

        let outputYearMap = outputGrouped.get(share.stateLabel);
        if (!outputYearMap) {
          outputYearMap = new Map<number, number>();
          outputGrouped.set(share.stateLabel, outputYearMap);
        }
        outputYearMap.set(share.year, share.activity);

        const effectiveMaxShare = share.effectiveMaxShare ?? 0;
        let capYearMap = capGrouped.get(share.stateLabel);
        if (!capYearMap) {
          capYearMap = new Map<number, number>();
          capGrouped.set(share.stateLabel, capYearMap);
        }
        capYearMap.set(share.year, effectiveMaxShare * 100);
      }

      return {
        outputId,
        outputLabel: metadata.outputLabel,
        outputChart: {
          title: `${metadata.outputLabel} Pathway Output`,
          yAxisLabel: metadata.outputUnit,
          years,
          series: buildSeries(outputGrouped, years, (key) => key),
        },
        capChart: {
          title: `${metadata.outputLabel} Pathway Cap`,
          yAxisLabel: 'Effective max share of output (current cap denominator)',
          years,
          series: buildSeries(capGrouped, years, (key) => key),
        },
      } satisfies PathwayChartCardData;
    });
}

export function buildRemovalsChartCards(
  request: SolveRequest,
  result: SolveResult,
): RemovalsChartCardData[] {
  const years = request.configuration.years;
  const lookup = buildShareLookup(result.reporting.stateShares);

  const outputRows = new Map<string, { outputLabel: string; outputUnit: string; rows: NormalizedSolverRow[] }>();

  for (const row of request.rows) {
    if (row.outputRole !== 'optional_activity') {
      continue;
    }

    const existing = outputRows.get(row.outputId);
    if (existing) {
      existing.rows.push(row);
      continue;
    }

    outputRows.set(row.outputId, {
      outputLabel: row.outputLabel,
      outputUnit: row.outputUnit,
      rows: [row],
    });
  }

  return Array.from(outputRows.entries()).map(([outputId, metadata]) => {
    const activityByYear = new Map<number, number>();
    const maxActivityByYear = new Map<number, number>();

    for (const row of metadata.rows) {
      const ss = lookup.get(shareKey(outputId, row.year, row.stateId));
      const activity = ss?.activity ?? 0;
      activityByYear.set(row.year, (activityByYear.get(row.year) ?? 0) + activity);

      if (row.bounds.maxActivity != null) {
        maxActivityByYear.set(row.year, (maxActivityByYear.get(row.year) ?? 0) + row.bounds.maxActivity);
      }
    }

    const grouped = new Map<string, Map<number, number>>();
    grouped.set('Activity', activityByYear);
    if (maxActivityByYear.size > 0) {
      grouped.set('Max activity', maxActivityByYear);
    }

    return {
      outputId,
      outputLabel: metadata.outputLabel,
      outputUnit: metadata.outputUnit,
      activityChart: {
        title: `${metadata.outputLabel}`,
        yAxisLabel: metadata.outputUnit,
        years,
        series: buildSeries(grouped, years, (key) => key),
      },
    } satisfies RemovalsChartCardData;
  });
}
