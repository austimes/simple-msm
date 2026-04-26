import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildGeneratedIncumbentBaseConfiguration,
  GENERATED_INCUMBENT_BASE_LABEL,
} from '../src/data/systemStructureModel.ts';
import {
  buildConfiguration,
  INCUMBENT_STATE_IDS,
  loadPkg,
} from './solverTestUtils.mjs';

const pkg = loadPkg();

function findNonIncumbentStateId(outputId) {
  const row = pkg.sectorStates.find((candidate) =>
    candidate.service_or_output_name === outputId
    && !candidate.is_default_incumbent_2025,
  );
  assert.ok(row, `expected a non-incumbent state for ${outputId}`);
  return row.state_id;
}

describe('systemStructureModel', () => {
  test('generated incumbent base preserves levers and settings while forcing enabled outputs to incumbents', () => {
    const focus = buildConfiguration(pkg.appConfig, {
      serviceControls: {
        residential_building_services: {
          mode: 'optimize',
          active_state_ids: [findNonIncumbentStateId('residential_building_services')],
        },
        passenger_road_transport: {
          mode: 'optimize',
          active_state_ids: [],
        },
        freight_road_transport: {
          mode: 'optimize',
          active_state_ids: [],
        },
      },
      solverOptions: {
        respect_max_share: false,
      },
    });
    focus.name = 'Focus with route and efficiency pressure';
    focus.commodity_pricing.selections_by_commodity.electricity = 'high';
    focus.carbon_price['2030'] = 123;
    focus.presentation_options = {
      ...(focus.presentation_options ?? {}),
      residual_overlay_display_mode: 'individual',
    };
    focus.efficiency_controls = {
      autonomous_mode: 'off',
      autonomous_modes_by_output: {
        residential_building_services: 'off',
      },
      package_mode: 'allow_list',
      package_ids: ['buildings__residential__thermal_shell_retrofit'],
    };

    const generated = buildGeneratedIncumbentBaseConfiguration(focus, pkg);

    assert.equal(generated.name, GENERATED_INCUMBENT_BASE_LABEL);
    assert.deepEqual(generated.years, focus.years);
    assert.deepEqual(generated.service_demands, focus.service_demands);
    assert.deepEqual(generated.demand_generation, focus.demand_generation);
    assert.deepEqual(generated.external_commodity_demands, focus.external_commodity_demands);
    assert.deepEqual(generated.commodity_pricing, focus.commodity_pricing);
    assert.deepEqual(generated.carbon_price, focus.carbon_price);
    assert.deepEqual(generated.solver_options, focus.solver_options);
    assert.deepEqual(generated.presentation_options, focus.presentation_options);

    assert.deepEqual(
      generated.service_controls.residential_building_services.active_state_ids,
      [INCUMBENT_STATE_IDS.residential_building_services],
    );
    assert.deepEqual(
      generated.service_controls.passenger_road_transport.active_state_ids,
      [],
    );
    assert.deepEqual(
      generated.service_controls.freight_road_transport.active_state_ids,
      [],
    );
    assert.deepEqual(generated.efficiency_controls, {
      autonomous_mode: 'baseline',
      autonomous_modes_by_output: {},
      package_mode: 'off',
      package_ids: [],
    });
    assert.equal(generated.residual_overlays, undefined);
  });

  test('generated incumbent base treats residual families as normal service controls', () => {
    const focus = buildConfiguration(pkg.appConfig, {
      serviceControls: {
        passenger_road_transport: {
          mode: 'optimize',
          active_state_ids: [],
        },
        freight_road_transport: {
          mode: 'optimize',
          active_state_ids: [],
        },
        residential_other: {
          mode: 'optimize',
          active_state_ids: [],
        },
        transport_other: {
          mode: 'optimize',
          active_state_ids: ['transport_other__residual_incumbent'],
        },
        residual_lulucf_sink: {
          mode: 'optimize',
          active_state_ids: [],
        },
      },
    });

    const generated = buildGeneratedIncumbentBaseConfiguration(focus, pkg);

    assert.deepEqual(generated.service_controls.residential_other.active_state_ids, []);
    assert.deepEqual(generated.service_controls.transport_other.active_state_ids, [
      'transport_other__residual_incumbent',
    ]);
    assert.deepEqual(generated.service_controls.residual_lulucf_sink.active_state_ids, []);
    assert.equal(generated.residual_overlays, undefined);
  });
});
