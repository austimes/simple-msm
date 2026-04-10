import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildComparisonReport, buildComparisonConfigurationPlan } from '../src/compare/compareAnalysis.ts';
import { resolveConfigurationDocument as resolveConfigurationDocument } from '../src/data/demandResolution.ts';
import { parseCsv } from '../src/data/parseCsv.ts';
import { SOLVER_CONTRACT_VERSION } from '../src/solver/contract.ts';
import { solveWithLpAdapter } from '../src/solver/lpAdapter.ts';

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

function readText(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return readFileSync(url, 'utf8');
}

function parseJsonArray(raw) {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function parseNum(raw) {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseBool(raw) {
  return raw.trim().toLowerCase() === 'true';
}

function toSectorState(row) {
  return {
    sector: row['sector'],
    subsector: row['subsector'],
    service_or_output_name: row['service_or_output_name'],
    region: row['region'],
    year: Number(row['year']),
    state_id: row['state_id'],
    state_label: row['state_label'],
    state_description: row['state_description'],
    output_unit: row['output_unit'],
    output_quantity_basis: row['output_quantity_basis'],
    output_cost_per_unit: parseNum(row['output_cost_per_unit']),
    cost_basis_year: parseNum(row['cost_basis_year']),
    currency: row['currency'],
    cost_components_summary: row['cost_components_summary'],
    input_commodities: parseJsonArray(row['input_commodities']),
    input_coefficients: parseJsonArray(row['input_coefficients']),
    input_units: parseJsonArray(row['input_units']),
    input_basis_notes: row['input_basis_notes'],
    energy_emissions_by_pollutant: parseJsonArray(row['energy_emissions_by_pollutant']),
    process_emissions_by_pollutant: parseJsonArray(row['process_emissions_by_pollutant']),
    emissions_units: row['emissions_units'],
    emissions_boundary_notes: row['emissions_boundary_notes'],
    max_share: parseNum(row['max_share']),
    max_activity: parseNum(row['max_activity']),
    min_share: parseNum(row['min_share']),
    rollout_limit_notes: row['rollout_limit_notes'],
    availability_conditions: row['availability_conditions'],
    source_ids: parseJsonArray(row['source_ids']),
    evidence_summary: row['evidence_summary'],
    derivation_method: row['derivation_method'],
    assumption_ids: parseJsonArray(row['assumption_ids']),
    confidence_rating: row['confidence_rating'],
    review_notes: row['review_notes'],
    candidate_expansion_pathway: row['candidate_expansion_pathway'],
    times_or_vedalang_mapping_notes: row['times_or_vedalang_mapping_notes'],
    would_expand_to_explicit_capacity: parseBool(row['would_expand_to_explicit_capacity?']),
    would_expand_to_process_chain: parseBool(row['would_expand_to_process_chain?']),
  };
}

function loadAppConfig() {
  return {
    output_roles: readJson('../public/app_config/output_roles.json'),
    baseline_activity_anchors: readJson('../public/app_config/baseline_activity_anchors.json'),
    demand_growth_presets: readJson('../public/app_config/demand_growth_presets.json'),
    commodity_price_presets: readJson('../public/app_config/commodity_price_presets.json'),
    explanation_tag_rules: readJson('../public/app_config/explanation_tag_rules.json'),
  };
}

function normalizeSolverRows(sectorStates, appConfig) {
  return sectorStates.map((row) => {
    const outputMetadata = appConfig.output_roles[row.service_or_output_name];
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
          source: 'energy',
        })),
        ...row.process_emissions_by_pollutant.map((entry) => ({
          pollutant: entry.pollutant,
          value: entry.value,
          source: 'process',
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

function resolveCommodityPriceSeries(baseSeries, overrideSeries, years) {
  const valuesByYear = years.reduce((resolved, year) => {
    const key = String(year);
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

function resolveConfigurationForSolve(configuration, appConfig) {
  const years = [...configuration.years];
  const controlsByOutput = Object.entries(appConfig.output_roles).reduce((resolved, [outputId, metadata]) => {
    resolved[outputId] = years.reduce((controlsByYear, year) => {
      const key = String(year);
      const control = configuration.service_controls[outputId];
      const override = control?.year_overrides?.[key] ?? null;
      controlsByYear[key] = {
        mode: override?.mode ?? control?.mode ?? metadata.default_control_mode,
        stateId: override?.state_id ?? control?.state_id ?? null,
        fixedShares: override?.fixed_shares ?? control?.fixed_shares ?? null,
        disabledStateIds: control?.disabled_state_ids ?? [],
        targetValue: override?.target_value ?? control?.target_value ?? null,
      };
      return controlsByYear;
    }, {});
    return resolved;
  }, {});

  const serviceDemandByOutput = Object.entries(appConfig.output_roles).reduce((resolved, [outputId, metadata]) => {
    if (!metadata.demand_required) {
      return resolved;
    }

    resolved[outputId] = years.reduce((valuesByYear, year) => {
      valuesByYear[String(year)] = configuration.service_demands[outputId]?.[String(year)] ?? 0;
      return valuesByYear;
    }, {});
    return resolved;
  }, {});

  const externalCommodityDemandByCommodity = Object.entries(configuration.external_commodity_demands ?? {}).reduce(
    (resolved, [commodityId, values]) => {
      resolved[commodityId] = years.reduce((valuesByYear, year) => {
        valuesByYear[String(year)] = values[String(year)] ?? 0;
        return valuesByYear;
      }, {});
      return resolved;
    },
    {},
  );

  const commodityDrivers = appConfig.commodity_price_presets;
  const commodityIds = new Set([
    ...Object.keys(commodityDrivers),
    ...Object.keys(configuration.commodity_pricing.overrides),
  ]);
  const commodityPriceByCommodity = Array.from(commodityIds).reduce((resolved, commodityId) => {
    const driver = commodityDrivers[commodityId];
    const level = configuration.commodity_pricing.selections_by_commodity?.[commodityId] ?? 'medium';
    const baseSeries = driver?.levels[level];
    resolved[commodityId] = resolveCommodityPriceSeries(
      baseSeries,
      configuration.commodity_pricing.overrides[commodityId],
      years,
    );
    return resolved;
  }, {});

  const carbonPriceByYear = years.reduce((resolved, year) => {
    resolved[String(year)] = configuration.carbon_price[String(year)] ?? 0;
    return resolved;
  }, {});

  return {
    name: configuration.name,
    description: configuration.description ?? null,
    years,
    controlsByOutput,
    serviceDemandByOutput,
    externalCommodityDemandByCommodity,
    commodityPriceByCommodity,
    carbonPriceByYear,
    options: {
      respectMaxShare: configuration.solver_options?.respect_max_share ?? true,
      respectMaxActivity: configuration.solver_options?.respect_max_activity ?? true,
      softConstraints: configuration.solver_options?.soft_constraints ?? false,
      allowRemovalsCredit: configuration.solver_options?.allow_removals_credit ?? false,
      shareSmoothing: {
        enabled: configuration.solver_options?.share_smoothing?.enabled ?? false,
        maxDeltaPp: configuration.solver_options?.share_smoothing?.max_delta_pp ?? null,
      },
    },
  };
}

function buildSolveRequestForTest(pkg, configuration) {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: `compare-test-${configuration.name.replaceAll(/\s+/g, '-').toLowerCase()}`,
    rows: normalizeSolverRows(pkg.sectorStates, pkg.appConfig),
    configuration: resolveConfigurationForSolve(configuration, pkg.appConfig),
  };
}

test('packaged reference configuration solves as a stable baseline on the Results path', () => {
  const appConfig = loadAppConfig();
  const referenceConfiguration = resolveConfigurationDocument(
    readJson('../public/app_config/reference_configuration.json'),
    appConfig,
    'reference_configuration.json',
  );
  const sectorStates = parseCsv(readText('../../aus_phase1_sector_state_library/data/sector_states.csv'))
    .map(toSectorState);
  const pkg = {
    sectorStates,
    appConfig,
    defaultConfiguration: referenceConfiguration,
  };

  const request = buildSolveRequestForTest(pkg, referenceConfiguration);
  const result = solveWithLpAdapter(request);

  assert.equal(referenceConfiguration.service_controls.electricity.mode, 'externalized');
  assert.equal(referenceConfiguration.solver_options?.respect_max_share, true);
  assert.ok(result.status === 'solved' || result.status === 'partial');
  assert.equal(result.raw?.solutionStatus, 'optimal');
  assert.ok(!result.diagnostics.some((diagnostic) => diagnostic.code === 'service_and_supply_lp_not_optimal'));
});

test('compare analysis builds heuristic decomposition and narratives from the built-in transition pair', () => {
  const appConfig = loadAppConfig();
  const referenceConfiguration = resolveConfigurationDocument(
    readJson('../public/app_config/reference_configuration.json'),
    appConfig,
    'reference_configuration.json',
  );
  const sectorStates = parseCsv(readText('../../aus_phase1_sector_state_library/data/sector_states.csv'))
    .map(toSectorState);
  const pkg = {
    sectorStates,
    appConfig,
    defaultConfiguration: referenceConfiguration,
  };

  const plan = buildComparisonConfigurationPlan(referenceConfiguration, appConfig);
  assert.equal(plan.configurations.compare.service_controls.electricity.mode, 'optimize');

  const solves = plan.order.map((key) => {
    const configuration = plan.configurations[key];
    const request = buildSolveRequestForTest(pkg, configuration);
    const result = solveWithLpAdapter(request);
    return { key, configuration, request, result };
  });

  assert.ok(
    solves.every((solve) => solve.result.status !== 'error'),
  );
  assert.ok(
    !solves.some((solve) => solve.result.diagnostics.some((diagnostic) => diagnostic.code === 'service_and_supply_lp_not_optimal')),
  );

  const report = buildComparisonReport(appConfig, sectorStates, solves);

  assert.equal(report.metrics.length, 6);
  assert.ok(report.decomposition.some((entry) => entry.id === 'demand'));
  assert.ok(report.decomposition.some((entry) => entry.id === 'constraints'));
  assert.ok(report.narratives.some((entry) => entry.id === 'removals'));
  assert.ok(report.narratives.some((entry) => entry.id === 'state-choice'));
  assert.ok(report.stateShareDeltas.length > 0);
  assert.ok(report.commodityDemandDeltas.some((entry) => entry.commodityId === 'electricity'));
  assert.equal(report.electricityDeltas.length, referenceConfiguration.years.length);
  assert.match(report.heuristicNote, /heuristic/i);
});
