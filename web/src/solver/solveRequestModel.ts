import type {
  AppConfigRegistry,
  AutonomousEfficiencyTrack,
  CommodityPriceSeries,
  EfficiencyPackage,
  PackageData,
  ConfigurationDocument,
  ResolvedMethodYearRow,
} from '../data/types.ts';
import { getCommodityMetadata, normalizeCommodityInput } from '../data/commodityMetadata.ts';
import { materializeEfficiencyConfiguration } from '../data/configurationDocumentLoader.ts';
import {
  resolveOutputControlsFromRoleControls,
  type SolverOutputControl,
} from '../data/configurationRoleControls.ts';
import { resolveConfigurationDocument } from '../data/demandResolution.ts';
import { resolveActiveEfficiencyPackageIds } from '../data/efficiencyControlModel.ts';
import { derivePathwayMethodIds } from '../data/pathwaySemantics.ts';
import type {
  NormalizedSolverRow,
  NormalizedSolverRowProvenance,
  ResolvedCommodityPriceSeries,
  ResolvedConfigurationEfficiencyControls,
  ResolvedConfigurationForSolve,
  ResolvedSolveControl,
} from './contract.ts';

export function yearKey(year: number): string {
  return String(year);
}

function methodYearKey(methodId: string, year: number): string {
  return `${methodId}::${year}`;
}

function resolveYearValue(table: Record<string, number> | undefined, year: number): number {
  const value = table?.[yearKey(year)];
  return typeof value === 'number' ? value : 0;
}

const BASE_YEAR = 2025;
const EFFICIENCY_PACKAGE_METHOD_PREFIX = 'effpkg';

function resolveMethodDisplayLabel(row: ResolvedMethodYearRow): string {
  const preferredLabel = (row.method_label_standardized ?? '').trim()
    || (row.method_option_label ?? '').trim()
    || (row.method_label ?? '').trim();

  return preferredLabel || row.method_id;
}

function collectIncumbentMethodIdsByOutput(
  resolvedMethodYears: Pick<ResolvedMethodYearRow, 'output_id' | 'year' | 'method_id' | 'is_default_incumbent_2025'>[] | undefined,
): Map<string, string[]> {
  const byOutput = new Map<string, Set<string>>();

  for (const row of resolvedMethodYears ?? []) {
    if (row.year !== BASE_YEAR || !row.is_default_incumbent_2025) continue;

    let ids = byOutput.get(row.output_id);
    if (!ids) {
      ids = new Set<string>();
      byOutput.set(row.output_id, ids);
    }
    ids.add(row.method_id);
  }

  return new Map(
    Array.from(byOutput.entries()).map(([outputId, ids]) => [outputId, Array.from(ids)]),
  );
}

function collectMethodIdsByOutputYear(
  resolvedMethodYears: Pick<ResolvedMethodYearRow, 'output_id' | 'year' | 'method_id'>[] | undefined,
): Map<string, Map<number, string[]>> {
  const byOutputYear = new Map<string, Map<number, Set<string>>>();

  for (const row of resolvedMethodYears ?? []) {
    let byYear = byOutputYear.get(row.output_id);
    if (!byYear) {
      byYear = new Map();
      byOutputYear.set(row.output_id, byYear);
    }

    let ids = byYear.get(row.year);
    if (!ids) {
      ids = new Set();
      byYear.set(row.year, ids);
    }

    ids.add(row.method_id);
  }

  return new Map(
    Array.from(byOutputYear.entries()).map(([outputId, byYear]) => [
      outputId,
      new Map(Array.from(byYear.entries()).map(([year, ids]) => [year, Array.from(ids)])),
    ]),
  );
}

function hasConfiguredActiveMethods(
  outputId: string,
  years: readonly number[],
  control: SolverOutputControl | undefined,
  defaultMode: AppConfigRegistry['output_roles'][string]['default_control_mode'],
  methodIdsByOutputYear: Map<string, Map<number, string[]>>,
): boolean {
  const byYear = methodIdsByOutputYear.get(outputId);

  for (const year of years) {
    const availableMethodIds = byYear?.get(year) ?? [];
    const unforcedControl = resolveControlForYear(control, defaultMode, year);
    const derived = derivePathwayMethodIds(availableMethodIds, unforcedControl);

    if (derived.activeMethodIds.length > 0) {
      return true;
    }
  }

  return false;
}

function resolveControlForYear(
  control: SolverOutputControl | undefined,
  defaultMode: AppConfigRegistry['output_roles'][string]['default_control_mode'],
  year: number,
  forcedActiveMethodIds?: string[],
): ResolvedSolveControl {
  const override = control?.yearOverrides?.[yearKey(year)] ?? null;

  return {
    mode: override?.mode ?? control?.mode ?? defaultMode,
    activeMethodIds: forcedActiveMethodIds
      ?? override?.activeMethodIds
      ?? control?.activeMethodIds
      ?? null,
    targetValue: override?.targetValue ?? control?.targetValue ?? null,
  };
}

function resolveCommodityPriceSeries(
  baseSeries: CommodityPriceSeries | undefined,
  overrideSeries: Record<string, number> | undefined,
  years: number[],
): ResolvedCommodityPriceSeries {
  const valuesByYear = years.reduce<Record<string, number>>((resolved, year) => {
    const key = yearKey(year);
    const overrideValue = overrideSeries?.[key];
    const baseValue = baseSeries?.values_by_year[key];
    resolved[key] = typeof overrideValue === 'number'
      ? overrideValue
      : typeof baseValue === 'number'
        ? baseValue
        : 0;
    return resolved;
  }, {});

  return {
    unit: baseSeries?.unit ?? 'unspecified',
    valuesByYear,
  };
}

function resolveEfficiencyControlsForSolve(
  configuration: ConfigurationDocument,
  autonomousEfficiencyTracks: Pick<AutonomousEfficiencyTrack, 'family_id' | 'track_id'>[],
  efficiencyPackages: Pick<EfficiencyPackage, 'family_id' | 'package_id'>[],
  resolvedMethodYears?: Pick<ResolvedMethodYearRow, 'role_id' | 'output_id'>[],
): ResolvedConfigurationEfficiencyControls {
  const materializedConfiguration = materializeEfficiencyConfiguration(
    configuration,
    autonomousEfficiencyTracks,
    efficiencyPackages,
    resolvedMethodYears,
  );
  const controls = materializedConfiguration.efficiency_controls;
  const autonomousModesByRole = controls?.autonomous_modes_by_role ?? {};
  const activeTrackIds = Array.from(
    new Set(
      autonomousEfficiencyTracks
        .filter((track) => {
          const effectiveMode =
            autonomousModesByRole[track.family_id]
            ?? controls?.autonomous_mode
            ?? 'baseline';
          return effectiveMode === 'baseline';
        })
        .map((track) => track.track_id),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const configuredPackageIds = controls?.package_ids ?? [];

  return {
    autonomousMode: controls?.autonomous_mode ?? 'baseline',
    autonomousModesByRole,
    activeTrackIds,
    packageMode: controls?.package_mode ?? 'off',
    configuredPackageIds,
    activePackageIds: resolveActiveEfficiencyPackageIds(controls, efficiencyPackages),
  };
}

function buildNormalizedInputs(row: ResolvedMethodYearRow): NormalizedSolverRow['inputs'] {
  return row.input_commodities.map((commodityId, index) => {
    const normalizedInput = normalizeCommodityInput(
      commodityId,
      row.input_coefficients[index] ?? 0,
      row.input_units[index] ?? row.output_unit,
    );

    return {
      commodityId,
      coefficient: normalizedInput.coefficient,
      unit: normalizedInput.unit,
    };
  });
}

function buildBaseRowProvenance(row: ResolvedMethodYearRow): NormalizedSolverRowProvenance {
  return {
    kind: 'base_method',
    familyId: row.output_id,
    baseMethodId: row.method_id,
    baseMethodLabel: resolveMethodDisplayLabel(row),
    baseRowId: methodYearKey(row.method_id, row.year),
    autonomousTrackIds: [],
  };
}

function buildBaseNormalizedRow(
  row: ResolvedMethodYearRow,
  appConfig: AppConfigRegistry,
): NormalizedSolverRow {
  const outputMetadata = appConfig.output_roles[row.output_id];

  if (!outputMetadata) {
    throw new Error(
      `Missing output role metadata for ${JSON.stringify(row.output_id)}`,
    );
  }

  const inputs = buildNormalizedInputs(row);
  const directEmissions = [
    ...row.energy_emissions_by_pollutant.map((entry) => ({
      pollutant: entry.pollutant,
      value: entry.value,
      source: 'energy' as const,
    })),
    ...row.process_emissions_by_pollutant.map((entry) => ({
      pollutant: entry.pollutant,
      value: entry.value,
      source: 'process' as const,
    })),
  ];

  const reportingAllocation = row.reporting_allocations[0] ?? null;

  return {
    rowId: methodYearKey(row.method_id, row.year),
    roleId: row.role_id,
    representationId: row.representation_id,
    balanceType: row.balance_type,
    outputId: row.output_id,
    outputRole: outputMetadata.output_role,
    outputLabel: outputMetadata.display_label,
    year: row.year,
    methodId: row.method_id,
    methodLabel: row.method_label,
    methodDisplayLabel: resolveMethodDisplayLabel(row),
    methodSortKey: (row.method_sort_key ?? '').trim(),
    methodOptionRank: row.method_option_rank,
    reportingSectorId: reportingAllocation?.sector ?? null,
    reportingSubsectorId: reportingAllocation?.subsector ?? null,
    reportingBucketId: reportingAllocation?.reporting_bucket ?? null,
    region: row.region,
    outputUnit: row.output_unit,
    conversionCostPerUnit: row.output_cost_per_unit,
    currency: row.currency,
    costBasisYear: row.cost_basis_year,
    inputs,
    directEmissions,
    efficiencyAttributionBasis: {
      baseInputs: inputs,
      baseDirectEmissions: directEmissions,
      baseConversionCostPerUnit: row.output_cost_per_unit,
      autonomousInputs: inputs,
      autonomousDirectEmissions: directEmissions,
      autonomousConversionCostPerUnit: row.output_cost_per_unit,
    },
    provenance: buildBaseRowProvenance(row),
    bounds: {
      minShare: row.min_share,
      maxShare: row.max_share,
      maxActivity: row.max_activity,
    },
  };
}

function applyInputMultipliers(
  inputs: NormalizedSolverRow['inputs'],
  affectedInputCommodities: readonly string[],
  inputMultipliers: readonly number[],
): NormalizedSolverRow['inputs'] {
  const multipliersByCommodity = new Map<string, number>();

  for (const [index, commodityId] of affectedInputCommodities.entries()) {
    multipliersByCommodity.set(commodityId, inputMultipliers[index] ?? 1);
  }

  return inputs.map((input) => ({
    ...input,
    coefficient: input.coefficient * (multipliersByCommodity.get(input.commodityId) ?? 1),
  }));
}

function isDirectCombustionCommodity(commodityId: string): boolean {
  const metadata = getCommodityMetadata(commodityId);
  if (metadata.kind !== 'fuel') {
    return false;
  }

  return commodityId !== 'electricity' && commodityId !== 'hydrogen' && commodityId !== 'biomass';
}

function resolveEnergyEmissionMultiplier(
  inputs: NormalizedSolverRow['inputs'],
  affectedInputCommodities: readonly string[],
  inputMultipliers: readonly number[],
): number {
  const multipliersByCommodity = new Map<string, number>();
  for (const [index, commodityId] of affectedInputCommodities.entries()) {
    multipliersByCommodity.set(commodityId, inputMultipliers[index] ?? 1);
  }

  let originalCombustionInputs = 0;
  let adjustedCombustionInputs = 0;

  for (const input of inputs) {
    if (!isDirectCombustionCommodity(input.commodityId)) {
      continue;
    }

    originalCombustionInputs += input.coefficient;
    adjustedCombustionInputs += input.coefficient * (multipliersByCommodity.get(input.commodityId) ?? 1);
  }

  if (originalCombustionInputs === 0) {
    return 1;
  }

  return adjustedCombustionInputs / originalCombustionInputs;
}

function applyEnergyEmissionMultiplier(
  directEmissions: NormalizedSolverRow['directEmissions'],
  multiplier: number,
): NormalizedSolverRow['directEmissions'] {
  if (multiplier === 1) {
    return directEmissions;
  }

  return directEmissions.map((entry) => (
    entry.source === 'energy'
      ? { ...entry, value: entry.value * multiplier }
      : entry
  ));
}

function applyCostDelta(
  row: NormalizedSolverRow,
  deltaOutputCostPerUnit: number,
  artifactLabel: string,
): number | null {
  if (deltaOutputCostPerUnit === 0) {
    return row.conversionCostPerUnit;
  }

  if (row.conversionCostPerUnit == null) {
    throw new Error(
      `${artifactLabel} cannot adjust conversion cost for ${JSON.stringify(row.rowId)} because the base row has no conversion cost.`,
    );
  }

  return row.conversionCostPerUnit + deltaOutputCostPerUnit;
}

function assertCostMetadataCompatible(
  row: NormalizedSolverRow,
  artifactLabel: string,
  currency: string,
  costBasisYear: number,
): void {
  if (row.currency !== currency || row.costBasisYear !== costBasisYear) {
    throw new Error(
      `${artifactLabel} uses ${currency}/${costBasisYear} but ${JSON.stringify(row.rowId)} uses ${row.currency ?? 'unknown'}/${row.costBasisYear ?? 'unknown'}.`,
    );
  }
}

function applyAutonomousTracksToRow(
  row: NormalizedSolverRow,
  tracks: AutonomousEfficiencyTrack[],
): NormalizedSolverRow {
  if (tracks.length === 0) {
    return row;
  }

  let resolvedRow = row;
  const autonomousTrackIds: string[] = [];

  for (const track of tracks) {
    const artifactLabel = `autonomous efficiency track ${JSON.stringify(track.track_id)}`;
    assertCostMetadataCompatible(resolvedRow, artifactLabel, track.currency, track.cost_basis_year);
    const energyEmissionMultiplier = resolveEnergyEmissionMultiplier(
      resolvedRow.inputs,
      track.affected_input_commodities,
      track.input_multipliers,
    );
    resolvedRow = {
      ...resolvedRow,
      inputs: applyInputMultipliers(
        resolvedRow.inputs,
        track.affected_input_commodities,
        track.input_multipliers,
      ),
      directEmissions: applyEnergyEmissionMultiplier(
        resolvedRow.directEmissions,
        energyEmissionMultiplier,
      ),
      conversionCostPerUnit: applyCostDelta(
        resolvedRow,
        track.delta_output_cost_per_unit,
        artifactLabel,
      ),
    };
    autonomousTrackIds.push(track.track_id);
  }

  if (!resolvedRow.provenance) {
    throw new Error(`Missing base-row provenance for ${JSON.stringify(resolvedRow.rowId)}.`);
  }

  const basis = resolvedRow.efficiencyAttributionBasis ?? {
    baseInputs: row.inputs,
    baseDirectEmissions: row.directEmissions,
    baseConversionCostPerUnit: row.conversionCostPerUnit,
    autonomousInputs: row.inputs,
    autonomousDirectEmissions: row.directEmissions,
    autonomousConversionCostPerUnit: row.conversionCostPerUnit,
  };

  return {
    ...resolvedRow,
    efficiencyAttributionBasis: {
      ...basis,
      autonomousInputs: resolvedRow.inputs,
      autonomousDirectEmissions: resolvedRow.directEmissions,
      autonomousConversionCostPerUnit: resolvedRow.conversionCostPerUnit,
    },
    provenance: {
      ...resolvedRow.provenance,
      autonomousTrackIds,
    },
  };
}

function buildEfficiencyPackageMethodId(baseMethodId: string, packageId: string): string {
  return `${EFFICIENCY_PACKAGE_METHOD_PREFIX}:${baseMethodId}::${packageId}`;
}

function minNullable(left: number | null, right: number | null): number | null {
  if (left == null) return right;
  if (right == null) return left;
  return Math.min(left, right);
}

function buildPackageRow(
  baseRow: NormalizedSolverRow,
  pkg: EfficiencyPackage,
): NormalizedSolverRow {
  const artifactLabel = `efficiency package ${JSON.stringify(pkg.package_id)}`;
  assertCostMetadataCompatible(baseRow, artifactLabel, pkg.currency, pkg.cost_basis_year);
  const methodId = buildEfficiencyPackageMethodId(baseRow.provenance?.baseMethodId ?? baseRow.methodId, pkg.package_id);
  const packageLabel = `${baseRow.methodDisplayLabel ?? baseRow.methodLabel} + ${pkg.package_label}`;
  const energyEmissionMultiplier = resolveEnergyEmissionMultiplier(
    baseRow.inputs,
    pkg.affected_input_commodities,
    pkg.input_multipliers,
  );

  return {
    ...baseRow,
    rowId: methodYearKey(methodId, baseRow.year),
    methodId,
    methodLabel: packageLabel,
    methodDisplayLabel: packageLabel,
    methodSortKey: `${baseRow.methodSortKey ?? baseRow.methodId}::pkg::${pkg.package_id}`,
    conversionCostPerUnit: applyCostDelta(baseRow, pkg.delta_output_cost_per_unit, artifactLabel),
    inputs: applyInputMultipliers(
      baseRow.inputs,
      pkg.affected_input_commodities,
      pkg.input_multipliers,
    ),
    directEmissions: applyEnergyEmissionMultiplier(baseRow.directEmissions, energyEmissionMultiplier),
    provenance: {
      kind: 'efficiency_package',
      familyId: pkg.family_id,
      baseMethodId: baseRow.provenance?.baseMethodId ?? baseRow.methodId,
      baseMethodLabel: baseRow.provenance?.baseMethodLabel ?? baseRow.methodDisplayLabel ?? baseRow.methodLabel,
      baseRowId: baseRow.provenance?.baseRowId ?? methodYearKey(baseRow.methodId, baseRow.year),
      autonomousTrackIds: [...(baseRow.provenance?.autonomousTrackIds ?? [])],
      packageId: pkg.package_id,
      packageClassification: pkg.classification,
      packageNonStackingGroup: pkg.non_stacking_group ?? null,
    },
    bounds: {
      minShare: null,
      maxShare: minNullable(baseRow.bounds.maxShare, pkg.max_share),
      maxActivity: baseRow.bounds.maxActivity,
    },
  };
}

function collectAutonomousTracksByMethodYear(
  tracks: AutonomousEfficiencyTrack[],
  efficiency: ResolvedConfigurationEfficiencyControls | undefined,
): Map<string, AutonomousEfficiencyTrack[]> {
  const byMethodYear = new Map<string, AutonomousEfficiencyTrack[]>();
  const activeTrackIds = new Set(efficiency?.activeTrackIds ?? []);

  for (const track of tracks) {
    if (!activeTrackIds.has(track.track_id)) {
      continue;
    }

    const effectiveMode =
      efficiency?.autonomousModesByRole[track.family_id]
      ?? efficiency?.autonomousMode
      ?? 'baseline';
    if (effectiveMode !== 'baseline') {
      continue;
    }

    if (!Array.isArray(track.applicable_method_ids)) {
      continue;
    }

    for (const methodId of track.applicable_method_ids) {
      const key = methodYearKey(methodId, track.year);
      const rows = byMethodYear.get(key) ?? [];
      rows.push(track);
      byMethodYear.set(key, rows);
    }
  }

  for (const rows of byMethodYear.values()) {
    rows.sort((left, right) => left.track_id.localeCompare(right.track_id));
  }

  return byMethodYear;
}

function collectPackagesByMethodYear(
  packages: EfficiencyPackage[],
  activePackageIds: Set<string>,
): Map<string, EfficiencyPackage[]> {
  const byMethodYear = new Map<string, EfficiencyPackage[]>();

  for (const pkg of packages) {
    if (!activePackageIds.has(pkg.package_id)) {
      continue;
    }

    if (!Array.isArray(pkg.applicable_method_ids)) {
      continue;
    }

    for (const methodId of pkg.applicable_method_ids) {
      const key = methodYearKey(methodId, pkg.year);
      const rows = byMethodYear.get(key) ?? [];
      rows.push(pkg);
      byMethodYear.set(key, rows);
    }
  }

  for (const rows of byMethodYear.values()) {
    rows.sort((left, right) => left.package_id.localeCompare(right.package_id));
  }

  return byMethodYear;
}

export function normalizeSolverRows(
  pkg: Pick<PackageData, 'resolvedMethodYears' | 'appConfig'>
    & Partial<Pick<PackageData, 'autonomousEfficiencyTracks' | 'efficiencyPackages'>>,
  efficiency?: ResolvedConfigurationEfficiencyControls,
): NormalizedSolverRow[] {
  const autonomousTracksByMethodYear = collectAutonomousTracksByMethodYear(
    pkg.autonomousEfficiencyTracks ?? [],
    efficiency,
  );
  const packagesByMethodYear = collectPackagesByMethodYear(
    pkg.efficiencyPackages ?? [],
    new Set(efficiency?.activePackageIds ?? []),
  );

  return pkg.resolvedMethodYears.flatMap((row) => {
    const baseRow = buildBaseNormalizedRow(row, pkg.appConfig);
    const methodYear = methodYearKey(row.method_id, row.year);
    const autonomousAdjustedRow = applyAutonomousTracksToRow(
      baseRow,
      autonomousTracksByMethodYear.get(methodYear) ?? [],
    );
    const packageRows = (packagesByMethodYear.get(methodYear) ?? [])
      .map((pkgRow) => buildPackageRow(autonomousAdjustedRow, pkgRow));

    return [autonomousAdjustedRow, ...packageRows];
  });
}

export function resolveConfigurationForSolve(
  configuration: ConfigurationDocument,
  appConfig: AppConfigRegistry,
  resolvedMethodYears?: Pick<ResolvedMethodYearRow, 'role_id' | 'output_id' | 'year' | 'method_id' | 'is_default_incumbent_2025'>[],
  efficiencyArtifacts?: Partial<Pick<PackageData, 'autonomousEfficiencyTracks' | 'efficiencyPackages'>>,
): ResolvedConfigurationForSolve {
  const resolvedConfiguration = resolveConfigurationDocument(configuration, appConfig);
  const outputControls = resolvedMethodYears
    ? resolveOutputControlsFromRoleControls(resolvedConfiguration, { resolvedMethodYears })
    : {};
  const years = [...resolvedConfiguration.years];
  const incumbentByOutput = collectIncumbentMethodIdsByOutput(resolvedMethodYears);
  const methodIdsByOutputYear = collectMethodIdsByOutputYear(resolvedMethodYears);
  const efficiency = resolveEfficiencyControlsForSolve(
    resolvedConfiguration,
    efficiencyArtifacts?.autonomousEfficiencyTracks ?? [],
    efficiencyArtifacts?.efficiencyPackages ?? [],
    resolvedMethodYears,
  );
  const controlsByOutput = Object.entries(appConfig.output_roles).reduce<
    Record<string, Record<string, ResolvedSolveControl>>
  >((resolved, [outputId, metadata]) => {
    const outputControl = outputControls[outputId];
    const shouldForceIncumbent = hasConfiguredActiveMethods(
      outputId,
      years,
      outputControl,
      metadata.default_control_mode,
      methodIdsByOutputYear,
    );
    resolved[outputId] = years.reduce<Record<string, ResolvedSolveControl>>((controlsByYear, year) => {
      const forced = year === BASE_YEAR && shouldForceIncumbent
        ? incumbentByOutput.get(outputId)
        : undefined;
      controlsByYear[yearKey(year)] = resolveControlForYear(
        outputControl,
        metadata.default_control_mode,
        year,
        forced,
      );
      return controlsByYear;
    }, {});
    return resolved;
  }, {});

  const serviceDemandByOutput = Object.entries(appConfig.output_roles).reduce<
    Record<string, Record<string, number>>
  >((resolved, [outputId, metadata]) => {
    if (!metadata.demand_required) {
      return resolved;
    }

    resolved[outputId] = years.reduce<Record<string, number>>((valuesByYear, year) => {
      valuesByYear[yearKey(year)] = resolveYearValue(
        resolvedConfiguration.service_demands[outputId],
        year,
      );
      return valuesByYear;
    }, {});
    return resolved;
  }, {});

  const externalCommodityDemandByCommodity = Object.entries(
    resolvedConfiguration.external_commodity_demands ?? {},
  ).reduce<Record<string, Record<string, number>>>((resolved, [commodityId, table]) => {
    resolved[commodityId] = years.reduce<Record<string, number>>((valuesByYear, year) => {
      valuesByYear[yearKey(year)] = resolveYearValue(table, year);
      return valuesByYear;
    }, {});
    return resolved;
  }, {});

  const commodityDrivers = appConfig.commodity_price_presets;

  const commodityIds = new Set([
    ...Object.keys(commodityDrivers),
    ...Object.keys(resolvedConfiguration.commodity_pricing.overrides),
  ]);

  const commodityPriceByCommodity = Array.from(commodityIds).reduce<
    Record<string, ResolvedCommodityPriceSeries>
  >((resolved, commodityId) => {
    const driver = commodityDrivers[commodityId];
    const level = resolvedConfiguration.commodity_pricing.selections_by_commodity?.[commodityId] ?? 'medium';
    const baseSeries = driver?.levels[level];

    resolved[commodityId] = resolveCommodityPriceSeries(
      baseSeries,
      resolvedConfiguration.commodity_pricing.overrides[commodityId],
      years,
    );
    return resolved;
  }, {});

  const carbonPriceByYear = years.reduce<Record<string, number>>((resolved, year) => {
    resolved[yearKey(year)] = resolveYearValue(resolvedConfiguration.carbon_price, year);
    return resolved;
  }, {});

  return {
    name: resolvedConfiguration.name,
    description: resolvedConfiguration.description ?? null,
    years,
    controlsByOutput,
    serviceDemandByOutput,
    externalCommodityDemandByCommodity,
    commodityPriceByCommodity,
    carbonPriceByYear,
    efficiency,
    options: {
      respectMaxShare: resolvedConfiguration.solver_options?.respect_max_share ?? true,
      respectMaxActivity: resolvedConfiguration.solver_options?.respect_max_activity ?? true,
      softConstraints: resolvedConfiguration.solver_options?.soft_constraints ?? false,
      shareSmoothing: {
        enabled: resolvedConfiguration.solver_options?.share_smoothing?.enabled ?? false,
        maxDeltaPp: resolvedConfiguration.solver_options?.share_smoothing?.max_delta_pp ?? null,
      },
    },
  };
}
