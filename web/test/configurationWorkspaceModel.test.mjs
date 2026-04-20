import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildStateCatalog,
  getActiveStateIds,
} from '../src/data/configurationWorkspaceModel.ts';
import { buildConfiguration, loadPkg } from './solverTestUtils.mjs';

const pkg = loadPkg();

describe('buildStateCatalog', () => {
  test('orders workspace states by sort metadata and prefers standardized display labels', () => {
    const catalog = buildStateCatalog(pkg.sectorStates, pkg.appConfig);
    const roadTransport = catalog.find((entry) => entry.sector === 'road_transport');
    const passengerRoad = roadTransport?.subsectors.find(
      (entry) => entry.outputId === 'passenger_road_transport',
    );

    assert.ok(passengerRoad, 'expected passenger road transport catalog entry');
    assert.deepEqual(
      passengerRoad.states.map((state) => state.stateId),
      [
        'road_transport__passenger_road__ice_fleet',
        'road_transport__passenger_road__hybrid_transition',
        'road_transport__passenger_road__bev',
      ],
    );
    assert.deepEqual(
      passengerRoad.states.map((state) => state.stateLabel),
      [
        'Incumbent | ice fleet',
        'Ambition 1 | hybrid transition',
        'Ambition 2 | bev',
      ],
    );
  });

  test('orders crude steel states in O0 through O3 sequence from balanced metadata', () => {
    const catalog = buildStateCatalog(pkg.sectorStates, pkg.appConfig);
    const steel = catalog.find((entry) => entry.sector === 'steel');
    const crudeSteel = steel?.subsectors.find((entry) => entry.outputId === 'crude_steel');
    const steelRowsByStateId = new Map(
      pkg.sectorStates
        .filter((row) => row.service_or_output_name === 'crude_steel' && row.year === 2025)
        .map((row) => [row.state_id, row]),
    );

    assert.ok(crudeSteel, 'expected crude steel catalog entry');
    assert.deepEqual(
      crudeSteel.states.map((state) => state.stateId),
      [
        'steel__crude_steel__bf_bof_conventional',
        'steel__crude_steel__scrap_eaf',
        'steel__crude_steel__bf_bof_ccs_transition',
        'steel__crude_steel__h2_dri_electric',
      ],
    );
    assert.deepEqual(
      crudeSteel.states.map((state) => steelRowsByStateId.get(state.stateId)?.state_option_code),
      ['O0', 'O1', 'O2', 'O3'],
    );
    assert.deepEqual(
      crudeSteel.states.map((state) => steelRowsByStateId.get(state.stateId)?.state_option_rank),
      [0, 1, 2, 3],
    );
  });

  test('falls back to label sorting and legacy labels when metadata is absent', () => {
    const legacySectorStates = [
      {
        sector: 'legacy_sector',
        subsector: 'legacy_subsector',
        service_or_output_name: 'legacy_output',
        state_id: 'legacy__bev',
        state_label: 'Battery-electric legacy pathway',
        state_label_standardized: '',
        state_option_label: '',
        state_sort_key: '',
        state_option_rank: null,
      },
      {
        sector: 'legacy_sector',
        subsector: 'legacy_subsector',
        service_or_output_name: 'legacy_output',
        state_id: 'legacy__incumbent',
        state_label: 'Incumbent legacy pathway',
        state_label_standardized: '',
        state_option_label: '',
        state_sort_key: '',
        state_option_rank: null,
      },
    ];

    const catalog = buildStateCatalog(legacySectorStates, {
      output_roles: {},
    });

    assert.deepEqual(
      catalog[0].subsectors[0].states.map((state) => state.stateId),
      ['legacy__bev', 'legacy__incumbent'],
    );
    assert.deepEqual(
      catalog[0].subsectors[0].states.map((state) => state.stateLabel),
      ['Battery-electric legacy pathway', 'Incumbent legacy pathway'],
    );
  });

  test('falls back to option labels when standardized labels are absent', () => {
    const optionLabelRows = [
      {
        sector: 'option_sector',
        subsector: 'option_subsector',
        service_or_output_name: 'option_output',
        state_id: 'option__incumbent',
        state_label: 'Incumbent raw label',
        state_label_standardized: '',
        state_option_label: 'O0 | incumbent',
        state_sort_key: '01_incumbent',
        state_option_rank: 0,
      },
    ];

    const catalog = buildStateCatalog(optionLabelRows, {
      output_roles: {},
    });

    assert.equal(catalog[0].subsectors[0].states[0].stateLabel, 'O0 | incumbent');
  });
});

describe('getActiveStateIds', () => {
  test('active_state_ids controls keep only listed pathways active', () => {
    const electricityStateIds = Array.from(
      new Set(
        pkg.sectorStates
          .filter((row) => row.service_or_output_name === 'electricity')
          .map((row) => row.state_id),
      ),
    );

    assert.ok(electricityStateIds.length >= 2, 'expected multiple electricity pathways');

    const [primaryStateId, disabledStateId] = electricityStateIds;
    const activeIds = electricityStateIds.filter((id) => id !== disabledStateId);
    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Electricity fixed-share denominator semantics',
      serviceControls: {
        electricity: {
          mode: 'optimize',
          active_state_ids: activeIds,
        },
      },
    });

    const resultIds = getActiveStateIds(configuration, 'electricity', electricityStateIds);

    assert.ok(resultIds.includes(primaryStateId));
    assert.ok(!resultIds.includes(disabledStateId));
    assert.equal(resultIds.length, electricityStateIds.length - 1);
  });

  test('single-path active_state_ids controls still expose only listed pathways as active', () => {
    const residentialStateIds = Array.from(
      new Set(
        pkg.sectorStates
          .filter((row) => row.service_or_output_name === 'residential_building_services')
          .map((row) => row.state_id),
      ),
    );

    assert.ok(residentialStateIds.length >= 2, 'expected multiple residential pathways');

    const [selectedStateId, disabledStateId] = residentialStateIds;
    const activeIds = residentialStateIds.filter((id) => id !== disabledStateId);
    const configuration = buildConfiguration(pkg.appConfig, {
      name: 'Residential single-path exact-share availability semantics',
      serviceControls: {
        residential_building_services: {
          mode: 'optimize',
          active_state_ids: activeIds,
        },
      },
    });

    const resultIds = getActiveStateIds(
      configuration,
      'residential_building_services',
      residentialStateIds,
    );

    assert.ok(resultIds.includes(selectedStateId));
    assert.ok(!resultIds.includes(disabledStateId));
    assert.equal(resultIds.length, residentialStateIds.length - 1);
  });
});
