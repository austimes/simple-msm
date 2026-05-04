import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { loadPackage } from '../src/data/packageLoader.ts';
import { buildRoleLibraryGraphData, buildRoleLibraryModel } from '../src/data/roleLibraryModel.ts';
import { parseCsv } from '../src/data/parseCsv.ts';

const PACKAGE_ROOT = join(import.meta.dirname, '../../energy_system_representation_library');
const COVERAGE_SUMMARY_PATH = 'validation/whole_system_coverage_summary.csv';

function readPackageCsv(relativePath) {
  return parseCsv(readFileSync(join(PACKAGE_ROOT, relativePath), 'utf8'));
}

test('whole-system coverage summary resolves every authored role', () => {
  const pkg = loadPackage();
  const rows = readPackageCsv(COVERAGE_SUMMARY_PATH);
  const rowsByRoleId = new Map(rows.map((row) => [row.role_id, row]));

  assert.equal(rows.length, pkg.roleMetadata.length);
  assert.equal(pkg.enrichment.availablePaths.includes(COVERAGE_SUMMARY_PATH), true);

  for (const role of pkg.roleMetadata) {
    const row = rowsByRoleId.get(role.role_id);
    assert.ok(row, `${role.role_id} should have a coverage summary row`);
    assert.equal(row.coverage_status, 'covered', `${role.role_id} should be covered`);
    assert.equal(Number(row.default_method_count) > 0, true, `${role.role_id} should have a default method`);
    assert.equal(
      Number(row.method_year_row_count),
      Number(row.default_method_count) * 6,
      `${role.role_id} should have full milestone-year coverage`,
    );
    assert.notEqual(row.primary_node_id, '', `${role.role_id} should resolve to a primary physical node`);
    assert.notEqual(row.emissions_importance_band, '', `${role.role_id} should resolve an emissions band`);
  }

  const temporaryRows = rows.filter((row) => row.temporary_unallocated_coverage === 'true');
  assert.equal(temporaryRows.length > 0, true);
  assert.equal(rowsByRoleId.get('account_residual_other_sectors')?.temporary_unallocated_coverage, 'true');
  assert.equal(rowsByRoleId.get('capture_point_source_co2')?.temporary_unallocated_coverage, 'true');
  assert.equal(rowsByRoleId.get('store_captured_co2')?.temporary_unallocated_coverage, 'true');
});

test('library role graph can expose every top-level coverage role', () => {
  const pkg = loadPackage();
  const model = buildRoleLibraryModel(pkg);
  const expandedPhysicalNodes = new Set(
    model.physicalNodes.map((node) => `physical:${node.nodeId}`),
  );
  const graph = buildRoleLibraryGraphData(model, expandedPhysicalNodes);
  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));

  for (const role of model.topLevelRoles) {
    assert.equal(graphNodeIds.has(`role:${role.roleId}`), true, `${role.roleId} should be visible`);
  }

  // Carbon-management process-chain edges are role-graph relationships and
  // no longer live in the navigation-only physical edges. The roles themselves
  // remain visible above; richer process-chain edges are tracked in later
  // role-graph work.
});
