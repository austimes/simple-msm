import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { loadPackage } from '../src/data/packageLoader.ts';
import { parseCsv } from '../src/data/parseCsv.ts';

const PACKAGE_ROOT = join(import.meta.dirname, '../../energy_system_representation_library');
const BOUNDARY_PATH = 'validation/cement_decomposition_boundary.csv';

function readBoundaryRows() {
  return parseCsv(readFileSync(join(PACKAGE_ROOT, BOUNDARY_PATH), 'utf8'));
}

test('cement decomposition boundary design is packaged', () => {
  const pkg = loadPackage();
  const rows = readBoundaryRows();

  assert.equal(pkg.enrichment.availablePaths.includes(BOUNDARY_PATH), true);
  assert.equal(rows.length, 4);
  assert.ok(rows.every((row) => row.parent_role_id === 'make_cement_equivalent'));
  assert.ok(rows.every((row) =>
    row.planned_parent_representation_id === 'make_cement_equivalent__clinker_decomposition'
  ));
  assert.ok(rows.every((row) => row.implementation_status === 'designed'));
  assert.ok(rows.every((row) => row.double_counting_guardrail.length > 0));
});

test('cement decomposition boundary defines child roles and activity propagation', () => {
  const rows = readBoundaryRows();
  const childRows = rows.filter((row) => row.planned_child_role_id !== '');
  const childRoleIds = childRows.map((row) => row.planned_child_role_id).sort();

  assert.deepEqual(childRoleIds, [
    'generate_cement_kiln_heat',
    'grind_blend_cement_equivalent',
    'make_clinker_intermediate',
  ]);

  assert.equal(
    rows.find((row) => row.boundary_item_id === 'parent_aggregate_guardrail')?.parent_activity_link,
    'parent_activity_source',
  );
  assert.ok(childRows.every((row) =>
    row.parent_activity_link === 'linked_parent_activity'
    || row.parent_activity_link === 'optional_physical_flow'
  ));
});

test('cement decomposition boundary assigns heat fuel and emissions ownership once', () => {
  const rowsById = new Map(readBoundaryRows().map((row) => [row.boundary_item_id, row]));
  const clinker = rowsById.get('cement_clinker_intermediate');
  const kilnHeat = rowsById.get('cement_kiln_heat');
  const finish = rowsById.get('cement_finish_grind_blend');

  assert.equal(clinker?.process_emissions_ownership, 'owns_limestone_calcination_co2_and_uncaptured_clinker_process_co2');
  assert.equal(clinker?.energy_emissions_ownership, 'excludes_fuel_combustion_energy_co2');

  assert.equal(kilnHeat?.heat_fuel_ownership, 'owns_host_specific_cement_kiln_heat_and_fuel_inputs');
  assert.equal(kilnHeat?.energy_emissions_ownership, 'owns_direct_fuel_combustion_co2_and_energy_inputs');
  assert.match(kilnHeat?.double_counting_guardrail ?? '', /deliver_high_temperature_heat/);

  assert.equal(finish?.process_emissions_ownership, 'excludes_calcination_process_co2');
  assert.equal(finish?.energy_emissions_ownership, 'owns_grinding_blending_electricity_inputs_only');
});
