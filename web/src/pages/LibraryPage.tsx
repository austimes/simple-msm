import React, { useMemo } from 'react';
import {
  buildStateCommodityLegendLabel,
  buildStateMetricLegendLabel,
  getPresentation,
} from '../data/chartPresentation.ts';
import {
  buildInputCommoditySeries,
  buildSectorStateFamilies,
  buildSectorStateFamilySearchText,
  buildSectorStateTrajectory,
  buildSectorSubsectorIndex,
  type SectorStateTrajectory,
} from '../data/libraryInsights';
import { type LibraryFilters } from '../data/appUiState.ts';
import { useAppUiStore } from '../data/appUiStore.ts';
import { getCommodityMetadata } from '../data/commodityMetadata.ts';
import { usePackageStore } from '../data/packageStore';
import type { AssumptionLedgerEntry, SectorState, SourceLedgerEntry } from '../data/types';
import LineChart, { type LineChartSeries } from './library/LineChart';
import { buildAdaptiveAxisNumberFormatter } from './library/axisFormatting.ts';
import LibrarySidebarFrame from './library/LibrarySidebarFrame';

void React;

interface MetricConfig {
  key: 'cost' | 'energy' | 'process' | 'maxShare' | 'maxActivity';
  label: string;
  pick: (trajectory: SectorStateTrajectory, year: number) => number | null;
  formatCell: (value: number | null, trajectory: SectorStateTrajectory) => string;
}

interface TrajectoryNarrativeProps {
  label: string;
  rows: SectorState[];
  pick: (row: SectorState) => string;
}

const COEFFICIENT_DASH_PATTERNS = [undefined, '7 5', '3 4', '10 4 2 4', '2 3'];

const numberFormatter = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('en-AU', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const axisPercentFormatter = new Intl.NumberFormat('en-AU', {
  style: 'percent',
  maximumFractionDigits: 0,
});

function formatUnitLabel(unit: string): string {
  return unit.trim().replaceAll('_', ' ');
}

function buildCostUnitLabel(currency: string, outputUnit: string): string {
  return `${formatUnitLabel(currency)} per ${formatUnitLabel(outputUnit)}`;
}

function resolveCommodityLabel(commodityId: string): string {
  try {
    return getCommodityMetadata(commodityId).label;
  } catch {
    return commodityId;
  }
}

function resolveSharedUnitLabel(units: string[], mixedLabel = 'Mixed units'): string {
  const uniqueUnits = Array.from(new Set(units.map((unit) => unit.trim()).filter(Boolean)));

  if (uniqueUnits.length === 0) {
    return 'Units unavailable';
  }

  return uniqueUnits.length === 1 ? uniqueUnits[0] : mixedLabel;
}

function formatNullableNumber(value: number | null, suffix = ''): string {
  if (value == null) {
    return '—';
  }

  return `${numberFormatter.format(value)}${suffix}`;
}

function formatPercentAxis(value: number): string {
  return axisPercentFormatter.format(value);
}

function collectChartSeriesValues(series: LineChartSeries[]): number[] {
  return series.flatMap((entry) =>
    entry.values.flatMap((point) => (typeof point.value === 'number' && Number.isFinite(point.value) ? [point.value] : [])));
}

function buildNarrativeEntries(rows: SectorState[], pick: (row: SectorState) => string) {
  const entries = rows
    .map((row) => ({ year: row.year, value: pick(row).trim() }))
    .filter((entry) => entry.value.length > 0);

  const uniqueValues = Array.from(new Set(entries.map((entry) => entry.value)));

  return {
    sharedValue: uniqueValues.length === 1 ? uniqueValues[0] : null,
    entries: uniqueValues.length === 1 ? [] : entries,
  };
}

function matchesTrajectoryFilters(
  trajectory: ReturnType<typeof buildSectorStateFamilies>[number],
  selectedSector: string,
  selectedSubsector: string,
  filters: LibraryFilters,
) {
  if (selectedSector && trajectory.sector !== selectedSector) {
    return false;
  }

  if (selectedSubsector && trajectory.subsector !== selectedSubsector) {
    return false;
  }

  if (filters.confidence && !trajectory.confidenceRatings.includes(filters.confidence)) {
    return false;
  }

  if (filters.region && !trajectory.rows.some((row) => row.region === filters.region)) {
    return false;
  }

  if (filters.sourceId && !trajectory.sourceIds.includes(filters.sourceId)) {
    return false;
  }

  if (filters.assumptionId && !trajectory.assumptionIds.includes(filters.assumptionId)) {
    return false;
  }

  if (filters.search) {
    const searchText = buildSectorStateFamilySearchText(trajectory);
    const tokens = filters.search
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (!tokens.every((token) => searchText.includes(token))) {
      return false;
    }
  }

  return true;
}

function TrajectoryNarrative({ label, rows, pick }: TrajectoryNarrativeProps) {
  const detail = buildNarrativeEntries(rows, pick);

  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {detail.sharedValue ? (
          detail.sharedValue
        ) : detail.entries.length > 0 ? (
          <div className="library-yearly-note-list">
            {detail.entries.map((entry) => (
              <div key={`${label}:${entry.year}:${entry.value}`} className="library-yearly-note-item">
                <span>{entry.year}</span>
                <p>{entry.value}</p>
              </div>
            ))}
          </div>
        ) : (
          '—'
        )}
      </dd>
    </div>
  );
}

export default function LibraryPage() {
  const enrichment = usePackageStore((state) => state.enrichment);
  const sectorStates = usePackageStore((state) => state.sectorStates);
  const {
    filters,
    sidebarCollapsed,
    selectedSector,
    selectedSubsector,
    selectedTrajectoryId,
  } = useAppUiStore((state) => state.library);
  const updateLibraryUi = useAppUiStore((state) => state.updateLibraryUi);
  const setLibraryFilters = useAppUiStore((state) => state.setLibraryFilters);
  const resetLibraryUi = useAppUiStore((state) => state.resetLibraryUi);

  const families = useMemo(() => buildSectorStateFamilies(sectorStates), [sectorStates]);
  const sectorIndex = useMemo(() => buildSectorSubsectorIndex(sectorStates), [sectorStates]);

  const resolvedSelectedSector =
    selectedSector && sectorIndex.sectors.includes(selectedSector)
      ? selectedSector
      : sectorIndex.sectors[0] ?? '';
  const visibleSubsectors = resolvedSelectedSector ? sectorIndex.subsectorsBySector[resolvedSelectedSector] ?? [] : [];
  const resolvedSelectedSubsector =
    selectedSubsector && visibleSubsectors.includes(selectedSubsector)
      ? selectedSubsector
      : visibleSubsectors[0] ?? '';

  const filterOptions = useMemo(() => {
    return {
      confidenceRatings: Array.from(new Set(sectorStates.map((row) => row.confidence_rating))).sort((left, right) => left.localeCompare(right)),
      regions: Array.from(new Set(sectorStates.map((row) => row.region))).sort((left, right) => left.localeCompare(right)),
      sourceIds: Array.from(new Set(sectorStates.flatMap((row) => row.source_ids))).sort((left, right) => left.localeCompare(right)),
      assumptionIds: Array.from(new Set(sectorStates.flatMap((row) => row.assumption_ids))).sort((left, right) => left.localeCompare(right)),
    };
  }, [sectorStates]);

  const filteredFamilies = useMemo(() => {
    return families.filter((family) => matchesTrajectoryFilters(family, resolvedSelectedSector, resolvedSelectedSubsector, filters));
  }, [families, resolvedSelectedSector, resolvedSelectedSubsector, filters]);

  const visibleTrajectories = useMemo(() => filteredFamilies.map((family) => buildSectorStateTrajectory(family)), [filteredFamilies]);

  const visibleYears = useMemo(() => {
    return Array.from(new Set(visibleTrajectories.flatMap((trajectory) => trajectory.points.map((point) => point.year)))).sort(
      (left, right) => left - right,
    );
  }, [visibleTrajectories]);

  const resolvedSelectedTrajectoryId =
    selectedTrajectoryId && visibleTrajectories.some((trajectory) => trajectory.stateId === selectedTrajectoryId)
      ? selectedTrajectoryId
      : visibleTrajectories[0]?.stateId ?? null;

  const selectedTrajectory =
    visibleTrajectories.find((trajectory) => trajectory.stateId === resolvedSelectedTrajectoryId) ?? null;

  const colorByTrajectoryId = useMemo(() => {
    return new Map(
      visibleTrajectories.map((trajectory) => [
        trajectory.stateId,
        getPresentation('state', trajectory.stateId, trajectory.label).color,
      ]),
    );
  }, [visibleTrajectories]);

  const metricSeries = useMemo(() => {
    const selectSeries = (trajectory: SectorStateTrajectory, metricKey: string): LineChartSeries => ({
      key: `${trajectory.stateId}::${metricKey}`,
      label: trajectory.label,
      legendLabel: getPresentation('state', trajectory.stateId, trajectory.label).legendLabel,
      color: colorByTrajectoryId.get(trajectory.stateId) ?? getPresentation('state', trajectory.stateId, trajectory.label).color,
      active: trajectory.stateId === resolvedSelectedTrajectoryId,
      values: trajectory.points.map((point) => ({
        year: point.year,
        value:
          metricKey === 'cost'
            ? point.cost
            : metricKey === 'maxShare'
              ? point.maxShare
              : metricKey === 'maxActivity'
                ? point.maxActivity
                : metricKey === 'energy'
                  ? point.energyTotal
                  : point.processTotal,
      })),
    });

    return {
      cost: visibleTrajectories.map((trajectory) => selectSeries(trajectory, 'cost')),
      maxShare: visibleTrajectories.map((trajectory) => selectSeries(trajectory, 'maxShare')),
      maxActivity: visibleTrajectories.map((trajectory) => selectSeries(trajectory, 'maxActivity')),
      emissions: visibleTrajectories.flatMap((trajectory) => [
        {
          ...selectSeries(trajectory, 'energy'),
          key: `${trajectory.stateId}::energy`,
          label: `${trajectory.label} · energy`,
          legendLabel: buildStateMetricLegendLabel(trajectory.stateId, 'energy'),
        },
        {
          ...selectSeries(trajectory, 'process'),
          key: `${trajectory.stateId}::process`,
          label: `${trajectory.label} · process`,
          legendLabel: buildStateMetricLegendLabel(trajectory.stateId, 'process'),
          dashArray: '7 5',
        },
      ]),
    };
  }, [colorByTrajectoryId, resolvedSelectedTrajectoryId, visibleTrajectories]);

  const trajectorySelectionItems = useMemo(() => {
    return visibleTrajectories.map((trajectory) => ({
      stateId: trajectory.stateId,
      label: trajectory.label,
      color: colorByTrajectoryId.get(trajectory.stateId) ?? getPresentation('state', trajectory.stateId, trajectory.label).color,
      active: trajectory.stateId === resolvedSelectedTrajectoryId,
    }));
  }, [colorByTrajectoryId, resolvedSelectedTrajectoryId, visibleTrajectories]);

  const comparisonMetrics = useMemo<MetricConfig[]>(() => {
    return [
      {
        key: 'cost',
        label: 'Cost',
        pick: (trajectory, year) => trajectory.points.find((point) => point.year === year)?.cost ?? null,
        formatCell: (value, trajectory) => (value == null ? '—' : `${trajectory.currency} ${numberFormatter.format(value)}`),
      },
      {
        key: 'energy',
        label: 'Energy',
        pick: (trajectory, year) => trajectory.points.find((point) => point.year === year)?.energyTotal ?? null,
        formatCell: (value) => formatNullableNumber(value),
      },
      {
        key: 'process',
        label: 'Process emissions',
        pick: (trajectory, year) => trajectory.points.find((point) => point.year === year)?.processTotal ?? null,
        formatCell: (value) => formatNullableNumber(value),
      },
      {
        key: 'maxShare',
        label: 'Max share',
        pick: (trajectory, year) => trajectory.points.find((point) => point.year === year)?.maxShare ?? null,
        formatCell: (value) => (value == null ? '—' : percentFormatter.format(value)),
      },
      {
        key: 'maxActivity',
        label: 'Max activity',
        pick: (trajectory, year) => trajectory.points.find((point) => point.year === year)?.maxActivity ?? null,
        formatCell: (value) => formatNullableNumber(value),
      },
    ];
  }, []);

  const sourceLedgerById = useMemo(() => {
    return new Map(enrichment.sourceLedger.map((entry) => [entry.sourceId, entry]));
  }, [enrichment.sourceLedger]);

  const assumptionsLedgerById = useMemo(() => {
    return new Map(enrichment.assumptionsLedger.map((entry) => [entry.assumptionId, entry]));
  }, [enrichment.assumptionsLedger]);

  const selectedSourceEntries = selectedTrajectory
    ? selectedTrajectory.sourceIds.reduce<SourceLedgerEntry[]>((entries, sourceId) => {
        const entry = sourceLedgerById.get(sourceId);

        if (entry) {
          entries.push(entry);
        }

        return entries;
      }, [])
    : [];

  const selectedAssumptionEntries = selectedTrajectory
    ? selectedTrajectory.assumptionIds.reduce<AssumptionLedgerEntry[]>((entries, assumptionId) => {
        const entry = assumptionsLedgerById.get(assumptionId);

        if (entry) {
          entries.push(entry);
        }

        return entries;
      }, [])
    : [];

  const coefficientChart = useMemo(() => {
    const commodityStyles = Array.from(
      filteredFamilies.reduce<Map<string, string>>((entries, family) => {
        buildInputCommoditySeries(family).forEach((entry) => {
          if (!entries.has(entry.commodity)) {
            entries.set(entry.commodity, entry.unit);
          }
        });

        return entries;
      }, new Map()),
    )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([commodity, unit], index) => ({
        commodity,
        unit,
        dashArray: COEFFICIENT_DASH_PATTERNS[index % COEFFICIENT_DASH_PATTERNS.length],
      }));

    const dashByCommodity = new Map(commodityStyles.map((style) => [style.commodity, style.dashArray]));
    const units = Array.from(new Set(commodityStyles.map((style) => style.unit)));
    const series = filteredFamilies
      .flatMap((family) => {
        return buildInputCommoditySeries(family).map<LineChartSeries>((entry) => ({
          key: `${family.stateId}::${entry.commodity}`,
          label: `${family.label} · ${resolveCommodityLabel(entry.commodity)}`,
          legendLabel: buildStateCommodityLegendLabel(family.stateId, entry.commodity),
          color: colorByTrajectoryId.get(family.stateId) ?? getPresentation('state', family.stateId, family.label).color,
          dashArray: dashByCommodity.get(entry.commodity),
          active: family.stateId === resolvedSelectedTrajectoryId,
          values: entry.values,
        }));
      })
      .sort((left, right) => Number(Boolean(left.active)) - Number(Boolean(right.active)));

    return {
      commodityStyles,
      series,
      units,
    };
  }, [colorByTrajectoryId, filteredFamilies, resolvedSelectedTrajectoryId]);

  const axisFormatters = useMemo(() => {
    return {
      cost: buildAdaptiveAxisNumberFormatter(collectChartSeriesValues(metricSeries.cost), { minDomain: 0 }),
      emissions: buildAdaptiveAxisNumberFormatter(collectChartSeriesValues(metricSeries.emissions), { minDomain: 0 }),
      maxActivity: buildAdaptiveAxisNumberFormatter(collectChartSeriesValues(metricSeries.maxActivity), { minDomain: 0 }),
      coefficients: buildAdaptiveAxisNumberFormatter(collectChartSeriesValues(coefficientChart.series), { minDomain: 0 }),
    };
  }, [coefficientChart.series, metricSeries.cost, metricSeries.emissions, metricSeries.maxActivity]);

  const chartAxisLabels = useMemo(() => {
    return {
      cost: resolveSharedUnitLabel(
        visibleTrajectories.map((trajectory) => buildCostUnitLabel(trajectory.currency, trajectory.outputUnit)),
      ),
      emissions: resolveSharedUnitLabel(visibleTrajectories.map((trajectory) => formatUnitLabel(trajectory.emissionsUnit))),
      maxShare: '%',
      maxActivity: resolveSharedUnitLabel(visibleTrajectories.map((trajectory) => formatUnitLabel(trajectory.outputUnit))),
      coefficients: resolveSharedUnitLabel(coefficientChart.units.map((unit) => formatUnitLabel(unit))),
    };
  }, [coefficientChart.units, visibleTrajectories]);

  const resetFilters = () => {
    resetLibraryUi();
  };

  return (
    <div className="page page--library">
      <h1>Library</h1>
      <p>
        Compare sector-state trajectories over time, then drill into the notes, assumptions,
        sources, and input coefficient curves behind each available state for the selected subsector.
      </p>

      <div className={`library-sidebar-layout${sidebarCollapsed ? ' library-sidebar-layout--collapsed' : ''}`}>
        <LibrarySidebarFrame
          collapsed={sidebarCollapsed}
          onToggle={() => updateLibraryUi({ sidebarCollapsed: !sidebarCollapsed })}
          title="Scope"
          bodyId="library-sidebar-body"
        >
          <section className="library-filter-strip">
            <div className="library-sidebar-intro">
              <p>
                Click a sector to refresh the available subsectors, then use the advanced filters
                to narrow the comparison.
              </p>
              <button type="button" className="library-clear-button" onClick={resetFilters}>
                Reset view
              </button>
            </div>

            <div className="library-chip-section">
              <span className="library-chip-label">Sector</span>
              <div className="library-chip-row">
                {sectorIndex.sectors.map((sector) => (
                  <button
                    key={sector}
                    type="button"
                    className={`library-chip${sector === resolvedSelectedSector ? ' library-chip--active' : ''}`}
                    onClick={() => {
                      updateLibraryUi({
                        selectedSector: sector,
                        selectedSubsector: '',
                        selectedTrajectoryId: null,
                      });
                    }}
                  >
                    {sector}
                  </button>
                ))}
              </div>
            </div>

            <div className="library-chip-section">
              <span className="library-chip-label">Subsector</span>
              <div className="library-chip-row">
                {visibleSubsectors.map((subsector) => (
                  <button
                    key={subsector}
                    type="button"
                    className={`library-chip${subsector === resolvedSelectedSubsector ? ' library-chip--active' : ''}`}
                    onClick={() => {
                      updateLibraryUi({
                        selectedSubsector: subsector,
                        selectedTrajectoryId: null,
                      });
                    }}
                  >
                    {subsector}
                  </button>
                ))}
              </div>
            </div>

            <div className="library-filter-grid">
              <label className="library-field library-field--wide">
                <span>Search</span>
                <input
                  value={filters.search}
                  onChange={(event) => setLibraryFilters({ search: event.target.value })}
                  placeholder="State label, evidence, notes, source ID"
                />
              </label>

              <label className="library-field">
                <span>Confidence</span>
                <select
                  value={filters.confidence}
                  onChange={(event) => setLibraryFilters({ confidence: event.target.value })}
                >
                  <option value="">All ratings</option>
                  {filterOptions.confidenceRatings.map((confidence) => (
                    <option key={confidence} value={confidence}>
                      {confidence}
                    </option>
                  ))}
                </select>
              </label>

              <label className="library-field">
                <span>Region</span>
                <select
                  value={filters.region}
                  onChange={(event) => setLibraryFilters({ region: event.target.value })}
                >
                  <option value="">All regions</option>
                  {filterOptions.regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>

              <label className="library-field">
                <span>Source ID</span>
                <select
                  value={filters.sourceId}
                  onChange={(event) => setLibraryFilters({ sourceId: event.target.value })}
                >
                  <option value="">All sources</option>
                  {filterOptions.sourceIds.map((sourceId) => (
                    <option key={sourceId} value={sourceId}>
                      {sourceId}
                    </option>
                  ))}
                </select>
              </label>

              <label className="library-field">
                <span>Assumption ID</span>
                <select
                  value={filters.assumptionId}
                  onChange={(event) => setLibraryFilters({ assumptionId: event.target.value })}
                >
                  <option value="">All assumptions</option>
                  {filterOptions.assumptionIds.map((assumptionId) => (
                    <option key={assumptionId} value={assumptionId}>
                      {assumptionId}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        </LibrarySidebarFrame>

        <div className="library-main-content">
          {visibleTrajectories.length > 0 ? (
            <>
              <section className="configuration-panel library-state-selector-panel">
                <div className="library-panel-heading">
                  <div>
                    <h2>State highlight</h2>
                    <p>Choose one trajectory here to emphasize it across the charts, comparison matrix, detail pane, and coefficient facets.</p>
                  </div>
                  <span className="library-count-pill">{trajectorySelectionItems.length} states</span>
                </div>

                <div className="library-state-selector-grid">
                  {trajectorySelectionItems.map((trajectory) => (
                    <button
                      key={trajectory.stateId}
                      type="button"
                      className={`library-state-selector-button${trajectory.active ? ' library-state-selector-button--active' : ''}`}
                      onClick={() => updateLibraryUi({ selectedTrajectoryId: trajectory.stateId })}
                      aria-pressed={trajectory.active}
                    >
                      <span className="library-state-selector-swatch" style={{ backgroundColor: trajectory.color }} />
                      <span className="library-state-selector-copy">
                        <strong>{trajectory.label}</strong>
                        <span>{trajectory.stateId}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="library-trajectory-grid">
                <article className="configuration-panel library-chart-card">
                  <div className="library-panel-heading">
                    <div>
                      <h2>Cost trajectory</h2>
                      <p>Conversion cost per output unit over time for each available state.</p>
                    </div>
                  </div>
                  <LineChart
                    ariaLabel="Cost trajectories"
                    years={visibleYears}
                    series={metricSeries.cost}
                    valueFormatter={(value) => numberFormatter.format(value)}
                    axisFormatter={axisFormatters.cost}
                    yAxisLabel={chartAxisLabels.cost}
                    legendMode="hidden"
                    minDomain={0}
                  />
                </article>

                <article className="configuration-panel library-chart-card">
                  <div className="library-panel-heading">
                    <div>
                      <h2>Energy and process emissions</h2>
                      <p>Shared plot with solid energy lines and dashed process-emissions lines.</p>
                    </div>
                  </div>
                  <LineChart
                    ariaLabel="Energy and process emissions trajectories"
                    years={visibleYears}
                    series={metricSeries.emissions}
                    valueFormatter={(value) => numberFormatter.format(value)}
                    axisFormatter={axisFormatters.emissions}
                    yAxisLabel={chartAxisLabels.emissions}
                    legendMode="hidden"
                    minDomain={0}
                  />
                </article>

                <article className="configuration-panel library-chart-card">
                  <div className="library-panel-heading">
                    <div>
                      <h2>Max share</h2>
                      <p>Upper share envelope by state trajectory.</p>
                    </div>
                  </div>
                  <LineChart
                    ariaLabel="Max share trajectories"
                    years={visibleYears}
                    series={metricSeries.maxShare}
                    valueFormatter={(value) => percentFormatter.format(value)}
                    axisFormatter={formatPercentAxis}
                    yAxisLabel={chartAxisLabels.maxShare}
                    legendMode="hidden"
                    minDomain={0}
                  />
                </article>

                <article className="configuration-panel library-chart-card">
                  <div className="library-panel-heading">
                    <div>
                      <h2>Max activity</h2>
                      <p>Activity cap over time for each trajectory.</p>
                    </div>
                  </div>
                  <LineChart
                    ariaLabel="Max activity trajectories"
                    years={visibleYears}
                    series={metricSeries.maxActivity}
                    valueFormatter={(value) => numberFormatter.format(value)}
                    axisFormatter={axisFormatters.maxActivity}
                    yAxisLabel={chartAxisLabels.maxActivity}
                    legendMode="hidden"
                    minDomain={0}
                  />
                </article>

                <article className="configuration-panel library-chart-card library-coefficient-panel">
                  <div className="library-panel-heading">
                    <div>
                      <h2>Input coefficient trajectories</h2>
                      <p>Shared plot of input coefficients across the visible states, using the same highlight treatment as the charts above.</p>
                    </div>
                  </div>

                  {coefficientChart.series.length > 0 ? (
                    <>
                      <LineChart
                        ariaLabel="Input coefficient trajectories"
                        years={visibleYears}
                        series={coefficientChart.series}
                        valueFormatter={(value) => numberFormatter.format(value)}
                        axisFormatter={axisFormatters.coefficients}
                        yAxisLabel={chartAxisLabels.coefficients}
                        legendMode="hidden"
                        minDomain={0}
                      />

                      {coefficientChart.commodityStyles.length > 1 ? (
                        <div className="library-coefficient-style-guide" aria-label="Input coefficient commodity line styles">
                          {coefficientChart.commodityStyles.map((style) => (
                            <span key={style.commodity} className="library-coefficient-style-chip">
                              <svg viewBox="0 0 24 8" aria-hidden="true" className="library-coefficient-style-swatch">
                                <line
                                  x1="1"
                                  x2="23"
                                  y1="4"
                                  y2="4"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeDasharray={style.dashArray}
                                />
                              </svg>
                              <span>
                                {style.commodity} ({style.unit})
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <p className="library-inline-note">
                        State colors match the shared highlight selector and the charts above.
                        {coefficientChart.commodityStyles.length > 1 ? ' Line styles distinguish input commodities.' : ''}{' '}
                        {coefficientChart.units.length > 1
                          ? `Coefficient units overlaid here: ${coefficientChart.units.map((unit) => formatUnitLabel(unit)).join(', ')}.`
                          : `Coefficient unit: ${formatUnitLabel(coefficientChart.units[0] ?? '—')}.`}
                      </p>
                    </>
                  ) : (
                    <p className="library-inline-note">No explicit input coefficient trajectories are packaged for the visible states.</p>
                  )}
                </article>
              </section>

              <article className="configuration-panel library-list-panel">
                <div className="library-panel-heading">
                  <div>
                    <h2>Trajectory comparison matrix</h2>
                    <p>
                      Rows are grouped by trajectory. Use the shared state list to drive the
                      chart highlight, or click any metric row to focus the detail pane on that
                      state trajectory.
                    </p>
                  </div>
                  <span className="library-count-pill">{visibleTrajectories.length} states</span>
                </div>

                <div className="library-comparison-shell">
                  <table className="library-comparison-table">
                    <thead>
                      <tr>
                        <th>State</th>
                        <th>Metric</th>
                        {visibleYears.map((year) => (
                          <th key={year}>{year}</th>
                        ))}
                      </tr>
                    </thead>
                    {visibleTrajectories.map((trajectory) => (
                      <tbody
                        key={trajectory.stateId}
                        className={trajectory.stateId === resolvedSelectedTrajectoryId ? 'library-comparison-group library-comparison-group--selected' : 'library-comparison-group'}
                      >
                        {comparisonMetrics.map((metric, index) => (
                          <tr
                            key={`${trajectory.stateId}:${metric.key}`}
                            className="library-comparison-row"
                            onClick={() => updateLibraryUi({ selectedTrajectoryId: trajectory.stateId })}
                          >
                            {index === 0 ? (
                              <th rowSpan={comparisonMetrics.length} className="library-comparison-trajectory-cell">
                                <strong>{trajectory.label}</strong>
                                <small>{trajectory.stateId}</small>
                                <span>{trajectory.serviceOrOutputName}</span>
                              </th>
                            ) : null}
                            <th className="library-comparison-metric-cell">{metric.label}</th>
                            {visibleYears.map((year) => (
                              <td key={`${trajectory.stateId}:${metric.key}:${year}`}>{metric.formatCell(metric.pick(trajectory, year), trajectory)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    ))}
                  </table>
                </div>
              </article>

              <article className="configuration-panel library-detail-panel">
                {selectedTrajectory ? (
                  <>
                    <div className="library-detail-hero">
                      <div>
                        <div className="library-badge-row">
                          <span className="configuration-badge">Selected trajectory</span>
                          {selectedTrajectory.confidenceRatings.map((rating) => (
                            <span key={rating} className={`library-confidence-pill library-confidence-pill--${rating.toLowerCase()}`}>
                              {rating}
                            </span>
                          ))}
                        </div>
                        <h2>{selectedTrajectory.label}</h2>
                        <p>{selectedTrajectory.representative.state_description}</p>
                      </div>
                      <dl className="library-detail-summary">
                        <div>
                          <dt>State ID</dt>
                          <dd>{selectedTrajectory.stateId}</dd>
                        </div>
                        <div>
                          <dt>Sector</dt>
                          <dd>{selectedTrajectory.sector}</dd>
                        </div>
                        <div>
                          <dt>Subsector</dt>
                          <dd>{selectedTrajectory.subsector}</dd>
                        </div>
                        <div>
                          <dt>Service/output</dt>
                          <dd>{selectedTrajectory.serviceOrOutputName}</dd>
                        </div>
                        <div>
                          <dt>Years</dt>
                          <dd>{selectedTrajectory.points.map((point) => point.year).join(', ')}</dd>
                        </div>
                        <div>
                          <dt>Region</dt>
                          <dd>{selectedTrajectory.region}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="library-detail-grid">
                      <section className="library-detail-section">
                        <h3>Trajectory notes</h3>
                        <dl className="library-detail-list">
                          <TrajectoryNarrative label="Output quantity basis" rows={selectedTrajectory.rows} pick={(row) => row.output_quantity_basis} />
                          <TrajectoryNarrative label="Cost components summary" rows={selectedTrajectory.rows} pick={(row) => row.cost_components_summary} />
                          <TrajectoryNarrative label="Input basis notes" rows={selectedTrajectory.rows} pick={(row) => row.input_basis_notes} />
                          <TrajectoryNarrative label="Emissions boundary notes" rows={selectedTrajectory.rows} pick={(row) => row.emissions_boundary_notes} />
                        </dl>
                      </section>
                    </div>

                    <div className="library-detail-grid">
                      <section className="library-detail-section">
                        <h3>Evidence and confidence</h3>
                        <dl className="library-detail-list">
                          <TrajectoryNarrative label="Evidence summary" rows={selectedTrajectory.rows} pick={(row) => row.evidence_summary} />
                          <TrajectoryNarrative label="Derivation method" rows={selectedTrajectory.rows} pick={(row) => row.derivation_method} />
                          <TrajectoryNarrative label="Confidence rating" rows={selectedTrajectory.rows} pick={(row) => row.confidence_rating} />
                          <TrajectoryNarrative label="Review notes" rows={selectedTrajectory.rows} pick={(row) => row.review_notes} />
                        </dl>
                      </section>

                      <section className="library-detail-section">
                        <h3>Limits and expansion path</h3>
                        <dl className="library-detail-list">
                          <TrajectoryNarrative label="Rollout limit notes" rows={selectedTrajectory.rows} pick={(row) => row.rollout_limit_notes} />
                          <TrajectoryNarrative label="Availability conditions" rows={selectedTrajectory.rows} pick={(row) => row.availability_conditions} />
                          <TrajectoryNarrative label="Candidate expansion pathway" rows={selectedTrajectory.rows} pick={(row) => row.candidate_expansion_pathway} />
                          <TrajectoryNarrative label="TIMES/VedaLang mapping notes" rows={selectedTrajectory.rows} pick={(row) => row.times_or_vedalang_mapping_notes} />
                        </dl>
                        <div className="library-boolean-grid">
                          <div className="configuration-stat-card">
                            <span>Expand to explicit capacity</span>
                            <strong>{selectedTrajectory.rows.some((row) => row.would_expand_to_explicit_capacity) ? 'Yes' : 'No'}</strong>
                          </div>
                          <div className="configuration-stat-card">
                            <span>Expand to process chain</span>
                            <strong>{selectedTrajectory.rows.some((row) => row.would_expand_to_process_chain) ? 'Yes' : 'No'}</strong>
                          </div>
                        </div>
                      </section>
                    </div>

                    <section className="library-detail-section">
                      <h3>Raw trust IDs</h3>
                      <div className="library-tag-groups">
                        <div>
                          <span className="library-tag-group-title">Source IDs</span>
                          <div className="library-tag-list">
                            {selectedTrajectory.sourceIds.map((sourceId) => (
                              <span key={sourceId} className="library-tag">
                                {sourceId}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="library-tag-group-title">Assumption IDs</span>
                          <div className="library-tag-list">
                            {selectedTrajectory.assumptionIds.map((assumptionId) => (
                              <span key={assumptionId} className="library-tag">
                                {assumptionId}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {selectedSourceEntries.length > 0 || selectedAssumptionEntries.length > 0 ? (
                        <div className="library-detail-grid">
                          {selectedSourceEntries.length > 0 ? (
                            <section className="library-detail-section">
                              <h3>Source ledger entries</h3>
                              <div className="library-tag-groups">
                                {selectedSourceEntries.map((entry) => (
                                  <div key={entry.sourceId}>
                                    <span className="library-tag-group-title">
                                      {entry.sourceId} · {entry.institution}
                                    </span>
                                    <dl className="library-detail-list">
                                      <div>
                                        <dt>Citation</dt>
                                        <dd>{entry.citation}</dd>
                                      </div>
                                      <div>
                                        <dt>Publication date</dt>
                                        <dd>{entry.publicationDate || '—'}</dd>
                                      </div>
                                      <div>
                                        <dt>Parameters informed</dt>
                                        <dd>{entry.parametersInformed}</dd>
                                      </div>
                                      <div>
                                        <dt>Authority note</dt>
                                        <dd>{entry.qualityNotes}</dd>
                                      </div>
                                      <div>
                                        <dt>Location</dt>
                                        <dd>{entry.location}</dd>
                                      </div>
                                    </dl>
                                  </div>
                                ))}
                              </div>
                            </section>
                          ) : null}

                          {selectedAssumptionEntries.length > 0 ? (
                            <section className="library-detail-section">
                              <h3>Assumption ledger entries</h3>
                              <div className="library-tag-groups">
                                {selectedAssumptionEntries.map((entry) => (
                                  <div key={entry.assumptionId}>
                                    <span className="library-tag-group-title">{entry.assumptionId}</span>
                                    <dl className="library-detail-list">
                                      <div>
                                        <dt>Statement</dt>
                                        <dd>{entry.statement}</dd>
                                      </div>
                                      <div>
                                        <dt>Rationale</dt>
                                        <dd>{entry.rationale}</dd>
                                      </div>
                                      <div>
                                        <dt>Affected scope</dt>
                                        <dd>{entry.affectedScope}</dd>
                                      </div>
                                      <div>
                                        <dt>Sensitivity importance</dt>
                                        <dd>{entry.sensitivityImportance}</dd>
                                      </div>
                                      <div>
                                        <dt>Validation route</dt>
                                        <dd>{entry.validationRoute}</dd>
                                      </div>
                                    </dl>
                                  </div>
                                ))}
                              </div>
                            </section>
                          ) : null}
                        </div>
                      ) : enrichment.sourceLedger.length === 0 && enrichment.assumptionsLedger.length === 0 ? (
                        <p className="library-inline-note">
                          Optional source and assumption ledgers were not packaged, so this view can only show the raw trust IDs for the selected trajectory.
                        </p>
                      ) : null}
                    </section>
                  </>
                ) : (
                  <div className="library-empty-state">
                    <h3>No trajectory selected</h3>
                    <p>Choose a subsector with visible states to populate the detail view.</p>
                  </div>
                )}
              </article>
            </>
          ) : (
            <section className="configuration-panel library-empty-state">
              <h2>No trajectories match the current filters.</h2>
              <p>Clear one or two advanced filters or switch subsectors to restore the comparison views.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
