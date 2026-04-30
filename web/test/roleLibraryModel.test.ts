import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPackage } from '../src/data/packageLoader.ts';
import { buildRoleLibraryModel } from '../src/data/roleLibraryModel.ts';

const pkg = loadPackage();

test('role library model keeps top-level roles separate from decomposition children', () => {
  const model = buildRoleLibraryModel(pkg);

  assert.ok(model.topLevelRoles.some((role) => role.roleId === 'produce_crude_steel'));
  assert.ok(!model.topLevelRoles.some((role) => role.roleId === 'produce_direct_reduced_iron'));
  assert.equal(
    model.roleById.get('produce_direct_reduced_iron')?.coverageObligation,
    'required_decomposition_child',
  );
});

test('role library model discovers crude-steel child roles from decomposition edges', () => {
  const model = buildRoleLibraryModel(pkg);
  const decomposition = model.representationById.get('produce_crude_steel__h2_dri_decomposition');

  assert.deepEqual(decomposition?.childRoleIds, [
    'melt_refine_dri_crude_steel',
    'produce_crude_steel_non_h2_dri_residual',
    'produce_direct_reduced_iron',
  ]);
});

test('role library model counts representations, methods, and reporting allocations', () => {
  const model = buildRoleLibraryModel(pkg);
  const electricity = model.roleById.get('supply_electricity');
  const directRepresentation = model.representationById.get('supply_electricity__pathway_bundle');

  assert.ok(electricity);
  assert.equal(electricity?.representations.length, 1);
  assert.equal(directRepresentation?.methods.length, 3);
  assert.equal(electricity?.reportingAllocations[0]?.reporting_bucket, 'electricity');
});

test('reporting allocations do not create topology children', () => {
  const model = buildRoleLibraryModel(pkg);
  const electricity = model.roleById.get('supply_electricity');

  assert.equal(electricity?.reportingAllocations.length, 1);
  assert.deepEqual(electricity?.childRoleIds, []);
});
