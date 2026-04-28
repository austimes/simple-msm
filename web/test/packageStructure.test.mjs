import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
  'role_kind',
  'balance_type',
  'output_unit',
  'coverage_obligation',
  'default_representation_kind',
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
  'direct_method_kind',
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
  'method_kind',
  'method_label',
  'method_description',
  'is_residual',
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
const REPRESENTATION_KINDS = new Set(['pathway_bundle', 'technology_bundle', 'role_decomposition']);
const METHOD_KINDS = new Set(['pathway', 'technology', 'residual']);
const CONFIDENCE_RATINGS = new Set(['High', 'Medium', 'Low', 'Exploratory']);
const EXPECTED_ROLE_IDS = new Set([
  'deliver_residential_building_services',
  'deliver_commercial_building_services',
  'account_residual_residential_buildings',
  'account_residual_commercial_buildings',
  'deliver_passenger_road_transport',
  'deliver_freight_road_transport',
  'account_residual_transport',
  'deliver_low_temperature_heat',
  'deliver_medium_temperature_heat',
  'deliver_high_temperature_heat',
  'produce_crude_steel',
  'produce_crude_steel_non_h2_dri_residual',
  'produce_direct_reduced_iron',
  'melt_refine_dri_crude_steel',
  'produce_cement_equivalent',
  'account_residual_manufacturing',
  'account_residual_ippu',
  'supply_electricity',
  'account_electricity_grid_losses_own_use',
  'account_residual_mining_energy',
  'account_residual_fugitives',
  'produce_livestock_output',
  'produce_cropping_horticulture_output',
  'account_residual_agriculture',
  'account_residual_construction',
  'account_residual_water_waste',
  'account_residual_waste_emissions',
  'account_residual_other_sectors',
  'remove_co2_land_sequestration',
  'remove_co2_engineered_removals',
  'account_residual_lulucf_sink',
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

test('energy system representation library package structure is internally consistent', () => {
  const roles = parseCsv(readText('shared/roles.csv'));
  const representations = parseCsv(readText('shared/representations.csv'));
  const roleDecompositionEdges = parseCsv(readText('shared/role_decomposition_edges.csv'));
  const reportingAllocations = parseCsv(readText('shared/reporting_allocations.csv'));
  const roleValidationSummary = parseCsv(readText('validation/role_validation_summary.csv'));
  const sourceIds = new Set(parseCsv(readText('shared/source_ledger.csv')).map((row) => row.source_id));
  const assumptionIds = new Set(parseCsv(readText('shared/assumptions_ledger.csv')).map((row) => row.assumption_id));
  const demandCurveIds = new Set(parseCsv(readText('shared/demand_growth_curves.csv')).map((row) => row.demand_growth_curve_id));
  const roleIds = new Set(roles.map((role) => role.role_id));
  const roleById = new Map(roles.map((role) => [role.role_id, role]));
  const representationById = new Map(representations.map((representation) => [representation.representation_id, representation]));
  const defaultCountByRole = new Map();

  assert.deepEqual(parseHeader('shared/roles.csv'), ROLE_HEADERS);
  assert.deepEqual(parseHeader('shared/representations.csv'), REPRESENTATION_HEADERS);
  assert.deepEqual(parseHeader('shared/role_decomposition_edges.csv'), ROLE_DECOMPOSITION_EDGE_HEADERS);
  assert.deepEqual(parseHeader('shared/reporting_allocations.csv'), REPORTING_ALLOCATION_HEADERS);
  assert.deepEqual(parseHeader('validation/role_validation_summary.csv'), ROLE_VALIDATION_HEADERS);
  assert.deepEqual(roleIds, EXPECTED_ROLE_IDS);
  assert.equal(roles.length, 31);
  assert.equal(roles.filter((role) => role.role_kind === 'residual').length, 14);
  assert.equal(roles.filter((role) => role.coverage_obligation === 'explicit_residual_top_level').length, 14);
  assert.equal(representations.length, roles.length + 1);
  assert.equal(reportingAllocations.length, roles.length);
  assert.equal(roleValidationSummary.length, roles.length);

  for (const representation of representations) {
    assert.equal(roleIds.has(representation.role_id), true, `${representation.representation_id} role must resolve`);
    assert.equal(REPRESENTATION_KINDS.has(representation.representation_kind), true, `${representation.representation_id} kind must be canonical`);
    if (representation.is_default === 'true') {
      defaultCountByRole.set(representation.role_id, (defaultCountByRole.get(representation.role_id) ?? 0) + 1);
    } else {
      assert.equal(representation.is_default, 'false', `${representation.representation_id} is_default must be true or false`);
    }
    if (representation.representation_kind === 'role_decomposition') {
      assert.equal(representation.direct_method_kind, '', `${representation.representation_id} decomposition must not expose direct methods`);
    } else {
      assert.equal(METHOD_KINDS.has(representation.direct_method_kind), true, `${representation.representation_id} method kind must be canonical`);
    }
  }
  for (const role of roles) {
    assert.equal(defaultCountByRole.get(role.role_id), 1, `${role.role_id} must have exactly one default representation`);
  }

  for (const edge of roleDecompositionEdges) {
    const parentRepresentation = representationById.get(edge.parent_representation_id);
    assert.ok(parentRepresentation, `${edge.parent_representation_id} must resolve to representations.csv`);
    assert.equal(parentRepresentation.representation_kind, 'role_decomposition', `${edge.parent_representation_id} must be a decomposition`);
    assert.equal(edge.parent_role_id, parentRepresentation.role_id, `${edge.parent_representation_id} parent role must match representation role`);
    assert.equal(roleIds.has(edge.child_role_id), true, `${edge.child_role_id} must resolve to roles.csv`);
    assert.match(edge.edge_kind, /^(required_child|optional_child)$/);
  }

  const crudeSteelRepresentations = representations.filter((representation) => representation.role_id === 'produce_crude_steel');
  assert.deepEqual(
    new Set(crudeSteelRepresentations.map((representation) => representation.representation_kind)),
    new Set(['pathway_bundle', 'role_decomposition']),
    'produce_crude_steel should expose aggregate and decomposed representations',
  );
  const crudeSteelDecomposition = representationById.get('produce_crude_steel__h2_dri_decomposition');
  assert.ok(crudeSteelDecomposition, 'crude-steel decomposition representation must exist');
  assert.equal(crudeSteelDecomposition.is_default, 'false', 'crude-steel decomposition should not replace the aggregate default');
  const crudeSteelChildren = roleDecompositionEdges
    .filter((edge) => edge.parent_representation_id === 'produce_crude_steel__h2_dri_decomposition')
    .sort((left, right) => Number(left.display_order) - Number(right.display_order));
  assert.deepEqual(
    crudeSteelChildren.map((edge) => edge.child_role_id),
    [
      'produce_crude_steel_non_h2_dri_residual',
      'produce_direct_reduced_iron',
      'melt_refine_dri_crude_steel',
    ],
    'crude-steel decomposition should activate the non-H2 residual, DRI, and melt/refine children',
  );
  for (const edge of crudeSteelChildren) {
    assert.equal(edge.edge_kind, 'required_child', `${edge.child_role_id} should be required`);
    assert.equal(edge.is_required, 'true', `${edge.child_role_id} should be required`);
    assert.equal(roleById.get(edge.child_role_id)?.parent_role_id, 'produce_crude_steel', `${edge.child_role_id} should point back to produce_crude_steel`);
  }
  assert.deepEqual(
    new Set(parseCsv(readText('roles/produce_crude_steel_non_h2_dri_residual/methods.csv')).map((method) => method.method_id)),
    new Set([
      'steel__crude_steel_non_h2__bf_bof_conventional',
      'steel__crude_steel_non_h2__scrap_eaf',
      'steel__crude_steel_non_h2__bf_bof_ccs_transition',
    ]),
    'non-H2 residual child should preserve explicit non-H2 crude-steel coverage',
  );
  assert.deepEqual(
    new Set(parseCsv(readText('roles/produce_direct_reduced_iron/methods.csv')).map((method) => method.method_id)),
    new Set([
      'steel__dri__h2_shaft_furnace',
      'steel__dri__gas_shaft_furnace',
      'steel__dri__imported_residual',
    ]),
    'DRI child should expose technology methods',
  );
  assert.deepEqual(
    new Set(parseCsv(readText('roles/melt_refine_dri_crude_steel/methods.csv')).map((method) => method.method_id)),
    new Set([
      'steel__dri_melt_refine__eaf_finishing',
      'steel__dri_melt_refine__electric_smelter',
    ]),
    'melt/refine child should expose finishing methods',
  );

  const reportingRoleIds = new Set(reportingAllocations.map((allocation) => allocation.role_id));
  for (const allocation of reportingAllocations) {
    assert.equal(roleIds.has(allocation.role_id), true, `${allocation.role_id} reporting allocation must resolve`);
    assert.equal(allocation.reporting_system, 'phase1_package_accounting');
    assert.equal(allocation.allocation_basis, 'role_activity');
    assert.equal(Number(allocation.allocation_share), 1);
    assert.notEqual(allocation.sector, '', `${allocation.role_id} must declare a reporting sector`);
    assert.notEqual(allocation.subsector, '', `${allocation.role_id} must declare a reporting subsector`);
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
    totalMethods += methods.length;
    totalMethodYearRows += methodYears.length;

    assert.equal(methods.length > 0, true, `${role.role_id} must expose at least one method`);
    assert.equal(demandRows.length, 1, `${role.role_id} should have exactly one demand row`);
    assert.equal(demandRows[0].role_id, role.role_id, `${role.role_id} demand role_id must match folder`);
    assert.equal(demandCurveIds.has(demandRows[0].demand_growth_curve_id), true, `${role.role_id} demand curve must resolve`);

    for (const method of methods) {
      assert.equal(method.role_id, role.role_id, `${role.role_id}.${method.method_id} role_id must match folder`);
      assert.equal(method.representation_id, defaultRepresentation.representation_id, `${role.role_id}.${method.method_id} representation must be default`);
      assert.equal(METHOD_KINDS.has(method.method_kind), true, `${role.role_id}.${method.method_id} kind must be canonical`);
      assert.equal(CONFIDENCE_RATINGS.has(method.confidence_rating), true, `${role.role_id}.${method.method_id} confidence must be canonical`);
      assert.equal(Number.isInteger(Number(method.sort_order)), true, `${role.role_id}.${method.method_id} sort_order must be an integer`);
      assertResolvesJsonIds(method.source_ids, sourceIds, `${role.role_id}.${method.method_id}.source_ids`);
      assertResolvesJsonIds(method.assumption_ids, assumptionIds, `${role.role_id}.${method.method_id}.assumption_ids`);
      if (role.role_kind === 'residual') {
        assert.equal(method.method_kind, 'residual', `${role.role_id} residual roles should expose residual methods`);
        assert.equal(method.is_residual, 'true', `${role.role_id}.${method.method_id} residual flag must be true`);
      }
    }

    for (const row of methodYears) {
      assert.equal(row.role_id, role.role_id, `${role.role_id}.${row.method_id}.${row.year} role_id must match folder`);
      assert.equal(row.representation_id, defaultRepresentation.representation_id, `${role.role_id}.${row.method_id}.${row.year} representation must be default`);
      assert.equal(methodIds.has(row.method_id), true, `${role.role_id}.${row.method_id}.${row.year} method must resolve`);
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

  assert.equal(totalMethods, 60);
  assert.equal(totalMethodYearRows, 360);
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

test('schema companions stay aligned with the authored CSV headers', () => {
  const schemaChecks = [
    ['schema/roles.schema.json', 'shared/roles.csv', ROLE_HEADERS],
    ['schema/reporting_allocations.schema.json', 'shared/reporting_allocations.csv', REPORTING_ALLOCATION_HEADERS],
    ['schema/representations.schema.json', 'shared/representations.csv', REPRESENTATION_HEADERS],
    ['schema/role_decomposition_edges.schema.json', 'shared/role_decomposition_edges.csv', ROLE_DECOMPOSITION_EDGE_HEADERS],
    ['schema/methods.schema.json', 'roles/supply_electricity/methods.csv', METHOD_HEADERS],
    ['schema/method_years.schema.json', 'roles/supply_electricity/method_years.csv', METHOD_YEAR_HEADERS],
    ['schema/demand.schema.json', 'roles/supply_electricity/demand.csv', DEMAND_HEADERS],
    ['schema/autonomous_efficiency_tracks.schema.json', 'roles/produce_crude_steel/autonomous_efficiency_tracks.csv', AUTONOMOUS_EFFICIENCY_HEADERS],
    ['schema/efficiency_packages.schema.json', 'roles/produce_crude_steel/efficiency_packages.csv', EFFICIENCY_PACKAGE_HEADERS],
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

  const representationsSchema = readJson('schema/representations.schema.json');
  assert.deepEqual(new Set(representationsSchema.properties.representation_kind.enum), REPRESENTATION_KINDS);
  const methodsSchema = readJson('schema/methods.schema.json');
  assert.deepEqual(new Set(methodsSchema.properties.method_kind.enum), METHOD_KINDS);

  const canonicalSchemaText = JSON.stringify(Object.fromEntries(
    schemaChecks.map(([schemaPath]) => [schemaPath, readJson(schemaPath)]),
  ));
  assert.doesNotMatch(canonicalSchemaText, /\bfamily\b|family_id|\bstate\b|state_id/i);
});
