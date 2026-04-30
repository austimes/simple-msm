import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { loadPackage } from '../src/data/packageLoader.ts';
import { parseCsv } from '../src/data/parseCsv.ts';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';
import { loadPkg, loadReferenceConfiguration } from './solverTestUtils.mjs';

const PACKAGE_ROOT = join(import.meta.dirname, '../../energy_system_representation_library');
const GUARDRAIL_PATH = 'validation/cement_double_counting_guardrails.csv';
const CEMENT_PARENT_ROLE = 'make_cement_equivalent';
const CEMENT_AGGREGATE = 'make_cement_equivalent__pathway_bundle';
const CEMENT_DECOMPOSITION = 'make_cement_equivalent__clinker_decomposition';
const CEMENT_CHILD_ROLES = [
  'make_clinker_intermediate',
  'generate_cement_kiln_heat',
  'grind_blend_cement_equivalent',
];
const DIRECT_FUEL_COMMODITIES = new Set(['coal', 'natural_gas', 'biomass', 'hydrogen']);

function readGuardrailRows() {
  return parseCsv(readFileSync(join(PACKAGE_ROOT, GUARDRAIL_PATH), 'utf8'));
}

function buildPackageForSolve(pkg) {
  return {
    resolvedMethodYears: pkg.resolvedMethodYears,
    appConfig: pkg.appConfig,
    autonomousEfficiencyTracks: pkg.autonomousEfficiencyTracks,
    efficiencyPackages: pkg.efficiencyPackages,
    roleMetadata: pkg.roleMetadata,
    roleActivityDrivers: pkg.roleActivityDrivers,
    representations: pkg.representations,
    roleDecompositionEdges: pkg.roleDecompositionEdges,
    methods: pkg.methods,
  };
}

function buildCementDecompositionRequest() {
  const pkg = loadPkg();
  const referenceConfiguration = loadReferenceConfiguration();
  const configuration = {
    ...referenceConfiguration,
    representation_by_role: {
      ...referenceConfiguration.representation_by_role,
      [CEMENT_PARENT_ROLE]: CEMENT_DECOMPOSITION,
    },
  };

  return buildSolveRequest(buildPackageForSolve(pkg), configuration);
}

function inputCommodityIds(row) {
  return row.inputs.map((input) => input.commodityId);
}

function hasDirectFuelInput(row) {
  return inputCommodityIds(row).some((commodityId) => DIRECT_FUEL_COMMODITIES.has(commodityId));
}

test('cement double-counting guardrails are packaged and name the active boundaries', () => {
  const pkg = loadPackage();
  const rows = readGuardrailRows();

  assert.equal(pkg.enrichment.availablePaths.includes(GUARDRAIL_PATH), true);
  assert.deepEqual(rows.map((row) => row.guardrail_id), [
    'aggregate_parent_exclusion',
    'host_kiln_heat_boundary',
    'calcination_process_boundary',
    'finish_grinding_boundary',
  ]);
  assert.ok(rows.every((row) => row.parent_role_id === CEMENT_PARENT_ROLE));
  assert.ok(rows.every((row) => row.aggregate_representation_id === CEMENT_AGGREGATE));
  assert.ok(rows.every((row) => row.decomposition_representation_id === CEMENT_DECOMPOSITION));
  assert.ok(rows.every((row) => row.forbidden_double_counting_signal.length > 0));
  assert.ok(rows.every((row) => row.validation_expectation.length > 0));
});

test('active cement decomposition excludes aggregate parent heat and process rows', () => {
  const pkg = loadPackage();
  const request = buildCementDecompositionRequest();
  const activeChildRoles = new Set(request.rows.map((row) => row.roleId));
  const activeAggregateRows = request.rows.filter((row) =>
    row.roleId === CEMENT_PARENT_ROLE
    || row.representationId === CEMENT_AGGREGATE
  );
  const aggregateRows = pkg.resolvedMethodYears.filter((row) =>
    row.role_id === CEMENT_PARENT_ROLE
    && row.representation_id === CEMENT_AGGREGATE
  );

  assert.ok(CEMENT_CHILD_ROLES.every((roleId) => activeChildRoles.has(roleId)));
  assert.equal(activeAggregateRows.length, 0);

  assert.ok(aggregateRows.some((row) =>
    row.input_commodities.some((commodityId) => DIRECT_FUEL_COMMODITIES.has(commodityId))
    && row.process_emissions_by_pollutant.length > 0
  ));
});

test('decomposed cement rows keep heat, process, and final-product boundaries traceable', () => {
  const request = buildCementDecompositionRequest();
  const rowsByRole = new Map(CEMENT_CHILD_ROLES.map((roleId) => [
    roleId,
    request.rows.filter((row) => row.roleId === roleId),
  ]));
  const clinkerRows = rowsByRole.get('make_clinker_intermediate') ?? [];
  const kilnRows = rowsByRole.get('generate_cement_kiln_heat') ?? [];
  const finishRows = rowsByRole.get('grind_blend_cement_equivalent') ?? [];

  assert.ok(clinkerRows.length > 0);
  assert.ok(kilnRows.length > 0);
  assert.ok(finishRows.length > 0);

  assert.ok(clinkerRows.every((row) => inputCommodityIds(row).includes('cement_kiln_heat')));
  assert.ok(clinkerRows.every((row) => !hasDirectFuelInput(row)));
  assert.ok(clinkerRows.every((row) => row.directEmissions.some((entry) => entry.source === 'process')));
  assert.ok(clinkerRows.every((row) => row.directEmissions.every((entry) => entry.source !== 'energy')));

  assert.ok(kilnRows.every((row) => hasDirectFuelInput(row)));
  assert.ok(kilnRows.every((row) => row.directEmissions.some((entry) => entry.source === 'energy')));
  assert.ok(kilnRows.every((row) => row.directEmissions.every((entry) => entry.source !== 'process')));

  assert.ok(finishRows.every((row) => inputCommodityIds(row).includes('make_clinker_intermediate')));
  assert.ok(finishRows.every((row) => inputCommodityIds(row).includes('electricity')));
  assert.ok(finishRows.every((row) => !hasDirectFuelInput(row)));
  assert.ok(finishRows.every((row) => row.directEmissions.length === 0));
});
