/**
 * Residual family balance diagnostics tests.
 *
 * Verifies that the built-in package no longer uses residual overlay sidecar
 * rows and that first-class residual families reproduce the 2025 closure
 * quantities formerly represented by overlays.
 *
 * Run:  bunx tsx --test test/balanceDiagnostics.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from '../src/data/parseCsv.ts';
import { summarizeResidualFamilyTotals } from '../src/data/balanceDiagnostics.ts';
import { loadPkg } from './solverTestUtils.mjs';

function readText(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return readFileSync(url, 'utf8');
}

function parseNum(raw) {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const OVERLAYS = '../../sector_trajectory_library/overlays';
const VALIDATION = '../../sector_trajectory_library/validation';

const overlayRows = parseCsv(readText(`${OVERLAYS}/residual_overlays.csv`));
const commodityBalanceRows = parseCsv(readText(`${VALIDATION}/baseline_commodity_balance.csv`));
const emissionsBalanceRows = parseCsv(readText(`${VALIDATION}/baseline_emissions_balance.csv`));
const pkg = loadPkg();
const residualFamilyRows = pkg.sectorStates.filter(
  (row) => row.family_resolution === 'residual_stub' && row.year === 2025,
);
const residualFamilyIds = new Set(residualFamilyRows.map((row) => row.family_id));
const totals = summarizeResidualFamilyTotals(pkg.sectorStates);

function listFamilyDirectories() {
  const root = new URL('../../sector_trajectory_library/families', import.meta.url);
  return readdirSync(root).filter((entry) => {
    try {
      readFileSync(join(root.pathname, entry, 'family_states.csv'), 'utf8');
      return true;
    } catch {
      return false;
    }
  });
}

describe('Residual family migration', () => {
  it('residual_overlays.csv is retained as a header-only compatibility table', () => {
    assert.equal(overlayRows.length, 0);
  });

  it('loads 14 residual stub families with one 2025 incumbent row each', () => {
    assert.equal(residualFamilyIds.size, 14);
    assert.equal(residualFamilyRows.length, 14);
    for (const row of residualFamilyRows) {
      assert.equal(row.state_label, 'Residual incumbent');
    }
  });

  it('every residual family directory has demand, validation, and documentation companions', () => {
    const familyDirs = new Set(listFamilyDirectories());
    for (const familyId of residualFamilyIds) {
      assert.ok(familyDirs.has(familyId), `missing residual family directory ${familyId}`);
      for (const filename of ['demand.csv', 'family_states.csv', 'README.md', 'validation.md']) {
        const path = new URL(`../../sector_trajectory_library/families/${familyId}/${filename}`, import.meta.url);
        assert.ok(readFileSync(path, 'utf8').length > 0, `${familyId}/${filename} should not be empty`);
      }
    }
  });
});

describe('Residual family aggregation totals', () => {
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

  it('total residual non-energy emissions excluding LULUCF are about 86.735 MtCO2e', () => {
    assert.ok(
      Math.abs(totals.totalResidualNonEnergyEmissions - 86.735) < 0.001,
      `Expected about 86.735, got ${totals.totalResidualNonEnergyEmissions}`,
    );
  });

  it('LULUCF sink remains optional at -73.7 MtCO2e', () => {
    assert.equal(totals.lulucfSinkMtco2e, -73.7);
  });

  it('total positive carbon-billable residual emissions are about 143.904 MtCO2e', () => {
    assert.ok(
      Math.abs(totals.totalCarbonBillableEmissionsMtco2e - 143.904) < 0.001,
      `Expected about 143.904, got ${totals.totalCarbonBillableEmissionsMtco2e}`,
    );
  });
});

describe('Diagnostic table cross-checks', () => {
  it('baseline_commodity_balance total row difference_to_benchmark_pj_2025 is 0', () => {
    const totalRow = commodityBalanceRows.find((r) => r['commodity'] === 'total');
    assert.ok(totalRow, 'Expected a "total" row in baseline_commodity_balance.csv');
    const diff = parseNum(totalRow['difference_to_benchmark_pj_2025']);
    assert.equal(diff, 0.0, `Expected difference 0, got ${diff}`);
  });

  it('baseline_emissions_balance positive-sectors row difference is about 0', () => {
    const positiveRow = emissionsBalanceRows.find((r) =>
      r['official_category']?.startsWith('Positive-emitting'),
    );
    assert.ok(positiveRow, 'Expected a positive-emitting sectors total row');
    const diff = parseNum(positiveRow['difference_to_official_mtco2e_2025']);
    assert.ok(
      diff !== null && Math.abs(diff) < 0.01,
      `Expected difference about 0, got ${diff}`,
    );
  });
});
