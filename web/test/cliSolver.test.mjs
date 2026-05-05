import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  listCliConfigurations,
  materializeConfigurationForRuntime,
  resolveCliConfigurationReference,
} from '../src/cli/configurationRefs.mjs';
import { loadPackage } from '../src/data/packageLoader.ts';
import { runScenario } from '../src/results/runScenario.ts';

const WEB_DIR = fileURLToPath(new URL('..', import.meta.url));
const USER_CONFIG_DIR = fileURLToPath(new URL('../src/configurations/user/', import.meta.url));

function runCli(args) {
  const result = spawnSync('bun', ['./solve.mjs', ...args], {
    cwd: WEB_DIR,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}


test('CLI exposes residential water-heating pathway-vs-technology comparison evidence', () => {
  const output = JSON.parse(runCli(['water-heating-comparison', '--json']));

  assert.equal(output.rows.length, 2);

  const incumbent = output.rows.find((row) => row.year === 2025);
  assert.ok(incumbent);
  assert.equal(incumbent.technology_solution_basis, 'calibrated_2025_incumbent_mix');
  assert.equal(Object.keys(incumbent.technology_method_shares).length, 4);
  assert.ok(Math.abs(
    Object.values(incumbent.technology_method_shares).reduce((sum, share) => sum + share, 0) - 1,
  ) < 1e-9);

  const heatPumpProxy = output.rows.find((row) => row.year === 2050);
  assert.ok(heatPumpProxy);
  assert.deepEqual(heatPumpProxy.technology_method_shares, {
    buildings__residential_water_heating__electric_heat_pump: 1,
  });
  assert.equal(heatPumpProxy.validation_status, 'evidence_only');

  const humanOutput = runCli(['water-heating-comparison']);
  assert.match(humanOutput, /Residential water-heating pathway-vs-technology comparison/);
  assert.match(humanOutput, /Evidence only/);
});

test('prime returns the same materialized configuration the runtime solves', () => {
  const output = JSON.parse(runCli(['prime', 'reference-baseline']));
  const pkg = loadPackage();
  const selection = resolveCliConfigurationReference('reference-baseline');
  const expected = materializeConfigurationForRuntime(selection.configuration, pkg);

  assert.equal(output.kind, 'msm.prime');
  assert.equal(output.version, 1);
  assert.equal(output.focus.ref, 'reference-baseline');
  assert.deepEqual(output.focus.configuration, expected);
  assert.equal(output.reproduce.workdir, 'web');
  assert.match(output.reproduce.solveCommand, /bun run msm/);
});

test('list exposes user configuration refs when repo-backed user configs are present', () => {
  mkdirSync(USER_CONFIG_DIR, { recursive: true });
  const selection = resolveCliConfigurationReference('reference-baseline');
  const tempConfigId = 'tmp-cli-user-config';
  const tempFile = path.join(USER_CONFIG_DIR, `${tempConfigId}.json`);
  const tempConfiguration = structuredClone(selection.configuration);
  tempConfiguration.name = 'Temporary CLI user config';
  tempConfiguration.app_metadata = {
    ...(tempConfiguration.app_metadata ?? {}),
    id: tempConfigId,
    readonly: false,
  };

  writeFileSync(tempFile, JSON.stringify(tempConfiguration, null, 2) + '\n');

  try {
    const output = JSON.parse(runCli(['list', '--json']));

    assert.ok(output.some((entry) => entry.ref === 'reference-baseline' && entry.sourceKind === 'builtin'));
    assert.ok(output.some((entry) => entry.ref === `user:${tempConfigId}` && entry.sourceKind === 'user'));
  } finally {
    rmSync(tempFile, { force: true });
  }
});

test('prime can include base comparison context for agent workflows', () => {
  const output = JSON.parse(runCli(['prime', 'reference-efficiency-open', '--base', 'reference-baseline']));

  assert.equal(output.base.ref, 'reference-baseline');
  assert.equal(typeof output.base.efficiencyAttributionSafe, 'boolean');
  assert.ok(Array.isArray(output.base.validationIssues));
  assert.ok(output.comparison);
  assert.match(output.reproduce.compareCommand, /compare/);
});

test('all listed CLI configurations materialize and solve through the shared runtime path', () => {
  const pkg = loadPackage();

  for (const entry of listCliConfigurations()) {
    const configuration = materializeConfigurationForRuntime(
      structuredClone(entry.configuration),
      pkg,
    );
    const snapshot = runScenario(pkg, configuration);

    assert.equal(
      snapshot.result.status,
      'solved',
      `${entry.canonicalRef} should solve after runtime materialization`,
    );
  }
});

test('repo-backed user configurations with legacy autonomous role ids materialize and solve', () => {
  mkdirSync(USER_CONFIG_DIR, { recursive: true });
  const tempConfigId = 'tmp-cli-legacy-autonomous-user-config';
  const tempFile = path.join(USER_CONFIG_DIR, `${tempConfigId}.json`);
  const tempConfiguration = structuredClone(resolveCliConfigurationReference('reference-baseline').configuration);
  tempConfiguration.name = 'Temporary legacy autonomous user config';
  tempConfiguration.app_metadata = {
    ...(tempConfiguration.app_metadata ?? {}),
    id: tempConfigId,
    readonly: false,
  };
  tempConfiguration.efficiency_controls = {
    autonomous_mode: 'baseline',
    package_mode: 'off',
    package_ids: [],
    autonomous_modes_by_role: {
      commercial_building_services: 'off',
      residential_building_services: 'off',
    },
  };
  delete tempConfiguration.role_controls.account_land_carbon_stock_change;
  tempConfiguration.carbon_price = {
    2025: 30,
    2030: 120,
    2035: 220,
    2040: 340,
    2045: 470,
    2050: 600,
  };

  writeFileSync(tempFile, JSON.stringify(tempConfiguration, null, 2) + '\n');

  try {
    const output = JSON.parse(runCli([`user:${tempConfigId}`, '--json']));

    assert.equal(output.ok, true);
    assert.equal(output.result.status, 'solved');
    assert.deepEqual(output.configuration.efficiency_controls.autonomous_modes_by_role, {
      serve_commercial_building_occupants: 'off',
      serve_residential_building_occupants: 'off',
    });
    assert.deepEqual(
      output.configuration.role_controls.account_land_carbon_stock_change.active_method_ids,
      ['residual_lulucf_sink__residual_incumbent'],
    );
  } finally {
    rmSync(tempFile, { force: true });
  }
});
