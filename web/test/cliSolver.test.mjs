import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  materializeConfigurationForRuntime,
  resolveCliConfigurationReference,
} from '../src/cli/configurationRefs.mjs';
import { loadPackage } from '../src/data/packageLoader.ts';

const WEB_DIR = fileURLToPath(new URL('..', import.meta.url));
const USER_CONFIG_DIR = fileURLToPath(new URL('../src/configurations/user/', import.meta.url));

function runCli(args) {
  const result = spawnSync('bun', ['./solve.mjs', ...args], {
    cwd: WEB_DIR,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

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
