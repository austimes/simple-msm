import type {
  NormalizedSolverRow,
  SolveObjectiveCostMetadata,
  SolveRequest,
  SolveResult,
  SolveStateShareSummary,
} from '../solver/contract';
import { getCommodityMetadata } from '../data/commodityMetadata.ts';
import { getPresentation } from '../data/chartPresentation.ts';
import { DEFAULT_RESIDUAL_OVERLAY_DISPLAY_MODE, getResidualOverlayDisplayBucket } from '../data/residualOverlayPresentation.ts';
import type { ResidualOverlayDisplayMode } from '../data/types.ts';
import type { ResultContributionRow } from './resultContributions.ts';

const ABSOLUTE_EMISSIONS_AXIS_LABEL = 'Emissions (tCO2e)';
const FUEL_CONSUMPTION_AXIS_LABEL = 'PJ';

export interface StackedSeries {
  key: string;
  label: string;
  legendLabel?: string;
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

export interface PathwayCapChartSeries {
  key: string;
  label: string;
  legendLabel?: string;
  color: string;
  capValues: Array<{ year: number; value: number }>;
  shareValues: Array<{ year: number; value: number }>;
}

export interface PathwayCapChartData {
  title: string;
  yAxisLabel: string;
  years: number[];
  series: PathwayCapChartSeries[];
}

export interface PathwayChartCardData {
  outputId: string;
  outputLabel: string;
  respectMaxShare: boolean;
  note: string;
  outputChart: StackedChartData;
  capChart: PathwayCapChartData;
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

function buildSeries(
  grouped: Map<string, Map<number, number>>,
  years: number[],
  options: {
    labelForKey: (key: string) => string;
    legendLabelForKey?: (key: string) => string;
    colorForKey: (key: string) => string;
  },
): StackedSeries[] {
  const series: StackedSeries[] = [];

  for (const [key, yearMap] of grouped) {
    const values = years.map((y) => ({ year: y, value: yearMap.get(y) ?? 0 }));
    const hasNonZero = values.some((v) => v.value !== 0);
    if (!hasNonZero) continue;

    const label = options.labelForKey(key);

    series.push({
      key,
      label,
      legendLabel: options.legendLabelForKey?.(key),
      color: options.colorForKey(key),
      values,
    });
  }

  return series;
}

function buildPathwayCapSeries(
  orderedKeys: string[],
  capGrouped: Map<string, Map<number, number>>,
  shareGrouped: Map<string, Map<number, number>>,
  years: number[],
  options: {
    labelForKey: (key: string) => string;
    legendLabelForKey?: (key: string) => string;
    colorForKey: (key: string) => string;
  },
): PathwayCapChartSeries[] {
  const series: PathwayCapChartSeries[] = [];

  for (const key of orderedKeys) {
    const capYearMap = capGrouped.get(key) ?? new Map<number, number>();
    const shareYearMap = shareGrouped.get(key) ?? new Map<number, number>();
    const capValues = years.map((year) => ({ year, value: capYearMap.get(year) ?? 0 }));
    const shareValues = years.map((year) => ({ year, value: shareYearMap.get(year) ?? 0 }));
    const hasAnyNonZero = capValues.some((value) => value.value !== 0)
      || shareValues.some((value) => value.value !== 0);

    if (!hasAnyNonZero) {
      continue;
    }

    series.push({
      key,
      label: options.labelForKey(key),
      legendLabel: options.legendLabelForKey?.(key),
      color: options.colorForKey(key),
      capValues,
      shareValues,
    });
  }

  return series;
}

function stripOverlayPrefix(key: string): string {
  return key.replace(/^overlay:/, '');
}

function getOverlaySeriesBucket(
  row: ResultContributionRow,
  displayMode: ResidualOverlayDisplayMode,
): { key: string; label: string } {
  const bucket = getResidualOverlayDisplayBucket(
    {
      overlayId: row.overlayId ?? row.sourceId,
      overlayDomain: row.overlayDomain ?? 'nonenergy_residual',
      overlayLabel: row.sourceLabel,
    },
    displayMode,
  );

  return {
    key: `overlay:${bucket.overlayId}`,
    label: bucket.overlayLabel,
  };
}

function buildCapChartNote(respectMaxShare: boolean): string {
  return respectMaxShare
    ? 'Cap chart shows effective max share after normalizing across active pathways.'
    : 'Cap chart shows effective max share across active pathways even when max-share enforcement is ignored in this solve.';
}

function resolveOutputLabel(request: SolveRequest, outputId: string): string {
  const first = request.rows.find((row) => row.outputId === outputId);

  return first?.outputLabel ?? outputId;
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
  displayMode: ResidualOverlayDisplayMode = DEFAULT_RESIDUAL_OVERLAY_DISPLAY_MODE,
): StackedChartData {
  const grouped = new Map<string, Map<number, number>>();

  for (const row of contributions) {
    if (row.metric !== 'emissions') continue;

    const key = row.sourceKind === 'overlay'
      ? getOverlaySeriesBucket(row, displayMode).key
      : row.sectorId;
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
    const seriesBucket = row.sourceKind === 'overlay'
      ? getOverlaySeriesBucket(row, displayMode)
      : { key: row.sectorId, label: row.sectorLabel };
    if (!labelLookup.has(seriesBucket.key)) {
      labelLookup.set(seriesBucket.key, seriesBucket.label);
    }
  }

  return {
    title: 'Emissions by Sector',
    yAxisLabel: ABSOLUTE_EMISSIONS_AXIS_LABEL,
    years,
    series: buildSeries(
      grouped,
      years,
      {
        labelForKey: (key) => labelLookup.get(key) ?? key,
        legendLabelForKey: (key) => getPresentation('sector', stripOverlayPrefix(key), labelLookup.get(key) ?? key).legendLabel,
        colorForKey: (key) => getPresentation('sector', stripOverlayPrefix(key), labelLookup.get(key) ?? key).color,
      },
    ),
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
    series: buildSeries(
      grouped,
      years,
      {
        labelForKey: (key) => getCommodityMetadata(key).label,
        legendLabelForKey: (key) => getPresentation('commodity', key, getCommodityMetadata(key).label).legendLabel,
        colorForKey: (key) => getPresentation('commodity', key, getCommodityMetadata(key).label).color,
      },
    ),
  };
}

export function buildDemandOverTimeChart(request: SolveRequest): StackedChartData {
  const years = request.configuration.years;
  const demandByOutput = request.configuration.serviceDemandByOutput;
  const grouped = new Map<string, Map<number, number>>();
  const outputLabelById = new Map<string, string>();

  for (const [outputId, yearTable] of Object.entries(demandByOutput)) {
    const yearMap = new Map<number, number>();
    for (const year of years) {
      const value = yearTable[String(year)] ?? 0;
      yearMap.set(year, value);
    }
    grouped.set(outputId, yearMap);
    outputLabelById.set(outputId, resolveOutputLabel(request, outputId));
  }

  return {
    title: 'Service Demand Over Time',
    yAxisLabel: 'Demand',
    years,
    series: buildSeries(grouped, years, {
      labelForKey: (key) => outputLabelById.get(key) ?? key,
      legendLabelForKey: (key) => getPresentation('output', key, outputLabelById.get(key) ?? key).legendLabel,
      colorForKey: (key) => getPresentation('output', key, outputLabelById.get(key) ?? key).color,
    }),
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
    series: buildSeries(grouped, years, {
      labelForKey: (key) => key,
      legendLabelForKey: (key) => getPresentation('sector', key, key).legendLabel,
      colorForKey: (key) => getPresentation('sector', key, key).color,
    }),
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
    series: buildSeries(grouped, years, {
      labelForKey: (key) => key,
      legendLabelForKey: (key) => getPresentation('subsector', key, key).legendLabel,
      colorForKey: (key) => getPresentation('subsector', key, key).color,
    }),
  };
}

export function buildEmissionsBySubsectorChart(
  contributions: ResultContributionRow[],
  years: number[],
  displayMode: ResidualOverlayDisplayMode = DEFAULT_RESIDUAL_OVERLAY_DISPLAY_MODE,
): StackedChartData {
  const grouped = new Map<string, Map<number, number>>();

  for (const row of contributions) {
    if (row.metric !== 'emissions') continue;

    const key = row.sourceKind === 'overlay'
      ? getOverlaySeriesBucket(row, displayMode).key
      : row.subsectorId;
    if (!key) continue;
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
    const seriesBucket = row.sourceKind === 'overlay'
      ? getOverlaySeriesBucket(row, displayMode)
      : { key: row.subsectorId, label: row.subsectorLabel ?? row.subsectorId };
    if (!seriesBucket.key) continue;
    if (!labelLookup.has(seriesBucket.key)) {
      labelLookup.set(seriesBucket.key, seriesBucket.label ?? seriesBucket.key);
    }
  }

  return {
    title: 'Emissions by Sub-sector',
    yAxisLabel: ABSOLUTE_EMISSIONS_AXIS_LABEL,
    years,
    series: buildSeries(
      grouped,
      years,
      {
        labelForKey: (key) => labelLookup.get(key) ?? key,
        legendLabelForKey: (key) => getPresentation('subsector', stripOverlayPrefix(key), labelLookup.get(key) ?? key).legendLabel,
        colorForKey: (key) => getPresentation('subsector', stripOverlayPrefix(key), labelLookup.get(key) ?? key).color,
      },
    ),
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

    let yearMap = grouped.get(row.costComponent);
    if (!yearMap) {
      yearMap = new Map<number, number>();
      grouped.set(row.costComponent, yearMap);
    }
    yearMap.set(row.year, (yearMap.get(row.year) ?? 0) + row.value);
  }

  return {
    title: 'Cost by Component',
    yAxisLabel: formatObjectiveCostAxisLabelFromMetadata(objectiveCost),
    years,
    series: buildSeries(
      grouped,
      years,
      {
        labelForKey: (key) => componentLabels[key] ?? key,
        legendLabelForKey: (key) => getPresentation('cost_component', key, componentLabels[key] ?? key).legendLabel,
        colorForKey: (key) => getPresentation('cost_component', key, componentLabels[key] ?? key).color,
      },
    ),
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
      const shareGrouped = new Map<string, Map<number, number>>();
      const stateLabelById = new Map<string, string>();
      const orderedStateIds: string[] = [];
      const seenStateIds = new Set<string>();

      for (const share of result.reporting.stateShares) {
        if (share.outputId !== outputId) {
          continue;
        }

        if (!seenStateIds.has(share.stateId)) {
          seenStateIds.add(share.stateId);
          orderedStateIds.push(share.stateId);
        }
        stateLabelById.set(share.stateId, share.stateLabel);

        let outputYearMap = outputGrouped.get(share.stateId);
        if (!outputYearMap) {
          outputYearMap = new Map<number, number>();
          outputGrouped.set(share.stateId, outputYearMap);
        }
        outputYearMap.set(share.year, share.activity);

        const effectiveMaxShare = share.effectiveMaxShare ?? 0;
        let capYearMap = capGrouped.get(share.stateId);
        if (!capYearMap) {
          capYearMap = new Map<number, number>();
          capGrouped.set(share.stateId, capYearMap);
        }
        capYearMap.set(share.year, effectiveMaxShare * 100);

        const solvedShare = share.share ?? 0;
        let shareYearMap = shareGrouped.get(share.stateId);
        if (!shareYearMap) {
          shareYearMap = new Map<number, number>();
          shareGrouped.set(share.stateId, shareYearMap);
        }
        shareYearMap.set(share.year, solvedShare * 100);
      }

      return {
        outputId,
        outputLabel: metadata.outputLabel,
        respectMaxShare,
        note: buildCapChartNote(respectMaxShare),
        outputChart: {
          title: `${metadata.outputLabel} Pathway Output`,
          yAxisLabel: metadata.outputUnit,
          years,
          series: buildSeries(
            outputGrouped,
            years,
            {
              labelForKey: (key) => stateLabelById.get(key) ?? key,
              legendLabelForKey: (key) => getPresentation('state', key, stateLabelById.get(key) ?? key).legendLabel,
              colorForKey: (key) => getPresentation('state', key, stateLabelById.get(key) ?? key).color,
            },
          ),
        },
        capChart: {
          title: `${metadata.outputLabel} Pathway Cap`,
          yAxisLabel: 'Share of output (%)',
          years,
          series: buildPathwayCapSeries(
            orderedStateIds,
            capGrouped,
            shareGrouped,
            years,
            {
              labelForKey: (key) => stateLabelById.get(key) ?? key,
              legendLabelForKey: (key) => getPresentation('state', key, stateLabelById.get(key) ?? key).legendLabel,
              colorForKey: (key) => getPresentation('state', key, stateLabelById.get(key) ?? key).color,
            },
          ),
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
    grouped.set('activity', activityByYear);
    if (maxActivityByYear.size > 0) {
      grouped.set('max_activity', maxActivityByYear);
    }

    return {
      outputId,
      outputLabel: metadata.outputLabel,
      outputUnit: metadata.outputUnit,
      activityChart: {
        title: `${metadata.outputLabel}`,
        yAxisLabel: metadata.outputUnit,
        years,
        series: buildSeries(
          grouped,
          years,
          {
            labelForKey: (key) => (key === 'activity' ? 'Activity' : key === 'max_activity' ? 'Max activity' : key),
            legendLabelForKey: (key) => getPresentation('metric', key, key === 'activity' ? 'Activity' : 'Max activity').legendLabel,
            colorForKey: (key) => getPresentation('metric', key, key === 'activity' ? 'Activity' : 'Max activity').color,
          },
        ),
      },
    } satisfies RemovalsChartCardData;
  });
}
