import { getCommodityMetadata } from '../data/commodityMetadata.ts';
import { buildFuelSwitchLegendLabel } from '../data/chartPresentation.ts';
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
  attributionBasis: 'fuel_mix_focus_total';
}

export interface FuelSwitchActivityRow {
  outputId: string;
  outputLabel: string;
  year: number;
  activity: number;
}

export interface FuelSwitchResidualRow {
  key: string;
  outputId: string;
  outputLabel: string;
  year: number;
  fuelId: string;
  fuelLabel: string;
  effect: 'activity' | 'intensity' | 'scale';
  valuePj: number;
}

export interface FuelSwitchNetDeltaRow {
  key: string;
  outputId: string;
  outputLabel: string;
  year: number;
  fuelId: string;
  fuelLabel: string;
  valuePj: number;
}

export interface FuelSwitchDecompositionResult {
  switchRows: FuelSwitchAttributionRow[];
  residualRows: FuelSwitchResidualRow[];
  netDeltaRows: FuelSwitchNetDeltaRow[];
}

export interface FuelSwitchChartDatum {
  key: string;
  fromFuelId: string;
  toFuelId: string;
  colorCommodityId: string;
  label: string;
  legendLabel: string;
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

interface FuelTotalEntry {
  baseValue: number;
  focusValue: number;
}

interface FuelTotalGroup {
  outputId: string;
  outputLabel: string;
  year: number;
  fuels: Map<string, FuelTotalEntry>;
}

interface FuelDecompositionEntry {
  fuelId: string;
  fuelLabel: string;
  netDelta: number;
  mixDelta: number;
  residuals: Map<FuelSwitchResidualRow['effect'], number>;
}

function buildOutputYearKey(year: number, outputId: string): string {
  return `${year}::${outputId}`;
}

function shouldIncludeFuelContribution(row: ResultContributionRow): boolean {
  return (
    row.metric === 'fuel'
    && row.sourceKind === 'solver'
    && row.commodityId != null
    && row.outputId != null
  );
}

function addFuelTotals(
  groups: Map<string, FuelTotalGroup>,
  contributions: ResultContributionRow[],
  side: keyof FuelTotalEntry,
): void {
  for (const row of contributions) {
    if (
      !shouldIncludeFuelContribution(row)
      || row.outputId == null
      || row.commodityId == null
    ) {
      continue;
    }

    const key = buildOutputYearKey(row.year, row.outputId);
    const group = groups.get(key) ?? {
      outputId: row.outputId,
      outputLabel: row.outputLabel ?? row.outputId,
      year: row.year,
      fuels: new Map<string, FuelTotalEntry>(),
    };
    const entry = group.fuels.get(row.commodityId) ?? {
      baseValue: 0,
      focusValue: 0,
    };

    entry[side] += row.value;
    group.fuels.set(row.commodityId, entry);

    if (row.outputLabel != null) {
      group.outputLabel = row.outputLabel;
    }

    groups.set(key, group);
  }
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

function buildActivityLookup(
  activities: FuelSwitchActivityRow[] | undefined,
): Map<string, FuelSwitchActivityRow> {
  const lookup = new Map<string, FuelSwitchActivityRow>();

  if (activities == null) {
    return lookup;
  }

  for (const row of activities) {
    const key = buildOutputYearKey(row.year, row.outputId);
    const existing = lookup.get(key);

    if (existing == null) {
      lookup.set(key, { ...row });
      continue;
    }

    existing.activity += row.activity;
    existing.outputLabel = row.outputLabel;
  }

  return lookup;
}

function addResidual(
  residuals: Map<FuelSwitchResidualRow['effect'], number>,
  effect: FuelSwitchResidualRow['effect'],
  value: number,
): void {
  if (Math.abs(value) <= FUEL_SWITCH_EPSILON_PJ) {
    return;
  }

  residuals.set(effect, (residuals.get(effect) ?? 0) + value);
}

function buildFuelDecompositionEntries(
  group: FuelTotalGroup,
  baseActivity: FuelSwitchActivityRow | undefined,
  focusActivity: FuelSwitchActivityRow | undefined,
): FuelDecompositionEntry[] {
  const baseTotal = Array.from(group.fuels.values()).reduce((sum, fuel) => sum + fuel.baseValue, 0);
  const focusTotal = Array.from(group.fuels.values()).reduce((sum, fuel) => sum + fuel.focusValue, 0);
  const hasBaseTotal = baseTotal > FUEL_SWITCH_EPSILON_PJ;
  const hasFocusTotal = focusTotal > FUEL_SWITCH_EPSILON_PJ;
  const canUseMix = hasBaseTotal && hasFocusTotal;
  const canUseActivity =
    hasBaseTotal
    && (baseActivity?.activity ?? 0) > FUEL_SWITCH_EPSILON_PJ
    && (focusActivity?.activity ?? 0) > FUEL_SWITCH_EPSILON_PJ;
  const baseIntensity = canUseActivity ? baseTotal / baseActivity!.activity : 0;
  const focusIntensity = canUseActivity ? focusTotal / focusActivity!.activity : 0;
  const entries: FuelDecompositionEntry[] = [];

  for (const [fuelId, total] of group.fuels) {
    const fuelLabel = getCommodityMetadata(fuelId).label;
    const baseShare = hasBaseTotal ? total.baseValue / baseTotal : 0;
    const focusShare = hasFocusTotal ? total.focusValue / focusTotal : 0;
    const netDelta = total.focusValue - total.baseValue;
    const mixDelta = canUseMix ? focusTotal * (focusShare - baseShare) : 0;
    const residuals = new Map<FuelSwitchResidualRow['effect'], number>();

    if (canUseActivity) {
      const intensityDelta = focusActivity!.activity * (focusIntensity - baseIntensity) * baseShare;
      const activityDelta = (focusActivity!.activity - baseActivity!.activity) * baseIntensity * baseShare;

      addResidual(residuals, 'intensity', intensityDelta);
      addResidual(residuals, 'activity', activityDelta);
    } else if (canUseMix) {
      addResidual(residuals, 'scale', netDelta - mixDelta);
    } else {
      addResidual(residuals, 'scale', netDelta);
    }

    entries.push({
      fuelId,
      fuelLabel,
      netDelta,
      mixDelta,
      residuals,
    });
  }

  return entries;
}

function sortFuelSwitchRows(rows: FuelSwitchAttributionRow[]): FuelSwitchAttributionRow[] {
  return rows.sort((left, right) =>
    left.year - right.year
    || left.outputLabel.localeCompare(right.outputLabel)
    || left.fromFuelLabel.localeCompare(right.fromFuelLabel)
    || left.toFuelLabel.localeCompare(right.toFuelLabel));
}

function sortResidualRows(rows: FuelSwitchResidualRow[]): FuelSwitchResidualRow[] {
  return rows.sort((left, right) =>
    left.year - right.year
    || left.outputLabel.localeCompare(right.outputLabel)
    || left.fuelLabel.localeCompare(right.fuelLabel)
    || left.effect.localeCompare(right.effect));
}

function sortNetDeltaRows(rows: FuelSwitchNetDeltaRow[]): FuelSwitchNetDeltaRow[] {
  return rows.sort((left, right) =>
    left.year - right.year
    || left.outputLabel.localeCompare(right.outputLabel)
    || left.fuelLabel.localeCompare(right.fuelLabel));
}

export function buildFuelSwitchDecomposition(
  baseContributions: ResultContributionRow[],
  focusContributions: ResultContributionRow[],
  options: {
    baseActivities?: FuelSwitchActivityRow[];
    focusActivities?: FuelSwitchActivityRow[];
  } = {},
): FuelSwitchDecompositionResult {
  const switchRows: FuelSwitchAttributionRow[] = [];
  const residualRows: FuelSwitchResidualRow[] = [];
  const netDeltaRows: FuelSwitchNetDeltaRow[] = [];
  const groups = new Map<string, FuelTotalGroup>();
  const baseActivityLookup = buildActivityLookup(options.baseActivities);
  const focusActivityLookup = buildActivityLookup(options.focusActivities);

  addFuelTotals(groups, baseContributions, 'baseValue');
  addFuelTotals(groups, focusContributions, 'focusValue');

  for (const entry of groups.values()) {
    const outputYearKey = buildOutputYearKey(entry.year, entry.outputId);
    const decompositionEntries = buildFuelDecompositionEntries(
      entry,
      baseActivityLookup.get(outputYearKey),
      focusActivityLookup.get(outputYearKey),
    );
    const gains: FuelDeltaEntry[] = [];
    const losses: FuelDeltaEntry[] = [];

    for (const fuelEntry of decompositionEntries) {
      if (Math.abs(fuelEntry.netDelta) > FUEL_SWITCH_EPSILON_PJ) {
        netDeltaRows.push({
          key: `${entry.year}::${entry.outputId}::${fuelEntry.fuelId}`,
          outputId: entry.outputId,
          outputLabel: entry.outputLabel,
          year: entry.year,
          fuelId: fuelEntry.fuelId,
          fuelLabel: fuelEntry.fuelLabel,
          valuePj: fuelEntry.netDelta,
        });
      }

      for (const [effect, valuePj] of fuelEntry.residuals) {
        residualRows.push({
          key: `${entry.year}::${entry.outputId}::${fuelEntry.fuelId}::${effect}`,
          outputId: entry.outputId,
          outputLabel: entry.outputLabel,
          year: entry.year,
          fuelId: fuelEntry.fuelId,
          fuelLabel: fuelEntry.fuelLabel,
          effect,
          valuePj,
        });
      }

      if (fuelEntry.mixDelta > FUEL_SWITCH_EPSILON_PJ) {
        gains.push({
          fuelId: fuelEntry.fuelId,
          fuelLabel: fuelEntry.fuelLabel,
          value: fuelEntry.mixDelta,
        });
      } else if (fuelEntry.mixDelta < -FUEL_SWITCH_EPSILON_PJ) {
        losses.push({
          fuelId: fuelEntry.fuelId,
          fuelLabel: fuelEntry.fuelLabel,
          value: Math.abs(fuelEntry.mixDelta),
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
      switchRows.push({
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
        attributionBasis: 'fuel_mix_focus_total',
      });
    }
  }

  return {
    switchRows: sortFuelSwitchRows(switchRows),
    residualRows: sortResidualRows(residualRows),
    netDeltaRows: sortNetDeltaRows(netDeltaRows),
  };
}

export function buildFuelSwitchAttributionRows(
  baseContributions: ResultContributionRow[],
  focusContributions: ResultContributionRow[],
): FuelSwitchAttributionRow[] {
  return buildFuelSwitchDecomposition(baseContributions, focusContributions).switchRows;
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
    legendLabel: string;
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
      legendLabel: buildFuelSwitchLegendLabel(row.fromFuelId, row.toFuelId),
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
      legendLabel: entry.legendLabel,
      values: years.map((year) => ({
        year,
        value: entry.valuesByYear.get(year) ?? 0,
      })),
    }));

  return { years, series };
}
