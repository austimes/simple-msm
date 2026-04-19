import React from 'react';
import type { ReactNode } from 'react';
import type { StackedChartData } from '../../results/chartData.ts';
import type { ChartLegendItem, ChartSummaryItem } from './ChartFrame.tsx';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { ChartEmptyState, ChartFrame } from './ChartFrame.tsx';
import {
  buildResponsiveContainerProps,
  CHART_AXIS_TICK_STYLE,
  CHART_AXIS_TITLE_STYLE,
  CHART_GRID_DASHARRAY,
  CHART_GRID_STROKE,
  CHART_NET_LINE_COLOR,
  WORKSPACE_CHART_HEIGHT,
  WORKSPACE_CHART_MARGIN,
} from './chartTheme.ts';
import {
  buildStackedBarRows,
  computeDomain,
  summarizeSeries,
} from './rechartsAdapters.ts';
import { usePersistentYAxisDomain } from './persistentYAxisDomain.ts';

void React;

interface StackedBarChartProps {
  data: StackedChartData;
  valueFormatter?: (value: number) => string;
  height?: number;
  showTitle?: boolean;
  yDomainPersistenceKey?: string;
  showNetLine?: boolean;
  headerAction?: ReactNode;
  summaryItems?: ChartSummaryItem[];
  legendItems?: ChartLegendItem[];
  emptyMessage?: string;
}

const ACTIVE_BAR_STYLE = {
  fillOpacity: 1,
  stroke: 'rgba(15, 23, 42, 0.18)',
  strokeWidth: 1.5,
};

function defaultFormatter(value: number): string {
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toPrecision(3)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toPrecision(3)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toPrecision(3)}K`;
  return value.toPrecision(3);
}

function renderTooltip(
  { active, label, payload }: TooltipContentProps<number, string>,
  valueFormatter: (value: number) => string,
) {
  if (!active || payload == null || payload.length === 0) {
    return null;
  }

  const [entry] = payload;
  const rawValue = typeof entry?.value === 'number'
    ? entry.value
    : Number(entry?.value ?? Number.NaN);

  if (!Number.isFinite(rawValue)) {
    return null;
  }

  const seriesLabel = entry?.name == null ? 'Value' : String(entry.name);
  const swatchColor = typeof entry?.color === 'string' ? entry.color : '#0f172a';

  return (
    <div className="stacked-chart-tooltip">
      <div className="stacked-chart-tooltip-year">Year {label}</div>
      <div className="stacked-chart-tooltip-row">
        <span className="stacked-chart-tooltip-meta">
          <span
            className="stacked-chart-tooltip-swatch"
            style={{ backgroundColor: swatchColor }}
            aria-hidden="true"
          />
          <span>{seriesLabel}</span>
        </span>
        <span className="stacked-chart-tooltip-value">{valueFormatter(rawValue)}</span>
      </div>
    </div>
  );
}

export default function StackedBarChart({
  data,
  valueFormatter = defaultFormatter,
  height = WORKSPACE_CHART_HEIGHT,
  showTitle = true,
  yDomainPersistenceKey,
  showNetLine = false,
  headerAction,
  summaryItems,
  legendItems,
  emptyMessage = 'No data available for this chart.',
}: StackedBarChartProps) {
  const { title, yAxisLabel, years, series } = data;
  const {
    rows,
    positiveTotals,
    negativeTotals,
    netKey,
    netValues,
    hasAnyNonZero,
  } = buildStackedBarRows(years, series, { includeNet: showNetLine });
  const isStructurallyEmpty = series.length === 0 || years.length === 0;
  const isEmpty = isStructurallyEmpty || !hasAnyNonZero;
  const hasNegativeValues = negativeTotals.some((value) => value < 0);
  const maxPositiveTotal = positiveTotals.length > 0 ? Math.max(...positiveTotals) : 0;
  const autoDomain = isEmpty
    ? [0, 1] as [number, number]
    : hasNegativeValues
      ? computeDomain(
        [
          ...positiveTotals,
          ...negativeTotals,
          ...netValues,
          0,
        ],
        { paddingRatio: 0.08 },
      )
      : [0, maxPositiveTotal * 1.08] as [number, number];
  const { effectiveDomain, resetDomain, isPersistent } = usePersistentYAxisDomain({
    chartKey: isEmpty ? null : yDomainPersistenceKey,
    autoDomain,
  });
  const resolvedHeaderAction = headerAction || isPersistent
    ? (
      <div className="stacked-chart-header-action-group">
        {headerAction}
        {isPersistent ? (
          <button
            type="button"
            className="stacked-chart-reset-button"
            onClick={resetDomain}
            aria-label={`Reset y-axis range for ${title}`}
          >
            Reset y-axis range
          </button>
        ) : null}
      </div>
    )
    : undefined;
  const resolvedSummaryItems = summaryItems ?? [
    ...summarizeSeries(series),
    ...(showNetLine && netKey
      ? [{ key: netKey, label: 'Net', dashArray: '6 4', nullPoints: 0 }]
      : []),
  ];
  const resolvedLegendItems = legendItems ?? [
    ...series.map((entry) => ({
      key: entry.key,
      label: entry.label,
      legendLabel: entry.legendLabel,
      color: entry.color,
    })),
    ...(showNetLine && netKey
      ? [{
        key: netKey,
        label: 'Net',
        color: CHART_NET_LINE_COLOR,
        dashArray: '6 4',
        kind: 'line' as const,
      }]
      : []),
  ];
  const keepFrameOnEmpty = headerAction != null || summaryItems != null;

  if (isEmpty && !keepFrameOnEmpty) {
    return (
      <ChartEmptyState
        className="stacked-chart-empty"
        message={emptyMessage}
      />
    );
  }

  return (
    <ChartFrame
      title={title}
      yAxisLabel={yAxisLabel}
      height={height}
      legendItems={isEmpty ? [] : resolvedLegendItems}
      summaryItems={resolvedSummaryItems}
      showTitle={showTitle}
      headerAction={resolvedHeaderAction}
    >
      {isEmpty ? (
        <ChartEmptyState
          className="stacked-chart-empty"
          message={emptyMessage}
        />
      ) : (
        <ResponsiveContainer {...buildResponsiveContainerProps(height)}>
          <BarChart
            data={rows}
            margin={WORKSPACE_CHART_MARGIN}
            stackOffset="sign"
            barCategoryGap={0}
            barGap={0}
          >
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
            <Tooltip
              shared={false}
              cursor={false}
              content={(props) => renderTooltip(props as TooltipContentProps<number, string>, valueFormatter)}
            />
            {effectiveDomain[0] < 0 ? (
              <ReferenceLine y={0} stroke="#334155" strokeWidth={1.5} ifOverflow="extendDomain" />
            ) : null}
            {series.map((entry) => (
              <Bar
                key={entry.key}
                dataKey={entry.key}
                name={entry.label}
                stackId="stack"
                fill={entry.color}
                fillOpacity={0.86}
                stroke="none"
                isAnimationActive={false}
                activeBar={ACTIVE_BAR_STYLE}
              />
            ))}
            {showNetLine && netKey ? (
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
                tooltipType="none"
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}
