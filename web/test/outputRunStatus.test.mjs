import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';
import {
  deriveOutputRunStatuses,
  deriveOutputRunStatusesForConfiguration,
  expandIncludedOutputsForDependencies,
} from '../src/solver/solveScope.ts';
import { buildConfiguration, loadPkg } from './solverTestUtils.mjs';

const pkg = loadPkg();

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

function outputSetFromStatuses(statuses) {
  return new Set(
    Object.values(statuses)
      .filter((status) => status.inRun)
      .map((status) => status.outputId),
  );
}

function outputSetFromRequest(request) {
  return new Set(request.rows.map((row) => row.outputId));
}

describe('deriveOutputRunStatusesForConfiguration', () => {
  test('matches the buildings-endogenous seed-scope and effective-run semantics', () => {
    const configuration = readJson('../src/configurations/buildings-endogenous.json');
    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);
    const request = buildSolveRequest(pkg, configuration);

    assert.equal(
      statuses.residential_building_services.runParticipation,
      'seed_scope',
    );
    assert.equal(
      statuses.commercial_building_services.runParticipation,
      'seed_scope',
    );
    assert.equal(
      statuses.electricity.runParticipation,
      'auto_included_dependency',
    );
    assert.equal(
      statuses.passenger_road_transport.runParticipation,
      'excluded_from_run',
    );
    assert.equal(statuses.electricity.controlMode, 'optimize');
    assert.equal(
      statuses.passenger_road_transport.demandParticipation,
      'excluded_from_run',
    );
    assert.equal(statuses.electricity.supplyParticipation, 'endogenous_in_run');
    assert.ok(statuses.residential_building_services.availableStateCount > 0);
    assert.ok(statuses.commercial_building_services.availableStateCount > 0);
    assert.equal(statuses.electricity.isDisabled, false);
    assert.deepEqual(
      outputSetFromStatuses(statuses),
      outputSetFromRequest(request),
    );
  });

  test('accepts legacy included_output_ids as an alias for seed_output_ids', () => {
    const configuration = readJson('../src/configurations/buildings-endogenous.json');
    const legacyConfiguration = structuredClone(configuration);
    legacyConfiguration.app_metadata = {
      ...legacyConfiguration.app_metadata,
      included_output_ids: legacyConfiguration.app_metadata.seed_output_ids,
    };
    delete legacyConfiguration.app_metadata.seed_output_ids;

    const canonicalStatuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);
    const legacyStatuses = deriveOutputRunStatusesForConfiguration(pkg, legacyConfiguration);
    const canonicalRequest = buildSolveRequest(pkg, configuration);
    const legacyRequest = buildSolveRequest(pkg, legacyConfiguration);

    assert.equal(
      legacyStatuses.residential_building_services.runParticipation,
      'seed_scope',
    );
    assert.equal(
      legacyStatuses.electricity.runParticipation,
      'auto_included_dependency',
    );
    assert.deepEqual(
      outputSetFromStatuses(legacyStatuses),
      outputSetFromStatuses(canonicalStatuses),
    );
    assert.deepEqual(
      outputSetFromRequest(legacyRequest),
      outputSetFromRequest(canonicalRequest),
    );
  });

  test('marks outputs as disabled when no states are enabled', () => {
    const allPassengerStateIds = Array.from(
      new Set(
        pkg.sectorStates
          .filter((row) => row.service_or_output_name === 'passenger_road_transport')
          .map((row) => row.state_id),
      ),
    );

    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Passenger transport fully disabled',
      serviceControls: {
        passenger_road_transport: {
          mode: 'optimize',
          disabled_state_ids: allPassengerStateIds,
        },
      },
    });

    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);

    assert.deepEqual(statuses.passenger_road_transport.availableStateIds, []);
    assert.equal(statuses.passenger_road_transport.availableStateCount, 0);
    assert.equal(statuses.passenger_road_transport.isDisabled, true);
    assert.equal(statuses.passenger_road_transport.controlMode, 'optimize');
    assert.equal(
      statuses.passenger_road_transport.demandParticipation,
      'no_enabled_pathways',
    );
    assert.equal(statuses.passenger_road_transport.hasPositiveDemandInRun, true);
    assert.equal(statuses.passenger_road_transport.hasDemandValidationError, true);
  });

  test('marks commodity outputs as externalized supply without reading as disabled', () => {
    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Buildings with externalized electricity',
      serviceControls: {
        electricity: { mode: 'externalized' },
      },
    });

    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);

    assert.equal(statuses.electricity.supplyParticipation, 'externalized_in_run');
    assert.equal(statuses.electricity.isDisabled, false);
    assert.ok(statuses.electricity.availableStateCount > 0);
    assert.equal(statuses.electricity.activeStateCount, 0);
    assert.equal(statuses.electricity.demandParticipation, 'not_applicable');
  });

  test('keeps enabled supply pathways distinct from fixed-share entries', () => {
    const electricityStateIds = Array.from(
      new Set(
        pkg.sectorStates
          .filter((row) => row.service_or_output_name === 'electricity')
          .map((row) => row.state_id),
      ),
    );

    assert.ok(electricityStateIds.length >= 2, 'expected multiple electricity pathways');

    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Electricity fixed-share status semantics',
      serviceControls: {
        electricity: {
          mode: 'fixed_shares',
          fixed_shares: { [electricityStateIds[0]]: 1 },
        },
      },
    });

    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);

    assert.equal(statuses.electricity.controlMode, 'fixed_shares');
    assert.equal(statuses.electricity.isDisabled, false);
    assert.equal(statuses.electricity.availableStateCount, electricityStateIds.length);
    assert.equal(statuses.electricity.activeStateCount, 1);
    assert.equal(statuses.electricity.capEligibleStateCount, electricityStateIds.length);
    assert.deepEqual(
      statuses.electricity.availableStateIds,
      statuses.electricity.capEligibleStateIds,
    );
  });

  test('keeps non-disabled pathways available in status output for one-hot exact-share controls', () => {
    const residentialStateIds = Array.from(
      new Set(
        pkg.sectorStates
          .filter((row) => row.service_or_output_name === 'residential_building_services')
          .map((row) => row.state_id),
      ),
    );

    assert.ok(residentialStateIds.length >= 2, 'expected multiple residential pathways');

    const [selectedStateId, disabledStateId] = residentialStateIds;
    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Residential one-hot exact-share status semantics',
      serviceControls: {
        residential_building_services: {
          mode: 'fixed_shares',
          fixed_shares: { [selectedStateId]: 1 },
          disabled_state_ids: [disabledStateId],
        },
      },
    });

    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);

    assert.equal(statuses.residential_building_services.controlMode, 'fixed_shares');
    assert.equal(statuses.residential_building_services.isDisabled, false);
    assert.deepEqual(
      statuses.residential_building_services.activeStateIds,
      [selectedStateId],
    );
    assert.ok(
      statuses.residential_building_services.availableStateIds.includes(selectedStateId),
    );
    assert.ok(
      !statuses.residential_building_services.availableStateIds.includes(disabledStateId),
    );
    assert.equal(
      statuses.residential_building_services.availableStateCount,
      residentialStateIds.length - 1,
    );
    assert.equal(statuses.residential_building_services.capEligibleStateCount, residentialStateIds.length - 1);
  });

  test('dependency expansion follows active pathways under one-hot exact-share controls', () => {
    const rows = [
      {
        rowId: 'service_electric::2030',
        outputId: 'service',
        outputRole: 'required_service',
        outputLabel: 'Service',
        year: 2030,
        stateId: 'service_electric',
        stateLabel: 'Service Electric',
        sector: 'test',
        subsector: 'test',
        region: 'national',
        outputUnit: 'PJ',
        conversionCostPerUnit: 1,
        inputs: [{ commodityId: 'electricity', coefficient: 1, unit: 'PJ' }],
        directEmissions: [],
        bounds: { minShare: null, maxShare: null, maxActivity: null },
      },
      {
        rowId: 'service_hydrogen::2030',
        outputId: 'service',
        outputRole: 'required_service',
        outputLabel: 'Service',
        year: 2030,
        stateId: 'service_hydrogen',
        stateLabel: 'Service Hydrogen',
        sector: 'test',
        subsector: 'test',
        region: 'national',
        outputUnit: 'PJ',
        conversionCostPerUnit: 2,
        inputs: [{ commodityId: 'hydrogen', coefficient: 1, unit: 'PJ' }],
        directEmissions: [],
        bounds: { minShare: null, maxShare: null, maxActivity: null },
      },
      {
        rowId: 'electricity_supply::2030',
        outputId: 'electricity',
        outputRole: 'endogenous_supply_commodity',
        outputLabel: 'Electricity',
        year: 2030,
        stateId: 'electricity_supply',
        stateLabel: 'Electricity Supply',
        sector: 'test',
        subsector: 'test',
        region: 'national',
        outputUnit: 'PJ',
        conversionCostPerUnit: 1,
        inputs: [],
        directEmissions: [],
        bounds: { minShare: null, maxShare: null, maxActivity: null },
      },
      {
        rowId: 'hydrogen_supply::2030',
        outputId: 'hydrogen',
        outputRole: 'endogenous_supply_commodity',
        outputLabel: 'Hydrogen',
        year: 2030,
        stateId: 'hydrogen_supply',
        stateLabel: 'Hydrogen Supply',
        sector: 'test',
        subsector: 'test',
        region: 'national',
        outputUnit: 'PJ',
        conversionCostPerUnit: 1,
        inputs: [],
        directEmissions: [],
        bounds: { minShare: null, maxShare: null, maxActivity: null },
      },
    ];
    const scenario = {
      service_controls: {
        service: {
          mode: 'fixed_shares',
          fixed_shares: { service_electric: 1 },
        },
      },
    };
    const resolvedConfiguration = {
      name: 'Exact-share dependency expansion',
      description: null,
      years: [2030],
      controlsByOutput: {
        service: {
          2030: {
            mode: 'fixed_shares',
            fixedShares: { service_electric: 1 },
            disabledStateIds: [],
            targetValue: null,
          },
        },
        electricity: {
          2030: {
            mode: 'optimize',
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
        hydrogen: {
          2030: {
            mode: 'optimize',
            fixedShares: null,
            disabledStateIds: [],
            targetValue: null,
          },
        },
      },
      serviceDemandByOutput: {
        service: { 2030: 100 },
      },
      externalCommodityDemandByCommodity: {},
      commodityPriceByCommodity: {},
      carbonPriceByYear: { 2030: 0 },
      options: {
        respectMaxShare: true,
        respectMaxActivity: true,
        softConstraints: false,
        allowRemovalsCredit: false,
        shareSmoothing: {
          enabled: false,
          maxDeltaPp: null,
        },
      },
    };
    const appConfig = {
      output_roles: {
        service: {
          output_role: 'required_service',
          display_label: 'Service',
          display_group: 'Test',
          display_group_order: 0,
          display_order: 0,
          participates_in_commodity_balance: false,
          demand_required: true,
          default_control_mode: 'optimize',
          allowed_control_modes: ['fixed_shares', 'optimize', 'off', 'target'],
          explanation_group: 'test',
        },
        electricity: {
          output_role: 'endogenous_supply_commodity',
          display_label: 'Electricity',
          display_group: 'Test',
          display_group_order: 0,
          display_order: 1,
          participates_in_commodity_balance: true,
          demand_required: false,
          default_control_mode: 'optimize',
          allowed_control_modes: ['fixed_shares', 'optimize', 'externalized'],
          explanation_group: 'test',
        },
        hydrogen: {
          output_role: 'endogenous_supply_commodity',
          display_label: 'Hydrogen',
          display_group: 'Test',
          display_group_order: 0,
          display_order: 2,
          participates_in_commodity_balance: true,
          demand_required: false,
          default_control_mode: 'optimize',
          allowed_control_modes: ['fixed_shares', 'optimize', 'externalized'],
          explanation_group: 'test',
        },
      },
    };

    const expandedOutputIds = expandIncludedOutputsForDependencies(
      rows,
      resolvedConfiguration,
      appConfig,
      new Set(['service']),
    );
    const statuses = deriveOutputRunStatuses(
      rows,
      scenario,
      resolvedConfiguration,
      appConfig,
      ['service'],
    );

    assert.deepEqual(new Set(expandedOutputIds), new Set(['service', 'electricity']));
    assert.deepEqual(statuses.service.activeStateIds, ['service_electric']);
    assert.equal(statuses.electricity.runParticipation, 'auto_included_dependency');
    assert.equal(statuses.hydrogen.runParticipation, 'excluded_from_run');
  });

  test('buildSolveRequest blocks positive required-service demand with no available pathways', () => {
    const allPassengerStateIds = Array.from(
      new Set(
        pkg.sectorStates
          .filter((row) => row.service_or_output_name === 'passenger_road_transport')
          .map((row) => row.state_id),
      ),
    );

    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Passenger transport blocked by disabled pathways',
      serviceControls: {
        passenger_road_transport: {
          mode: 'optimize',
          disabled_state_ids: allPassengerStateIds,
        },
      },
    });

    assert.throws(() => buildSolveRequest(pkg, configuration), /no available pathways: passenger_road_transport/i);
  });

  test('buildSolveRequest rejects malformed exact-share controls before solving', () => {
    const residentialStateIds = Array.from(
      new Set(
        pkg.sectorStates
          .filter((row) => row.service_or_output_name === 'residential_building_services')
          .map((row) => row.state_id),
      ),
    );

    assert.ok(residentialStateIds.length >= 1, 'expected at least one residential pathway');

    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Malformed residential exact-share control',
      serviceControls: {
        residential_building_services: {
          mode: 'fixed_shares',
          fixed_shares: {
            [residentialStateIds[0]]: 0.6,
            unknown_exact_share_state: 0.1,
          },
        },
      },
    });

    assert.throws(
      () => buildSolveRequest(pkg, configuration),
      /exact-share controls are malformed[\s\S]*unknown_exact_share_state[\s\S]*sum to 0\.700000 instead of 1/i,
    );
  });

  test('marks unscoped configurations as full-model runs', () => {
    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Full model status baseline',
    });

    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);

    assert.equal(statuses.electricity.runParticipation, 'full_model');
    assert.equal(statuses.residential_building_services.runParticipation, 'full_model');
    assert.equal(statuses.electricity.isFullModel, true);
    assert.equal(statuses.electricity.inRun, true);
  });
});
