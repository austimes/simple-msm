import React, { useMemo } from 'react';
import { getPresentation } from '../../data/chartPresentation.ts';
import type { FuelSwitchBasis } from '../../data/types.ts';
import type { StackedChartData } from '../../results/chartData.ts';
import {
  buildFuelSwitchChartData,
  type FuelSwitchAttributionRow,
} from '../../results/fuelSwitching.ts';
import type { ChartLegendItem } from './ChartFrame.tsx';
import StackedBarChart from './StackedBarChart.tsx';

void React;

const FUEL_SWITCH_LEGEND_MIN_PJ = 0.5;
const FUEL_SWITCH_LEGEND_VISIBILITY_RATIO = 0.004;

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

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.trim().replace(/^#/, '');
  const fullHex = normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(fullHex)) {
    return [100, 116, 139];
  }

  return [
    Number.parseInt(fullHex.slice(0, 2), 16),
    Number.parseInt(fullHex.slice(2, 4), 16),
    Number.parseInt(fullHex.slice(4, 6), 16),
  ];
}

function rgbToHex([red, green, blue]: [number, number, number]): string {
  return `#${clampChannel(red).toString(16).padStart(2, '0')}${clampChannel(green).toString(16).padStart(2, '0')}${clampChannel(blue).toString(16).padStart(2, '0')}`;
}

function blendColors(primary: string, secondary: string, primaryWeight: number): string {
  const [primaryRed, primaryGreen, primaryBlue] = hexToRgb(primary);
  const [secondaryRed, secondaryGreen, secondaryBlue] = hexToRgb(secondary);
  const secondaryWeight = 1 - primaryWeight;

  return rgbToHex([
    (primaryRed * primaryWeight) + (secondaryRed * secondaryWeight),
    (primaryGreen * primaryWeight) + (secondaryGreen * secondaryWeight),
    (primaryBlue * primaryWeight) + (secondaryBlue * secondaryWeight),
  ]);
}

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function shiftColor(color: string, amount: number): string {
  const [red, green, blue] = hexToRgb(color);
  const delta = amount * 255;

  return rgbToHex([
    red + delta,
    green + delta,
    blue + delta,
  ]);
}

function buildFuelPairColor(
  fromFuelId: string,
  toFuelId: string,
  basis: FuelSwitchBasis,
): string {
  const primaryFuelId = basis === 'to' ? toFuelId : fromFuelId;
  const secondaryFuelId = basis === 'to' ? fromFuelId : toFuelId;
  const primaryColor = getPresentation('commodity', primaryFuelId).color;
  const secondaryColor = getPresentation('commodity', secondaryFuelId).color;
  const blended = blendColors(primaryColor, secondaryColor, 0.74);
  const toneShift = ((hashString(`${basis}:${fromFuelId}:${toFuelId}`) % 5) - 2) * 0.035;

  return shiftColor(blended, toneShift);
}

export default function FuelSwitchingChart({
  availableYears,
  basis,
  rows,
  onBasisChange,
  title = 'Fuel switching by fuel pair',
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
        return {
          key: entry.key,
          label: entry.label,
          color: buildFuelPairColor(entry.fromFuelId, entry.toFuelId, basis),
          values: entry.values,
        };
      }),
    }),
    [basis, chartData, title],
  );
  const legendItems = useMemo<ChartLegendItem[]>(() => {
    const maxYearTotal = stackedChartData.years.reduce((maxTotal, year) => {
      const yearTotal = stackedChartData.series.reduce((sum, series) => {
        const point = series.values.find((entry) => entry.year === year);
        return sum + (point?.value ?? 0);
      }, 0);

      return Math.max(maxTotal, yearTotal);
    }, 0);
    const visibilityThreshold = Math.max(
      FUEL_SWITCH_LEGEND_MIN_PJ,
      maxYearTotal * FUEL_SWITCH_LEGEND_VISIBILITY_RATIO,
    );
    const visibleSeries = stackedChartData.series.filter((series) =>
      series.values.some((entry) => entry.value >= visibilityThreshold));

    return (visibleSeries.length > 0 ? visibleSeries : stackedChartData.series).map((entry) => ({
      key: entry.key,
      label: entry.label,
      color: entry.color,
    }));
  }, [stackedChartData]);
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
  const hiddenLegendPairCount = stackedChartData.series.length - legendItems.length;

  return (
    <StackedBarChart
      data={stackedChartData}
      valueFormatter={formatPj}
      summaryItems={[
        { key: 'basis', label: `Basis: ${basis === 'to' ? 'To fuel' : 'From fuel'}` },
        { key: 'years', label: `Years: ${yearSpanLabel}` },
        { key: 'rows', label: `${chartData.series.length} fuel-switch pairs` },
        ...(hiddenLegendPairCount > 0
          ? [{ key: 'legend', label: `Legend hides ${hiddenLegendPairCount} minor pairs` }]
          : []),
      ]}
      legendItems={legendItems}
      headerAction={headerAction}
      emptyMessage="No fuel switching for the selected basis."
    />
  );
}
