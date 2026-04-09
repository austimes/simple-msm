/**
 * Subset solve tests — verifies the solver can run on isolated
 * sectors/outputs with correct dependency expansion.
 *
 * Run:  npx tsx --test test/solveSubsets.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  INCUMBENT_STATE_IDS,
  loadPkg,
  buildScenario,
  solveScoped,
} from './solverTestUtils.mjs';

const pkg = loadPkg();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildServiceControls(pinnedOutputIds, extras = {}) {
  const controls = {};
  for (const outputId of pinnedOutputIds) {
    const stateId = INCUMBENT_STATE_IDS[outputId];
    if (stateId) {
      controls[outputId] = { mode: 'pinned_single', state_id: stateId };
    }
  }
  controls.electricity = extras.electricity ?? { mode: 'externalized' };
  controls.land_sequestration = { mode: 'off' };
  controls.engineered_removals = { mode: 'off' };
  return { ...controls, ...(extras.additional ?? {}) };
}

function assertSolvesOptimally(result) {
  assert.equal(result.status, 'solved', `expected solved, got ${result.status}`);
  assert.equal(result.raw.solutionStatus, 'optimal');
  assert.ok(
    result.diagnostics.every((d) => d.severity !== 'error'),
    `unexpected error diagnostics: ${result.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message).join('; ')}`,
  );
}

function assertRequestContainsOnlyOutputs(request, expectedOutputIds) {
  const expected = new Set(expectedOutputIds);
  const actual = new Set(request.rows.map((r) => r.outputId));
  for (const outputId of actual) {
    assert.ok(expected.has(outputId), `unexpected output ${outputId} in request rows`);
  }
  for (const outputId of expectedOutputIds) {
    assert.ok(actual.has(outputId), `expected output ${outputId} missing from request rows`);
  }
}

function assertNoActiveSharesForOutputs(result, excludedOutputIds) {
  const excluded = new Set(excludedOutputIds);
  const violations = result.reporting.stateShares.filter(
    (s) => excluded.has(s.outputId) && s.activity > 1e-6,
  );
  assert.equal(violations.length, 0, `found active shares for excluded outputs: ${violations.map((v) => v.outputId).join(', ')}`);
}

function assertElectricityAbsent(request) {
  const hasElecRows = request.rows.some((r) => r.outputId === 'electricity');
  assert.ok(!hasElecRows, 'electricity rows should be absent from scoped request');
  assert.ok(
    !request.configuration.controlsByOutput['electricity'],
    'electricity should be absent from controlsByOutput',
  );
}

function assertElectricityExternalized(result) {
  for (const balance of result.reporting.commodityBalances) {
    if (balance.commodityId !== 'electricity') continue;
    assert.equal(balance.mode, 'externalized', `electricity ${balance.year} should be externalized`);
    assert.equal(balance.supply, 0, `electricity ${balance.year} supply should be 0`);
  }
}

function assertElectricityEndogenous(result) {
  const elecBalances = result.reporting.commodityBalances.filter(
    (b) => b.commodityId === 'electricity',
  );
  assert.ok(elecBalances.length > 0, 'should have electricity commodity balances');
  for (const balance of elecBalances) {
    assert.equal(balance.mode, 'endogenous', `electricity ${balance.year} should be endogenous`);
    assert.ok(balance.supply > 0, `electricity ${balance.year} should have positive supply`);
    assert.ok(
      Math.abs(balance.balanceGap) < 1e-3,
      `electricity ${balance.year} balance gap should be near zero, got ${balance.balanceGap}`,
    );
  }
}

function assertPinnedStatesMatch(result, pinnedMap, years) {
  const activeShares = result.reporting.stateShares.filter((s) => s.activity > 1e-6);

  for (const [outputId, stateId] of Object.entries(pinnedMap)) {
    for (const year of years) {
      const matches = activeShares.filter((s) => s.outputId === outputId && s.year === year);
      assert.equal(matches.length, 1, `${outputId} in ${year}: expected 1 active state, got ${matches.length}`);
      assert.equal(matches[0].stateId, stateId, `${outputId} in ${year}: expected ${stateId}, got ${matches[0].stateId}`);
      assert.ok(
        matches[0].share != null && Math.abs(matches[0].share - 1) < 1e-6,
        `${outputId} in ${year}: expected 100% share, got ${matches[0].share}`,
      );
    }
  }
}

const CONFIGURATION_YEARS = [2025, 2030, 2035, 2040, 2045, 2050];
const DEFAULT_SOLVER_OPTIONS = {
  respect_max_share: false,
  respect_max_activity: true,
  soft_constraints: false,
  allow_removals_credit: false,
  share_smoothing: { enabled: false },
};

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

describe('agriculture only (uses electricity — auto-included)', () => {
  const outputIds = ['livestock_output_bundle', 'cropping_horticulture_output_bundle'];
  const pinnedMap = {
    livestock_output_bundle: INCUMBENT_STATE_IDS.livestock_output_bundle,
    cropping_horticulture_output_bundle: INCUMBENT_STATE_IDS.cropping_horticulture_output_bundle,
  };
  const serviceControls = buildServiceControls(outputIds, {
    electricity: { mode: 'externalized' },
  });
  const scenario = buildScenario(pkg.appConfig, {
    name: 'Agriculture only',
    serviceControls,
    solverOptions: DEFAULT_SOLVER_OPTIONS,
  });
  const { request, result } = solveScoped(pkg, scenario, outputIds);

  test('solves optimally', () => assertSolvesOptimally(result));

  test('request includes agriculture and electricity (auto-expanded)', () => {
    const outputsInRequest = new Set(request.rows.map((r) => r.outputId));
    assert.ok(outputsInRequest.has('livestock_output_bundle'));
    assert.ok(outputsInRequest.has('cropping_horticulture_output_bundle'));
    assert.ok(outputsInRequest.has('electricity'), 'agriculture conventional uses electricity');
  });

  test('electricity is externalized', () => assertElectricityExternalized(result));

  test('pinned states match', () => assertPinnedStatesMatch(result, pinnedMap, CONFIGURATION_YEARS));
});

describe('cement only (conventional uses electricity — auto-included)', () => {
  const outputIds = ['cement_equivalent'];
  const pinnedMap = { cement_equivalent: INCUMBENT_STATE_IDS.cement_equivalent };
  const serviceControls = buildServiceControls(outputIds, {
    electricity: { mode: 'externalized' },
  });
  const scenario = buildScenario(pkg.appConfig, {
    name: 'Cement only',
    serviceControls,
    solverOptions: DEFAULT_SOLVER_OPTIONS,
  });
  const { request, result } = solveScoped(pkg, scenario, outputIds);

  test('solves optimally', () => assertSolvesOptimally(result));

  test('request includes cement and electricity (auto-expanded)', () => {
    const outputsInRequest = new Set(request.rows.map((r) => r.outputId));
    assert.ok(outputsInRequest.has('cement_equivalent'));
    assert.ok(outputsInRequest.has('electricity'), 'cement conventional uses electricity');
  });

  test('electricity is externalized', () => assertElectricityExternalized(result));

  test('pinned state matches', () => assertPinnedStatesMatch(result, pinnedMap, CONFIGURATION_YEARS));
});

describe('steel incumbent only (BF-BOF uses electricity — auto-included)', () => {
  const outputIds = ['crude_steel'];
  const pinnedMap = { crude_steel: INCUMBENT_STATE_IDS.crude_steel };
  const serviceControls = buildServiceControls(outputIds, {
    electricity: { mode: 'externalized' },
  });
  const scenario = buildScenario(pkg.appConfig, {
    name: 'Steel incumbent only',
    serviceControls,
    solverOptions: DEFAULT_SOLVER_OPTIONS,
  });
  const { request, result } = solveScoped(pkg, scenario, outputIds);

  test('solves optimally', () => assertSolvesOptimally(result));

  test('request includes steel and electricity (auto-expanded)', () => {
    const outputsInRequest = new Set(request.rows.map((r) => r.outputId));
    assert.ok(outputsInRequest.has('crude_steel'));
    assert.ok(outputsInRequest.has('electricity'), 'BF-BOF conventional uses electricity');
  });

  test('electricity is externalized', () => assertElectricityExternalized(result));

  test('pinned state matches', () => assertPinnedStatesMatch(result, pinnedMap, CONFIGURATION_YEARS));
});

describe('steel optimize (auto-includes electricity)', () => {
  const outputIds = ['crude_steel'];
  const serviceControls = buildServiceControls([], {
    electricity: { mode: 'externalized' },
    additional: {
      crude_steel: { mode: 'optimize' },
    },
  });
  const scenario = buildScenario(pkg.appConfig, {
    name: 'Steel optimize with electricity',
    serviceControls,
    solverOptions: DEFAULT_SOLVER_OPTIONS,
  });
  const { request, result } = solveScoped(pkg, scenario, outputIds);

  test('solves optimally', () => assertSolvesOptimally(result));

  test('request includes steel and electricity (auto-expanded)', () => {
    const outputsInRequest = new Set(request.rows.map((r) => r.outputId));
    assert.ok(outputsInRequest.has('crude_steel'), 'should include crude_steel');
    assert.ok(outputsInRequest.has('electricity'), 'should auto-include electricity');
  });

  test('electricity is externalized', () => assertElectricityExternalized(result));
});

describe('buildings only with electricity externalized', () => {
  const outputIds = ['residential_building_services', 'commercial_building_services'];
  const pinnedMap = {
    residential_building_services: INCUMBENT_STATE_IDS.residential_building_services,
    commercial_building_services: INCUMBENT_STATE_IDS.commercial_building_services,
  };
  const serviceControls = buildServiceControls(outputIds, {
    electricity: { mode: 'externalized' },
  });
  const scenario = buildScenario(pkg.appConfig, {
    name: 'Buildings only — electricity externalized',
    serviceControls,
    solverOptions: DEFAULT_SOLVER_OPTIONS,
  });
  const { request, result } = solveScoped(pkg, scenario, outputIds);

  test('solves optimally', () => assertSolvesOptimally(result));

  test('request includes buildings and electricity', () => {
    const outputsInRequest = new Set(request.rows.map((r) => r.outputId));
    assert.ok(outputsInRequest.has('residential_building_services'), 'should include residential');
    assert.ok(outputsInRequest.has('commercial_building_services'), 'should include commercial');
    assert.ok(outputsInRequest.has('electricity'), 'should auto-include electricity');
  });

  test('electricity is externalized', () => assertElectricityExternalized(result));

  test('pinned states match', () => assertPinnedStatesMatch(result, pinnedMap, CONFIGURATION_YEARS));
});

describe('buildings only with electricity endogenous (optimize) — scaled demand', () => {
  const outputIds = ['residential_building_services', 'commercial_building_services'];
  const serviceControls = buildServiceControls([], {
    electricity: { mode: 'optimize' },
    additional: {
      residential_building_services: { mode: 'optimize' },
      commercial_building_services: { mode: 'optimize' },
    },
  });

  const scenario = buildScenario(pkg.appConfig, {
    name: 'Buildings only — electricity endogenous',
    serviceControls,
    solverOptions: DEFAULT_SOLVER_OPTIONS,
  });
  const { request, result } = solveScoped(pkg, scenario, outputIds);

  test('request includes electricity auto-expanded', () => {
    const outputsInRequest = new Set(request.rows.map((r) => r.outputId));
    assert.ok(outputsInRequest.has('electricity'), 'should auto-include electricity');
  });

  test('electricity control is optimize', () => {
    assert.equal(request.configuration.controlsByOutput.electricity?.['2025']?.mode, 'optimize');
  });

  test('external electricity demand is excluded for scoped solve', () => {
    assert.equal(
      request.configuration.externalCommodityDemandByCommodity.electricity,
      undefined,
      'external electricity demand should be excluded when electricity is auto-expanded',
    );
  });
});

describe('road transport with BEV (needs electricity)', () => {
  const outputIds = ['passenger_road_transport'];
  const serviceControls = buildServiceControls([], {
    electricity: { mode: 'externalized' },
    additional: {
      passenger_road_transport: {
        mode: 'pinned_single',
        state_id: 'road_transport__passenger_road__bev',
      },
    },
  });
  const scenario = buildScenario(pkg.appConfig, {
    name: 'Road transport BEV',
    serviceControls,
    solverOptions: DEFAULT_SOLVER_OPTIONS,
  });
  const { request, result } = solveScoped(pkg, scenario, outputIds);

  test('solves optimally', () => assertSolvesOptimally(result));

  test('request includes passenger transport and electricity', () => {
    const outputsInRequest = new Set(request.rows.map((r) => r.outputId));
    assert.ok(outputsInRequest.has('passenger_road_transport'), 'should include passenger transport');
    assert.ok(outputsInRequest.has('electricity'), 'should auto-include electricity');
  });

  test('electricity is externalized', () => assertElectricityExternalized(result));

  test('BEV is the active state', () => {
    const activeShares = result.reporting.stateShares.filter((s) => s.activity > 1e-6);
    for (const year of CONFIGURATION_YEARS) {
      const matches = activeShares.filter(
        (s) => s.outputId === 'passenger_road_transport' && s.year === year,
      );
      assert.equal(matches.length, 1);
      assert.equal(matches[0].stateId, 'road_transport__passenger_road__bev');
    }
  });
});

describe('industrial heat only (fossil, no electricity dependency)', () => {
  const outputIds = ['low_temperature_heat', 'medium_temperature_heat', 'high_temperature_heat'];
  const pinnedMap = {
    low_temperature_heat: INCUMBENT_STATE_IDS.low_temperature_heat,
    medium_temperature_heat: INCUMBENT_STATE_IDS.medium_temperature_heat,
    high_temperature_heat: INCUMBENT_STATE_IDS.high_temperature_heat,
  };
  const serviceControls = buildServiceControls(outputIds);
  const scenario = buildScenario(pkg.appConfig, {
    name: 'Industrial heat only (fossil)',
    serviceControls,
    solverOptions: DEFAULT_SOLVER_OPTIONS,
  });
  const { request, result } = solveScoped(pkg, scenario, outputIds);

  test('solves optimally', () => assertSolvesOptimally(result));

  test('request contains only heat outputs', () => {
    assertRequestContainsOnlyOutputs(request, outputIds);
  });

  test('electricity is absent (fossil heat has no electricity inputs)', () => {
    assertElectricityAbsent(request);
  });

  test('pinned states match', () => assertPinnedStatesMatch(result, pinnedMap, CONFIGURATION_YEARS));
});

describe('industrial heat electrified (auto-includes electricity)', () => {
  const outputIds = ['low_temperature_heat', 'medium_temperature_heat', 'high_temperature_heat'];
  const serviceControls = buildServiceControls([], {
    electricity: { mode: 'externalized' },
    additional: {
      low_temperature_heat: {
        mode: 'pinned_single',
        state_id: 'generic_industrial_heat__low_temperature_heat__electrified',
      },
      medium_temperature_heat: {
        mode: 'pinned_single',
        state_id: 'generic_industrial_heat__medium_temperature_heat__electrified',
      },
      high_temperature_heat: {
        mode: 'pinned_single',
        state_id: 'generic_industrial_heat__high_temperature_heat__electrified',
      },
    },
  });
  const scenario = buildScenario(pkg.appConfig, {
    name: 'Industrial heat electrified',
    serviceControls,
    solverOptions: DEFAULT_SOLVER_OPTIONS,
  });
  const { request, result } = solveScoped(pkg, scenario, outputIds);

  test('solves optimally', () => assertSolvesOptimally(result));

  test('request auto-includes electricity', () => {
    const outputsInRequest = new Set(request.rows.map((r) => r.outputId));
    assert.ok(outputsInRequest.has('electricity'), 'should auto-include electricity');
  });

  test('electricity is externalized', () => assertElectricityExternalized(result));
});

describe('freight transport only (diesel incumbent, no electricity)', () => {
  const outputIds = ['freight_road_transport'];
  const pinnedMap = { freight_road_transport: INCUMBENT_STATE_IDS.freight_road_transport };
  const serviceControls = buildServiceControls(outputIds);
  const scenario = buildScenario(pkg.appConfig, {
    name: 'Freight transport only (diesel)',
    serviceControls,
    solverOptions: DEFAULT_SOLVER_OPTIONS,
  });
  const { request, result } = solveScoped(pkg, scenario, outputIds);

  test('solves optimally', () => assertSolvesOptimally(result));

  test('electricity is absent (diesel has no electricity input)', () => {
    assertElectricityAbsent(request);
  });

  test('pinned state matches', () => assertPinnedStatesMatch(result, pinnedMap, CONFIGURATION_YEARS));
});

describe('full model subset (all required services + electricity externalized)', () => {
  const allRequiredOutputIds = Object.keys(INCUMBENT_STATE_IDS);
  const serviceControls = buildServiceControls(allRequiredOutputIds, {
    electricity: { mode: 'externalized' },
  });
  const scenario = buildScenario(pkg.appConfig, {
    name: 'Full model — all incumbents',
    serviceControls,
    solverOptions: DEFAULT_SOLVER_OPTIONS,
  });
  const { request, result } = solveScoped(pkg, scenario, allRequiredOutputIds);

  test('solves optimally', () => assertSolvesOptimally(result));

  test('all incumbent pinned states match', () => {
    assertPinnedStatesMatch(result, INCUMBENT_STATE_IDS, CONFIGURATION_YEARS);
  });

  test('electricity is externalized', () => assertElectricityExternalized(result));

  test('demand is met for all outputs', () => {
    const activeShares = result.reporting.stateShares.filter((s) => s.activity > 1e-6);
    for (const outputId of allRequiredOutputIds) {
      for (const year of CONFIGURATION_YEARS) {
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
});
