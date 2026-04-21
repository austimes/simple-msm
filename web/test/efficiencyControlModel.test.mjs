import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildEfficiencyControlCatalog,
  buildNextPackageAllowList,
  resolveActiveEfficiencyPackageIds,
  resolveAutonomousModeForOutput,
} from '../src/data/efficiencyControlModel.ts';

function sectorState(outputId, stateId) {
  return {
    service_or_output_name: outputId,
    state_id: stateId,
  };
}

function autonomousTrack(outputId, trackId, stateId) {
  return {
    family_id: outputId,
    track_id: trackId,
    track_label: `${trackId} label`,
    applicable_state_ids: [stateId],
  };
}

function efficiencyPackage(outputId, packageId, stateId, overrides = {}) {
  return {
    family_id: outputId,
    package_id: packageId,
    package_label: `${packageId} label`,
    classification: 'pure_efficiency_overlay',
    applicable_state_ids: [stateId],
    non_stacking_group: null,
    max_share: 0.25,
    year: 2030,
    ...overrides,
  };
}

test('builds subsector efficiency control catalog', () => {
  const configuration = {
    efficiency_controls: {
      autonomous_mode: 'baseline',
      autonomous_modes_by_output: {
        low_temperature_heat: 'off',
      },
      package_mode: 'allow_list',
      package_ids: ['pkg_a'],
    },
  };
  const catalog = buildEfficiencyControlCatalog(
    configuration,
    [
      sectorState('low_temperature_heat', 'base_heat'),
      sectorState('low_temperature_heat', 'generic_industrial_heat__low_temperature_heat__electrified'),
      sectorState('empty', 'empty_state'),
    ],
    [autonomousTrack('low_temperature_heat', 'track_a', 'base_heat')],
    [
      efficiencyPackage('low_temperature_heat', 'pkg_a', 'base_heat', {
        non_stacking_group: 'shared',
      }),
      efficiencyPackage('low_temperature_heat', 'pkg_a', 'base_heat', {
        max_share: 0.4,
        year: 2035,
        non_stacking_group: 'shared',
      }),
    ],
  );

  const heat = catalog.find((node) => node.outputId === 'low_temperature_heat');
  const empty = catalog.find((node) => node.outputId === 'empty');

  assert.ok(heat?.hasControls);
  assert.equal(heat.autonomousTracks[0].enabled, false);
  assert.equal(heat.packages[0].enabled, true);
  assert.equal(heat.packages[0].nonStackingGroup, 'shared');
  assert.deepEqual(heat.packages[0].maxShareByYear, {
    2030: 0.25,
    2035: 0.4,
  });
  assert.deepEqual(heat.embodiedStateIds, [
    'generic_industrial_heat__low_temperature_heat__electrified',
  ]);
  assert.equal(empty?.hasControls, false);
});

test('resolves autonomous mode for output from global and per-output controls', () => {
  assert.equal(resolveAutonomousModeForOutput(undefined, 'low_temperature_heat'), 'baseline');
  assert.equal(
    resolveAutonomousModeForOutput({ autonomous_mode: 'off' }, 'low_temperature_heat'),
    'off',
  );
  assert.equal(
    resolveAutonomousModeForOutput({
      autonomous_mode: 'off',
      autonomous_modes_by_output: { low_temperature_heat: 'baseline' },
    }, 'low_temperature_heat'),
    'baseline',
  );
});

test('resolves active package ids from all package modes', () => {
  const packages = [
    efficiencyPackage('low_temperature_heat', 'pkg_a', 'base_heat'),
    efficiencyPackage('low_temperature_heat', 'pkg_b', 'base_heat'),
    efficiencyPackage('transport', 'pkg_c', 'base_transport'),
  ];

  assert.deepEqual(resolveActiveEfficiencyPackageIds({ package_mode: 'off' }, packages), []);
  assert.deepEqual(resolveActiveEfficiencyPackageIds({ package_mode: 'all' }, packages), ['pkg_a', 'pkg_b', 'pkg_c']);
  assert.deepEqual(
    resolveActiveEfficiencyPackageIds({ package_mode: 'allow_list', package_ids: ['pkg_c', 'pkg_a'] }, packages),
    ['pkg_a', 'pkg_c'],
  );
  assert.deepEqual(
    resolveActiveEfficiencyPackageIds({ package_mode: 'deny_list', package_ids: ['pkg_b'] }, packages),
    ['pkg_a', 'pkg_c'],
  );
});

test('toggling packages converts to sorted allow-list ids', () => {
  const packages = [
    efficiencyPackage('low_temperature_heat', 'pkg_b', 'base_heat'),
    efficiencyPackage('low_temperature_heat', 'pkg_a', 'base_heat'),
    efficiencyPackage('transport', 'pkg_c', 'base_transport'),
  ];

  assert.deepEqual(
    buildNextPackageAllowList({ package_mode: 'off' }, packages, { packageId: 'pkg_b', enabled: true }),
    ['pkg_b'],
  );
  assert.deepEqual(
    buildNextPackageAllowList({ package_mode: 'all' }, packages, { packageId: 'pkg_b', enabled: false }),
    ['pkg_a', 'pkg_c'],
  );
});

test('all-on and all-off package changes are scoped to one output', () => {
  const packages = [
    efficiencyPackage('low_temperature_heat', 'pkg_a', 'base_heat'),
    efficiencyPackage('low_temperature_heat', 'pkg_b', 'base_heat'),
    efficiencyPackage('transport', 'pkg_c', 'base_transport'),
  ];

  assert.deepEqual(
    buildNextPackageAllowList(
      { package_mode: 'allow_list', package_ids: ['pkg_c'] },
      packages,
      { outputId: 'low_temperature_heat', enabled: true },
    ),
    ['pkg_a', 'pkg_b', 'pkg_c'],
  );
  assert.deepEqual(
    buildNextPackageAllowList(
      { package_mode: 'allow_list', package_ids: ['pkg_a', 'pkg_b', 'pkg_c'] },
      packages,
      { outputId: 'low_temperature_heat', enabled: false },
    ),
    ['pkg_c'],
  );
});
