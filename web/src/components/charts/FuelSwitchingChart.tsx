import React, { useMemo } from 'react';
import { getCommodityMetadata } from '../../data/commodityMetadata.ts';
import { getPresentation } from '../../data/chartPresentation.ts';
import type { FuelSwitchBasis } from '../../data/types.ts';
import type { StackedChartData } from '../../results/chartData.ts';
import {
  buildFuelSwitchChartData,
  type FuelSwitchAttributionRow,
} from '../../results/fuelSwitching.ts';
import StackedBarChart from './StackedBarChart.tsx';

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
  const stackedChartData = useMemo<StackedChartData>(
    () => ({
      title,
      yAxisLabel: 'PJ',
      years: chartData.years,
      series: chartData.series.map((entry) => {
        const commodityLabel = getCommodityMetadata(entry.colorCommodityId).label;
        return {
          key: entry.key,
          label: entry.label,
          color: getPresentation('commodity', entry.colorCommodityId, commodityLabel).color,
          values: entry.values,
        };
      }),
    }),
    [chartData, title],
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
  const yearSpanLabel = chartData.years.length === 0
    ? '—'
    : chartData.years.length === 1
      ? String(chartData.years[0])
      : `${chartData.years[0]}-${chartData.years[chartData.years.length - 1]}`;

  return (
    <StackedBarChart
      data={stackedChartData}
      valueFormatter={formatPj}
      summaryItems={[
        { key: 'basis', label: `Basis: ${basis === 'to' ? 'To fuel' : 'From fuel'}` },
        { key: 'years', label: `Years: ${yearSpanLabel}` },
        { key: 'rows', label: `${chartData.series.length} switching flows` },
      ]}
      headerAction={headerAction}
      emptyMessage="No fuel switching for the selected basis."
    />
  );
}
