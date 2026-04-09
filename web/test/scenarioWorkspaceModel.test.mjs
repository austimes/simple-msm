import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getEnabledStateIds } from '../src/data/scenarioWorkspaceModel.ts';
import { buildConfiguration, loadPkg } from './solverTestUtils.mjs';

const pkg = loadPkg();

describe('getEnabledStateIds', () => {
  test('fixed-share controls keep all non-disabled pathways enabled for denominator semantics', () => {
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

    const enabledStateIds = getEnabledStateIds(configuration, 'electricity', electricityStateIds);

    assert.ok(enabledStateIds.includes(primaryStateId));
    assert.ok(!enabledStateIds.includes(disabledStateId));
    assert.equal(enabledStateIds.length, electricityStateIds.length - 1);
  });

  test('pinned-single controls still expose all non-disabled pathways as enabled candidates', () => {
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
      name: 'Residential pinned-single availability semantics',
      serviceControls: {
        residential_building_services: {
          mode: 'pinned_single',
          state_id: selectedStateId,
          disabled_state_ids: [disabledStateId],
        },
      },
    });

    const enabledStateIds = getEnabledStateIds(
      configuration,
      'residential_building_services',
      residentialStateIds,
    );

    assert.ok(enabledStateIds.includes(selectedStateId));
    assert.ok(!enabledStateIds.includes(disabledStateId));
    assert.equal(enabledStateIds.length, residentialStateIds.length - 1);
  });
});
