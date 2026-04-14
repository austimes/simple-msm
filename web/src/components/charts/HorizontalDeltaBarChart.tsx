import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartEmptyState, ChartFrame } from './ChartFrame.tsx';
import {
  buildResponsiveContainerProps,
  CHART_AXIS_TICK_STYLE,
  CHART_GRID_DASHARRAY,
  CHART_GRID_STROKE,
  WORKSPACE_CHART_MARGIN,
} from './chartTheme.ts';

void React;

export interface HorizontalDeltaBarDatum {
  key: string;
  label: string;
  value: number;
}

export interface HorizontalDeltaBarChartProps {
  data: HorizontalDeltaBarDatum[];
  height?: number;
  negativeLegendLabel?: string;
  positiveLegendLabel?: string;
  showCategoryAxis?: boolean;
  title: string;
  valueFormatter?: (value: number) => string;
}

const POSITIVE_COLOR = '#c2410c';
const NEGATIVE_COLOR = '#0f766e';
const ZERO_COLOR = '#94a3b8';

function defaultFormatter(value: number): string {
  const sign = value > 0 ? '+' : '';

  if (Math.abs(value) >= 1_000_000) {
    return `${sign}${(value / 1_000_000).toFixed(2)}M`;
  }

  if (Math.abs(value) >= 1_000) {
    return `${sign}${(value / 1_000).toFixed(2)}K`;
  }

  return `${sign}${value.toFixed(2)}`;
}

function resolveDomain(values: number[]): [number, number] {
  const maxAbs = values.reduce((current, value) => Math.max(current, Math.abs(value)), 0);
  const padded = maxAbs === 0 ? 1 : maxAbs * 1.12;
  return [-padded, padded];
}

export default function HorizontalDeltaBarChart({
  data,
  height,
  negativeLegendLabel = 'Decrease',
  positiveLegendLabel = 'Increase',
  showCategoryAxis = true,
  title,
  valueFormatter = defaultFormatter,
}: HorizontalDeltaBarChartProps) {
  if (data.length === 0) {
    return (
      <ChartEmptyState
        className="stacked-chart-empty"
        message="No additionality steps available for this chart."
      />
    );
  }

  const chartHeight = height ?? Math.max(320, data.length * 42 + 88);
  const domain = resolveDomain(data.map((entry) => entry.value));
  const positiveCount = data.filter((entry) => entry.value > 0).length;
  const negativeCount = data.filter((entry) => entry.value < 0).length;
  const zeroCount = data.length - positiveCount - negativeCount;
  const chartLeftMargin = showCategoryAxis ? 180 : 24;
  const categoryAxisWidth = showCategoryAxis ? 172 : 0;

  return (
    <ChartFrame
      title={title}
      height={chartHeight}
      legendItems={[
        { key: 'increase', label: positiveLegendLabel, color: POSITIVE_COLOR },
        { key: 'decrease', label: negativeLegendLabel, color: NEGATIVE_COLOR },
      ]}
      summaryItems={[
        { key: 'increase', label: `${positiveCount} increases` },
        { key: 'decrease', label: `${negativeCount} decreases` },
        { key: 'zero', label: `${zeroCount} zero-delta steps` },
      ]}
    >
      <ResponsiveContainer {...buildResponsiveContainerProps(chartHeight)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{
            ...WORKSPACE_CHART_MARGIN,
            left: chartLeftMargin,
          }}
        >
          <CartesianGrid
            stroke={CHART_GRID_STROKE}
            strokeDasharray={CHART_GRID_DASHARRAY}
            horizontal={false}
          />
          <XAxis
            type="number"
            domain={domain}
            tickLine={false}
            axisLine={false}
            tick={CHART_AXIS_TICK_STYLE}
            tickFormatter={valueFormatter}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={categoryAxisWidth}
            hide={!showCategoryAxis}
            tickLine={false}
            axisLine={false}
            tick={CHART_AXIS_TICK_STYLE}
          />
          <ReferenceLine x={0} stroke="#334155" strokeWidth={1.5} />
          <Tooltip
            cursor={{ fill: 'rgba(148, 163, 184, 0.10)' }}
            formatter={(value) => {
              const numericValue = typeof value === 'number'
                ? value
                : Number(value ?? 0);
              return valueFormatter(Number.isFinite(numericValue) ? numericValue : 0);
            }}
          />
          <Bar dataKey="value" radius={[6, 6, 6, 6]} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell
                key={entry.key}
                fill={entry.value > 0 ? POSITIVE_COLOR : entry.value < 0 ? NEGATIVE_COLOR : ZERO_COLOR}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
