/**
 * Package anchor parity and regression tests.
 *
 * Verifies that CSV-derived anchors from service_demand_anchors_2025.csv
 * match the hardcoded values in baseline_activity_anchors.json, and that
 * demand resolution produces correct 2025 values when using the merged anchors.
 *
 * Run:  npx tsx --test test/packageAnchorParity.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../src/data/parseCsv.ts';
import { deriveBaselineAnchorsFromPackage } from '../src/data/packageAnchorMapping.ts';
import { resolveConfigurationDocument } from '../src/data/demandResolution.ts';

// --- Data loading ---

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

function readText(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return readFileSync(url, 'utf8');
}

function parseNum(raw) {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function toServiceDemandAnchorRow(row) {
  return {
    anchor_type: row['anchor_type'],
    service_or_output_name: row['service_or_output_name'],
    default_2025_state_id: row['default_2025_state_id'],
    default_2025_state_option_code: row['default_2025_state_option_code'],
    default_2025_state_option_label: row['default_2025_state_option_label'],
    quantity_2025: parseNum(row['quantity_2025']),
    unit: row['unit'],
    anchor_status: row['anchor_status'],
    source_family: row['source_family'],
    coverage_note: row['coverage_note'],
    implied_gross_input_energy_pj_if_default: parseNum(row['implied_gross_input_energy_pj_if_default']),
    implied_benchmark_final_energy_pj_if_default: parseNum(row['implied_benchmark_final_energy_pj_if_default']),
    implied_energy_emissions_mtco2e_if_default: parseNum(row['implied_energy_emissions_mtco2e_if_default']),
    implied_process_emissions_mtco2e_if_default: parseNum(row['implied_process_emissions_mtco2e_if_default']),
    implied_total_emissions_mtco2e_if_default: parseNum(row['implied_total_emissions_mtco2e_if_default']),
  };
}

function loadAppConfig() {
  return {
    output_roles: readJson('../public/app_config/output_roles.json'),
    baseline_activity_anchors: readJson('../public/app_config/baseline_activity_anchors.json'),
    demand_growth_presets: readJson('../public/app_config/demand_growth_presets.json'),
    commodity_price_presets: readJson('../public/app_config/commodity_price_presets.json'),
    explanation_tag_rules: readJson('../public/app_config/explanation_tag_rules.json'),
  };
}

const jsonAnchors = readJson('../public/app_config/baseline_activity_anchors.json');
const outputRoles = readJson('../public/app_config/output_roles.json');
const anchorCsvText = readText('../../sector_trajectory_library/exports/legacy/service_demand_anchors_2025.csv');
const anchorRows = parseCsv(anchorCsvText).map(toServiceDemandAnchorRow);
const csvAnchors = deriveBaselineAnchorsFromPackage(anchorRows, outputRoles);

// --- Expected parity values from the issue spec ---

const EXPECTED_PARITY = {
  residential_building_services: 477000000,
  commercial_building_services: 314000000,
  passenger_road_transport: 293414730000,
  freight_road_transport: 249000000000,
  low_temperature_heat: 120000000,
  medium_temperature_heat: 140000000,
  high_temperature_heat: 170000000,
  crude_steel: 5700000,
  cement_equivalent: 9600000,
  livestock_output_bundle: 31134.94,
  cropping_horticulture_output_bundle: 36576.29,
};

const EXPECTED_ELECTRICITY = {
  key: 'electricity',
  // CSV has the precise derived value; JSON has a rounded app-owned default.
  // After the CSV-over-JSON merge, the CSV value wins.
  csvValue: 144018720.570146,
  jsonValue: 144018720,
};

// ---------------------------------------------------------------------------
// 1. Parity tests — CSV-derived anchors match JSON values
// ---------------------------------------------------------------------------

test('CSV-derived service demand anchors match JSON values exactly', () => {
  for (const [outputId, expectedValue] of Object.entries(EXPECTED_PARITY)) {
    const csvAnchor = csvAnchors[outputId];
    const jsonAnchor = jsonAnchors[outputId];

    assert.ok(csvAnchor, `CSV anchor missing for ${outputId}`);
    assert.ok(jsonAnchor, `JSON anchor missing for ${outputId}`);

    assert.equal(
      csvAnchor.value, expectedValue,
      `${outputId}: CSV value ${csvAnchor.value} !== expected ${expectedValue}`,
    );
    assert.equal(
      jsonAnchor.value, expectedValue,
      `${outputId}: JSON value ${jsonAnchor.value} !== expected ${expectedValue}`,
    );
    assert.equal(
      csvAnchor.value, jsonAnchor.value,
      `${outputId}: CSV value ${csvAnchor.value} !== JSON value ${jsonAnchor.value}`,
    );
  }
});

test('CSV-derived electricity anchor matches expected CSV value', () => {
  const csvElectricity = csvAnchors[EXPECTED_ELECTRICITY.key];
  const jsonElectricity = jsonAnchors[EXPECTED_ELECTRICITY.key];

  assert.ok(csvElectricity, 'CSV electricity anchor missing');
  assert.ok(jsonElectricity, 'JSON electricity anchor missing');

  assert.equal(csvElectricity.value, EXPECTED_ELECTRICITY.csvValue);
  assert.equal(jsonElectricity.value, EXPECTED_ELECTRICITY.jsonValue);
});

test('CSV-derived anchors preserve output_role from output_roles registry', () => {
  for (const [outputId] of Object.entries(EXPECTED_PARITY)) {
    assert.equal(
      csvAnchors[outputId].output_role,
      outputRoles[outputId].output_role,
      `${outputId}: output_role mismatch`,
    );
  }

  assert.equal(csvAnchors.electricity.output_role, 'endogenous_supply_commodity');
});

test('CSV-derived anchors preserve anchor_kind correctly', () => {
  for (const [outputId] of Object.entries(EXPECTED_PARITY)) {
    assert.equal(csvAnchors[outputId].anchor_kind, 'service_demand', `${outputId} should be service_demand`);
  }

  assert.equal(csvAnchors.electricity.anchor_kind, 'external_commodity_demand');
});

test('CSV-derived anchors preserve unit from CSV', () => {
  for (const [outputId] of Object.entries(EXPECTED_PARITY)) {
    assert.equal(
      csvAnchors[outputId].unit,
      jsonAnchors[outputId].unit,
      `${outputId}: unit mismatch between CSV and JSON`,
    );
  }

  assert.equal(csvAnchors.electricity.unit, jsonAnchors.electricity.unit);
});

test('informational CSV rows are not mapped to anchors', () => {
  // derived_explicit_electricity_load and electricity_output_benchmark are informational
  assert.equal(csvAnchors['electricity_explicit_load'], undefined, 'derived_explicit_electricity_load should not produce an anchor');
  assert.equal(csvAnchors['electricity_total_output_benchmark'], undefined, 'electricity_output_benchmark should not produce an anchor');
});

test('CSV anchor count matches expected (11 services + 1 electricity)', () => {
  const csvKeys = Object.keys(csvAnchors);
  assert.equal(csvKeys.length, 12, `expected 12 CSV-derived anchors, got ${csvKeys.length}: ${csvKeys.join(', ')}`);
});

test('JSON-only anchors (land_sequestration, engineered_removals) are preserved after merge', () => {
  // Simulate the merge logic from packageLoader.ts
  const merged = { ...jsonAnchors, ...csvAnchors };

  assert.ok(merged.land_sequestration, 'land_sequestration should be preserved from JSON');
  assert.equal(merged.land_sequestration.value, 0);
  assert.equal(merged.land_sequestration.anchor_kind, 'service_demand');

  assert.ok(merged.engineered_removals, 'engineered_removals should be preserved from JSON');
  assert.equal(merged.engineered_removals.value, 0);
  assert.equal(merged.engineered_removals.anchor_kind, 'service_demand');
});

// ---------------------------------------------------------------------------
// 2. Demand resolution test — 2025 service demands match anchor values
// ---------------------------------------------------------------------------

test('demand resolution produces correct 2025 service demands from CSV-derived anchors', () => {
  const appConfig = loadAppConfig();

  // Merge CSV-derived anchors over JSON (same as packageLoader.ts)
  appConfig.baseline_activity_anchors = {
    ...appConfig.baseline_activity_anchors,
    ...csvAnchors,
  };

  const referenceConfiguration = readJson('../public/app_config/reference_configuration.json');
  const resolved = resolveConfigurationDocument(referenceConfiguration, appConfig, 'parity test');

  // 2025 service demands should match anchor values exactly
  for (const [outputId, expectedValue] of Object.entries(EXPECTED_PARITY)) {
    const demand2025 = resolved.service_demands[outputId]?.['2025'];
    assert.equal(
      demand2025, expectedValue,
      `${outputId}: resolved 2025 demand ${demand2025} !== expected ${expectedValue}`,
    );
  }

  // Electricity: the reference config's explicit external_commodity_anchors (144018720)
  // takes precedence over the baseline anchor during demand resolution, so the resolved
  // 2025 value matches the config's stored anchor, not the raw CSV value.
  const electricityDemand2025 = resolved.external_commodity_demands?.electricity?.['2025'];
  assert.equal(
    electricityDemand2025, EXPECTED_ELECTRICITY.jsonValue,
    `electricity: resolved 2025 external demand ${electricityDemand2025} !== expected ${EXPECTED_ELECTRICITY.jsonValue}`,
  );
});
