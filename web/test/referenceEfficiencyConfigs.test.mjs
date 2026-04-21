import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveConfigurationDocument } from '../src/data/demandResolution.ts';
import { loadPackage } from '../src/data/packageLoader.ts';
import { runScenario } from '../src/results/runScenario.ts';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';

const CONFIG_EXPECTATIONS = [
  {
    id: 'reference-baseline',
    autonomousMode: 'baseline',
    packageMode: 'off',
  },
  {
    id: 'reference-efficiency-open',
    autonomousMode: 'baseline',
    packageMode: 'all',
  },
  {
    id: 'reference-efficiency-off',
    autonomousMode: 'off',
    packageMode: 'off',
  },
];

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

function loadConfiguration(pkg, id) {
  return resolveConfigurationDocument(
    readJson(`../src/configurations/${id}.json`),
    pkg.appConfig,
    id,
  );
}

function stripScenarioIdentity(configuration) {
  const normalized = structuredClone(configuration);
  delete normalized.name;
  delete normalized.description;
  delete normalized.efficiency_controls;
  delete normalized.app_metadata;
  return normalized;
}

test('core reference efficiency configs share one scenario backbone and solve under their authored efficiency modes', () => {
  const pkg = loadPackage();
  const configurations = CONFIG_EXPECTATIONS.map((expectation) => ({
    ...expectation,
    configuration: loadConfiguration(pkg, expectation.id),
  }));
  const baselineScenario = stripScenarioIdentity(configurations[0].configuration);
  const allTrackIds = Array.from(
    new Set(pkg.autonomousEfficiencyTracks.map((track) => track.track_id)),
  ).sort((left, right) => left.localeCompare(right));
  const allPackageIds = Array.from(
    new Set(pkg.efficiencyPackages.map((row) => row.package_id)),
  ).sort((left, right) => left.localeCompare(right));

  for (const entry of configurations) {
    assert.deepEqual(stripScenarioIdentity(entry.configuration), baselineScenario);

    const request = buildSolveRequest(pkg, entry.configuration);
    assert.equal(request.configuration.efficiency?.autonomousMode, entry.autonomousMode);
    assert.equal(request.configuration.efficiency?.packageMode, entry.packageMode);
    assert.deepEqual(
      request.configuration.efficiency?.activeTrackIds,
      entry.autonomousMode === 'off' ? [] : allTrackIds,
    );
    assert.deepEqual(
      request.configuration.efficiency?.activePackageIds,
      entry.packageMode === 'all' ? allPackageIds : [],
    );

    const snapshot = runScenario(pkg, entry.configuration);
    assert.equal(snapshot.result.status, 'solved', `${entry.id} should solve`);
  }
});
