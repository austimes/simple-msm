import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  CHART_GRID_DASHARRAY,
  CHART_GRID_STROKE,
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
  selectedYear,
  onBasisChange,
  onYearChange,
  title = 'Fuel switching by subsector',
}: FuelSwitchingChartProps) {
  const years = useMemo(
    () => Array.from(new Set(availableYears)).sort((left, right) => left - right),
    [availableYears],
  );
  const resolvedYear = years.includes(selectedYear ?? Number.NaN)
    ? selectedYear
    : years[years.length - 1] ?? null;
  const chartData = useMemo(
    () => (resolvedYear == null ? [] : buildFuelSwitchChartData(rows, resolvedYear, basis)),
    [basis, resolvedYear, rows],
  );
  const legendItems = useMemo(
    () => Array.from(
      new Map(
        chartData.map((entry) => {
          const label = getCommodityMetadata(entry.colorCommodityId).label;
          return [
            entry.colorCommodityId,
            {
              key: entry.colorCommodityId,
              label,
              legendLabel: getPresentation('commodity', entry.colorCommodityId, label).legendLabel,
              color: getPresentation('commodity', entry.colorCommodityId, label).color,
            },
          ];
        }),
      ).values(),
    ),
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
      {years.length > 0 ? (
        <div className="workspace-chart-toggle fuel-switch-chart-years" role="tablist" aria-label="Fuel switch year">
          {years.map((year) => (
            <button
              key={year}
              type="button"
              className={`workspace-chart-toggle-button${resolvedYear === year ? ' workspace-chart-toggle-button--active' : ''}`}
              onClick={() => onYearChange(year)}
              aria-pressed={resolvedYear === year}
            >
              {year}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
  const chartHeight = Math.max(220, chartData.length * 34 + 88);

  return (
    <ChartFrame
      title={title}
      yAxisLabel="PJ"
      height={chartHeight}
      legendItems={legendItems}
      summaryItems={[
        { key: 'basis', label: `Basis: ${basis === 'to' ? 'To fuel' : 'From fuel'}` },
        { key: 'year', label: `Year: ${resolvedYear ?? '—'}` },
        { key: 'rows', label: `${chartData.length} switching flows` },
      ]}
      headerAction={headerAction}
    >
      {chartData.length === 0 ? (
        <ChartEmptyState
          className="stacked-chart-empty"
          message="No fuel switching for the selected year and basis."
        />
      ) : (
        <ResponsiveContainer {...buildResponsiveContainerProps(chartHeight)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{
              ...WORKSPACE_CHART_MARGIN,
              left: 240,
            }}
          >
            <CartesianGrid
              stroke={CHART_GRID_STROKE}
              strokeDasharray={CHART_GRID_DASHARRAY}
              horizontal={false}
            />
            <XAxis
              type="number"
              domain={resolveDomain(chartData.map((entry) => entry.value))}
              tickLine={false}
              axisLine={false}
              tick={CHART_AXIS_TICK_STYLE}
              tickFormatter={formatPj}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={232}
              tickLine={false}
              axisLine={false}
              tick={CHART_AXIS_TICK_STYLE}
            />
            <Tooltip
              cursor={{ fill: 'rgba(148, 163, 184, 0.10)' }}
              formatter={(value) => {
                const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                return formatPj(Number.isFinite(numericValue) ? numericValue : 0);
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 6, 6]} isAnimationActive={false}>
              {chartData.map((entry) => {
                const label = getCommodityMetadata(entry.colorCommodityId).label;
                return (
                  <Cell
                    key={entry.key}
                    fill={getPresentation('commodity', entry.colorCommodityId, label).color}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}
