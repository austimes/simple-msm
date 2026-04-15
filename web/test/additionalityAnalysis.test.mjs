import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  applyAdditionalityAtom,
  deriveAdditionalityAtoms,
  runAdditionalityAnalysis,
  validateAdditionalityPair,
} from '../src/additionality/additionalityAnalysis.ts';
import { resolveConfigurationDocument } from '../src/data/demandResolution.ts';
import { SOLVER_CONTRACT_VERSION } from '../src/solver/contract.ts';
import { solveWithLpAdapter } from '../src/solver/lpAdapter.ts';
import { loadPkg } from './solverTestUtils.mjs';

const pkg = loadPkg();

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

function clone(value) {
  return structuredClone(value);
}

function assertClose(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: expected ${expected}, got ${actual}`);
}

function assertFiniteMetrics(snapshot) {
  assert.equal(Number.isFinite(snapshot.objective), true);
  assert.equal(Number.isFinite(snapshot.cumulativeEmissions), true);
  assert.equal(Number.isFinite(snapshot.electricityDemand2050), true);
}

function assertConsistentDelta(entry) {
  assertClose(
    entry.metricsDeltaFromCurrent.objective,
    entry.metricsAfter.objective - entry.metricsBefore.objective,
    'objective delta stays internally consistent',
  );
  assertClose(
    entry.metricsDeltaFromCurrent.cumulativeEmissions,
    entry.metricsAfter.cumulativeEmissions - entry.metricsBefore.cumulativeEmissions,
    'emissions delta stays internally consistent',
  );
  assertClose(
    entry.metricsDeltaFromCurrent.electricityDemand2050,
    entry.metricsAfter.electricityDemand2050 - entry.metricsBefore.electricityDemand2050,
    '2050 electricity demand delta stays internally consistent',
  );
}

function buildBaseCase() {
  return resolveConfigurationDocument(
    readJson('../src/configurations/reference-base.json'),
    pkg.appConfig,
    'reference-base',
  );
}

function buildFullMonty() {
  return resolveConfigurationDocument(
    readJson('../src/configurations/reference-all.json'),
    pkg.appConfig,
    'reference-all',
  );
}

function buildSolvedResult(request, objectiveValue) {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: request.requestId,
    status: 'solved',
    engine: {
      name: 'yalps',
      worker: true,
    },
    summary: {
      rowCount: request.rows.length,
      yearCount: request.configuration.years.length,
      outputCount: Object.keys(request.configuration.controlsByOutput).length,
      serviceDemandOutputCount: Object.keys(request.configuration.serviceDemandByOutput).length,
      externalCommodityCount: Object.keys(request.configuration.externalCommodityDemandByCommodity).length,
    },
    reporting: {
      commodityBalances: [],
      stateShares: [],
      bindingConstraints: [],
      softConstraintViolations: [],
    },
    raw: {
      kind: 'configuration_lp',
      objectiveDirection: 'minimize',
      objectiveKey: 'configuration_cost',
      variableCount: request.rows.length,
      constraintCount: request.rows.length,
      notes: [],
      solutionStatus: 'optimal',
      objectiveValue,
      variables: request.rows.map((row) => ({
        id: `activity:${row.rowId}`,
        value: 1,
      })),
    },
    diagnostics: [],
    timingsMs: {
      total: 0,
      solve: 0,
    },
  };
}

function buildErroredResult(request, message) {
  return {
    contractVersion: SOLVER_CONTRACT_VERSION,
    requestId: request.requestId,
    status: 'error',
    engine: {
      name: 'yalps',
      worker: true,
    },
    summary: {
      rowCount: request.rows.length,
      yearCount: request.configuration.years.length,
      outputCount: Object.keys(request.configuration.controlsByOutput).length,
      serviceDemandOutputCount: Object.keys(request.configuration.serviceDemandByOutput).length,
      externalCommodityCount: Object.keys(request.configuration.externalCommodityDemandByCommodity).length,
    },
    reporting: {
      commodityBalances: [],
      stateShares: [],
      bindingConstraints: [],
      softConstraintViolations: [],
    },
    raw: {
      kind: 'configuration_lp',
      objectiveDirection: 'minimize',
      objectiveKey: 'configuration_cost',
      variableCount: request.rows.length,
      constraintCount: request.rows.length,
      notes: [],
      solutionStatus: 'infeasible',
      objectiveValue: null,
      variables: [],
    },
    diagnostics: [
      {
        code: 'forced_failure',
        severity: 'error',
        message,
      },
    ],
    timingsMs: {
      total: 0,
      solve: 0,
    },
  };
}

function hasActiveState(request, outputId, stateId) {
  const controlsByYear = request.configuration.controlsByOutput[outputId] ?? {};
  return Object.values(controlsByYear).some((control) => (control.activeStateIds ?? []).includes(stateId));
}

function findCommodityBalance(result, commodityId, year) {
  return result.reporting.commodityBalances.find((entry) => (
    entry.commodityId === commodityId && entry.year === year
  )) ?? null;
}

describe('additionality analysis', () => {
  test('derives the expected state-toggle atoms for reference-base vs reference-all', () => {
    const atoms = deriveAdditionalityAtoms(buildBaseCase(), buildFullMonty(), pkg);

    assert.equal(atoms.length, 24);
    assert.deepEqual(
      atoms.map((atom) => `${atom.outputLabel}|${atom.stateLabel}|${atom.action}`),
      [
        'Cement equivalent|Deep-abatement cement with CCS|enable',
        'Cement equivalent|Low-clinker and alternative-fuels cement|enable',
        'Commercial building services|Deep electrification and efficiency commercial services|enable',
        'Commercial building services|Electrified efficient commercial services|enable',
        'Cropping and horticulture output bundle|Mitigated cropping and horticulture bundle|enable',
        'Crude steel|CCS-influenced BF-BOF steel|enable',
        'Crude steel|Hydrogen DRI-electric steel|enable',
        'Crude steel|Scrap EAF steel|enable',
        'Electricity supply|Deep-clean firmed grid supply|enable',
        'Electricity supply|Policy frontier grid supply|enable',
        'Freight road transport|Battery-electric road freight|enable',
        'Freight road transport|Efficient diesel road freight|enable',
        'Freight road transport|Hydrogen fuel-cell road freight|enable',
        'High-temperature heat|High-temperature electrified heat|enable',
        'High-temperature heat|High-temperature low-carbon fuels|enable',
        'Livestock output bundle|Mitigated livestock output bundle|enable',
        'Low-temperature heat|Low-temperature electrified heat|enable',
        'Low-temperature heat|Low-temperature low-carbon fuels|enable',
        'Medium-temperature heat|Medium-temperature electrified heat|enable',
        'Medium-temperature heat|Medium-temperature low-carbon fuels|enable',
        'Passenger road transport|Battery-electric passenger road fleet|enable',
        'Passenger road transport|Hybrid-heavy passenger road fleet|enable',
        'Residential building services|Deep-electric residential services|enable',
        'Residential building services|Electrified efficient residential services|enable',
      ],
    );
  });

  test('validation rejects mode differences', () => {
    const base = buildBaseCase();
    const target = buildBaseCase();
    target.service_controls.electricity.mode = 'externalized';

    const issues = validateAdditionalityPair(base, target, pkg);

    assert.ok(issues.some((issue) => issue.code === 'service_control_mode_mismatch'));
  });

  test('validation rejects target_value differences', () => {
    const base = buildBaseCase();
    const target = buildBaseCase();
    target.service_controls.passenger_road_transport.target_value = 123;

    const issues = validateAdditionalityPair(base, target, pkg);

    assert.ok(issues.some((issue) => issue.code === 'service_control_target_value_mismatch'));
  });

  test('validation rejects year override differences', () => {
    const base = buildBaseCase();
    const target = buildBaseCase();
    target.service_controls.passenger_road_transport.year_overrides = {
      2030: {
        active_state_ids: ['road_transport__passenger_road__bev'],
      },
    };

    const issues = validateAdditionalityPair(base, target, pkg);

    assert.ok(issues.some((issue) => issue.code === 'service_control_year_overrides_mismatch'));
  });

  test('validation rejects demand differences', () => {
    const base = buildBaseCase();
    const target = buildBaseCase();
    target.service_demands.passenger_road_transport['2050'] += 1;

    const issues = validateAdditionalityPair(base, target, pkg);

    assert.ok(issues.some((issue) => issue.code === 'service_demands_mismatch'));
  });

  test('validation rejects carbon-price differences', () => {
    const base = buildBaseCase();
    const target = buildBaseCase();
    target.carbon_price['2050'] += 5;

    const issues = validateAdditionalityPair(base, target, pkg);

    assert.ok(issues.some((issue) => issue.code === 'carbon_price_mismatch'));
  });

  test('validation rejects solver-option differences', () => {
    const base = buildBaseCase();
    const target = buildBaseCase();
    target.solver_options = clone(target.solver_options);
    target.solver_options.soft_constraints = true;

    const issues = validateAdditionalityPair(base, target, pkg);

    assert.ok(issues.some((issue) => issue.code === 'solver_options_mismatch'));
  });

  test('applying atoms updates active_state_ids and collapses fully active outputs to null', () => {
    const base = buildBaseCase();
    const first = applyAdditionalityAtom(
      base,
      {
        key: 'residential-1',
        outputId: 'residential_building_services',
        outputLabel: 'Residential building services',
        stateId: 'buildings__residential__electrified_efficiency',
        stateLabel: 'Electrified efficient residential services',
        action: 'enable',
      },
      pkg,
    );

    assert.deepEqual(first.service_controls.residential_building_services.active_state_ids, [
      'buildings__residential__incumbent_mixed_fuels',
      'buildings__residential__electrified_efficiency',
    ]);

    const second = applyAdditionalityAtom(
      first,
      {
        key: 'residential-2',
        outputId: 'residential_building_services',
        outputLabel: 'Residential building services',
        stateId: 'buildings__residential__deep_electric',
        stateLabel: 'Deep-electric residential services',
        action: 'enable',
      },
      pkg,
    );

    assert.equal(second.service_controls.residential_building_services.active_state_ids, null);
  });

  test('greedy analysis reaches the target objective after all selected atoms are applied', async () => {
    const analysis = await runAdditionalityAnalysis(
      {
        baseConfiguration: buildBaseCase(),
        baseConfigId: 'reference-base',
        commoditySelections: {},
        pkg,
        targetConfiguration: buildFullMonty(),
        targetConfigId: 'reference-all',
      },
      {
        solve: async (request) => solveWithLpAdapter(request),
      },
    );

    assert.equal(analysis.phase, 'success');
    assert.ok(analysis.report);
    assertFiniteMetrics(analysis.report.baseMetrics);
    assertFiniteMetrics(analysis.report.targetMetrics);
    assert.equal(analysis.report.sequence.length, analysis.report.atomCount);
    for (const entry of analysis.report.sequence) {
      assertFiniteMetrics(entry.metricsBefore);
      assertFiniteMetrics(entry.metricsAfter);
      assertFiniteMetrics(entry.metricsDeltaFromCurrent);
      assertConsistentDelta(entry);
    }
    assertClose(
      analysis.report.sequence[analysis.report.sequence.length - 1].metricsAfter.objective,
      analysis.report.targetMetrics.objective,
      'final greedy objective reaches the target objective',
    );
  });

  test('keeps 2050 electricity demand in raw MWh aligned with solver reporting totalDemand', async () => {
    const solveCalls = [];
    const analysis = await runAdditionalityAnalysis(
      {
        baseConfiguration: buildBaseCase(),
        baseConfigId: 'reference-base',
        commoditySelections: {},
        pkg,
        targetConfiguration: buildFullMonty(),
        targetConfigId: 'reference-all',
      },
      {
        solve: async (request) => {
          const result = await solveWithLpAdapter(request);
          solveCalls.push({ request, result });
          return result;
        },
      },
    );

    assert.equal(analysis.phase, 'success');
    assert.ok(analysis.report);
    assert.ok(solveCalls.length >= 2);

    const baseElectricity2050 = findCommodityBalance(solveCalls[0].result, 'electricity', 2050);
    const targetElectricity2050 = findCommodityBalance(solveCalls[1].result, 'electricity', 2050);

    assert.ok(baseElectricity2050);
    assert.ok(targetElectricity2050);
    assertClose(
      analysis.report.baseMetrics.electricityDemand2050,
      baseElectricity2050.totalDemand,
      'base 2050 electricity demand stays in raw MWh and matches solver reporting',
    );
    assertClose(
      analysis.report.targetMetrics.electricityDemand2050,
      targetElectricity2050.totalDemand,
      'target 2050 electricity demand stays in raw MWh and matches solver reporting',
    );
  });

  test('records skipped intermediate candidates and continues when other candidates remain solvable', async () => {
    const analysis = await runAdditionalityAnalysis(
      {
        baseConfiguration: buildBaseCase(),
        baseConfigId: 'reference-base',
        commoditySelections: {},
        pkg,
        targetConfiguration: buildFullMonty(),
        targetConfigId: 'reference-all',
      },
      {
        solve: async (request) => {
          const commercialDeepElectricOn = hasActiveState(
            request,
            'commercial_building_services',
            'buildings__commercial__deep_electric',
          );
          const commercialEfficiencyOn = hasActiveState(
            request,
            'commercial_building_services',
            'buildings__commercial__electrified_efficiency',
          );

          if (commercialDeepElectricOn && !commercialEfficiencyOn) {
            return buildErroredResult(
              request,
              'Forced candidate failure while deep-electric commercial services are enabled without the efficient commercial pathway.',
            );
          }

          const score = [
            ['cement_equivalent', 'cement_clinker__cement_equivalent__ccs_deep', 5],
            ['cement_equivalent', 'cement_clinker__cement_equivalent__low_clinker_alt_fuels', 4],
            ['commercial_building_services', 'buildings__commercial__deep_electric', 1],
            ['commercial_building_services', 'buildings__commercial__electrified_efficiency', 4],
            ['cropping_horticulture_output_bundle', 'agriculture__cropping_horticulture__mitigated', 4],
            ['crude_steel', 'steel__crude_steel__bf_bof_ccs_transition', 6],
            ['crude_steel', 'steel__crude_steel__h2_dri_electric', 9],
            ['crude_steel', 'steel__crude_steel__scrap_eaf', 7],
            ['electricity', 'electricity__grid_supply__deep_clean_firmed', 8],
            ['electricity', 'electricity__grid_supply__policy_frontier', 7],
            ['freight_road_transport', 'road_transport__freight_road__bev', 6],
            ['freight_road_transport', 'road_transport__freight_road__efficient_diesel', 3],
            ['freight_road_transport', 'road_transport__freight_road__fcev_h2', 5],
            ['high_temperature_heat', 'generic_industrial_heat__high_temperature_heat__electrified', 7],
            ['high_temperature_heat', 'generic_industrial_heat__high_temperature_heat__low_carbon_fuels', 4],
            ['livestock_output_bundle', 'agriculture__livestock__mitigated', 3],
            ['low_temperature_heat', 'generic_industrial_heat__low_temperature_heat__electrified', 8],
            ['low_temperature_heat', 'generic_industrial_heat__low_temperature_heat__low_carbon_fuels', 4],
            ['medium_temperature_heat', 'generic_industrial_heat__medium_temperature_heat__electrified', 3],
            ['medium_temperature_heat', 'generic_industrial_heat__medium_temperature_heat__low_carbon_fuels', 2],
            ['passenger_road_transport', 'road_transport__passenger_road__bev', 10],
            ['passenger_road_transport', 'road_transport__passenger_road__hybrid_transition', 3],
            ['residential_building_services', 'buildings__residential__deep_electric', 1],
            ['residential_building_services', 'buildings__residential__electrified_efficiency', 2],
          ].reduce((sum, [outputId, stateId, weight]) => (
            sum + (hasActiveState(request, outputId, stateId) ? weight : 0)
          ), 100);

          return buildSolvedResult(request, score);
        },
      },
    );

    assert.equal(analysis.phase, 'success');
    assert.ok(analysis.report);
    assert.ok(analysis.report.skippedCandidates.length >= 1);
    assert.ok(analysis.report.sequence.some((entry) => entry.skippedCandidateCount >= 1));
    for (const entry of analysis.report.sequence) {
      assertFiniteMetrics(entry.metricsBefore);
      assertFiniteMetrics(entry.metricsAfter);
      assertFiniteMetrics(entry.metricsDeltaFromCurrent);
      assertConsistentDelta(entry);
    }
  });
});
