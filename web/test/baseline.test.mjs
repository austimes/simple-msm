/**
 * Baseline test — pins every subsector to its least-ambitious (incumbent)
 * state and verifies the solver produces a clean optimal solution.
 *
 * Run:  bunx tsx --test test/baseline.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { loadPackage } from '../src/data/packageLoader.ts';
import { resolveConfigurationDocument as resolveConfigurationDocument } from '../src/data/demandResolution.ts';
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

function loadPkg() {
  return loadPackage();
}

function buildBaselineConfiguration(
  appConfig,
  electricityControl = { mode: 'externalized' },
  solverOptionsOverrides = {},
) {
  const referenceConfiguration = readJson('../src/configurations/reference-baseline.json');

  const serviceControls = {};
  for (const [outputId, methodId] of Object.entries(INCUMBENT_STATE_IDS)) {
    serviceControls[outputId] = { mode: 'optimize', active_state_ids: [methodId] };
  }
  serviceControls.electricity = electricityControl;
  serviceControls.land_sequestration = { mode: 'optimize', disabled_state_ids: ['removals_negative_emissions__land_sequestration__biological_sink'] };
  serviceControls.engineered_removals = { mode: 'optimize', disabled_state_ids: ['removals_negative_emissions__engineered_removals__daccs'] };

  const configuration = {
    ...referenceConfiguration,
    name: 'Baseline — all incumbents, externalized electricity',
    description: 'Every subsector held at 100% on its least-ambitious state. Electricity externalized, removals off.',
    service_controls: serviceControls,
    solver_options: {
      respect_max_share: false,
      respect_max_activity: true,
      soft_constraints: false,
      share_smoothing: { enabled: false },
      ...solverOptionsOverrides,
    },
  };

  return resolveConfigurationDocument(configuration, appConfig, 'baseline test configuration');
}

// --- Tests ---

const pkg = loadPkg();
const configuration = buildBaselineConfiguration(pkg.appConfig);
const endogenousElectricityConfiguration = buildBaselineConfiguration(pkg.appConfig, {
  mode: 'optimize',
  active_state_ids: [INCUMBENT_ELECTRICITY_STATE_ID],
});
const cappedIncumbentElectricityConfiguration = buildBaselineConfiguration(pkg.appConfig, {
  mode: 'optimize',
  active_state_ids: [INCUMBENT_ELECTRICITY_STATE_ID],
}, {
  respect_max_share: true,
});

test('baseline incumbent configuration solves optimally', () => {
  const request = buildSolveRequest({
    resolvedMethodYears: pkg.resolvedMethodYears,
    appConfig: pkg.appConfig,
  }, configuration);

  const result = solveWithLpAdapter(request);

  assert.equal(result.status, 'solved', `expected solved, got ${result.status}`);
  assert.equal(result.raw.solutionStatus, 'optimal');
  assert.ok(result.diagnostics.every((d) => d.severity !== 'error'), 'no error diagnostics');
});

test('every required-service output has exactly one active state per year', () => {
  const request = buildSolveRequest({
    resolvedMethodYears: pkg.resolvedMethodYears,
    appConfig: pkg.appConfig,
  }, configuration);

  const result = solveWithLpAdapter(request);
  const activeShares = result.reporting.methodShares.filter((s) => s.activity > 1e-6);

  for (const [outputId, methodId] of Object.entries(INCUMBENT_STATE_IDS)) {
    for (const year of configuration.years) {
      const matches = activeShares.filter((s) => s.outputId === outputId && s.year === year);

      assert.equal(
        matches.length, 1,
        `${outputId} in ${year}: expected 1 active state, got ${matches.length}`,
      );
      assert.equal(
        matches[0].methodId, methodId,
        `${outputId} in ${year}: expected ${methodId}, got ${matches[0].methodId}`,
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
    resolvedMethodYears: pkg.resolvedMethodYears,
    appConfig: pkg.appConfig,
  }, configuration);

  const result = solveWithLpAdapter(request);

  for (const balance of result.reporting.commodityBalances) {
    if (balance.commodityId !== 'electricity') continue;
    assert.equal(balance.mode, 'externalized', `electricity ${balance.year} should be externalized`);
    assert.equal(balance.supply, 0, `electricity ${balance.year} supply should be 0`);
  }
});

test('demand is met for all service outputs in every year', () => {
  const request = buildSolveRequest({
    resolvedMethodYears: pkg.resolvedMethodYears,
    appConfig: pkg.appConfig,
  }, configuration);

  const result = solveWithLpAdapter(request);
  const activeShares = result.reporting.methodShares.filter((s) => s.activity > 1e-6);

  for (const [outputId] of Object.entries(INCUMBENT_STATE_IDS)) {
    for (const year of configuration.years) {
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

test('baseline incumbent configuration also solves with only incumbent endogenous electricity', () => {
  const request = buildSolveRequest({
    resolvedMethodYears: pkg.resolvedMethodYears,
    appConfig: pkg.appConfig,
  }, endogenousElectricityConfiguration);

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

test('baseline incumbent configuration also solves with only incumbent endogenous electricity under max-share caps', () => {
  const request = buildSolveRequest({
    resolvedMethodYears: pkg.resolvedMethodYears,
    appConfig: pkg.appConfig,
  }, cappedIncumbentElectricityConfiguration);

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

// --- Balanced-table metadata regression tests ---

test('at least one parsed ResolvedMethodYearRow has is_default_incumbent_2025 === true', () => {
  const incumbent = pkg.resolvedMethodYears.find((s) => s.is_default_incumbent_2025 === true);
  assert.ok(incumbent, 'no row found with is_default_incumbent_2025 === true');
});

test('at least one parsed ResolvedMethodYearRow has a non-empty state_sort_key', () => {
  const withSortKey = pkg.resolvedMethodYears.find((s) => s.state_sort_key !== '');
  assert.ok(withSortKey, 'no row found with a non-empty state_sort_key');
});

test('electricity incumbent 2025 state has energy_co2e populated', () => {
  const elecIncumbent2025 = pkg.resolvedMethodYears.find(
    (s) => s.state_id === INCUMBENT_ELECTRICITY_STATE_ID && s.year === 2025,
  );
  assert.ok(elecIncumbent2025, 'electricity incumbent 2025 row not found');
  assert.ok(
    elecIncumbent2025.energy_co2e != null && elecIncumbent2025.energy_co2e > 0,
    `expected positive energy_co2e, got ${elecIncumbent2025.energy_co2e}`,
  );
});

test('row count matches manifest expectation', () => {
  assert.equal(pkg.resolvedMethodYears.length, 450, `expected 450 rows, got ${pkg.resolvedMethodYears.length}`);
});
