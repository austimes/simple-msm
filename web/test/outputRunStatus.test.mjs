import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';
import {
  deriveOutputRunStatusesForConfiguration,
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
    assert.ok(statuses.residential_building_services.enabledStateCount > 0);
    assert.ok(statuses.commercial_building_services.enabledStateCount > 0);
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

    assert.deepEqual(statuses.passenger_road_transport.enabledStateIds, []);
    assert.equal(statuses.passenger_road_transport.enabledStateCount, 0);
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
    assert.equal(statuses.electricity.enabledStateCount, electricityStateIds.length);
  });

  test('keeps non-disabled pathways enabled in status output for pinned-single controls', () => {
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
      name: 'Residential pinned-single status semantics',
      serviceControls: {
        residential_building_services: {
          mode: 'pinned_single',
          state_id: selectedStateId,
          disabled_state_ids: [disabledStateId],
        },
      },
    });

    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);

    assert.equal(statuses.residential_building_services.controlMode, 'pinned_single');
    assert.equal(statuses.residential_building_services.isDisabled, false);
    assert.ok(
      statuses.residential_building_services.enabledStateIds.includes(selectedStateId),
    );
    assert.ok(
      !statuses.residential_building_services.enabledStateIds.includes(disabledStateId),
    );
    assert.equal(
      statuses.residential_building_services.enabledStateCount,
      residentialStateIds.length - 1,
    );
  });

  test('buildSolveRequest blocks positive required-service demand with no enabled pathways', () => {
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

    assert.throws(
      () => buildSolveRequest(pkg, configuration),
      /passenger_road_transport/,
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
