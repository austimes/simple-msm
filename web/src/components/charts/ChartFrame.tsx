import React from 'react';
import type { ReactNode } from 'react';
import { buildChartShellStyle } from './chartTheme';

void React;

export interface ChartLegendItem {
  key: string;
  label: string;
  color: string;
  dashArray?: string;
  kind?: 'fill' | 'line';
}

export interface ChartSummaryItem {
  key: string;
  label: string;
  active?: boolean;
  dashArray?: string;
  negativePoints?: number;
  nullPoints?: number;
}

interface ChartFrameProps {
  title: string;
  yAxisLabel?: string;
  height: number;
  legendItems: ChartLegendItem[];
  summaryItems: ChartSummaryItem[];
  children: ReactNode;
}

function LegendSwatch({
  color,
  dashArray,
  kind = 'fill',
}: Pick<ChartLegendItem, 'color' | 'dashArray' | 'kind'>) {
  if (kind === 'line') {
    return (
      <svg viewBox="0 0 24 8" aria-hidden="true" className="stacked-chart-legend-line">
        <line
          x1="1"
          x2="23"
          y1="4"
          y2="4"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={dashArray}
        />
      </svg>
    );
  }

  return (
    <span
      className="stacked-chart-legend-swatch"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

export function ChartFrame({
  title,
  yAxisLabel,
  height,
  legendItems,
  summaryItems,
  children,
}: ChartFrameProps) {
  return (
    <figure className="stacked-chart-shell" style={buildChartShellStyle(height)}>
      <figcaption className="stacked-chart-title">{title}</figcaption>

      <div className="stacked-chart-layout">
        <div className="stacked-chart-canvas" role="img" aria-label={title}>
          {children}
        </div>

        {legendItems.length > 0 ? (
          <div className="stacked-chart-legend" aria-label={`${title} legend`}>
            {legendItems.map((entry) => (
              <span key={entry.key} className="stacked-chart-legend-item">
                <LegendSwatch color={entry.color} dashArray={entry.dashArray} kind={entry.kind} />
                <span>{entry.label}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <ul className="chart-data-summary">
        {yAxisLabel ? <li data-axis-label={yAxisLabel}>Axis: {yAxisLabel}</li> : null}
        {summaryItems.map((entry) => (
          <li
            key={entry.key}
            data-series-key={entry.key}
            data-active={entry.active ? 'true' : 'false'}
            data-dash-array={entry.dashArray ?? ''}
            data-negative-points={String(entry.negativePoints ?? 0)}
            data-null-points={String(entry.nullPoints ?? 0)}
          >
            {entry.label}
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function ChartEmptyState({
  className,
  message,
}: {
  className: string;
  message: string;
}) {
  return <p className={className}>{message}</p>;
}
