import type { StackedSeries } from '../../results/chartData';

export interface RechartsRow {
  year: number;
  [seriesKey: string]: number | string | null;
}

export interface ChartSeriesSummary {
  key: string;
  label: string;
  color: string;
  nullPoints: number;
  negativePoints: number;
  positivePoints: number;
}

interface DomainOptions {
  paddingRatio?: number;
  minDomain?: number;
  roundTo?: number;
}

interface BuildStackedBarRowsOptions {
  includeNet?: boolean;
}

export function buildNumericRows(
  years: number[],
  series: ReadonlyArray<{
    key: string;
    values: ReadonlyArray<{ year: number; value: number | null }>;
  }>,
  fillMissingWith: number | null,
): RechartsRow[] {
  return years.map((year) => {
    const row: RechartsRow = { year };

    for (const entry of series) {
      const point = entry.values.find((value) => value.year === year);
      row[entry.key] = point?.value ?? fillMissingWith;
    }

    return row;
  });
}

export function buildZeroFilledRows(
  years: number[],
  series: ReadonlyArray<StackedSeries>,
): RechartsRow[] {
  return buildNumericRows(years, series, 0);
}

export function buildNullableRows<
  TSeries extends {
    key: string;
    values: ReadonlyArray<{ year: number; value: number | null }>;
  },
>(
  years: number[],
  series: ReadonlyArray<TSeries>,
): RechartsRow[] {
  return buildNumericRows(years, series, null);
}

export function summarizeSeries<
  TSeries extends {
    key: string;
    label: string;
    legendLabel?: string;
    color: string;
    values: ReadonlyArray<{ value: number | null }>;
  },
>(
  series: ReadonlyArray<TSeries>,
): ChartSeriesSummary[] {
  return series.map((entry) => {
    let nullPoints = 0;
    let negativePoints = 0;
    let positivePoints = 0;

    for (const point of entry.values) {
      if (point.value == null) {
        nullPoints++;
      } else if (point.value < 0) {
        negativePoints++;
      } else if (point.value > 0) {
        positivePoints++;
      }
    }

    return {
      key: entry.key,
      label: entry.label,
      color: entry.color,
      nullPoints,
      negativePoints,
      positivePoints,
    };
  });
}

export function collectNumericValues(rows: RechartsRow[], seriesKeys: string[]): number[] {
  const values: number[] = [];

  for (const row of rows) {
    for (const key of seriesKeys) {
      const value = row[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        values.push(value);
      }
    }
  }

  return values;
}

export function computeDomain(values: number[], options: DomainOptions = {}): [number, number] {
  const {
    paddingRatio = 0.08,
    minDomain,
    roundTo,
  } = options;

  const numericValues = values.filter((value) => Number.isFinite(value));
  if (numericValues.length === 0) {
    return [0, 1];
  }

  let domainMin = Math.min(...numericValues);
  let domainMax = Math.max(...numericValues);

  if (minDomain != null) {
    domainMin = Math.min(minDomain, domainMin);
  }

  if (domainMin === domainMax) {
    const pad = Math.abs(domainMin) * paddingRatio || 1;
    domainMin -= pad;
    domainMax += pad;
  } else {
    const pad = (domainMax - domainMin) * paddingRatio;
    domainMin -= pad;
    domainMax += pad;
  }

  if (roundTo != null && roundTo > 0) {
    domainMin = Math.floor(domainMin / roundTo) * roundTo;
    domainMax = Math.ceil(domainMax / roundTo) * roundTo;
  }

  return [domainMin, domainMax];
}

export function buildStackedBarRows(
  years: number[],
  series: ReadonlyArray<StackedSeries>,
  options: BuildStackedBarRowsOptions = {},
) {
  const rows = buildZeroFilledRows(years, series);
  const netKey = options.includeNet ? '__net' : undefined;
  const positiveTotals: number[] = [];
  const negativeTotals: number[] = [];
  const netValues: number[] = [];
  let hasAnyNonZero = false;

  rows.forEach((row) => {
    let positiveTotal = 0;
    let negativeTotal = 0;
    let netValue = 0;

    for (const entry of series) {
      const rawValue = row[entry.key];
      const value = typeof rawValue === 'number' ? rawValue : 0;
      if (value !== 0) {
        hasAnyNonZero = true;
      }
      netValue += value;
      if (value > 0) {
        positiveTotal += value;
      } else if (value < 0) {
        negativeTotal += value;
      }
    }

    if (netKey) {
      row[netKey] = netValue;
    }
    positiveTotals.push(positiveTotal);
    negativeTotals.push(negativeTotal);
    netValues.push(netValue);
  });

  return {
    rows,
    positiveTotals,
    negativeTotals,
    netKey,
    netValues,
    hasAnyNonZero,
  };
}
