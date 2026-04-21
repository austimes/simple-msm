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
  test('distinguishes active pathways, dependency inclusion, and excluded outputs in buildings-only runs', () => {
    const configuration = readJson('../src/configurations/demo-buildings-efficiency.json');
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
      residential.badges.some((badge) => badge.label === 'Active in this run'),
    );
    assert.ok(
      electricity.badges.some((badge) => badge.label === 'Endogenous supply in this run'),
    );
    // Electricity has mode=optimize with all states active, so it's directly active
    assert.ok(
      electricity.badges.some((badge) => badge.label === 'Active in this run'),
    );
    assert.ok(
      passengerRoad.badges.some((badge) => badge.label === 'Demand excluded from this run'),
    );
    assert.equal(passengerRoad.isDisabled, true);
    assert.equal(passengerRoad.isDimmed, true);
    assert.match(electricity.detail, /active pathways/i);
    assert.match(passengerRoad.detail, /excluded/i);
  });

  test('shows disabled output as excluded from run when all pathways deactivated', () => {
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
    const passengerRoad = getRightSidebarStatusPresentation(
      statuses.passenger_road_transport,
    );

    assert.equal(passengerRoad.isDisabled, true);
    assert.equal(passengerRoad.isDimmed, true);
  });

  test('greys out pathway status for externalized supply dependencies', () => {
    const configuration = readJson('../src/configurations/demo-buildings-efficiency.json');
    configuration.service_controls.electricity = { mode: 'externalized' };
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
    assert.equal(electricity.isDisabled, true);
    assert.equal(electricity.arePathwaysInactive, true);
    assert.match(electricity.detail, /commodity price selection is used instead/i);
  });

  test('shows active pathways count under a retained freight demo configuration', () => {
    const configuration = readJson('../src/configurations/demo-freight-efficiency.json');
    const statuses = deriveOutputRunStatusesForConfiguration(pkg, configuration);
    const freight = getRightSidebarStatusPresentation(statuses.freight_road_transport);

    assert.ok(
      freight.badges.some((badge) => /active pathway/i.test(badge.label)),
    );
  });

  test('documents the legend statuses shown in the sidebar', () => {
    assert.deepEqual(
      RIGHT_SIDEBAR_STATUS_LEGEND.map((item) => item.label),
      [
        'Demand active in this run',
        'Active in this run',
        'Auto-included dependency',
        'Excluded from this run',
        'Externalized supply in this run',
        'Active pathways',
      ],
    );
  });
});
