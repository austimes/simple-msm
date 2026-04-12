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

void React;

interface StackedAreaChartProps {
  data: StackedChartData;
  valueFormatter?: (value: number) => string;
  height?: number;
  showTitle?: boolean;
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
}: StackedAreaChartProps) {
  const { title, yAxisLabel, years, series } = data;

  if (series.length === 0 || years.length === 0) {
    return (
      <ChartEmptyState
        className="stacked-chart-empty"
        message="No data available for this chart."
      />
    );
  }

  const rows = buildZeroFilledRows(years, series);
  const cumulativeTotals = rows.map((row) =>
    series.reduce((sum, entry) => sum + Number(row[entry.key] ?? 0), 0),
  );

  if (cumulativeTotals.every((t) => t === 0)) {
    return (
      <ChartEmptyState
        className="stacked-chart-empty"
        message="No data available for this chart."
      />
    );
  }

  const maxCumulative = Math.max(...cumulativeTotals);
  const domainMax = maxCumulative * 1.08;
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
            domain={[0, domainMax]}
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
