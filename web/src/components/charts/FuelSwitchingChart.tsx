import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getCommodityMetadata } from '../../data/commodityMetadata.ts';
import { getPresentation } from '../../data/chartPresentation.ts';
import type { FuelSwitchBasis } from '../../data/types.ts';
import {
  buildFuelSwitchChartData,
  type FuelSwitchAttributionRow,
} from '../../results/fuelSwitching.ts';
import { ChartEmptyState, ChartFrame } from './ChartFrame.tsx';
import {
  buildResponsiveContainerProps,
  CHART_AXIS_TICK_STYLE,
  CHART_AXIS_TITLE_STYLE,
  CHART_GRID_DASHARRAY,
  CHART_GRID_STROKE,
  WORKSPACE_CHART_HEIGHT,
  WORKSPACE_CHART_MARGIN,
} from './chartTheme.ts';

void React;

interface FuelSwitchingChartProps {
  availableYears: number[];
  basis: FuelSwitchBasis;
  rows: FuelSwitchAttributionRow[];
  selectedYear: number | null;
  onBasisChange: (basis: FuelSwitchBasis) => void;
  onYearChange: (year: number) => void;
  title?: string;
}

function formatPj(value: number): string {
  return `${value.toFixed(2)} PJ`;
}

function resolveDomain(values: number[]): [number, number] {
  const maxValue = values.reduce((current, value) => Math.max(current, value), 0);
  const paddedMax = maxValue === 0 ? 1 : maxValue * 1.12;
  return [0, paddedMax];
}

export default function FuelSwitchingChart({
  availableYears,
  basis,
  rows,
  onBasisChange,
  title = 'Fuel switching by subsector',
}: FuelSwitchingChartProps) {
  const chartData = useMemo(
    () => buildFuelSwitchChartData(rows, availableYears, basis),
    [availableYears, basis, rows],
  );
  const stackedRows = useMemo(
    () => chartData.years.map((year) => {
      const entry: Record<string, number> & { year: number; total: number } = {
        year,
        total: 0,
      };

      for (const series of chartData.series) {
        const value = series.values.find((seriesValue) => seriesValue.year === year)?.value ?? 0;
        entry[series.key] = value;
        entry.total += value;
      }

      return entry;
    }),
    [chartData],
  );
  const legendItems = useMemo(
    () => chartData.series.map((entry) => {
      const commodityLabel = getCommodityMetadata(entry.colorCommodityId).label;
      return {
        key: entry.key,
        label: entry.label,
        color: getPresentation('commodity', entry.colorCommodityId, commodityLabel).color,
      };
    }),
    [chartData],
  );
  const headerAction = (
    <div className="fuel-switch-chart-controls">
      <div className="workspace-chart-toggle" role="tablist" aria-label="Fuel switch basis">
        <button
          type="button"
          className={`workspace-chart-toggle-button${basis === 'to' ? ' workspace-chart-toggle-button--active' : ''}`}
          onClick={() => onBasisChange('to')}
          aria-pressed={basis === 'to'}
        >
          To fuel
        </button>
        <button
          type="button"
          className={`workspace-chart-toggle-button${basis === 'from' ? ' workspace-chart-toggle-button--active' : ''}`}
          onClick={() => onBasisChange('from')}
          aria-pressed={basis === 'from'}
        >
          From fuel
        </button>
      </div>
    </div>
  );
  const chartHeight = WORKSPACE_CHART_HEIGHT;
  const yearSpanLabel = chartData.years.length === 0
    ? '—'
    : chartData.years.length === 1
      ? String(chartData.years[0])
      : `${chartData.years[0]}-${chartData.years[chartData.years.length - 1]}`;

  return (
    <ChartFrame
      title={title}
      yAxisLabel="PJ"
      height={chartHeight}
      legendItems={legendItems}
      summaryItems={[
        { key: 'basis', label: `Basis: ${basis === 'to' ? 'To fuel' : 'From fuel'}` },
        { key: 'years', label: `Years: ${yearSpanLabel}` },
        { key: 'rows', label: `${chartData.series.length} switching flows` },
      ]}
      headerAction={headerAction}
    >
      {chartData.series.length === 0 ? (
        <ChartEmptyState
          className="stacked-chart-empty"
          message="No fuel switching for the selected basis."
        />
      ) : (
        <ResponsiveContainer {...buildResponsiveContainerProps(chartHeight)}>
          <BarChart
            data={stackedRows}
            margin={WORKSPACE_CHART_MARGIN}
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
              width={72}
              domain={resolveDomain(stackedRows.map((entry) => entry.total))}
              tickLine={false}
              axisLine={false}
              tick={CHART_AXIS_TICK_STYLE}
              tickFormatter={formatPj}
              label={{
                value: 'PJ',
                angle: -90,
                position: 'insideLeft',
                offset: 2,
                style: CHART_AXIS_TITLE_STYLE,
              }}
            />
            <Tooltip
              cursor={{ fill: 'rgba(148, 163, 184, 0.10)' }}
              formatter={(value) => {
                const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                return formatPj(Number.isFinite(numericValue) ? numericValue : 0);
              }}
              labelFormatter={(value) => `Year ${value}`}
            />
            {chartData.series.map((entry) => {
              const commodityLabel = getCommodityMetadata(entry.colorCommodityId).label;
              return (
                <Bar
                  key={entry.key}
                  dataKey={entry.key}
                  name={entry.label}
                  stackId="stack"
                  fill={getPresentation('commodity', entry.colorCommodityId, commodityLabel).color}
                  fillOpacity={0.86}
                  stroke="none"
                  isAnimationActive={false}
                />
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}
