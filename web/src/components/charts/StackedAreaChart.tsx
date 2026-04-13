import React from 'react';
import type { StackedChartData } from '../../results/chartData';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartEmptyState, ChartFrame } from './ChartFrame';
import {
  buildResponsiveContainerProps,
  CHART_AXIS_TICK_STYLE,
  CHART_AXIS_TITLE_STYLE,
  CHART_GRID_DASHARRAY,
  CHART_GRID_STROKE,
  WORKSPACE_CHART_HEIGHT,
  WORKSPACE_CHART_MARGIN,
} from './chartTheme';
import { buildZeroFilledRows, summarizeSeries } from './rechartsAdapters';
import { usePersistentYAxisDomain } from './persistentYAxisDomain';

void React;

interface StackedAreaChartProps {
  data: StackedChartData;
  valueFormatter?: (value: number) => string;
  height?: number;
  showTitle?: boolean;
  yDomainPersistenceKey?: string;
}

function defaultFormatter(value: number): string {
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toPrecision(3)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toPrecision(3)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toPrecision(3)}K`;
  return value.toPrecision(3);
}

export default function StackedAreaChart({
  data,
  valueFormatter = defaultFormatter,
  height = WORKSPACE_CHART_HEIGHT,
  showTitle = true,
  yDomainPersistenceKey,
}: StackedAreaChartProps) {
  const { title, yAxisLabel, years, series } = data;
  const isStructurallyEmpty = series.length === 0 || years.length === 0;
  const rows = isStructurallyEmpty ? [] : buildZeroFilledRows(years, series);
  const cumulativeTotals = rows.map((row) =>
    series.reduce((sum, entry) => sum + Number(row[entry.key] ?? 0), 0),
  );
  const hasOnlyZeroTotals = cumulativeTotals.length > 0 && cumulativeTotals.every((total) => total === 0);
  const isEmpty = isStructurallyEmpty || hasOnlyZeroTotals;
  const maxCumulative = cumulativeTotals.length > 0 ? Math.max(...cumulativeTotals) : 0;
  const autoDomain = isEmpty
    ? [0, 1] as [number, number]
    : [0, maxCumulative * 1.08] as [number, number];
  const { effectiveDomain, resetDomain, isPersistent } = usePersistentYAxisDomain({
    chartKey: isEmpty ? null : yDomainPersistenceKey,
    autoDomain,
  });
  const headerAction = isPersistent ? (
    <button
      type="button"
      className="stacked-chart-reset-button"
      onClick={resetDomain}
      aria-label={`Reset y-axis range for ${title}`}
    >
      Reset y-axis range
    </button>
  ) : undefined;

  if (isStructurallyEmpty) {
    return (
      <ChartEmptyState
        className="stacked-chart-empty"
        message="No data available for this chart."
      />
    );
  }

  if (hasOnlyZeroTotals) {
    return (
      <ChartEmptyState
        className="stacked-chart-empty"
        message="No data available for this chart."
      />
    );
  }

  const summaryItems = summarizeSeries(series);
  const legendItems = series.map((entry) => ({
    key: entry.key,
    label: entry.label,
    color: entry.color,
  }));

  return (
    <ChartFrame
      title={title}
      yAxisLabel={yAxisLabel}
      height={height}
      legendItems={legendItems}
      summaryItems={summaryItems}
      showTitle={showTitle}
      headerAction={headerAction}
    >
      <ResponsiveContainer {...buildResponsiveContainerProps(height)}>
        <AreaChart data={rows} margin={WORKSPACE_CHART_MARGIN}>
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
            domain={effectiveDomain}
            tick={CHART_AXIS_TICK_STYLE}
            tickFormatter={valueFormatter}
            label={{
              value: yAxisLabel,
              angle: -90,
              position: 'insideLeft',
              offset: 2,
              style: CHART_AXIS_TITLE_STYLE,
            }}
          />
          {series.map((entry) => (
            <Area
              key={entry.key}
              type="linear"
              dataKey={entry.key}
              name={entry.label}
              stackId="stack"
              stroke={entry.color}
              fill={entry.color}
              fillOpacity={0.82}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
