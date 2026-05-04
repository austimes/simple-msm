import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPackage } from '../src/data/packageLoader.ts';
import {
  buildRoleLibraryGraphData,
  buildRoleLibraryModel,
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
