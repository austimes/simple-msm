import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';
import {
  deriveOutputRunStatusesForConfiguration,
} from '../src/solver/solveScope.ts';
import { buildScenario, loadPkg } from './solverTestUtils.mjs';

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
  test('matches the buildings-endogenous scoped solve semantics', () => {
    const scenario = readJson('../src/configurations/buildings-endogenous.json');
    const statuses = deriveOutputRunStatusesForConfiguration(pkg, scenario);
    const request = buildSolveRequest(pkg, scenario);

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
    assert.ok(statuses.residential_building_services.enabledStateCount > 0);
    assert.ok(statuses.commercial_building_services.enabledStateCount > 0);
    assert.equal(statuses.electricity.isDisabled, false);
    assert.deepEqual(
      outputSetFromStatuses(statuses),
      outputSetFromRequest(request),
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

    const scenario = buildScenario(pkg.appConfig, {
      name: 'Passenger transport fully disabled',
      serviceControls: {
        passenger_road_transport: {
          mode: 'optimize',
          disabled_state_ids: allPassengerStateIds,
        },
      },
    });

    const statuses = deriveOutputRunStatusesForConfiguration(pkg, scenario);

    assert.deepEqual(statuses.passenger_road_transport.enabledStateIds, []);
    assert.equal(statuses.passenger_road_transport.enabledStateCount, 0);
    assert.equal(statuses.passenger_road_transport.isDisabled, true);
    assert.equal(statuses.passenger_road_transport.controlMode, 'optimize');
    assert.equal(
      statuses.passenger_road_transport.demandParticipation,
      'active_in_run',
    );
  });

  test('marks unscoped scenarios as full-model runs', () => {
    const scenario = buildScenario(pkg.appConfig, {
      name: 'Full model status baseline',
    });

    const statuses = deriveOutputRunStatusesForConfiguration(pkg, scenario);

    assert.equal(statuses.electricity.runParticipation, 'full_model');
    assert.equal(statuses.residential_building_services.runParticipation, 'full_model');
    assert.equal(statuses.electricity.isFullModel, true);
    assert.equal(statuses.electricity.inRun, true);
  });
});
