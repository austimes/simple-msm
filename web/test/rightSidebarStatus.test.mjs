import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  getRightSidebarStatusPresentation,
  RIGHT_SIDEBAR_STATUS_LEGEND,
} from '../src/components/workspace/rightSidebarStatus.ts';
import { deriveOutputRunStatusesForConfiguration } from '../src/solver/solveScope.ts';
import { buildScenario, loadPkg } from './solverTestUtils.mjs';

const pkg = loadPkg();

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

describe('getRightSidebarStatusPresentation', () => {
  test('distinguishes seed scope, dependency inclusion, and excluded outputs in buildings-only runs', () => {
    const scenario = readJson('../src/configurations/buildings-endogenous.json');
    const statuses = deriveOutputRunStatusesForConfiguration(pkg, scenario);

    const residential = getRightSidebarStatusPresentation(
      statuses.residential_building_services,
    );
    const electricity = getRightSidebarStatusPresentation(statuses.electricity);
    const passengerRoad = getRightSidebarStatusPresentation(
      statuses.passenger_road_transport,
    );

    assert.ok(
      residential.badges.some((badge) => badge.label === 'Demand active in this run'),
    );
    assert.ok(
      residential.badges.some((badge) => badge.label === 'Seed scope'),
    );
    assert.ok(
      electricity.badges.some((badge) => badge.label === 'Endogenous supply in this run'),
    );
    assert.ok(
      electricity.badges.some((badge) => badge.label === 'Auto-included dependency'),
    );
    assert.ok(
      passengerRoad.badges.some((badge) => badge.label === 'Demand excluded from this run'),
    );
    assert.ok(
      !passengerRoad.badges.some((badge) => badge.label === 'No enabled pathways'),
    );
    assert.equal(passengerRoad.isDisabled, false);
    assert.equal(passengerRoad.isDimmed, true);
    assert.match(electricity.detail, /depends on it/i);
    assert.match(passengerRoad.detail, /outside the effective run/i);
  });

  test('shows blocked demand separately from disabled pathways', () => {
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

    assert.ok(
      passengerRoad.badges.some((badge) => badge.label === 'Demand active but no enabled pathways'),
    );
    assert.ok(
      passengerRoad.badges.some((badge) => badge.label === 'No enabled pathways'),
    );
    assert.equal(passengerRoad.isDisabled, true);
    assert.equal(passengerRoad.isDimmed, false);
    assert.match(passengerRoad.detail, /demand is still active/i);
    assert.ok(
      electricity.badges.every((badge) => badge.label !== 'No enabled pathways'),
    );
  });

  test('documents the legend statuses shown in the sidebar', () => {
    assert.deepEqual(
      RIGHT_SIDEBAR_STATUS_LEGEND.map((item) => item.label),
      [
        'Demand active in this run',
        'Seed scope',
        'Auto-included dependency',
        'Excluded from this run',
        'Externalized supply in this run',
        'No enabled pathways',
        'Demand active but no enabled pathways',
      ],
    );
  });
});
