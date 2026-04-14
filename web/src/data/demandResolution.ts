import type {
  AppConfigRegistry,
  BaselineActivityAnchor,
  ConfigurationDemandGeneration,
  ConfigurationDocument,
  ConfigurationYearKey,
  ConfigurationYearValueTable,
  DemandGrowthPreset,
} from './types.ts';

function yearKey(year: number): ConfigurationYearKey {
  return String(year) as ConfigurationYearKey;
}

function countDecimalPlaces(value: number): number {
  const normalized = value.toString().toLowerCase();

  if (!normalized.includes('.') && !normalized.includes('e')) {
    return 0;
  }

  const [coefficient, exponentText] = normalized.split('e');
  const fractionLength = coefficient.split('.')[1]?.length ?? 0;
  const exponent = Number(exponentText ?? 0);

  return Math.max(fractionLength - exponent, 0);
}

function roundToPlaces(value: number, decimalPlaces: number): number {
  if (decimalPlaces <= 0) {
    return Math.round(value);
  }

  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function normalizeValueTable(
  table: ConfigurationYearValueTable | undefined,
  years: readonly number[],
): Record<string, number> {
  return years.reduce<Record<string, number>>((resolved, year) => {
    const value = table?.[yearKey(year)];
    resolved[yearKey(year)] = typeof value === 'number' ? value : 0;
    return resolved;
  }, {});
}

function getBaselineAnchor(
  appConfig: AppConfigRegistry,
  id: string,
  anchorKind: BaselineActivityAnchor['anchor_kind'],
): BaselineActivityAnchor | null {
  const anchor = appConfig.baseline_activity_anchors[id];
  if (!anchor || anchor.anchor_kind !== anchorKind) {
    return null;
  }

  return anchor;
}

function resolveAnchorValue(
  explicitAnchor: number | undefined,
  baselineAnchor: BaselineActivityAnchor | null,
  explicitTable: ConfigurationYearValueTable | undefined,
  anchorYear: number,
  itemKind: string,
  itemId: string,
): number {
  if (typeof explicitAnchor === 'number') {
    return explicitAnchor;
  }

  const explicitTableAnchor = explicitTable?.[yearKey(anchorYear)];
  if (typeof explicitTableAnchor === 'number') {
    return explicitTableAnchor;
  }

  if (baselineAnchor) {
    return baselineAnchor.value;
  }

  throw new Error(`Missing ${itemKind} anchor for ${JSON.stringify(itemId)}`);
}

function resolveGrowthRate(
  id: string,
  presetRates: Record<string, number>,
  overrideRates: Record<string, number> | null | undefined,
): number {
  const overrideRate = overrideRates?.[id];
  if (typeof overrideRate === 'number') {
    return overrideRate;
  }

  const presetRate = presetRates[id];
  return typeof presetRate === 'number' ? presetRate : 0;
}

function generateValueTable(
  anchor: number,
  annualGrowthRatePctPerYear: number,
  years: readonly number[],
  anchorYear: number,
  yearOverrides: ConfigurationDemandGeneration['year_overrides'],
  id: string,
): Record<string, number> {
  const decimalPlaces = countDecimalPlaces(anchor);
  const growthFactor = 1 + annualGrowthRatePctPerYear / 100;

  return years.reduce<Record<string, number>>((resolved, year) => {
    const key = yearKey(year);
    const overrideValue = yearOverrides?.[key]?.[id];

    if (typeof overrideValue === 'number') {
      resolved[key] = overrideValue;
      return resolved;
    }

    const elapsedYears = year - anchorYear;
    const value = anchor * growthFactor ** elapsedYears;
    resolved[key] = roundToPlaces(value, decimalPlaces);
    return resolved;
  }, {});
}

function generateValueTableFromMultipliers(
  anchor: number,
  multipliersByYear: Record<string, number>,
  years: readonly number[],
  yearOverrides: ConfigurationDemandGeneration['year_overrides'],
  id: string,
): Record<string, number> {
  const decimalPlaces = countDecimalPlaces(anchor);

  return years.reduce<Record<string, number>>((resolved, year) => {
    const key = yearKey(year);
    const overrideValue = yearOverrides?.[key]?.[id];

    if (typeof overrideValue === 'number') {
      resolved[key] = overrideValue;
      return resolved;
    }

    const multiplier = typeof multipliersByYear[key] === 'number'
      ? multipliersByYear[key]
      : 0;
    resolved[key] = roundToPlaces(anchor * multiplier, decimalPlaces);
    return resolved;
  }, {});
}

function assertCompatibleResolvedTables(
  rawTables: Record<string, ConfigurationYearValueTable> | undefined,
  resolvedTables: Record<string, Record<string, number>>,
  label: string,
): void {
  for (const [id, table] of Object.entries(rawTables ?? {})) {
    // Skip IDs that demand generation does not resolve (e.g. optional_activity
    // outputs that appear in legacy service_demands but are not demand_required).
    if (!(id in resolvedTables)) {
      continue;
    }

    for (const [year, value] of Object.entries(table)) {
      if (typeof value !== 'number') {
        continue;
      }

      const resolvedValue = resolvedTables[id]?.[year];
      if (resolvedValue !== value) {
        throw new Error(
          `${label} ${id}.${year} is ${value}, but demand generation resolves to ${resolvedValue ?? 0}`,
        );
      }
    }
  }
}

function resolveAnchorPreset(
  demandGeneration: ConfigurationDemandGeneration,
  appConfig: AppConfigRegistry,
): DemandGrowthPreset {
  const presetId = demandGeneration.preset_id;
  if (!presetId) {
    throw new Error('Anchor-based demand generation requires a preset_id');
  }

  const preset = appConfig.demand_growth_presets[presetId];
  if (!preset) {
    throw new Error(`Unknown demand growth preset ${JSON.stringify(presetId)}`);
  }

  return preset;
}

function resolveServiceDemandTables(
  configuration: ConfigurationDocument,
  appConfig: AppConfigRegistry,
  preset: DemandGrowthPreset,
): {
  anchors: Record<string, number>;
  growthRates: Record<string, number>;
  tables: Record<string, Record<string, number>>;
} {
  const serviceIds = Object.entries(appConfig.output_roles)
    .filter(([, metadata]) => metadata.demand_required)
    .map(([outputId]) => outputId);

  const anchors = serviceIds.reduce<Record<string, number>>((resolved, outputId) => {
    resolved[outputId] = resolveAnchorValue(
      configuration.demand_generation.service_anchors[outputId],
      getBaselineAnchor(appConfig, outputId, 'service_demand'),
      configuration.service_demands[outputId],
      configuration.demand_generation.anchor_year,
      'service demand',
      outputId,
    );
    return resolved;
  }, {});

  const growthRates = serviceIds.reduce<Record<string, number>>((resolved, outputId) => {
    resolved[outputId] = resolveGrowthRate(
      outputId,
      preset.annual_growth_rates_pct_per_year,
      configuration.demand_generation.service_growth_rates_pct_per_year,
    );
    return resolved;
  }, {});

  const tables = serviceIds.reduce<Record<string, Record<string, number>>>((resolved, outputId) => {
    const overrideRate = configuration.demand_generation.service_growth_rates_pct_per_year?.[outputId];
    const presetMultipliers = preset.milestone_multipliers_by_output?.[outputId];
    resolved[outputId] = typeof overrideRate === 'number' || !presetMultipliers
      ? generateValueTable(
          anchors[outputId],
          growthRates[outputId],
          configuration.years,
          configuration.demand_generation.anchor_year,
          configuration.demand_generation.year_overrides,
          outputId,
        )
      : generateValueTableFromMultipliers(
          anchors[outputId],
          presetMultipliers,
          configuration.years,
          configuration.demand_generation.year_overrides,
          outputId,
        );
    return resolved;
  }, {});

  return { anchors, growthRates, tables };
}

function resolveExternalCommodityDemandTables(
  configuration: ConfigurationDocument,
  appConfig: AppConfigRegistry,
  preset: DemandGrowthPreset,
): {
  anchors: Record<string, number>;
  growthRates: Record<string, number>;
  tables: Record<string, Record<string, number>>;
} {
  const serviceIds = new Set(
    Object.entries(appConfig.output_roles)
      .filter(([, metadata]) => metadata.demand_required)
      .map(([outputId]) => outputId),
  );
  const candidateIds = new Set<string>([
    ...Object.entries(appConfig.baseline_activity_anchors)
      .filter(([, anchor]) => anchor.anchor_kind === 'external_commodity_demand')
      .map(([commodityId]) => commodityId),
    ...Object.keys(configuration.external_commodity_demands ?? {}),
    ...Object.keys(configuration.demand_generation.external_commodity_anchors ?? {}),
    ...Object.keys(configuration.demand_generation.external_commodity_growth_rates_pct_per_year ?? {}),
    ...Object.keys(preset.external_commodity_growth_rates_pct_per_year),
  ]);

  const externalCommodityIds = Array.from(candidateIds).filter((commodityId) => !serviceIds.has(commodityId));
  const anchors = externalCommodityIds.reduce<Record<string, number>>((resolved, commodityId) => {
    resolved[commodityId] = resolveAnchorValue(
      configuration.demand_generation.external_commodity_anchors?.[commodityId],
      getBaselineAnchor(appConfig, commodityId, 'external_commodity_demand'),
      configuration.external_commodity_demands?.[commodityId],
      configuration.demand_generation.anchor_year,
      'external commodity',
      commodityId,
    );
    return resolved;
  }, {});

  const growthRates = externalCommodityIds.reduce<Record<string, number>>((resolved, commodityId) => {
    resolved[commodityId] = resolveGrowthRate(
      commodityId,
      preset.external_commodity_growth_rates_pct_per_year,
      configuration.demand_generation.external_commodity_growth_rates_pct_per_year,
    );
    return resolved;
  }, {});

  const tables = externalCommodityIds.reduce<Record<string, Record<string, number>>>((resolved, commodityId) => {
    const overrideRate = configuration.demand_generation.external_commodity_growth_rates_pct_per_year?.[commodityId];
    const presetMultipliers = preset.milestone_multipliers_by_external_commodity?.[commodityId];
    resolved[commodityId] = typeof overrideRate === 'number' || !presetMultipliers
      ? generateValueTable(
          anchors[commodityId],
          growthRates[commodityId],
          configuration.years,
          configuration.demand_generation.anchor_year,
          configuration.demand_generation.year_overrides,
          commodityId,
        )
      : generateValueTableFromMultipliers(
          anchors[commodityId],
          presetMultipliers,
          configuration.years,
          configuration.demand_generation.year_overrides,
          commodityId,
        );
    return resolved;
  }, {});

  return { anchors, growthRates, tables };
}

function normalizeManualServiceDemandTables(
  configuration: ConfigurationDocument,
  appConfig: AppConfigRegistry,
): Record<string, Record<string, number>> {
  return Object.entries(appConfig.output_roles).reduce<Record<string, Record<string, number>>>(
    (resolved, [outputId, metadata]) => {
      if (!metadata.demand_required) {
        return resolved;
      }

      resolved[outputId] = normalizeValueTable(configuration.service_demands[outputId], configuration.years);
      return resolved;
    },
    {},
  );
}

function normalizeManualExternalCommodityDemandTables(
  configuration: ConfigurationDocument,
): Record<string, Record<string, number>> {
  return Object.entries(configuration.external_commodity_demands ?? {}).reduce<
    Record<string, Record<string, number>>
  >((resolved, [commodityId, table]) => {
    resolved[commodityId] = normalizeValueTable(table, configuration.years);
    return resolved;
  }, {});
}

export function resolveConfigurationDocument(
  configuration: ConfigurationDocument,
  appConfig: AppConfigRegistry,
  label = 'configuration document',
): ConfigurationDocument {
  if (configuration.demand_generation.mode === 'manual_table') {
    return {
      ...configuration,
      service_demands: normalizeManualServiceDemandTables(configuration, appConfig),
      external_commodity_demands: normalizeManualExternalCommodityDemandTables(configuration),
    };
  }

  const preset = resolveAnchorPreset(configuration.demand_generation, appConfig);
  const serviceResolution = resolveServiceDemandTables(configuration, appConfig, preset);
  const externalResolution = resolveExternalCommodityDemandTables(configuration, appConfig, preset);

  assertCompatibleResolvedTables(
    configuration.service_demands,
    serviceResolution.tables,
    `${label} service_demands`,
  );
  assertCompatibleResolvedTables(
    configuration.external_commodity_demands,
    externalResolution.tables,
    `${label} external_commodity_demands`,
  );

  return {
    ...configuration,
    service_demands: serviceResolution.tables,
    demand_generation: {
      ...configuration.demand_generation,
      service_anchors: serviceResolution.anchors,
      service_growth_rates_pct_per_year: serviceResolution.growthRates,
      external_commodity_anchors: Object.keys(externalResolution.anchors).length > 0
        ? externalResolution.anchors
        : null,
      external_commodity_growth_rates_pct_per_year: Object.keys(externalResolution.growthRates).length > 0
        ? externalResolution.growthRates
        : null,
    },
    external_commodity_demands: externalResolution.tables,
  };
}
