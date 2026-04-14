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

function buildBaseCase() {
  const reference = readJson('../src/configurations/reference.json');
  const configuration = resolveConfigurationDocument(
    {
      ...reference,
      name: 'The Base Case',
      app_metadata: {
        id: 'the-base-case',
      },
    },
    pkg.appConfig,
    'the-base-case',
  );

  return configuration;
}

function buildFullMonty() {
  const configuration = buildBaseCase();
  configuration.name = 'The Full Monty';
  configuration.description = 'Adds one decarbonized pathway option per major output while keeping all non-state settings fixed.';
  configuration.app_metadata = {
    id: 'the-full-monty',
  };
  configuration.service_controls.residential_building_services.active_state_ids = [
    'buildings__residential__incumbent_mixed_fuels',
    'buildings__residential__electrified_efficiency',
  ];
  configuration.service_controls.commercial_building_services.active_state_ids = [
    'buildings__commercial__incumbent_mixed_fuels',
    'buildings__commercial__electrified_efficiency',
  ];
  configuration.service_controls.passenger_road_transport.active_state_ids = [
    'road_transport__passenger_road__ice_fleet',
    'road_transport__passenger_road__bev',
  ];
  configuration.service_controls.freight_road_transport.active_state_ids = [
    'road_transport__freight_road__diesel',
    'road_transport__freight_road__bev',
  ];
  configuration.service_controls.low_temperature_heat.active_state_ids = [
    'generic_industrial_heat__low_temperature_heat__fossil',
    'generic_industrial_heat__low_temperature_heat__electrified',
  ];
  configuration.service_controls.medium_temperature_heat.active_state_ids = [
    'generic_industrial_heat__medium_temperature_heat__fossil',
    'generic_industrial_heat__medium_temperature_heat__electrified',
  ];
  configuration.service_controls.high_temperature_heat.active_state_ids = [
    'generic_industrial_heat__high_temperature_heat__fossil',
    'generic_industrial_heat__high_temperature_heat__electrified',
  ];
  configuration.service_controls.land_sequestration.active_state_ids = [
    'removals_negative_emissions__land_sequestration__biological_sink',
  ];
  configuration.service_controls.engineered_removals.active_state_ids = [
    'removals_negative_emissions__engineered_removals__daccs',
  ];

  return resolveConfigurationDocument(configuration, pkg.appConfig, 'the-full-monty');
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
      variables: [],
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

describe('additionality analysis', () => {
  test('derives the expected state-toggle atoms for the-base-case vs the-full-monty', () => {
    const atoms = deriveAdditionalityAtoms(buildBaseCase(), buildFullMonty(), pkg);

    assert.equal(atoms.length, 9);
    assert.deepEqual(
      atoms.map((atom) => `${atom.outputLabel}|${atom.stateLabel}|${atom.action}`),
      [
        'Commercial building services|Electrified efficient commercial services|enable',
        'Engineered removals|Direct air capture with storage (DACCS)|enable',
        'Freight road transport|Battery-electric road freight|enable',
        'High-temperature heat|High-temperature electrified heat|enable',
        'Land sequestration|Biological land sequestration|enable',
        'Low-temperature heat|Low-temperature electrified heat|enable',
        'Medium-temperature heat|Medium-temperature electrified heat|enable',
        'Passenger road transport|Battery-electric passenger road fleet|enable',
        'Residential building services|Electrified efficient residential services|enable',
      ],
    );
  });

  test('validation rejects mode differences', () => {
    const base = buildBaseCase();
    const target = buildBaseCase();
    target.service_controls.electricity.mode = 'optimize';

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
        baseConfigId: 'the-base-case',
        commoditySelections: {},
        pkg,
        targetConfiguration: buildFullMonty(),
        targetConfigId: 'the-full-monty',
      },
      {
        solve: async (request) => solveWithLpAdapter(request),
      },
    );

    assert.equal(analysis.phase, 'success');
    assert.ok(analysis.report);
    assert.equal(analysis.report.sequence.length, analysis.report.atomCount);
    assert.ok(Math.abs(
      analysis.report.sequence[analysis.report.sequence.length - 1].objectiveAfter
      - analysis.report.targetObjective,
    ) < 1e-6);
  });

  test('records skipped intermediate candidates and continues when other candidates remain solvable', async () => {
    const analysis = await runAdditionalityAnalysis(
      {
        baseConfiguration: buildBaseCase(),
        baseConfigId: 'the-base-case',
        commoditySelections: {},
        pkg,
        targetConfiguration: buildFullMonty(),
        targetConfigId: 'the-full-monty',
      },
      {
        solve: async (request) => {
          const landOn = request.rows.some((row) => row.outputId === 'land_sequestration');
          const daccsOn = request.rows.some((row) => row.outputId === 'engineered_removals');

          if (landOn && !daccsOn) {
            return buildErroredResult(
              request,
              'Forced candidate failure while biological sequestration is enabled without DACCS.',
            );
          }

          const score = [
            ['commercial_building_services', 'buildings__commercial__electrified_efficiency', 4],
            ['engineered_removals', 'removals_negative_emissions__engineered_removals__daccs', 9],
            ['freight_road_transport', 'road_transport__freight_road__bev', 6],
            ['high_temperature_heat', 'generic_industrial_heat__high_temperature_heat__electrified', 7],
            ['land_sequestration', 'removals_negative_emissions__land_sequestration__biological_sink', 5],
            ['low_temperature_heat', 'generic_industrial_heat__low_temperature_heat__electrified', 8],
            ['medium_temperature_heat', 'generic_industrial_heat__medium_temperature_heat__electrified', 3],
            ['passenger_road_transport', 'road_transport__passenger_road__bev', 10],
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
  });
});
