import { readFileSync } from 'node:fs';
import { parseCsv } from '../src/data/parseCsv.ts';
import { resolveScenarioDocument as resolveConfigurationDocument } from '../src/data/demandResolution.ts';
import { buildSolveRequest, normalizeSolverRows } from '../src/solver/buildSolveRequest.ts';
import { solveWithLpAdapter, inspectConfigurationLpBuild } from '../src/solver/lpAdapter.ts';

// --- Data loading (mirrors demandResolution.test.mjs + packageLoader.ts) ---

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

function readText(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return readFileSync(url, 'utf8');
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
  return raw.trim().toLowerCase() === 'true';
}

function toSectorState(row) {
  return {
    sector: row['sector'],
    subsector: row['subsector'],
    service_or_output_name: row['service_or_output_name'],
    region: row['region'],
    year: Number(row['year']),
    state_id: row['state_id'],
    state_label: row['state_label'],
    state_description: row['state_description'],
    output_unit: row['output_unit'],
    output_quantity_basis: row['output_quantity_basis'],
    output_cost_per_unit: parseNum(row['output_cost_per_unit']),
    cost_basis_year: parseNum(row['cost_basis_year']),
    currency: row['currency'],
    cost_components_summary: row['cost_components_summary'],
    input_commodities: parseJsonArray(row['input_commodities']),
    input_coefficients: parseJsonArray(row['input_coefficients']),
    input_units: parseJsonArray(row['input_units']),
    input_basis_notes: row['input_basis_notes'],
    energy_emissions_by_pollutant: parseJsonArray(row['energy_emissions_by_pollutant']),
    process_emissions_by_pollutant: parseJsonArray(row['process_emissions_by_pollutant']),
    emissions_units: row['emissions_units'],
    emissions_boundary_notes: row['emissions_boundary_notes'],
    max_share: parseNum(row['max_share']),
    max_activity: parseNum(row['max_activity']),
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
    would_expand_to_explicit_capacity: parseBool(row['would_expand_to_explicit_capacity?'] ?? ''),
    would_expand_to_process_chain: parseBool(row['would_expand_to_process_chain?'] ?? ''),
  };
}

function loadPkg() {
  const csvText = readText('../../aus_phase1_sector_state_library/data/sector_states.csv');
  const csvRows = parseCsv(csvText);
  const sectorStates = csvRows.map(toSectorState);
  const appConfig = loadAppConfig();
  const referenceConfiguration = readJson('../public/app_config/reference_configuration.json');
  const defaultConfiguration = resolveConfigurationDocument(referenceConfiguration, appConfig, 'reference_configuration.json');

  return { sectorStates, appConfig, defaultScenario: defaultConfiguration };
}

// --- Formatting helpers ---

function summarizeDiagnostics(diagnostics) {
  return diagnostics.map((d) => ({
    severity: d.severity,
    code: d.code,
    reason: d.reason ?? '',
    outputId: d.outputId ?? '',
    year: d.year ?? '',
    stateId: d.stateId ?? '',
    message: d.message,
  }));
}

function flattenResolvedControls(request) {
  const rows = [];
  for (const [outputId, yearTable] of Object.entries(request.configuration.controlsByOutput)) {
    for (const [year, control] of Object.entries(yearTable)) {
      if (control.mode === 'optimize' && !control.stateId && control.disabledStateIds.length === 0) {
        continue;
      }
      rows.push({
        outputId,
        year,
        mode: control.mode,
        stateId: control.stateId ?? '',
        fixedShares: control.fixedShares ? JSON.stringify(control.fixedShares) : '',
        disabledStateIds: control.disabledStateIds.join(', '),
      });
    }
  }
  return rows;
}

// --- Main test runner ---

function logCase(label, configuration, pkg) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${label}`);
  console.log(`${'='.repeat(70)}`);

  let request;
  try {
    request = buildSolveRequest(pkg, configuration);
  } catch (err) {
    console.error(`\n  BUILD REQUEST FAILED: ${err.message}`);
    return { request: null, build: null, result: null };
  }

  // Resolved controls
  const controls = flattenResolvedControls(request);
  console.log(`\n--- Resolved controls (${controls.length} non-default entries) ---`);
  if (controls.length > 0) console.table(controls);

  // LP build inspection
  let build;
  try {
    build = inspectConfigurationLpBuild(request);
  } catch (err) {
    console.error(`\n  LP BUILD INSPECTION FAILED: ${err.message}`);
    build = null;
  }

  if (build) {
    console.log(`\n--- LP build summary ---`);
    console.log(`  Required-service groups: ${build.requiredServiceGroups.length}`);
    console.log(`  Supply groups:           ${build.supplyGroups.length}`);
    console.log(`  Variables:               ${build.variableCount}`);
    console.log(`  Constraints:             ${build.constraintCount}`);

    const buildErrors = build.diagnostics.filter((d) => d.severity === 'error');
    if (buildErrors.length > 0) {
      console.log(`\n--- Build validation errors (${buildErrors.length}) ---`);
      console.table(summarizeDiagnostics(buildErrors));
    } else {
      console.log(`  Build validation:        PASS (no errors)`);
    }

    console.log(`\n--- Build notes ---`);
    for (const note of build.notes) console.log(`  - ${note}`);

    // Log supply groups detail
    console.log(`\n--- Supply group detail ---`);
    console.table(build.supplyGroups);
  }

  // Solve
  let result;
  try {
    result = solveWithLpAdapter(request);
  } catch (err) {
    console.error(`\n  SOLVE FAILED: ${err.message}`);
    return { request, build, result: null };
  }

  console.log(`\n--- Solve result ---`);
  console.log(`  Status:          ${result.status}`);
  console.log(`  Solution status: ${result.raw?.solutionStatus ?? 'N/A'}`);
  console.log(`  Objective value: ${result.raw?.objectiveValue ?? 'N/A'}`);
  console.log(`  Variables:       ${result.raw?.variableCount ?? 'N/A'}`);
  console.log(`  Constraints:     ${result.raw?.constraintCount ?? 'N/A'}`);
  console.log(`  Time total:      ${result.timingsMs.total.toFixed(2)} ms`);
  console.log(`  Time solve:      ${result.timingsMs.solve.toFixed(2)} ms`);

  // Diagnostics
  const nonInfoDiags = result.diagnostics.filter((d) => d.severity !== 'info');
  if (nonInfoDiags.length > 0) {
    console.log(`\n--- Diagnostics (${nonInfoDiags.length} warnings/errors) ---`);
    console.table(summarizeDiagnostics(nonInfoDiags));
  } else {
    console.log(`\n  Diagnostics: CLEAN (info only)`);
  }

  // Commodity balances
  if (result.reporting.commodityBalances.length > 0) {
    console.log(`\n--- Commodity balances ---`);
    console.table(result.reporting.commodityBalances);
  }

  // Nonzero state shares
  const nonzeroShares = result.reporting.stateShares.filter((row) => row.activity > 1e-6);
  if (nonzeroShares.length > 0) {
    console.log(`\n--- Nonzero state shares (${nonzeroShares.length} / ${result.reporting.stateShares.length}) ---`);
    console.table(nonzeroShares);
  }

  return { request, build, result };
}

function main() {
  const pkg = loadPkg();
  const referenceConfiguration = readJson('../public/app_config/reference_configuration.json');

  console.log(`Loaded ${pkg.sectorStates.length} sector state rows`);
  console.log(`Output roles: ${Object.keys(pkg.appConfig.output_roles).join(', ')}`);

  // Find electricity state IDs for test cases
  const electricityStates = [...new Set(
    pkg.sectorStates
      .filter((row) => row.service_or_output_name === 'electricity')
      .map((row) => row.state_id),
  )];
  console.log(`Electricity state IDs: ${electricityStates.join(', ') || 'NONE'}`);
  console.log(`Electricity output role: ${pkg.appConfig.output_roles['electricity']?.output_role ?? 'MISSING'}`);
  console.log(`Electricity allowed modes: ${pkg.appConfig.output_roles['electricity']?.allowed_control_modes?.join(', ') ?? 'MISSING'}`);
  console.log(`Electricity default mode: ${pkg.appConfig.output_roles['electricity']?.default_control_mode ?? 'MISSING'}`);

  // Case 1: Reference configuration (externalized electricity) — should be feasible
  const case1 = logCase('Case 1: Reference configuration (externalized electricity)', referenceConfiguration, pkg);

  // Case 2: Electricity in optimize mode
  const optimizeElectricity = structuredClone(referenceConfiguration);
  optimizeElectricity.name += ' [electricity optimize]';
  optimizeElectricity.service_controls = {
    ...optimizeElectricity.service_controls,
    electricity: { mode: 'optimize' },
  };
  const case2 = logCase('Case 2: Electricity in optimize mode', optimizeElectricity, pkg);

  // Case 3: Stale exact-share control with no shares (simulating localStorage bug)
  if (electricityStates.length > 0) {
    const stalePinned = structuredClone(referenceConfiguration);
    stalePinned.name += ' [stale electricity exact shares]';
    stalePinned.service_controls = {
      ...stalePinned.service_controls,
      electricity: {
        mode: 'fixed_shares',
        fixed_shares: null,
      },
    };
    logCase('Case 3: Stale exact-share electricity', stalePinned, pkg);
  }

  // Case 4: Electricity fixed_shares with single state at 100%
  if (electricityStates.length > 0) {
    const fixedElectricity = structuredClone(referenceConfiguration);
    fixedElectricity.name += ' [electricity fixed_shares single]';
    fixedElectricity.service_controls = {
      ...fixedElectricity.service_controls,
      electricity: {
        mode: 'fixed_shares',
        fixed_shares: { [electricityStates[0]]: 1 },
      },
    };
    logCase('Case 4: Electricity fixed_shares (single state 100%)', fixedElectricity, pkg);
  }

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('  SUMMARY');
  console.log(`${'='.repeat(70)}`);
  const cases = [case1, case2];
  const labels = ['Reference (externalized)', 'Optimize electricity'];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const feasible = c.result?.raw?.solutionStatus === 'optimal';
    console.log(`  ${labels[i]}: ${feasible ? 'FEASIBLE ✓' : `INFEASIBLE ✗ (${c.result?.raw?.solutionStatus ?? 'no result'})`}`);
  }

  if (case1.result?.raw?.solutionStatus !== 'optimal') {
    console.error('\n  ⚠ Reference configuration is INFEASIBLE — this indicates a deeper model problem.');
    process.exitCode = 1;
  } else {
    console.log('\n  ✓ Reference configuration is feasible. If the browser solve fails, the issue is likely a stale localStorage draft.');
  }
}

main();
