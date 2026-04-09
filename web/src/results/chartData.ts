import type {
  SolveRequest,
  SolveResult,
  SolveStateShareSummary,
} from '../solver/contract';

const CHART_PALETTE = [
  '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed',
  '#db2777', '#0891b2', '#65a30d', '#ea580c', '#4f46e5',
  '#0d9488', '#ca8a04',
];

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
  note: string;
  respectMaxShare: boolean;
  outputChart: StackedChartData;
  capChart: LineChartData;
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

export function buildEmissionsBySectorChart(
  request: SolveRequest,
  result: SolveResult,
): StackedChartData {
  const years = request.configuration.years;
  const lookup = buildShareLookup(result.reporting.stateShares);
  const grouped = new Map<string, Map<number, number>>();

  for (const row of request.rows) {
    const ss = lookup.get(shareKey(row.outputId, row.year, row.stateId));
    if (!ss || ss.activity === 0) continue;

    const totalEmissions = row.directEmissions.reduce((sum, e) => sum + e.value, 0);
    if (totalEmissions === 0) continue;

    const emissions = ss.activity * totalEmissions;

    let yearMap = grouped.get(row.sector);
    if (!yearMap) {
      yearMap = new Map<number, number>();
      grouped.set(row.sector, yearMap);
    }
    yearMap.set(row.year, (yearMap.get(row.year) ?? 0) + emissions);
  }

  return {
    title: 'Emissions by Sector',
    yAxisLabel: 'Emissions',
    years,
    series: buildSeries(grouped, years, (key) => key),
  };
}

export function buildCommodityConsumptionChart(
  request: SolveRequest,
  result: SolveResult,
): StackedChartData {
  const years = request.configuration.years;
  const lookup = buildShareLookup(result.reporting.stateShares);
  const grouped = new Map<string, Map<number, number>>();

  for (const row of request.rows) {
    const ss = lookup.get(shareKey(row.outputId, row.year, row.stateId));
    if (!ss || ss.activity === 0) continue;

    for (const input of row.inputs) {
      const consumption = ss.activity * input.coefficient;
      if (consumption === 0) continue;

      let yearMap = grouped.get(input.commodityId);
      if (!yearMap) {
        yearMap = new Map<number, number>();
        grouped.set(input.commodityId, yearMap);
      }
      yearMap.set(row.year, (yearMap.get(row.year) ?? 0) + consumption);
    }
  }

  return {
    title: 'Commodity Consumption',
    yAxisLabel: 'Consumption',
    years,
    series: buildSeries(grouped, years, (key) => key),
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
  request: SolveRequest,
  result: SolveResult,
): StackedChartData {
  const years = request.configuration.years;
  const lookup = buildShareLookup(result.reporting.stateShares);
  const grouped = new Map<string, Map<number, number>>();

  for (const row of request.rows) {
    const ss = lookup.get(shareKey(row.outputId, row.year, row.stateId));
    if (!ss || ss.activity === 0) continue;

    const totalEmissions = row.directEmissions.reduce((sum, e) => sum + e.value, 0);
    if (totalEmissions === 0) continue;

    const emissions = ss.activity * totalEmissions;

    let yearMap = grouped.get(row.subsector);
    if (!yearMap) {
      yearMap = new Map<number, number>();
      grouped.set(row.subsector, yearMap);
    }
    yearMap.set(row.year, (yearMap.get(row.year) ?? 0) + emissions);
  }

  return {
    title: 'Emissions by Sub-sector',
    yAxisLabel: 'Emissions',
    years,
    series: buildSeries(grouped, years, (key) => key),
  };
}

export function buildCostByComponentChart(
  request: SolveRequest,
  result: SolveResult,
): StackedChartData {
  const years = request.configuration.years;
  const lookup = buildShareLookup(result.reporting.stateShares);

  const conversionMap = new Map<number, number>();
  const commodityMap = new Map<number, number>();
  const carbonMap = new Map<number, number>();

  const balancedCommodityKeys = new Set(
    result.reporting.commodityBalances
      .filter((cb) => cb.mode !== 'externalized')
      .map((cb) => `${cb.commodityId}::${cb.year}`),
  );

  for (const row of request.rows) {
    const ss = lookup.get(shareKey(row.outputId, row.year, row.stateId));
    if (!ss || ss.activity === 0) continue;

    const conversion = ss.activity * (row.conversionCostPerUnit ?? 0);
    if (conversion !== 0) {
      conversionMap.set(row.year, (conversionMap.get(row.year) ?? 0) + conversion);
    }

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
      commodityMap.set(row.year, (commodityMap.get(row.year) ?? 0) + commodity);
    }

    const emissionsPerUnit = row.directEmissions.reduce(
      (total, emission) => total + emission.value,
      0,
    );
    const carbon =
      ss.activity *
      emissionsPerUnit *
      (request.configuration.carbonPriceByYear[String(row.year)] ?? 0);
    if (carbon !== 0) {
      carbonMap.set(row.year, (carbonMap.get(row.year) ?? 0) + carbon);
    }
  }

  const grouped = new Map<string, Map<number, number>>();
  grouped.set('Conversion', conversionMap);
  grouped.set('Commodity', commodityMap);
  grouped.set('Carbon', carbonMap);

  return {
    title: 'Cost by Component',
    yAxisLabel: 'Cost',
    years,
    series: buildSeries(grouped, years, (key) => key),
  };
}

export function buildPathwayChartCards(
  request: SolveRequest,
  result: SolveResult,
): PathwayChartCardData[] {
  const years = request.configuration.years;
  const respectMaxShare = request.configuration.options.respectMaxShare;
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
      let hasNormalizedCaps = false;

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

        if (
          share.rawMaxShare != null
          && share.effectiveMaxShare != null
          && Math.abs(share.rawMaxShare - share.effectiveMaxShare) > 1e-9
        ) {
          hasNormalizedCaps = true;
        }
      }

      const note = !respectMaxShare
        ? 'Max-share caps were ignored in this solve. Cap view shows the normalized available-pathway caps for context only.'
        : hasNormalizedCaps
          ? 'Cap view shows effective max shares after normalizing the available pathways within each year.'
          : 'Cap view shows the effective max shares applied to each available pathway.';

      return {
        outputId,
        outputLabel: metadata.outputLabel,
        note,
        respectMaxShare,
        outputChart: {
          title: `${metadata.outputLabel} Pathway Output`,
          yAxisLabel: metadata.outputUnit,
          years,
          series: buildSeries(outputGrouped, years, (key) => key),
        },
        capChart: {
          title: `${metadata.outputLabel} Pathway Cap`,
          yAxisLabel: 'Share of enabled output',
          years,
          series: buildSeries(capGrouped, years, (key) => key),
        },
      } satisfies PathwayChartCardData;
    });
}
