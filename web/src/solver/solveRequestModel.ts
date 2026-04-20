import type {
  AppConfigRegistry,
  CommodityPriceSeries,
  PackageData,
  ConfigurationDocument,
  ConfigurationServiceControl,
  SectorState,
} from '../data/types.ts';
import { normalizeCommodityInput } from '../data/commodityMetadata.ts';
import { resolveConfigurationDocument } from '../data/demandResolution.ts';
import { derivePathwayStateIds } from '../data/pathwaySemantics.ts';
import type {
  NormalizedSolverRow,
  ResolvedCommodityPriceSeries,
  ResolvedConfigurationForSolve,
  ResolvedSolveControl,
} from './contract.ts';

export function yearKey(year: number): string {
  return String(year);
}

function resolveYearValue(table: Record<string, number> | undefined, year: number): number {
  const value = table?.[yearKey(year)];
  return typeof value === 'number' ? value : 0;
}

const BASE_YEAR = 2025;

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

    const inputs = row.input_commodities.map((commodityId, index) => {
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

    return {
      rowId: `${row.state_id}::${row.year}`,
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
      inputs,
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

export function resolveConfigurationForSolve(
  configuration: ConfigurationDocument,
  appConfig: AppConfigRegistry,
  sectorStates?: Pick<SectorState, 'service_or_output_name' | 'year' | 'state_id' | 'is_default_incumbent_2025'>[],
): ResolvedConfigurationForSolve {
  const resolvedConfiguration = resolveConfigurationDocument(configuration, appConfig);
  const years = [...resolvedConfiguration.years];
  const incumbentByOutput = collectIncumbentStateIdsByOutput(sectorStates);
  const stateIdsByOutputYear = collectStateIdsByOutputYear(sectorStates);
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
