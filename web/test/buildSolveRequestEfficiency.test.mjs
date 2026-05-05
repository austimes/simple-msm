import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolveConfigurationDocument } from '../src/data/demandResolution.ts';
import { buildSolverContributionRows } from '../src/results/resultContributions.ts';
import { runScenario } from '../src/results/runScenario.ts';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';
import { solveWithLpAdapter } from '../src/solver/lpAdapter.ts';

const OUTPUT_ID = 'residential_building_services';
const FAMILY_ID = 'residential_building_services';
const BASE_STATE_ID = 'residential_base';
const PACKAGE_ID = 'shell_retrofit';

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

function loadAppConfig() {
  return {
    output_roles: readJson('../public/app_config/output_roles.json'),
    baseline_activity_anchors: readJson('../public/app_config/baseline_activity_anchors.json'),
    demand_growth_presets: readJson('../public/app_config/demand_growth_presets.json'),
    commodity_price_presets: readJson('../public/app_config/commodity_price_presets.json'),
    carbon_price_presets: readJson('../public/app_config/carbon_price_presets.json'),
    explanation_tag_rules: readJson('../public/app_config/explanation_tag_rules.json'),
  };
}

function buildConfiguration(appConfig, overrides = {}) {
  const referenceConfiguration = readJson('../src/configurations/reference-baseline.json');
  return resolveConfigurationDocument(
    {
      ...referenceConfiguration,
      name: overrides.name ?? referenceConfiguration.name,
      description: overrides.description ?? referenceConfiguration.description,
      service_controls: {
        ...referenceConfiguration.service_controls,
        ...(overrides.serviceControls ?? {}),
      },
    },
    appConfig,
    overrides.name ?? 'test configuration',
  );
}

function makeResolvedMethodYearRow(year, overrides = {}) {
  const outputId = overrides.output_id ?? overrides.service_or_output_name ?? OUTPUT_ID;
  const methodId = overrides.method_id ?? overrides.state_id ?? BASE_STATE_ID;
  const roleId = overrides.role_id ?? outputId;
  const methodLabel = overrides.method_label ?? overrides.state_label ?? 'Residential base';
  return {
    role_id: roleId,
    representation_id: overrides.representation_id ?? `${roleId}__pathway_bundle`,
    method_id: methodId,
    method_label: methodLabel,
    method_description: overrides.method_description ?? methodLabel,
    representation_kind: overrides.representation_kind ?? 'pathway_bundle',
    balance_type: overrides.balance_type ?? 'service_demand',
    output_id: outputId,
    outputId,
    role_label: overrides.role_label ?? 'Residential building services',
    topology_area_id: overrides.topology_area_id ?? 'buildings',
    topology_area_label: overrides.topology_area_label ?? 'Buildings',
    parent_role_id: overrides.parent_role_id ?? null,
    reporting_allocations: overrides.reporting_allocations ?? [],
    family_id: FAMILY_ID,
    sector: 'buildings',
    subsector: 'residential',
    service_or_output_name: outputId,
    region: 'AUS',
    year,
    state_id: methodId,
    state_label: methodLabel,
    state_label_standardized: methodLabel,
    state_option_label: methodLabel,
    state_sort_key: '01_base',
    state_option_rank: 0,
    output_unit: 'GJ_service_eq',
    output_cost_per_unit: year === 2025 ? 10 : 11,
    cost_basis_year: 2024,
    currency: 'AUD_2024',
    input_commodities: ['natural_gas'],
    input_coefficients: [1],
    input_units: ['GJ/GJ_service_eq'],
    energy_emissions_by_pollutant: [{ pollutant: 'CO2e', value: 0.2 }],
    process_emissions_by_pollutant: [],
    min_share: null,
    max_share: null,
    max_activity: null,
    is_default_incumbent_2025: year === 2025,
    ...overrides,
  };
}

function makeAutonomousTrack(year, multiplier, deltaCost, overrides = {}) {
  const applicableMethodIds = overrides.applicable_method_ids ?? overrides.applicable_state_ids ?? [BASE_STATE_ID];
  return {
    role_id: overrides.role_id ?? overrides.family_id ?? OUTPUT_ID,
    family_id: FAMILY_ID,
    track_id: 'background_drift',
    year,
    track_label: 'Background drift',
    track_description: 'Applies a background efficiency improvement.',
    applicable_state_ids: applicableMethodIds,
    applicable_method_ids: applicableMethodIds,
    affected_input_commodities: ['natural_gas'],
    input_multipliers: [multiplier],
    delta_output_cost_per_unit: deltaCost,
    cost_basis_year: 2024,
    currency: 'AUD_2024',
    source_ids: ['S001'],
    assumption_ids: ['A001'],
    evidence_summary: 'Evidence summary',
    derivation_method: 'Derivation method',
    confidence_rating: 'Medium',
    double_counting_guardrail: 'Keep package effects separate from the background trend.',
    review_notes: 'Reviewed',
    ...overrides,
  };
}

function makeEfficiencyPackage(year, multiplier, deltaCost, overrides = {}) {
  const applicableMethodIds = overrides.applicable_method_ids ?? overrides.applicable_state_ids ?? [BASE_STATE_ID];
  return {
    role_id: overrides.role_id ?? overrides.family_id ?? OUTPUT_ID,
    family_id: FAMILY_ID,
    package_id: PACKAGE_ID,
    year,
    package_label: 'Shell retrofit',
    package_description: 'Adds a retrofit candidate row.',
    classification: 'pure_efficiency_overlay',
    applicable_state_ids: applicableMethodIds,
    applicable_method_ids: applicableMethodIds,
    affected_input_commodities: ['natural_gas'],
    input_multipliers: [multiplier],
    delta_output_cost_per_unit: deltaCost,
    cost_basis_year: 2024,
    currency: 'AUD_2024',
    max_share: 0.35,
    rollout_limit_notes: 'Retrofit supply chain constraint.',
    source_ids: ['S001'],
    assumption_ids: ['A001'],
    evidence_summary: 'Evidence summary',
    derivation_method: 'Derivation method',
    confidence_rating: 'Medium',
    review_notes: 'Reviewed',
    non_stacking_group: 'retrofit_group',
    ...overrides,
  };
}

test('buildSolveRequest materializes autonomous and package efficiency rows', () => {
  const appConfig = loadAppConfig();
  const configuration = {
    ...buildConfiguration(appConfig, {
      name: 'Efficiency request test',
      serviceControls: {
        [OUTPUT_ID]: {
          mode: 'optimize',
          active_state_ids: [BASE_STATE_ID],
        },
      },
    }),
    efficiency_controls: {
      autonomous_mode: 'baseline',
      package_mode: 'allow_list',
      package_ids: [PACKAGE_ID],
    },
  };

  const request = buildSolveRequest(
    {
      resolvedMethodYears: [makeResolvedMethodYearRow(2025), makeResolvedMethodYearRow(2030)],
      appConfig,
      autonomousEfficiencyTracks: [makeAutonomousTrack(2030, 0.9, -1)],
      efficiencyPackages: [
        makeEfficiencyPackage(2025, 0.95, 1),
        makeEfficiencyPackage(2030, 0.8, 2),
      ],
    },
    configuration,
  );

  const base2030 = request.rows.find((row) => row.rowId === `${BASE_STATE_ID}::2030`);
  assert.ok(base2030, 'expected the 2030 base row to be present');
  assert.equal(base2030.inputs[0].coefficient, 0.9);
  assert.equal(base2030.conversionCostPerUnit, 10);
  assert.ok(Math.abs(base2030.directEmissions[0].value - 0.18) < 1e-9);
  assert.equal(base2030.provenance?.kind, 'base_method');
  assert.deepEqual(base2030.provenance?.autonomousTrackIds, ['background_drift']);

  const package2030 = request.rows.find(
    (row) => row.provenance?.kind === 'efficiency_package' && row.year === 2030,
  );
  assert.ok(package2030, 'expected the 2030 package row to be present');
  assert.equal(package2030.methodId, `effpkg:${BASE_STATE_ID}::${PACKAGE_ID}`);
  assert.ok(Math.abs(package2030.inputs[0].coefficient - 0.72) < 1e-9);
  assert.equal(package2030.conversionCostPerUnit, 12);
  assert.ok(Math.abs(package2030.directEmissions[0].value - 0.144) < 1e-9);
  assert.equal(package2030.bounds.maxShare, 0.35);
  assert.equal(package2030.provenance?.baseMethodId, BASE_STATE_ID);
  assert.equal(package2030.provenance?.baseMethodLabel, 'Residential base');
  assert.equal(package2030.provenance?.packageId, PACKAGE_ID);
  assert.deepEqual(package2030.provenance?.autonomousTrackIds, ['background_drift']);
  assert.equal(package2030.provenance?.packageNonStackingGroup, 'retrofit_group');

  const control2025 = request.configuration.controlsByOutput[OUTPUT_ID]['2025'];
  const control2030 = request.configuration.controlsByOutput[OUTPUT_ID]['2030'];
  assert.deepEqual(control2025.activeMethodIds, [BASE_STATE_ID]);
  assert.deepEqual(
    control2030.activeMethodIds,
    [BASE_STATE_ID, `effpkg:${BASE_STATE_ID}::${PACKAGE_ID}`],
  );
});

test('per-output autonomous off removes only that output track family', () => {
  const appConfig = loadAppConfig();
  const commercialOutputId = 'commercial_building_services';
  const commercialMethodId = 'commercial_base';
  const configuration = {
    ...buildConfiguration(appConfig, {
      name: 'Per-output autonomous test',
      serviceControls: {
        [OUTPUT_ID]: {
          mode: 'optimize',
          active_state_ids: [BASE_STATE_ID],
        },
        [commercialOutputId]: {
          mode: 'optimize',
          active_state_ids: [commercialMethodId],
        },
      },
    }),
    efficiency_controls: {
      autonomous_mode: 'baseline',
      autonomous_modes_by_role: {
        [OUTPUT_ID]: 'off',
      },
      package_mode: 'off',
      package_ids: [],
    },
  };

  const request = buildSolveRequest(
    {
      resolvedMethodYears: [
        makeResolvedMethodYearRow(2030),
        makeResolvedMethodYearRow(2030, {
          family_id: commercialOutputId,
          service_or_output_name: commercialOutputId,
          state_id: commercialMethodId,
          state_label: 'Commercial base',
          state_label_standardized: 'Commercial base',
          state_option_label: 'Commercial base',
        }),
      ],
      appConfig,
      autonomousEfficiencyTracks: [
        makeAutonomousTrack(2030, 0.5, 0, {
          track_id: 'residential_track',
          family_id: OUTPUT_ID,
        }),
        makeAutonomousTrack(2030, 0.8, 0, {
          track_id: 'commercial_track',
          family_id: commercialOutputId,
          applicable_state_ids: [commercialMethodId],
        }),
      ],
      efficiencyPackages: [],
    },
    configuration,
  );

  const residentialRow = request.rows.find((row) => row.rowId === `${BASE_STATE_ID}::2030`);
  const commercialRow = request.rows.find((row) => row.rowId === `${commercialMethodId}::2030`);

  assert.deepEqual(request.configuration.efficiency?.autonomousModesByRole, {
    [OUTPUT_ID]: 'off',
  });
  assert.deepEqual(request.configuration.efficiency?.activeTrackIds, ['commercial_track']);
  assert.equal(residentialRow?.inputs[0].coefficient, 1);
  assert.deepEqual(residentialRow?.provenance?.autonomousTrackIds, []);
  assert.equal(commercialRow?.inputs[0].coefficient, 0.8);
  assert.deepEqual(commercialRow?.provenance?.autonomousTrackIds, ['commercial_track']);
});

test('solver reporting and contribution rows carry efficiency provenance', () => {
  const appConfig = loadAppConfig();
  const configuration = {
    ...buildConfiguration(appConfig, {
      name: 'Efficiency reporting test',
      serviceControls: {
        [OUTPUT_ID]: {
          mode: 'optimize',
          active_state_ids: [BASE_STATE_ID],
        },
      },
    }),
    efficiency_controls: {
      autonomous_mode: 'baseline',
      package_mode: 'allow_list',
      package_ids: [PACKAGE_ID],
    },
  };

  const request = buildSolveRequest(
    {
      resolvedMethodYears: [makeResolvedMethodYearRow(2025), makeResolvedMethodYearRow(2030)],
      appConfig,
      autonomousEfficiencyTracks: [makeAutonomousTrack(2030, 0.9, -1)],
      efficiencyPackages: [
        makeEfficiencyPackage(2030, 0.1, -5),
      ],
    },
    configuration,
  );
  const result = solveWithLpAdapter(request);

  assert.equal(result.status, 'solved');

  const packageMethodId = `effpkg:${BASE_STATE_ID}::${PACKAGE_ID}`;
  const packageShare = result.reporting.methodShares.find((share) => {
    return share.outputId === OUTPUT_ID && share.year === 2030 && share.methodId === packageMethodId;
  });

  assert.ok(packageShare, 'expected a reporting row for the package pathway');
  assert.equal(packageShare.rowId, `${packageMethodId}::2030`);
  assert.equal(packageShare.pathwayMethodId, BASE_STATE_ID);
  assert.equal(packageShare.pathwayMethodLabel, 'Residential base');
  assert.equal(packageShare.provenance?.kind, 'efficiency_package');
  assert.equal(packageShare.provenance?.packageId, PACKAGE_ID);
  assert.equal(packageShare.provenance?.packageClassification, 'pure_efficiency_overlay');
  assert.equal(packageShare.provenance?.packageNonStackingGroup, 'retrofit_group');
  assert.deepEqual(packageShare.provenance?.autonomousTrackIds, ['background_drift']);
  assert.ok((packageShare.activity ?? 0) > 0, 'expected the package pathway to be selected');

  const contributionRows = buildSolverContributionRows(request, result);
  const packageFuelContribution = contributionRows.find((row) => {
    return row.metric === 'fuel' && row.year === 2030 && row.sourceId === packageMethodId;
  });

  assert.ok(packageFuelContribution, 'expected a package fuel contribution row');
  assert.equal(packageFuelContribution.rowId, `${packageMethodId}::2030`);
  assert.equal(packageFuelContribution.pathwayMethodId, BASE_STATE_ID);
  assert.equal(packageFuelContribution.pathwayMethodLabel, 'Residential base');
  assert.equal(packageFuelContribution.provenance?.kind, 'efficiency_package');
  assert.equal(packageFuelContribution.provenance?.packageId, PACKAGE_ID);
  assert.equal(packageFuelContribution.provenance?.packageClassification, 'pure_efficiency_overlay');
  assert.equal(packageFuelContribution.provenance?.packageNonStackingGroup, 'retrofit_group');
  assert.deepEqual(packageFuelContribution.provenance?.autonomousTrackIds, ['background_drift']);
});

test('runScenario uses the shared solve path for package non-stacking enforcement', () => {
  const appConfig = loadAppConfig();
  const configuration = {
    ...buildConfiguration(appConfig, {
      name: 'Run scenario non-stacking test',
      serviceControls: {
        [OUTPUT_ID]: {
          mode: 'optimize',
          active_state_ids: [BASE_STATE_ID],
        },
      },
    }),
    efficiency_controls: {
      autonomous_mode: 'baseline',
      autonomous_modes_by_role: {},
      package_mode: 'allow_list',
      package_ids: ['shell_a', 'shell_b'],
    },
  };

  const snapshot = runScenario(
    {
      resolvedMethodYears: [makeResolvedMethodYearRow(2030)],
      appConfig,
      autonomousEfficiencyTracks: [],
      efficiencyPackages: [
        makeEfficiencyPackage(2030, 0.8, -8, {
          package_id: 'shell_a',
          max_share: 0.35,
          non_stacking_group: 'shell',
        }),
        makeEfficiencyPackage(2030, 0.75, -9, {
          package_id: 'shell_b',
          max_share: 0.35,
          non_stacking_group: 'shell',
        }),
      ],
      residualOverlays2025: [],
    },
    configuration,
    { includeOverlays: false },
  );
  const variables = new Map(snapshot.result.raw.variables.map((entry) => [entry.id, entry.value]));
  const demand = snapshot.request.configuration.serviceDemandByOutput[OUTPUT_ID]['2030'];
  const packageTotal = Array.from(variables.entries())
    .filter(([id]) => id.includes('effpkg:') && id.includes('shell_'))
    .reduce((total, [, value]) => total + value, 0);

  assert.equal(snapshot.result.status, 'solved');
  assert.ok(packageTotal <= demand * 0.35 + 1e-6);
});
