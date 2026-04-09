#!/usr/bin/env tsx
/**
 * CLI solver — runs the model outside the browser using the same code paths
 * as the web app: parseCsv -> resolveConfigurationDocument -> buildSolveRequest -> solveWithLpAdapter
 *
 * Usage:
 *   npx msm <config>                           # solve one config
 *   npx msm <config> <config> ...              # batch solve
 *   npx msm compare <config> <config>          # compare two configs
 *   npx msm list                               # list built-in configs
 *   npx msm --all                              # batch solve all built-ins
 *
 * A <config> is a file path (e.g. ./my-config.json) or a built-in id
 * (e.g. steel-optimize). Built-in ids resolve to public/configurations/<id>.json.
 *
 * Scope is defined in the config document via app_metadata.included_output_ids.
 *
 * Output:
 *   --json      Machine-readable JSON
 *   --quiet     Summary-only human output
 *
 * Exit codes:
 *   0 = all solves succeeded
 *   1 = any runtime/solve errors
 *   2 = CLI usage error
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, isAbsolute, relative as relativePath, resolve as resolvePath } from 'node:path';
import { parseCsv } from './src/data/parseCsv.ts';
import { resolveConfigurationDocument } from './src/data/demandResolution.ts';
import {
  buildSolveRequest,
  normalizeSolverRows,
} from './src/solver/buildSolveRequest.ts';
import { solveWithLpAdapter } from './src/solver/lpAdapter.ts';

const EXIT_OK = 0;
const EXIT_ERROR = 1;
const EXIT_USAGE = 2;
const EPSILON = 1e-9;

class UsageError extends Error {
  constructor(message) { super(message); this.name = 'UsageError'; }
}

const HELP_TEXT = `
Usage:
  npx msm <config>                     Solve one config
  npx msm <config> <config> ...        Batch solve multiple configs
  npx msm compare <config> <config>    Compare two config runs
  npx msm list                         List built-in configs
  npx msm --all                        Batch solve all built-ins

A <config> is a file path or a built-in id (resolves to public/configurations/<id>.json).
Scope is defined in the config document via app_metadata.included_output_ids.

Options:
  --json       Machine-readable JSON output
  --quiet      Summary-only output
  --all        Solve every built-in config
  -h, --help   Show this help

Exit codes: 0 = success, 1 = solve/runtime error, 2 = usage error
`.trim();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toErrorMessage(e) { return e instanceof Error ? e.message : String(e); }
function isPlainObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => String(a).localeCompare(String(b)));
}

function resolveCliPath(input) {
  return isAbsolute(input) ? input : resolvePath(process.cwd(), input);
}

function displayPath(absPath) {
  const rel = relativePath(process.cwd(), absPath);
  return rel && !rel.startsWith('..') ? rel : absPath;
}

function readJsonRelative(p) {
  return JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
}

function readTextRelative(p) {
  return readFileSync(new URL(p, import.meta.url), 'utf8');
}

function readJsonFile(absPath, label) {
  try { return JSON.parse(readFileSync(absPath, 'utf8')); }
  catch (e) { throw new Error(`Failed to parse ${label} ${displayPath(absPath)}: ${toErrorMessage(e)}`); }
}

function normalizeOptionalStringArray(value) {
  if (!Array.isArray(value)) return undefined;
  const n = uniqueSorted(value.filter((e) => typeof e === 'string' && e.trim()));
  return n.length > 0 ? n : undefined;
}

function formatIdList(values, limit = 6) {
  if (!values || values.length === 0) return '—';
  if (values.length <= limit) return values.join(', ');
  return `${values.slice(0, limit).join(', ')}, … (+${values.length - limit})`;
}

function numericDelta(l, r, { defaultZero = false } = {}) {
  const left = l == null ? (defaultZero ? 0 : null) : l;
  const right = r == null ? (defaultZero ? 0 : null) : r;
  if (left == null || right == null) return null;
  return right - left;
}

function hasMeaningfulChange(...values) {
  return values.some((v) => v != null && Math.abs(v) > EPSILON);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function truncate(text, maxWidth) {
  const v = String(text ?? '—');
  if (!maxWidth || v.length <= maxWidth) return v;
  return `${v.slice(0, Math.max(0, maxWidth - 1))}…`;
}

function padRight(t, w) { const v = String(t); return v.length >= w ? v : v + ' '.repeat(w - v.length); }
function padLeft(t, w) { const v = String(t); return v.length >= w ? v : ' '.repeat(w - v.length) + v; }
function alignCell(t, w, a) { return a === 'right' ? padLeft(t, w) : padRight(t, w); }

function fmtNumber(v, digits = 4) {
  if (v == null) return '—';
  const n = Math.abs(v) < 1e-12 ? 0 : v;
  const a = Math.abs(n);
  if (a !== 0 && (a >= 1e9 || a < 1e-4)) return n.toExponential(3);
  if (Number.isInteger(n)) return String(n);
  if (a >= 1000) return n.toFixed(2);
  return n.toFixed(digits);
}

function fmtDelta(v, digits = 4) {
  if (v == null) return '—';
  return `${v > 0 ? '+' : ''}${fmtNumber(v, digits)}`;
}

function fmtPercent(v) { return v == null ? '—' : `${(v * 100).toFixed(1)}%`; }
function fmtPpDelta(v) { return v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)} pp`; }
function fmtMs(v) { return v == null ? '—' : `${v.toFixed(1)} ms`; }

function renderTable(columns, rows, { indent = '  ' } = {}) {
  if (!rows.length) return '';
  const formatted = rows.map((row) =>
    columns.map((col) => truncate((typeof col.get === 'function' ? col.get(row) : row[col.key]) ?? '—', col.maxWidth)),
  );
  const widths = columns.map((col, ci) =>
    Math.max(String(col.header).length, ...formatted.map((cells) => cells[ci].length)),
  );
  const header = columns.map((col, ci) => alignCell(col.header, widths[ci], col.align)).join('  ');
  const sep = columns.map((_, ci) => '-'.repeat(widths[ci])).join('  ');
  const body = formatted.map((cells) =>
    cells.map((cell, ci) => alignCell(cell, widths[ci], columns[ci].align)).join('  '),
  );
  return [indent + header, indent + sep, ...body.map((l) => indent + l)].join('\n');
}

function printTableSection(title, columns, rows, { limit = rows.length, noneMessage = 'None.' } = {}) {
  console.log(`\n${title}`);
  if (!rows.length) { console.log(`  ${noneMessage}`); return; }
  const visible = rows.slice(0, limit);
  console.log(renderTable(columns, visible));
  if (rows.length > visible.length) console.log(`  … ${rows.length - visible.length} more row(s) omitted`);
}

function statusIcon(s) { return s === 'solved' ? '✓' : s === 'partial' ? '~' : s === 'error' ? '✗' : '•'; }

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

function parseJsonArray(raw) { if (!raw) return []; try { return JSON.parse(raw); } catch { return []; } }
function parseNum(raw) { if (!raw) return null; const n = Number(raw); return Number.isFinite(n) ? n : null; }
function parseBool(raw) { return String(raw ?? '').trim().toLowerCase() === 'true'; }

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

function loadAppConfig() {
  return {
    output_roles: readJsonRelative('public/app_config/output_roles.json'),
    baseline_activity_anchors: readJsonRelative('public/app_config/baseline_activity_anchors.json'),
    demand_growth_presets: readJsonRelative('public/app_config/demand_growth_presets.json'),
    commodity_price_presets: readJsonRelative('public/app_config/commodity_price_presets.json'),
    explanation_tag_rules: readJsonRelative('public/app_config/explanation_tag_rules.json'),
  };
}

function loadPackage() {
  const csvText = readTextRelative('../aus_phase1_sector_state_library/data/sector_states.csv');
  const sectorStates = parseCsv(csvText).map(toSectorState);
  const appConfig = loadAppConfig();
  const normalizedRows = normalizeSolverRows({ sectorStates, appConfig });
  return {
    sectorStates, appConfig, normalizedRows,
    allOutputIds: uniqueSorted(Object.keys(appConfig.output_roles)),
  };
}

// ---------------------------------------------------------------------------
// Config loading / application
// ---------------------------------------------------------------------------

function resolveConfigReference(raw) {
  // If it looks like a file path, resolve it directly
  if (raw.endsWith('.json') || raw.includes('/') || raw.includes('\\') || raw.startsWith('.')) {
    const absPath = resolveCliPath(raw);
    if (!existsSync(absPath)) throw new UsageError(`Config file not found: ${raw}`);
    return absPath;
  }
  // Otherwise treat as a built-in id
  const builtinPath = new URL(`public/configurations/${raw}.json`, import.meta.url);
  try {
    const absPath = resolveCliPath(builtinPath.pathname);
    if (!existsSync(absPath)) throw new Error();
    return absPath;
  } catch {
    throw new UsageError(`Unknown built-in config "${raw}". Run "npx msm list" to see available configs.`);
  }
}

function getConfigId(config, fallback = null) {
  const id = config?.app_metadata?.id;
  return typeof id === 'string' && id.trim() ? id.trim() : fallback;
}

function getConfigIncludedOutputIds(config) {
  return normalizeOptionalStringArray(config?.app_metadata?.included_output_ids);
}

function validateConfig(config, label) {
  if (!isPlainObject(config)) throw new Error(`Invalid ${label}: expected a JSON object.`);
  if (typeof config.name !== 'string' || !config.name.trim()) throw new Error(`Invalid ${label}: missing string "name".`);
  if (!Array.isArray(config.years) || config.years.length === 0) throw new Error(`Invalid ${label}: missing array "years".`);
  if (!isPlainObject(config.service_controls)) throw new Error(`Invalid ${label}: missing object "service_controls".`);
  if (!isPlainObject(config.service_demands)) throw new Error(`Invalid ${label}: missing object "service_demands".`);
  if (!isPlainObject(config.demand_generation)) throw new Error(`Invalid ${label}: missing object "demand_generation".`);
  if (!isPlainObject(config.commodity_pricing)) throw new Error(`Invalid ${label}: missing object "commodity_pricing".`);
  if (!isPlainObject(config.carbon_price)) throw new Error(`Invalid ${label}: missing object "carbon_price".`);
  return config;
}

function loadConfig(absPath) {
  return validateConfig(readJsonFile(absPath, 'config'), `config ${displayPath(absPath)}`);
}

function listBuiltinConfigPaths() {
  const dir = new URL('public/configurations/', import.meta.url);
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json') && !file.startsWith('_'))
    .sort()
    .map((file) => resolveCliPath(new URL(`public/configurations/${file}`, import.meta.url).pathname));
}

function listBuiltinConfigs() {
  return listBuiltinConfigPaths().map((configPath) => loadConfig(configPath));
}

// ---------------------------------------------------------------------------
// Solve execution
// ---------------------------------------------------------------------------

function countDistinctOutputs(rows) { return new Set(rows.map((r) => r.outputId)).size; }

function countDiagnosticsBySeverity(result) {
  const c = { info: 0, warning: 0, error: 0 };
  for (const d of result.diagnostics) c[d.severity] += 1;
  return c;
}

function summarizeRun(run) {
  const c = countDiagnosticsBySeverity(run.result);
  return {
    status: run.result.status,
    lpStatus: run.result.raw?.solutionStatus ?? null,
    objectiveValue: run.result.raw?.objectiveValue ?? null,
    rowCount: run.request.rows.length,
    outputCount: run.result.summary?.outputCount ?? countDistinctOutputs(run.request.rows),
    variableCount: run.result.raw?.variableCount ?? 0,
    constraintCount: run.result.raw?.constraintCount ?? 0,
    diagnostics: c,
    bindingConstraintCount: run.result.reporting.bindingConstraints.length,
    softConstraintViolationCount: run.result.reporting.softConstraintViolations.length,
    timingsMs: { total: run.result.timingsMs.total, solve: run.result.timingsMs.solve },
  };
}

function executeConfig(pkg, configPath) {
  const config = loadConfig(configPath);
  const configId = getConfigId(config, basename(configPath, '.json'));
  const includedOutputIds = getConfigIncludedOutputIds(config);
  const scenario = resolveConfigurationDocument(config, pkg.appConfig, config.name);

  const request = buildSolveRequest(
    { sectorStates: pkg.sectorStates, appConfig: pkg.appConfig, defaultConfiguration: scenario },
    scenario,
    includedOutputIds ? { includedOutputIds } : {},
  );

  const result = solveWithLpAdapter(request);
  const run = {
    ok: true, label: configId, configId,
    source: displayPath(configPath),
    scenarioName: config.name,
    scenarioDescription: config.description ?? null,
    includedOutputIds: includedOutputIds ?? null,
    request, result,
  };
  run.metrics = summarizeRun(run);
  return run;
}


function executeSafe(pkg, configPath) {
  try {
    return executeConfig(pkg, configPath);
  } catch (e) {
    if (e instanceof UsageError) throw e;
    const label = displayPath(configPath);
    return { ok: false, label, source: label, error: { message: toErrorMessage(e) } };
  }
}

function runHasError(run) { return !run.ok || run.result.status === 'error'; }

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

function buildCommodityBalanceDiffs(leftRun, rightRun) {
  const leftMap = new Map(leftRun.result.reporting.commodityBalances.map((e) => [`${e.commodityId}::${e.year}`, e]));
  const rightMap = new Map(rightRun.result.reporting.commodityBalances.map((e) => [`${e.commodityId}::${e.year}`, e]));
  const keys = uniqueSorted([...leftMap.keys(), ...rightMap.keys()]);
  const rows = [];
  for (const key of keys) {
    const l = leftMap.get(key), r = rightMap.get(key);
    const row = {
      commodityId: r?.commodityId ?? l?.commodityId, year: r?.year ?? l?.year,
      leftMode: l?.mode ?? '—', rightMode: r?.mode ?? '—',
      supplyDelta: numericDelta(l?.supply, r?.supply, { defaultZero: true }),
      modeledDemandDelta: numericDelta(l?.modeledDemand, r?.modeledDemand, { defaultZero: true }),
      externalDemandDelta: numericDelta(l?.externalDemand, r?.externalDemand, { defaultZero: true }),
      totalDemandDelta: numericDelta(l?.totalDemand, r?.totalDemand, { defaultZero: true }),
      balanceGapDelta: numericDelta(l?.balanceGap, r?.balanceGap),
    };
    if (row.leftMode !== row.rightMode || hasMeaningfulChange(row.supplyDelta, row.modeledDemandDelta, row.externalDemandDelta, row.totalDemandDelta, row.balanceGapDelta)) {
      rows.push(row);
    }
  }
  return rows.sort((a, b) => Math.max(Math.abs(b.totalDemandDelta ?? 0), Math.abs(b.supplyDelta ?? 0)) - Math.max(Math.abs(a.totalDemandDelta ?? 0), Math.abs(a.supplyDelta ?? 0)));
}

function buildStateShareDiffs(leftRun, rightRun) {
  const leftMap = new Map(leftRun.result.reporting.stateShares.map((e) => [`${e.outputId}::${e.year}::${e.stateId}`, e]));
  const rightMap = new Map(rightRun.result.reporting.stateShares.map((e) => [`${e.outputId}::${e.year}::${e.stateId}`, e]));
  const keys = uniqueSorted([...leftMap.keys(), ...rightMap.keys()]);
  const rows = [];
  for (const key of keys) {
    const l = leftMap.get(key), r = rightMap.get(key);
    const row = {
      outputId: r?.outputId ?? l?.outputId, outputLabel: r?.outputLabel ?? l?.outputLabel,
      year: r?.year ?? l?.year, stateId: r?.stateId ?? l?.stateId, stateLabel: r?.stateLabel ?? l?.stateLabel,
      activityDelta: (r?.activity ?? 0) - (l?.activity ?? 0),
      shareDelta: (r?.share ?? 0) - (l?.share ?? 0),
      leftShare: l?.share ?? 0, rightShare: r?.share ?? 0,
    };
    if (hasMeaningfulChange(row.activityDelta, row.shareDelta)) rows.push(row);
  }
  return rows.sort((a, b) => Math.abs(b.shareDelta) - Math.abs(a.shareDelta) || Math.abs(b.activityDelta) - Math.abs(a.activityDelta));
}

function buildComparison(leftRun, rightRun) {
  const l = leftRun.metrics, r = rightRun.metrics;
  return {
    deltas: {
      objectiveValue: numericDelta(l.objectiveValue, r.objectiveValue),
      rowCount: numericDelta(l.rowCount, r.rowCount, { defaultZero: true }),
      outputCount: numericDelta(l.outputCount, r.outputCount, { defaultZero: true }),
      variableCount: numericDelta(l.variableCount, r.variableCount, { defaultZero: true }),
      constraintCount: numericDelta(l.constraintCount, r.constraintCount, { defaultZero: true }),
      totalMs: numericDelta(l.timingsMs.total, r.timingsMs.total),
      solveMs: numericDelta(l.timingsMs.solve, r.timingsMs.solve),
      diagnostics: {
        warning: numericDelta(l.diagnostics.warning, r.diagnostics.warning, { defaultZero: true }),
        error: numericDelta(l.diagnostics.error, r.diagnostics.error, { defaultZero: true }),
      },
      bindingConstraintCount: numericDelta(l.bindingConstraintCount, r.bindingConstraintCount, { defaultZero: true }),
    },
    commodityBalanceDiffs: buildCommodityBalanceDiffs(leftRun, rightRun),
    stateShareDiffs: buildStateShareDiffs(leftRun, rightRun),
  };
}

// ---------------------------------------------------------------------------
// Human output
// ---------------------------------------------------------------------------

function printSingleRun(run, pkg, { quiet = false } = {}) {
  if (!run.ok) {
    console.log(`\n✗ ${run.label}\n  Source: ${run.source}\n  Error:  ${run.error.message}\n`);
    return;
  }

  const m = run.metrics, c = m.diagnostics;

  if (quiet) {
    console.log(`${statusIcon(m.status)} ${run.label} | ${m.status} | objective ${fmtNumber(m.objectiveValue)} | rows ${m.rowCount} | outputs ${m.outputCount} | time ${fmtMs(m.timingsMs.total)} | warn ${c.warning} | err ${c.error}`);
    return;
  }

  console.log(`\n${statusIcon(m.status)} ${run.scenarioName}`);
  console.log(`  Source:        ${run.source}`);
  console.log(`  Status:        ${m.status} (LP: ${m.lpStatus ?? 'N/A'})`);
  console.log(`  Objective:     ${fmtNumber(m.objectiveValue)}`);
  console.log(`  Years:         ${run.request.configuration.years.join(', ')}`);
  if (run.includedOutputIds) {
    console.log(`  Scope:         ${run.includedOutputIds.length} seed outputs -> ${m.outputCount} resolved`);
    console.log(`  Seed outputs:  ${formatIdList(run.includedOutputIds)}`);
  } else {
    console.log(`  Scope:         full model (${m.outputCount} outputs)`);
  }
  console.log(`  Rows:          ${m.rowCount}`);
  console.log(`  Variables:     ${m.variableCount}`);
  console.log(`  Constraints:   ${m.constraintCount}`);
  console.log(`  Time:          ${fmtMs(m.timingsMs.total)} (solve ${fmtMs(m.timingsMs.solve)})`);
  console.log(`  Diagnostics:   info ${c.info} | warning ${c.warning} | error ${c.error}`);

  const issues = run.result.diagnostics
    .filter((d) => d.severity !== 'info')
    .map((d) => ({
      severity: d.severity, code: d.code,
      location: [d.outputId, d.year, d.stateId].filter(Boolean).join(' / ') || '—',
      message: d.message,
    }));

  printTableSection('Diagnostics', [
    { header: 'severity', key: 'severity', maxWidth: 8 },
    { header: 'code', key: 'code', maxWidth: 32 },
    { header: 'location', key: 'location', maxWidth: 40 },
    { header: 'message', key: 'message', maxWidth: 96 },
  ], issues, { limit: 50, noneMessage: 'No warning/error diagnostics.' });

  printTableSection('Commodity balances', [
    { header: 'commodity', key: 'commodity', maxWidth: 22 },
    { header: 'year', key: 'year', align: 'right' },
    { header: 'mode', key: 'mode', maxWidth: 14 },
    { header: 'supply', key: 'supply', align: 'right' },
    { header: 'modeled', key: 'modeled', align: 'right' },
    { header: 'external', key: 'external', align: 'right' },
    { header: 'total', key: 'total', align: 'right' },
    { header: 'gap', key: 'gap', align: 'right' },
  ], run.result.reporting.commodityBalances.map((e) => ({
    commodity: e.commodityId, year: e.year, mode: e.mode,
    supply: fmtNumber(e.supply), modeled: fmtNumber(e.modeledDemand),
    external: fmtNumber(e.externalDemand), total: fmtNumber(e.totalDemand),
    gap: fmtNumber(e.balanceGap),
  })), { noneMessage: 'No commodity balance rows.' });

  printTableSection('Active state shares', [
    { header: 'output', key: 'output', maxWidth: 30 },
    { header: 'year', key: 'year', align: 'right' },
    { header: 'state', key: 'state', maxWidth: 40 },
    { header: 'activity', key: 'activity', align: 'right' },
    { header: 'share', key: 'share', align: 'right' },
  ], run.result.reporting.stateShares
    .filter((e) => e.activity > 1e-6)
    .sort((a, b) => b.activity - a.activity)
    .map((e) => ({
      output: e.outputLabel, year: e.year, state: e.stateLabel,
      activity: fmtNumber(e.activity), share: fmtPercent(e.share),
    })),
  { limit: 25, noneMessage: 'No active state shares.' });

  printTableSection('Binding constraints', [
    { header: 'kind', key: 'kind', maxWidth: 18 },
    { header: 'location', key: 'location', maxWidth: 44 },
    { header: 'bound', key: 'bound', maxWidth: 20, align: 'right' },
    { header: 'actual', key: 'actual', align: 'right' },
    { header: 'slack', key: 'slack', align: 'right' },
    { header: 'message', key: 'message', maxWidth: 80 },
  ], [...run.result.reporting.bindingConstraints]
    .sort((a, b) => Math.abs(a.slack) - Math.abs(b.slack))
    .map((e) => ({
      kind: e.kind,
      location: [e.outputLabel, e.year, e.stateLabel].filter(Boolean).join(' / '),
      bound: `${e.boundType} ${fmtNumber(e.boundValue)}`,
      actual: fmtNumber(e.actualValue), slack: fmtNumber(e.slack), message: e.message,
    })),
  { limit: 15, noneMessage: 'No binding constraints reported.' });

  printTableSection('Soft-constraint violations', [
    { header: 'kind', key: 'kind', maxWidth: 18 },
    { header: 'location', key: 'location', maxWidth: 44 },
    { header: 'bound', key: 'bound', maxWidth: 20, align: 'right' },
    { header: 'actual', key: 'actual', align: 'right' },
    { header: 'slack', key: 'slack', align: 'right' },
    { header: 'penalty', key: 'penalty', align: 'right' },
  ], [...run.result.reporting.softConstraintViolations]
    .sort((a, b) => (b.totalPenalty ?? 0) - (a.totalPenalty ?? 0))
    .map((e) => ({
      kind: e.kind,
      location: [e.outputLabel, e.year, e.stateLabel].filter(Boolean).join(' / '),
      bound: `${e.boundType} ${fmtNumber(e.boundValue)}`,
      actual: fmtNumber(e.actualValue), slack: fmtNumber(e.slack), penalty: fmtNumber(e.totalPenalty),
    })),
  { limit: 15, noneMessage: 'No soft-constraint violations.' });

  console.log();
}

function printBatch(runs, { quiet = false } = {}) {
  const summary = { total: runs.length, solved: 0, partial: 0, error: 0, failed: 0 };
  for (const run of runs) {
    if (!run.ok) summary.failed += 1;
    else summary[run.result.status] += 1;
  }
  console.log(`\nBatch results`);
  console.log(`  total ${summary.total} | solved ${summary.solved} | partial ${summary.partial} | error ${summary.error} | failed ${summary.failed}`);

  console.log(renderTable([
    { header: 'config', key: 'config', maxWidth: 28 },
    { header: 'status', key: 'status', maxWidth: 8 },
    { header: 'outputs', key: 'outputs', align: 'right' },
    { header: 'rows', key: 'rows', align: 'right' },
    { header: 'objective', key: 'objective', align: 'right' },
    { header: 'time', key: 'time', align: 'right' },
    { header: 'warn', key: 'warn', align: 'right' },
    { header: 'err', key: 'err', align: 'right' },
    { header: 'name', key: 'name', maxWidth: quiet ? 48 : 72 },
  ], runs.map((run) => {
    if (!run.ok) return { config: run.label, status: 'failed', outputs: '—', rows: '—', objective: '—', time: '—', warn: '—', err: '—', name: run.error.message };
    return {
      config: run.label, status: run.result.status,
      outputs: String(run.metrics.outputCount), rows: String(run.metrics.rowCount),
      objective: fmtNumber(run.metrics.objectiveValue), time: fmtMs(run.metrics.timingsMs.total),
      warn: String(run.metrics.diagnostics.warning), err: String(run.metrics.diagnostics.error),
      name: run.scenarioName,
    };
  })));
  console.log();
}

function printComparison(leftRun, rightRun, comparison, { quiet = false } = {}) {
  console.log(`\nComparison (right − left)`);
  console.log(`  Left:  ${leftRun.source}`);
  console.log(`  Right: ${rightRun.source}`);

  if (!leftRun.ok || !rightRun.ok) {
    if (!leftRun.ok) console.log(`  Left failed:  ${leftRun.error.message}`);
    if (!rightRun.ok) console.log(`  Right failed: ${rightRun.error.message}`);
    console.log();
    return;
  }

  const l = leftRun.metrics, r = rightRun.metrics;
  console.log(renderTable([
    { header: 'metric', key: 'metric', maxWidth: 22 },
    { header: 'left', key: 'left', maxWidth: 20, align: 'right' },
    { header: 'right', key: 'right', maxWidth: 20, align: 'right' },
    { header: 'delta', key: 'delta', maxWidth: 20, align: 'right' },
  ], [
    { metric: 'status', left: l.status, right: r.status, delta: '—' },
    { metric: 'lp status', left: l.lpStatus ?? '—', right: r.lpStatus ?? '—', delta: '—' },
    { metric: 'objective', left: fmtNumber(l.objectiveValue), right: fmtNumber(r.objectiveValue), delta: fmtDelta(comparison.deltas.objectiveValue) },
    { metric: 'rows', left: String(l.rowCount), right: String(r.rowCount), delta: fmtDelta(comparison.deltas.rowCount) },
    { metric: 'outputs', left: String(l.outputCount), right: String(r.outputCount), delta: fmtDelta(comparison.deltas.outputCount) },
    { metric: 'variables', left: String(l.variableCount), right: String(r.variableCount), delta: fmtDelta(comparison.deltas.variableCount) },
    { metric: 'constraints', left: String(l.constraintCount), right: String(r.constraintCount), delta: fmtDelta(comparison.deltas.constraintCount) },
    { metric: 'time (total)', left: fmtMs(l.timingsMs.total), right: fmtMs(r.timingsMs.total), delta: fmtDelta(comparison.deltas.totalMs) },
    { metric: 'time (solve)', left: fmtMs(l.timingsMs.solve), right: fmtMs(r.timingsMs.solve), delta: fmtDelta(comparison.deltas.solveMs) },
    { metric: 'warnings', left: String(l.diagnostics.warning), right: String(r.diagnostics.warning), delta: fmtDelta(comparison.deltas.diagnostics.warning) },
    { metric: 'errors', left: String(l.diagnostics.error), right: String(r.diagnostics.error), delta: fmtDelta(comparison.deltas.diagnostics.error) },
    { metric: 'binding constraints', left: String(l.bindingConstraintCount), right: String(r.bindingConstraintCount), delta: fmtDelta(comparison.deltas.bindingConstraintCount) },
  ]));

  if (quiet) { console.log(); return; }

  printTableSection('Commodity balance deltas', [
    { header: 'commodity', key: 'commodityId', maxWidth: 22 },
    { header: 'year', key: 'year', align: 'right' },
    { header: 'leftMode', key: 'leftMode', maxWidth: 12 },
    { header: 'rightMode', key: 'rightMode', maxWidth: 12 },
    { header: 'dSupply', key: 'dSupply', align: 'right' },
    { header: 'dModeled', key: 'dModeled', align: 'right' },
    { header: 'dExternal', key: 'dExternal', align: 'right' },
    { header: 'dTotal', key: 'dTotal', align: 'right' },
  ], comparison.commodityBalanceDiffs.map((e) => ({
    commodityId: e.commodityId, year: e.year, leftMode: e.leftMode, rightMode: e.rightMode,
    dSupply: fmtDelta(e.supplyDelta), dModeled: fmtDelta(e.modeledDemandDelta),
    dExternal: fmtDelta(e.externalDemandDelta), dTotal: fmtDelta(e.totalDemandDelta),
  })), { limit: 25, noneMessage: 'No commodity balance changes.' });

  printTableSection('State-share deltas', [
    { header: 'output', key: 'outputLabel', maxWidth: 30 },
    { header: 'year', key: 'year', align: 'right' },
    { header: 'state', key: 'stateLabel', maxWidth: 36 },
    { header: 'leftShare', key: 'leftShare', align: 'right' },
    { header: 'rightShare', key: 'rightShare', align: 'right' },
    { header: 'dShare', key: 'dShare', align: 'right' },
    { header: 'dActivity', key: 'dActivity', align: 'right' },
  ], comparison.stateShareDiffs.map((e) => ({
    outputLabel: e.outputLabel, year: e.year, stateLabel: e.stateLabel,
    leftShare: fmtPercent(e.leftShare), rightShare: fmtPercent(e.rightShare),
    dShare: fmtPpDelta(e.shareDelta), dActivity: fmtDelta(e.activityDelta),
  })), { limit: 25, noneMessage: 'No state-share changes.' });

  console.log();
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseCli(argv) {
  let command = 'solve';
  const positionals = [];
  let json = false, quiet = false, all = false;

  let i = 0;
  // Check for subcommand
  if (argv[0] === 'compare') { command = 'compare'; i = 1; }
  else if (argv[0] === 'list') { command = 'list'; i = 1; }

  for (; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') return { command: 'help' };
    if (arg === '--json') { json = true; continue; }
    if (arg === '--quiet') { quiet = true; continue; }
    if (arg === '--all') { all = true; continue; }
    if (arg === '--list-configs') { command = 'list'; continue; }
    if (arg.startsWith('-')) throw new UsageError(`Unknown option: ${arg}`);
    positionals.push(arg);
  }

  if (json) quiet = false;

  if (command === 'help') return { command };
  if (command === 'list') {
    if (positionals.length) throw new UsageError('list does not accept positional arguments.');
    return { command, json, quiet };
  }

  if (command === 'compare') {
    if (all) throw new UsageError('--all cannot be used with compare.');
    if (positionals.length !== 2) throw new UsageError('compare requires exactly two config arguments.');
    return {
      command, json, quiet,
      left: resolveConfigReference(positionals[0]),
      right: resolveConfigReference(positionals[1]),
    };
  }

  // solve
  if (all) {
    if (positionals.length) throw new UsageError('--all cannot be combined with positional config arguments.');
    return { command: 'batch', json, quiet };
  }

  if (positionals.length === 0) throw new UsageError('A config argument is required. Run "npx msm list" to see built-in configs.');
  if (positionals.length === 1) return { command: 'solve', json, quiet, config: resolveConfigReference(positionals[0]) };

  return {
    command: 'batch', json, quiet,
    configs: positionals.map((p) => resolveConfigReference(p)),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(argv) {
  const cli = parseCli(argv);

  if (cli.command === 'help') {
    console.log(`\n${HELP_TEXT}\n`);
    return EXIT_OK;
  }

  const pkg = loadPackage();

  if (cli.command === 'list') {
    const configs = listBuiltinConfigs();
    if (cli.json) {
      console.log(JSON.stringify(configs.map((config) => ({
        id: getConfigId(config),
        name: config.name,
        description: config.description ?? null,
        includedOutputIds: getConfigIncludedOutputIds(config) ?? null,
      })), null, 2));
    } else {
      console.log(`\nBuilt-in configurations`);
      console.log(renderTable([
        { header: 'id', key: 'id', maxWidth: 28 },
        { header: 'name', key: 'name', maxWidth: 36 },
        { header: 'scope', key: 'scope', maxWidth: 18 },
        { header: 'outputs', key: 'outputs', maxWidth: 64 },
      ], configs.map((config, index) => {
        const includedOutputIds = getConfigIncludedOutputIds(config);
        return {
          id: getConfigId(config, basename(listBuiltinConfigPaths()[index], '.json')),
          name: config.name,
          scope: includedOutputIds ? `${includedOutputIds.length} outputs` : 'full model',
          outputs: formatIdList(includedOutputIds ?? pkg.allOutputIds, 8),
        };
      })));
      console.log();
    }
    return EXIT_OK;
  }

  if (cli.command === 'solve') {
    const run = executeSafe(pkg, cli.config);
    if (cli.json) { console.log(JSON.stringify(run, null, 2)); }
    else { printSingleRun(run, pkg, { quiet: cli.quiet }); }
    return runHasError(run) ? EXIT_ERROR : EXIT_OK;
  }

  if (cli.command === 'batch') {
    const configPaths = cli.configs ?? listBuiltinConfigPaths();
    const runs = configPaths.map((p) => executeSafe(pkg, p));
    if (cli.json) { console.log(JSON.stringify({ runs }, null, 2)); }
    else { printBatch(runs, { quiet: cli.quiet }); }
    return runs.some(runHasError) ? EXIT_ERROR : EXIT_OK;
  }

  if (cli.command === 'compare') {
    const leftRun = executeSafe(pkg, cli.left);
    const rightRun = executeSafe(pkg, cli.right);
    const comparison = leftRun.ok && rightRun.ok ? buildComparison(leftRun, rightRun) : null;
    if (cli.json) { console.log(JSON.stringify({ left: leftRun, right: rightRun, comparison }, null, 2)); }
    else { printComparison(leftRun, rightRun, comparison, { quiet: cli.quiet }); }
    return (runHasError(leftRun) || runHasError(rightRun)) ? EXIT_ERROR : EXIT_OK;
  }

  return EXIT_OK;
}

let exitCode = EXIT_OK;
try {
  exitCode = main(process.argv.slice(2));
} catch (e) {
  if (e instanceof UsageError) {
    console.error(`\nUsage error: ${e.message}\n\n${HELP_TEXT}\n`);
    exitCode = EXIT_USAGE;
  } else {
    console.error(`\nError: ${toErrorMessage(e)}\n`);
    exitCode = EXIT_ERROR;
  }
}
process.exitCode = exitCode;
