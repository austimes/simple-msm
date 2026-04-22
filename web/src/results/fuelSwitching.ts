import {
  convertUnitQuantity,
  getCommodityMetadata,
  parseUnitRatio,
} from '../data/commodityMetadata.ts';
import { buildFuelSwitchLegendLabel } from '../data/chartPresentation.ts';
import type { FuelSwitchBasis } from '../data/types.ts';
import type { ResultContributionRow } from './resultContributions.ts';
import type {
  NormalizedSolverRow,
  SolveRequest,
  SolveResult,
  SolveStateShareSummary,
} from '../solver/contract.ts';

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
  attributionBasis: 'fuel_mix_focus_total' | 'route_change_fuel_mix_focus_total';
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

export interface FuelSwitchFuelTotalRow {
  outputId: string;
  outputLabel: string;
  year: number;
  fuelId: string;
  fuelLabel: string;
  valuePj: number;
}

export interface FuelSwitchRouteBasisResult {
  baseSwitchBasisRows: FuelSwitchFuelTotalRow[];
  focusSwitchBasisRows: FuelSwitchFuelTotalRow[];
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

interface RouteFuelVector {
  fuels: Map<string, number>;
}

interface RouteActivityEntry {
  outputId: string;
  outputLabel: string;
  year: number;
  pathwayStateId: string;
  activity: number;
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

function buildRouteKey(outputId: string, year: number, pathwayStateId: string): string {
  return `${outputId}::${year}::${pathwayStateId}`;
}

function convertFuelConsumptionToPj(value: number, unit: string): number {
  const { numerator } = parseUnitRatio(unit);
  return convertUnitQuantity(value, numerator as 'GJ' | 'MWh' | 'PJ', 'PJ');
}

function resolvePathwayStateId(
  row: Pick<NormalizedSolverRow, 'stateId' | 'provenance'>,
): string {
  return row.provenance?.baseStateId ?? row.stateId;
}

function resolveStateSharePathwayStateId(stateShare: SolveStateShareSummary): string {
  return stateShare.pathwayStateId ?? stateShare.provenance?.baseStateId ?? stateShare.stateId;
}

function shouldIncludeRouteReferenceRow(row: NormalizedSolverRow): boolean {
  return row.provenance?.kind !== 'efficiency_package';
}

function shouldIncludeFuelContribution(row: ResultContributionRow): boolean {
  return (
    row.metric === 'fuel'
    && row.sourceKind === 'solver'
    && row.commodityId != null
    && row.outputId != null
  );
}

function getOrCreateFuelTotalGroup(
  groups: Map<string, FuelTotalGroup>,
  year: number,
  outputId: string,
  outputLabel: string,
): FuelTotalGroup {
  const key = buildOutputYearKey(year, outputId);
  const group = groups.get(key) ?? {
    outputId,
    outputLabel,
    year,
    fuels: new Map<string, FuelTotalEntry>(),
  };

  groups.set(key, group);
  return group;
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

    const group = getOrCreateFuelTotalGroup(
      groups,
      row.year,
      row.outputId,
      row.outputLabel ?? row.outputId,
    );
    const entry = group.fuels.get(row.commodityId) ?? {
      baseValue: 0,
      focusValue: 0,
    };

    entry[side] += row.value;
    group.fuels.set(row.commodityId, entry);

    if (row.outputLabel != null) {
      group.outputLabel = row.outputLabel;
    }

  }
}

function addFuelTotalRows(
  groups: Map<string, FuelTotalGroup>,
  rows: FuelSwitchFuelTotalRow[] | undefined,
  side: keyof FuelTotalEntry,
): void {
  for (const row of rows ?? []) {
    const group = getOrCreateFuelTotalGroup(
      groups,
      row.year,
      row.outputId,
      row.outputLabel,
    );
    const entry = group.fuels.get(row.fuelId) ?? {
      baseValue: 0,
      focusValue: 0,
    };

    entry[side] += row.valuePj;
    group.fuels.set(row.fuelId, entry);
    group.outputLabel = row.outputLabel;
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
  actualFuels: Map<string, FuelTotalEntry>,
  switchBasisFuels: Map<string, FuelTotalEntry>,
  baseActivity: FuelSwitchActivityRow | undefined,
  focusActivity: FuelSwitchActivityRow | undefined,
): FuelDecompositionEntry[] {
  const baseSwitchTotal = Array.from(switchBasisFuels.values()).reduce((sum, fuel) => sum + fuel.baseValue, 0);
  const focusSwitchTotal = Array.from(switchBasisFuels.values()).reduce((sum, fuel) => sum + fuel.focusValue, 0);
  const hasBaseSwitchTotal = baseSwitchTotal > FUEL_SWITCH_EPSILON_PJ;
  const hasFocusSwitchTotal = focusSwitchTotal > FUEL_SWITCH_EPSILON_PJ;
  const canUseMix = hasBaseSwitchTotal && hasFocusSwitchTotal;
  const canUseActivity =
    hasBaseSwitchTotal
    && (baseActivity?.activity ?? 0) > FUEL_SWITCH_EPSILON_PJ
    && (focusActivity?.activity ?? 0) > FUEL_SWITCH_EPSILON_PJ;
  const baseRouteIntensity = canUseActivity ? baseSwitchTotal / baseActivity!.activity : 0;
  const fuelIds = new Set([
    ...actualFuels.keys(),
    ...switchBasisFuels.keys(),
  ]);
  const entries: FuelDecompositionEntry[] = [];

  for (const fuelId of fuelIds) {
    const actualTotal = actualFuels.get(fuelId) ?? {
      baseValue: 0,
      focusValue: 0,
    };
    const switchBasisTotal = switchBasisFuels.get(fuelId) ?? {
      baseValue: 0,
      focusValue: 0,
    };
    const fuelLabel = getCommodityMetadata(fuelId).label;
    const baseShare = hasBaseSwitchTotal ? switchBasisTotal.baseValue / baseSwitchTotal : 0;
    const focusShare = hasFocusSwitchTotal ? switchBasisTotal.focusValue / focusSwitchTotal : 0;
    const netDelta = actualTotal.focusValue - actualTotal.baseValue;
    const mixDelta = canUseMix ? focusSwitchTotal * (focusShare - baseShare) : 0;
    const residuals = new Map<FuelSwitchResidualRow['effect'], number>();

    if (canUseActivity) {
      const activityDelta = (focusActivity!.activity - baseActivity!.activity) * baseRouteIntensity * baseShare;
      const intensityDelta = netDelta - mixDelta - activityDelta;

      addResidual(residuals, 'intensity', intensityDelta);
      addResidual(residuals, 'activity', activityDelta);
    } else {
      addResidual(residuals, 'scale', netDelta - mixDelta);
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

function sortFuelTotalRows(rows: FuelSwitchFuelTotalRow[]): FuelSwitchFuelTotalRow[] {
  return rows.sort((left, right) =>
    left.year - right.year
    || left.outputLabel.localeCompare(right.outputLabel)
    || left.fuelLabel.localeCompare(right.fuelLabel));
}

function buildRouteFuelVectors(request: SolveRequest): Map<string, RouteFuelVector> {
  const vectors = new Map<string, RouteFuelVector>();

  for (const row of request.rows) {
    if (!shouldIncludeRouteReferenceRow(row)) {
      continue;
    }

    const pathwayStateId = resolvePathwayStateId(row);
    const key = buildRouteKey(row.outputId, row.year, pathwayStateId);
    const vector = vectors.get(key) ?? {
      fuels: new Map<string, number>(),
    };

    for (const input of row.inputs) {
      const metadata = getCommodityMetadata(input.commodityId);
      if (metadata.kind !== 'fuel') {
        continue;
      }

      const valuePerActivityPj = convertFuelConsumptionToPj(input.coefficient, input.unit);
      vector.fuels.set(
        input.commodityId,
        (vector.fuels.get(input.commodityId) ?? 0) + valuePerActivityPj,
      );
    }

    vectors.set(key, vector);
  }

  return vectors;
}

function buildReferenceRouteFuelVectors(
  baseRequest: SolveRequest,
  focusRequest: SolveRequest,
): Map<string, RouteFuelVector> {
  const referenceVectors = new Map(buildRouteFuelVectors(focusRequest));

  for (const [key, vector] of buildRouteFuelVectors(baseRequest)) {
    referenceVectors.set(key, vector);
  }

  return referenceVectors;
}

function buildRouteActivityEntries(stateShares: SolveStateShareSummary[]): Map<string, RouteActivityEntry> {
  const activities = new Map<string, RouteActivityEntry>();

  for (const stateShare of stateShares) {
    if (Math.abs(stateShare.activity) <= FUEL_SWITCH_EPSILON_PJ) {
      continue;
    }

    const pathwayStateId = resolveStateSharePathwayStateId(stateShare);
    const key = buildRouteKey(stateShare.outputId, stateShare.year, pathwayStateId);
    const entry = activities.get(key) ?? {
      outputId: stateShare.outputId,
      outputLabel: stateShare.outputLabel,
      year: stateShare.year,
      pathwayStateId,
      activity: 0,
    };

    entry.activity += stateShare.activity;
    entry.outputLabel = stateShare.outputLabel;
    activities.set(key, entry);
  }

  return activities;
}

function buildSwitchBasisRowsForResult(
  result: SolveResult,
  referenceVectors: Map<string, RouteFuelVector>,
): FuelSwitchFuelTotalRow[] {
  const rowsByKey = new Map<string, FuelSwitchFuelTotalRow>();

  for (const activity of buildRouteActivityEntries(result.reporting.stateShares).values()) {
    const vector = referenceVectors.get(buildRouteKey(
      activity.outputId,
      activity.year,
      activity.pathwayStateId,
    ));

    if (vector == null) {
      continue;
    }

    for (const [fuelId, valuePerActivityPj] of vector.fuels) {
      const valuePj = activity.activity * valuePerActivityPj;
      if (Math.abs(valuePj) <= FUEL_SWITCH_EPSILON_PJ) {
        continue;
      }

      const key = `${activity.year}::${activity.outputId}::${fuelId}`;
      const existing = rowsByKey.get(key);

      if (existing == null) {
        rowsByKey.set(key, {
          outputId: activity.outputId,
          outputLabel: activity.outputLabel,
          year: activity.year,
          fuelId,
          fuelLabel: getCommodityMetadata(fuelId).label,
          valuePj,
        });
        continue;
      }

      existing.valuePj += valuePj;
      existing.outputLabel = activity.outputLabel;
    }
  }

  return sortFuelTotalRows(Array.from(rowsByKey.values()));
}

export function buildFuelSwitchDecomposition(
  baseContributions: ResultContributionRow[],
  focusContributions: ResultContributionRow[],
  options: {
    baseActivities?: FuelSwitchActivityRow[];
    focusActivities?: FuelSwitchActivityRow[];
    baseSwitchBasisRows?: FuelSwitchFuelTotalRow[];
    focusSwitchBasisRows?: FuelSwitchFuelTotalRow[];
  } = {},
): FuelSwitchDecompositionResult {
  const switchRows: FuelSwitchAttributionRow[] = [];
  const residualRows: FuelSwitchResidualRow[] = [];
  const netDeltaRows: FuelSwitchNetDeltaRow[] = [];
  const actualGroups = new Map<string, FuelTotalGroup>();
  const switchBasisGroups = new Map<string, FuelTotalGroup>();
  const baseActivityLookup = buildActivityLookup(options.baseActivities);
  const focusActivityLookup = buildActivityLookup(options.focusActivities);
  const usesRouteSwitchBasis =
    options.baseSwitchBasisRows != null || options.focusSwitchBasisRows != null;
  const attributionBasis: FuelSwitchAttributionRow['attributionBasis'] = usesRouteSwitchBasis
    ? 'route_change_fuel_mix_focus_total'
    : 'fuel_mix_focus_total';

  addFuelTotals(actualGroups, baseContributions, 'baseValue');
  addFuelTotals(actualGroups, focusContributions, 'focusValue');

  if (usesRouteSwitchBasis) {
    addFuelTotalRows(switchBasisGroups, options.baseSwitchBasisRows, 'baseValue');
    addFuelTotalRows(switchBasisGroups, options.focusSwitchBasisRows, 'focusValue');
  } else {
    addFuelTotals(switchBasisGroups, baseContributions, 'baseValue');
    addFuelTotals(switchBasisGroups, focusContributions, 'focusValue');
  }

  const outputYearKeys = new Set([
    ...actualGroups.keys(),
    ...switchBasisGroups.keys(),
  ]);

  for (const outputYearKey of outputYearKeys) {
    const actualGroup = actualGroups.get(outputYearKey);
    const switchBasisGroup = switchBasisGroups.get(outputYearKey);
    const outputId = actualGroup?.outputId ?? switchBasisGroup!.outputId;
    const outputLabel = actualGroup?.outputLabel ?? switchBasisGroup!.outputLabel;
    const year = actualGroup?.year ?? switchBasisGroup!.year;
    const decompositionEntries = buildFuelDecompositionEntries(
      actualGroup?.fuels ?? new Map<string, FuelTotalEntry>(),
      switchBasisGroup?.fuels ?? new Map<string, FuelTotalEntry>(),
      baseActivityLookup.get(outputYearKey),
      focusActivityLookup.get(outputYearKey),
    );
    const gains: FuelDeltaEntry[] = [];
    const losses: FuelDeltaEntry[] = [];

    for (const fuelEntry of decompositionEntries) {
      if (Math.abs(fuelEntry.netDelta) > FUEL_SWITCH_EPSILON_PJ) {
        netDeltaRows.push({
          key: `${year}::${outputId}::${fuelEntry.fuelId}`,
          outputId,
          outputLabel,
          year,
          fuelId: fuelEntry.fuelId,
          fuelLabel: fuelEntry.fuelLabel,
          valuePj: fuelEntry.netDelta,
        });
      }

      for (const [effect, valuePj] of fuelEntry.residuals) {
        residualRows.push({
          key: `${year}::${outputId}::${fuelEntry.fuelId}::${effect}`,
          outputId,
          outputLabel,
          year,
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
        key: `${year}::${outputId}::${matrixEntry.fromFuel.fuelId}::${matrixEntry.toFuel.fuelId}`,
        outputId,
        outputLabel,
        year,
        fromFuelId: matrixEntry.fromFuel.fuelId,
        fromFuelLabel: matrixEntry.fromFuel.fuelLabel,
        toFuelId: matrixEntry.toFuel.fuelId,
        toFuelLabel: matrixEntry.toFuel.fuelLabel,
        toBasisPj: matrixEntry.toBasisPj,
        fromBasisPj: matrixEntry.fromBasisPj,
        attributionBasis,
      });
    }
  }

  return {
    switchRows: sortFuelSwitchRows(switchRows),
    residualRows: sortResidualRows(residualRows),
    netDeltaRows: sortNetDeltaRows(netDeltaRows),
  };
}

export function buildFuelSwitchRouteBasisRows(
  baseRequest: SolveRequest,
  baseResult: SolveResult,
  focusRequest: SolveRequest,
  focusResult: SolveResult,
): FuelSwitchRouteBasisResult {
  const referenceVectors = buildReferenceRouteFuelVectors(baseRequest, focusRequest);

  return {
    baseSwitchBasisRows: buildSwitchBasisRowsForResult(baseResult, referenceVectors),
    focusSwitchBasisRows: buildSwitchBasisRowsForResult(focusResult, referenceVectors),
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
