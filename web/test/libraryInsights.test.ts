import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildFamilyEfficiencyOverview,
  buildRoleMethodFamilies,
  findReferenceMethodRow,
} from '../src/data/libraryInsights.ts';
import type { ResolvedMethodYearRow } from '../src/data/types.ts';
import { loadPkg } from './solverTestUtils.mjs';

const pkg = loadPkg();

function buildResolvedMethodYearRow(
  overrides: Partial<ResolvedMethodYearRow> & Pick<ResolvedMethodYearRow, 'method_id' | 'method_label'>,
): ResolvedMethodYearRow {
  return {
    role_id: 'move_passengers_by_road',
    representation_id: 'move_passengers_by_road__pathway_bundle',
    method_id: overrides.method_id,
    method_label: overrides.method_label,
    method_description: '',
    representation_kind: 'pathway_bundle',
    balance_type: 'service_demand',
    output_id: 'passenger_road_transport',
    role_label: 'Move passengers by road',
    topology_area_id: 'transport',
    topology_area_label: 'Transport',
    parent_role_id: null,
    activation_class: 'top_level',
    reporting_allocations: [],
    region: 'AUS',
    year: 2025,
    output_unit: 'pkm',
    output_quantity_basis: '',
    output_cost_per_unit: null,
    cost_basis_year: null,
    currency: 'AUD',
    cost_components_summary: '',
    input_commodities: [],
    input_coefficients: [],
    input_units: [],
    input_basis_notes: '',
    energy_emissions_by_pollutant: [],
    process_emissions_by_pollutant: [],
    emissions_units: 'tCO2e',
    emissions_boundary_notes: '',
    max_share: null,
    max_activity: null,
    min_share: null,
    rollout_limit_notes: '',
    availability_conditions: '',
    source_ids: [],
    evidence_summary: '',
    derivation_method: '',
    assumption_ids: [],
    confidence_rating: '',
    review_notes: '',
    candidate_expansion_pathway: '',
    times_or_vedalang_mapping_notes: '',
    would_expand_to_explicit_capacity: false,
    would_expand_to_process_chain: false,
    energy_co2e: null,
    process_co2e: null,
    method_stage_family: 'pathway_bundle',
    method_stage_rank: null,
    method_stage_code: 'pathway_bundle',
    method_sort_key: '',
    method_label_standardized: '',
    is_default_incumbent_2025: false,
    method_option_rank: null,
    method_option_code: '',
    method_option_label: '',
    sector: 'transport',
    subsector: 'road',
    balance_tuning_flag: false,
    balance_tuning_note: '',
    benchmark_balance_note: '',
    ...overrides,
  };
}

describe('libraryInsights', () => {
  test('findReferenceMethodRow prefers the explicit incumbent flag over legacy label heuristics', () => {
    const selected = buildResolvedMethodYearRow({
      method_id: 'road_transport__passenger_road__future',
      method_label: 'Electrified passenger road fleet',
      method_sort_key: '03_ambition2',
      method_option_rank: 2,
    });
    const heuristicMatch = buildResolvedMethodYearRow({
      method_id: 'road_transport__passenger_road__legacy_incumbent',
      method_label: 'Legacy incumbent passenger fleet',
      method_sort_key: '02_ambition1',
      method_option_rank: 1,
    });
    const explicitIncumbent = buildResolvedMethodYearRow({
      method_id: 'road_transport__passenger_road__explicit_reference',
      method_label: 'Reference passenger fleet',
      is_default_incumbent_2025: true,
      method_sort_key: '01_incumbent',
      method_option_rank: 0,
    });

    const result = findReferenceMethodRow(selected, [
      selected,
      heuristicMatch,
      explicitIncumbent,
    ]);

    assert.equal(result?.method_id, explicitIncumbent.method_id);
  });

  test('findReferenceMethodRow falls back to legacy label scoring when no explicit incumbent exists', () => {
    const selected = buildResolvedMethodYearRow({
      method_id: 'road_transport__passenger_road__future',
      method_label: 'Electrified passenger road fleet',
      method_sort_key: '03_future',
      method_option_rank: 2,
    });
    const baseline = buildResolvedMethodYearRow({
      method_id: 'road_transport__passenger_road__baseline',
      method_label: 'Baseline current passenger fleet',
      method_sort_key: '01_baseline',
      method_option_rank: 0,
    });
    const conventional = buildResolvedMethodYearRow({
      method_id: 'road_transport__passenger_road__conventional',
      method_label: 'Conventional passenger fleet',
      method_sort_key: '02_conventional',
      method_option_rank: 1,
    });

    const result = findReferenceMethodRow(selected, [selected, conventional, baseline]);

    assert.equal(result?.method_id, baseline.method_id);
  });

  test('findReferenceMethodRow returns the balanced-table incumbent for key package outputs', () => {
    const cases = [
      {
        outputId: 'electricity',
        expectedMethodId: 'electricity__grid_supply__incumbent_thermal_mix',
      },
      {
        outputId: 'passenger_road_transport',
        expectedMethodId: 'road_transport__passenger_road__ice_fleet',
      },
      {
        outputId: 'crude_steel',
        expectedMethodId: 'steel__crude_steel__bf_bof_conventional',
      },
      {
        outputId: 'residential_building_services',
        expectedMethodId: 'buildings__residential__incumbent_mixed_fuels',
      },
    ];

    for (const { outputId, expectedMethodId } of cases) {
      const selected = pkg.resolvedMethodYears.find((row) => {
        return row.output_id === outputId
          && row.year === 2025
          && row.method_id !== expectedMethodId;
      });

      assert.ok(selected, `expected a non-incumbent 2025 row for ${outputId}`);

      const result = findReferenceMethodRow(selected, pkg.resolvedMethodYears);

      assert.equal(result?.method_id, expectedMethodId, `unexpected reference method for ${outputId}`);
      assert.equal(result?.is_default_incumbent_2025, true, `expected explicit incumbent flag for ${outputId}`);
    }
  });

  test('buildRoleMethodFamilies orders methods by method_sort_key before label order', () => {
    const ambition2 = buildResolvedMethodYearRow({
      method_id: 'road_transport__passenger_road__ambition2',
      method_label: 'A-label ambition 2',
      method_sort_key: '03_ambition2',
      method_option_rank: 2,
    });
    const incumbent = buildResolvedMethodYearRow({
      method_id: 'road_transport__passenger_road__incumbent',
      method_label: 'Z-label incumbent',
      method_sort_key: '01_incumbent',
      method_option_rank: 0,
    });
    const ambition1 = buildResolvedMethodYearRow({
      method_id: 'road_transport__passenger_road__ambition1',
      method_label: 'M-label ambition 1',
      method_sort_key: '02_ambition1',
      method_option_rank: 1,
    });

    const families = buildRoleMethodFamilies([ambition2, incumbent, ambition1]);

    assert.deepEqual(
      families.map((family) => family.methodId),
      [incumbent.method_id, ambition1.method_id, ambition2.method_id],
    );
  });

  test('buildRoleMethodFamilies falls back to labels when sort metadata is absent', () => {
    const zebra = buildResolvedMethodYearRow({
      method_id: 'road_transport__passenger_road__zebra',
      method_label: 'Zebra pathway',
    });
    const alpha = buildResolvedMethodYearRow({
      method_id: 'road_transport__passenger_road__alpha',
      method_label: 'Alpha pathway',
    });

    const families = buildRoleMethodFamilies([zebra, alpha]);

    assert.deepEqual(
      families.map((family) => family.methodId),
      [alpha.method_id, zebra.method_id],
    );
  });

  test('buildFamilyEfficiencyOverview groups canonical role efficiency artifacts and preserves method applicability order', () => {
    const overview = buildFamilyEfficiencyOverview(
      'serve_commercial_building_occupants',
      pkg.resolvedMethodYears,
      pkg.autonomousEfficiencyTracks,
      pkg.efficiencyPackages,
    );

    assert.ok(overview, 'expected a commercial building efficiency overview');
    if (!overview) {
      return;
    }

    assert.deepEqual(overview.tracks.map((track) => track.trackId), [
      'buildings__commercial__background_standards_drift',
    ]);
    assert.deepEqual(overview.packages.map((entry) => entry.packageId), [
      'buildings__commercial__lighting_retrofit',
      'buildings__commercial__hvac_tuning_bms',
    ]);
    assert.deepEqual(overview.orderedMethodIds, [
      'buildings__commercial__incumbent_mixed_fuels',
      'buildings__commercial__electrified_efficiency',
      'buildings__commercial__deep_electric',
    ]);
    assert.deepEqual(
      overview.applicableTrackIdsByMethodId.buildings__commercial__deep_electric,
      [],
    );
    assert.deepEqual(
      overview.applicablePackageIdsByMethodId.buildings__commercial__deep_electric,
      [],
    );
    assert.deepEqual(
      overview.tracks[0].applicableMethodIds,
      [
        'buildings__commercial__incumbent_mixed_fuels',
        'buildings__commercial__electrified_efficiency',
      ],
    );
    assert.deepEqual(
      overview.packages[0].applicableMethodIds,
      [
        'buildings__commercial__incumbent_mixed_fuels',
        'buildings__commercial__electrified_efficiency',
      ],
    );
  });
});
