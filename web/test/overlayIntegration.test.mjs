/**
 * Overlay projection and result contribution pipeline tests.
 *
 * Uses synthetic inline fixtures so tests are deterministic and
 * independent of the real CSV data.
 *
 * Run:  bunx tsx --test test/overlayIntegration.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OVERLAY_GROWTH_PROXY,
  resolveOverlayGrowthRates,
  projectOverlayRows,
} from '../src/data/overlayProjection.ts';
import { buildOverlayContributionRows } from '../src/results/resultContributions.ts';

// ---------------------------------------------------------------------------
// Helpers – minimal ResidualOverlayRow factory
// ---------------------------------------------------------------------------

function makeOverlayRow(overrides = {}) {
  return {
    overlay_id: 'test_overlay',
    overlay_label: 'Test Overlay',
    overlay_domain: 'energy_residual',
    official_accounting_bucket: 'bucket',
    year: 2025,
    commodity: 'electricity',
    final_energy_pj_2025: 10,
    native_unit: 'PJ',
    native_quantity_2025: 10,
    direct_energy_emissions_mtco2e_2025: 1.0,
    other_emissions_mtco2e_2025: 0.5,
    carbon_billable_emissions_mtco2e_2025: 1.5,
    default_price_basis: 'market',
    default_price_per_native_unit_aud_2024: null,
    default_commodity_cost_audm_2024: 100,
    default_fixed_noncommodity_cost_audm_2024: 20,
    default_total_cost_ex_carbon_audm_2024: 120,
    default_include: true,
    allocation_method: '',
    cost_basis_note: '',
    notes: '',
    ...overrides,
  };
}

// =============================================================================
// 1. Growth projection tests
// =============================================================================

describe('resolveOverlayGrowthRates', () => {
  const serviceRates = {
    residential_building_services: 2.0,
    passenger_road_transport: 1.0,
    freight_road_transport: 3.0,
    low_temperature_heat: 0.5,
    medium_temperature_heat: 1.5,
    high_temperature_heat: 2.5,
    crude_steel: 1.0,
    cement_equivalent: 0.5,
  };

  it('returns correct rate for mapped overlay (residential_other → residential_building_services)', () => {
    const rates = resolveOverlayGrowthRates(['residential_other'], serviceRates);
    assert.equal(rates['residential_other'], 2.0);
  });

  it('averages multiple proxy rates (transport_other → passenger + freight)', () => {
    const rates = resolveOverlayGrowthRates(['transport_other'], serviceRates);
    assert.equal(rates['transport_other'], 2.0); // (1.0 + 3.0) / 2
  });

  it('falls back to preset average for unmapped overlays (empty proxy list)', () => {
    const rates = resolveOverlayGrowthRates(['mining_other'], serviceRates);
    const allRates = Object.values(serviceRates);
    const expectedAvg = allRates.reduce((s, r) => s + r, 0) / allRates.length;
    assert.equal(rates['mining_other'], expectedAvg);
  });

  it('LULUCF defaults to 0%', () => {
    const rates = resolveOverlayGrowthRates(['residual_lulucf_sink'], serviceRates);
    assert.equal(rates['residual_lulucf_sink'], 0);
  });

  it('falls back to preset average when proxy ids have no match in serviceRates', () => {
    const sparseRates = { some_unrelated_service: 5.0 };
    const rates = resolveOverlayGrowthRates(['residential_other'], sparseRates);
    assert.equal(rates['residential_other'], 5.0); // only rate → avg = 5.0
  });
});

describe('projectOverlayRows', () => {
  const row = makeOverlayRow({
    overlay_id: 'residential_other',
    final_energy_pj_2025: 100,
    direct_energy_emissions_mtco2e_2025: 2.0,
    other_emissions_mtco2e_2025: 0.0,
    carbon_billable_emissions_mtco2e_2025: 2.0,
    default_commodity_cost_audm_2024: 500,
    default_fixed_noncommodity_cost_audm_2024: 50,
    default_total_cost_ex_carbon_audm_2024: 550,
  });

  const years = [2025, 2030];
  const growthRates = { residential_other: 1.0 }; // 1% per year

  it('produces correct row count (inputRows × years)', () => {
    const projected = projectOverlayRows([row], years, growthRates);
    assert.equal(projected.length, 2); // 1 row × 2 years
  });

  it('2025 projected values match source anchors exactly', () => {
    const projected = projectOverlayRows([row], [2025], growthRates);
    const p = projected[0];
    assert.equal(p.finalEnergyPj, 100);
    assert.equal(p.directEnergyEmissionsMtco2e, 2.0);
    assert.equal(p.otherEmissionsMtco2e, 0.0);
    assert.equal(p.carbonBillableEmissionsMtco2e, 2.0);
    assert.equal(p.commodityCostAudm2024, 500);
    assert.equal(p.fixedNonCommodityCostAudm2024, 50);
    assert.equal(p.totalCostExCarbonAudm2024, 550);
  });

  it('future year values compound correctly (2030 with 1% growth = anchor × 1.01^5)', () => {
    const projected = projectOverlayRows([row], [2030], growthRates);
    const p = projected[0];
    const factor = 1.01 ** 5;
    assert.ok(
      Math.abs(p.finalEnergyPj - 100 * factor) < 1e-10,
      `Expected ${100 * factor}, got ${p.finalEnergyPj}`,
    );
    assert.ok(
      Math.abs(p.directEnergyEmissionsMtco2e - 2.0 * factor) < 1e-10,
      `Expected ${2.0 * factor}, got ${p.directEnergyEmissionsMtco2e}`,
    );
    assert.ok(
      Math.abs(p.commodityCostAudm2024 - 500 * factor) < 1e-10,
      `Expected ${500 * factor}, got ${p.commodityCostAudm2024}`,
    );
  });

  it('all commodity rows within an overlay_id use the same growth factor', () => {
    const rowA = makeOverlayRow({
      overlay_id: 'residential_other',
      commodity: 'electricity',
      final_energy_pj_2025: 50,
    });
    const rowB = makeOverlayRow({
      overlay_id: 'residential_other',
      commodity: 'gas',
      final_energy_pj_2025: 30,
    });
    const projected = projectOverlayRows([rowA, rowB], [2030], growthRates);
    const factor = 1.01 ** 5;
    assert.ok(
      Math.abs(projected[0].finalEnergyPj - 50 * factor) < 1e-10,
    );
    assert.ok(
      Math.abs(projected[1].finalEnergyPj - 30 * factor) < 1e-10,
    );
  });

  it('null values remain null after projection', () => {
    const nullRow = makeOverlayRow({
      overlay_id: 'residential_other',
      final_energy_pj_2025: null,
      native_quantity_2025: null,
    });
    const projected = projectOverlayRows([nullRow], [2030], growthRates);
    assert.equal(projected[0].finalEnergyPj, null);
    assert.equal(projected[0].nativeQuantity, null);
  });
});

// =============================================================================
// 2. Contribution pipeline tests
// =============================================================================

describe('buildOverlayContributionRows', () => {
  const carbonPriceByYear = { '2025': 50, '2030': 75 };

  describe('energy_residual domain', () => {
    it('emits emissions + fuel + cost rows', () => {
      const projectedRow = {
        overlayId: 'residential_other',
        overlayLabel: 'Residential Other',
        overlayDomain: 'energy_residual',
        officialAccountingBucket: 'bucket',
        year: 2025,
        commodity: 'electricity',
        finalEnergyPj: 10,
        nativeQuantity: 10,
        directEnergyEmissionsMtco2e: 1.0,
        otherEmissionsMtco2e: 0.5,
        carbonBillableEmissionsMtco2e: 1.5,
        commodityCostAudm2024: 100,
        fixedNonCommodityCostAudm2024: 20,
        totalCostExCarbonAudm2024: 120,
      };

      const rows = buildOverlayContributionRows([projectedRow], carbonPriceByYear);
      const metrics = rows.map((r) => r.metric);
      assert.ok(metrics.includes('emissions'), 'should have emissions');
      assert.ok(metrics.includes('fuel'), 'should have fuel');
      assert.ok(metrics.includes('cost'), 'should have cost');
    });
  });

  describe('nonenergy_residual domain', () => {
    it('emits emissions + cost rows (carbon only, no fuel)', () => {
      const projectedRow = {
        overlayId: 'residual_agriculture_other',
        overlayLabel: 'Agriculture Other',
        overlayDomain: 'nonenergy_residual',
        officialAccountingBucket: 'bucket',
        year: 2025,
        commodity: null,
        finalEnergyPj: null,
        nativeQuantity: null,
        directEnergyEmissionsMtco2e: 0,
        otherEmissionsMtco2e: 20.0,
        carbonBillableEmissionsMtco2e: 20.0,
        commodityCostAudm2024: 0,
        fixedNonCommodityCostAudm2024: 0,
        totalCostExCarbonAudm2024: 0,
      };

      const rows = buildOverlayContributionRows([projectedRow], carbonPriceByYear);
      const metrics = rows.map((r) => r.metric);
      assert.ok(metrics.includes('emissions'), 'should have emissions');
      assert.ok(!metrics.includes('fuel'), 'should NOT have fuel');
      assert.ok(metrics.includes('cost'), 'should have cost (carbon)');
      const costRows = rows.filter((r) => r.metric === 'cost');
      assert.ok(
        costRows.every((r) => r.costComponent === 'carbon'),
        'cost rows should be carbon only',
      );
    });
  });

  describe('net_sink domain', () => {
    it('emits emissions + cost rows with negative values', () => {
      const projectedRow = {
        overlayId: 'residual_lulucf_sink',
        overlayLabel: 'LULUCF Sink',
        overlayDomain: 'net_sink',
        officialAccountingBucket: 'bucket',
        year: 2025,
        commodity: null,
        finalEnergyPj: null,
        nativeQuantity: null,
        directEnergyEmissionsMtco2e: 0,
        otherEmissionsMtco2e: -73.7,
        carbonBillableEmissionsMtco2e: -73.7,
        commodityCostAudm2024: 0,
        fixedNonCommodityCostAudm2024: 0,
        totalCostExCarbonAudm2024: 0,
      };

      const rows = buildOverlayContributionRows([projectedRow], carbonPriceByYear);
      const emissionsRow = rows.find((r) => r.metric === 'emissions');
      assert.ok(emissionsRow, 'should have emissions row');
      assert.ok(emissionsRow.value < 0, 'emissions value should be negative');

      const costRow = rows.find((r) => r.metric === 'cost');
      assert.ok(costRow, 'should have cost row');
      assert.ok(costRow.value < 0, 'carbon cost should be negative for net sink');
      assert.equal(costRow.costComponent, 'carbon');
    });
  });

  describe('unit conversions', () => {
    it('emissions: MtCO2e × 1_000_000 = tCO2e', () => {
      const projectedRow = {
        overlayId: 'test',
        overlayLabel: 'Test',
        overlayDomain: 'energy_residual',
        officialAccountingBucket: 'bucket',
        year: 2025,
        commodity: null,
        finalEnergyPj: null,
        nativeQuantity: null,
        directEnergyEmissionsMtco2e: 2.5,
        otherEmissionsMtco2e: 0.5,
        carbonBillableEmissionsMtco2e: 3.0,
        commodityCostAudm2024: 0,
        fixedNonCommodityCostAudm2024: 0,
        totalCostExCarbonAudm2024: 0,
      };

      const rows = buildOverlayContributionRows([projectedRow], carbonPriceByYear);
      const emissionsRow = rows.find((r) => r.metric === 'emissions');
      assert.equal(emissionsRow.value, 3_000_000); // (2.5 + 0.5) * 1_000_000
    });

    it('carbon cost: billableMtco2e × carbonPrice = AUDm', () => {
      const projectedRow = {
        overlayId: 'test',
        overlayLabel: 'Test',
        overlayDomain: 'energy_residual',
        officialAccountingBucket: 'bucket',
        year: 2025,
        commodity: null,
        finalEnergyPj: null,
        nativeQuantity: null,
        directEnergyEmissionsMtco2e: 0,
        otherEmissionsMtco2e: 0,
        carbonBillableEmissionsMtco2e: 2.0,
        commodityCostAudm2024: 0,
        fixedNonCommodityCostAudm2024: 0,
        totalCostExCarbonAudm2024: 0,
      };

      const rows = buildOverlayContributionRows([projectedRow], carbonPriceByYear);
      const carbonCost = rows.find((r) => r.metric === 'cost' && r.costComponent === 'carbon');
      assert.ok(carbonCost, 'should have carbon cost row');
      assert.equal(carbonCost.value, 2.0 * 50); // billableMt * carbonPrice
    });
  });

  describe('excluded overlays', () => {
    it('overlay with all zero/null values produces no contribution rows', () => {
      const projectedRow = {
        overlayId: 'excluded',
        overlayLabel: 'Excluded',
        overlayDomain: 'energy_residual',
        officialAccountingBucket: 'bucket',
        year: 2025,
        commodity: null,
        finalEnergyPj: null,
        nativeQuantity: null,
        directEnergyEmissionsMtco2e: 0,
        otherEmissionsMtco2e: 0,
        carbonBillableEmissionsMtco2e: 0,
        commodityCostAudm2024: 0,
        fixedNonCommodityCostAudm2024: 0,
        totalCostExCarbonAudm2024: 0,
      };

      const rows = buildOverlayContributionRows([projectedRow], carbonPriceByYear);
      assert.equal(rows.length, 0);
    });
  });

  describe('sectorId and sectorLabel', () => {
    it('overlay rows have sectorId = overlay_id and sectorLabel = overlay_label', () => {
      const projectedRow = {
        overlayId: 'my_overlay',
        overlayLabel: 'My Overlay Label',
        overlayDomain: 'energy_residual',
        officialAccountingBucket: 'bucket',
        year: 2025,
        commodity: 'gas',
        finalEnergyPj: 5,
        nativeQuantity: 5,
        directEnergyEmissionsMtco2e: 1.0,
        otherEmissionsMtco2e: 0,
        carbonBillableEmissionsMtco2e: 1.0,
        commodityCostAudm2024: 50,
        fixedNonCommodityCostAudm2024: 10,
        totalCostExCarbonAudm2024: 60,
      };

      const rows = buildOverlayContributionRows([projectedRow], carbonPriceByYear);
      for (const r of rows) {
        assert.equal(r.sectorId, 'my_overlay');
        assert.equal(r.sectorLabel, 'My Overlay Label');
      }
    });
  });
});
