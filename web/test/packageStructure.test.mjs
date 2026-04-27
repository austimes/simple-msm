import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parseCsv } from '../src/data/parseCsv.ts';

const PACKAGE_ROOT = join(import.meta.dirname, '../../sector_trajectory_library');
const MILESTONE_YEARS = ['2025', '2030', '2035', '2040', '2045', '2050'];
const AUTONOMOUS_EFFICIENCY_HEADERS = [
  'family_id',
  'track_id',
  'year',
  'track_label',
  'track_description',
  'applicable_state_ids',
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
  'family_id',
  'package_id',
  'year',
  'package_label',
  'package_description',
  'classification',
  'applicable_state_ids',
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
const ROLE_TOPOLOGY_HEADERS = [
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
const METHODS_HEADERS = [
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
const METHOD_YEARS_HEADERS = [
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
const REPRESENTATION_KINDS = new Set(['pathway_bundle', 'technology_bundle', 'role_decomposition']);
const METHOD_KINDS = new Set(['pathway', 'technology', 'residual']);
const EXPECTED_TOPOLOGY_AREAS = new Set([
  'buildings',
  'transport',
  'industrial_heat_and_production',
  'energy_supply',
  'agriculture',
  'construction',
  'water_waste',
  'other_residuals',
  'removals_land',
]);
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

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

test('sector trajectory library package structure is internally consistent', () => {
  const families = parseCsv(readText('shared/families.csv'));
  const owners = new Set(parseCsv(readText('shared/owners.csv')).map((row) => row.owner_id));
  const sourceIds = new Set(parseCsv(readText('shared/source_ledger.csv')).map((row) => row.source_id));
  const assumptionIds = new Set(parseCsv(readText('shared/assumptions_ledger.csv')).map((row) => row.assumption_id));
  const demandCurveIds = new Set(parseCsv(readText('shared/demand_growth_curves.csv')).map((row) => row.demand_growth_curve_id));
  const systemGroups = parseCsv(readText('shared/system_structure_groups.csv'));
  const systemMembers = parseCsv(readText('shared/system_structure_members.csv'));
  const systemGroupIds = new Set(systemGroups.map((row) => row.group_id));

  assert.equal(families.length, 28);
  assert.equal(
    families.filter((family) => family.family_resolution === 'residual_stub').length,
    14,
  );
  assert.equal(
    families.filter((family) => family.family_resolution === 'modeled').length,
    14,
  );

  const memberCountByFamily = new Map();
  for (const member of systemMembers) {
    assert.equal(systemGroupIds.has(member.group_id), true, `${member.family_id} system group must resolve`);
    memberCountByFamily.set(member.family_id, (memberCountByFamily.get(member.family_id) ?? 0) + 1);
  }

  let totalRows = 0;
  const stateIds = new Set();
  let autonomousTrackRowCount = 0;
  let efficiencyPackageRowCount = 0;

  for (const family of families) {
    assert.equal(memberCountByFamily.get(family.family_id), 1, `${family.family_id} must have exactly one system group`);
    assert.match(family.family_resolution, /^(modeled|residual_stub)$/);

    const familyDir = join(PACKAGE_ROOT, 'families', family.family_id);
    assert.equal(existsSync(join(familyDir, 'family_states.csv')), true, `${family.family_id} missing family_states.csv`);
    assert.equal(existsSync(join(familyDir, 'demand.csv')), true, `${family.family_id} missing demand.csv`);
    assert.equal(existsSync(join(familyDir, 'README.md')), true, `${family.family_id} missing README.md`);
    assert.equal(existsSync(join(familyDir, 'validation.md')), true, `${family.family_id} missing validation.md`);

    assert.equal(owners.has(family.maintainer_owner_id), true, `${family.family_id} maintainer owner must resolve`);
    assert.equal(owners.has(family.review_owner_id), true, `${family.family_id} review owner must resolve`);

    const rows = parseCsv(readText(`families/${family.family_id}/family_states.csv`));
    const demandRows = parseCsv(readText(`families/${family.family_id}/demand.csv`));
    assert.equal(demandRows.length, 1, `${family.family_id} should have exactly one demand row`);
    assert.equal(demandCurveIds.has(demandRows[0].demand_growth_curve_id), true, `${family.family_id} demand curve must resolve`);

    totalRows += rows.length;
    const familyStateIds = new Set(rows.map((row) => row.state_id));
    assert.equal(familyStateIds.has(family.default_incumbent_state_id), true, `${family.family_id} default incumbent state must exist`);

    for (const row of rows) {
      assert.equal(row.family_id, family.family_id, `${family.family_id} rows must keep the correct family_id`);
      stateIds.add(row.state_id);

      const sourceArray = parseJsonArray(row.source_ids, `${family.family_id}.${row.state_id}.source_ids`);
      const assumptionArray = parseJsonArray(row.assumption_ids, `${family.family_id}.${row.state_id}.assumption_ids`);
      const inputCommodities = parseJsonArray(row.input_commodities, `${family.family_id}.${row.state_id}.input_commodities`);
      const inputCoefficients = parseJsonArray(row.input_coefficients, `${family.family_id}.${row.state_id}.input_coefficients`);
      const inputUnits = parseJsonArray(row.input_units, `${family.family_id}.${row.state_id}.input_units`);
      parseJsonArray(row.energy_emissions_by_pollutant, `${family.family_id}.${row.state_id}.energy_emissions_by_pollutant`);
      parseJsonArray(row.process_emissions_by_pollutant, `${family.family_id}.${row.state_id}.process_emissions_by_pollutant`);

      assert.equal(inputCommodities.length, inputCoefficients.length, `${family.family_id}.${row.state_id} input arrays must align`);
      assert.equal(inputCommodities.length, inputUnits.length, `${family.family_id}.${row.state_id} input arrays must align`);

      for (const sourceId of sourceArray) {
        assert.equal(sourceIds.has(sourceId), true, `${family.family_id}.${row.state_id} source ${sourceId} must resolve`);
      }
      for (const assumptionId of assumptionArray) {
        assert.equal(assumptionIds.has(assumptionId), true, `${family.family_id}.${row.state_id} assumption ${assumptionId} must resolve`);
      }
    }

    for (const stateId of familyStateIds) {
      const years = rows
        .filter((row) => row.state_id === stateId)
        .map((row) => row.year)
        .sort((left, right) => Number(left) - Number(right));
      assert.deepEqual(years, MILESTONE_YEARS, `${family.family_id}.${stateId} must cover every milestone year`);
    }

    const autonomousPath = join(familyDir, 'autonomous_efficiency_tracks.csv');
    if (existsSync(autonomousPath)) {
      assert.deepEqual(
        parseHeader(`families/${family.family_id}/autonomous_efficiency_tracks.csv`),
        AUTONOMOUS_EFFICIENCY_HEADERS,
        `${family.family_id} autonomous_efficiency_tracks.csv should use the canonical header order`,
      );

      const trackRows = parseCsv(readText(`families/${family.family_id}/autonomous_efficiency_tracks.csv`));
      autonomousTrackRowCount += trackRows.length;
      const trackIds = new Set(trackRows.map((row) => row.track_id));

      for (const row of trackRows) {
        assert.equal(row.family_id, family.family_id, `${family.family_id} track rows must keep the correct family_id`);

        const applicableStateIds = parseJsonArray(
          row.applicable_state_ids,
          `${family.family_id}.${row.track_id}.applicable_state_ids`,
        );
        const sourceArray = parseJsonArray(row.source_ids, `${family.family_id}.${row.track_id}.source_ids`);
        const assumptionArray = parseJsonArray(row.assumption_ids, `${family.family_id}.${row.track_id}.assumption_ids`);
        const affectedInputCommodities = parseJsonArray(
          row.affected_input_commodities,
          `${family.family_id}.${row.track_id}.affected_input_commodities`,
        );
        const inputMultipliers = parseJsonArray(
          row.input_multipliers,
          `${family.family_id}.${row.track_id}.input_multipliers`,
        );

        assert.equal(
          affectedInputCommodities.length,
          inputMultipliers.length,
          `${family.family_id}.${row.track_id} input arrays must align`,
        );

        for (const stateId of applicableStateIds) {
          assert.equal(familyStateIds.has(stateId), true, `${family.family_id}.${row.track_id} state ${stateId} must resolve`);
        }
        for (const sourceId of sourceArray) {
          assert.equal(sourceIds.has(sourceId), true, `${family.family_id}.${row.track_id} source ${sourceId} must resolve`);
        }
        for (const assumptionId of assumptionArray) {
          assert.equal(assumptionIds.has(assumptionId), true, `${family.family_id}.${row.track_id} assumption ${assumptionId} must resolve`);
        }
      }

      for (const trackId of trackIds) {
        const years = trackRows
          .filter((row) => row.track_id === trackId)
          .map((row) => row.year)
          .sort((left, right) => Number(left) - Number(right));
        assert.deepEqual(years, MILESTONE_YEARS, `${family.family_id}.${trackId} must cover every milestone year`);
      }
    }

    const packagesPath = join(familyDir, 'efficiency_packages.csv');
    if (existsSync(packagesPath)) {
      assert.deepEqual(
        parseHeader(`families/${family.family_id}/efficiency_packages.csv`),
        EFFICIENCY_PACKAGE_HEADERS,
        `${family.family_id} efficiency_packages.csv should use the canonical header order`,
      );

      const packageRows = parseCsv(readText(`families/${family.family_id}/efficiency_packages.csv`));
      efficiencyPackageRowCount += packageRows.length;
      const packageIds = new Set(packageRows.map((row) => row.package_id));

      for (const row of packageRows) {
        assert.equal(row.family_id, family.family_id, `${family.family_id} package rows must keep the correct family_id`);

        const applicableStateIds = parseJsonArray(
          row.applicable_state_ids,
          `${family.family_id}.${row.package_id}.applicable_state_ids`,
        );
        const sourceArray = parseJsonArray(row.source_ids, `${family.family_id}.${row.package_id}.source_ids`);
        const assumptionArray = parseJsonArray(row.assumption_ids, `${family.family_id}.${row.package_id}.assumption_ids`);
        const affectedInputCommodities = parseJsonArray(
          row.affected_input_commodities,
          `${family.family_id}.${row.package_id}.affected_input_commodities`,
        );
        const inputMultipliers = parseJsonArray(
          row.input_multipliers,
          `${family.family_id}.${row.package_id}.input_multipliers`,
        );

        assert.equal(
          affectedInputCommodities.length,
          inputMultipliers.length,
          `${family.family_id}.${row.package_id} input arrays must align`,
        );

        for (const stateId of applicableStateIds) {
          assert.equal(familyStateIds.has(stateId), true, `${family.family_id}.${row.package_id} state ${stateId} must resolve`);
        }
        for (const sourceId of sourceArray) {
          assert.equal(sourceIds.has(sourceId), true, `${family.family_id}.${row.package_id} source ${sourceId} must resolve`);
        }
        for (const assumptionId of assumptionArray) {
          assert.equal(assumptionIds.has(assumptionId), true, `${family.family_id}.${row.package_id} assumption ${assumptionId} must resolve`);
        }
      }

      for (const packageId of packageIds) {
        const years = packageRows
          .filter((row) => row.package_id === packageId)
          .map((row) => row.year)
          .sort((left, right) => Number(left) - Number(right));
        assert.deepEqual(years, MILESTONE_YEARS, `${family.family_id}.${packageId} must cover every milestone year`);
      }
    }
  }

  assert.equal(totalRows, 312);
  assert.equal(stateIds.size, 52);
  assert.ok(autonomousTrackRowCount > 0, 'expected at least one canonical autonomous efficiency track row');
  assert.ok(efficiencyPackageRowCount > 0, 'expected at least one canonical efficiency package row');

  const externalCommodityDemands = parseCsv(readText('shared/external_commodity_demands.csv'));
  assert.equal(externalCommodityDemands.length, 0, 'built-in external commodity demand table should be parser-compatible but empty');
  for (const row of externalCommodityDemands) {
    assert.equal(demandCurveIds.has(row.demand_growth_curve_id), true, `external commodity ${row.commodity_id} demand curve must resolve`);
  }

  const residualOverlays = parseCsv(readText('overlays/residual_overlays.csv'));
  assert.equal(residualOverlays.length, 0, 'migrated residual overlays should not remain as overlay sidecar rows');
});

test('ESRL role topology keeps physical roles separate from reporting labels', () => {
  const roles = parseCsv(readText('shared/roles.csv'));
  const reportingAllocations = parseCsv(readText('shared/reporting_allocations.csv'));

  assert.deepEqual(parseHeader('shared/roles.csv'), ROLE_TOPOLOGY_HEADERS);
  assert.deepEqual(parseHeader('shared/reporting_allocations.csv'), REPORTING_ALLOCATION_HEADERS);
  assert.equal(ROLE_TOPOLOGY_HEADERS.includes('sector'), false);
  assert.equal(ROLE_TOPOLOGY_HEADERS.includes('subsector'), false);

  const roleIds = new Set(roles.map((role) => role.role_id));
  const areaIds = new Set(roles.map((role) => role.topology_area_id));
  const reportingRoleIds = new Set(reportingAllocations.map((allocation) => allocation.role_id));

  assert.deepEqual(roleIds, EXPECTED_ROLE_IDS);
  assert.deepEqual(areaIds, EXPECTED_TOPOLOGY_AREAS);
  assert.equal(roles.length, 28);
  assert.equal(reportingAllocations.length, roles.length);
  assert.equal(roles.filter((role) => role.role_kind === 'residual').length, 14);
  assert.equal(roles.filter((role) => role.coverage_obligation === 'explicit_residual_top_level').length, 14);

  for (const role of roles) {
    assert.equal(role.parent_role_id, '', `${role.role_id} should be an initial top-level role`);
    assert.equal(role.default_representation_kind, 'pathway_bundle', `${role.role_id} should start as a direct bundle`);
    assert.equal(reportingRoleIds.has(role.role_id), true, `${role.role_id} should have a reporting allocation`);
  }

  for (const allocation of reportingAllocations) {
    assert.equal(roleIds.has(allocation.role_id), true, `${allocation.role_id} must resolve to roles.csv`);
    assert.equal(allocation.reporting_system, 'phase1_package_accounting');
    assert.equal(allocation.allocation_basis, 'role_activity');
    assert.equal(Number(allocation.allocation_share), 1);
    assert.notEqual(allocation.sector, '', `${allocation.role_id} must declare a reporting sector`);
    assert.notEqual(allocation.subsector, '', `${allocation.role_id} must declare a reporting subsector`);
  }
});

test('ESRL representations define one default model choice per top-level role', () => {
  const roles = parseCsv(readText('shared/roles.csv'));
  const representations = parseCsv(readText('shared/representations.csv'));
  const roleDecompositionEdges = parseCsv(readText('shared/role_decomposition_edges.csv'));
  const roleById = new Map(roles.map((role) => [role.role_id, role]));
  const representationById = new Map();
  const defaultCountByRole = new Map();

  assert.deepEqual(parseHeader('shared/representations.csv'), REPRESENTATION_HEADERS);
  assert.deepEqual(parseHeader('shared/role_decomposition_edges.csv'), ROLE_DECOMPOSITION_EDGE_HEADERS);
  assert.equal(representations.length, roles.length);

  for (const representation of representations) {
    const role = roleById.get(representation.role_id);
    assert.ok(role, `${representation.representation_id} role_id must resolve to roles.csv`);
    assert.equal(representationById.has(representation.representation_id), false, `${representation.representation_id} must be unique`);
    assert.equal(REPRESENTATION_KINDS.has(representation.representation_kind), true, `${representation.representation_id} kind must be canonical`);
    representationById.set(representation.representation_id, representation);

    if (representation.is_default === 'true') {
      defaultCountByRole.set(representation.role_id, (defaultCountByRole.get(representation.role_id) ?? 0) + 1);
    } else {
      assert.equal(representation.is_default, 'false', `${representation.representation_id} is_default must be true or false`);
    }

    if (representation.representation_kind === 'role_decomposition') {
      assert.equal(representation.direct_method_kind, '', `${representation.representation_id} decomposition must not expose direct methods`);
    } else {
      assert.equal(METHOD_KINDS.has(representation.direct_method_kind), true, `${representation.representation_id} direct method kind must be canonical`);
    }

    if (role.role_kind === 'residual') {
      assert.equal(representation.direct_method_kind, 'residual', `${representation.role_id} residual role should default to residual methods`);
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
    assert.equal(roleById.has(edge.child_role_id), true, `${edge.child_role_id} must resolve to roles.csv`);
    assert.match(edge.edge_kind, /^(required_child|optional_child)$/);
  }
});

test('schema companions stay aligned with the authored CSV headers', () => {
  const familiesSchema = JSON.parse(readText('schema/families.schema.json'));
  assert.deepEqual(
    Object.keys(familiesSchema.properties ?? {}),
    parseHeader('shared/families.csv'),
    'families.schema.json should match shared/families.csv header order exactly',
  );

  const familyStatesSchema = JSON.parse(readText('schema/family_states.schema.json'));
  assert.deepEqual(
    Object.keys(familyStatesSchema.properties ?? {}),
    parseHeader('families/electricity/family_states.csv'),
    'family_states.schema.json should match family_states.csv header order exactly',
  );

  const autonomousEfficiencySchema = JSON.parse(readText('schema/autonomous_efficiency_tracks.schema.json'));
  assert.deepEqual(
    Object.keys(autonomousEfficiencySchema.properties ?? {}),
    AUTONOMOUS_EFFICIENCY_HEADERS,
    'autonomous_efficiency_tracks.schema.json should declare the canonical header order exactly',
  );

  const efficiencyPackagesSchema = JSON.parse(readText('schema/efficiency_packages.schema.json'));
  assert.deepEqual(
    Object.keys(efficiencyPackagesSchema.properties ?? {}),
    EFFICIENCY_PACKAGE_HEADERS,
    'efficiency_packages.schema.json should declare the canonical header order exactly',
  );

  const representationsSchema = readJson('schema/representations.schema.json');
  assert.deepEqual(
    Object.keys(representationsSchema.properties ?? {}),
    REPRESENTATION_HEADERS,
    'representations.schema.json should match shared/representations.csv header order exactly',
  );
  assert.deepEqual(
    new Set(representationsSchema.properties.representation_kind.enum),
    REPRESENTATION_KINDS,
    'representations.schema.json should declare every canonical representation kind',
  );

  const roleDecompositionEdgesSchema = readJson('schema/role_decomposition_edges.schema.json');
  assert.deepEqual(
    Object.keys(roleDecompositionEdgesSchema.properties ?? {}),
    ROLE_DECOMPOSITION_EDGE_HEADERS,
    'role_decomposition_edges.schema.json should match shared/role_decomposition_edges.csv header order exactly',
  );

  const methodsSchema = readJson('schema/methods.schema.json');
  assert.deepEqual(
    Object.keys(methodsSchema.properties ?? {}),
    METHODS_HEADERS,
    'methods.schema.json should declare the canonical methods.csv header order exactly',
  );
  assert.deepEqual(
    new Set(methodsSchema.properties.method_kind.enum),
    METHOD_KINDS,
    'methods.schema.json should declare every canonical method kind',
  );

  const methodYearsSchema = readJson('schema/method_years.schema.json');
  assert.deepEqual(
    Object.keys(methodYearsSchema.properties ?? {}),
    METHOD_YEARS_HEADERS,
    'method_years.schema.json should declare the canonical method_years.csv header order exactly',
  );

  const canonicalSchemaText = JSON.stringify({
    representationsSchema,
    roleDecompositionEdgesSchema,
    methodsSchema,
    methodYearsSchema,
  });
  assert.doesNotMatch(canonicalSchemaText, /\bfamily\b|family_id|\bstate\b|state_id/i);
});
