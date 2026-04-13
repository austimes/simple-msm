import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getActiveStateIds } from '../src/data/configurationWorkspaceModel.ts';
import { buildConfiguration, loadPkg } from './solverTestUtils.mjs';

const pkg = loadPkg();

describe('getActiveStateIds', () => {
  test('active_state_ids controls keep only listed pathways active', () => {
    const electricityStateIds = Array.from(
      new Set(
        pkg.sectorStates
          .filter((row) => row.service_or_output_name === 'electricity')
          .map((row) => row.state_id),
      ),
    );

    assert.ok(electricityStateIds.length >= 2, 'expected multiple electricity pathways');

    const [primaryStateId, disabledStateId] = electricityStateIds;
    const activeIds = electricityStateIds.filter((id) => id !== disabledStateId);
    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Electricity fixed-share denominator semantics',
      serviceControls: {
        electricity: {
          mode: 'optimize',
          active_state_ids: activeIds,
        },
      },
    });

    const resultIds = getActiveStateIds(configuration, 'electricity', electricityStateIds);

    assert.ok(resultIds.includes(primaryStateId));
    assert.ok(!resultIds.includes(disabledStateId));
    assert.equal(resultIds.length, electricityStateIds.length - 1);
  });

  test('single-path active_state_ids controls still expose only listed pathways as active', () => {
    const residentialStateIds = Array.from(
      new Set(
        pkg.sectorStates
          .filter((row) => row.service_or_output_name === 'residential_building_services')
          .map((row) => row.state_id),
      ),
    );

    assert.ok(residentialStateIds.length >= 2, 'expected multiple residential pathways');

    const [selectedStateId, disabledStateId] = residentialStateIds;
    const activeIds = residentialStateIds.filter((id) => id !== disabledStateId);
    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Residential single-path exact-share availability semantics',
      serviceControls: {
        residential_building_services: {
          mode: 'optimize',
          active_state_ids: activeIds,
        },
      },
    });

    const resultIds = getActiveStateIds(
      configuration,
      'residential_building_services',
      residentialStateIds,
    );

    assert.ok(resultIds.includes(selectedStateId));
    assert.ok(!resultIds.includes(disabledStateId));
    assert.equal(resultIds.length, residentialStateIds.length - 1);
  });
});
