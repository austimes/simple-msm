import { getCommodityMetadata } from '../data/commodityMetadata.ts';
import type { FuelSwitchBasis } from '../data/types.ts';
import type { ResultContributionRow } from './resultContributions.ts';

const FUEL_SWITCH_EPSILON_PJ = 1e-6;

export interface FuelSwitchAttributionRow {
  key: string;
  outputId: string;
  outputLabel: string;
  year: number;
  fromFuelId: string;
  fromFuelLabel: string;
  toFuelId: string;
  toFuelLabel: string;
  toBasisPj: number;
  fromBasisPj: number;
}

export interface FuelSwitchChartDatum {
  key: string;
  fromFuelId: string;
  toFuelId: string;
  colorCommodityId: string;
  label: string;
  values: Array<{ year: number; value: number }>;
}

interface FuelDeltaEntry {
  fuelId: string;
  fuelLabel: string;
  value: number;
}

interface FuelSwitchMatrixEntry {
  fromFuel: FuelDeltaEntry;
  toFuel: FuelDeltaEntry;
  fromBasisPj: number;
  toBasisPj: number;
}

function buildFuelTotalsByGroup(
  contributions: ResultContributionRow[],
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const row of contributions) {
    if (
      row.metric !== 'fuel'
      || row.sourceKind !== 'solver'
      || row.commodityId == null
      || row.outputId == null
    ) {
      continue;
    }

    const key = `${row.year}::${row.outputId}::${row.commodityId}`;
    totals.set(key, (totals.get(key) ?? 0) + row.value);
  }

  return totals;
}

function buildFuelSwitchMatrix(
  gains: FuelDeltaEntry[],
  losses: FuelDeltaEntry[],
  totalGain: number,
  totalLoss: number,
): FuelSwitchMatrixEntry[] {
  const matrixEntries = new Map<string, FuelSwitchMatrixEntry>();

  for (const gain of gains) {
    let assignedToBasis = 0;

    losses.forEach((loss, lossIndex) => {
      const isLastLoss = lossIndex === losses.length - 1;
      const toBasisPj = isLastLoss
        ? gain.value - assignedToBasis
        : (gain.value * loss.value) / totalLoss;

      assignedToBasis += toBasisPj;
      matrixEntries.set(`${loss.fuelId}::${gain.fuelId}`, {
        fromFuel: loss,
        toFuel: gain,
        toBasisPj,
        fromBasisPj: 0,
      });
    });
  }

  for (const loss of losses) {
    let assignedFromBasis = 0;

    gains.forEach((gain, gainIndex) => {
      const isLastGain = gainIndex === gains.length - 1;
      const fromBasisPj = isLastGain
        ? loss.value - assignedFromBasis
        : (loss.value * gain.value) / totalGain;
      const key = `${loss.fuelId}::${gain.fuelId}`;
      const matrixEntry = matrixEntries.get(key);

      if (matrixEntry == null) {
        return;
      }

      assignedFromBasis += fromBasisPj;
      matrixEntry.fromBasisPj = fromBasisPj;
    });
  }

  return gains.flatMap((gain) =>
    losses.map((loss) => matrixEntries.get(`${loss.fuelId}::${gain.fuelId}`)!));
}

export function buildFuelSwitchAttributionRows(
  baseContributions: ResultContributionRow[],
  focusContributions: ResultContributionRow[],
): FuelSwitchAttributionRow[] {
  const rows: FuelSwitchAttributionRow[] = [];
  const baseTotals = buildFuelTotalsByGroup(baseContributions);
  const focusTotals = buildFuelTotalsByGroup(focusContributions);
  const groupKeys = new Set<string>();

  for (const key of baseTotals.keys()) {
    groupKeys.add(key);
  }

  for (const key of focusTotals.keys()) {
    groupKeys.add(key);
  }

  const groupedDeltas = new Map<string, {
    outputId: string;
    outputLabel: string;
    year: number;
    deltasByFuel: Map<string, number>;
  }>();

  for (const key of groupKeys) {
    const [yearValue, outputId, fuelId] = key.split('::');
    const year = Number(yearValue);
    const delta = (focusTotals.get(key) ?? 0) - (baseTotals.get(key) ?? 0);

    if (Math.abs(delta) <= FUEL_SWITCH_EPSILON_PJ) {
      continue;
    }

    const outputLabel =
      focusContributions.find((row) => row.outputId === outputId)?.outputLabel
      ?? baseContributions.find((row) => row.outputId === outputId)?.outputLabel
      ?? outputId;
    const outputYearKey = `${year}::${outputId}`;
    const entry = groupedDeltas.get(outputYearKey) ?? {
      outputId,
      outputLabel,
      year,
      deltasByFuel: new Map<string, number>(),
    };

    entry.deltasByFuel.set(fuelId, delta);
    groupedDeltas.set(outputYearKey, entry);
  }

  for (const entry of groupedDeltas.values()) {
    const gains: FuelDeltaEntry[] = [];
    const losses: FuelDeltaEntry[] = [];

    for (const [fuelId, value] of entry.deltasByFuel) {
      if (value > FUEL_SWITCH_EPSILON_PJ) {
        gains.push({
          fuelId,
          fuelLabel: getCommodityMetadata(fuelId).label,
          value,
        });
      } else if (value < -FUEL_SWITCH_EPSILON_PJ) {
        losses.push({
          fuelId,
          fuelLabel: getCommodityMetadata(fuelId).label,
          value: Math.abs(value),
        });
      }
    }

    if (gains.length === 0 || losses.length === 0) {
      continue;
    }

    const totalGain = gains.reduce((sum, gain) => sum + gain.value, 0);
    const totalLoss = losses.reduce((sum, loss) => sum + loss.value, 0);

    if (totalGain <= FUEL_SWITCH_EPSILON_PJ || totalLoss <= FUEL_SWITCH_EPSILON_PJ) {
      continue;
    }

    for (const matrixEntry of buildFuelSwitchMatrix(gains, losses, totalGain, totalLoss)) {
      rows.push({
        key: `${entry.year}::${entry.outputId}::${matrixEntry.fromFuel.fuelId}::${matrixEntry.toFuel.fuelId}`,
        outputId: entry.outputId,
        outputLabel: entry.outputLabel,
        year: entry.year,
        fromFuelId: matrixEntry.fromFuel.fuelId,
        fromFuelLabel: matrixEntry.fromFuel.fuelLabel,
        toFuelId: matrixEntry.toFuel.fuelId,
        toFuelLabel: matrixEntry.toFuel.fuelLabel,
        toBasisPj: matrixEntry.toBasisPj,
        fromBasisPj: matrixEntry.fromBasisPj,
      });
    }
  }

  return rows.sort((left, right) =>
    left.year - right.year
    || left.outputLabel.localeCompare(right.outputLabel)
    || left.fromFuelLabel.localeCompare(right.fromFuelLabel)
    || left.toFuelLabel.localeCompare(right.toFuelLabel));
}

export function collectFuelSwitchYears(
  rows: FuelSwitchAttributionRow[],
): number[] {
  return Array.from(new Set(rows.map((row) => row.year))).sort((left, right) => left - right);
}

export function buildFuelSwitchChartData(
  rows: FuelSwitchAttributionRow[],
  availableYears: number[],
  basis: FuelSwitchBasis,
): {
  years: number[];
  series: FuelSwitchChartDatum[];
} {
  const years = Array.from(
    new Set([
      ...availableYears,
      ...rows.map((row) => row.year),
    ]),
  ).sort((left, right) => left - right);
  const seriesByKey = new Map<string, {
    key: string;
    fromFuelId: string;
    toFuelId: string;
    colorCommodityId: string;
    label: string;
    total: number;
    valuesByYear: Map<number, number>;
  }>();

  for (const row of rows) {
    const value = basis === 'to' ? row.toBasisPj : row.fromBasisPj;

    if (value <= FUEL_SWITCH_EPSILON_PJ) {
      continue;
    }

    const key = `${row.fromFuelId}::${row.toFuelId}`;
    const existing = seriesByKey.get(key) ?? {
      key,
      fromFuelId: row.fromFuelId,
      toFuelId: row.toFuelId,
      colorCommodityId: basis === 'to' ? row.toFuelId : row.fromFuelId,
      label: `${row.fromFuelLabel} -> ${row.toFuelLabel}`,
      total: 0,
      valuesByYear: new Map<number, number>(),
    };

    existing.total += value;
    existing.valuesByYear.set(row.year, (existing.valuesByYear.get(row.year) ?? 0) + value);
    seriesByKey.set(key, existing);
  }

  const series = Array.from(seriesByKey.values())
    .sort((left, right) =>
      right.total - left.total
      || left.label.localeCompare(right.label)
      || left.colorCommodityId.localeCompare(right.colorCommodityId))
    .map((entry) => ({
      key: entry.key,
      fromFuelId: entry.fromFuelId,
      toFuelId: entry.toFuelId,
      colorCommodityId: entry.colorCommodityId,
      label: entry.label,
      values: years.map((year) => ({
        year,
        value: entry.valuesByYear.get(year) ?? 0,
      })),
    }));

  return { years, series };
}
