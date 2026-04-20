import React from 'react';
import type { ReactNode } from 'react';
import type { PathwayCapChartData } from '../../results/chartData.ts';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartEmptyState, ChartFrame, type ChartFrameLayoutVariant } from './ChartFrame';
import {
  buildResponsiveContainerProps,
  CHART_AXIS_TICK_STYLE,
  CHART_AXIS_TITLE_STYLE,
  CHART_GRID_DASHARRAY,
  CHART_GRID_STROKE,
  WORKSPACE_CHART_HEIGHT,
  WORKSPACE_CHART_MARGIN,
} from './chartTheme';
import { collectNumericValues, computeDomain } from './rechartsAdapters';
import { usePersistentYAxisDomain } from './persistentYAxisDomain';

void React;

interface PathwayCapChartProps {
  data: PathwayCapChartData;
  valueFormatter?: (value: number) => string;
  height?: number;
  showTitle?: boolean;
  yDomainPersistenceKey?: string;
  headerAction?: ReactNode;
  frameTitle?: string;
  layoutVariant?: ChartFrameLayoutVariant;
}

function defaultFormatter(value: number): string {
  return `${value.toFixed(0)}%`;
}

export default function PathwayCapChart({
  data,
  valueFormatter = defaultFormatter,
  height = WORKSPACE_CHART_HEIGHT,
  showTitle = true,
  yDomainPersistenceKey,
  headerAction,
  frameTitle,
  layoutVariant = 'default',
}: PathwayCapChartProps) {
  const { title, yAxisLabel, years, series } = data;
  const visibleTitle = frameTitle ?? title;
  const isStructurallyEmpty = series.length === 0 || years.length === 0;
  const rows = isStructurallyEmpty
    ? []
    : years.map((year, index) => {
      const row: Record<string, number> & { year: number } = { year };

      for (const entry of series) {
        row[`share:${entry.key}`] = entry.shareValues[index]?.value ?? 0;
        row[`cap:${entry.key}`] = entry.capValues[index]?.value ?? 0;
      }

      return row;
    });
  const dataKeys = series.flatMap((entry) => [`share:${entry.key}`, `cap:${entry.key}`]);
  const numericValues = collectNumericValues(rows, dataKeys);
  const hasOnlyZeroValues = numericValues.length > 0 && numericValues.every((value) => value === 0);
  const isEmpty = isStructurallyEmpty || hasOnlyZeroValues;
  const autoDomain = isEmpty
    ? [0, 1] as [number, number]
    : (() => {
      const [, upperBound] = computeDomain(numericValues, {
        paddingRatio: 0.08,
        roundTo: 5,
      });

      return [0, Math.max(upperBound, 1)] as [number, number];
    })();
  const { effectiveDomain, resetDomain, isPersistent } = usePersistentYAxisDomain({
    chartKey: isEmpty ? null : yDomainPersistenceKey,
    autoDomain,
  });
  const resolvedHeaderAction = headerAction != null || isPersistent
    ? (
      <div className="stacked-chart-header-action-group">
        {headerAction}
        {isPersistent ? (
          <button
            type="button"
            className="stacked-chart-control-pill stacked-chart-reset-button"
            onClick={resetDomain}
            aria-label={`Reset y-axis range for ${visibleTitle}`}
          >
            Reset y-axis range
          </button>
        ) : null}
      </div>
    )
    : undefined;

  if (isEmpty) {
    return (
      <ChartEmptyState
        className="stacked-chart-empty"
        message="No data available for this chart."
      />
    );
  }

  const legendItems = series.map((entry) => ({
    key: entry.key,
    label: entry.label,
    legendLabel: entry.legendLabel,
    color: entry.color,
  }));
  const summaryItems = series.map((entry) => ({
    key: entry.key,
    label: entry.label,
  }));

  return (
    <ChartFrame
      title={visibleTitle}
      yAxisLabel={yAxisLabel}
      height={height}
      legendItems={legendItems}
      summaryItems={summaryItems}
      showTitle={showTitle}
      headerAction={resolvedHeaderAction}
      layoutVariant={layoutVariant}
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
              key={`share:${entry.key}`}
              type="linear"
              dataKey={`share:${entry.key}`}
              name={entry.label}
              fill={entry.color}
              fillOpacity={0.18}
              stroke="none"
              isAnimationActive={false}
            />
          ))}
          {series.map((entry) => (
            <Line
              key={`cap:${entry.key}`}
              type="linear"
              dataKey={`cap:${entry.key}`}
              name={`${entry.label} cap`}
              stroke={entry.color}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
