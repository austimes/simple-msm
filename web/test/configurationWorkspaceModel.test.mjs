import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getAvailableStateIds } from '../src/data/configurationWorkspaceModel.ts';
import { buildConfiguration, loadPkg } from './solverTestUtils.mjs';

const pkg = loadPkg();

describe('getAvailableStateIds', () => {
  test('fixed-share controls keep non-disabled pathways enabled for editing', () => {
    const electricityStateIds = Array.from(
      new Set(
        pkg.sectorStates
          .filter((row) => row.service_or_output_name === 'electricity')
          .map((row) => row.state_id),
      ),
    );

    assert.ok(electricityStateIds.length >= 2, 'expected multiple electricity pathways');

    const [primaryStateId, disabledStateId] = electricityStateIds;
    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Electricity fixed-share denominator semantics',
      serviceControls: {
        electricity: {
          mode: 'fixed_shares',
          fixed_shares: { [primaryStateId]: 1 },
          disabled_state_ids: [disabledStateId],
        },
      },
    });

    const availableStateIds = getAvailableStateIds(configuration, 'electricity', electricityStateIds);

    assert.ok(availableStateIds.includes(primaryStateId));
    assert.ok(!availableStateIds.includes(disabledStateId));
    assert.equal(availableStateIds.length, electricityStateIds.length - 1);
  });

  test('single-path exact-share controls still expose non-disabled pathways as enabled candidates', () => {
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
      name: 'Residential single-path exact-share availability semantics',
      serviceControls: {
        residential_building_services: {
          mode: 'fixed_shares',
          fixed_shares: { [selectedStateId]: 1 },
          disabled_state_ids: [disabledStateId],
        },
      },
    });

    const availableStateIds = getAvailableStateIds(
      configuration,
      'residential_building_services',
      residentialStateIds,
    );

    assert.ok(availableStateIds.includes(selectedStateId));
    assert.ok(!availableStateIds.includes(disabledStateId));
    assert.equal(availableStateIds.length, residentialStateIds.length - 1);
  });
});
