import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPackage } from '../src/data/packageLoader.ts';

const CEMENT_PARENT_ROLE = 'make_cement_equivalent';
const CEMENT_DECOMPOSITION = 'make_cement_equivalent__clinker_decomposition';
const CHILD_ROLES = [
  'make_clinker_intermediate',
  'generate_cement_kiln_heat',
  'grind_blend_cement_equivalent',
];

test('cement decomposition activates required child pathway roles', () => {
  const pkg = loadPackage();
  const decomposition = pkg.representations.find((row) => row.representation_id === CEMENT_DECOMPOSITION);

  assert.equal(decomposition?.role_id, CEMENT_PARENT_ROLE);
  assert.equal(decomposition?.representation_kind, 'role_decomposition');
  assert.equal(decomposition?.is_default, false);
  assert.equal(decomposition?.direct_method_kind ?? '', '');

  const edges = pkg.roleDecompositionEdges
    .filter((edge) => edge.parent_representation_id === CEMENT_DECOMPOSITION)
    .sort((left, right) => left.display_order - right.display_order);

  assert.deepEqual(edges.map((edge) => edge.child_role_id), CHILD_ROLES);
  assert.ok(edges.every((edge) => edge.edge_kind === 'required_child'));
  assert.ok(edges.every((edge) => edge.is_required === true));
});

test('cement child roles have direct pathway bundles and method coverage', () => {
  const pkg = loadPackage();

  for (const roleId of CHILD_ROLES) {
    const role = pkg.roleMetadata.find((row) => row.role_id === roleId);
    assert.equal(role?.parent_role_id, CEMENT_PARENT_ROLE);
    assert.equal(role?.coverage_obligation, 'required_decomposition_child');

    const representation = pkg.representations.find((row) => row.role_id === roleId);
    assert.equal(representation?.representation_kind, 'pathway_bundle');
    assert.equal(representation?.is_default, true);
    assert.equal(representation?.direct_method_kind, 'pathway');

    const methods = pkg.methods.filter((row) => row.role_id === roleId);
    const methodYears = pkg.methodYears.filter((row) => row.role_id === roleId);
    assert.equal(methods.length > 0, true, `${roleId} should expose child pathway methods`);
    assert.equal(methodYears.length, methods.length * 6, `${roleId} should cover every milestone year`);
    assert.ok(methods.every((row) => row.method_kind === 'pathway'));
  }
});

test('cement child boundaries keep kiln heat and calcination ownership separate', () => {
  const pkg = loadPackage();
  const clinkerRows = pkg.methodYears.filter((row) => row.role_id === 'make_clinker_intermediate');
  const kilnRows = pkg.methodYears.filter((row) => row.role_id === 'generate_cement_kiln_heat');
  const finishRows = pkg.methodYears.filter((row) => row.role_id === 'grind_blend_cement_equivalent');

  assert.ok(clinkerRows.every((row) => row.input_commodities.includes('cement_kiln_heat')));
  assert.ok(clinkerRows.every((row) => row.process_emissions_by_pollutant.length > 0));
  assert.ok(clinkerRows.every((row) => row.energy_emissions_by_pollutant.length === 0));

  assert.ok(kilnRows.every((row) => row.energy_emissions_by_pollutant.length > 0));
  assert.ok(kilnRows.every((row) => row.process_emissions_by_pollutant.length === 0));
  assert.ok(kilnRows.every((row) => row.emissions_boundary_notes.includes('Limestone calcination emissions are excluded')));

  assert.ok(finishRows.every((row) => row.input_commodities.includes('make_clinker_intermediate')));
  assert.ok(finishRows.every((row) => row.process_emissions_by_pollutant.length === 0));
  assert.ok(finishRows.every((row) => row.energy_emissions_by_pollutant.length === 0));
});
