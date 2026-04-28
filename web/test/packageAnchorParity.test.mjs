/**
 * Package anchor parity and regression tests.
 *
 * Verifies that role-demand anchors loaded from the canonical ESRL package
 * preserve the current app harness anchor values and do not create a built-in
 * external electricity demand anchor.
 *
 * Run:  bunx tsx --test test/packageAnchorParity.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { loadPackage } from '../src/data/packageLoader.ts';
import { resolveConfigurationDocument } from '../src/data/demandResolution.ts';

// --- Data loading ---

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

const pkg = loadPackage();
const jsonAnchors = readJson('../public/app_config/baseline_activity_anchors.json');
const packageAnchors = pkg.appConfig.baseline_activity_anchors;
const outputRoles = pkg.appConfig.output_roles;

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

// ---------------------------------------------------------------------------
// 1. Parity tests — CSV-derived anchors match JSON values
// ---------------------------------------------------------------------------

test('canonical role-demand anchors match current JSON values exactly', () => {
  for (const [outputId, expectedValue] of Object.entries(EXPECTED_PARITY)) {
    const packageAnchor = packageAnchors[outputId];
    const jsonAnchor = jsonAnchors[outputId];

    assert.ok(packageAnchor, `package anchor missing for ${outputId}`);
    assert.ok(jsonAnchor, `JSON anchor missing for ${outputId}`);

    assert.equal(
      packageAnchor.value, expectedValue,
      `${outputId}: package value ${packageAnchor.value} !== expected ${expectedValue}`,
    );
    assert.equal(
      jsonAnchor.value, expectedValue,
      `${outputId}: JSON value ${jsonAnchor.value} !== expected ${expectedValue}`,
    );
    assert.equal(
      packageAnchor.value, jsonAnchor.value,
      `${outputId}: package value ${packageAnchor.value} !== JSON value ${jsonAnchor.value}`,
    );
  }
});

test('canonical electricity role does not create a built-in external demand anchor', () => {
  assert.equal(packageAnchors.electricity, undefined);
  assert.equal(jsonAnchors.electricity, undefined);
});

test('canonical anchors preserve output_role from output_roles registry', () => {
  for (const [outputId] of Object.entries(EXPECTED_PARITY)) {
    assert.equal(
      packageAnchors[outputId].output_role,
      outputRoles[outputId].output_role,
      `${outputId}: output_role mismatch`,
    );
  }
});

test('canonical anchors preserve anchor_kind correctly', () => {
  for (const [outputId] of Object.entries(EXPECTED_PARITY)) {
    assert.equal(packageAnchors[outputId].anchor_kind, 'service_demand', `${outputId} should be service_demand`);
  }
});

test('canonical anchors preserve unit from JSON', () => {
  for (const [outputId] of Object.entries(EXPECTED_PARITY)) {
    assert.equal(
      packageAnchors[outputId].unit,
      jsonAnchors[outputId].unit,
      `${outputId}: unit mismatch between CSV and JSON`,
    );
  }
});

test('informational validation rows are not mapped to anchors', () => {
  assert.equal(packageAnchors['electricity_explicit_load'], undefined, 'derived electricity load should not produce an anchor');
  assert.equal(packageAnchors['electricity_total_output_benchmark'], undefined, 'electricity benchmark should not produce an anchor');
});

test('package exposes all expected modeled-service anchors', () => {
  for (const outputId of Object.keys(EXPECTED_PARITY)) {
    assert.ok(packageAnchors[outputId], `${outputId} should have an anchor`);
  }
});

test('JSON-only anchors (land_sequestration, engineered_removals) are preserved after merge', () => {
  const merged = { ...jsonAnchors, ...packageAnchors };

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

test('demand resolution produces correct 2025 service demands from canonical anchors', () => {
  const referenceConfiguration = readJson('../src/configurations/reference-baseline.json');
  const resolved = resolveConfigurationDocument(referenceConfiguration, pkg.appConfig, 'parity test');

  // 2025 service demands should match anchor values exactly
  for (const [outputId, expectedValue] of Object.entries(EXPECTED_PARITY)) {
    const demand2025 = resolved.service_demands[outputId]?.['2025'];
    assert.equal(
      demand2025, expectedValue,
      `${outputId}: resolved 2025 demand ${demand2025} !== expected ${expectedValue}`,
    );
  }

  assert.equal(resolved.external_commodity_demands?.electricity, undefined);
  assert.equal(resolved.service_demands.electricity_grid_losses_own_use?.['2025'], 1);
  assert.equal(resolved.service_demands.commercial_other?.['2025'], 1);
});
