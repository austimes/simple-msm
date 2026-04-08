#!/usr/bin/env npx tsx
/**
 * Standalone CLI solver — runs the model outside the browser.
 *
 * Usage:
 *   npx tsx solve.mjs                       # solve with reference scenario
 *   npx tsx solve.mjs path/to/scenario.json  # solve with a custom scenario
 *   npx tsx solve.mjs --config <id>          # solve with a named configuration
 *   npx tsx solve.mjs --config path/to.json  # solve with a configuration file
 *   npx tsx solve.mjs --list-configs         # list available built-in configurations
 *   npx tsx solve.mjs --json                 # output raw JSON result
 */
import { readFileSync, readdirSync } from 'node:fs';
import { parseCsv } from './src/data/parseCsv.ts';
import { resolveScenarioDocument } from './src/data/demandResolution.ts';
import { buildSolveRequest } from './src/solver/buildSolveRequest.ts';
import { solveWithLpAdapter } from './src/solver/lpAdapter.ts';

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

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
    output_roles: readJson('public/app_config/output_roles.json'),
    baseline_activity_anchors: readJson('public/app_config/baseline_activity_anchors.json'),
    demand_growth_presets: readJson('public/app_config/demand_growth_presets.json'),
    commodity_price_presets: readJson('public/app_config/commodity_price_presets.json'),
    explanation_tag_rules: readJson('public/app_config/explanation_tag_rules.json'),
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

function loadPackage() {
  const csvText = readText('../aus_phase1_sector_state_library/data/sector_states.csv');
  const sectorStates = parseCsv(csvText).map(toSectorState);
  const appConfig = loadAppConfig();
  return { sectorStates, appConfig };
}

function loadScenario(appConfig, scenarioPath) {
  const raw = scenarioPath
    ? JSON.parse(readFileSync(scenarioPath, 'utf8'))
    : readJson('public/app_config/reference_scenario.json');
  return resolveScenarioDocument(raw, appConfig, scenarioPath ?? 'reference_scenario.json');
}

// ---------------------------------------------------------------------------
// Configuration loading
// ---------------------------------------------------------------------------

function loadBuiltinConfigurationsFromDisk() {
  const configDir = new URL('public/configurations/', import.meta.url);
  const files = readdirSync(configDir).filter(
    (f) => f.endsWith('.json') && !f.startsWith('_'),
  );
  return files.map((f) => {
    const url = new URL(`public/configurations/${f}`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8'));
  });
}

function loadConfigurationById(configId) {
  const configs = loadBuiltinConfigurationsFromDisk();
  return configs.find((c) => c.id === configId) ?? null;
}

function loadConfigurationFromFile(configPath) {
  return JSON.parse(readFileSync(configPath, 'utf8'));
}

function applyConfiguration(config, referenceScenario) {
  const scenario = structuredClone(referenceScenario);
  scenario.name = config.name;
  if (config.description) scenario.description = config.description;

  const mergedControls = { ...scenario.service_controls };
  for (const [outputId, control] of Object.entries(config.serviceControls)) {
    mergedControls[outputId] = { ...mergedControls[outputId], ...control };
  }
  scenario.service_controls = mergedControls;

  if (config.solverOptions) {
    scenario.solver_options = { ...scenario.solver_options, ...config.solverOptions };
  }

  return { scenario, includedOutputIds: config.includedOutputIds };
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function fmt(n) {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e6) return n.toExponential(3);
  return Number.isInteger(n) ? String(n) : n.toFixed(4);
}

function printSummary(result) {
  const statusIcon = result.status === 'solved' ? '✓' : result.status === 'partial' ? '~' : '✗';
  console.log(`\n  ${statusIcon}  Status: ${result.status}  (LP: ${result.raw?.solutionStatus ?? 'N/A'})`);
  console.log(`     Objective: ${fmt(result.raw?.objectiveValue)}`);
  console.log(`     Variables: ${result.raw?.variableCount ?? 0}   Constraints: ${result.raw?.constraintCount ?? 0}`);
  console.log(`     Time: ${result.timingsMs.total.toFixed(1)} ms  (solve ${result.timingsMs.solve.toFixed(1)} ms)`);
}

function printDiagnostics(result) {
  const issues = result.diagnostics.filter((d) => d.severity !== 'info');
  if (issues.length === 0) {
    console.log('\n  Diagnostics: clean (info only)');
    return;
  }
  console.log(`\n  Diagnostics (${issues.length}):`);
  for (const d of issues) {
    const loc = [d.outputId, d.year, d.stateId].filter(Boolean).join(' / ');
    console.log(`    [${d.severity}] ${d.message}${loc ? `  (${loc})` : ''}`);
  }
}

function pad(str, width) {
  str = String(str);
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

function rpad(str, width) {
  str = String(str);
  return str.length >= width ? str : ' '.repeat(width - str.length) + str;
}

function printCommodityBalances(result) {
  const balances = result.reporting.commodityBalances;
  if (balances.length === 0) return;
  console.log('\n  Commodity balances:');
  console.log(`    ${pad('commodity', 14)} ${rpad('year', 5)} ${pad('mode', 13)} ${rpad('supply', 14)} ${rpad('modeled', 14)} ${rpad('external', 14)} ${rpad('gap', 14)}`);
  for (const b of balances) {
    console.log(`    ${pad(b.commodityId, 14)} ${rpad(b.year, 5)} ${pad(b.mode, 13)} ${rpad(fmt(b.supply), 14)} ${rpad(fmt(b.modeledDemand), 14)} ${rpad(fmt(b.externalDemand), 14)} ${rpad(fmt(b.balanceGap), 14)}`);
  }
}

function printStateShares(result) {
  const shares = result.reporting.stateShares.filter((s) => s.activity > 1e-6);
  if (shares.length === 0) return;
  console.log(`\n  Active state shares (${shares.length} / ${result.reporting.stateShares.length}):`);
  console.log(`    ${pad('state', 40)} ${rpad('year', 5)} ${rpad('activity', 14)} ${rpad('share', 8)}`);
  for (const s of shares) {
    const shareStr = s.share != null ? `${(s.share * 100).toFixed(1)}%` : '—';
    console.log(`    ${pad(s.stateLabel.slice(0, 40), 40)} ${rpad(s.year, 5)} ${rpad(fmt(s.activity), 14)} ${rpad(shareStr, 8)}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const listConfigs = args.includes('--list-configs');

// Parse --config flag
let configValue = null;
const configIdx = args.indexOf('--config');
if (configIdx >= 0 && configIdx + 1 < args.length) {
  configValue = args[configIdx + 1];
}

const scenarioPath = args.find((a) => !a.startsWith('--') && a !== configValue) ?? null;

if (listConfigs) {
  const configs = loadBuiltinConfigurationsFromDisk();
  console.log('\n  Available configurations:\n');
  for (const c of configs) {
    const scope = c.includedOutputIds?.length
      ? `${c.includedOutputIds.length} outputs`
      : 'full model';
    console.log(`    ${pad(c.id, 30)} ${c.name} (${scope})`);
  }
  console.log();
  process.exit(0);
}

const pkg = loadPackage();

let scenario;
let includedOutputIds;

if (configValue) {
  // Load configuration — either by ID or file path
  let config;
  if (configValue.endsWith('.json')) {
    config = loadConfigurationFromFile(configValue);
  } else {
    config = loadConfigurationById(configValue);
    if (!config) {
      console.error(`\n  Unknown configuration: ${configValue}`);
      console.error('  Run with --list-configs to see available configurations.\n');
      process.exit(1);
    }
  }

  const referenceScenario = loadScenario(pkg.appConfig, null);
  const applied = applyConfiguration(config, referenceScenario);
  scenario = resolveScenarioDocument(applied.scenario, pkg.appConfig, config.name);
  includedOutputIds = applied.includedOutputIds;
} else {
  scenario = loadScenario(pkg.appConfig, scenarioPath);
  includedOutputIds = undefined;
}

const request = buildSolveRequest(
  { sectorStates: pkg.sectorStates, appConfig: pkg.appConfig, defaultScenario: scenario },
  scenario,
  includedOutputIds ? { includedOutputIds } : {},
);

const result = solveWithLpAdapter(request);

if (jsonMode) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`\n  Scenario: ${scenario.name}`);
  if (includedOutputIds) {
    console.log(`  Scoped to: ${includedOutputIds.join(', ')}`);
  }
  console.log(`  Rows: ${request.rows.length}   Years: ${scenario.years.join(', ')}`);
  printSummary(result);
  printDiagnostics(result);
  printCommodityBalances(result);
  printStateShares(result);
  console.log();
}

process.exitCode = result.status === 'error' ? 1 : 0;
