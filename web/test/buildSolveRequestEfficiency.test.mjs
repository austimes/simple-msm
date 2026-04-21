import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolveConfigurationDocument } from '../src/data/demandResolution.ts';
import { buildSolverContributionRows } from '../src/results/resultContributions.ts';
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

function makeSectorState(year, overrides = {}) {
  return {
    family_id: FAMILY_ID,
    sector: 'buildings',
    subsector: 'residential',
    service_or_output_name: OUTPUT_ID,
    region: 'AUS',
    year,
    state_id: BASE_STATE_ID,
    state_label: 'Residential base',
    state_label_standardized: 'Residential base',
    state_option_label: 'Residential base',
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

function makeAutonomousTrack(year, multiplier, deltaCost) {
  return {
    family_id: FAMILY_ID,
    track_id: 'background_drift',
    year,
    track_label: 'Background drift',
    track_description: 'Applies a background efficiency improvement.',
    applicable_state_ids: [BASE_STATE_ID],
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
  };
}

function makeEfficiencyPackage(year, multiplier, deltaCost) {
  return {
    family_id: FAMILY_ID,
    package_id: PACKAGE_ID,
    year,
    package_label: 'Shell retrofit',
    package_description: 'Adds a retrofit candidate row.',
    classification: 'pure_efficiency_overlay',
    applicable_state_ids: [BASE_STATE_ID],
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
      sectorStates: [makeSectorState(2025), makeSectorState(2030)],
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
  assert.equal(base2030.provenance?.kind, 'base_state');
  assert.deepEqual(base2030.provenance?.autonomousTrackIds, ['background_drift']);

  const package2030 = request.rows.find(
    (row) => row.provenance?.kind === 'efficiency_package' && row.year === 2030,
  );
  assert.ok(package2030, 'expected the 2030 package row to be present');
  assert.equal(package2030.stateId, `effpkg:${BASE_STATE_ID}::${PACKAGE_ID}`);
  assert.ok(Math.abs(package2030.inputs[0].coefficient - 0.72) < 1e-9);
  assert.equal(package2030.conversionCostPerUnit, 12);
  assert.ok(Math.abs(package2030.directEmissions[0].value - 0.144) < 1e-9);
  assert.equal(package2030.bounds.maxShare, 0.35);
  assert.equal(package2030.provenance?.baseStateId, BASE_STATE_ID);
  assert.equal(package2030.provenance?.baseStateLabel, 'Residential base');
  assert.equal(package2030.provenance?.packageId, PACKAGE_ID);
  assert.deepEqual(package2030.provenance?.autonomousTrackIds, ['background_drift']);

  const control2025 = request.configuration.controlsByOutput[OUTPUT_ID]['2025'];
  const control2030 = request.configuration.controlsByOutput[OUTPUT_ID]['2030'];
  assert.deepEqual(control2025.activeStateIds, [BASE_STATE_ID]);
  assert.deepEqual(
    control2030.activeStateIds,
    [BASE_STATE_ID, `effpkg:${BASE_STATE_ID}::${PACKAGE_ID}`],
  );
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
      sectorStates: [makeSectorState(2025), makeSectorState(2030)],
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

  const packageStateId = `effpkg:${BASE_STATE_ID}::${PACKAGE_ID}`;
  const packageShare = result.reporting.stateShares.find((share) => {
    return share.outputId === OUTPUT_ID && share.year === 2030 && share.stateId === packageStateId;
  });

  assert.ok(packageShare, 'expected a reporting row for the package pathway');
  assert.equal(packageShare.rowId, `${packageStateId}::2030`);
  assert.equal(packageShare.pathwayStateId, BASE_STATE_ID);
  assert.equal(packageShare.pathwayStateLabel, 'Residential base');
  assert.equal(packageShare.provenance?.kind, 'efficiency_package');
  assert.equal(packageShare.provenance?.packageId, PACKAGE_ID);
  assert.equal(packageShare.provenance?.packageClassification, 'pure_efficiency_overlay');
  assert.deepEqual(packageShare.provenance?.autonomousTrackIds, ['background_drift']);
  assert.ok((packageShare.activity ?? 0) > 0, 'expected the package pathway to be selected');

  const contributionRows = buildSolverContributionRows(request, result);
  const packageFuelContribution = contributionRows.find((row) => {
    return row.metric === 'fuel' && row.year === 2030 && row.sourceId === packageStateId;
  });

  assert.ok(packageFuelContribution, 'expected a package fuel contribution row');
  assert.equal(packageFuelContribution.rowId, `${packageStateId}::2030`);
  assert.equal(packageFuelContribution.pathwayStateId, BASE_STATE_ID);
  assert.equal(packageFuelContribution.pathwayStateLabel, 'Residential base');
  assert.equal(packageFuelContribution.provenance?.kind, 'efficiency_package');
  assert.equal(packageFuelContribution.provenance?.packageId, PACKAGE_ID);
  assert.equal(packageFuelContribution.provenance?.packageClassification, 'pure_efficiency_overlay');
  assert.deepEqual(packageFuelContribution.provenance?.autonomousTrackIds, ['background_drift']);
});
