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
  assert.ok(graph.nodes.some((node) => node.id === 'role:supply_electricity'));
  assert.equal(graph.edges.length, 0);
});

test('library role graph expands a role into representation nodes', () => {
  const graph = buildRoleLibraryGraphData(model, new Set(['role:supply_electricity']));

  assert.ok(graph.nodes.some((node) => node.id === 'representation:supply_electricity__pathway_bundle'));
  assert.ok(graph.edges.some((edge) =>
    edge.source === 'role:supply_electricity'
    && edge.target === 'representation:supply_electricity__pathway_bundle'
  ));
});

test('library role graph expands a direct representation into method nodes', () => {
  const graph = buildRoleLibraryGraphData(
    model,
    new Set([
      'role:supply_electricity',
      'representation:supply_electricity__pathway_bundle',
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
      'role:produce_crude_steel',
      'representation:produce_crude_steel__h2_dri_decomposition',
    ]),
  );

  assert.ok(graph.nodes.some((node) => node.id === 'role:produce_direct_reduced_iron'));
  assert.ok(graph.edges.some((edge) =>
    edge.source === 'representation:produce_crude_steel__h2_dri_decomposition'
    && edge.target === 'role:produce_direct_reduced_iron'
  ));
});
