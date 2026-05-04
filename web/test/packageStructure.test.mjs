import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parseCsv } from '../src/data/parseCsv.ts';

const PACKAGE_ROOT = join(import.meta.dirname, '../../energy_system_representation_library');
const MILESTONE_YEARS = ['2025', '2030', '2035', '2040', '2045', '2050'];
const ROLE_HEADERS = [
  'role_id',
  'role_label',
  'description',
  'topology_area_id',
  'topology_area_label',
  'parent_role_id',
  'balance_type',
  'output_unit',
  'activation_class',
  'notes',
];
const ROLE_ACTIVITY_DRIVER_HEADERS = [
  'driver_id',
  'role_id',
  'driver_kind',
  'anchor_year',
  'anchor_value',
  'unit',
  'growth_curve_id',
  'parent_role_id',
  'parent_activity_coefficient',
  'source_role',
  'coverage_note',
  'notes',
];
const ROLE_METRIC_HEADERS = [
  'role_id',
  'baseline_year',
  'activity_value',
  'activity_unit',
  'baseline_direct_gross_emissions_mtco2e',
  'baseline_direct_net_emissions_mtco2e',
  'emissions_importance_band',
  'metric_basis',
  'notes',
];
const PHYSICAL_SYSTEM_NODE_HEADERS = [
  'node_id',
  'node_label',
  'description',
  'parent_node_id',
  'node_kind',
  'boundary',
  'display_order',
  'notes',
];
const ROLE_MEMBERSHIP_HEADERS = [
  'role_id',
  'node_id',
  'membership_kind',
  'is_primary',
  'coverage_notes',
];
const PHYSICAL_EDGE_HEADERS = [
  'edge_id',
  'from_node_id',
  'to_node_id',
  'edge_kind',
  'flow_label',
  'display_order',
  'notes',
];
const REPORTING_ALLOCATION_HEADERS = [
  'reporting_allocation_id',
  'role_id',
  'reporting_system',
  'sector',
  'subsector',
  'reporting_bucket',
  'allocation_basis',
  'allocation_share',
  'notes',
];
const REPRESENTATION_HEADERS = [
  'representation_id',
  'role_id',
  'representation_kind',
  'representation_label',
  'description',
  'is_default',
  'notes',
];
const REPRESENTATION_INCUMBENT_HEADERS = [
  'representation_id',
  'role_id',
  'anchor_year',
  'method_id',
  'incumbent_share',
  'incumbent_basis',
  'notes',
];
const ROLE_DECOMPOSITION_EDGE_HEADERS = [
  'parent_representation_id',
  'parent_role_id',
  'child_role_id',
  'edge_kind',
  'is_required',
  'display_order',
  'coverage_notes',
];
const METHOD_HEADERS = [
  'role_id',
  'representation_id',
  'method_id',
  'method_label',
  'method_description',
  'sort_order',
  'source_ids',
  'assumption_ids',
  'evidence_summary',
  'derivation_method',
  'confidence_rating',
  'review_notes',
];
const METHOD_YEAR_HEADERS = [
  'role_id',
  'representation_id',
  'method_id',
  'year',
  'output_cost_per_unit',
  'cost_basis_year',
  'currency',
  'cost_components_summary',
  'input_commodities',
  'input_coefficients',
  'input_units',
  'input_basis_notes',
  'energy_emissions_by_pollutant',
  'process_emissions_by_pollutant',
  'emissions_units',
  'emissions_boundary_notes',
  'max_share',
  'max_activity',
  'min_share',
  'rollout_limit_notes',
  'availability_conditions',
  'source_ids',
  'assumption_ids',
  'evidence_summary',
  'derivation_method',
  'confidence_rating',
  'review_notes',
  'candidate_expansion_pathway',
  'times_or_vedalang_mapping_notes',
  'would_expand_to_explicit_capacity',
  'would_expand_to_process_chain',
];
const DEMAND_HEADERS = [
  'role_id',
  'anchor_year',
  'anchor_value',
  'unit',
  'demand_growth_curve_id',
  'anchor_status',
  'source_role',
  'coverage_note',
  'notes',
];
const AUTONOMOUS_EFFICIENCY_HEADERS = [
  'role_id',
  'track_id',
  'year',
  'track_label',
  'track_description',
  'applicable_method_ids',
  'affected_input_commodities',
  'input_multipliers',
  'delta_output_cost_per_unit',
  'cost_basis_year',
  'currency',
  'source_ids',
  'assumption_ids',
  'evidence_summary',
  'derivation_method',
  'confidence_rating',
  'double_counting_guardrail',
  'review_notes',
];
const EFFICIENCY_PACKAGE_HEADERS = [
  'role_id',
  'package_id',
  'year',
  'package_label',
  'package_description',
  'classification',
  'applicable_method_ids',
  'affected_input_commodities',
  'input_multipliers',
  'delta_output_cost_per_unit',
  'cost_basis_year',
  'currency',
  'max_share',
  'rollout_limit_notes',
  'source_ids',
  'assumption_ids',
  'evidence_summary',
  'derivation_method',
  'confidence_rating',
  'review_notes',
  'non_stacking_group',
];
const ROLE_VALIDATION_HEADERS = [
  'role_id',
  'method_count',
  'method_year_row_count',
  'default_method_id',
  'anchor_year',
  'anchor_value',
  'anchor_unit',
  'validation_status',
  'notes',
];
const REPRESENTATION_KINDS = new Set([
  'pathway_bundle',
  'residual_stub',
  'role_decomposition',
  'technology_bundle',
]);
const DIRECT_REPRESENTATION_KINDS = new Set(['pathway_bundle', 'residual_stub', 'technology_bundle']);
const INCUMBENT_BASES = new Set(['default_pathway_method', 'residual_incumbent_method', 'technology_incumbent_mix']);
const ACTIVATION_CLASSES = new Set(['top_level', 'decomposition_child']);
const ROLE_ACTIVITY_DRIVER_KINDS = new Set([
  'baseline_scale_factor',
  'exogenous_series',
  'linked_parent_activity',
  'service_or_product_demand',
]);
const EMISSIONS_IMPORTANCE_BANDS = new Set([
  'very_high',
  'high',
  'medium',
  'low',
  'very_low',
  'zero',
  'sink',
  'unknown',
]);
const PHYSICAL_NODE_KINDS = new Set([
  'cluster',
  'root',
]);
const ROLE_MEMBERSHIP_KINDS = new Set(['cluster_membership']);
const PHYSICAL_EDGE_KINDS = new Set(['groups_with', 'flows_to']);
const BALANCE_TYPES = new Set([
  'accounting_obligation',
  'carbon_removal',
  'commodity_supply',
  'intermediate_conversion',
  'intermediate_material',
  'service_demand',
]);
const CONFIDENCE_RATINGS = new Set(['High', 'Medium', 'Low', 'Exploratory']);
const EXPECTED_ROLE_IDS = new Set([
  'serve_residential_building_occupants',
  'provide_residential_water_heating',
  'serve_commercial_building_occupants',
  'account_remaining_residential_building_services',
  'account_remaining_commercial_building_services',
  'move_passengers_by_road',
  'move_freight_by_road',
  'move_passengers_by_rail',
  'move_freight_by_rail',
  'move_passengers_by_air',
  'move_freight_by_marine',
  'account_other_non_road_transport_activity',
  'deliver_low_temperature_heat',
  'deliver_medium_temperature_heat',
  'deliver_high_temperature_heat',
  'make_crude_steel',
  'make_non_h2_dri_crude_steel',
  'make_direct_reduced_iron',
  'melt_and_refine_dri_into_crude_steel',
  'make_cement_equivalent',
  'make_clinker_intermediate',
  'generate_cement_kiln_heat',
  'grind_blend_cement_equivalent',
  'make_chemical_products',
  'make_other_material_products',
  'supply_grid_electricity',
  'account_grid_losses_and_own_use',
  'account_residual_mining_energy',
  'account_residual_fugitives',
  'supply_domestic_gas',
  'supply_domestic_liquid_fuels',
  'supply_domestic_solid_fuels',
  'supply_domestic_bioenergy',
  'supply_domestic_hydrogen',
  'supply_domestic_derived_fuels',
  'supply_thermal_coal_to_export_gate',
  'supply_metallurgical_coal_to_export_gate',
  'supply_iron_ore_to_export_gate',
  'raise_livestock_output',
  'grow_crops_and_horticulture_output',
  'account_livestock_biogenic_emissions',
  'account_soil_fertiliser_residue_emissions',
  'account_residual_construction',
  'provide_water_services',
  'manage_waste_emissions',
  'account_residual_other_sectors',
  'remove_co2_through_land_sequestration',
  'remove_co2_through_engineered_removals',
  'capture_point_source_co2',
  'transport_captured_co2',
  'store_captured_co2',
  'account_land_carbon_stock_change',
]);

function readText(relativePath) {
  return readFileSync(join(PACKAGE_ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function parseHeader(relativePath) {
  return readText(relativePath).split(/\r?\n/, 1)[0].split(',');
}

function parseJsonArray(raw, label) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    assert.fail(`${label} should parse as JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertResolvesJsonIds(raw, allowedIds, label) {
  for (const id of parseJsonArray(raw, label)) {
    assert.equal(allowedIds.has(id), true, `${label} id ${id} must resolve`);
  }
}

function assertMilestoneCoverage(rows, idKey, ownerId) {
  const ids = new Set(rows.map((row) => row[idKey]));
  for (const id of ids) {
    const years = rows
      .filter((row) => row[idKey] === id)
      .map((row) => row.year)
      .sort((left, right) => Number(left) - Number(right));
    assert.deepEqual(years, MILESTONE_YEARS, `${ownerId}.${id} must cover every milestone year`);
  }
}

function assertUnique(rows, getKey, label) {
  const seen = new Set();
  for (const row of rows) {
    const key = getKey(row);
    assert.equal(seen.has(key), false, `${label} ${key} must be unique`);
    seen.add(key);
  }
}

function groupBy(rows, getKey) {
  const grouped = new Map();
  for (const row of rows) {
    const key = getKey(row);
    const group = grouped.get(key) ?? [];
    group.push(row);
    grouped.set(key, group);
  }
  return grouped;
}

function assertAcyclicRoleTopology(roles) {
  const roleById = new Map(roles.map((role) => [role.role_id, role]));
  for (const role of roles) {
    const seen = new Set([role.role_id]);
    let parentRoleId = role.parent_role_id;
    while (parentRoleId) {
      assert.equal(roleById.has(parentRoleId), true, `${role.role_id} parent ${parentRoleId} must resolve`);
      assert.equal(seen.has(parentRoleId), false, `${role.role_id} parent chain must not contain a cycle through ${parentRoleId}`);
      seen.add(parentRoleId);
      parentRoleId = roleById.get(parentRoleId)?.parent_role_id ?? '';
    }
  }
}

function assertAcyclicPhysicalSystemNodes(nodes) {
  const nodeById = new Map(nodes.map((node) => [node.node_id, node]));
  const rootNodes = nodes.filter((node) => node.parent_node_id === '');
  assert.equal(rootNodes.length, 1, 'physical system graph must have exactly one root node');
  assert.equal(rootNodes[0].node_kind, 'root', 'physical system root node must have root kind');

  for (const node of nodes) {
    assert.equal(PHYSICAL_NODE_KINDS.has(node.node_kind), true, `${node.node_id} node kind must be canonical`);
    assert.equal(Number.isInteger(Number(node.display_order)), true, `${node.node_id} display_order must be an integer`);
    if (node.node_kind === 'root') {
      assert.equal(node.parent_node_id, '', `${node.node_id} root node must not name a parent`);
    } else {
      assert.notEqual(node.parent_node_id, '', `${node.node_id} non-root node must name a parent`);
    }

    const seen = new Set([node.node_id]);
    let parentNodeId = node.parent_node_id;
    while (parentNodeId) {
      assert.equal(nodeById.has(parentNodeId), true, `${node.node_id} parent ${parentNodeId} must resolve`);
      assert.equal(seen.has(parentNodeId), false, `${node.node_id} parent chain must not contain a cycle through ${parentNodeId}`);
      seen.add(parentNodeId);
      parentNodeId = nodeById.get(parentNodeId)?.parent_node_id ?? '';
    }
  }
}

test('energy system representation library package structure is internally consistent', () => {
  const roles = parseCsv(readText('shared/roles.csv'));
  const roleActivityDrivers = parseCsv(readText('shared/role_activity_drivers.csv'));
  const roleMetrics = parseCsv(readText('shared/role_metrics.csv'));
  const physicalSystemNodes = parseCsv(readText('shared/physical_system_nodes.csv'));
  const roleMemberships = parseCsv(readText('shared/role_memberships.csv'));
  const physicalEdges = parseCsv(readText('shared/physical_edges.csv'));
  const representations = parseCsv(readText('shared/representations.csv'));
  const representationIncumbents = parseCsv(readText('shared/representation_incumbents.csv'));
  const roleDecompositionEdges = parseCsv(readText('shared/role_decomposition_edges.csv'));
  const reportingAllocations = parseCsv(readText('shared/reporting_allocations.csv'));
  const roleValidationSummary = parseCsv(readText('validation/role_validation_summary.csv'));
  const sourceIds = new Set(parseCsv(readText('shared/source_ledger.csv')).map((row) => row.source_id));
  const assumptionIds = new Set(parseCsv(readText('shared/assumptions_ledger.csv')).map((row) => row.assumption_id));
  const demandCurveIds = new Set(parseCsv(readText('shared/demand_growth_curves.csv')).map((row) => row.demand_growth_curve_id));
  const roleIds = new Set(roles.map((role) => role.role_id));
  const physicalNodeIds = new Set(physicalSystemNodes.map((node) => node.node_id));
  const roleById = new Map(roles.map((role) => [role.role_id, role]));
  const representationById = new Map(representations.map((representation) => [representation.representation_id, representation]));
  const edgesByParentRepresentation = groupBy(roleDecompositionEdges, (edge) => edge.parent_representation_id);
  const requiredChildEdgesByRole = groupBy(
    roleDecompositionEdges.filter((edge) => edge.is_required === 'true'),
    (edge) => edge.child_role_id,
  );
  const defaultCountByRole = new Map();

  assert.deepEqual(parseHeader('shared/roles.csv'), ROLE_HEADERS);
  assert.deepEqual(parseHeader('shared/role_activity_drivers.csv'), ROLE_ACTIVITY_DRIVER_HEADERS);
  assert.deepEqual(parseHeader('shared/role_metrics.csv'), ROLE_METRIC_HEADERS);
  assert.deepEqual(parseHeader('shared/physical_system_nodes.csv'), PHYSICAL_SYSTEM_NODE_HEADERS);
  assert.deepEqual(parseHeader('shared/role_memberships.csv'), ROLE_MEMBERSHIP_HEADERS);
  assert.deepEqual(parseHeader('shared/physical_edges.csv'), PHYSICAL_EDGE_HEADERS);
  assert.deepEqual(parseHeader('shared/representations.csv'), REPRESENTATION_HEADERS);
  assert.deepEqual(parseHeader('shared/representation_incumbents.csv'), REPRESENTATION_INCUMBENT_HEADERS);
  assert.deepEqual(parseHeader('shared/role_decomposition_edges.csv'), ROLE_DECOMPOSITION_EDGE_HEADERS);
  assert.deepEqual(parseHeader('shared/reporting_allocations.csv'), REPORTING_ALLOCATION_HEADERS);
  assert.deepEqual(parseHeader('validation/role_validation_summary.csv'), ROLE_VALIDATION_HEADERS);
  assertUnique(roles, (role) => role.role_id, 'role_id');
  assertUnique(roleActivityDrivers, (driver) => driver.driver_id, 'role activity driver_id');
  assertUnique(roleMetrics, (metric) => metric.role_id, 'role metric role_id');
  assertUnique(physicalSystemNodes, (node) => node.node_id, 'physical node_id');
  assertUnique(roleMemberships, (membership) => `${membership.role_id}::${membership.node_id}`, 'role membership');
  assertUnique(physicalEdges, (edge) => edge.edge_id, 'physical edge_id');
  assertUnique(representations, (representation) => representation.representation_id, 'representation_id');
  assertUnique(
    representationIncumbents,
    (incumbent) => `${incumbent.representation_id}::${incumbent.anchor_year}::${incumbent.method_id}`,
    'representation incumbent',
  );
  assertUnique(roleDecompositionEdges, (edge) => `${edge.parent_representation_id}::${edge.child_role_id}`, 'role decomposition edge');
  assertUnique(reportingAllocations, (allocation) => allocation.reporting_allocation_id, 'reporting_allocation_id');
  assertUnique(roleValidationSummary, (summary) => summary.role_id, 'validation summary role_id');
  assert.deepEqual(roleIds, EXPECTED_ROLE_IDS);
  assert.equal(roles.length, 52);
  assert.equal(roleActivityDrivers.length, roles.length);
  assert.equal(roleMetrics.length, roles.length);
  const defaultRepresentationByRole = new Map();
  for (const representation of representations) {
    if (representation.is_default === 'true') {
      defaultRepresentationByRole.set(representation.role_id, representation);
    }
  }
  assert.equal(
    representations.filter((representation) => representation.representation_kind === 'residual_stub').length,
    28,
    'expected 28 residual_stub representations after the role-first ontology migration',
  );
  assert.equal(
    roles.filter((role) => defaultRepresentationByRole.get(role.role_id)?.representation_kind === 'residual_stub').length,
    28,
    'expected 28 roles whose default representation is a residual_stub placeholder',
  );
  assert.equal(representations.length, roles.length + 4);
  assert.equal(representationIncumbents.length, roles.length + 4);
  assert.equal(reportingAllocations.length, roles.length);
  assert.equal(roleValidationSummary.length, roles.length);
  assertAcyclicRoleTopology(roles);
  assertAcyclicPhysicalSystemNodes(physicalSystemNodes);

  const activityDriversByRole = groupBy(roleActivityDrivers, (driver) => driver.role_id);
  for (const role of roles) {
    assert.equal(activityDriversByRole.get(role.role_id)?.length, 1, `${role.role_id} must have exactly one activity driver`);
  }
  for (const driver of roleActivityDrivers) {
    const role = roleById.get(driver.role_id);
    assert.ok(role, `${driver.role_id} activity driver role must resolve`);
    assert.equal(ROLE_ACTIVITY_DRIVER_KINDS.has(driver.driver_kind), true, `${driver.driver_id} driver kind must be canonical`);
    assert.equal(MILESTONE_YEARS.includes(driver.anchor_year), true, `${driver.driver_id} anchor year must be a milestone`);
    assert.equal(Number.isFinite(Number(driver.anchor_value)), true, `${driver.driver_id} anchor value must be numeric`);
    if (driver.driver_kind === 'baseline_scale_factor') {
      const defaultRepresentation = defaultRepresentationByRole.get(role.role_id);
      assert.equal(
        defaultRepresentation?.representation_kind,
        'residual_stub',
        `${driver.driver_id} baseline scale factor should belong to a role modelled as a residual_stub representation`,
      );
      assert.equal(driver.anchor_value, '1', `${driver.driver_id} baseline scale factor should anchor to one activity unit`);
    }
    if (driver.driver_kind === 'linked_parent_activity') {
      assert.equal(role.activation_class, 'decomposition_child', `${driver.driver_id} linked parent driver should belong to a decomposition child role`);
      assert.equal(driver.parent_role_id, role.parent_role_id, `${driver.driver_id} parent role should match roles.csv`);
      assert.equal(roleIds.has(driver.parent_role_id), true, `${driver.driver_id} parent role must resolve`);
      assert.equal(Number.isFinite(Number(driver.parent_activity_coefficient)), true, `${driver.driver_id} parent activity coefficient must be numeric`);
    } else {
      assert.equal(driver.parent_role_id, '', `${driver.driver_id} non-linked driver must not name a parent role`);
      assert.equal(driver.parent_activity_coefficient, '', `${driver.driver_id} non-linked driver must not carry a parent activity coefficient`);
    }
  }

  for (const metric of roleMetrics) {
    assert.equal(roleIds.has(metric.role_id), true, `${metric.role_id} metric role must resolve`);
    assert.equal(metric.baseline_year, '2025', `${metric.role_id} metric baseline year must be 2025`);
    assert.equal(Number.isFinite(Number(metric.activity_value)), true, `${metric.role_id} metric activity value must be numeric`);
    assert.notEqual(metric.activity_unit, '', `${metric.role_id} metric activity unit must be present`);
    assert.equal(
      EMISSIONS_IMPORTANCE_BANDS.has(metric.emissions_importance_band),
      true,
      `${metric.role_id} metric band must be canonical`,
    );
    assert.notEqual(metric.metric_basis, '', `${metric.role_id} metric basis must be present`);
    assert.notEqual(metric.notes, '', `${metric.role_id} metric notes must be present`);
    if (metric.emissions_importance_band === 'unknown') {
      assert.equal(metric.baseline_direct_gross_emissions_mtco2e, '', `${metric.role_id} unknown gross metric must be blank`);
      assert.equal(metric.baseline_direct_net_emissions_mtco2e, '', `${metric.role_id} unknown net metric must be blank`);
    } else {
      assert.equal(
        Number.isFinite(Number(metric.baseline_direct_gross_emissions_mtco2e)),
        true,
        `${metric.role_id} gross metric must be numeric`,
      );
      assert.equal(
        Number.isFinite(Number(metric.baseline_direct_net_emissions_mtco2e)),
        true,
        `${metric.role_id} net metric must be numeric`,
      );
    }
    if (metric.emissions_importance_band === 'sink') {
      assert.equal(Number(metric.baseline_direct_net_emissions_mtco2e) < 0, true, `${metric.role_id} sink metric must be net-negative`);
    }
  }

  const membershipsByRole = groupBy(roleMemberships, (membership) => membership.role_id);
  const primaryMembershipsByRole = groupBy(
    roleMemberships.filter((membership) => membership.is_primary === 'true'),
    (membership) => membership.role_id,
  );
  for (const membership of roleMemberships) {
    assert.equal(roleIds.has(membership.role_id), true, `${membership.role_id} membership role must resolve`);
    assert.equal(physicalNodeIds.has(membership.node_id), true, `${membership.node_id} membership node must resolve`);
    assert.equal(ROLE_MEMBERSHIP_KINDS.has(membership.membership_kind), true, `${membership.role_id} membership kind must be canonical`);
    assert.match(membership.is_primary, /^(true|false)$/, `${membership.role_id} is_primary must be true or false`);
  }
  for (const role of roles) {
    assert.equal(membershipsByRole.has(role.role_id), true, `${role.role_id} must have a physical node membership`);
    assert.equal(primaryMembershipsByRole.get(role.role_id)?.length, 1, `${role.role_id} must have exactly one primary physical membership`);
  }

  for (const edge of physicalEdges) {
    assert.equal(physicalNodeIds.has(edge.from_node_id), true, `${edge.edge_id} from_node_id must resolve`);
    assert.equal(physicalNodeIds.has(edge.to_node_id), true, `${edge.edge_id} to_node_id must resolve`);
    assert.notEqual(edge.from_node_id, edge.to_node_id, `${edge.edge_id} must not be a self edge`);
    assert.equal(PHYSICAL_EDGE_KINDS.has(edge.edge_kind), true, `${edge.edge_id} edge kind must be canonical`);
    assert.equal(Number.isInteger(Number(edge.display_order)), true, `${edge.edge_id} display_order must be an integer`);
  }

  for (const role of roles) {
    assert.equal(BALANCE_TYPES.has(role.balance_type), true, `${role.role_id} balance type must be canonical`);
    assert.equal(ACTIVATION_CLASSES.has(role.activation_class), true, `${role.role_id} activation class must be canonical`);
    if (role.activation_class === 'decomposition_child') {
      assert.notEqual(role.parent_role_id, '', `${role.role_id} decomposition child must name a parent role`);
      assert.equal(requiredChildEdgesByRole.has(role.role_id), true, `${role.role_id} decomposition child must be activated by a required edge`);
      assert.equal(requiredChildEdgesByRole.get(role.role_id)?.length, 1, `${role.role_id} decomposition child must have one required activation edge`);
    } else {
      assert.equal(role.parent_role_id, '', `${role.role_id} top-level role must not name a parent role`);
    }
  }

  for (const representation of representations) {
    const role = roleById.get(representation.role_id);
    assert.ok(role, `${representation.representation_id} role must resolve`);
    assert.equal(REPRESENTATION_KINDS.has(representation.representation_kind), true, `${representation.representation_id} kind must be canonical`);
    if (representation.is_default === 'true') {
      defaultCountByRole.set(representation.role_id, (defaultCountByRole.get(representation.role_id) ?? 0) + 1);
    } else {
      assert.equal(representation.is_default, 'false', `${representation.representation_id} is_default must be true or false`);
    }
    const decompositionEdges = edgesByParentRepresentation.get(representation.representation_id) ?? [];
    if (representation.representation_kind === 'role_decomposition') {
      assert.equal(decompositionEdges.length > 0, true, `${representation.representation_id} decomposition must activate child roles`);
    } else {
      assert.equal(
        DIRECT_REPRESENTATION_KINDS.has(representation.representation_kind),
        true,
        `${representation.representation_id} direct representation kind must be canonical`,
      );
      assert.equal(decompositionEdges.length, 0, `${representation.representation_id} direct bundle must not activate child roles`);
    }
  }
  for (const role of roles) {
    assert.equal(defaultCountByRole.get(role.role_id), 1, `${role.role_id} must have exactly one default representation`);
  }

  const methodsByRepresentationAndId = new Map();
  for (const role of roles) {
    for (const method of parseCsv(readText(`roles/${role.role_id}/methods.csv`))) {
      methodsByRepresentationAndId.set(`${method.representation_id}::${method.method_id}`, method);
    }
  }
  const incumbentsByRepresentationYear = groupBy(
    representationIncumbents,
    (incumbent) => `${incumbent.representation_id}::${incumbent.anchor_year}`,
  );
  for (const representation of representations) {
    const incumbentRows = representationIncumbents.filter((incumbent) => incumbent.representation_id === representation.representation_id);
    if (representation.representation_kind === 'role_decomposition') {
      assert.equal(incumbentRows.length, 0, `${representation.representation_id} decomposition must not have incumbent method rows`);
      continue;
    }

    assert.equal(incumbentRows.length > 0, true, `${representation.representation_id} direct representation must have incumbent rows`);
  }
  for (const incumbent of representationIncumbents) {
    const representation = representationById.get(incumbent.representation_id);
    assert.ok(representation, `${incumbent.representation_id} incumbent representation must resolve`);
    assert.notEqual(representation.representation_kind, 'role_decomposition', `${incumbent.representation_id} incumbent must belong to a direct representation`);
    assert.equal(incumbent.role_id, representation.role_id, `${incumbent.representation_id} incumbent role must match representation role`);
    assert.equal(MILESTONE_YEARS.includes(incumbent.anchor_year), true, `${incumbent.representation_id} incumbent anchor year must be a milestone`);
    assert.equal(methodsByRepresentationAndId.has(`${incumbent.representation_id}::${incumbent.method_id}`), true, `${incumbent.method_id} must resolve inside ${incumbent.representation_id}`);
    assert.equal(INCUMBENT_BASES.has(incumbent.incumbent_basis), true, `${incumbent.representation_id} incumbent basis must be canonical`);
    const incumbentShare = Number(incumbent.incumbent_share);
    assert.equal(Number.isFinite(incumbentShare), true, `${incumbent.representation_id} incumbent share must be numeric`);
    assert.equal(incumbentShare > 0 && incumbentShare <= 1, true, `${incumbent.representation_id} incumbent share must be within (0, 1]`);
  }
  for (const [key, incumbentRows] of incumbentsByRepresentationYear) {
    const incumbentShare = incumbentRows.reduce((sum, row) => sum + Number(row.incumbent_share), 0);
    assert.equal(Math.abs(incumbentShare - 1) < 1e-9, true, `${key} incumbent shares must resolve to 1`);
  }

  for (const edge of roleDecompositionEdges) {
    const parentRepresentation = representationById.get(edge.parent_representation_id);
    assert.ok(parentRepresentation, `${edge.parent_representation_id} must resolve to representations.csv`);
    assert.equal(parentRepresentation.representation_kind, 'role_decomposition', `${edge.parent_representation_id} must be a decomposition`);
    assert.equal(edge.parent_role_id, parentRepresentation.role_id, `${edge.parent_representation_id} parent role must match representation role`);
    assert.equal(roleIds.has(edge.child_role_id), true, `${edge.child_role_id} must resolve to roles.csv`);
    assert.match(edge.edge_kind, /^(required_child|optional_child)$/);
    assert.equal(edge.is_required, edge.edge_kind === 'required_child' ? 'true' : 'false', `${edge.child_role_id} required flag must match edge kind`);
    assert.notEqual(edge.parent_role_id, edge.child_role_id, `${edge.child_role_id} must not be its own parent`);
    assert.equal(roleById.get(edge.child_role_id)?.parent_role_id, edge.parent_role_id, `${edge.child_role_id} must point back to ${edge.parent_role_id}`);
  }

  const crudeSteelRepresentations = representations.filter((representation) => representation.role_id === 'make_crude_steel');
  assert.deepEqual(
    new Set(crudeSteelRepresentations.map((representation) => representation.representation_kind)),
    new Set(['pathway_bundle', 'role_decomposition']),
    'make_crude_steel should expose aggregate and decomposed representations',
  );
  const crudeSteelDecomposition = representationById.get('make_crude_steel__h2_dri_decomposition');
  assert.ok(crudeSteelDecomposition, 'crude-steel decomposition representation must exist');
  assert.equal(crudeSteelDecomposition.is_default, 'false', 'crude-steel decomposition should not replace the aggregate default');
  const crudeSteelChildren = roleDecompositionEdges
    .filter((edge) => edge.parent_representation_id === 'make_crude_steel__h2_dri_decomposition')
    .sort((left, right) => Number(left.display_order) - Number(right.display_order));
  assert.deepEqual(
    crudeSteelChildren.map((edge) => edge.child_role_id),
    [
      'make_non_h2_dri_crude_steel',
      'make_direct_reduced_iron',
      'melt_and_refine_dri_into_crude_steel',
    ],
    'crude-steel decomposition should activate the non-H2 residual, DRI, and melt/refine children',
  );
  for (const edge of crudeSteelChildren) {
    assert.equal(edge.edge_kind, 'required_child', `${edge.child_role_id} should be required`);
    assert.equal(edge.is_required, 'true', `${edge.child_role_id} should be required`);
    assert.equal(roleById.get(edge.child_role_id)?.parent_role_id, 'make_crude_steel', `${edge.child_role_id} should point back to make_crude_steel`);
  }
  assert.deepEqual(
    new Set(parseCsv(readText('roles/make_non_h2_dri_crude_steel/methods.csv')).map((method) => method.method_id)),
    new Set([
      'steel__crude_steel_non_h2__bf_bof_conventional',
      'steel__crude_steel_non_h2__scrap_eaf',
      'steel__crude_steel_non_h2__bf_bof_ccs_transition',
    ]),
    'non-H2 residual child should preserve explicit non-H2 crude-steel coverage',
  );
  assert.deepEqual(
    new Set(parseCsv(readText('roles/make_direct_reduced_iron/methods.csv')).map((method) => method.method_id)),
    new Set([
      'steel__dri__h2_shaft_furnace',
      'steel__dri__gas_shaft_furnace',
      'steel__dri__imported_residual',
    ]),
    'DRI child should expose technology methods',
  );
  assert.deepEqual(
    new Set(parseCsv(readText('roles/melt_and_refine_dri_into_crude_steel/methods.csv')).map((method) => method.method_id)),
    new Set([
      'steel__dri_melt_refine__eaf_finishing',
      'steel__dri_melt_refine__electric_smelter',
    ]),
    'melt/refine child should expose finishing methods',
  );

  const cementRepresentations = representations.filter((representation) => representation.role_id === 'make_cement_equivalent');
  assert.deepEqual(
    new Set(cementRepresentations.map((representation) => representation.representation_kind)),
    new Set(['pathway_bundle', 'role_decomposition']),
    'make_cement_equivalent should expose aggregate and decomposed representations',
  );
  const cementDecomposition = representationById.get('make_cement_equivalent__clinker_decomposition');
  assert.ok(cementDecomposition, 'cement decomposition representation must exist');
  assert.equal(cementDecomposition.is_default, 'false', 'cement decomposition should not replace the aggregate default');
  const cementChildren = roleDecompositionEdges
    .filter((edge) => edge.parent_representation_id === 'make_cement_equivalent__clinker_decomposition')
    .sort((left, right) => Number(left.display_order) - Number(right.display_order));
  assert.deepEqual(
    cementChildren.map((edge) => edge.child_role_id),
    [
      'make_clinker_intermediate',
      'generate_cement_kiln_heat',
      'grind_blend_cement_equivalent',
    ],
    'cement decomposition should activate clinker, kiln heat, and finish grinding children',
  );
  for (const edge of cementChildren) {
    assert.equal(edge.edge_kind, 'required_child', `${edge.child_role_id} should be required`);
    assert.equal(edge.is_required, 'true', `${edge.child_role_id} should be required`);
    assert.equal(roleById.get(edge.child_role_id)?.parent_role_id, 'make_cement_equivalent', `${edge.child_role_id} should point back to make_cement_equivalent`);
  }

  const reportingRoleIds = new Set(reportingAllocations.map((allocation) => allocation.role_id));
  for (const allocation of reportingAllocations) {
    assert.equal(roleIds.has(allocation.role_id), true, `${allocation.role_id} reporting allocation must resolve`);
    assert.equal(allocation.reporting_system, 'phase1_package_accounting');
    assert.equal(allocation.allocation_basis, 'role_activity');
    assert.equal(Number(allocation.allocation_share), 1);
    assert.notEqual(allocation.sector, '', `${allocation.role_id} must declare a reporting sector`);
    assert.notEqual(allocation.subsector, '', `${allocation.role_id} must declare a reporting subsector`);
  }
  for (const [key, allocations] of groupBy(reportingAllocations, (allocation) => `${allocation.reporting_system}::${allocation.role_id}`)) {
    const allocationShare = allocations.reduce((sum, allocation) => sum + Number(allocation.allocation_share), 0);
    assert.equal(Number.isFinite(allocationShare), true, `${key} allocation share must be numeric`);
    assert.equal(Math.abs(allocationShare - 1) < 1e-9, true, `${key} allocation share must resolve to 1`);
  }

  let totalMethods = 0;
  let totalMethodYearRows = 0;
  let autonomousTrackRowCount = 0;
  let efficiencyPackageRowCount = 0;

  for (const role of roles) {
    assert.equal(reportingRoleIds.has(role.role_id), true, `${role.role_id} should have a reporting allocation`);

    const roleDir = join(PACKAGE_ROOT, 'roles', role.role_id);
    for (const filename of ['methods.csv', 'method_years.csv', 'demand.csv', 'README.md', 'validation.md']) {
      assert.equal(existsSync(join(roleDir, filename)), true, `${role.role_id} missing ${filename}`);
    }

    assert.deepEqual(parseHeader(`roles/${role.role_id}/methods.csv`), METHOD_HEADERS);
    assert.deepEqual(parseHeader(`roles/${role.role_id}/method_years.csv`), METHOD_YEAR_HEADERS);
    assert.deepEqual(parseHeader(`roles/${role.role_id}/demand.csv`), DEMAND_HEADERS);

    const defaultRepresentation = representations.find((representation) => representation.role_id === role.role_id && representation.is_default === 'true');
    assert.ok(defaultRepresentation, `${role.role_id} must have a default representation`);

    const methods = parseCsv(readText(`roles/${role.role_id}/methods.csv`));
    const methodYears = parseCsv(readText(`roles/${role.role_id}/method_years.csv`));
    const demandRows = parseCsv(readText(`roles/${role.role_id}/demand.csv`));
    const methodIds = new Set(methods.map((method) => method.method_id));
    const methodByRepresentationAndId = new Map(methods.map((method) => [`${method.representation_id}::${method.method_id}`, method]));
    totalMethods += methods.length;
    totalMethodYearRows += methodYears.length;

    assertUnique(methods, (method) => method.method_id, `${role.role_id} method_id`);
    assertUnique(methodYears, (row) => `${row.representation_id}::${row.method_id}::${row.year}`, `${role.role_id} method-year`);
    assert.equal(methods.length > 0, true, `${role.role_id} must expose at least one method`);
    assert.equal(methodYears.length, methods.length * MILESTONE_YEARS.length, `${role.role_id} must have one method-year row per method and milestone year`);
    assert.equal(demandRows.length, 1, `${role.role_id} should have exactly one demand row`);
    assert.equal(demandRows[0].role_id, role.role_id, `${role.role_id} demand role_id must match folder`);
    assert.equal(demandCurveIds.has(demandRows[0].demand_growth_curve_id), true, `${role.role_id} demand curve must resolve`);

    for (const method of methods) {
      const methodRepresentation = representationById.get(method.representation_id);
      assert.equal(method.role_id, role.role_id, `${role.role_id}.${method.method_id} role_id must match folder`);
      assert.ok(methodRepresentation, `${role.role_id}.${method.method_id} representation must resolve`);
      assert.equal(methodRepresentation.role_id, role.role_id, `${role.role_id}.${method.method_id} representation must belong to the same role`);
      assert.notEqual(methodRepresentation.representation_kind, 'role_decomposition', `${role.role_id}.${method.method_id} representation must be direct`);
      assert.equal(
        DIRECT_REPRESENTATION_KINDS.has(methodRepresentation.representation_kind),
        true,
        `${role.role_id}.${method.method_id} representation kind must be a direct representation`,
      );
      assert.equal(CONFIDENCE_RATINGS.has(method.confidence_rating), true, `${role.role_id}.${method.method_id} confidence must be canonical`);
      assert.equal(Number.isInteger(Number(method.sort_order)), true, `${role.role_id}.${method.method_id} sort_order must be an integer`);
      assertResolvesJsonIds(method.source_ids, sourceIds, `${role.role_id}.${method.method_id}.source_ids`);
      assertResolvesJsonIds(method.assumption_ids, assumptionIds, `${role.role_id}.${method.method_id}.assumption_ids`);
      assert.equal(
        Object.prototype.hasOwnProperty.call(method, 'method_kind'),
        false,
        `${role.role_id}.${method.method_id} must not carry method_kind; residual semantics live on the representation`,
      );
      assert.equal(
        Object.prototype.hasOwnProperty.call(method, 'is_residual'),
        false,
        `${role.role_id}.${method.method_id} must not carry is_residual; residual semantics live on the representation`,
      );
    }

    for (const row of methodYears) {
      const methodRepresentation = representationById.get(row.representation_id);
      assert.equal(row.role_id, role.role_id, `${role.role_id}.${row.method_id}.${row.year} role_id must match folder`);
      assert.ok(methodRepresentation, `${role.role_id}.${row.method_id}.${row.year} representation must resolve`);
      assert.equal(methodRepresentation.role_id, role.role_id, `${role.role_id}.${row.method_id}.${row.year} representation must belong to the same role`);
      assert.notEqual(methodRepresentation.representation_kind, 'role_decomposition', `${role.role_id}.${row.method_id}.${row.year} representation must be direct`);
      assert.equal(methodIds.has(row.method_id), true, `${role.role_id}.${row.method_id}.${row.year} method id must resolve`);
      assert.equal(
        methodByRepresentationAndId.has(`${row.representation_id}::${row.method_id}`),
        true,
        `${role.role_id}.${row.method_id}.${row.year} method representation must resolve`,
      );
      assert.equal(MILESTONE_YEARS.includes(row.year), true, `${role.role_id}.${row.method_id}.${row.year} year must be a milestone`);
      assert.equal(CONFIDENCE_RATINGS.has(row.confidence_rating), true, `${role.role_id}.${row.method_id}.${row.year} confidence must be canonical`);
      const inputCommodities = parseJsonArray(row.input_commodities, `${role.role_id}.${row.method_id}.${row.year}.input_commodities`);
      const inputCoefficients = parseJsonArray(row.input_coefficients, `${role.role_id}.${row.method_id}.${row.year}.input_coefficients`);
      const inputUnits = parseJsonArray(row.input_units, `${role.role_id}.${row.method_id}.${row.year}.input_units`);
      parseJsonArray(row.energy_emissions_by_pollutant, `${role.role_id}.${row.method_id}.${row.year}.energy_emissions_by_pollutant`);
      parseJsonArray(row.process_emissions_by_pollutant, `${role.role_id}.${row.method_id}.${row.year}.process_emissions_by_pollutant`);
      assert.equal(inputCommodities.length, inputCoefficients.length, `${role.role_id}.${row.method_id}.${row.year} input arrays must align`);
      assert.equal(inputCommodities.length, inputUnits.length, `${role.role_id}.${row.method_id}.${row.year} input arrays must align`);
      assertResolvesJsonIds(row.source_ids, sourceIds, `${role.role_id}.${row.method_id}.${row.year}.source_ids`);
      assertResolvesJsonIds(row.assumption_ids, assumptionIds, `${role.role_id}.${row.method_id}.${row.year}.assumption_ids`);
    }
    assertMilestoneCoverage(methodYears, 'method_id', role.role_id);

    const autonomousPath = join(roleDir, 'autonomous_efficiency_tracks.csv');
    if (existsSync(autonomousPath)) {
      assert.deepEqual(parseHeader(`roles/${role.role_id}/autonomous_efficiency_tracks.csv`), AUTONOMOUS_EFFICIENCY_HEADERS);
      const rows = parseCsv(readText(`roles/${role.role_id}/autonomous_efficiency_tracks.csv`));
      autonomousTrackRowCount += rows.length;
      for (const row of rows) {
        assert.equal(row.role_id, role.role_id, `${role.role_id}.${row.track_id} role_id must match folder`);
        assertResolvesJsonIds(row.applicable_method_ids, methodIds, `${role.role_id}.${row.track_id}.applicable_method_ids`);
        assertResolvesJsonIds(row.source_ids, sourceIds, `${role.role_id}.${row.track_id}.source_ids`);
        assertResolvesJsonIds(row.assumption_ids, assumptionIds, `${role.role_id}.${row.track_id}.assumption_ids`);
      }
      assertMilestoneCoverage(rows, 'track_id', role.role_id);
    }

    const packagesPath = join(roleDir, 'efficiency_packages.csv');
    if (existsSync(packagesPath)) {
      assert.deepEqual(parseHeader(`roles/${role.role_id}/efficiency_packages.csv`), EFFICIENCY_PACKAGE_HEADERS);
      const rows = parseCsv(readText(`roles/${role.role_id}/efficiency_packages.csv`));
      efficiencyPackageRowCount += rows.length;
      for (const row of rows) {
        assert.equal(row.role_id, role.role_id, `${role.role_id}.${row.package_id} role_id must match folder`);
        assertResolvesJsonIds(row.applicable_method_ids, methodIds, `${role.role_id}.${row.package_id}.applicable_method_ids`);
        assertResolvesJsonIds(row.source_ids, sourceIds, `${role.role_id}.${row.package_id}.source_ids`);
        assertResolvesJsonIds(row.assumption_ids, assumptionIds, `${role.role_id}.${row.package_id}.assumption_ids`);
      }
      assertMilestoneCoverage(rows, 'package_id', role.role_id);
    }
  }

  assert.equal(totalMethods, 92);
  assert.equal(totalMethodYearRows, 552);
  assert.equal(autonomousTrackRowCount > 0, true, 'expected at least one autonomous efficiency track row');
  assert.equal(efficiencyPackageRowCount > 0, true, 'expected at least one efficiency package row');

  const validationByRole = new Map(roleValidationSummary.map((row) => [row.role_id, row]));
  for (const role of roles) {
    const summary = validationByRole.get(role.role_id);
    assert.ok(summary, `${role.role_id} must have validation summary row`);
    assert.equal(roleById.has(summary.role_id), true, `${summary.role_id} validation summary must resolve`);
  }
});

test('canonical ESRL package does not retain family/state file surfaces', () => {
  for (const removedPath of [
    'shared/families.csv',
    'shared/system_structure_groups.csv',
    'shared/system_structure_members.csv',
    'shared/external_commodity_demands.csv',
    'schema/families.schema.json',
    'schema/family_states.schema.json',
    'schema/overlays.schema.json',
    'families',
    'overlays',
    'exports',
  ]) {
    assert.equal(existsSync(join(PACKAGE_ROOT, removedPath)), false, `${removedPath} should not remain in the canonical package`);
  }
});

test('canonical ESRL documentation uses role-topology terminology', () => {
  const roles = parseCsv(readText('shared/roles.csv'));
  const roleIds = roles.map((role) => role.role_id);
  const docPaths = [
    'README.md',
    ...readdirSync(join(PACKAGE_ROOT, 'schema'))
      .filter((filename) => filename.endsWith('.schema.json'))
      .map((filename) => `schema/${filename}`),
    ...roleIds.flatMap((roleId) => [
      `roles/${roleId}/README.md`,
      `roles/${roleId}/validation.md`,
    ]),
  ];
  const removedSemanticTerms = /family_id|state_id|family_states|resolved_method_years|service_controls|active_state_ids|ResolvedMethodYearRow|state-year|state year|state rows|family rows|family artifacts|family\/state|subfamil(?:y|ies)/i;

  for (const docPath of docPaths) {
    const text = readText(docPath);
    assert.doesNotMatch(text, removedSemanticTerms, `${docPath} should not use removed model-structure terminology`);
  }

  const packageReadme = readText('README.md');
  assert.match(packageReadme, /A role is the system function being covered/);
  assert.match(packageReadme, /Every active role must have exactly one active representation/);
  assert.match(packageReadme, /Residual coverage is explicit/);
  assert.match(packageReadme, /Reporting allocations explain how results should be grouped/);

  for (const roleId of roleIds) {
    const readme = readText(`roles/${roleId}/README.md`);
    if (readme.includes('- Role id:')) {
      assert.equal(readme.includes(`- Role id: \`${roleId}\``), true, `${roleId} README role id must match its folder`);
    }
  }
});

test('schema companions stay aligned with the authored CSV headers', () => {
  const schemaChecks = [
    ['schema/roles.schema.json', 'shared/roles.csv', ROLE_HEADERS],
    ['schema/role_activity_drivers.schema.json', 'shared/role_activity_drivers.csv', ROLE_ACTIVITY_DRIVER_HEADERS],
    ['schema/role_metrics.schema.json', 'shared/role_metrics.csv', ROLE_METRIC_HEADERS],
    ['schema/physical_system_nodes.schema.json', 'shared/physical_system_nodes.csv', PHYSICAL_SYSTEM_NODE_HEADERS],
    ['schema/role_memberships.schema.json', 'shared/role_memberships.csv', ROLE_MEMBERSHIP_HEADERS],
    ['schema/physical_edges.schema.json', 'shared/physical_edges.csv', PHYSICAL_EDGE_HEADERS],
    ['schema/reporting_allocations.schema.json', 'shared/reporting_allocations.csv', REPORTING_ALLOCATION_HEADERS],
    ['schema/representations.schema.json', 'shared/representations.csv', REPRESENTATION_HEADERS],
    ['schema/representation_incumbents.schema.json', 'shared/representation_incumbents.csv', REPRESENTATION_INCUMBENT_HEADERS],
    ['schema/role_decomposition_edges.schema.json', 'shared/role_decomposition_edges.csv', ROLE_DECOMPOSITION_EDGE_HEADERS],
    ['schema/methods.schema.json', 'roles/supply_grid_electricity/methods.csv', METHOD_HEADERS],
    ['schema/method_years.schema.json', 'roles/supply_grid_electricity/method_years.csv', METHOD_YEAR_HEADERS],
    ['schema/demand.schema.json', 'roles/supply_grid_electricity/demand.csv', DEMAND_HEADERS],
    ['schema/autonomous_efficiency_tracks.schema.json', 'roles/make_crude_steel/autonomous_efficiency_tracks.csv', AUTONOMOUS_EFFICIENCY_HEADERS],
    ['schema/efficiency_packages.schema.json', 'roles/make_crude_steel/efficiency_packages.csv', EFFICIENCY_PACKAGE_HEADERS],
  ];

  for (const [schemaPath, csvPath, expectedHeaders] of schemaChecks) {
    const schema = readJson(schemaPath);
    assert.deepEqual(parseHeader(csvPath), expectedHeaders, `${csvPath} should use expected header order`);
    assert.deepEqual(
      Object.keys(schema.properties ?? {}),
      expectedHeaders,
      `${schemaPath} should match ${csvPath} header order exactly`,
    );
  }

  const rolesSchema = readJson('schema/roles.schema.json');
  assert.deepEqual(new Set(rolesSchema.properties.balance_type.enum), BALANCE_TYPES);
  assert.deepEqual(new Set(rolesSchema.properties.activation_class.enum), ACTIVATION_CLASSES);
  assert.equal(
    Object.prototype.hasOwnProperty.call(rolesSchema.properties, 'role_kind'),
    false,
    'roles schema must not retain role_kind after the role-first ontology migration',
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(rolesSchema.properties, 'coverage_obligation'),
    false,
    'roles schema must not retain coverage_obligation after the role-first ontology migration',
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(rolesSchema.properties, 'default_representation_kind'),
    false,
    'roles schema must not retain default_representation_kind after the role-first ontology migration',
  );
  const roleMetricsSchema = readJson('schema/role_metrics.schema.json');
  assert.deepEqual(new Set(roleMetricsSchema.properties.emissions_importance_band.enum), EMISSIONS_IMPORTANCE_BANDS);
  const representationsSchema = readJson('schema/representations.schema.json');
  assert.deepEqual(new Set(representationsSchema.properties.representation_kind.enum), REPRESENTATION_KINDS);
  assert.equal(
    Object.prototype.hasOwnProperty.call(representationsSchema.properties, 'direct_method_kind'),
    false,
    'representations schema must not retain direct_method_kind after the role-first ontology migration',
  );
  const methodsSchema = readJson('schema/methods.schema.json');
  assert.equal(
    Object.prototype.hasOwnProperty.call(methodsSchema.properties, 'method_kind'),
    false,
    'methods schema must not retain method_kind after the role-first ontology migration',
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(methodsSchema.properties, 'is_residual'),
    false,
    'methods schema must not retain is_residual after the role-first ontology migration',
  );

  const canonicalSchemaText = JSON.stringify(Object.fromEntries(
    schemaChecks.map(([schemaPath]) => [schemaPath, readJson(schemaPath)]),
  ));
  assert.doesNotMatch(canonicalSchemaText, /\bfamily\b|family_id|\bstate\b|state_id/i);
});
