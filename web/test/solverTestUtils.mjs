/**
 * Shared test utilities for solver tests.
 *
 * Provides data loading, configuration building, and assertion helpers.
 */
import { readFileSync } from 'node:fs';
import { parseCsv } from '../src/data/parseCsv.ts';
import { resolveConfigurationDocument as resolveConfigurationDocument } from '../src/data/demandResolution.ts';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';
import { solveWithLpAdapter } from '../src/solver/lpAdapter.ts';

// --- Incumbent state IDs ---

export const INCUMBENT_STATE_IDS = {
  residential_building_services: 'buildings__residential__incumbent_mixed_fuels',
  commercial_building_services: 'buildings__commercial__incumbent_mixed_fuels',
  passenger_road_transport: 'road_transport__passenger_road__ice_fleet',
  freight_road_transport: 'road_transport__freight_road__diesel',
  low_temperature_heat: 'generic_industrial_heat__low_temperature_heat__fossil',
  medium_temperature_heat: 'generic_industrial_heat__medium_temperature_heat__fossil',
  high_temperature_heat: 'generic_industrial_heat__high_temperature_heat__fossil',
  crude_steel: 'steel__crude_steel__bf_bof_conventional',
  cement_equivalent: 'cement_clinker__cement_equivalent__conventional',
  livestock_output_bundle: 'agriculture__livestock__conventional',
  cropping_horticulture_output_bundle: 'agriculture__cropping_horticulture__conventional',
};

// --- Data loading ---

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

function readText(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return readFileSync(url, 'utf8');
}

export function loadAppConfig() {
  return {
    output_roles: readJson('../public/app_config/output_roles.json'),
    baseline_activity_anchors: readJson('../public/app_config/baseline_activity_anchors.json'),
    demand_growth_presets: readJson('../public/app_config/demand_growth_presets.json'),
    commodity_price_presets: readJson('../public/app_config/commodity_price_presets.json'),
    carbon_price_presets: readJson('../public/app_config/carbon_price_presets.json'),
    explanation_tag_rules: readJson('../public/app_config/explanation_tag_rules.json'),
  };
}

function parseJsonArray(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function parseNum(raw) {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
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
    would_expand_to_explicit_capacity: parseBool(row['would_expand_to_explicit_capacity?'] ?? ''),
    would_expand_to_process_chain: parseBool(row['would_expand_to_process_chain?'] ?? ''),
  };
}

function parseEmptyNull(raw) {
  if (!raw || raw.trim() === '') return null;
  return raw;
}

function toResidualOverlayRow(row) {
  return {
    overlay_id: row['overlay_id'],
    overlay_label: row['overlay_label'],
    overlay_domain: row['overlay_domain'],
    official_accounting_bucket: row['official_accounting_bucket'],
    year: Number(row['year']),
    commodity: parseEmptyNull(row['commodity']),
    final_energy_pj_2025: parseNum(row['final_energy_pj_2025']),
    native_unit: row['native_unit'] ?? '',
    native_quantity_2025: parseNum(row['native_quantity_2025']),
    direct_energy_emissions_mtco2e_2025: parseNum(row['direct_energy_emissions_mtco2e_2025']),
    other_emissions_mtco2e_2025: parseNum(row['other_emissions_mtco2e_2025']),
    carbon_billable_emissions_mtco2e_2025: parseNum(row['carbon_billable_emissions_mtco2e_2025']),
    default_price_basis: row['default_price_basis'] ?? '',
    default_price_per_native_unit_aud_2024: parseNum(row['default_price_per_native_unit_aud_2024']),
    default_commodity_cost_audm_2024: parseNum(row['default_commodity_cost_audm_2024']),
    default_fixed_noncommodity_cost_audm_2024: parseNum(row['default_fixed_noncommodity_cost_audm_2024']),
    default_total_cost_ex_carbon_audm_2024: parseNum(row['default_total_cost_ex_carbon_audm_2024']),
    default_include: parseBool(row['default_include'] ?? ''),
    allocation_method: row['allocation_method'] ?? '',
    cost_basis_note: row['cost_basis_note'] ?? '',
    notes: row['notes'] ?? '',
  };
}

function toCommodityBalance2025Row(row) {
  return {
    commodity: row['commodity'],
    benchmark_stream: row['benchmark_stream'],
    official_benchmark_pj_2025: parseNum(row['official_benchmark_pj_2025']),
    explicit_gross_model_inputs_pj_2025: parseNum(row['explicit_gross_model_inputs_pj_2025']),
    explicit_benchmark_mapped_pj_2025: parseNum(row['explicit_benchmark_mapped_pj_2025']),
    residual_overlay_pj_2025: parseNum(row['residual_overlay_pj_2025']),
    balanced_total_pj_2025: parseNum(row['balanced_total_pj_2025']),
    difference_to_benchmark_pj_2025: parseNum(row['difference_to_benchmark_pj_2025']),
    native_unit: row['native_unit'],
    official_benchmark_native_2025: parseNum(row['official_benchmark_native_2025']),
    explicit_gross_model_inputs_native_2025: parseNum(row['explicit_gross_model_inputs_native_2025']),
    explicit_benchmark_mapped_native_2025: parseNum(row['explicit_benchmark_mapped_native_2025']),
    residual_overlay_native_2025: parseNum(row['residual_overlay_native_2025']),
    balanced_total_native_2025: parseNum(row['balanced_total_native_2025']),
    notes: row['notes'],
  };
}

function toEmissionsBalance2025Row(row) {
  return {
    official_category: row['official_category'],
    official_mtco2e_2025: parseNum(row['official_mtco2e_2025']),
    explicit_model_mtco2e_2025: parseNum(row['explicit_model_mtco2e_2025']),
    residual_energy_overlay_mtco2e_2025: parseNum(row['residual_energy_overlay_mtco2e_2025']),
    residual_nonenergy_overlay_mtco2e_2025: parseNum(row['residual_nonenergy_overlay_mtco2e_2025']),
    balanced_total_mtco2e_2025: parseNum(row['balanced_total_mtco2e_2025']),
    difference_to_official_mtco2e_2025: parseNum(row['difference_to_official_mtco2e_2025']),
    note: row['note'],
  };
}

export function loadPkg() {
  const csvText = readText('../../sector_trajectory_library/exports/legacy/sector_state_curves_balanced.csv');
  const sectorStates = parseCsv(csvText).map(toSectorState);
  const appConfig = loadAppConfig();
  return { sectorStates, appConfig };
}

export function loadFormulationFixtureData() {
  const pkg = loadPkg();
  const residualOverlays2025 = parseCsv(
    readText('../../sector_trajectory_library/overlays/residual_overlays.csv'),
  ).map(toResidualOverlayRow);
  const commodityBalance2025 = parseCsv(
    readText('../../sector_trajectory_library/validation/baseline_commodity_balance.csv'),
  ).map(toCommodityBalance2025Row);
  const emissionsBalance2025 = parseCsv(
    readText('../../sector_trajectory_library/validation/baseline_emissions_balance.csv'),
  ).map(toEmissionsBalance2025Row);

  return {
    ...pkg,
    currentConfiguration: loadReferenceConfiguration(),
    residualOverlays2025,
    commodityBalance2025,
    emissionsBalance2025,
  };
}

export function loadReferenceConfiguration() {
  return readJson('../public/app_config/reference_configuration.json');
}

/**
 * Build a configuration with custom service controls and solver options.
 */
export function buildConfiguration(appConfig, overrides = {}) {
  const referenceConfiguration = loadReferenceConfiguration();

  const configuration = {
    ...referenceConfiguration,
    name: overrides.name ?? referenceConfiguration.name,
    description: overrides.description ?? referenceConfiguration.description,
    service_controls: {
      ...referenceConfiguration.service_controls,
      ...(overrides.serviceControls ?? {}),
    },
    solver_options: {
      ...referenceConfiguration.solver_options,
      ...(overrides.solverOptions ?? {}),
    },
  };

  return resolveConfigurationDocument(configuration, appConfig, overrides.name ?? 'test configuration');
}

/**
 * Build and solve a request, scoping to the given output IDs by
 * deactivating pathways for all other non-supply outputs.
 */
export function solveScoped(pkg, configuration, seedOutputIds) {
  let effectiveConfiguration = configuration;

  if (seedOutputIds && seedOutputIds.length > 0) {
    const seedSet = new Set(seedOutputIds);
    const adjustedControls = { ...effectiveConfiguration.service_controls };

    for (const [outputId, meta] of Object.entries(pkg.appConfig.output_roles)) {
      if (meta.participates_in_commodity_balance) continue;
      if (seedSet.has(outputId)) continue;
      // Deactivate pathways for out-of-scope outputs.
      adjustedControls[outputId] = {
        ...(adjustedControls[outputId] ?? {}),
        active_state_ids: [],
      };
    }

    effectiveConfiguration = { ...effectiveConfiguration, service_controls: adjustedControls };
  }

  const request = buildSolveRequest(
    { sectorStates: pkg.sectorStates, appConfig: pkg.appConfig },
    effectiveConfiguration,
  );
  const result = solveWithLpAdapter(request);
  return { request, result };
}
