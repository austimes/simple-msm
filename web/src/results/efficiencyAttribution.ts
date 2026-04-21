import type { StackedChartData } from './chartData.ts';
import type { ResultContributionRow } from './resultContributions.ts';
import { embodiedEfficiencyPathwayStateIds } from '../data/efficiencyAttributionRegistry.ts';

const ATTRIBUTION_EPSILON = 1e-9;

export type EfficiencyAttributionCategory =
  | 'autonomous_efficiency'
  | 'pure_efficiency_package'
  | 'operational_efficiency_package'
  | 'embodied_efficiency';

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

interface EfficiencyAttributionLineage {
  metric: EfficiencyAttributionMetric;
  year: number;
  outputId: string;
  totalsByRun: Record<RunSide, number>;
  bucketTotalsByRun: Record<RunSide, Map<AttributionBucket, number>>;
  presentBuckets: Set<AttributionBucket>;
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

function addToMap(map: Map<AttributionBucket, number>, key: AttributionBucket, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value);
}

function getBucketValue(map: Map<AttributionBucket, number>, key: AttributionBucket): number {
  return map.get(key) ?? 0;
}

function getTaggedStateId(row: ResultContributionRow): string | null {
  return row.pathwayStateId ?? row.provenance?.baseStateId ?? row.sourceId;
}

function classifyContributionRow(row: ResultContributionRow): AttributionBucket {
  const provenance = row.provenance;
  if (!provenance) {
    return 'none';
  }

  if (provenance.kind === 'efficiency_package') {
    if (provenance.packageClassification === 'pure_efficiency_overlay') {
      return 'pure_efficiency_package';
    }

    if (provenance.packageClassification === 'operational_efficiency_overlay') {
      return 'operational_efficiency_package';
    }

    return 'none';
  }

  if ((provenance.autonomousTrackIds?.length ?? 0) > 0) {
    return 'autonomous_efficiency';
  }

  return embodiedEfficiencyPathwayStateIds.has(getTaggedStateId(row) ?? '')
    ? 'embodied_efficiency'
    : 'none';
}

function buildLineageKey(row: ResultContributionRow): string {
  return [
    row.metric,
    String(row.year),
    row.outputId ?? row.sourceId,
    row.provenance?.baseRowId ?? row.rowId ?? row.sourceId,
  ].join('::');
}

function collectLineages(
  baseContributions: ResultContributionRow[],
  focusContributions: ResultContributionRow[],
): Map<string, EfficiencyAttributionLineage> {
  const lineages = new Map<string, EfficiencyAttributionLineage>();

  function accumulate(runSide: RunSide, rows: ResultContributionRow[]): void {
    for (const row of rows) {
      if (row.sourceKind !== 'solver' || row.outputId == null) {
        continue;
      }

      const key = buildLineageKey(row);
      const bucket = classifyContributionRow(row);
      const lineage = lineages.get(key) ?? {
        metric: row.metric,
        year: row.year,
        outputId: row.outputId,
        totalsByRun: { base: 0, focus: 0 },
        bucketTotalsByRun: { base: new Map(), focus: new Map() },
        presentBuckets: new Set(),
      } satisfies EfficiencyAttributionLineage;

      lineage.totalsByRun[runSide] += row.value;
      addToMap(lineage.bucketTotalsByRun[runSide], bucket, row.value);
      lineage.presentBuckets.add(bucket);
      lineages.set(key, lineage);
    }
  }

  accumulate('base', baseContributions);
  accumulate('focus', focusContributions);

  return lineages;
}

function distributeValue(
  bucketTotals: Map<AttributionBucket, number>,
  categories: EfficiencyAttributionCategory[],
  delta: number,
  explicitWeights?: Map<AttributionBucket, number>,
): void {
  if (categories.length === 0 || Math.abs(delta) <= ATTRIBUTION_EPSILON) {
    return;
  }

  const weights = categories.map((category) =>
    explicitWeights?.get(category) ?? Math.abs(bucketTotals.get(category) ?? 0));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let assigned = 0;

  categories.forEach((category, index) => {
    const isLast = index === categories.length - 1;
    const share = isLast
      ? delta - assigned
      : totalWeight <= ATTRIBUTION_EPSILON
        ? delta / categories.length
        : delta * (weights[index] / totalWeight);

    assigned += share;
    bucketTotals.set(category, (bucketTotals.get(category) ?? 0) + share);
  });
}

function collapseLineage(lineage: EfficiencyAttributionLineage): Map<AttributionBucket, number> {
  const totals = new Map<AttributionBucket, number>();
  const lineageNetDelta = lineage.totalsByRun.focus - lineage.totalsByRun.base;
  const directDeltaByBucket = new Map<AttributionBucket, number>();
  for (const bucket of ['none', ...efficiencyAttributionCategoryOrder] as AttributionBucket[]) {
    directDeltaByBucket.set(
      bucket,
      getBucketValue(lineage.bucketTotalsByRun.focus, bucket)
        - getBucketValue(lineage.bucketTotalsByRun.base, bucket),
    );
  }
  const packageCategories = efficiencyAttributionCategoryOrder.filter((category) =>
    (category === 'pure_efficiency_package' || category === 'operational_efficiency_package')
    && lineage.presentBuckets.has(category));

  if (packageCategories.length > 0) {
    const packageWeights = new Map<AttributionBucket, number>(
      packageCategories.map((category) => [category, Math.abs(directDeltaByBucket.get(category) ?? 0)]),
    );
    distributeValue(totals, packageCategories, lineageNetDelta, packageWeights);
    return totals;
  }

  if (lineage.presentBuckets.has('autonomous_efficiency')) {
    totals.set('autonomous_efficiency', lineageNetDelta);
    return totals;
  }

  if (lineage.presentBuckets.has('embodied_efficiency')) {
    totals.set('embodied_efficiency', lineageNetDelta);
    return totals;
  }

  const noneDelta = getBucketValue(lineage.bucketTotalsByRun.focus, 'none')
    - getBucketValue(lineage.bucketTotalsByRun.base, 'none');
  totals.set('none', noneDelta);
  return totals;
}

function buildOutputMetricBuckets(
  lineages: Map<string, EfficiencyAttributionLineage>,
): Map<string, Map<AttributionBucket, number>> {
  const grouped = new Map<string, Map<AttributionBucket, number>>();

  for (const lineage of lineages.values()) {
    const key = `${lineage.metric}::${lineage.year}::${lineage.outputId}`;
    const bucketTotals = grouped.get(key) ?? new Map<AttributionBucket, number>();
    const collapsed = collapseLineage(lineage);

    for (const [bucket, value] of collapsed) {
      addToMap(bucketTotals, bucket, value);
    }

    grouped.set(key, bucketTotals);
  }

  return grouped;
}

function rebalanceUnattributedDeltas(bucketTotals: Map<AttributionBucket, number>): void {
  const residual = bucketTotals.get('none') ?? 0;
  if (Math.abs(residual) <= ATTRIBUTION_EPSILON) {
    return;
  }

  let targets = efficiencyAttributionCategoryOrder.filter((category) => {
    const value = bucketTotals.get(category) ?? 0;
    return residual < 0 ? value > ATTRIBUTION_EPSILON : value < -ATTRIBUTION_EPSILON;
  });

  if (targets.length === 0) {
    targets = efficiencyAttributionCategoryOrder.filter((category) =>
      Math.abs(bucketTotals.get(category) ?? 0) > ATTRIBUTION_EPSILON);
  }

  if (targets.length === 0) {
    return;
  }

  distributeValue(bucketTotals, targets, residual);
  bucketTotals.set('none', 0);
}

export function buildEfficiencyAttributionRows(
  baseContributions: ResultContributionRow[],
  focusContributions: ResultContributionRow[],
): EfficiencyAttributionRow[] {
  const groupedByOutputMetric = buildOutputMetricBuckets(
    collectLineages(baseContributions, focusContributions),
  );
  const totalsByMetricYearCategory = new Map<string, number>();

  for (const [groupKey, bucketTotals] of groupedByOutputMetric) {
    rebalanceUnattributedDeltas(bucketTotals);
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
