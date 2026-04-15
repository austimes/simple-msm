import React from 'react';
import { ChartEmptyState, ChartFrame } from './ChartFrame.tsx';
import {
  CHART_AXIS_TICK_STYLE,
  CHART_BASE_WIDTH,
  CHART_GRID_DASHARRAY,
  CHART_GRID_STROKE,
} from './chartTheme.ts';

void React;

export interface HorizontalWaterfallDatum {
  key: string;
  interactionKey: string;
  label: string;
  delta: number;
  cumulativeBefore: number;
  cumulativeAfter: number;
}

export interface HorizontalWaterfallChartProps {
  data: HorizontalWaterfallDatum[];
  height?: number;
  baseValue: number;
  targetValue: number;
  totalDelta: number;
  absoluteValueFormatter?: (value: number) => string;
  activeInteractionKey?: string | null;
  negativeLegendLabel?: string;
  onInteractionHover?: (interactionKey: string | null) => void;
  pinZeroToLeft?: boolean;
  positiveLegendLabel?: string;
  showActiveValueLabel?: boolean;
  showCategoryAxis?: boolean;
  showHeaderSummary?: boolean;
  showLegend?: boolean;
  showXAxisTicks?: boolean;
  title: string;
  valueFormatter?: (value: number) => string;
}

const POSITIVE_COLOR = '#c2410c';
const NEGATIVE_COLOR = '#0f766e';
const ZERO_COLOR = '#94a3b8';
const CONNECTOR_COLOR = 'rgba(100, 116, 139, 0.64)';
const ZERO_LINE_COLOR = '#334155';
const STEP_LABEL_COLOR = '#475569';
const STEP_LABEL_FONT_WEIGHT = 500;
const ACTIVE_VALUE_LABEL_FILL = 'rgba(255, 255, 255, 0.96)';
const ACTIVE_VALUE_LABEL_STROKE = '#cbd5e1';
const ACTIVE_VALUE_LABEL_TEXT = '#0f172a';
const LABEL_FONT_SIZE = 11;

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

function formatAbsoluteValue(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }

  return value.toFixed(2);
}

function resolveDomain(
  data: HorizontalWaterfallDatum[],
  pinZeroToLeft: boolean,
): [number, number] {
  if (pinZeroToLeft && data.every((entry) => entry.cumulativeBefore === 0 && entry.cumulativeAfter === 0)) {
    return [0, 1];
  }

  const values = [0, ...data.flatMap((entry) => [entry.cumulativeBefore, entry.cumulativeAfter])];
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = maxValue - minValue;
  const normalizedSpan = span < 1 ? 1 : span;
  const midpoint = span < 1 ? (maxValue + minValue) / 2 : 0;
  const domainMin = span < 1 ? midpoint - (normalizedSpan / 2) : minValue;
  const domainMax = span < 1 ? midpoint + (normalizedSpan / 2) : maxValue;
  const padding = normalizedSpan * 0.12;

  return [domainMin - padding, domainMax + padding];
}

function buildTicks(domain: [number, number]): number[] {
  const [minValue, maxValue] = domain;
  const tickCount = 5;
  const step = (maxValue - minValue) / (tickCount - 1);
  const ticks = Array.from({ length: tickCount }, (_, index) => minValue + (step * index));

  if (minValue < 0 && maxValue > 0) {
    ticks.push(0);
  }

  return ticks
    .sort((left, right) => left - right)
    .filter((value, index, values) => {
      if (index === 0) {
        return true;
      }

      return Math.abs(value - values[index - 1]) > 1e-9;
    });
}

export default function HorizontalWaterfallChart({
  data,
  height,
  baseValue,
  targetValue,
  totalDelta,
  absoluteValueFormatter = formatAbsoluteValue,
  activeInteractionKey = null,
  negativeLegendLabel = 'Decrease',
  onInteractionHover,
  pinZeroToLeft = false,
  positiveLegendLabel = 'Increase',
  showActiveValueLabel = true,
  showCategoryAxis = true,
  showHeaderSummary = true,
  showLegend = true,
  showXAxisTicks = true,
  title,
  valueFormatter = defaultFormatter,
}: HorizontalWaterfallChartProps) {
  if (data.length === 0) {
    return (
      <ChartEmptyState
        className="stacked-chart-empty"
        message="No additionality steps available for this chart."
      />
    );
  }

  const chartHeight = height ?? Math.max(320, data.length * 42 + 88);
  const domain = resolveDomain(data, pinZeroToLeft);
  const ticks = buildTicks(domain);
  const positiveCount = data.filter((entry) => entry.delta > 0).length;
  const negativeCount = data.filter((entry) => entry.delta < 0).length;
  const zeroCount = data.length - positiveCount - negativeCount;
  const labelAxisWidth = showCategoryAxis ? (pinZeroToLeft ? 360 : 172) : 0;
  const margin = {
    top: 12,
    right: 18,
    bottom: 28,
    left: showCategoryAxis ? labelAxisWidth + 16 : 24,
  };
  const plotWidth = CHART_BASE_WIDTH - margin.left - margin.right;
  const plotHeight = chartHeight - margin.top - margin.bottom;
  const rowStride = plotHeight / data.length;
  const barHeight = Math.max(10, Math.min(18, rowStride * 0.58));
  const plotTop = margin.top;
  const plotBottom = chartHeight - margin.bottom;

  const scaleX = (value: number) => {
    return margin.left + (((value - domain[0]) / (domain[1] - domain[0])) * plotWidth);
  };

  const headerAction = showHeaderSummary ? (
    <div className="waterfall-chart-header-summary" aria-label={`${title} summary`}>
      <span className="waterfall-chart-header-pill">Base {absoluteValueFormatter(baseValue)}</span>
      <span className="waterfall-chart-header-pill">Target {absoluteValueFormatter(targetValue)}</span>
      <span className="waterfall-chart-header-pill">Δ {valueFormatter(totalDelta)}</span>
    </div>
  ) : undefined;

  return (
    <ChartFrame
      title={title}
      height={chartHeight}
      legendItems={showLegend
        ? [
            { key: 'increase', label: positiveLegendLabel, color: POSITIVE_COLOR },
            { key: 'decrease', label: negativeLegendLabel, color: NEGATIVE_COLOR },
          ]
        : []}
      summaryItems={showHeaderSummary
        ? [
            { key: 'base', label: `Base: ${absoluteValueFormatter(baseValue)}` },
            { key: 'target', label: `Target: ${absoluteValueFormatter(targetValue)}` },
            { key: 'delta', label: `Total delta: ${valueFormatter(totalDelta)}` },
            { key: 'increase', label: `${positiveCount} increases` },
            { key: 'decrease', label: `${negativeCount} decreases` },
            { key: 'zero', label: `${zeroCount} zero-delta steps` },
          ]
        : []}
      headerAction={headerAction}
    >
      <svg
        className="waterfall-chart-svg"
        viewBox={`0 0 ${CHART_BASE_WIDTH} ${chartHeight}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {showXAxisTicks ? ticks.map((tick) => {
          const x = scaleX(tick);
          return (
            <g key={`tick:${tick}`} className="waterfall-chart-tick">
              <line
                x1={x}
                x2={x}
                y1={plotTop}
                y2={plotBottom}
                stroke={CHART_GRID_STROKE}
                strokeDasharray={CHART_GRID_DASHARRAY}
                className="waterfall-chart-grid-line"
              />
              <text
                x={x}
                y={chartHeight - 8}
                textAnchor="middle"
                fontSize={LABEL_FONT_SIZE}
                fontWeight={CHART_AXIS_TICK_STYLE.fontWeight}
                fill={CHART_AXIS_TICK_STYLE.fill}
              >
                {valueFormatter(tick)}
              </text>
            </g>
          );
        }) : null}

        <line
          x1={scaleX(0)}
          x2={scaleX(0)}
          y1={plotTop}
          y2={plotBottom}
          stroke={ZERO_LINE_COLOR}
          strokeWidth="1.5"
          className="waterfall-chart-zero-line"
        />

        {data.map((entry, index) => {
          const centerY = plotTop + (rowStride * index) + (rowStride / 2);
          const startValue = Math.min(entry.cumulativeBefore, entry.cumulativeAfter);
          const endValue = Math.max(entry.cumulativeBefore, entry.cumulativeAfter);
          const x = scaleX(startValue);
          const rawWidth = scaleX(endValue) - scaleX(startValue);
          const isZeroDelta = entry.delta === 0;
          const width = isZeroDelta ? 2 : Math.max(rawWidth, 2);
          const rectX = isZeroDelta ? scaleX(entry.cumulativeBefore) - 1 : x;
          const fill = entry.delta > 0
            ? POSITIVE_COLOR
            : entry.delta < 0
              ? NEGATIVE_COLOR
              : ZERO_COLOR;
          const isActive = activeInteractionKey != null && entry.interactionKey === activeInteractionKey;
          const isDimmed = activeInteractionKey != null && !isActive;
          const handleHoverEnter = () => onInteractionHover?.(entry.interactionKey);
          const handleHoverLeave = () => onInteractionHover?.(null);
          const activeValueText = valueFormatter(entry.delta);
          const activeValueWidth = Math.max(44, activeValueText.length * 7 + 14);
          const activeValueHeight = 18;
          const barRight = rectX + width;
          const renderValueOnLeft = barRight + activeValueWidth + 10 > CHART_BASE_WIDTH - margin.right;
          const activeValueX = renderValueOnLeft
            ? Math.max(margin.left, rectX - activeValueWidth - 8)
            : Math.min(CHART_BASE_WIDTH - margin.right - activeValueWidth, barRight + 8);
          const activeValueY = centerY - (activeValueHeight / 2);

          return (
            <g
              key={entry.key}
              className="waterfall-chart-row"
              data-interaction-key={entry.interactionKey}
              data-active={isActive ? 'true' : 'false'}
              data-dimmed={isDimmed ? 'true' : 'false'}
              onMouseEnter={handleHoverEnter}
              onMouseLeave={handleHoverLeave}
            >
              <rect
                x="0"
                y={plotTop + (rowStride * index)}
                width={CHART_BASE_WIDTH}
                height={rowStride}
                fill="transparent"
                className="waterfall-chart-row-hit-area"
                tabIndex={0}
                onFocus={handleHoverEnter}
                onBlur={handleHoverLeave}
              />

              {showCategoryAxis ? (
                <text
                  x={margin.left - 12}
                  y={centerY}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={LABEL_FONT_SIZE}
                  fontWeight={STEP_LABEL_FONT_WEIGHT}
                  fill={STEP_LABEL_COLOR}
                  className="waterfall-chart-step-label"
                >
                  {entry.label}
                </text>
              ) : null}

              {index < data.length - 1 ? (
                <line
                  x1={scaleX(entry.cumulativeAfter)}
                  x2={scaleX(entry.cumulativeAfter)}
                  y1={centerY + (barHeight / 2)}
                  y2={centerY + rowStride - (barHeight / 2)}
                  stroke={CONNECTOR_COLOR}
                  strokeWidth="1.5"
                  className="waterfall-chart-connector"
                />
              ) : null}

              <rect
                x={rectX}
                y={centerY - (barHeight / 2)}
                width={width}
                height={barHeight}
                rx="6"
                fill={fill}
                className="waterfall-chart-bar"
                data-delta={entry.delta}
                data-label={entry.label}
              >
                <title>{`${entry.label}: ${valueFormatter(entry.delta)}`}</title>
              </rect>

              {isActive && showActiveValueLabel ? (
                <g
                  className="waterfall-chart-active-value"
                  data-value-label={activeValueText}
                  pointerEvents="none"
                >
                  <rect
                    x={activeValueX}
                    y={activeValueY}
                    width={activeValueWidth}
                    height={activeValueHeight}
                    rx="9"
                    fill={ACTIVE_VALUE_LABEL_FILL}
                    stroke={ACTIVE_VALUE_LABEL_STROKE}
                    strokeWidth="1"
                  />
                  <text
                    x={activeValueX + (activeValueWidth / 2)}
                    y={centerY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={LABEL_FONT_SIZE}
                    fontWeight="700"
                    fill={ACTIVE_VALUE_LABEL_TEXT}
                  >
                    {activeValueText}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}

        {showCategoryAxis ? (
          <rect
            x="0"
            y="0"
            width={labelAxisWidth}
            height={chartHeight}
            fill="transparent"
            className="waterfall-chart-label-area"
          />
        ) : null}
      </svg>
    </ChartFrame>
  );
}
