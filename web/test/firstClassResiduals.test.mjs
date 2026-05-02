import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPackage } from '../src/data/packageLoader.ts';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';
import { solveWithLpAdapter } from '../src/solver/lpAdapter.ts';
import { buildSystemFlowGraphData } from '../src/results/systemFlowGraph.ts';

const FINAL_ELECTRICITY_RESIDUAL_FAMILIES = [
  'commercial_other',
  'residential_other',
  'transport_other',
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

test('residual stubs load as first-class families with library grouping', () => {
  const pkg = loadPackage();
  const residualFamilies = pkg.familyMetadata.filter((family) => family.family_resolution === 'residual_stub');
  const memberCountByFamily = new Map();

  for (const member of pkg.systemStructureMembers) {
    memberCountByFamily.set(member.family_id, (memberCountByFamily.get(member.family_id) ?? 0) + 1);
  }

  assert.equal(residualFamilies.length, 14);
  assert.equal(pkg.residualOverlays2025.length, 0);
  assert.equal(pkg.appConfig.output_roles.electricity_grid_losses_own_use?.display_group, 'Energy supply');
  for (const family of pkg.familyMetadata) {
    assert.equal(memberCountByFamily.get(family.family_id), 1, `${family.family_id} should have exactly one group`);
  }
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

  assert.ok(Math.abs(residualFinalElectricity - 101_598_611.11111) < 1);
  assert.ok(Math.abs(lossesOwnUse - 42_420_000) < 1);
  assert.ok(electricityBalance);
  assert.ok(Math.abs(electricityBalance.totalDemand - 303_237_724) < 2);
});

test('disabling a residual family removes its normal demand and rows', () => {
  const pkg = loadPackage();
  const configuration = structuredClone(pkg.defaultConfiguration);
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
  assert.ok(graph.nodes.some((node) => node.outputId === 'commercial_other' && node.kind === 'route'));
  assert.ok(graph.nodes.some((node) => node.outputId === 'electricity_grid_losses_own_use' && node.kind === 'route'));
});
