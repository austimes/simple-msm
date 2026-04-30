import type { StackedChartData } from './chartData.ts';
import type { ResultContributionRow } from './resultContributions.ts';
import type { EfficiencyAttributionCategory } from './efficiencyAttributionTypes.ts';
import { embodiedEfficiencyPathwayMethodIds } from '../data/efficiencyAttributionRegistry.ts';

const ATTRIBUTION_EPSILON = 1e-9;

export type { EfficiencyAttributionCategory } from './efficiencyAttributionTypes.ts';

export type EfficiencyAttributionMetric = ResultContributionRow['metric'];

type AttributionBucket = EfficiencyAttributionCategory | 'none';
type RunSide = 'base' | 'focus';

interface EfficiencyAttributionCategoryMetadata {
  label: string;
  color: string;
}

interface EfficiencyAttributionMetricMetadata {
  title: string;
  yAxisLabel: string;
}

interface EfficiencyAttributionOutputMetric {
  metric: EfficiencyAttributionMetric;
  year: number;
  outputId: string;
  totalsByRun: Record<RunSide, number>;
  componentTotalsByRun: Record<RunSide, Map<EfficiencyAttributionCategory, number>>;
  hasEmbodiedPathwayMethod: boolean;
}

export interface EfficiencyAttributionRow {
  metric: EfficiencyAttributionMetric;
  year: number;
  category: EfficiencyAttributionCategory;
  value: number;
}

export const efficiencyAttributionCategoryOrder: EfficiencyAttributionCategory[] = [
  'autonomous_efficiency',
  'pure_efficiency_package',
  'operational_efficiency_package',
  'embodied_efficiency',
];

export const efficiencyAttributionCategoryMetadata: Record<
  EfficiencyAttributionCategory,
  EfficiencyAttributionCategoryMetadata
> = {
  autonomous_efficiency: {
    label: 'Autonomous efficiency',
    color: '#0f766e',
  },
  pure_efficiency_package: {
    label: 'Pure efficiency package',
    color: '#b45309',
  },
  operational_efficiency_package: {
    label: 'Operational efficiency package',
    color: '#1d4ed8',
  },
  embodied_efficiency: {
    label: 'Embodied efficiency in pathway choice',
    color: '#be123c',
  },
};

const efficiencyAttributionMetricMetadata: Record<
  EfficiencyAttributionMetric,
  EfficiencyAttributionMetricMetadata
> = {
  fuel: {
    title: 'Fuel delta by efficiency attribution',
    yAxisLabel: 'PJ',
  },
  emissions: {
    title: 'Emissions delta by efficiency attribution',
    yAxisLabel: 'tCO2e',
  },
  cost: {
    title: 'Cost delta by efficiency attribution',
    yAxisLabel: 'AUD',
  },
};

function addToMap<T extends string>(map: Map<T, number>, key: T, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value);
}

function getTaggedMethodId(row: ResultContributionRow): string | null {
  return row.pathwayMethodId ?? row.provenance?.baseMethodId ?? row.sourceId;
}

function hasEmbodiedPathwayMethod(row: ResultContributionRow): boolean {
  return embodiedEfficiencyPathwayMethodIds.has(getTaggedMethodId(row) ?? '');
}

function buildOutputMetricKey(row: ResultContributionRow): string {
  return [row.metric, String(row.year), row.outputId ?? row.sourceId].join('::');
}

function collectOutputMetrics(
  baseContributions: ResultContributionRow[],
  focusContributions: ResultContributionRow[],
): Map<string, EfficiencyAttributionOutputMetric> {
  const outputMetrics = new Map<string, EfficiencyAttributionOutputMetric>();

  function accumulate(runSide: RunSide, rows: ResultContributionRow[]): void {
    for (const row of rows) {
      if (row.sourceKind !== 'solver' || row.outputId == null) {
        continue;
      }

      const key = buildOutputMetricKey(row);
      const outputMetric = outputMetrics.get(key) ?? {
        metric: row.metric,
        year: row.year,
        outputId: row.outputId,
        totalsByRun: { base: 0, focus: 0 },
        componentTotalsByRun: { base: new Map(), focus: new Map() },
        hasEmbodiedPathwayMethod: false,
      } satisfies EfficiencyAttributionOutputMetric;

      outputMetric.totalsByRun[runSide] += row.value;
      for (const [category, value] of Object.entries(row.efficiencyAttributionComponents ?? {})) {
        addToMap(
          outputMetric.componentTotalsByRun[runSide],
          category as EfficiencyAttributionCategory,
          value,
        );
      }
      outputMetric.hasEmbodiedPathwayMethod ||= hasEmbodiedPathwayMethod(row);
      outputMetrics.set(key, outputMetric);
    }
  }

  accumulate('base', baseContributions);
  accumulate('focus', focusContributions);

  return outputMetrics;
}

function distributeResidualAcrossCategories(
  bucketTotals: Map<AttributionBucket, number>,
  categories: EfficiencyAttributionCategory[],
  residual: number,
): void {
  if (categories.length === 0 || residual === 0) {
    return;
  }

  const weights = categories.map((category) => Math.abs(bucketTotals.get(category) ?? 0));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let assigned = 0;

  categories.forEach((category, index) => {
    const isLast = index === categories.length - 1;
    const share = isLast
      ? residual - assigned
      : totalWeight <= ATTRIBUTION_EPSILON
        ? residual / categories.length
        : residual * (weights[index] / totalWeight);

    assigned += share;
    bucketTotals.set(category, (bucketTotals.get(category) ?? 0) + share);
  });
}

function collapseOutputMetric(
  outputMetric: EfficiencyAttributionOutputMetric,
): Map<AttributionBucket, number> {
  const totals = new Map<AttributionBucket, number>();
  const actualNetDelta = outputMetric.totalsByRun.focus - outputMetric.totalsByRun.base;
  let explicitComponentDelta = 0;

  for (const category of efficiencyAttributionCategoryOrder) {
    const componentDelta =
      (outputMetric.componentTotalsByRun.focus.get(category) ?? 0)
      - (outputMetric.componentTotalsByRun.base.get(category) ?? 0);

    if (Math.abs(componentDelta) <= ATTRIBUTION_EPSILON) {
      continue;
    }

    totals.set(category, componentDelta);
    explicitComponentDelta += componentDelta;
  }

  const residual = actualNetDelta - explicitComponentDelta;
  if (Math.abs(residual) <= ATTRIBUTION_EPSILON) {
    distributeResidualAcrossCategories(
      totals,
      efficiencyAttributionCategoryOrder.filter((category) =>
        Math.abs(totals.get(category) ?? 0) > ATTRIBUTION_EPSILON),
      residual,
    );
  } else if (outputMetric.hasEmbodiedPathwayMethod) {
    addToMap(totals, 'embodied_efficiency', residual);
  } else {
    totals.set('none', residual);
  }

  return totals;
}

function buildOutputMetricBuckets(
  outputMetrics: Map<string, EfficiencyAttributionOutputMetric>,
): Map<string, Map<AttributionBucket, number>> {
  const grouped = new Map<string, Map<AttributionBucket, number>>();

  for (const outputMetric of outputMetrics.values()) {
    const key = `${outputMetric.metric}::${outputMetric.year}::${outputMetric.outputId}`;
    const bucketTotals = grouped.get(key) ?? new Map<AttributionBucket, number>();
    const collapsed = collapseOutputMetric(outputMetric);

    for (const [bucket, value] of collapsed) {
      addToMap(bucketTotals, bucket, value);
    }

    grouped.set(key, bucketTotals);
  }

  return grouped;
}

export function buildEfficiencyAttributionRows(
  baseContributions: ResultContributionRow[],
  focusContributions: ResultContributionRow[],
): EfficiencyAttributionRow[] {
  const groupedByOutputMetric = buildOutputMetricBuckets(
    collectOutputMetrics(baseContributions, focusContributions),
  );
  const totalsByMetricYearCategory = new Map<string, number>();

  for (const [groupKey, bucketTotals] of groupedByOutputMetric) {
    const [metric, yearValue] = groupKey.split('::');
    const year = Number(yearValue);

    for (const category of efficiencyAttributionCategoryOrder) {
      const value = bucketTotals.get(category) ?? 0;
      if (Math.abs(value) <= ATTRIBUTION_EPSILON) {
        continue;
      }

      const key = `${metric}::${year}::${category}`;
      totalsByMetricYearCategory.set(key, (totalsByMetricYearCategory.get(key) ?? 0) + value);
    }
  }

  return Array.from(totalsByMetricYearCategory.entries())
    .map(([key, value]) => {
      const [metric, yearValue, category] = key.split('::');
      return {
        metric: metric as EfficiencyAttributionMetric,
        year: Number(yearValue),
        category: category as EfficiencyAttributionCategory,
        value,
      } satisfies EfficiencyAttributionRow;
    })
    .sort((left, right) =>
      left.year - right.year
      || left.metric.localeCompare(right.metric)
      || efficiencyAttributionCategoryOrder.indexOf(left.category)
      - efficiencyAttributionCategoryOrder.indexOf(right.category));
}

export function buildEfficiencyAttributionChartData(
  rows: EfficiencyAttributionRow[],
  metric: EfficiencyAttributionMetric,
  availableYears: number[],
): StackedChartData {
  const years = Array.from(new Set([
    ...availableYears,
    ...rows.filter((row) => row.metric === metric).map((row) => row.year),
  ])).sort((left, right) => left - right);
  const valuesByCategory = new Map<EfficiencyAttributionCategory, Map<number, number>>();

  for (const row of rows) {
    if (row.metric !== metric) {
      continue;
    }

    const valuesByYear = valuesByCategory.get(row.category) ?? new Map<number, number>();
    valuesByYear.set(row.year, (valuesByYear.get(row.year) ?? 0) + row.value);
    valuesByCategory.set(row.category, valuesByYear);
  }

  return {
    title: efficiencyAttributionMetricMetadata[metric].title,
    yAxisLabel: efficiencyAttributionMetricMetadata[metric].yAxisLabel,
    years,
    series: efficiencyAttributionCategoryOrder
      .map((category) => ({
        key: category,
        label: efficiencyAttributionCategoryMetadata[category].label,
        color: efficiencyAttributionCategoryMetadata[category].color,
        values: years.map((year) => ({
          year,
          value: valuesByCategory.get(category)?.get(year) ?? 0,
        })),
      }))
      .filter((series) => series.values.some((entry) => Math.abs(entry.value) > ATTRIBUTION_EPSILON)),
  };
}

function formatCompactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(2)}k`;
  }

  return value.toFixed(2);
}

export function formatEfficiencyAttributionValue(
  metric: EfficiencyAttributionMetric,
  value: number,
): string {
  if (metric === 'fuel') {
    return `${value.toFixed(2)} PJ`;
  }

  if (metric === 'emissions') {
    if (Math.abs(value) >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(2)} MtCO2e`;
    }

    return `${formatCompactNumber(value)} tCO2e`;
  }

  return `$${formatCompactNumber(value)}`;
}
