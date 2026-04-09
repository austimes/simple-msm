import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { getRightSidebarStatusPresentation, RIGHT_SIDEBAR_STATUS_LEGEND } from '../src/components/workspace/rightSidebarStatus.ts';
import { deriveOutputRunStatusesForConfiguration } from '../src/solver/solveScope.ts';
import { buildScenario, loadPkg } from './solverTestUtils.mjs';

const pkg = loadPkg();

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

describe('getRightSidebarStatusPresentation', () => {
  test('distinguishes in-scope, dependency, and excluded outputs in buildings-only runs', () => {
    const scenario = readJson('../src/configurations/buildings-endogenous.json');
    const statuses = deriveOutputRunStatusesForConfiguration(pkg, scenario);

    const residential = getRightSidebarStatusPresentation(
      statuses.residential_building_services,
    );
    const electricity = getRightSidebarStatusPresentation(statuses.electricity);
    const passengerRoad = getRightSidebarStatusPresentation(
      statuses.passenger_road_transport,
    );

    assert.deepEqual(
      residential.badges.map((badge) => badge.label),
      ['in scope'],
    );
    assert.deepEqual(
      electricity.badges.map((badge) => badge.label),
      ['dependency'],
    );
    assert.deepEqual(
      passengerRoad.badges.map((badge) => badge.label),
      ['excluded'],
    );
    assert.match(electricity.detail, /depends on it/i);
    assert.match(passengerRoad.detail, /outside the current scoped run/i);
  });

  test('adds the disabled badge only when no states are enabled', () => {
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
    const passengerRoad = getRightSidebarStatusPresentation(
      statuses.passenger_road_transport,
    );
    const electricity = getRightSidebarStatusPresentation(statuses.electricity);

    assert.deepEqual(
      passengerRoad.badges.map((badge) => badge.label),
      ['full model', 'disabled'],
    );
    assert.ok(
      passengerRoad.groupClassNames.includes('workspace-subsector-group--disabled'),
    );
    assert.deepEqual(
      electricity.badges.map((badge) => badge.label),
      ['full model'],
    );
  });

  test('documents the legend statuses shown in the sidebar', () => {
    assert.deepEqual(
      RIGHT_SIDEBAR_STATUS_LEGEND.map((item) => item.label),
      ['in scope', 'dependency', 'excluded', 'disabled'],
    );
  });
});
