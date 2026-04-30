import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPackage } from '../src/data/packageLoader.ts';

test('web package loader reads canonical role-topology files', () => {
  const pkg = loadPackage();

  assert.equal(pkg.roleMetadata.length, 31);
  assert.equal(pkg.roleMetrics.length, 31);
  assert.equal(pkg.representations.length, 32);
  assert.equal(pkg.roleDecompositionEdges.length, 3);
  assert.equal(pkg.methods.length, 60);
  assert.equal(pkg.methodYears.length, 360);
  assert.equal(pkg.roleDemands.length, 31);

  assert.ok(pkg.roleMetadata.some((role) => role.role_id === 'supply_electricity'));
  assert.ok(pkg.roleMetrics.some((metric) =>
    metric.role_id === 'supply_electricity'
    && metric.emissions_importance_band === 'very_high'
    && metric.baseline_direct_gross_emissions_mtco2e > 100
  ));
  assert.ok(pkg.representations.some((representation) =>
    representation.representation_id === 'produce_crude_steel__h2_dri_decomposition'
    && representation.representation_kind === 'role_decomposition'
  ));
  assert.ok(pkg.roleDecompositionEdges.some((edge) =>
    edge.parent_representation_id === 'produce_crude_steel__h2_dri_decomposition'
    && edge.child_role_id === 'produce_direct_reduced_iron'
    && edge.is_required === true
  ));
  assert.ok(pkg.rolePresentationMetadata.some((role) =>
    role.role_id === 'account_residual_lulucf_sink'
    && role.emissions_importance_band === 'sink'
    && role.role_metric?.baseline_direct_net_emissions_mtco2e === -73.7
  ));
});

test('web package loader parses methods and method-year rows with role/method names', () => {
  const pkg = loadPackage();
  const method = pkg.methods.find((row) =>
    row.role_id === 'supply_electricity'
    && row.method_id === 'electricity__grid_supply__policy_frontier'
  );
  assert.ok(method);
  assert.equal(method.method_kind, 'pathway');
  assert.equal(method.is_residual, false);
  assert.ok(method.source_ids.includes('S003'));

  const methodYear = pkg.methodYears.find((row) =>
    row.role_id === 'supply_electricity'
    && row.representation_id === 'supply_electricity__pathway_bundle'
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
  assert.equal(Boolean(pkg.enrichment.roleReadmes.supply_electricity), true);
});

test('canonical role/method rows are bridged into the current app harness', () => {
  const pkg = loadPackage();
  const electricity = pkg.resolvedMethodYears.find((row) =>
    row.role_id === 'supply_electricity'
    && row.method_id === 'electricity__grid_supply__incumbent_thermal_mix'
    && row.year === 2025
  );

  assert.ok(electricity);
  assert.equal(electricity.service_or_output_name, 'electricity');
  assert.equal(electricity.state_id, electricity.method_id);
  assert.equal(electricity.method_label, electricity.state_label);

  const efficiencyTrack = pkg.autonomousEfficiencyTracks.find((row) =>
    row.role_id === 'deliver_freight_road_transport'
  );
  assert.ok(efficiencyTrack);
  assert.deepEqual(efficiencyTrack.applicable_state_ids, efficiencyTrack.applicable_method_ids);
});
