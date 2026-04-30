/**
 * Residual role balance diagnostics tests.
 *
 * Verifies that the built-in package no longer uses residual overlay sidecar
 * rows and that first-class residual roles reproduce the 2025 closure
 * quantities formerly represented by overlays.
 *
 * Run:  bunx tsx --test test/balanceDiagnostics.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { summarizeResidualRoleTotals } from '../src/data/balanceDiagnostics.ts';
import { loadPkg } from './solverTestUtils.mjs';

const pkg = loadPkg();
const overlayRows = pkg.residualOverlays2025;
const commodityBalanceRows = pkg.commodityBalance2025;
const emissionsBalanceRows = pkg.emissionsBalance2025;
const residualRoleRows = pkg.resolvedMethodYears.filter(
  (row) => row.role_kind === 'residual' && row.year === 2025,
);
const residualRoleIds = new Set(residualRoleRows.map((row) => row.role_id));
const totals = summarizeResidualRoleTotals(pkg.resolvedMethodYears);

describe('Residual role migration', () => {
  it('residual overlays are removed from the canonical web package load', () => {
    assert.equal(overlayRows.length, 0);
  });

  it('loads 33 residual roles with one 2025 incumbent row each', () => {
    assert.equal(residualRoleIds.size, 33);
    assert.equal(residualRoleRows.length, 33);
    for (const row of residualRoleRows) {
      assert.match(row.method_label.toLowerCase(), /residual|compatibility/);
    }
  });

  it('every residual role has demand, validation, and documentation companions', () => {
    const availablePaths = new Set(pkg.enrichment.availablePaths);
    const residualRoleIds = new Set(residualRoleRows.map((row) => row.role_id));
    for (const roleId of residualRoleIds) {
      for (const filename of ['demand.csv', 'method_years.csv', 'README.md', 'validation.md']) {
        const path = `roles/${roleId}/${filename}`;
        assert.ok(availablePaths.has(path), `${path} should be loaded`);
      }
    }
  });
});

describe('Residual role aggregation totals', () => {
  it('total residual final energy excluding grid losses is about 1354.152 PJ', () => {
    assert.ok(
      Math.abs(totals.totalResidualEnergyPj - 1354.152) < 0.5,
      `Expected about 1354.152, got ${totals.totalResidualEnergyPj}`,
    );
  });

  it('residual final electricity is about 101.599 TWh', () => {
    assert.ok(
      Math.abs((totals.residualFinalElectricityTwh ?? 0) - 101.599) < 0.001,
      `Expected about 101.599, got ${totals.residualFinalElectricityTwh}`,
    );
  });

  it('grid losses and own-use electricity is about 42.420 TWh', () => {
    assert.ok(
      Math.abs((totals.gridLossesOwnUseElectricityTwh ?? 0) - 42.42) < 0.001,
      `Expected about 42.420, got ${totals.gridLossesOwnUseElectricityTwh}`,
    );
  });

  it('total residual energy emissions are about 57.169 MtCO2e', () => {
    assert.ok(
      Math.abs(totals.totalResidualEnergyEmissions - 57.169) < 0.001,
      `Expected about 57.169, got ${totals.totalResidualEnergyEmissions}`,
    );
  });

  it('total residual non-energy emissions excluding LULUCF are about 161.869 MtCO2e', () => {
    assert.ok(
      Math.abs(totals.totalResidualNonEnergyEmissions - 161.869) < 0.001,
      `Expected about 161.869, got ${totals.totalResidualNonEnergyEmissions}`,
    );
  });

  it('LULUCF sink remains optional at -73.7 MtCO2e', () => {
    assert.equal(totals.lulucfSinkMtco2e, -73.7);
  });

  it('total positive carbon-billable residual emissions are about 219.038 MtCO2e', () => {
    assert.ok(
      Math.abs(totals.totalCarbonBillableEmissionsMtco2e - 219.038) < 0.001,
      `Expected about 219.038, got ${totals.totalCarbonBillableEmissionsMtco2e}`,
    );
  });
});

describe('Diagnostic table cross-checks', () => {
  it('baseline_commodity_balance total row difference_to_benchmark_pj_2025 is 0', () => {
    const totalRow = commodityBalanceRows.find((r) => r.commodity === 'total');
    assert.ok(totalRow, 'Expected a "total" row in baseline_commodity_balance.csv');
    const diff = totalRow.difference_to_benchmark_pj_2025;
    assert.equal(diff, 0.0, `Expected difference 0, got ${diff}`);
  });

  it('baseline_emissions_balance positive-sectors row difference is about 0', () => {
    const positiveRow = emissionsBalanceRows.find((r) =>
      r.official_category?.startsWith('Positive-emitting'),
    );
    assert.ok(positiveRow, 'Expected a positive-emitting sectors total row');
    const diff = positiveRow.difference_to_official_mtco2e_2025;
    assert.ok(
      diff !== null && Math.abs(diff) < 0.01,
      `Expected difference about 0, got ${diff}`,
    );
  });
});
