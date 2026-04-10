import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  getRightSidebarStatusPresentation,
  RIGHT_SIDEBAR_STATUS_LEGEND,
} from '../src/components/workspace/rightSidebarStatus.ts';
import { deriveOutputRunStatusesForConfiguration } from '../src/solver/solveScope.ts';
import { buildConfiguration, loadPkg } from './solverTestUtils.mjs';

const pkg = loadPkg();

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

describe('getRightSidebarStatusPresentation', () => {
  test('distinguishes seed scope, dependency inclusion, and excluded outputs in buildings-only runs', () => {
    const configuration = readJson('../src/configurations/buildings-endogenous.json');
    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);

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

  test('greys out pathway status for externalized supply dependencies', () => {
    const configuration = readJson('../src/configurations/buildings-externalized.json');
    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);
    const electricity = getRightSidebarStatusPresentation(statuses.electricity);

    assert.ok(
      electricity.badges.some((badge) => badge.label === 'Externalized supply in this run'),
    );
    assert.ok(
      electricity.badges.some((badge) => badge.label === 'Auto-included dependency'),
    );
    assert.ok(
      electricity.badges.every((badge) => !/enabled pathway/i.test(badge.label)),
    );
    assert.equal(electricity.isDisabled, false);
    assert.equal(electricity.arePathwaysInactive, true);
    assert.match(electricity.detail, /commodity price selection is used instead/i);
  });

  test('distinguishes enabled pathways from solve-active pathways under one-hot exact shares', () => {
    const configuration = readJson('../src/configurations/agriculture-only.json');
    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);
    const livestock = getRightSidebarStatusPresentation(statuses.livestock_output_bundle);

    assert.ok(
      livestock.badges.some((badge) => badge.label === '2 enabled pathways'),
    );
    assert.ok(
      livestock.badges.some((badge) => badge.label === '1 solve-active pathway'),
    );
    assert.match(livestock.detail, /positive exact shares/i);
    assert.match(livestock.detail, /cap denominator/i);
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
        'Solve-active pathways',
        'No enabled pathways',
        'Demand active but no enabled pathways',
      ],
    );
  });
});
