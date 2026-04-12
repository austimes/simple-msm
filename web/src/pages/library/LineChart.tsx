import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import {
  buildResponsiveContainerProps,
  CHART_AXIS_TICK_STYLE,
  CHART_AXIS_TITLE_STYLE,
  CHART_GRID_DASHARRAY,
  CHART_GRID_STROKE,
  LIBRARY_CHART_HEIGHT,
  LIBRARY_CHART_MARGIN,
} from '../../components/charts/chartTheme';
import {
  buildNullableRows,
  collectNumericValues,
  computeDomain,
  summarizeSeries,
} from '../../components/charts/rechartsAdapters';

void React;

export interface LineChartSeries {
  key: string;
  label: string;
  color: string;
  values: Array<{
    year: number;
    value: number | null;
  }>;
  dashArray?: string;
  active?: boolean;
}

type LineChartLegendMode = 'full' | 'compact' | 'hidden';

interface LineChartProps {
  ariaLabel: string;
  years: number[];
  series: LineChartSeries[];
  valueFormatter: (value: number) => string;
  axisFormatter?: (value: number) => string;
  yAxisLabel?: string;
  emptyMessage?: string;
  onSelectSeries?: (series: LineChartSeries) => void;
  minDomain?: number;
  legendMode?: LineChartLegendMode;
}

interface LibraryDotProps {
  cx?: number;
  cy?: number;
  value?: number | null;
}

const BASE_ACTIVE_STROKE_WIDTH = 4;
const BASE_STROKE_WIDTH = 3;
const BASE_ACTIVE_POINT_RADIUS = 4.5;
const BASE_POINT_RADIUS = 3.5;

function LibraryLegendSwatch({
  color,
  dashArray,
  active,
  activeSeriesPresent,
}: {
  color: string;
  dashArray?: string;
  active?: boolean;
  activeSeriesPresent: boolean;
}) {
  return (
    <span
      className="library-chart-legend-swatch"
      style={{
        backgroundColor: color,
        opacity: activeSeriesPresent ? (active ? 1 : 0.35) : 0.8,
      }}
    >
      {dashArray ? <span className="library-chart-legend-swatch--dash" /> : null}
    </span>
  );
}

function createDotRenderer(
  entry: LineChartSeries,
  opacity: number,
  onSelectSeries?: (series: LineChartSeries) => void,
) {
  return function DotRenderer({ cx, cy, value }: LibraryDotProps) {
    if (typeof cx !== 'number' || typeof cy !== 'number' || value == null) {
      return null;
    }

    return (
      <circle
        cx={cx}
        cy={cy}
        r={entry.active ? BASE_ACTIVE_POINT_RADIUS : BASE_POINT_RADIUS}
        fill={entry.color}
        opacity={opacity}
        onClick={onSelectSeries ? () => onSelectSeries(entry) : undefined}
        className={onSelectSeries ? 'library-chart-hit-area' : undefined}
      />
    );
  };
}

export default function LineChart({
  ariaLabel,
  years,
  series,
  valueFormatter,
  axisFormatter,
  yAxisLabel,
  emptyMessage = 'No values available for this chart.',
  onSelectSeries,
  minDomain,
  legendMode = 'full',
}: LineChartProps) {
  const activeSeriesPresent = series.some((entry) => entry.active);
  const showLegend = legendMode !== 'hidden';
  const compactLegend = legendMode === 'compact';
  const tickFormatter = axisFormatter ?? valueFormatter;
  const rows = buildNullableRows(years, series);
  const seriesKeys = series.map((entry) => entry.key);
  const seriesValues = collectNumericValues(rows, seriesKeys);
  const summaryItems = summarizeSeries(series).map((entry) => ({
    ...entry,
    active: series.find((candidate) => candidate.key === entry.key)?.active,
    dashArray: series.find((candidate) => candidate.key === entry.key)?.dashArray,
  }));

  if (series.length === 0 || seriesValues.length === 0 || years.length === 0) {
    return <p className="library-chart-empty">{emptyMessage}</p>;
  }

  const domain = computeDomain(seriesValues, {
    paddingRatio: 0.12,
    minDomain,
  });

  return (
    <div className="library-chart-shell">
      <div className="library-chart-plot" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer {...buildResponsiveContainerProps(LIBRARY_CHART_HEIGHT)}>
          <RechartsLineChart data={rows} margin={LIBRARY_CHART_MARGIN}>
            <CartesianGrid
              stroke={CHART_GRID_STROKE}
              strokeDasharray={CHART_GRID_DASHARRAY}
              vertical={false}
            />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={CHART_AXIS_TICK_STYLE}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={72}
              domain={domain}
              tick={CHART_AXIS_TICK_STYLE}
              tickFormatter={tickFormatter}
              label={yAxisLabel ? {
                value: yAxisLabel,
                angle: -90,
                position: 'insideLeft',
                offset: 2,
                style: CHART_AXIS_TITLE_STYLE,
              } : undefined}
            />
            {series.map((entry) => {
              const opacity = activeSeriesPresent ? (entry.active ? 1 : 0.24) : 0.82;

              return (
                <Line
                  key={entry.key}
                  type="linear"
                  dataKey={entry.key}
                  name={entry.label}
                  stroke={entry.color}
                  strokeWidth={entry.active ? BASE_ACTIVE_STROKE_WIDTH : BASE_STROKE_WIDTH}
                  strokeDasharray={entry.dashArray}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={opacity}
                  connectNulls={false}
                  dot={createDotRenderer(entry, opacity, onSelectSeries)}
                  activeDot={false}
                  isAnimationActive={false}
                  onClick={onSelectSeries ? () => onSelectSeries(entry) : undefined}
                  className={onSelectSeries ? 'library-chart-hit-area' : undefined}
                />
              );
            })}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>

      {showLegend ? (
        <div className={`library-chart-legend${compactLegend ? ' library-chart-legend--compact' : ''}`}>
          {series.map((entry) => {
            const itemClassName = [
              'library-chart-legend-item',
              compactLegend ? 'library-chart-legend-item--compact' : '',
              entry.active ? 'library-chart-legend-item--active' : '',
              onSelectSeries ? '' : 'library-chart-legend-item--static',
            ]
              .filter(Boolean)
              .join(' ');
            const content = (
              <>
                <LibraryLegendSwatch
                  color={entry.color}
                  dashArray={entry.dashArray}
                  active={entry.active}
                  activeSeriesPresent={activeSeriesPresent}
                />
                <span>{entry.label}</span>
              </>
            );

            return onSelectSeries ? (
              <button
                key={entry.key}
                type="button"
                className={itemClassName}
                onClick={() => onSelectSeries(entry)}
              >
                {content}
              </button>
            ) : (
              <span key={entry.key} className={itemClassName}>
                {content}
              </span>
            );
          })}
        </div>
      ) : null}

      <ul className="chart-data-summary">
        {yAxisLabel ? <li data-axis-label={yAxisLabel}>Axis: {yAxisLabel}</li> : null}
        {summaryItems.map((entry) => (
          <li
            key={entry.key}
            data-series-key={entry.key}
            data-active={entry.active ? 'true' : 'false'}
            data-dash-array={entry.dashArray ?? ''}
            data-negative-points={String(entry.negativePoints)}
            data-null-points={String(entry.nullPoints)}
          >
            {entry.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
