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
  test('matches the demo-buildings-efficiency run semantics', () => {
    const configuration = readJson('../src/configurations/demo-buildings-efficiency.json');
    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);
    const request = buildSolveRequest(pkg, configuration);

    assert.equal(
      statuses.residential_building_services.runParticipation,
      'active_pathways',
    );
    assert.equal(
      statuses.commercial_building_services.runParticipation,
      'active_pathways',
    );
    // Electricity has mode=optimize with all states active, so it's directly active
    assert.equal(
      statuses.electricity.runParticipation,
      'active_pathways',
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
    assert.ok(statuses.residential_building_services.activeStateCount > 0);
    assert.ok(statuses.commercial_building_services.activeStateCount > 0);
    assert.equal(statuses.electricity.isDisabled, false);
    assert.deepEqual(
      outputSetFromStatuses(statuses),
      outputSetFromRequest(request),
    );
  });

  test('marks outputs as disabled when no states are enabled', () => {
    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Passenger transport fully disabled',
      serviceControls: {
        passenger_road_transport: {
          mode: 'optimize',
          active_state_ids: [],
        },
      },
    });

    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);

    assert.deepEqual(statuses.passenger_road_transport.activeMethodIds, []);
    assert.equal(statuses.passenger_road_transport.activeStateCount, 0);
    assert.equal(statuses.passenger_road_transport.isDisabled, true);
    assert.equal(statuses.passenger_road_transport.controlMode, 'optimize');
    assert.equal(
      statuses.passenger_road_transport.demandParticipation,
      'excluded_from_run',
    );
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
    assert.equal(statuses.electricity.isDisabled, true);
    assert.equal(statuses.electricity.activeStateCount, 0);
    assert.equal(statuses.electricity.demandParticipation, 'not_applicable');
  });

  test('keeps active pathways distinct from all available pathways under active_state_ids controls', () => {
    const electricityMethodIds = Array.from(
      new Set(
        pkg.resolvedMethodYears
          .filter((row) => row.output_id === 'electricity')
          .map((row) => row.method_id),
      ),
    );

    assert.ok(electricityMethodIds.length >= 2, 'expected multiple electricity pathways');

    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Electricity active-state-ids status semantics',
      serviceControls: {
        electricity: {
          mode: 'optimize',
          active_state_ids: [electricityMethodIds[0]],
        },
      },
    });

    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);

    assert.equal(statuses.electricity.controlMode, 'optimize');
    assert.equal(statuses.electricity.isDisabled, false);
    assert.ok(statuses.electricity.activeMethodIds.includes(electricityMethodIds[0]));
    assert.ok(statuses.electricity.activeStateCount < electricityMethodIds.length);
  });

  test('keeps active pathways scoped to active_state_ids in status output', () => {
    const residentialMethodIds = Array.from(
      new Set(
        pkg.resolvedMethodYears
          .filter((row) => row.output_id === 'residential_building_services')
          .map((row) => row.method_id),
      ),
    );

    assert.ok(residentialMethodIds.length >= 2, 'expected multiple residential pathways');

    const [selectedMethodId, disabledMethodId] = residentialMethodIds;
    const activeIds = residentialMethodIds.filter((id) => id !== disabledMethodId);
    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Residential active-state-ids status semantics',
      serviceControls: {
        residential_building_services: {
          mode: 'optimize',
          active_state_ids: activeIds,
        },
      },
    });

    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);

    assert.equal(statuses.residential_building_services.controlMode, 'optimize');
    assert.equal(statuses.residential_building_services.isDisabled, false);
    assert.ok(
      statuses.residential_building_services.activeMethodIds.includes(selectedMethodId),
    );
    assert.ok(
      !statuses.residential_building_services.activeMethodIds.includes(disabledMethodId),
    );
    assert.equal(
      statuses.residential_building_services.activeStateCount,
      residentialMethodIds.length - 1,
    );
  });

  test('dependency expansion follows active pathways under one-hot exact-share controls', () => {
    const rows = [
      {
        rowId: 'service_electric::2030',
        outputId: 'service',
        outputRole: 'required_service',
        outputLabel: 'Service',
        year: 2030,
        methodId: 'service_electric',
        methodLabel: 'Service Electric',
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
        methodId: 'service_hydrogen',
        methodLabel: 'Service Hydrogen',
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
        methodId: 'electricity_supply',
        methodLabel: 'Electricity Supply',
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
        methodId: 'hydrogen_supply',
        methodLabel: 'Hydrogen Supply',
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
    const configuration = {
      service_controls: {
        service: {
          mode: 'optimize',
          active_state_ids: ['service_electric'],
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
            mode: 'optimize',
            activeMethodIds: ['service_electric'],
            targetValue: null,
          },
        },
        electricity: {
          2030: {
            mode: 'optimize',
            activeMethodIds: null,
            targetValue: null,
          },
        },
        hydrogen: {
          2030: {
            mode: 'optimize',
            activeMethodIds: null,
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
      configuration,
      resolvedConfiguration,
      appConfig,
    );

    assert.deepEqual(new Set(expandedOutputIds), new Set(['service', 'electricity']));
    assert.deepEqual(statuses.service.activeMethodIds, ['service_electric']);
    assert.equal(statuses.service.runParticipation, 'active_pathways');
    assert.equal(statuses.electricity.runParticipation, 'active_pathways');
    assert.equal(statuses.hydrogen.runParticipation, 'active_pathways');
  });

  test('buildSolveRequest scopes out disabled outputs instead of throwing', () => {
    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Passenger transport scoped out by empty active_state_ids',
      serviceControls: {
        passenger_road_transport: {
          mode: 'optimize',
          active_state_ids: [],
        },
      },
    });

    const request = buildSolveRequest(pkg, configuration);
    const outputIds = new Set(request.rows.map((row) => row.outputId));
    assert.ok(!outputIds.has('passenger_road_transport'), 'disabled output is excluded from the solve request');
  });

  test('default configuration produces a scoped run where active outputs participate', () => {
    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Default configuration status baseline',
    });

    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);

    assert.equal(statuses.residential_building_services.runParticipation, 'active_pathways');
    assert.equal(statuses.electricity.runParticipation, 'active_pathways');
    assert.equal(statuses.electricity.inRun, true);
  });
});
