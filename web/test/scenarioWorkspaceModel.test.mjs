import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getEnabledStateIds } from '../src/data/scenarioWorkspaceModel.ts';
import { buildScenario, loadPkg } from './solverTestUtils.mjs';

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
    const scenario = buildScenario(pkg.appConfig, {
      name: 'Electricity fixed-share denominator semantics',
      serviceControls: {
        electricity: {
          mode: 'fixed_shares',
          fixed_shares: { [primaryStateId]: 1 },
          disabled_state_ids: [disabledStateId],
        },
      },
    });

    const enabledStateIds = getEnabledStateIds(scenario, 'electricity', electricityStateIds);

    assert.ok(enabledStateIds.includes(primaryStateId));
    assert.ok(!enabledStateIds.includes(disabledStateId));
    assert.equal(enabledStateIds.length, electricityStateIds.length - 1);
  });
});
