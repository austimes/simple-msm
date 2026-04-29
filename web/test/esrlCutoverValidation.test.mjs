import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  materializeConfigurationForRuntime,
  resolveCliConfigurationReference,
} from '../src/cli/configurationRefs.mjs';
import { loadPackage } from '../src/data/packageLoader.ts';
import { runScenario } from '../src/results/runScenario.ts';

const PROJECT_ROOT = new URL('..', import.meta.url).pathname;
const REPO_ROOT = new URL('../..', import.meta.url).pathname;

function readText(relativePath) {
  return readFileSync(join(PROJECT_ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function listJsonFiles(relativeDir) {
  return readdirSync(join(PROJECT_ROOT, relativeDir))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => `${relativeDir}/${name}`);
}

function listFilesRecursive(absoluteDir, relativeDir) {
  return readdirSync(absoluteDir, { withFileTypes: true })
    .flatMap((entry) => {
      const childRelativePath = `${relativeDir}/${entry.name}`;
      const childAbsolutePath = join(absoluteDir, entry.name);

      if (entry.isDirectory()) {
        return listFilesRecursive(childAbsolutePath, childRelativePath);
      }

      return [childRelativePath];
    })
    .sort();
}

function collectStringValues(value, path = '$') {
  if (typeof value === 'string') {
    return [[path, value]];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectStringValues(entry, `${path}[${index}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) => collectStringValues(entry, `${path}.${key}`));
  }
  return [];
}

function executeBuiltin(pkg, configId) {
  const selection = resolveCliConfigurationReference(configId);
  const configuration = materializeConfigurationForRuntime(
    structuredClone(selection.configuration),
    pkg,
  );
  const snapshot = runScenario(pkg, configuration);
  return {
    selection,
    configuration,
    snapshot,
  };
}

test('canonical configuration and app-config surfaces do not use removed model terms', () => {
  const configPaths = listJsonFiles('src/configurations');
  const appConfigPaths = [
    ...listJsonFiles('src/app_config'),
    ...listJsonFiles('public/app_config'),
  ];
  const removedTerm = /\b(service_controls|active_state_ids|sector_states|simple_sector_growth|family|families|state|states)\b/i;

  for (const relativePath of [...configPaths, ...appConfigPaths]) {
    const json = readJson(relativePath);
    const entries = collectStringValues(json);
    const failures = entries
      .filter(([, text]) => removedTerm.test(text))
      .map(([path, text]) => `${relativePath} ${path}: ${text}`);

    assert.deepEqual(failures, []);
  }
});

test('web app role-growth presets do not retain sector-growth aliases', () => {
  const pkg = loadPackage();
  const presetIds = Object.keys(pkg.appConfig.demand_growth_presets);

  assert.ok(presetIds.includes('simple_role_growth_central'));
  assert.ok(presetIds.includes('simple_role_growth_high'));
  assert.ok(presetIds.includes('simple_role_growth_low'));
  assert.equal(presetIds.some((id) => id.startsWith('simple_sector_growth_')), false);
});

test('active web loaders only target canonical ESRL package assets', () => {
  const activeSourceFiles = [
    ...listFilesRecursive(join(PROJECT_ROOT, 'src'), 'src')
      .filter((relativePath) => /\.(mjs|ts|tsx)$/.test(relativePath)),
    'vite.config.ts',
  ];
  const retiredReferences = [
    'sector_trajectory_library',
    'family_validation_summary.csv',
  ];
  const failures = [];

  for (const relativePath of activeSourceFiles) {
    const text = readText(relativePath);

    for (const reference of retiredReferences) {
      if (text.includes(reference)) {
        failures.push(`${relativePath}: ${reference}`);
      }
    }
  }

  const manifest = readJson('../energy_system_representation_library/manifest.json');
  const manifestFiles = new Set(manifest.files);

  assert.equal(manifestFiles.has('validation/role_validation_summary.csv'), true);
  assert.equal(manifestFiles.has('validation/family_validation_summary.csv'), false);
  assert.deepEqual(failures, []);
});

test('crude steel aggregate and decomposed built-ins solve and expose comparable runs', () => {
  const pkg = loadPackage();
  const aggregate = executeBuiltin(pkg, 'reference-baseline');
  const decomposed = executeBuiltin(pkg, 'demo-crude-steel-decomposition');

  assert.equal(aggregate.snapshot.result.status, 'solved');
  assert.equal(decomposed.snapshot.result.status, 'solved');

  const aggregateRoleIds = new Set(aggregate.snapshot.request.rows.map((row) => row.roleId));
  const decomposedRoleIds = new Set(decomposed.snapshot.request.rows.map((row) => row.roleId));

  assert.ok(aggregateRoleIds.has('produce_crude_steel'));
  assert.equal(aggregateRoleIds.has('produce_direct_reduced_iron'), false);
  assert.equal(aggregateRoleIds.has('melt_refine_dri_crude_steel'), false);

  assert.equal(decomposedRoleIds.has('produce_crude_steel'), false);
  assert.ok(decomposedRoleIds.has('produce_crude_steel_non_h2_dri_residual'));
  assert.ok(decomposedRoleIds.has('produce_direct_reduced_iron'));
  assert.ok(decomposedRoleIds.has('melt_refine_dri_crude_steel'));

  const aggregateObjective = aggregate.snapshot.result.raw?.objectiveValue;
  const decomposedObjective = decomposed.snapshot.result.raw?.objectiveValue;
  assert.equal(typeof aggregateObjective, 'number');
  assert.equal(typeof decomposedObjective, 'number');
  assert.notEqual(aggregateObjective, decomposedObjective);

  const aggregateSteelRows = aggregate.snapshot.request.rows.filter((row) =>
    row.roleId === 'produce_crude_steel'
  );
  const decomposedSteelRows = decomposed.snapshot.request.rows.filter((row) =>
    row.roleId === 'produce_crude_steel_non_h2_dri_residual'
    || row.roleId === 'produce_direct_reduced_iron'
    || row.roleId === 'melt_refine_dri_crude_steel'
  );

  assert.ok(aggregateSteelRows.length > 0);
  assert.ok(decomposedSteelRows.length > aggregateSteelRows.length);
});

test('canonical package docs keep removed model terms out of active surfaces', () => {
  const roleDir = join(REPO_ROOT, 'energy_system_representation_library/roles');
  const docPaths = [
    'energy_system_representation_library/README.md',
    ...readdirSync(roleDir).flatMap((roleId) => [
      `energy_system_representation_library/roles/${roleId}/README.md`,
      `energy_system_representation_library/roles/${roleId}/validation.md`,
    ]),
  ];
  const removedTerm = /\b(family_id|state_id|family_states|sector_states|service_controls|active_state_ids|SectorState|state-year|family\/state)\b/i;

  for (const relativePath of docPaths) {
    assert.doesNotMatch(readFileSync(join(REPO_ROOT, relativePath), 'utf8'), removedTerm, relativePath);
  }
});
