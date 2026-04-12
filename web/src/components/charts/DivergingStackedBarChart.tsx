import React from 'react';
import type { StackedChartData } from '../../results/chartData';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
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
  CHART_NET_LINE_COLOR,
  WORKSPACE_CHART_HEIGHT,
  WORKSPACE_CHART_MARGIN,
} from './chartTheme';
import { buildDivergingRows, computeDomain, summarizeSeries } from './rechartsAdapters';

void React;

interface DivergingStackedBarChartProps {
  data: StackedChartData;
  valueFormatter?: (value: number) => string;
  height?: number;
}

function defaultFormatter(value: number): string {
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toPrecision(3)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toPrecision(3)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toPrecision(3)}K`;
  return value.toPrecision(3);
}

export default function DivergingStackedBarChart({
  data,
  valueFormatter = defaultFormatter,
  height = WORKSPACE_CHART_HEIGHT,
}: DivergingStackedBarChartProps) {
  const { title, yAxisLabel, years, series } = data;
  const hasAnyNonZero = series.some((s) => s.values.some((v) => v.value !== 0));
  if (series.length === 0 || years.length === 0 || !hasAnyNonZero) {
    return (
      <ChartEmptyState
        className="stacked-chart-empty"
        message="No data available for this chart."
      />
    );
  }

  const {
    rows,
    positiveTotals,
    negativeTotals,
    netKey,
    netValues,
  } = buildDivergingRows(years, series);
  const domain = computeDomain(
    [...positiveTotals, ...negativeTotals, ...netValues, 0],
    { paddingRatio: 0.08 },
  );
  const summaryItems = [
    ...summarizeSeries(series),
    { key: netKey, label: 'Net', dashArray: '6 4', nullPoints: 0 },
  ];
  const legendItems = [
    ...series.map((entry) => ({
      key: entry.key,
      label: entry.label,
      color: entry.color,
    })),
    {
      key: netKey,
      label: 'Net',
      color: CHART_NET_LINE_COLOR,
      dashArray: '6 4',
      kind: 'line' as const,
    },
  ];
  const hasNegatives = domain[0] < 0;

  return (
    <ChartFrame
      title={title}
      yAxisLabel={yAxisLabel}
      height={height}
      legendItems={legendItems}
      summaryItems={summaryItems}
    >
      <ResponsiveContainer {...buildResponsiveContainerProps(height)}>
        <ComposedChart data={rows} margin={WORKSPACE_CHART_MARGIN}>
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
            tickFormatter={valueFormatter}
            label={{
              value: yAxisLabel,
              angle: -90,
              position: 'insideLeft',
              offset: 2,
              style: CHART_AXIS_TITLE_STYLE,
            }}
          />
          {hasNegatives ? (
            <ReferenceLine y={0} stroke="#334155" strokeWidth={1.5} ifOverflow="extendDomain" />
          ) : null}
          {series.map((entry) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              name={entry.label}
              stackId="stack"
              fill={entry.color}
              fillOpacity={0.82}
              stroke="none"
              isAnimationActive={false}
            />
          ))}
          <Line
            type="linear"
            dataKey={netKey}
            name="Net"
            stroke={CHART_NET_LINE_COLOR}
            strokeWidth={2.5}
            strokeDasharray="6 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
