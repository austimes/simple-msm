import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPackage } from '../src/data/packageLoader.ts';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';
import { solveWithLpAdapter } from '../src/solver/lpAdapter.ts';
import { buildSystemFlowGraphData } from '../src/results/systemFlowGraph.ts';
import { materializeServiceControlsFromRoleControls } from './roleControlTestUtils.mjs';

const FINAL_ELECTRICITY_RESIDUAL_FAMILIES = [
  // Building residual companions (commercial_other, residential_other) are no longer
  // top-level residual families: they are decomposition_child residual companions
  // activated only by the parent end-use decomposition representations.
  'transport_rail_passenger',
  'transport_rail_freight',
  'transport_air_passenger',
  'transport_marine_freight',
  'transport_other_non_road',
  'transport_other',
  'chemical_products',
  'other_material_products',
  'manufacturing_other',
  'mining_other',
  'construction_other',
  'water_waste_other',
  'other_other',
];

function electricityInputForOutput(request, outputId) {
  return request.rows
    .filter((row) => row.year === 2025 && row.outputId === outputId)
    .flatMap((row) => row.inputs)
    .filter((input) => input.commodityId === 'electricity')
    .reduce((sum, input) => sum + input.coefficient, 0);
}

test('residual stubs load as first-class families', () => {
  const pkg = loadPackage();
  const residualFamilies = pkg.rolePresentationMetadata.filter(
    (role) => role.default_representation_kind === 'residual_stub',
  );

  assert.equal(residualFamilies.length, 28);
  assert.equal(pkg.residualOverlays2025.length, 0);
  assert.equal(pkg.appConfig.output_roles.electricity_grid_losses_own_use?.display_group, 'Energy supply');
});

test('built-in solve request uses residual families instead of external electricity demand', () => {
  const pkg = loadPackage();
  const request = buildSolveRequest(pkg, pkg.defaultConfiguration);
  const result = solveWithLpAdapter(request);

  assert.equal(result.status, 'solved');
  assert.equal(request.configuration.externalCommodityDemandByCommodity.electricity, undefined);
  assert.ok(request.rows.some((row) => row.outputId === 'electricity_grid_losses_own_use'));
  assert.ok(!request.rows.some((row) => row.outputId === 'residual_lulucf_sink'));

  const residualFinalElectricity = FINAL_ELECTRICITY_RESIDUAL_FAMILIES
    .reduce((sum, outputId) => sum + electricityInputForOutput(request, outputId), 0);
  const lossesOwnUse = electricityInputForOutput(request, 'electricity_grid_losses_own_use');
  const electricityBalance = result.reporting.commodityBalances.find(
    (balance) => balance.year === 2025 && balance.commodityId === 'electricity',
  );

  assert.ok(Math.abs(residualFinalElectricity - 101_073_730.61178) < 1);
  assert.ok(Math.abs(lossesOwnUse - 42_420_000) < 1);
  assert.ok(electricityBalance);
  assert.ok(Math.abs(electricityBalance.totalDemand - 283_395_010) < 200);
});

test('disabling a residual family removes its normal demand and rows', () => {
  const pkg = loadPackage();
  const configuration = materializeServiceControlsFromRoleControls(
    structuredClone(pkg.defaultConfiguration),
    { resolvedMethodYears: pkg.resolvedMethodYears },
  );
  configuration.service_controls.commercial_other = {
    mode: 'optimize',
    active_state_ids: [],
  };

  const request = buildSolveRequest(pkg, configuration);

  assert.equal(request.rows.some((row) => row.outputId === 'commercial_other'), false);
  assert.equal(request.configuration.serviceDemandByOutput.commercial_other, undefined);
});

test('system flow graph renders residual families without an external demand node', () => {
  const pkg = loadPackage();
  const request = buildSolveRequest(pkg, pkg.defaultConfiguration);
  const result = solveWithLpAdapter(request);
  const graph = buildSystemFlowGraphData(request, result, {
    year: 2025,
    systemStructureGroups: pkg.systemStructureGroups,
    systemStructureMembers: pkg.systemStructureMembers,
  });

  assert.equal(graph.nodes.some((node) => node.role === 'external demand'), false);
  // Residential and commercial residual companions are no longer top-level routes;
  // sample a representative remaining residual family to confirm route nodes still render.
  assert.ok(graph.nodes.some((node) => node.outputId === 'transport_rail_passenger' && node.kind === 'route'));
  assert.ok(graph.nodes.some((node) => node.outputId === 'electricity_grid_losses_own_use' && node.kind === 'route'));
});
