import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPackage } from '../src/data/packageLoader.ts';
import { buildRoleLibraryModel } from '../src/data/roleLibraryModel.ts';

const pkg = loadPackage();

test('role library model keeps top-level roles separate from decomposition children', () => {
  const model = buildRoleLibraryModel(pkg);

  assert.ok(model.topLevelRoles.some((role) => role.roleId === 'make_crude_steel'));
  assert.ok(!model.topLevelRoles.some((role) => role.roleId === 'make_direct_reduced_iron'));
  assert.equal(
    model.roleById.get('make_direct_reduced_iron')?.activationClass,
    'decomposition_child',
  );
});

test('role library model discovers crude-steel child roles from decomposition edges', () => {
  const model = buildRoleLibraryModel(pkg);
  const decomposition = model.representationById.get('make_crude_steel__h2_dri_decomposition');

  assert.deepEqual(decomposition?.childRoleIds, [
    'make_direct_reduced_iron',
    'make_non_h2_dri_crude_steel',
    'melt_and_refine_dri_into_crude_steel',
  ]);
});

test('role library model counts representations, methods, and reporting allocations', () => {
  const model = buildRoleLibraryModel(pkg);
  const electricity = model.roleById.get('supply_grid_electricity');
  const directRepresentation = model.representationById.get('supply_grid_electricity__pathway_bundle');

  assert.ok(electricity);
  assert.equal(electricity?.representations.length, 1);
  assert.equal(directRepresentation?.methods.length, 3);
  assert.equal(electricity?.reportingAllocations[0]?.reporting_bucket, 'electricity');
});

test('reporting allocations do not create topology children', () => {
  const model = buildRoleLibraryModel(pkg);
  const electricity = model.roleById.get('supply_grid_electricity');

  assert.equal(electricity?.reportingAllocations.length, 1);
  assert.deepEqual(electricity?.childRoleIds, []);
});
