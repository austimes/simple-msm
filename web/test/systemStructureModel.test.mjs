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

function findNonIncumbentMethodId(outputId) {
  const row = pkg.resolvedMethodYears.find((candidate) =>
    candidate.output_id === outputId
    && !candidate.is_default_incumbent_2025,
  );
  assert.ok(row, `expected a non-incumbent state for ${outputId}`);
  return row.method_id;
}

describe('systemStructureModel', () => {
  test('generated incumbent base preserves levers and settings while forcing enabled outputs to incumbents', () => {
    const focus = buildConfiguration(pkg.appConfig, {
      serviceControls: {
        residential_building_services: {
          mode: 'optimize',
          active_state_ids: [findNonIncumbentMethodId('residential_building_services')],
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
      autonomous_modes_by_role: {
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
      generated.role_controls.serve_residential_building_occupants.active_method_ids,
      [INCUMBENT_STATE_IDS.residential_building_services],
    );
    assert.deepEqual(
      generated.role_controls.move_passengers_by_road.active_method_ids,
      [],
    );
    assert.deepEqual(
      generated.role_controls.move_freight_by_road.active_method_ids,
      [],
    );
    assert.deepEqual(generated.efficiency_controls, {
      autonomous_mode: 'baseline',
      autonomous_modes_by_role: {},
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
        residual_lulucf_sink: {
          mode: 'optimize',
          active_state_ids: ['residual_lulucf_sink__residual_incumbent'],
        },
      },
    });

    const generated = buildGeneratedIncumbentBaseConfiguration(focus, pkg);

    assert.deepEqual(generated.role_controls.account_remaining_residential_building_services.active_method_ids, []);
    assert.deepEqual(generated.role_controls.account_land_carbon_stock_change.active_method_ids, [
      'residual_lulucf_sink__residual_incumbent',
    ]);
    assert.equal(generated.residual_overlays, undefined);
  });
});
