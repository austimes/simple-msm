/**
 * Overlay parsing and balance diagnostics tests.
 *
 * Verifies that overlay CSV files parse correctly, that default-include
 * filtering works, and that aggregation totals match expected 2025 values.
 *
 * Run:  bunx tsx --test test/balanceDiagnostics.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../src/data/parseCsv.ts';
import {
  getDefaultIncludedResidualOverlays,
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

function parseEmptyNull(raw) {
  if (!raw || raw.trim() === '') return null;
  return raw;
}

// --- Load CSVs ---

const OVERLAYS = '../../sector_trajectory_library/overlays';
const VALIDATION = '../../sector_trajectory_library/validation';

const overlayRows = parseCsv(readText(`${OVERLAYS}/residual_overlays.csv`));
const commodityBalanceRows = parseCsv(readText(`${VALIDATION}/baseline_commodity_balance.csv`));
const emissionsBalanceRows = parseCsv(readText(`${VALIDATION}/baseline_emissions_balance.csv`));

// --- Typed rows for diagnostics module ---

const typedOverlays = overlayRows.map((r) => ({
  overlay_id: r['overlay_id'],
  overlay_label: r['overlay_label'],
  overlay_domain: r['overlay_domain'],
  official_accounting_bucket: r['official_accounting_bucket'],
  year: Number(r['year']),
  commodity: parseEmptyNull(r['commodity']),
  final_energy_pj_2025: parseNum(r['final_energy_pj_2025']),
  native_unit: r['native_unit'] ?? '',
  native_quantity_2025: parseNum(r['native_quantity_2025']),
  direct_energy_emissions_mtco2e_2025: parseNum(r['direct_energy_emissions_mtco2e_2025']),
  other_emissions_mtco2e_2025: parseNum(r['other_emissions_mtco2e_2025']),
  carbon_billable_emissions_mtco2e_2025: parseNum(r['carbon_billable_emissions_mtco2e_2025']),
  default_price_basis: r['default_price_basis'] ?? '',
  default_price_per_native_unit_aud_2024: parseNum(r['default_price_per_native_unit_aud_2024']),
  default_commodity_cost_audm_2024: parseNum(r['default_commodity_cost_audm_2024']),
  default_fixed_noncommodity_cost_audm_2024: parseNum(r['default_fixed_noncommodity_cost_audm_2024']),
  default_total_cost_ex_carbon_audm_2024: parseNum(r['default_total_cost_ex_carbon_audm_2024']),
  default_include: parseBool(r['default_include']),
  allocation_method: r['allocation_method'] ?? '',
  cost_basis_note: r['cost_basis_note'] ?? '',
  notes: r['notes'] ?? '',
}));

// =============================================================================
// 1. Overlay parsing tests
// =============================================================================

describe('Overlay parsing', () => {
  it('residual_overlays.csv loads 39 data rows', () => {
    assert.equal(overlayRows.length, 39);
  });

  it('34 rows are energy_residual domain', () => {
    const energy = typedOverlays.filter((r) => r.overlay_domain === 'energy_residual');
    assert.equal(energy.length, 34);
  });

  it('4 rows are nonenergy_residual domain', () => {
    const nonEnergy = typedOverlays.filter((r) => r.overlay_domain === 'nonenergy_residual');
    assert.equal(nonEnergy.length, 4);
  });

  it('1 row is net_sink domain', () => {
    const sink = typedOverlays.filter((r) => r.overlay_domain === 'net_sink');
    assert.equal(sink.length, 1);
  });

  it('baseline_commodity_balance.csv loads 7 data rows', () => {
    assert.equal(commodityBalanceRows.length, 7);
  });

  it('baseline_emissions_balance.csv loads 10 data rows', () => {
    assert.equal(emissionsBalanceRows.length, 10);
  });
});

// =============================================================================
// 2. Default-include filtering tests
// =============================================================================

describe('Default-include filtering', () => {
  it('38 overlay rows have default_include=True (34 energy + 4 non-energy)', () => {
    const included = getDefaultIncludedResidualOverlays(typedOverlays);
    assert.equal(included.length, 38);
  });

  it('LULUCF sink row is excluded by default', () => {
    const included = getDefaultIncludedResidualOverlays(typedOverlays);
    const hasSink = included.some((r) => r.overlay_id === 'residual_lulucf_sink');
    assert.equal(hasSink, false);
  });
});

// =============================================================================
// 3. Aggregation tests
// =============================================================================

describe('Aggregation totals', () => {
  const totals = summarizeOverlayTotals(typedOverlays);

  it('total residual energy PJ ≈ 1354.152', () => {
    assert.ok(
      Math.abs(totals.totalResidualEnergyPj - 1354.152) < 0.5,
      `Expected ≈1354.152, got ${totals.totalResidualEnergyPj}`,
    );
  });

  it('total residual energy emissions ≈ 57.169 MtCO2e', () => {
    assert.ok(
      Math.abs(totals.totalResidualEnergyEmissions - 57.169) < 0.5,
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

  it('total carbon-billable emissions ≈ 143.904 MtCO2e', () => {
    assert.ok(
      Math.abs(totals.totalCarbonBillableEmissionsMtco2e - 143.904) < 0.01,
      `Expected ≈143.904, got ${totals.totalCarbonBillableEmissionsMtco2e}`,
    );
  });

  it('total overlay commodity cost ≈ 40820.1 AUD M 2024', () => {
    assert.ok(
      Math.abs(totals.totalOverlayCommodityCostAudm2024 - 40820.1) < 1.0,
      `Expected ≈40820.1, got ${totals.totalOverlayCommodityCostAudm2024}`,
    );
  });

  it('total overlay fixed cost = 0 AUD M 2024', () => {
    assert.equal(totals.totalOverlayFixedCostAudm2024, 0);
  });
});

// =============================================================================
// 4. Cross-check with diagnostic tables
// =============================================================================

describe('Diagnostic table cross-checks', () => {
  it('baseline_commodity_balance total row difference_to_benchmark_pj_2025 is 0', () => {
    const totalRow = commodityBalanceRows.find((r) => r['commodity'] === 'total');
    assert.ok(totalRow, 'Expected a "total" row in baseline_commodity_balance.csv');
    const diff = parseNum(totalRow['difference_to_benchmark_pj_2025']);
    assert.equal(diff, 0.0, `Expected difference 0, got ${diff}`);
  });

  it('baseline_emissions_balance positive-sectors row difference ≈ 0', () => {
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
