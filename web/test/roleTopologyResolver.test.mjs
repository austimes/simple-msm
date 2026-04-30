import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPackage } from '../src/data/packageLoader.ts';
import {
  filterResolvedMethodYearRowsByActiveRoleStructure,
  resolveActiveRoleStructure,
} from '../src/data/roleTopologyResolver.ts';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';
import { solveWithLpAdapter } from '../src/solver/lpAdapter.ts';

function cloneConfiguration(configuration, overrides = {}) {
  return {
    ...structuredClone(configuration),
    ...overrides,
    representation_by_role: {
      ...(configuration.representation_by_role ?? {}),
      ...(overrides.representation_by_role ?? {}),
    },
  };
}

test('resolver keeps crude steel as a direct pathway bundle by default', () => {
  const pkg = loadPackage();
  const resolved = resolveActiveRoleStructure(pkg, {});

  assert.equal(
    resolved.activeRepresentationByRole.produce_crude_steel,
    'produce_crude_steel__pathway_bundle',
  );
  assert.deepEqual(
    resolved.activeMethodIdsByRole.produce_crude_steel,
    [
      'steel__crude_steel__bf_bof_conventional',
      'steel__crude_steel__scrap_eaf',
      'steel__crude_steel__bf_bof_ccs_transition',
      'steel__crude_steel__h2_dri_electric',
    ],
  );
  assert.equal(resolved.activeRoleIds.includes('produce_direct_reduced_iron'), false);

  const activeRows = filterResolvedMethodYearRowsByActiveRoleStructure(pkg.resolvedMethodYears, resolved);
  assert.ok(activeRows.some((row) => row.method_id === 'steel__crude_steel__h2_dri_electric'));
  assert.equal(activeRows.some((row) => row.role_id === 'produce_direct_reduced_iron'), false);
});

test('resolver activates crude steel child roles under the H2 DRI decomposition', () => {
  const pkg = loadPackage();
  const resolved = resolveActiveRoleStructure(pkg, {
    representation_by_role: {
      produce_crude_steel: 'produce_crude_steel__h2_dri_decomposition',
    },
  });

  assert.equal(
    resolved.activeRepresentationByRole.produce_crude_steel,
    'produce_crude_steel__h2_dri_decomposition',
  );
  assert.deepEqual(resolved.activeMethodIdsByRole.produce_crude_steel, []);
  assert.deepEqual(
    resolved.roles
      .find((role) => role.roleId === 'produce_crude_steel')
      ?.activeChildRoleIds,
    [
      'produce_crude_steel_non_h2_dri_residual',
      'produce_direct_reduced_iron',
      'melt_refine_dri_crude_steel',
    ],
  );
  assert.deepEqual(
    resolved.activeMethodIdsByRole.produce_direct_reduced_iron,
    [
      'steel__dri__h2_shaft_furnace',
      'steel__dri__gas_shaft_furnace',
      'steel__dri__imported_residual',
    ],
  );
  assert.deepEqual(
    resolved.activeMethodIdsByRole.melt_refine_dri_crude_steel,
    [
      'steel__dri_melt_refine__eaf_finishing',
      'steel__dri_melt_refine__electric_smelter',
    ],
  );
  assert.equal(resolved.activeMethodIdsByRole.produce_crude_steel.includes('steel__crude_steel__h2_dri_electric'), false);
});

test('buildSolveRequest filters rows through the selected role representation structure', () => {
  const pkg = loadPackage();
  const directRequest = buildSolveRequest(pkg, pkg.defaultConfiguration);
  assert.ok(directRequest.rows.some((row) => row.methodId === 'steel__crude_steel__h2_dri_electric'));
  assert.equal(directRequest.rows.some((row) => row.outputId === 'produce_direct_reduced_iron'), false);

  const decomposed = cloneConfiguration(pkg.defaultConfiguration, {
    representation_by_role: {
      produce_crude_steel: 'produce_crude_steel__h2_dri_decomposition',
    },
    service_controls: {
      ...pkg.defaultConfiguration.service_controls,
      crude_steel: {
        mode: 'optimize',
        active_state_ids: null,
      },
    },
  });
  const decomposedRequest = buildSolveRequest(pkg, decomposed);

  assert.equal(decomposedRequest.rows.some((row) => row.methodId === 'steel__crude_steel__h2_dri_electric'), false);
  assert.ok(decomposedRequest.rows.some((row) => row.outputId === 'produce_direct_reduced_iron'));
  assert.ok(decomposedRequest.rows.some((row) => row.outputId === 'melt_refine_dri_crude_steel'));
  assert.ok(decomposedRequest.configuration.serviceDemandByOutput.crude_steel);
  assert.equal(decomposedRequest.roleTopology?.decompositions.length, 1);
});

test('decomposed crude-steel pilot solves with balanced intermediate DRI', () => {
  const pkg = loadPackage();
  const decomposed = cloneConfiguration(pkg.defaultConfiguration, {
    representation_by_role: {
      produce_crude_steel: 'produce_crude_steel__h2_dri_decomposition',
    },
  });
  const result = solveWithLpAdapter(buildSolveRequest(pkg, decomposed));
  const driBalances = result.reporting.commodityBalances.filter((summary) =>
    summary.commodityId === 'direct_reduced_iron',
  );

  assert.equal(result.status, 'solved');
  assert.ok(driBalances.some((summary) => summary.supply > 0));
  assert.ok(driBalances.every((summary) => Math.abs(summary.balanceGap ?? 0) < 0.02));
});

test('resolver rejects double coverage, inactive required roles, and missing representation selections', () => {
  const pkg = loadPackage();

  assert.throws(
    () => resolveActiveRoleStructure(
      {
        ...pkg,
        roleDecompositionEdges: [
          ...pkg.roleDecompositionEdges,
          {
            parent_representation_id: 'produce_crude_steel__h2_dri_decomposition',
            parent_role_id: 'produce_crude_steel',
            child_role_id: 'produce_direct_reduced_iron',
            edge_kind: 'required_child',
            is_required: true,
            display_order: 3,
            coverage_notes: 'Duplicate child for validation.',
          },
        ],
      },
      {
        representation_by_role: {
          produce_crude_steel: 'produce_crude_steel__h2_dri_decomposition',
        },
      },
    ),
    /covered more than once/,
  );

  assert.throws(
    () => resolveActiveRoleStructure(
      {
        ...pkg,
        roleDecompositionEdges: pkg.roleDecompositionEdges.filter((edge) =>
          edge.child_role_id !== 'produce_direct_reduced_iron',
        ),
      },
      {
        representation_by_role: {
          produce_crude_steel: 'produce_crude_steel__h2_dri_decomposition',
        },
      },
    ),
    /Required child role "produce_direct_reduced_iron" is inactive/,
  );

  assert.throws(
    () => resolveActiveRoleStructure(
      pkg,
      {
        representation_by_role: {
          produce_direct_reduced_iron: 'produce_crude_steel__pathway_bundle',
        },
      },
    ),
    /belongs to role "produce_crude_steel", not "produce_direct_reduced_iron"/,
  );

  assert.throws(
    () => resolveActiveRoleStructure(
      {
        ...pkg,
        representations: pkg.representations.filter((representation) =>
          representation.role_id !== 'produce_crude_steel',
        ),
      },
      {},
    ),
    /Missing representation selection/,
  );
});
