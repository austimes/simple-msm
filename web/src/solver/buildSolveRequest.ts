import type {
  AppConfigRegistry,
  CommodityPriceSeries,
  PackageData,
  ScenarioDocument,
  ScenarioServiceControl,
} from '../data/types';
import { resolveScenarioDocument } from '../data/demandResolution.ts';
import {
  SOLVER_CONTRACT_VERSION,
  type NormalizedSolverRow,
  type ResolvedCommodityPriceSeries,
  type ResolvedScenarioForSolve,
  type ResolvedSolveControl,
  type SolveRequest,
} from './contract';

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `solve-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function yearKey(year: number): string {
  return String(year);
}

function resolveYearValue(table: Record<string, number> | undefined, year: number): number {
  const value = table?.[yearKey(year)];
  return typeof value === 'number' ? value : 0;
}

function resolveControlForYear(
  control: ScenarioServiceControl | undefined,
  defaultMode: AppConfigRegistry['output_roles'][string]['default_control_mode'],
  year: number,
): ResolvedSolveControl {
  const overrideKey = yearKey(year) as keyof NonNullable<ScenarioServiceControl['year_overrides']>;
  const override = control?.year_overrides?.[overrideKey] ?? null;

  return {
    mode: override?.mode ?? control?.mode ?? defaultMode,
    stateId: override?.state_id ?? control?.state_id ?? null,
    fixedShares: override?.fixed_shares ?? control?.fixed_shares ?? null,
    disabledStateIds: control?.disabled_state_ids ?? [],
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

export function normalizeSolverRows(
  pkg: Pick<PackageData, 'sectorStates' | 'appConfig'>,
): NormalizedSolverRow[] {
  return pkg.sectorStates.map((row) => {
    const outputMetadata = pkg.appConfig.output_roles[row.service_or_output_name];

    if (!outputMetadata) {
      throw new Error(
        `Missing output role metadata for ${JSON.stringify(row.service_or_output_name)}`,
      );
    }

    return {
      rowId: `${row.state_id}::${row.year}`,
      outputId: row.service_or_output_name,
      outputRole: outputMetadata.output_role,
      outputLabel: outputMetadata.display_label,
      year: row.year,
      stateId: row.state_id,
      stateLabel: row.state_label,
      sector: row.sector,
      subsector: row.subsector,
      region: row.region,
      outputUnit: row.output_unit,
      conversionCostPerUnit: row.output_cost_per_unit,
      inputs: row.input_commodities.map((commodityId, index) => ({
        commodityId,
        coefficient: row.input_coefficients[index] ?? 0,
        unit: row.input_units[index] ?? row.output_unit,
      })),
      directEmissions: [
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
      ],
      bounds: {
        minShare: row.min_share,
        maxShare: row.max_share,
        maxActivity: row.max_activity,
      },
    };
  });
}

export function resolveScenarioForSolve(
  scenario: ScenarioDocument,
  appConfig: AppConfigRegistry,
): ResolvedScenarioForSolve {
  const resolvedScenario = resolveScenarioDocument(scenario, appConfig);
  const years = [...resolvedScenario.years];
  const controlsByOutput = Object.entries(appConfig.output_roles).reduce<
    Record<string, Record<string, ResolvedSolveControl>>
  >((resolved, [outputId, metadata]) => {
    resolved[outputId] = years.reduce<Record<string, ResolvedSolveControl>>((controlsByYear, year) => {
      controlsByYear[yearKey(year)] = resolveControlForYear(
        resolvedScenario.service_controls[outputId],
        metadata.default_control_mode,
        year,
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
      valuesByYear[yearKey(year)] = resolveYearValue(resolvedScenario.service_demands[outputId], year);
      return valuesByYear;
    }, {});
    return resolved;
  }, {});

  const externalCommodityDemandByCommodity = Object.entries(
    resolvedScenario.external_commodity_demands ?? {},
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
    ...Object.keys(resolvedScenario.commodity_pricing.overrides),
  ]);

  const commodityPriceByCommodity = Array.from(commodityIds).reduce<
    Record<string, ResolvedCommodityPriceSeries>
  >((resolved, commodityId) => {
    const driver = commodityDrivers[commodityId];
    const level = resolvedScenario.commodity_pricing.selections_by_commodity?.[commodityId] ?? 'medium';
    const baseSeries = driver?.levels[level];

    resolved[commodityId] = resolveCommodityPriceSeries(
      baseSeries,
      resolvedScenario.commodity_pricing.overrides[commodityId],
      years,
    );
    return resolved;
  }, {});

  const carbonPriceByYear = years.reduce<Record<string, number>>((resolved, year) => {
    resolved[yearKey(year)] = resolveYearValue(resolvedScenario.carbon_price, year);
    return resolved;
  }, {});

  return {
    name: resolvedScenario.name,
    description: resolvedScenario.description ?? null,
    years,
    controlsByOutput,
    serviceDemandByOutput,
    externalCommodityDemandByCommodity,
    commodityPriceByCommodity,
    carbonPriceByYear,
    options: {
      respectMaxShare: resolvedScenario.solver_options?.respect_max_share ?? true,
      respectMaxActivity: resolvedScenario.solver_options?.respect_max_activity ?? true,
      softConstraints: resolvedScenario.solver_options?.soft_constraints ?? false,
      allowRemovalsCredit: resolvedScenario.solver_options?.allow_removals_credit ?? false,
      shareSmoothing: {
        enabled: resolvedScenario.solver_options?.share_smoothing?.enabled ?? false,
        maxDeltaPp: resolvedScenario.solver_options?.share_smoothing?.max_delta_pp ?? null,
      },
    },
  };
}

export interface BuildSolveRequestOptions {
  includedOutputIds?: string[];
}

function rowMayBeActive(
  row: NormalizedSolverRow,
  control: ResolvedSolveControl | undefined,
): boolean {
  if (!control) {
    return true;
  }

  if (control.mode === 'externalized') {
    return false;
  }

  // disabled_state_ids is the single source of truth for whether a state is off
  if (control.disabledStateIds.includes(row.stateId)) {
    return false;
  }

  if (control.mode === 'pinned_single') {
    return row.stateId === control.stateId;
  }

  if (control.mode === 'fixed_shares') {
    const share = control.fixedShares?.[row.stateId] ?? 0;
    return share > 0;
  }

  return true;
}

function expandIncludedOutputsForDependencies(
  rows: NormalizedSolverRow[],
  scenario: ResolvedScenarioForSolve,
  appConfig: AppConfigRegistry,
  seedOutputIds: Set<string>,
): Set<string> {
  const included = new Set(seedOutputIds);
  let changed = true;

  while (changed) {
    changed = false;

    for (const row of rows) {
      if (!included.has(row.outputId)) {
        continue;
      }

      for (const year of scenario.years) {
        if (row.year !== year) {
          continue;
        }

        const control = scenario.controlsByOutput[row.outputId]?.[yearKey(year)];
        if (!rowMayBeActive(row, control)) {
          continue;
        }

        for (const input of row.inputs) {
          const inputMetadata = appConfig.output_roles[input.commodityId];
          if (!inputMetadata || inputMetadata.output_role !== 'endogenous_supply_commodity') {
            continue;
          }

          if (input.coefficient !== 0 && !included.has(input.commodityId)) {
            included.add(input.commodityId);
            changed = true;
          }
        }
      }
    }
  }

  return included;
}

function filterSolveRequestForOutputs(
  rows: NormalizedSolverRow[],
  scenario: ResolvedScenarioForSolve,
  includedOutputIds: Set<string>,
  seedOutputIds: Set<string>,
): { rows: NormalizedSolverRow[]; scenario: ResolvedScenarioForSolve } {
  const filteredRows = rows.filter((row) => includedOutputIds.has(row.outputId));

  const filteredControlsByOutput: Record<string, Record<string, ResolvedSolveControl>> = {};
  for (const outputId of includedOutputIds) {
    if (scenario.controlsByOutput[outputId]) {
      filteredControlsByOutput[outputId] = scenario.controlsByOutput[outputId];
    }
  }

  const filteredServiceDemandByOutput: Record<string, Record<string, number>> = {};
  for (const outputId of includedOutputIds) {
    if (scenario.serviceDemandByOutput[outputId]) {
      filteredServiceDemandByOutput[outputId] = scenario.serviceDemandByOutput[outputId];
    }
  }

  const filteredExternalCommodityDemandByCommodity: Record<string, Record<string, number>> = {};
  for (const outputId of seedOutputIds) {
    if (scenario.externalCommodityDemandByCommodity[outputId]) {
      filteredExternalCommodityDemandByCommodity[outputId] = scenario.externalCommodityDemandByCommodity[outputId];
    }
  }

  return {
    rows: filteredRows,
    scenario: {
      ...scenario,
      controlsByOutput: filteredControlsByOutput,
      serviceDemandByOutput: filteredServiceDemandByOutput,
      externalCommodityDemandByCommodity: filteredExternalCommodityDemandByCommodity,
    },
  };
}

export function collectOutputIdsForSelection(
  rows: NormalizedSolverRow[],
  selection: { sectors?: string[]; subsectors?: string[]; outputIds?: string[] },
): string[] {
  const outputIds = new Set<string>();

  if (selection.outputIds) {
    for (const outputId of selection.outputIds) {
      outputIds.add(outputId);
    }
  }

  if (selection.sectors) {
    const sectors = new Set(selection.sectors);
    for (const row of rows) {
      if (sectors.has(row.sector)) {
        outputIds.add(row.outputId);
      }
    }
  }

  if (selection.subsectors) {
    const subsectors = new Set(selection.subsectors);
    for (const row of rows) {
      if (subsectors.has(row.subsector)) {
        outputIds.add(row.outputId);
      }
    }
  }

  return Array.from(outputIds);
}

export function buildSolveRequest(
  pkg: Pick<PackageData, 'sectorStates' | 'appConfig' | 'defaultScenario'>,
  scenario = pkg.defaultScenario,
  options: BuildSolveRequestOptions = {},
): SolveRequest {
  const allRows = normalizeSolverRows(pkg);
  const resolvedScenario = resolveScenarioForSolve(scenario, pkg.appConfig);

  if (!options.includedOutputIds || options.includedOutputIds.length === 0) {
    return {
      contractVersion: SOLVER_CONTRACT_VERSION,
      requestId: createRequestId(),
      rows: allRows,
      scenario: resolvedScenario,
    };
  }

  const seedOutputIds = new Set(options.includedOutputIds);
  const expandedOutputIds = expandIncludedOutputsForDependencies(
    allRows,
    resolvedScenario,
    pkg.appConfig,
    seedOutputIds,
  );
  const filtered = filterSolveRequestForOutputs(allRows, resolvedScenario, expandedOutputIds, seedOutputIds);

  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: createRequestId(),
    rows: filtered.rows,
    scenario: filtered.scenario,
  };
}
