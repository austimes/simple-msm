import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildEfficiencyControlCatalog,
  buildNextPackageAllowList,
  resolveActiveEfficiencyPackageIds,
  resolveAutonomousModeForOutput,
} from '../src/data/efficiencyControlModel.ts';

function methodRow(roleId, outputId, methodId) {
  return {
    role_id: roleId,
    output_id: outputId,
    method_id: methodId,
  };
}

function autonomousTrack(roleId, trackId, methodId) {
  return {
    role_id: roleId,
    track_id: trackId,
    track_label: `${trackId} label`,
    applicable_method_ids: [methodId],
  };
}

function efficiencyPackage(roleId, packageId, methodId, overrides = {}) {
  return {
    role_id: roleId,
    package_id: packageId,
    package_label: `${packageId} label`,
    classification: 'pure_efficiency_overlay',
    applicable_method_ids: [methodId],
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
      autonomous_modes_by_role: {
        low_temperature_heat: 'off',
      },
      package_mode: 'allow_list',
      package_ids: ['pkg_a'],
    },
  };
  const heatRoleId = 'make_chemical_products';
  const catalog = buildEfficiencyControlCatalog(
    configuration,
    [
      methodRow(heatRoleId, 'low_temperature_heat', 'base_heat'),
      methodRow(heatRoleId, 'low_temperature_heat', 'generic_industrial_heat__low_temperature_heat__electrified'),
      methodRow('empty_role', 'empty', 'empty_state'),
    ],
    [autonomousTrack(heatRoleId, 'track_a', 'base_heat')],
    [
      efficiencyPackage(heatRoleId, 'pkg_a', 'base_heat', {
        non_stacking_group: 'shared',
      }),
      efficiencyPackage(heatRoleId, 'pkg_a', 'base_heat', {
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
  assert.deepEqual(heat.embodiedMethodIds, []);
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
      autonomous_modes_by_role: { low_temperature_heat: 'baseline' },
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
