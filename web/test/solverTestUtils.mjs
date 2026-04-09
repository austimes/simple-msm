/**
 * Shared test utilities for solver tests.
 *
 * Provides data loading, scenario building, and assertion helpers.
 */
import { readFileSync } from 'node:fs';
import { parseCsv } from '../src/data/parseCsv.ts';
import { resolveScenarioDocument } from '../src/data/demandResolution.ts';
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

export function loadPkg() {
  const csvText = readText('../../aus_phase1_sector_state_library/data/sector_states.csv');
  const sectorStates = parseCsv(csvText).map(toSectorState);
  const appConfig = loadAppConfig();
  return { sectorStates, appConfig };
}

export function loadReferenceScenario() {
  return readJson('../public/app_config/reference_configuration.json');
}

/**
 * Build a scenario with custom service controls and solver options.
 */
export function buildScenario(appConfig, overrides = {}) {
  const referenceScenario = loadReferenceScenario();

  const scenario = {
    ...referenceScenario,
    name: overrides.name ?? referenceScenario.name,
    description: overrides.description ?? referenceScenario.description,
    service_controls: {
      ...referenceScenario.service_controls,
      ...(overrides.serviceControls ?? {}),
    },
    solver_options: {
      ...referenceScenario.solver_options,
      ...(overrides.solverOptions ?? {}),
    },
  };

  return resolveScenarioDocument(scenario, appConfig, overrides.name ?? 'test scenario');
}

/**
 * Build and solve a request with optional seed scope.
 */
export function solveScoped(pkg, scenario, seedOutputIds) {
  const request = buildSolveRequest(
    { sectorStates: pkg.sectorStates, appConfig: pkg.appConfig },
    scenario,
    seedOutputIds ? { seedOutputIds } : {},
  );
  const result = solveWithLpAdapter(request);
  return { request, result };
}
