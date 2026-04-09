/**
 * Baseline test — pins every subsector to its least-ambitious (incumbent)
 * state and verifies the solver produces a clean optimal solution.
 *
 * Run:  npx tsx --test test/baseline.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../src/data/parseCsv.ts';
import { resolveScenarioDocument } from '../src/data/demandResolution.ts';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';
import { solveWithLpAdapter } from '../src/solver/lpAdapter.ts';

// --- Least-ambitious state for each output ---

const INCUMBENT_STATE_IDS = {
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
const INCUMBENT_ELECTRICITY_STATE_ID = 'electricity__grid_supply__incumbent_thermal_mix';

// --- Data loading ---

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

function readText(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return readFileSync(url, 'utf8');
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

function loadPkg() {
  const csvText = readText('../../aus_phase1_sector_state_library/data/sector_states.csv');
  const sectorStates = parseCsv(csvText).map(toSectorState);
  const appConfig = loadAppConfig();
  return { sectorStates, appConfig };
}

function buildBaselineScenario(appConfig, electricityControl = { mode: 'externalized' }) {
  const referenceScenario = readJson('../public/app_config/reference_configuration.json');

  const serviceControls = {};
  for (const [outputId, stateId] of Object.entries(INCUMBENT_STATE_IDS)) {
    serviceControls[outputId] = { mode: 'pinned_single', state_id: stateId };
  }
  serviceControls.electricity = electricityControl;
  serviceControls.land_sequestration = { mode: 'optimize', disabled_state_ids: ['removals_negative_emissions__land_sequestration__biological_sink'] };
  serviceControls.engineered_removals = { mode: 'optimize', disabled_state_ids: ['removals_negative_emissions__engineered_removals__daccs'] };

  const scenario = {
    ...referenceScenario,
    name: 'Baseline — all incumbents, externalized electricity',
    description: 'Every subsector pinned to its least-ambitious state. Electricity externalized, removals off.',
    service_controls: serviceControls,
    solver_options: {
      respect_max_share: false,
      respect_max_activity: true,
      soft_constraints: false,
      allow_removals_credit: false,
      share_smoothing: { enabled: false },
    },
  };

  return resolveScenarioDocument(scenario, appConfig, 'baseline test scenario');
}

// --- Tests ---

const pkg = loadPkg();
const scenario = buildBaselineScenario(pkg.appConfig);
const endogenousElectricityScenario = buildBaselineScenario(pkg.appConfig, {
  mode: 'fixed_shares',
  fixed_shares: { [INCUMBENT_ELECTRICITY_STATE_ID]: 1 },
});

test('baseline incumbent scenario solves optimally', () => {
  const request = buildSolveRequest({
    sectorStates: pkg.sectorStates,
    appConfig: pkg.appConfig,
  }, scenario);

  const result = solveWithLpAdapter(request);

  assert.equal(result.status, 'solved', `expected solved, got ${result.status}`);
  assert.equal(result.raw.solutionStatus, 'optimal');
  assert.ok(result.diagnostics.every((d) => d.severity !== 'error'), 'no error diagnostics');
});

test('every required-service output has exactly one active state per year', () => {
  const request = buildSolveRequest({
    sectorStates: pkg.sectorStates,
    appConfig: pkg.appConfig,
  }, scenario);

  const result = solveWithLpAdapter(request);
  const activeShares = result.reporting.stateShares.filter((s) => s.activity > 1e-6);

  for (const [outputId, stateId] of Object.entries(INCUMBENT_STATE_IDS)) {
    for (const year of scenario.years) {
      const matches = activeShares.filter((s) => s.outputId === outputId && s.year === year);

      assert.equal(
        matches.length, 1,
        `${outputId} in ${year}: expected 1 active state, got ${matches.length}`,
      );
      assert.equal(
        matches[0].stateId, stateId,
        `${outputId} in ${year}: expected ${stateId}, got ${matches[0].stateId}`,
      );
      assert.ok(
        matches[0].share != null && Math.abs(matches[0].share - 1) < 1e-6,
        `${outputId} in ${year}: expected 100% share, got ${matches[0].share}`,
      );
    }
  }
});

test('electricity is externalized with zero supply', () => {
  const request = buildSolveRequest({
    sectorStates: pkg.sectorStates,
    appConfig: pkg.appConfig,
  }, scenario);

  const result = solveWithLpAdapter(request);

  for (const balance of result.reporting.commodityBalances) {
    if (balance.commodityId !== 'electricity') continue;
    assert.equal(balance.mode, 'externalized', `electricity ${balance.year} should be externalized`);
    assert.equal(balance.supply, 0, `electricity ${balance.year} supply should be 0`);
  }
});

test('demand is met for all service outputs in every year', () => {
  const request = buildSolveRequest({
    sectorStates: pkg.sectorStates,
    appConfig: pkg.appConfig,
  }, scenario);

  const result = solveWithLpAdapter(request);
  const activeShares = result.reporting.stateShares.filter((s) => s.activity > 1e-6);

  for (const [outputId] of Object.entries(INCUMBENT_STATE_IDS)) {
    for (const year of scenario.years) {
      const demand = request.configuration.serviceDemandByOutput[outputId]?.[String(year)];
      if (demand == null || demand === 0) continue;

      const totalActivity = activeShares
        .filter((s) => s.outputId === outputId && s.year === year)
        .reduce((sum, s) => sum + s.activity, 0);

      assert.ok(
        Math.abs(totalActivity - demand) / demand < 1e-6,
        `${outputId} in ${year}: activity ${totalActivity} should match demand ${demand}`,
      );
    }
  }
});

test('baseline incumbent scenario also solves with endogenous fixed-share electricity', () => {
  const request = buildSolveRequest({
    sectorStates: pkg.sectorStates,
    appConfig: pkg.appConfig,
  }, endogenousElectricityScenario);

  const result = solveWithLpAdapter(request);

  assert.equal(result.status, 'solved', `expected solved, got ${result.status}`);
  assert.equal(result.raw.solutionStatus, 'optimal');
  assert.ok(result.diagnostics.every((d) => d.severity !== 'error'), 'no error diagnostics');

  for (const balance of result.reporting.commodityBalances) {
    if (balance.commodityId !== 'electricity') continue;
    assert.equal(balance.mode, 'endogenous', `electricity ${balance.year} should stay endogenous`);
    assert.ok(balance.supply > 0, `electricity ${balance.year} should have positive supply`);
    assert.ok(Math.abs(balance.balanceGap ?? 0) < 1e-2, `electricity ${balance.year} should balance`);
  }
});
