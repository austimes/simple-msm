import React from 'react';
import type { ReactNode } from 'react';
import { buildChartShellStyle } from './chartTheme';

void React;

export interface ChartLegendItem {
  key: string;
  label: string;
  legendLabel?: string;
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

export type ChartFrameLayoutVariant = 'default' | 'explorer-uniform';

interface ChartFrameProps {
  title: string;
  yAxisLabel?: string;
  height: number;
  legendItems: ChartLegendItem[];
  summaryItems: ChartSummaryItem[];
  showTitle?: boolean;
  headerAction?: ReactNode;
  layoutVariant?: ChartFrameLayoutVariant;
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
  showTitle = true,
  headerAction,
  layoutVariant = 'default',
  children,
}: ChartFrameProps) {
  const isExplorerUniform = layoutVariant === 'explorer-uniform';
  const shellClassName = [
    'stacked-chart-shell',
    isExplorerUniform ? 'stacked-chart-shell--explorer-uniform' : null,
  ].filter(Boolean).join(' ');
  const headerClassName = [
    'stacked-chart-header',
    isExplorerUniform ? 'stacked-chart-header--explorer-uniform' : null,
  ].filter(Boolean).join(' ');
  const actionOnlyHeaderClassName = [
    headerClassName,
    'stacked-chart-header--action-only',
  ].join(' ');
  const headerActionsClassName = [
    'stacked-chart-header-actions',
    isExplorerUniform ? 'stacked-chart-header-actions--explorer-uniform' : null,
  ].filter(Boolean).join(' ');
  const layoutClassName = [
    'stacked-chart-layout',
    isExplorerUniform ? 'stacked-chart-layout--explorer-uniform' : null,
  ].filter(Boolean).join(' ');
  const legendClassName = [
    'stacked-chart-legend',
    isExplorerUniform ? 'stacked-chart-legend--explorer-uniform' : null,
  ].filter(Boolean).join(' ');

  return (
    <figure className={shellClassName} style={buildChartShellStyle(height)}>
      {showTitle ? (
        <figcaption className={headerClassName}>
          <span className="stacked-chart-title">{title}</span>
          {headerAction ? (
            <span className={headerActionsClassName}>{headerAction}</span>
          ) : null}
        </figcaption>
      ) : null}
      {!showTitle && headerAction ? (
        <div className={actionOnlyHeaderClassName}>
          <span className={headerActionsClassName}>{headerAction}</span>
        </div>
      ) : null}

      <div className={layoutClassName}>
        <div className="stacked-chart-canvas" role="img" aria-label={title}>
          {children}
        </div>

        {legendItems.length > 0 ? (
          <div className={legendClassName} aria-label={`${title} legend`}>
            {legendItems.map((entry) => (
              <span
                key={entry.key}
                className="stacked-chart-legend-item"
                title={entry.label}
                aria-label={entry.label}
              >
                <LegendSwatch color={entry.color} dashArray={entry.dashArray} kind={entry.kind} />
                <span>{entry.legendLabel ?? entry.label}</span>
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
