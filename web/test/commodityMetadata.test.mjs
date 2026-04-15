import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeCommodityInput,
  parseUnitRatio,
} from '../src/data/commodityMetadata.ts';
import { buildSolveRequest, normalizeSolverRows } from '../src/solver/buildSolveRequest.ts';
import { loadPkg, loadReferenceConfiguration } from './solverTestUtils.mjs';

test('normalizeCommodityInput converts electricity from GJ ratios into MWh ratios', () => {
  const normalized = normalizeCommodityInput('electricity', 7.2, 'GJ/GJ_service_eq');

  assert.equal(normalized.unit, 'MWh/GJ_service_eq');
  assert.equal(normalized.canonicalUnit, 'MWh');
  assert.ok(Math.abs(normalized.coefficient - 2) < 1e-12);
});

test('normalizeCommodityInput preserves canonical GJ, t, and tCO2_stored units', () => {
  assert.deepEqual(
    normalizeCommodityInput('natural_gas', 1.5, 'GJ/GJ_service_eq'),
    {
      coefficient: 1.5,
      unit: 'GJ/GJ_service_eq',
      canonicalUnit: 'GJ',
    },
  );
  assert.deepEqual(
    normalizeCommodityInput('iron_ore', 1.6, 't/t_crude_steel'),
    {
      coefficient: 1.6,
      unit: 't/t_crude_steel',
      canonicalUnit: 't',
    },
  );
  assert.deepEqual(
    normalizeCommodityInput('capture_service', 0.5, 't/t_cement_equivalent'),
    {
      coefficient: 0.5,
      unit: 'tCO2_stored/t_cement_equivalent',
      canonicalUnit: 'tCO2_stored',
    },
  );
});

test('commodity normalization fails clearly on malformed or unsupported units', () => {
  assert.throws(
    () => normalizeCommodityInput('electricity', 1, 'GJ/'),
    /Malformed/i,
  );
  assert.throws(
    () => normalizeCommodityInput('coal', 1, 'kWh/GJ_service_eq'),
    /Unsupported commodity numerator unit/i,
  );
  assert.throws(
    () => parseUnitRatio(''),
    /required/i,
  );
});

test('normalizeSolverRows canonicalizes package electricity inputs', () => {
  const pkg = loadPkg();
  const rows = normalizeSolverRows(pkg);
  const residentialIncumbent = rows.find((row) => {
    return row.outputId === 'residential_building_services'
      && row.stateId === 'buildings__residential__incumbent_mixed_fuels'
      && row.year === 2025;
  });
  const electricityInput = residentialIncumbent?.inputs.find((input) => input.commodityId === 'electricity');
  const steelEaf = rows.find((row) => {
    return row.outputId === 'crude_steel'
      && row.stateId === 'steel__crude_steel__scrap_eaf'
      && row.year === 2025;
  });
  const steelElectricityInput = steelEaf?.inputs.find((input) => input.commodityId === 'electricity');

  assert.ok(electricityInput, 'expected residential electricity input');
  assert.equal(electricityInput.unit, 'MWh/GJ_service_eq');
  assert.ok(Math.abs(electricityInput.coefficient - (0.528 / 3.6)) < 1e-12);

  assert.ok(steelElectricityInput, 'expected steel electricity input');
  assert.equal(steelElectricityInput.unit, 'MWh/t_crude_steel');
  assert.ok(Math.abs(steelElectricityInput.coefficient - 0.55) < 1e-12);
});

test('buildSolveRequest attaches consistent objective cost metadata from the package', () => {
  const pkg = loadPkg();
  const configuration = loadReferenceConfiguration();
  const request = buildSolveRequest(pkg, configuration);

  assert.deepEqual(request.objectiveCost, {
    currency: 'AUD_2024',
    costBasisYear: 2024,
  });
});
