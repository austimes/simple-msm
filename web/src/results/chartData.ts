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
  const years = request.scenario.years;
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
  const years = request.scenario.years;
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
  const years = request.scenario.years;
  const demandByOutput = request.scenario.serviceDemandByOutput;
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
