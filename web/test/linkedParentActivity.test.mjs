import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';
import {
  loadPkg,
  loadReferenceConfiguration,
} from './solverTestUtils.mjs';

const CEMENT_DECOMPOSITION = 'make_cement_equivalent__clinker_decomposition';

function buildPackageForSolve(pkg, overrides = {}) {
  return {
    resolvedMethodYears: pkg.resolvedMethodYears,
    appConfig: pkg.appConfig,
    autonomousEfficiencyTracks: pkg.autonomousEfficiencyTracks,
    efficiencyPackages: pkg.efficiencyPackages,
    roleMetadata: pkg.roleMetadata,
    roleActivityDrivers: overrides.roleActivityDrivers ?? pkg.roleActivityDrivers,
    representations: pkg.representations,
    roleDecompositionEdges: pkg.roleDecompositionEdges,
    methods: pkg.methods,
  };
}

function buildCementDecompositionRequest(overrides = {}) {
  const pkg = loadPkg();
  const referenceConfiguration = loadReferenceConfiguration();
  const configuration = {
    ...referenceConfiguration,
    representation_by_role: {
      ...referenceConfiguration.representation_by_role,
      make_cement_equivalent: CEMENT_DECOMPOSITION,
    },
  };

  return buildSolveRequest(
    buildPackageForSolve(pkg, overrides),
    configuration,
  );
}

test('active cement decomposition carries linked child activity derived from parent demand', () => {
  const request = buildCementDecompositionRequest();
  const parentDemand = request.configuration.serviceDemandByOutput.cement_equivalent;

  assert.ok(parentDemand, 'parent cement demand should remain the single service-demand anchor');
  assert.equal(request.configuration.serviceDemandByOutput.make_clinker_intermediate, undefined);
  assert.equal(request.configuration.serviceDemandByOutput.generate_cement_kiln_heat, undefined);
  assert.equal(request.configuration.serviceDemandByOutput.grind_blend_cement_equivalent, undefined);

  assert.equal(
    request.configuration.linkedActivityByOutput?.make_clinker_intermediate?.['2025'],
    parentDemand['2025'] * 0.72,
  );
  assert.equal(
    request.configuration.linkedActivityByOutput?.generate_cement_kiln_heat?.['2025'],
    parentDemand['2025'] * 2.5,
  );
  assert.equal(
    request.configuration.linkedActivityByOutput?.grind_blend_cement_equivalent?.['2025'],
    parentDemand['2025'],
  );

  for (const year of request.configuration.years.map(String)) {
    assert.equal(
      request.configuration.linkedActivityByOutput?.make_clinker_intermediate?.[year],
      parentDemand[year] * 0.72,
      `clinker linked activity should track cement demand in ${year}`,
    );
    assert.equal(
      request.configuration.linkedActivityByOutput?.generate_cement_kiln_heat?.[year],
      parentDemand[year] * 2.5,
      `kiln heat linked activity should track cement demand in ${year}`,
    );
    assert.equal(
      request.configuration.linkedActivityByOutput?.grind_blend_cement_equivalent?.[year],
      parentDemand[year],
      `final cement linked activity should track cement demand in ${year}`,
    );
  }
});

test('linked parent activity is not materialized when the aggregate cement representation is active', () => {
  const pkg = loadPkg();
  const request = buildSolveRequest(
    buildPackageForSolve(pkg),
    loadReferenceConfiguration(),
  );

  assert.equal(request.configuration.linkedActivityByOutput?.make_clinker_intermediate, undefined);
  assert.equal(request.configuration.linkedActivityByOutput?.generate_cement_kiln_heat, undefined);
  assert.equal(request.configuration.linkedActivityByOutput?.grind_blend_cement_equivalent, undefined);
});

test('active linked parent activity validates required parent coefficients', () => {
  const pkg = loadPkg();
  const roleActivityDrivers = pkg.roleActivityDrivers.map((driver) =>
    driver.role_id === 'make_clinker_intermediate'
      ? { ...driver, parent_activity_coefficient: null }
      : driver
  );
  const referenceConfiguration = loadReferenceConfiguration();
  const configuration = {
    ...referenceConfiguration,
    representation_by_role: {
      ...referenceConfiguration.representation_by_role,
      make_cement_equivalent: CEMENT_DECOMPOSITION,
    },
  };

  assert.throws(
    () => buildSolveRequest(buildPackageForSolve(pkg, { roleActivityDrivers }), configuration),
    /linked parent activity for role "make_clinker_intermediate".*parent_activity_coefficient/,
  );
});
