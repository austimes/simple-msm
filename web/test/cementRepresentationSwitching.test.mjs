import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveRightSidebarTree } from '../src/components/workspace/rightSidebarTree.ts';
import { buildRoleAreaNavigationCatalog } from '../src/data/configurationWorkspaceModel.ts';
import { buildRoleLibraryGraphData, buildRoleLibraryModel } from '../src/data/roleLibraryModel.ts';
import { loadPackage } from '../src/data/packageLoader.ts';
import { runScenario } from '../src/results/runScenario.ts';

const CEMENT_PARENT_ROLE = 'make_cement_equivalent';
const CEMENT_AGGREGATE = 'make_cement_equivalent__pathway_bundle';
const CEMENT_DECOMPOSITION = 'make_cement_equivalent__clinker_decomposition';
const CEMENT_CHILD_ROLES = [
  'generate_cement_kiln_heat',
  'grind_blend_cement_equivalent',
  'make_clinker_intermediate',
];
const CEMENT_OUTPUT_IDS = new Set([
  'cement_equivalent',
  ...CEMENT_CHILD_ROLES,
]);
const CEMENT_SOURCE_HINTS = ['cement', 'clinker', 'kiln'];
const EPSILON = 1e-9;

function buildConfiguration(pkg, representationId) {
  return {
    ...structuredClone(pkg.defaultConfiguration),
    representation_by_role: {
      ...(pkg.defaultConfiguration.representation_by_role ?? {}),
      [CEMENT_PARENT_ROLE]: representationId,
    },
  };
}

function runCementScenario(pkg, representationId) {
  return runScenario(pkg, buildConfiguration(pkg, representationId), { includeOverlays: false });
}

function cementRows(snapshot) {
  return snapshot.request.rows.filter((row) =>
    row.roleId === CEMENT_PARENT_ROLE
    || CEMENT_CHILD_ROLES.includes(row.roleId)
    || CEMENT_OUTPUT_IDS.has(row.outputId)
  );
}

function positiveCementShares(snapshot) {
  return snapshot.result.reporting.methodShares.filter((share) =>
    CEMENT_OUTPUT_IDS.has(share.outputId)
    && share.activity > EPSILON
  );
}

function cementContributions(snapshot) {
  return snapshot.contributions.filter((row) =>
    CEMENT_OUTPUT_IDS.has(row.outputId ?? '')
    || CEMENT_SOURCE_HINTS.some((hint) => row.sourceId.includes(hint))
  );
}

function summarizeCementComparison(snapshot) {
  const totals = {
    activity: positiveCementShares(snapshot).reduce((sum, share) => sum + share.activity, 0),
    cost: 0,
    energy: 0,
    emissions: 0,
  };

  for (const row of cementContributions(snapshot)) {
    if (row.metric === 'cost') {
      totals.cost += row.value;
    } else if (row.metric === 'fuel') {
      totals.energy += row.value;
    } else if (row.metric === 'emissions') {
      totals.emissions += row.value;
    }
  }

  return totals;
}

function assertPositiveFiniteMetrics(totals) {
  for (const [metric, value] of Object.entries(totals)) {
    assert.equal(Number.isFinite(value), true, `${metric} should be finite`);
    assert.ok(value > 0, `${metric} should be positive`);
  }
}

test('aggregate and decomposed cement configurations both solve through the end-to-end scenario path', () => {
  const pkg = loadPackage();
  const aggregate = runCementScenario(pkg, CEMENT_AGGREGATE);
  const decomposed = runCementScenario(pkg, CEMENT_DECOMPOSITION);
  const aggregateRoles = new Set(cementRows(aggregate).map((row) => row.roleId));
  const decomposedRoles = new Set(cementRows(decomposed).map((row) => row.roleId));
  const decomposedShareOutputs = new Set(positiveCementShares(decomposed).map((share) => share.outputId));

  assert.equal(aggregate.result.status, 'solved');
  assert.equal(decomposed.result.status, 'solved');
  assert.equal(
    aggregate.request.roleTopology?.activeRepresentationByRole[CEMENT_PARENT_ROLE],
    CEMENT_AGGREGATE,
  );
  assert.equal(
    decomposed.request.roleTopology?.activeRepresentationByRole[CEMENT_PARENT_ROLE],
    CEMENT_DECOMPOSITION,
  );

  assert.deepEqual(Array.from(aggregateRoles), [CEMENT_PARENT_ROLE]);
  assert.equal(CEMENT_CHILD_ROLES.every((roleId) => !aggregateRoles.has(roleId)), true);
  assert.equal(decomposedRoles.has(CEMENT_PARENT_ROLE), false);
  assert.equal(CEMENT_CHILD_ROLES.every((roleId) => decomposedRoles.has(roleId)), true);
  assert.equal(decomposedShareOutputs.has('grind_blend_cement_equivalent'), true);
  assert.equal(decomposedShareOutputs.has('make_clinker_intermediate'), true);
});

test('cement role graph and sidebar models expose the selected decomposition boundary', () => {
  const pkg = loadPackage();
  const model = buildRoleLibraryModel(pkg);
  const graph = buildRoleLibraryGraphData(
    model,
    new Set([
      'physical:make_materials_and_products',
      'physical:make_cement_equivalent',
      'role:make_cement_equivalent',
      'representation:make_cement_equivalent__clinker_decomposition',
    ]),
  );
  const sidebar = deriveRightSidebarTree(
    buildRoleAreaNavigationCatalog(pkg.resolvedMethodYears, pkg.appConfig),
    {},
    new Set(),
    new Set(),
    [],
    pkg.residualOverlays2025,
    {},
    {
      roleMetadata: pkg.roleMetadata,
      representations: pkg.representations,
      roleDecompositionEdges: pkg.roleDecompositionEdges,
      methods: pkg.methods,
      currentConfiguration: buildConfiguration(pkg, CEMENT_DECOMPOSITION),
    },
  );
  const parent = sidebar.flatMap((area) => area.subsectors)
    .find((role) => role.roleId === CEMENT_PARENT_ROLE);
  const selectedOptions = parent?.representationOptions.filter((option) => option.isSelected) ?? [];

  assert.ok(graph.nodes.some((node) => node.id === `representation:${CEMENT_DECOMPOSITION}`));
  for (const roleId of CEMENT_CHILD_ROLES) {
    assert.ok(graph.nodes.some((node) => node.id === `role:${roleId}`));
    assert.ok(graph.edges.some((edge) =>
      edge.source === `representation:${CEMENT_DECOMPOSITION}`
      && edge.target === `role:${roleId}`
    ));
  }

  assert.ok(parent);
  assert.equal(parent.selectedRepresentationId, CEMENT_DECOMPOSITION);
  assert.equal(parent.selectedRepresentationKind, 'role_decomposition');
  assert.deepEqual(selectedOptions.map((option) => option.representationId), [CEMENT_DECOMPOSITION]);
  assert.deepEqual(parent.states, []);
  assert.deepEqual(
    parent.childRoles.map((role) => role.roleId).sort(),
    [...CEMENT_CHILD_ROLES].sort(),
  );
});

test('cement comparison output exposes activity, cost, energy, and emissions deltas', () => {
  const pkg = loadPackage();
  const aggregate = runCementScenario(pkg, CEMENT_AGGREGATE);
  const decomposed = runCementScenario(pkg, CEMENT_DECOMPOSITION);
  const aggregateTotals = summarizeCementComparison(aggregate);
  const decomposedTotals = summarizeCementComparison(decomposed);
  const deltas = Object.fromEntries(
    Object.keys(aggregateTotals).map((metric) => [
      metric,
      decomposedTotals[metric] - aggregateTotals[metric],
    ]),
  );

  assertPositiveFiniteMetrics(aggregateTotals);
  assertPositiveFiniteMetrics(decomposedTotals);
  assert.equal(Object.values(deltas).every((value) => Number.isFinite(value)), true);
  assert.equal(Object.values(deltas).some((value) => Math.abs(value) > EPSILON), true);
});
