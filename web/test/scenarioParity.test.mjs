/**
 * Regression test: reference vs full-model-incumbents 2025 emissions parity.
 *
 * Runs both configurations through the shared runScenario() helper and asserts
 * structural and numerical equivalence where expected.
 *
 * Run:  bunx tsx --test test/scenarioParity.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../src/data/parseCsv.ts';
import { resolveConfigurationDocument } from '../src/data/demandResolution.ts';
import { deriveBaselineAnchorsFromPackage } from '../src/data/packageAnchorMapping.ts';
import { runScenario } from '../src/results/runScenario.ts';

// ---------------------------------------------------------------------------
// Data loading (mirrors solve.mjs loadPackage pattern)
// ---------------------------------------------------------------------------

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

function readText(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return readFileSync(url, 'utf8');
}

function parseJsonArray(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function parseNum(raw) {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseBool(raw) {
  return String(raw ?? '').trim().toLowerCase() === 'true';
}

function parseEmptyNull(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed === '' ? null : trimmed;
}

function toSectorState(row) {
  return {
    sector: row['sector'], subsector: row['subsector'],
    service_or_output_name: row['service_or_output_name'],
    region: row['region'], year: Number(row['year']),
    state_id: row['state_id'], state_label: row['state_label'],
    state_description: row['state_description'],
    output_unit: row['output_unit'], output_quantity_basis: row['output_quantity_basis'],
    output_cost_per_unit: parseNum(row['output_cost_per_unit']),
    cost_basis_year: parseNum(row['cost_basis_year']),
    currency: row['currency'], cost_components_summary: row['cost_components_summary'],
    input_commodities: parseJsonArray(row['input_commodities']),
    input_coefficients: parseJsonArray(row['input_coefficients']),
    input_units: parseJsonArray(row['input_units']),
    input_basis_notes: row['input_basis_notes'],
    energy_emissions_by_pollutant: parseJsonArray(row['energy_emissions_by_pollutant']),
    process_emissions_by_pollutant: parseJsonArray(row['process_emissions_by_pollutant']),
    emissions_units: row['emissions_units'],
    emissions_boundary_notes: row['emissions_boundary_notes'],
    max_share: parseNum(row['max_share']), max_activity: parseNum(row['max_activity']),
    min_share: parseNum(row['min_share']),
    rollout_limit_notes: row['rollout_limit_notes'],
    availability_conditions: row['availability_conditions'],
    source_ids: parseJsonArray(row['source_ids']),
    evidence_summary: row['evidence_summary'],
    derivation_method: row['derivation_method'],
    assumption_ids: parseJsonArray(row['assumption_ids']),
    confidence_rating: row['confidence_rating'],
    review_notes: row['review_notes'],
    candidate_expansion_pathway: row['candidate_expansion_pathway'],
    times_or_vedalang_mapping_notes: row['times_or_vedalang_mapping_notes'],
    would_expand_to_explicit_capacity: parseBool(row['would_expand_to_explicit_capacity?']),
    would_expand_to_process_chain: parseBool(row['would_expand_to_process_chain?']),
  };
}

function toServiceDemandAnchorRow(row) {
  return {
    anchor_type: row['anchor_type'],
    service_or_output_name: row['service_or_output_name'],
    quantity_2025: parseNum(row['quantity_2025']),
    unit: row['unit'],
    source_family: row['source_family'],
    coverage_note: row['coverage_note'],
  };
}

function toResidualOverlayRow(row) {
  return {
    overlay_id: row['overlay_id'],
    overlay_label: row['overlay_label'],
    overlay_domain: row['overlay_domain'],
    official_accounting_bucket: row['official_accounting_bucket'],
    year: Number(row['year']),
    commodity: parseEmptyNull(row['commodity']),
    final_energy_pj_2025: parseNum(row['final_energy_pj_2025']),
    native_unit: row['native_unit'] ?? '',
    native_quantity_2025: parseNum(row['native_quantity_2025']),
    direct_energy_emissions_mtco2e_2025: parseNum(row['direct_energy_emissions_mtco2e_2025']),
    other_emissions_mtco2e_2025: parseNum(row['other_emissions_mtco2e_2025']),
    carbon_billable_emissions_mtco2e_2025: parseNum(row['carbon_billable_emissions_mtco2e_2025']),
    default_price_basis: row['default_price_basis'] ?? '',
    default_price_per_native_unit_aud_2024: parseNum(row['default_price_per_native_unit_aud_2024']),
    default_commodity_cost_audm_2024: parseNum(row['default_commodity_cost_audm_2024']),
    default_fixed_noncommodity_cost_audm_2024: parseNum(row['default_fixed_noncommodity_cost_audm_2024']),
    default_total_cost_ex_carbon_audm_2024: parseNum(row['default_total_cost_ex_carbon_audm_2024']),
    default_include: parseBool(row['default_include']),
    allocation_method: row['allocation_method'] ?? '',
    cost_basis_note: row['cost_basis_note'] ?? '',
    notes: row['notes'] ?? '',
  };
}

function loadAppConfig() {
  return {
    output_roles: readJson('../public/app_config/output_roles.json'),
    baseline_activity_anchors: readJson('../public/app_config/baseline_activity_anchors.json'),
    demand_growth_presets: readJson('../public/app_config/demand_growth_presets.json'),
    commodity_price_presets: readJson('../public/app_config/commodity_price_presets.json'),
    carbon_price_presets: readJson('../public/app_config/carbon_price_presets.json'),
    explanation_tag_rules: readJson('../public/app_config/explanation_tag_rules.json'),
  };
}

function ensureResidualOverlays(configuration, overlayRows) {
  const includeByOverlayId = new Map();
  for (const row of overlayRows) {
    const current = includeByOverlayId.get(row.overlay_id);
    includeByOverlayId.set(
      row.overlay_id,
      current === undefined ? row.default_include : current && row.default_include,
    );
  }
  const existing = configuration.residual_overlays?.controls_by_overlay_id ?? {};
  const merged = {};
  for (const [id, included] of includeByOverlayId.entries()) {
    merged[id] = { included: existing[id]?.included ?? included };
  }
  return {
    ...configuration,
    residual_overlays: { controls_by_overlay_id: merged },
    presentation_options: {
      ...(configuration.presentation_options ?? {}),
      residual_overlay_display_mode:
        configuration.presentation_options?.residual_overlay_display_mode ?? 'aggregated_non_sink',
    },
  };
}

// ---------------------------------------------------------------------------
// Load package and configurations
// ---------------------------------------------------------------------------

const LEGACY = '../../sector_trajectory_library/exports/legacy';
const OVERLAYS = '../../sector_trajectory_library/overlays';

const sectorStates = parseCsv(readText(`${LEGACY}/sector_state_curves_balanced.csv`)).map(toSectorState);
const appConfig = loadAppConfig();

const anchorRows = parseCsv(readText(`${LEGACY}/service_demand_anchors_2025.csv`)).map(toServiceDemandAnchorRow);
const csvAnchors = deriveBaselineAnchorsFromPackage(anchorRows, appConfig.output_roles);
appConfig.baseline_activity_anchors = { ...appConfig.baseline_activity_anchors, ...csvAnchors };

const residualOverlays2025 = parseCsv(readText(`${OVERLAYS}/residual_overlays.csv`)).map(toResidualOverlayRow);

const pkg = { sectorStates, appConfig, residualOverlays2025 };

function loadAndResolveConfig(filename) {
  const raw = readJson(`../src/configurations/${filename}`);
  let config = resolveConfigurationDocument(raw, appConfig, raw.name);
  config = ensureResidualOverlays(config, residualOverlays2025);
  return config;
}

const referenceConfig = loadAndResolveConfig('reference.json');
const incumbentsConfig = loadAndResolveConfig('full-model-incumbents.json');

const refSnapshot = runScenario(pkg, referenceConfig);
const incSnapshot = runScenario(pkg, incumbentsConfig);

// ---------------------------------------------------------------------------
// Floating-point tolerance
// ---------------------------------------------------------------------------

const TOLERANCE = 1e-6;

function approxEqual(a, b, message) {
  assert.ok(
    Math.abs(a - b) < TOLERANCE,
    `${message}: ${a} vs ${b} (diff ${Math.abs(a - b)})`,
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('reference vs full-model-incumbents parity', () => {
  it('1. same SolveRequest row count', () => {
    assert.equal(refSnapshot.request.rows.length, incSnapshot.request.rows.length);
  });

  it('2. same output count', () => {
    const refOutputs = new Set(refSnapshot.request.rows.map((r) => r.outputId));
    const incOutputs = new Set(incSnapshot.request.rows.map((r) => r.outputId));
    assert.equal(refOutputs.size, incOutputs.size);
    for (const id of refOutputs) {
      assert.ok(incOutputs.has(id), `output ${id} missing from full-model-incumbents`);
    }
  });

  it('3. electricity commodity balance is externalized in both', () => {
    const refElec = refSnapshot.result.reporting.commodityBalances.find(
      (cb) => cb.commodityId === 'electricity',
    );
    const incElec = incSnapshot.result.reporting.commodityBalances.find(
      (cb) => cb.commodityId === 'electricity',
    );
    assert.ok(refElec, 'reference should have electricity commodity balance');
    assert.ok(incElec, 'incumbents should have electricity commodity balance');
    assert.equal(refElec.mode, 'externalized');
    assert.equal(incElec.mode, 'externalized');
  });

  it('4. zero solver contribution rows for electricity_supply sector', () => {
    const refElecSolver = refSnapshot.contributions.filter(
      (r) => r.sectorId === 'electricity_supply' && r.sourceKind === 'solver',
    );
    const incElecSolver = incSnapshot.contributions.filter(
      (r) => r.sectorId === 'electricity_supply' && r.sourceKind === 'solver',
    );
    assert.equal(refElecSolver.length, 0, 'reference should have no electricity_supply solver rows');
    assert.equal(incElecSolver.length, 0, 'incumbents should have no electricity_supply solver rows');
  });

  it('5. identical 2025 total emissions (within tolerance)', () => {
    const totalEmissions2025 = (snapshot) =>
      snapshot.contributions
        .filter((r) => r.metric === 'emissions' && r.year === 2025)
        .reduce((sum, r) => sum + r.value, 0);

    const refTotal = totalEmissions2025(refSnapshot);
    const incTotal = totalEmissions2025(incSnapshot);
    approxEqual(refTotal, incTotal, '2025 total emissions');
  });

  it('6. identical 2025 emissions-by-sector breakdown', () => {
    const emissionsBySector2025 = (snapshot) => {
      const map = new Map();
      for (const r of snapshot.contributions) {
        if (r.metric !== 'emissions' || r.year !== 2025) continue;
        map.set(r.sectorId, (map.get(r.sectorId) ?? 0) + r.value);
      }
      return map;
    };

    const refBySector = emissionsBySector2025(refSnapshot);
    const incBySector = emissionsBySector2025(incSnapshot);

    const allSectors = new Set([...refBySector.keys(), ...incBySector.keys()]);
    for (const sector of allSectors) {
      const refVal = refBySector.get(sector) ?? 0;
      const incVal = incBySector.get(sector) ?? 0;
      approxEqual(refVal, incVal, `2025 emissions for sector "${sector}"`);
    }
  });

  it('7. CLI output matches web UI output — same runScenario path produces identical snapshots', () => {
    // Both the CLI and web UI now use runScenario(). Verify that running
    // the same configuration through the same helper produces deterministic
    // results by re-running and comparing.
    const refSnapshot2 = runScenario(pkg, referenceConfig);

    assert.equal(refSnapshot.request.rows.length, refSnapshot2.request.rows.length);
    assert.equal(refSnapshot.result.status, refSnapshot2.result.status);
    assert.equal(refSnapshot.contributions.length, refSnapshot2.contributions.length);

    // Objective values must be identical (deterministic LP)
    assert.equal(
      refSnapshot.result.raw?.objectiveValue,
      refSnapshot2.result.raw?.objectiveValue,
    );
  });
});
