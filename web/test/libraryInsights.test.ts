import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildFamilyEfficiencyOverview,
  buildSectorStateFamilies,
  findReferenceSectorState,
} from '../src/data/libraryInsights.ts';
import type { SectorState } from '../src/data/types.ts';
import { loadPkg } from './solverTestUtils.mjs';

const pkg = loadPkg();

function buildSectorState(
  overrides: Partial<SectorState> & Pick<SectorState, 'state_id' | 'state_label'>,
): SectorState {
  return {
    family_id: 'transport_family',
    sector: 'Transport',
    subsector: 'Road',
    service_or_output_name: 'passenger_road_transport',
    region: 'AUS',
    year: 2025,
    state_id: overrides.state_id,
    state_label: overrides.state_label,
    state_description: '',
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
    state_stage_family: '',
    state_stage_rank: null,
    state_stage_code: '',
    state_sort_key: '',
    state_label_standardized: '',
    is_default_incumbent_2025: false,
    state_option_rank: null,
    state_option_code: '',
    state_option_label: '',
    balance_tuning_flag: false,
    balance_tuning_note: '',
    benchmark_balance_note: '',
    ...overrides,
  };
}

describe('libraryInsights', () => {
  test('findReferenceSectorState prefers the explicit incumbent flag over legacy label heuristics', () => {
    const selected = buildSectorState({
      state_id: 'road_transport__passenger_road__future',
      state_label: 'Electrified passenger road fleet',
      state_sort_key: '03_ambition2',
      state_option_rank: 2,
    });
    const heuristicMatch = buildSectorState({
      state_id: 'road_transport__passenger_road__legacy_incumbent',
      state_label: 'Legacy incumbent passenger fleet',
      state_sort_key: '02_ambition1',
      state_option_rank: 1,
    });
    const explicitIncumbent = buildSectorState({
      state_id: 'road_transport__passenger_road__explicit_reference',
      state_label: 'Reference passenger fleet',
      is_default_incumbent_2025: true,
      state_sort_key: '01_incumbent',
      state_option_rank: 0,
    });

    const result = findReferenceSectorState(selected, [
      selected,
      heuristicMatch,
      explicitIncumbent,
    ]);

    assert.equal(result?.state_id, explicitIncumbent.state_id);
  });

  test('findReferenceSectorState falls back to legacy label scoring when no explicit incumbent exists', () => {
    const selected = buildSectorState({
      state_id: 'road_transport__passenger_road__future',
      state_label: 'Electrified passenger road fleet',
    });
    const baseline = buildSectorState({
      state_id: 'road_transport__passenger_road__baseline',
      state_label: 'Baseline current passenger fleet',
    });
    const conventional = buildSectorState({
      state_id: 'road_transport__passenger_road__conventional',
      state_label: 'Conventional passenger fleet',
    });

    const result = findReferenceSectorState(selected, [selected, conventional, baseline]);

    assert.equal(result?.state_id, baseline.state_id);
  });

  test('findReferenceSectorState returns the balanced-table incumbent for key package outputs', () => {
    const cases = [
      {
        outputId: 'electricity',
        expectedStateId: 'electricity__grid_supply__incumbent_thermal_mix',
      },
      {
        outputId: 'passenger_road_transport',
        expectedStateId: 'road_transport__passenger_road__ice_fleet',
      },
      {
        outputId: 'crude_steel',
        expectedStateId: 'steel__crude_steel__bf_bof_conventional',
      },
      {
        outputId: 'residential_building_services',
        expectedStateId: 'buildings__residential__incumbent_mixed_fuels',
      },
    ];

    for (const { outputId, expectedStateId } of cases) {
      const selected = pkg.sectorStates.find((row) => {
        return row.service_or_output_name === outputId
          && row.year === 2025
          && row.state_id !== expectedStateId;
      });

      assert.ok(selected, `expected a non-incumbent 2025 row for ${outputId}`);

      const result = findReferenceSectorState(selected, pkg.sectorStates);

      assert.equal(result?.state_id, expectedStateId, `unexpected reference state for ${outputId}`);
      assert.equal(result?.is_default_incumbent_2025, true, `expected explicit incumbent flag for ${outputId}`);
    }
  });

  test('buildSectorStateFamilies orders families by state_sort_key before label order', () => {
    const ambition2 = buildSectorState({
      state_id: 'road_transport__passenger_road__ambition2',
      state_label: 'A-label ambition 2',
      state_sort_key: '03_ambition2',
      state_option_rank: 2,
    });
    const incumbent = buildSectorState({
      state_id: 'road_transport__passenger_road__incumbent',
      state_label: 'Z-label incumbent',
      state_sort_key: '01_incumbent',
      state_option_rank: 0,
    });
    const ambition1 = buildSectorState({
      state_id: 'road_transport__passenger_road__ambition1',
      state_label: 'M-label ambition 1',
      state_sort_key: '02_ambition1',
      state_option_rank: 1,
    });

    const families = buildSectorStateFamilies([ambition2, incumbent, ambition1]);

    assert.deepEqual(
      families.map((family) => family.stateId),
      [incumbent.state_id, ambition1.state_id, ambition2.state_id],
    );
  });

  test('buildSectorStateFamilies falls back to labels when sort metadata is absent', () => {
    const zebra = buildSectorState({
      state_id: 'road_transport__passenger_road__zebra',
      state_label: 'Zebra pathway',
    });
    const alpha = buildSectorState({
      state_id: 'road_transport__passenger_road__alpha',
      state_label: 'Alpha pathway',
    });

    const families = buildSectorStateFamilies([zebra, alpha]);

    assert.deepEqual(
      families.map((family) => family.stateId),
      [alpha.state_id, zebra.state_id],
    );
  });

  test('buildFamilyEfficiencyOverview groups canonical family artifacts and preserves state applicability order', () => {
    const overview = buildFamilyEfficiencyOverview(
      'commercial_building_services',
      pkg.sectorStates,
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
      'buildings__commercial__hvac_tuning_bms',
      'buildings__commercial__lighting_retrofit',
    ]);
    assert.deepEqual(overview.orderedStateIds, [
      'buildings__commercial__incumbent_mixed_fuels',
      'buildings__commercial__electrified_efficiency',
      'buildings__commercial__deep_electric',
    ]);
    assert.deepEqual(
      overview.applicableTrackIdsByStateId.buildings__commercial__deep_electric,
      [],
    );
    assert.deepEqual(
      overview.applicablePackageIdsByStateId.buildings__commercial__deep_electric,
      [],
    );
    assert.deepEqual(
      overview.tracks[0].applicableStateIds,
      [
        'buildings__commercial__incumbent_mixed_fuels',
        'buildings__commercial__electrified_efficiency',
      ],
    );
    assert.deepEqual(
      overview.packages[0].applicableStateIds,
      [
        'buildings__commercial__incumbent_mixed_fuels',
        'buildings__commercial__electrified_efficiency',
      ],
    );
  });
});
