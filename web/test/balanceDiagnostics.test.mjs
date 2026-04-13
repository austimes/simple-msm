/**
 * Overlay parsing and balance diagnostics tests.
 *
 * Verifies that overlay CSV files parse correctly, that default-include
 * filtering works, and that aggregation totals match expected 2025 values.
 *
 * Run:  npx tsx --test test/balanceDiagnostics.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../src/data/parseCsv.ts';
import {
  getDefaultIncludedEnergyOverlays,
  getDefaultIncludedNonEnergyOverlays,
  summarizeOverlayTotals,
} from '../src/data/balanceDiagnostics.ts';

// --- Helpers ---

function readText(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return readFileSync(url, 'utf8');
}

function parseNum(raw) {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseBool(raw) {
  return raw?.trim().toLowerCase() === 'true';
}

// --- Load CSVs ---

const DATA = '../../aus_phase1_sector_state_library/data';

const energyOverlayRows = parseCsv(readText(`${DATA}/residual_energy_overlay_sectors_2025.csv`));
const nonEnergyOverlayRows = parseCsv(readText(`${DATA}/residual_nonenergy_emissions_overlays_2025.csv`));
const commodityBalanceRows = parseCsv(readText(`${DATA}/commodity_balance_2025.csv`));
const emissionsBalanceRows = parseCsv(readText(`${DATA}/emissions_balance_2025.csv`));

// --- Typed rows for diagnostics module ---

const typedEnergyOverlays = energyOverlayRows.map((r) => ({
  overlay_sector_id: r['overlay_sector_id'],
  overlay_sector_label: r['overlay_sector_label'],
  official_broad_sector: r['official_broad_sector'],
  year: Number(r['year']),
  total_final_energy_pj_2025: Number(r['total_final_energy_pj_2025']),
  direct_energy_emissions_mtco2e_2025: Number(r['direct_energy_emissions_mtco2e_2025']),
  emissions_allocation_method: r['emissions_allocation_method'],
  default_include: parseBool(r['default_include']),
  notes: r['notes'],
}));

const typedNonEnergyOverlays = nonEnergyOverlayRows.map((r) => ({
  overlay_id: r['overlay_id'],
  overlay_label: r['overlay_label'],
  official_category: r['official_category'],
  year: Number(r['year']),
  emissions_mtco2e_2025: Number(r['emissions_mtco2e_2025']),
  default_include: parseBool(r['default_include']),
  notes: r['notes'],
}));

// =============================================================================
// 1. Overlay parsing tests
// =============================================================================

describe('Overlay parsing', () => {
  it('residual_energy_overlay_sectors_2025.csv loads 8 data rows', () => {
    assert.equal(energyOverlayRows.length, 8);
  });

  it('residual_nonenergy_emissions_overlays_2025.csv loads 5 data rows', () => {
    assert.equal(nonEnergyOverlayRows.length, 5);
  });

  it('commodity_balance_2025.csv loads 7 data rows', () => {
    assert.equal(commodityBalanceRows.length, 7);
  });

  it('emissions_balance_2025.csv loads 10 data rows', () => {
    assert.equal(emissionsBalanceRows.length, 10);
  });
});

// =============================================================================
// 2. Default-include filtering tests
// =============================================================================

describe('Default-include filtering', () => {
  it('all 8 energy overlay rows have default_include=True', () => {
    const included = getDefaultIncludedEnergyOverlays(typedEnergyOverlays);
    assert.equal(included.length, 8);
  });

  it('4 non-energy overlay rows have default_include=True (LULUCF excluded)', () => {
    const included = getDefaultIncludedNonEnergyOverlays(typedNonEnergyOverlays);
    assert.equal(included.length, 4);
  });
});

// =============================================================================
// 3. Aggregation tests
// =============================================================================

describe('Aggregation totals', () => {
  const totals = summarizeOverlayTotals(typedEnergyOverlays, typedNonEnergyOverlays);

  it('total residual energy PJ ≈ 1354.152', () => {
    assert.ok(
      Math.abs(totals.totalResidualEnergyPj - 1354.152) < 0.01,
      `Expected ≈1354.152, got ${totals.totalResidualEnergyPj}`,
    );
  });

  it('total residual energy emissions ≈ 57.169 MtCO2e', () => {
    assert.ok(
      Math.abs(totals.totalResidualEnergyEmissions - 57.169) < 0.01,
      `Expected ≈57.169, got ${totals.totalResidualEnergyEmissions}`,
    );
  });

  it('total residual non-energy emissions (excl LULUCF) ≈ 86.735 MtCO2e', () => {
    assert.ok(
      Math.abs(totals.totalResidualNonEnergyEmissions - 86.735) < 0.01,
      `Expected ≈86.735, got ${totals.totalResidualNonEnergyEmissions}`,
    );
  });

  it('LULUCF sink = -73.7 MtCO2e', () => {
    assert.equal(totals.lulucfSinkMtco2e, -73.7);
  });
});

// =============================================================================
// 4. Cross-check with diagnostic tables
// =============================================================================

describe('Diagnostic table cross-checks', () => {
  it('commodity_balance_2025 total row difference_to_benchmark_pj_2025 is 0', () => {
    const totalRow = commodityBalanceRows.find((r) => r['commodity'] === 'total');
    assert.ok(totalRow, 'Expected a "total" row in commodity_balance_2025.csv');
    const diff = parseNum(totalRow['difference_to_benchmark_pj_2025']);
    assert.equal(diff, 0.0, `Expected difference 0, got ${diff}`);
  });

  it('emissions_balance_2025 positive-sectors row difference ≈ 0', () => {
    const positiveRow = emissionsBalanceRows.find((r) =>
      r['official_category']?.startsWith('Positive-emitting'),
    );
    assert.ok(positiveRow, 'Expected a positive-emitting sectors total row');
    const diff = parseNum(positiveRow['difference_to_official_mtco2e_2025']);
    assert.ok(
      diff !== null && Math.abs(diff) < 0.01,
      `Expected difference ≈ 0, got ${diff}`,
    );
  });
});
