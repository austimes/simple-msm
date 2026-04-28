import type {
  AppConfigRegistry,
  AutonomousEfficiencyTrack,
  CommodityPriceSeries,
  EfficiencyPackage,
  PackageData,
  ConfigurationDocument,
  ConfigurationServiceControl,
  SectorState,
} from '../data/types.ts';
import { getCommodityMetadata, normalizeCommodityInput } from '../data/commodityMetadata.ts';
import { materializeEfficiencyConfiguration } from '../data/configurationDocumentLoader.ts';
import { resolveConfigurationDocument } from '../data/demandResolution.ts';
import { resolveActiveEfficiencyPackageIds } from '../data/efficiencyControlModel.ts';
import { derivePathwayStateIds } from '../data/pathwaySemantics.ts';
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

function stateYearKey(stateId: string, year: number): string {
  return `${stateId}::${year}`;
}

function resolveYearValue(table: Record<string, number> | undefined, year: number): number {
  const value = table?.[yearKey(year)];
  return typeof value === 'number' ? value : 0;
}

const BASE_YEAR = 2025;
const EFFICIENCY_PACKAGE_STATE_PREFIX = 'effpkg';

function resolveStateDisplayLabel(row: SectorState): string {
  const preferredLabel = (row.state_label_standardized ?? '').trim()
    || (row.state_option_label ?? '').trim()
    || (row.state_label ?? '').trim();

  return preferredLabel || row.state_id;
}

function collectIncumbentStateIdsByOutput(
  sectorStates: Pick<SectorState, 'service_or_output_name' | 'year' | 'state_id' | 'is_default_incumbent_2025'>[] | undefined,
): Map<string, string[]> {
  const byOutput = new Map<string, Set<string>>();

  for (const row of sectorStates ?? []) {
    if (row.year !== BASE_YEAR || !row.is_default_incumbent_2025) continue;

    let ids = byOutput.get(row.service_or_output_name);
    if (!ids) {
      ids = new Set<string>();
      byOutput.set(row.service_or_output_name, ids);
    }
    ids.add(row.state_id);
  }

  return new Map(
    Array.from(byOutput.entries()).map(([outputId, ids]) => [outputId, Array.from(ids)]),
  );
}

function collectStateIdsByOutputYear(
  sectorStates: Pick<SectorState, 'service_or_output_name' | 'year' | 'state_id'>[] | undefined,
): Map<string, Map<number, string[]>> {
  const byOutputYear = new Map<string, Map<number, Set<string>>>();

  for (const row of sectorStates ?? []) {
    let byYear = byOutputYear.get(row.service_or_output_name);
    if (!byYear) {
      byYear = new Map();
      byOutputYear.set(row.service_or_output_name, byYear);
    }

    let ids = byYear.get(row.year);
    if (!ids) {
      ids = new Set();
      byYear.set(row.year, ids);
    }

    ids.add(row.state_id);
  }

  return new Map(
    Array.from(byOutputYear.entries()).map(([outputId, byYear]) => [
      outputId,
      new Map(Array.from(byYear.entries()).map(([year, ids]) => [year, Array.from(ids)])),
    ]),
  );
}

function hasConfiguredActiveStates(
  outputId: string,
  years: readonly number[],
  control: ConfigurationServiceControl | undefined,
  defaultMode: AppConfigRegistry['output_roles'][string]['default_control_mode'],
  stateIdsByOutputYear: Map<string, Map<number, string[]>>,
): boolean {
  const byYear = stateIdsByOutputYear.get(outputId);

  for (const year of years) {
    const availableStateIds = byYear?.get(year) ?? [];
    const unforcedControl = resolveControlForYear(control, defaultMode, year);
    const derived = derivePathwayStateIds(availableStateIds, unforcedControl);

    if (derived.activeStateIds.length > 0) {
      return true;
    }
  }

  return false;
}

function resolveControlForYear(
  control: ConfigurationServiceControl | undefined,
  defaultMode: AppConfigRegistry['output_roles'][string]['default_control_mode'],
  year: number,
  forcedActiveStateIds?: string[],
): ResolvedSolveControl {
  const overrideKey = yearKey(year) as keyof NonNullable<ConfigurationServiceControl['year_overrides']>;
  const override = control?.year_overrides?.[overrideKey] ?? null;

  return {
    mode: override?.mode ?? control?.mode ?? defaultMode,
    activeStateIds: forcedActiveStateIds
      ?? override?.active_state_ids
      ?? control?.active_state_ids
      ?? null,
    targetValue: override?.target_value ?? control?.target_value ?? null,
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
): ResolvedConfigurationEfficiencyControls {
  const materializedConfiguration = materializeEfficiencyConfiguration(
    configuration,
    autonomousEfficiencyTracks,
    efficiencyPackages,
  );
  const controls = materializedConfiguration.efficiency_controls;
  const autonomousModesByOutput = controls?.autonomous_modes_by_output ?? {};
  const activeTrackIds = Array.from(
    new Set(
      autonomousEfficiencyTracks
        .filter((track) => {
          const effectiveMode =
            autonomousModesByOutput[track.family_id]
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
    autonomousModesByOutput,
    activeTrackIds,
    packageMode: controls?.package_mode ?? 'off',
    configuredPackageIds,
    activePackageIds: resolveActiveEfficiencyPackageIds(controls, efficiencyPackages),
  };
}

function buildNormalizedInputs(row: SectorState): NormalizedSolverRow['inputs'] {
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

function buildBaseRowProvenance(row: SectorState): NormalizedSolverRowProvenance {
  return {
    kind: 'base_state',
    familyId: row.family_id,
    baseStateId: row.state_id,
    baseStateLabel: resolveStateDisplayLabel(row),
    baseRowId: stateYearKey(row.state_id, row.year),
    autonomousTrackIds: [],
  };
}

function buildBaseNormalizedRow(
  row: SectorState,
  appConfig: AppConfigRegistry,
): NormalizedSolverRow {
  const outputMetadata = appConfig.output_roles[row.service_or_output_name];

  if (!outputMetadata) {
    throw new Error(
      `Missing output role metadata for ${JSON.stringify(row.service_or_output_name)}`,
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

  return {
    rowId: stateYearKey(row.state_id, row.year),
    roleId: row.role_id,
    representationId: row.representation_id,
    methodId: row.method_id,
    balanceType: row.balance_type,
    outputId: row.service_or_output_name,
    outputRole: outputMetadata.output_role,
    outputLabel: outputMetadata.display_label,
    year: row.year,
    stateId: row.state_id,
    stateLabel: row.state_label,
    stateDisplayLabel: resolveStateDisplayLabel(row),
    stateSortKey: (row.state_sort_key ?? '').trim(),
    stateOptionRank: row.state_option_rank,
    sector: row.sector,
    subsector: row.subsector,
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

function buildEfficiencyPackageStateId(baseStateId: string, packageId: string): string {
  return `${EFFICIENCY_PACKAGE_STATE_PREFIX}:${baseStateId}::${packageId}`;
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
  const stateId = buildEfficiencyPackageStateId(baseRow.provenance?.baseStateId ?? baseRow.stateId, pkg.package_id);
  const packageLabel = `${baseRow.stateDisplayLabel ?? baseRow.stateLabel} + ${pkg.package_label}`;
  const energyEmissionMultiplier = resolveEnergyEmissionMultiplier(
    baseRow.inputs,
    pkg.affected_input_commodities,
    pkg.input_multipliers,
  );

  return {
    ...baseRow,
    rowId: stateYearKey(stateId, baseRow.year),
    stateId,
    stateLabel: packageLabel,
    stateDisplayLabel: packageLabel,
    stateSortKey: `${baseRow.stateSortKey ?? baseRow.stateId}::pkg::${pkg.package_id}`,
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
      baseStateId: baseRow.provenance?.baseStateId ?? baseRow.stateId,
      baseStateLabel: baseRow.provenance?.baseStateLabel ?? baseRow.stateDisplayLabel ?? baseRow.stateLabel,
      baseRowId: baseRow.provenance?.baseRowId ?? stateYearKey(baseRow.stateId, baseRow.year),
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

function collectAutonomousTracksByStateYear(
  tracks: AutonomousEfficiencyTrack[],
  efficiency: ResolvedConfigurationEfficiencyControls | undefined,
): Map<string, AutonomousEfficiencyTrack[]> {
  const byStateYear = new Map<string, AutonomousEfficiencyTrack[]>();
  const activeTrackIds = new Set(efficiency?.activeTrackIds ?? []);

  for (const track of tracks) {
    if (!activeTrackIds.has(track.track_id)) {
      continue;
    }

    const effectiveMode =
      efficiency?.autonomousModesByOutput[track.family_id]
      ?? efficiency?.autonomousMode
      ?? 'baseline';
    if (effectiveMode !== 'baseline') {
      continue;
    }

    if (!Array.isArray(track.applicable_state_ids)) {
      continue;
    }

    for (const stateId of track.applicable_state_ids) {
      const key = stateYearKey(stateId, track.year);
      const rows = byStateYear.get(key) ?? [];
      rows.push(track);
      byStateYear.set(key, rows);
    }
  }

  for (const rows of byStateYear.values()) {
    rows.sort((left, right) => left.track_id.localeCompare(right.track_id));
  }

  return byStateYear;
}

function collectPackagesByStateYear(
  packages: EfficiencyPackage[],
  activePackageIds: Set<string>,
): Map<string, EfficiencyPackage[]> {
  const byStateYear = new Map<string, EfficiencyPackage[]>();

  for (const pkg of packages) {
    if (!activePackageIds.has(pkg.package_id)) {
      continue;
    }

    if (!Array.isArray(pkg.applicable_state_ids)) {
      continue;
    }

    for (const stateId of pkg.applicable_state_ids) {
      const key = stateYearKey(stateId, pkg.year);
      const rows = byStateYear.get(key) ?? [];
      rows.push(pkg);
      byStateYear.set(key, rows);
    }
  }

  for (const rows of byStateYear.values()) {
    rows.sort((left, right) => left.package_id.localeCompare(right.package_id));
  }

  return byStateYear;
}

export function normalizeSolverRows(
  pkg: Pick<PackageData, 'sectorStates' | 'appConfig'>
    & Partial<Pick<PackageData, 'autonomousEfficiencyTracks' | 'efficiencyPackages'>>,
  efficiency?: ResolvedConfigurationEfficiencyControls,
): NormalizedSolverRow[] {
  const autonomousTracksByStateYear = collectAutonomousTracksByStateYear(
    pkg.autonomousEfficiencyTracks ?? [],
    efficiency,
  );
  const packagesByStateYear = collectPackagesByStateYear(
    pkg.efficiencyPackages ?? [],
    new Set(efficiency?.activePackageIds ?? []),
  );

  return pkg.sectorStates.flatMap((row) => {
    const baseRow = buildBaseNormalizedRow(row, pkg.appConfig);
    const stateYear = stateYearKey(row.state_id, row.year);
    const autonomousAdjustedRow = applyAutonomousTracksToRow(
      baseRow,
      autonomousTracksByStateYear.get(stateYear) ?? [],
    );
    const packageRows = (packagesByStateYear.get(stateYear) ?? [])
      .map((pkgRow) => buildPackageRow(autonomousAdjustedRow, pkgRow));

    return [autonomousAdjustedRow, ...packageRows];
  });
}

export function resolveConfigurationForSolve(
  configuration: ConfigurationDocument,
  appConfig: AppConfigRegistry,
  sectorStates?: Pick<SectorState, 'service_or_output_name' | 'year' | 'state_id' | 'is_default_incumbent_2025'>[],
  efficiencyArtifacts?: Partial<Pick<PackageData, 'autonomousEfficiencyTracks' | 'efficiencyPackages'>>,
): ResolvedConfigurationForSolve {
  const resolvedConfiguration = resolveConfigurationDocument(configuration, appConfig);
  const years = [...resolvedConfiguration.years];
  const incumbentByOutput = collectIncumbentStateIdsByOutput(sectorStates);
  const stateIdsByOutputYear = collectStateIdsByOutputYear(sectorStates);
  const efficiency = resolveEfficiencyControlsForSolve(
    resolvedConfiguration,
    efficiencyArtifacts?.autonomousEfficiencyTracks ?? [],
    efficiencyArtifacts?.efficiencyPackages ?? [],
  );
  const controlsByOutput = Object.entries(appConfig.output_roles).reduce<
    Record<string, Record<string, ResolvedSolveControl>>
  >((resolved, [outputId, metadata]) => {
    const shouldForceIncumbent = hasConfiguredActiveStates(
      outputId,
      years,
      resolvedConfiguration.service_controls[outputId],
      metadata.default_control_mode,
      stateIdsByOutputYear,
    );
    resolved[outputId] = years.reduce<Record<string, ResolvedSolveControl>>((controlsByYear, year) => {
      const forced = year === BASE_YEAR && shouldForceIncumbent
        ? incumbentByOutput.get(outputId)
        : undefined;
      controlsByYear[yearKey(year)] = resolveControlForYear(
        resolvedConfiguration.service_controls[outputId],
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
