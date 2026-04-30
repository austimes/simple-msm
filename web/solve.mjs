#!/usr/bin/env tsx
/**
 * CLI solver — runs the model outside the browser using the same package,
 * configuration, and solve paths as the web app.
 *
 * Usage:
 *   bun run msm <config>                       # solve one config
 *   bun run msm <config> <config> ...          # batch solve
 *   bun run msm compare <config> <config>      # compare two configs
 *   bun run msm list                           # list built-in configs
 *   bun run msm --all                          # batch solve all built-ins
 *
 * A <config> is a file path (e.g. ./my-config.json) or a built-in id
 * (e.g. steel-optimize). Built-in ids resolve to src/configurations/<id>.json.
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
import { relative as relativePath } from 'node:path';
import {
  listCliConfigurations,
  materializeConfigurationForRuntime,
  resolveCliConfigurationReference,
} from './src/cli/configurationRefs.mjs';
import { validateAdditionalityPair } from './src/additionality/additionalityAnalysis.ts';
import { resolveWorkspacePair } from './src/data/configurationPairModel.ts';
import { loadPackage } from './src/data/packageLoader.ts';
import { runScenario } from './src/results/runScenario.ts';

const EXIT_OK = 0;
const EXIT_ERROR = 1;
const EXIT_USAGE = 2;
const EPSILON = 1e-9;

class UsageError extends Error {
  constructor(message) { super(message); this.name = 'UsageError'; }
}

const HELP_TEXT = `
Usage:
  bun run msm <config>                 Solve one config
  bun run msm <config> <config> ...    Batch solve multiple configs
  bun run msm compare <config> <config> Compare two config runs
  bun run msm prime <config>           Emit AI-oriented run context as JSON
  bun run msm list                     List built-in and user configs
  bun run msm --all                    Batch solve all built-ins

A <config> can be:
  - a built-in id (for example reference-baseline)
  - a user config id via user:<id>
  - a JSON file path

Built-ins resolve from src/configurations/*.json. User configs resolve from
src/configurations/user/*.json. Scope is derived dynamically from active pathways.

Options:
  --json          Machine-readable JSON output
  --quiet         Summary-only output
  --all           Solve every built-in config
  --base <config> Optional comparison base for prime
  --solver-only   Exclude residual overlay contributions (raw LP output only)
  -h, --help      Show this help

Exit codes: 0 = success, 1 = solve/runtime error, 2 = usage error
`.trim();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toErrorMessage(e) { return e instanceof Error ? e.message : String(e); }

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => String(a).localeCompare(String(b)));
}

function displayPath(absPath) {
  const rel = relativePath(process.cwd(), absPath);
  return rel && !rel.startsWith('..') ? rel : absPath;
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
// Solve execution
// ---------------------------------------------------------------------------

function displaySource(selection) {
  return selection.sourcePath ? displayPath(selection.sourcePath) : selection.canonicalRef;
}

function listAvailableConfigurations() {
  return listCliConfigurations();
}

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

function executeConfig(pkg, selection, { solverOnly = false } = {}) {
  const config = structuredClone(selection.configuration);
  const configId = selection.configId ?? selection.canonicalRef;
  const configuration = materializeConfigurationForRuntime(config, pkg);

  const snapshot = runScenario(pkg, configuration, { includeOverlays: !solverOnly });

  const run = {
    ok: true, label: configId, configId,
    ref: selection.canonicalRef,
    sourceKind: selection.sourceKind,
    source: displaySource(selection),
    configurationName: config.name,
    configurationDescription: config.description ?? null,
    configuration,
    request: snapshot.request, result: snapshot.result,
    contributions: snapshot.contributions,
    solverOnly,
  };
  run.metrics = summarizeRun(run);
  return run;
}


function executeSafe(pkg, selection, { solverOnly = false } = {}) {
  try {
    return executeConfig(pkg, selection, { solverOnly });
  } catch (e) {
    if (e instanceof UsageError) throw e;
    const label = selection?.configId ?? selection?.canonicalRef ?? selection?.requestedRef ?? 'config';
    return {
      ok: false,
      label,
      ref: selection?.canonicalRef ?? selection?.requestedRef ?? label,
      sourceKind: selection?.sourceKind ?? 'file',
      source: selection ? displaySource(selection) : label,
      error: { message: toErrorMessage(e) },
    };
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

function buildMethodShareDiffs(leftRun, rightRun) {
  const leftMap = new Map(leftRun.result.reporting.methodShares.map((e) => [`${e.outputId}::${e.year}::${e.methodId}`, e]));
  const rightMap = new Map(rightRun.result.reporting.methodShares.map((e) => [`${e.outputId}::${e.year}::${e.methodId}`, e]));
  const keys = uniqueSorted([...leftMap.keys(), ...rightMap.keys()]);
  const rows = [];
  for (const key of keys) {
    const l = leftMap.get(key), r = rightMap.get(key);
    const row = {
      outputId: r?.outputId ?? l?.outputId, outputLabel: r?.outputLabel ?? l?.outputLabel,
      year: r?.year ?? l?.year, methodId: r?.methodId ?? l?.methodId, methodLabel: r?.methodLabel ?? l?.methodLabel,
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
    stateShareDiffs: buildMethodShareDiffs(leftRun, rightRun),
  };
}

function quoteCliArg(value) {
  return JSON.stringify(String(value));
}

function buildPrimeNextActions(run) {
  if (!run.ok) {
    return [];
  }

  const severityRank = { error: 0, warning: 1, info: 2 };
  const deduped = new Map();

  for (const diagnostic of run.result.diagnostics) {
    if (!diagnostic.suggestion) {
      continue;
    }

    const key = [
      diagnostic.suggestion,
      diagnostic.outputId ?? '',
      diagnostic.year ?? '',
      diagnostic.methodId ?? '',
      (diagnostic.relatedConstraintIds ?? []).join(','),
    ].join('::');

    if (deduped.has(key)) {
      continue;
    }

    deduped.set(key, {
      priority: severityRank[diagnostic.severity] ?? 3,
      severity: diagnostic.severity,
      code: diagnostic.code,
      reason: diagnostic.message,
      suggestion: diagnostic.suggestion,
      location: {
        ...(diagnostic.outputId ? { outputId: diagnostic.outputId } : {}),
        ...(diagnostic.year != null ? { year: diagnostic.year } : {}),
        ...(diagnostic.methodId ? { methodId: diagnostic.methodId } : {}),
      },
      supportingConstraintIds: diagnostic.relatedConstraintIds ?? [],
    });
  }

  return [...deduped.values()]
    .sort((left, right) => left.priority - right.priority || left.reason.localeCompare(right.reason));
}

function buildPrimeSolveSummary(run) {
  if (!run.ok) {
    return {
      status: 'failed',
      error: run.error.message,
    };
  }

  const commodityFindings = [...run.result.reporting.commodityBalances]
    .sort((left, right) => Math.abs(right.balanceGap ?? 0) - Math.abs(left.balanceGap ?? 0))
    .slice(0, 10);
  const methodShares = [...run.result.reporting.methodShares]
    .filter((entry) => entry.activity > 1e-6)
    .sort((left, right) => right.activity - left.activity)
    .slice(0, 10);

  return {
    status: run.result.status,
    lpStatus: run.metrics.lpStatus,
    objectiveValue: run.metrics.objectiveValue,
    timingsMs: run.metrics.timingsMs,
    summary: {
      rowCount: run.metrics.rowCount,
      outputCount: run.metrics.outputCount,
      variableCount: run.metrics.variableCount,
      constraintCount: run.metrics.constraintCount,
      diagnostics: run.metrics.diagnostics,
      bindingConstraintCount: run.metrics.bindingConstraintCount,
      softConstraintViolationCount: run.metrics.softConstraintViolationCount,
    },
    topDiagnostics: run.result.diagnostics.filter((diagnostic) => diagnostic.severity !== 'info').slice(0, 12),
    topBindingConstraints: run.result.reporting.bindingConstraints.slice(0, 12),
    topSoftConstraintViolations: run.result.reporting.softConstraintViolations.slice(0, 12),
    topCommodityBalanceFindings: commodityFindings,
    topMethodShares: methodShares,
  };
}

function buildPrimePayload(pkg, focusSelection, focusRun, { baseSelection = null, baseRun = null, comparison = null } = {}) {
  const payload = {
    kind: 'msm.prime',
    version: 1,
    generatedAt: new Date().toISOString(),
    package: {
      solverContractVersion: focusRun.ok ? focusRun.request.contractVersion : null,
      relevantDocs: [
        'README.md',
        'web/README.md',
        'web/solve.mjs',
        'web/src/data/packageLoader.ts',
        'web/src/data/configurationDocumentLoader.ts',
        'web/src/results/runScenario.ts',
      ],
      workflowNotes: [
        'Built-in configs live in web/src/configurations/*.json.',
        'Repo-backed user configs live in web/src/configurations/user/*.json and can be addressed as user:<id>.',
        'Browser-local drafts are not visible to the CLI; save a user config or export the JSON document first.',
      ],
    },
    focus: {
      ref: focusSelection.canonicalRef,
      sourceKind: focusSelection.sourceKind,
      configId: focusSelection.configId,
      readonly: focusSelection.readonly,
      source: displaySource(focusSelection),
      configuration: focusRun.ok ? focusRun.configuration : structuredClone(focusSelection.configuration),
    },
    solve: buildPrimeSolveSummary(focusRun),
    nextActions: buildPrimeNextActions(focusRun),
    reproduce: {
      workdir: 'web',
      solveCommand: `bun run msm ${quoteCliArg(focusSelection.canonicalRef)} --json`,
    },
  };

  if (baseSelection && baseRun && baseRun.ok && focusRun.ok) {
    const workspacePair = resolveWorkspacePair({
      activeConfigurationId: baseSelection.configId,
      baseSelectionMode: 'manual',
      configurationsById: baseSelection.configId
        ? { [baseSelection.configId]: baseRun.configuration }
        : {},
      focusConfiguration: focusRun.configuration,
      focusConfigId: focusSelection.configId,
      selectedBaseConfigId: baseSelection.configId,
    });

    payload.base = {
      ref: baseSelection.canonicalRef,
      sourceKind: baseSelection.sourceKind,
      configId: baseSelection.configId,
      readonly: baseSelection.readonly,
      source: displaySource(baseSelection),
      configuration: baseRun.configuration,
      commonYears: workspacePair.commonYears,
      efficiencyAttributionSafe: workspacePair.efficiencyAttributionSafe,
      validationIssues: validateAdditionalityPair(baseRun.configuration, focusRun.configuration, pkg),
    };
    payload.comparison = comparison;
    payload.reproduce.compareCommand = `bun run msm compare ${quoteCliArg(baseSelection.canonicalRef)} ${quoteCliArg(focusSelection.canonicalRef)} --json`;
  }

  return payload;
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

  console.log(`\n${statusIcon(m.status)} ${run.configurationName}`);
  console.log(`  Source:        ${run.source}`);
  console.log(`  Status:        ${m.status} (LP: ${m.lpStatus ?? 'N/A'})`);
  console.log(`  Objective:     ${fmtNumber(m.objectiveValue)}`);
  console.log(`  Years:         ${run.request.configuration.years.join(', ')}`);
  console.log(`  Scope:         ${m.outputCount} outputs`);
  console.log(`  Rows:          ${m.rowCount}`);
  console.log(`  Variables:     ${m.variableCount}`);
  console.log(`  Constraints:   ${m.constraintCount}`);
  console.log(`  Time:          ${fmtMs(m.timingsMs.total)} (solve ${fmtMs(m.timingsMs.solve)})`);
  console.log(`  Diagnostics:   info ${c.info} | warning ${c.warning} | error ${c.error}`);

  const issues = run.result.diagnostics
    .filter((d) => d.severity !== 'info')
    .map((d) => ({
      severity: d.severity, code: d.code,
      location: [d.outputId, d.year, d.methodId].filter(Boolean).join(' / ') || '—',
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
  ], run.result.reporting.methodShares
    .filter((e) => e.activity > 1e-6)
    .sort((a, b) => b.activity - a.activity)
    .map((e) => ({
      output: e.outputLabel, year: e.year, state: e.methodLabel,
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
      location: [e.outputLabel, e.year, e.methodLabel].filter(Boolean).join(' / '),
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
      location: [e.outputLabel, e.year, e.methodLabel].filter(Boolean).join(' / '),
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
      name: run.configurationName,
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
    { header: 'state', key: 'methodLabel', maxWidth: 36 },
    { header: 'leftShare', key: 'leftShare', align: 'right' },
    { header: 'rightShare', key: 'rightShare', align: 'right' },
    { header: 'dShare', key: 'dShare', align: 'right' },
    { header: 'dActivity', key: 'dActivity', align: 'right' },
  ], comparison.stateShareDiffs.map((e) => ({
    outputLabel: e.outputLabel, year: e.year, methodLabel: e.methodLabel,
    leftShare: fmtPercent(e.leftShare), rightShare: fmtPercent(e.rightShare),
    dShare: fmtPpDelta(e.shareDelta), dActivity: fmtDelta(e.activityDelta),
  })), { limit: 25, noneMessage: 'No state-share changes.' });

  console.log();
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function resolveSelectionOrUsageError(rawRef) {
  try {
    return resolveCliConfigurationReference(rawRef);
  } catch (e) {
    throw new UsageError(toErrorMessage(e));
  }
}

function parseCli(argv) {
  let command = 'solve';
  const positionals = [];
  let json = false, quiet = false, all = false, solverOnly = false;
  let base = null;

  let i = 0;
  // Check for subcommand
  if (argv[0] === 'compare') { command = 'compare'; i = 1; }
  else if (argv[0] === 'list') { command = 'list'; i = 1; }
  else if (argv[0] === 'prime') { command = 'prime'; i = 1; }

  for (; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') return { command: 'help' };
    if (arg === '--json') { json = true; continue; }
    if (arg === '--quiet') { quiet = true; continue; }
    if (arg === '--all') { all = true; continue; }
    if (arg === '--solver-only') { solverOnly = true; continue; }
    if (arg === '--list-configs') { command = 'list'; continue; }
    if (arg === '--base') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        throw new UsageError('--base requires a config argument.');
      }
      base = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('-')) throw new UsageError(`Unknown option: ${arg}`);
    positionals.push(arg);
  }

  if (json) quiet = false;

  if (command === 'help') return { command };
  if (command === 'list') {
    if (all) throw new UsageError('--all cannot be used with list.');
    if (base) throw new UsageError('--base can only be used with prime.');
    if (positionals.length) throw new UsageError('list does not accept positional arguments.');
    return { command, json, quiet };
  }

  if (command === 'compare') {
    if (all) throw new UsageError('--all cannot be used with compare.');
    if (base) throw new UsageError('--base can only be used with prime.');
    if (positionals.length !== 2) throw new UsageError('compare requires exactly two config arguments.');
    return {
      command, json, quiet, solverOnly,
      left: resolveSelectionOrUsageError(positionals[0]),
      right: resolveSelectionOrUsageError(positionals[1]),
    };
  }

  if (command === 'prime') {
    if (all) throw new UsageError('--all cannot be used with prime.');
    if (positionals.length !== 1) throw new UsageError('prime requires exactly one focus config argument.');
    return {
      command,
      focus: resolveSelectionOrUsageError(positionals[0]),
      base: base ? resolveSelectionOrUsageError(base) : null,
      solverOnly,
    };
  }

  // solve
  if (all) {
    if (base) throw new UsageError('--base can only be used with prime.');
    if (positionals.length) throw new UsageError('--all cannot be combined with positional config arguments.');
    return { command: 'batch', json, quiet, solverOnly };
  }

  if (base) throw new UsageError('--base can only be used with prime.');
  if (positionals.length === 0) throw new UsageError('A config argument is required. Run "bun run msm list" to see available configs.');
  if (positionals.length === 1) return { command: 'solve', json, quiet, solverOnly, config: resolveSelectionOrUsageError(positionals[0]) };

  return {
    command: 'batch', json, quiet, solverOnly,
    configs: positionals.map((p) => resolveSelectionOrUsageError(p)),
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
    const configs = listAvailableConfigurations();
    if (cli.json) {
      console.log(JSON.stringify(configs.map((entry) => ({
        ref: entry.canonicalRef,
        id: entry.configId,
        sourceKind: entry.sourceKind,
        readonly: entry.readonly,
        source: entry.sourcePath ? displayPath(entry.sourcePath) : entry.canonicalRef,
        name: entry.configuration.name,
        description: entry.configuration.description ?? null,
      })), null, 2));
    } else {
      console.log(`\nAvailable configurations`);
      console.log(renderTable([
        { header: 'ref', key: 'ref', maxWidth: 30 },
        { header: 'source', key: 'sourceKind', maxWidth: 8 },
        { header: 'name', key: 'name', maxWidth: 48 },
      ], configs.map((entry) => ({
        ref: entry.canonicalRef,
        sourceKind: entry.sourceKind,
        name: entry.configuration.name,
      }))));
      console.log();
    }
    return EXIT_OK;
  }

  const solveOpts = { solverOnly: cli.solverOnly ?? false };

  if (cli.command === 'solve') {
    const run = executeSafe(pkg, cli.config, solveOpts);
    if (cli.json) { console.log(JSON.stringify(run, null, 2)); }
    else { printSingleRun(run, pkg, { quiet: cli.quiet }); }
    return runHasError(run) ? EXIT_ERROR : EXIT_OK;
  }

  if (cli.command === 'batch') {
    const selections = cli.configs ?? listAvailableConfigurations().filter((entry) => entry.sourceKind === 'builtin');
    const runs = selections.map((selection) => executeSafe(pkg, selection, solveOpts));
    if (cli.json) { console.log(JSON.stringify({ runs }, null, 2)); }
    else { printBatch(runs, { quiet: cli.quiet }); }
    return runs.some(runHasError) ? EXIT_ERROR : EXIT_OK;
  }

  if (cli.command === 'compare') {
    const leftRun = executeSafe(pkg, cli.left, solveOpts);
    const rightRun = executeSafe(pkg, cli.right, solveOpts);
    const comparison = leftRun.ok && rightRun.ok ? buildComparison(leftRun, rightRun) : null;
    if (cli.json) { console.log(JSON.stringify({ left: leftRun, right: rightRun, comparison }, null, 2)); }
    else { printComparison(leftRun, rightRun, comparison, { quiet: cli.quiet }); }
    return (runHasError(leftRun) || runHasError(rightRun)) ? EXIT_ERROR : EXIT_OK;
  }

  if (cli.command === 'prime') {
    const focusRun = executeSafe(pkg, cli.focus, solveOpts);
    const baseRun = cli.base ? executeSafe(pkg, cli.base, solveOpts) : null;
    const comparison = baseRun?.ok && focusRun.ok ? buildComparison(baseRun, focusRun) : null;
    const payload = buildPrimePayload(pkg, cli.focus, focusRun, {
      baseSelection: cli.base,
      baseRun,
      comparison,
    });
    console.log(JSON.stringify(payload, null, 2));
    return runHasError(focusRun) || (baseRun ? runHasError(baseRun) : false) ? EXIT_ERROR : EXIT_OK;
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
