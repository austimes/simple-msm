import React from 'react';
import type { LineChartData } from '../../results/chartData';
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
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
import {
  buildZeroFilledRows,
  collectNumericValues,
  computeDomain,
  summarizeSeries,
} from './rechartsAdapters';
import { usePersistentYAxisDomain } from './persistentYAxisDomain';

void React;

interface LineChartProps {
  data: LineChartData;
  valueFormatter?: (value: number) => string;
  height?: number;
  showTitle?: boolean;
  yDomainPersistenceKey?: string;
}

function defaultFormatter(value: number): string {
  return `${value.toFixed(0)}%`;
}

export default function LineChart({
  data,
  valueFormatter = defaultFormatter,
  height = WORKSPACE_CHART_HEIGHT,
  showTitle = true,
  yDomainPersistenceKey,
}: LineChartProps) {
  const { title, yAxisLabel, years, series } = data;
  const isEmpty = series.length === 0 || years.length === 0;
  const rows = isEmpty ? [] : buildZeroFilledRows(years, series);
  const seriesKeys = series.map((entry) => entry.key);
  const autoDomain = isEmpty
    ? [0, 1] as [number, number]
    : computeDomain(collectNumericValues(rows, seriesKeys), {
      paddingRatio: 0.08,
      roundTo: 5,
    });
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

  if (isEmpty) {
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
        <RechartsLineChart data={rows} margin={WORKSPACE_CHART_MARGIN}>
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
            <Line
              key={entry.key}
              type="linear"
              dataKey={entry.key}
              name={entry.label}
              stroke={entry.color}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
