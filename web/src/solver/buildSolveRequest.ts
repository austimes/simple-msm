import type {
  AppConfigRegistry,
  CommodityPriceSeries,
  PackageData,
  ScenarioDocument,
  ScenarioServiceControl,
} from '../data/types';
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
  const years = [...scenario.years];
  const controlsByOutput = Object.entries(appConfig.output_roles).reduce<
    Record<string, Record<string, ResolvedSolveControl>>
  >((resolved, [outputId, metadata]) => {
    resolved[outputId] = years.reduce<Record<string, ResolvedSolveControl>>((controlsByYear, year) => {
      controlsByYear[yearKey(year)] = resolveControlForYear(
        scenario.service_controls[outputId],
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
      valuesByYear[yearKey(year)] = resolveYearValue(scenario.service_demands[outputId], year);
      return valuesByYear;
    }, {});
    return resolved;
  }, {});

  const externalCommodityDemandByCommodity = Object.entries(
    scenario.external_commodity_demands ?? {},
  ).reduce<Record<string, Record<string, number>>>((resolved, [commodityId, table]) => {
    resolved[commodityId] = years.reduce<Record<string, number>>((valuesByYear, year) => {
      valuesByYear[yearKey(year)] = resolveYearValue(table, year);
      return valuesByYear;
    }, {});
    return resolved;
  }, {});

  const pricePreset = appConfig.commodity_price_presets[scenario.commodity_pricing.preset_id];

  if (!pricePreset) {
    throw new Error(
      `Unknown commodity price preset ${JSON.stringify(scenario.commodity_pricing.preset_id)}`,
    );
  }

  const commodityIds = new Set([
    ...Object.keys(pricePreset.prices_by_commodity),
    ...Object.keys(scenario.commodity_pricing.overrides),
  ]);

  const commodityPriceByCommodity = Array.from(commodityIds).reduce<
    Record<string, ResolvedCommodityPriceSeries>
  >((resolved, commodityId) => {
    resolved[commodityId] = resolveCommodityPriceSeries(
      pricePreset.prices_by_commodity[commodityId],
      scenario.commodity_pricing.overrides[commodityId],
      years,
    );
    return resolved;
  }, {});

  const carbonPriceByYear = years.reduce<Record<string, number>>((resolved, year) => {
    resolved[yearKey(year)] = resolveYearValue(scenario.carbon_price, year);
    return resolved;
  }, {});

  return {
    name: scenario.name,
    description: scenario.description ?? null,
    years,
    controlsByOutput,
    serviceDemandByOutput,
    externalCommodityDemandByCommodity,
    commodityPriceByCommodity,
    carbonPriceByYear,
    options: {
      respectMaxShare: scenario.solver_options?.respect_max_share ?? true,
      respectMaxActivity: scenario.solver_options?.respect_max_activity ?? true,
      softConstraints: scenario.solver_options?.soft_constraints ?? false,
      allowRemovalsCredit: scenario.solver_options?.allow_removals_credit ?? false,
      shareSmoothing: {
        enabled: scenario.solver_options?.share_smoothing?.enabled ?? false,
        maxDeltaPp: scenario.solver_options?.share_smoothing?.max_delta_pp ?? null,
      },
    },
  };
}

export function buildSolveRequest(
  pkg: Pick<PackageData, 'sectorStates' | 'appConfig' | 'defaultScenario'>,
  scenario = pkg.defaultScenario,
): SolveRequest {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: createRequestId(),
    rows: normalizeSolverRows(pkg),
    scenario: resolveScenarioForSolve(scenario, pkg.appConfig),
  };
}
