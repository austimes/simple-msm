import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPackage } from '../src/data/packageLoader.ts';

test('web package loader reads canonical role-topology files', () => {
  const pkg = loadPackage();

  assert.equal(pkg.roleMetadata.length, 54);
  assert.equal(pkg.roleMetrics.length, 54);
  assert.equal(pkg.physicalSystemNodes.length, 66);
  assert.equal(pkg.roleMemberships.length, 54);
  assert.equal(pkg.physicalEdges.length, 25);
  assert.equal(pkg.representations.length, 57);
  assert.equal(pkg.roleDecompositionEdges.length, 4);
  assert.equal(pkg.methods.length, 89);
  assert.equal(pkg.methodYears.length, 534);
  assert.equal(pkg.roleDemands.length, 54);

  assert.ok(pkg.roleMetadata.some((role) => role.role_id === 'supply_grid_electricity'));
  assert.ok(pkg.physicalSystemNodes.some((node) =>
    node.node_id === 'operate_australian_energy_and_emissions_system'
    && node.node_kind === 'root'
    && node.parent_node_id === null
  ));
  assert.ok(pkg.roleMemberships.some((membership) =>
    membership.role_id === 'supply_grid_electricity'
    && membership.node_id === 'supply_grid_electricity'
    && membership.is_primary === true
  ));
  assert.ok(pkg.physicalEdges.some((edge) =>
    edge.edge_kind === 'supplies_energy_carrier_to'
    && edge.from_node_id === 'supply_grid_electricity'
    && edge.to_node_id === 'serve_building_occupants'
  ));
  assert.ok(pkg.roleMetrics.some((metric) =>
    metric.role_id === 'supply_grid_electricity'
    && metric.emissions_importance_band === 'very_high'
    && metric.baseline_direct_gross_emissions_mtco2e > 100
  ));
  assert.ok(pkg.representations.some((representation) =>
    representation.representation_id === 'make_crude_steel__h2_dri_decomposition'
    && representation.representation_kind === 'role_decomposition'
  ));
  assert.ok(pkg.roleDecompositionEdges.some((edge) =>
    edge.parent_representation_id === 'make_crude_steel__h2_dri_decomposition'
    && edge.child_role_id === 'make_direct_reduced_iron'
    && edge.is_required === true
  ));
  assert.ok(pkg.rolePresentationMetadata.some((role) =>
    role.role_id === 'account_land_carbon_stock_change'
    && role.emissions_importance_band === 'sink'
    && role.role_metric?.baseline_direct_net_emissions_mtco2e === -73.7
  ));
  assert.ok(pkg.physicalEdges.some((edge) =>
    edge.edge_kind === 'sends_captured_co2_to'
    && edge.from_node_id === 'capture_point_source_co2'
    && edge.to_node_id === 'transport_captured_co2'
  ));
  assert.ok(pkg.physicalEdges.some((edge) =>
    edge.edge_kind === 'sends_captured_co2_to'
    && edge.from_node_id === 'transport_captured_co2'
    && edge.to_node_id === 'store_captured_co2'
  ));
});

test('web package loader parses methods and method-year rows with role/method names', () => {
  const pkg = loadPackage();
  const method = pkg.methods.find((row) =>
    row.role_id === 'supply_grid_electricity'
    && row.method_id === 'electricity__grid_supply__policy_frontier'
  );
  assert.ok(method);
  assert.equal(method.method_kind, 'pathway');
  assert.equal(method.is_residual, false);
  assert.ok(method.source_ids.includes('S003'));

  const methodYear = pkg.methodYears.find((row) =>
    row.role_id === 'supply_grid_electricity'
    && row.representation_id === 'supply_grid_electricity__pathway_bundle'
    && row.method_id === 'electricity__grid_supply__policy_frontier'
    && row.year === 2030
  );
  assert.ok(methodYear);
  assert.deepEqual(methodYear.input_commodities, ['coal', 'natural_gas']);
  assert.deepEqual(methodYear.input_units, ['GJ/MWh', 'GJ/MWh']);
  assert.equal(methodYear.energy_emissions_by_pollutant[0].pollutant, 'CO2e');
  assert.equal(methodYear.would_expand_to_explicit_capacity, true);
});

test('web package loader removes old family/state package file paths', () => {
  const pkg = loadPackage();
  const oldPackagePaths = pkg.enrichment.availablePaths.filter((path) =>
    path.startsWith('families/')
    || path.startsWith('overlays/')
    || path.startsWith('exports/')
    || path === 'shared/families.csv'
    || path === 'schema/family_states.schema.json'
  );

  assert.deepEqual(oldPackagePaths, []);
  assert.equal(pkg.enrichment.methodYearsSchema?.title, 'Method-year rows');
  assert.equal(Boolean(pkg.enrichment.roleReadmes.supply_grid_electricity), true);
});

test('canonical role/method rows expose only canonical app fields', () => {
  const pkg = loadPackage();
  const electricity = pkg.resolvedMethodYears.find((row) =>
    row.role_id === 'supply_grid_electricity'
    && row.method_id === 'electricity__grid_supply__incumbent_thermal_mix'
    && row.year === 2025
  );

  assert.ok(electricity);
  assert.equal(electricity.output_id, 'electricity');
  assert.equal(electricity.method_label, 'Incumbent thermal-heavy grid mix');
  assert.equal('service_or_output_name' in electricity, false);
  assert.equal('state_id' in electricity, false);
  assert.equal('family_id' in electricity, false);

  const efficiencyTrack = pkg.autonomousEfficiencyTracks.find((row) =>
    row.role_id === 'move_freight_by_road'
  );
  assert.ok(efficiencyTrack);
  assert.equal(efficiencyTrack.applicable_method_ids.length > 0, true);
  assert.equal('applicable_state_ids' in efficiencyTrack, false);
  assert.equal('family_id' in efficiencyTrack, false);
});
