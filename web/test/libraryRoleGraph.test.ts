import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPackage } from '../src/data/packageLoader.ts';
import {
  buildRoleLibraryGraphData,
  buildRoleLibraryModel,
  listTopLevelTopologyAreas,
} from '../src/data/roleLibraryModel.ts';

const pkg = loadPackage();
const model = buildRoleLibraryModel(pkg);

test('library role graph starts with collapsed top-level role nodes', () => {
  const graph = buildRoleLibraryGraphData(model, new Set());

  assert.equal(graph.nodes.length, model.topLevelRoles.length);
  assert.ok(graph.nodes.every((node) => node.kind === 'role'));
  assert.ok(graph.nodes.some((node) => node.id === 'role:supply_grid_electricity'));
});

test('library role graph expands a role into representation nodes', () => {
  const graph = buildRoleLibraryGraphData(
    model,
    new Set([
      'role:supply_grid_electricity',
    ]),
  );

  assert.ok(graph.nodes.some((node) => node.id === 'representation:supply_grid_electricity__pathway_bundle'));
  assert.ok(graph.edges.some((edge) =>
    edge.source === 'role:supply_grid_electricity'
    && edge.target === 'representation:supply_grid_electricity__pathway_bundle'
  ));
});

test('library role graph expands a direct representation into method nodes', () => {
  const graph = buildRoleLibraryGraphData(
    model,
    new Set([
      'role:supply_grid_electricity',
      'representation:supply_grid_electricity__pathway_bundle',
    ]),
  );

  assert.ok(graph.nodes.some((node) =>
    node.kind === 'method'
    && node.methodId === 'electricity__grid_supply__policy_frontier'
  ));
});

test('library role graph shows crude-steel decomposition child roles', () => {
  const graph = buildRoleLibraryGraphData(
    model,
    new Set([
      'role:make_crude_steel',
      'representation:make_crude_steel__h2_dri_decomposition',
    ]),
  );

  assert.ok(graph.nodes.some((node) => node.id === 'role:make_direct_reduced_iron'));
  assert.ok(graph.edges.some((edge) =>
    edge.source === 'representation:make_crude_steel__h2_dri_decomposition'
    && edge.target === 'role:make_direct_reduced_iron'
  ));
});

test('library role graph hides decomposition child roles until decomposition representation is expanded', () => {
  const graph = buildRoleLibraryGraphData(model, new Set());

  assert.equal(graph.nodes.some((node) => node.id === 'role:make_direct_reduced_iron'), false);
});

test('library role graph exposes emissions importance bands on role nodes', () => {
  const graph = buildRoleLibraryGraphData(model, new Set());
  const electricity = graph.nodes.find((node) => node.id === 'role:supply_grid_electricity');

  assert.equal(electricity?.emissionsImportanceBand, 'very_high');
});

test('top-level roles sort by topology_area_label so areas appear together', () => {
  const labels = model.topLevelRoles.map((role) => role.topologyAreaLabel);
  const sorted = [...labels].sort((left, right) => left.localeCompare(right));
  assert.deepEqual(labels, sorted);

  // Each topology area appears as a contiguous run.
  const seen = new Set<string>();
  let previous: string | null = null;
  for (const label of labels) {
    if (label !== previous) {
      assert.equal(seen.has(label), false, `topology area ${label} is split into non-contiguous runs`);
      seen.add(label);
      previous = label;
    }
  }
});

test('listTopLevelTopologyAreas derives the area list from roles.csv only', () => {
  const areas = listTopLevelTopologyAreas(model);
  assert.ok(areas.length > 0);

  const sortedLabels = areas.map((area) => area.topologyAreaLabel);
  assert.deepEqual(sortedLabels, [...sortedLabels].sort((left, right) => left.localeCompare(right)));

  const totalCount = areas.reduce((sum, area) => sum + area.topLevelRoleCount, 0);
  assert.equal(totalCount, model.topLevelRoles.length);

  for (const area of areas) {
    const expected = model.topLevelRoles.filter((role) => role.topologyAreaId === area.topologyAreaId).length;
    assert.equal(area.topLevelRoleCount, expected);
  }
});

test('topology_area filter restricts visible top-level roles to that area', () => {
  const areas = listTopLevelTopologyAreas(model);
  assert.ok(areas.length >= 2, 'expected multiple topology areas in the canonical library');

  const target = areas[0];
  const graph = buildRoleLibraryGraphData(model, new Set(), { topologyAreaId: target.topologyAreaId });
  const roleNodes = graph.nodes.filter((node) => node.kind === 'role');

  assert.equal(roleNodes.length, target.topLevelRoleCount);
  for (const node of roleNodes) {
    const role = node.roleId ? model.roleById.get(node.roleId) : undefined;
    assert.ok(role);
    assert.equal(role.topologyAreaId, target.topologyAreaId);
  }
});

test('topology_area filter is ignored when blank or unset', () => {
  const baseline = buildRoleLibraryGraphData(model, new Set());
  const blank = buildRoleLibraryGraphData(model, new Set(), { topologyAreaId: '' });
  const whitespace = buildRoleLibraryGraphData(model, new Set(), { topologyAreaId: '   ' });

  assert.equal(blank.nodes.length, baseline.nodes.length);
  assert.equal(whitespace.nodes.length, baseline.nodes.length);
});
