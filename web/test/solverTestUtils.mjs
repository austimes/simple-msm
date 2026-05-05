/**
 * Shared test utilities for solver tests.
 *
 * Provides data loading, configuration building, and assertion helpers.
 */
import { readFileSync } from 'node:fs';
import { loadPackage } from '../src/data/packageLoader.ts';
import { resolveConfigurationDocument as resolveConfigurationDocument } from '../src/data/demandResolution.ts';
import { buildSolveRequest } from '../src/solver/buildSolveRequest.ts';
import { solveWithLpAdapter } from '../src/solver/lpAdapter.ts';
import { materializeServiceControlsFromRoleControls } from './roleControlTestUtils.mjs';

// --- Incumbent state IDs ---

export const INCUMBENT_STATE_IDS = {
  residential_building_services: 'buildings__residential__incumbent_mixed_fuels',
  commercial_building_services: 'buildings__commercial__incumbent_mixed_fuels',
  passenger_road_transport: 'road_transport__passenger_road__ice_fleet',
  freight_road_transport: 'road_transport__freight_road__diesel',
  crude_steel: 'steel__crude_steel__bf_bof_conventional',
  cement_equivalent: 'cement_clinker__cement_equivalent__conventional',
  livestock_output_bundle: 'agriculture__livestock__conventional',
  cropping_horticulture_output_bundle: 'agriculture__cropping_horticulture__conventional',
};

// --- Data loading ---

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

export function loadAppConfig() {
  return {
    output_roles: readJson('../public/app_config/output_roles.json'),
    baseline_activity_anchors: readJson('../public/app_config/baseline_activity_anchors.json'),
    demand_growth_presets: readJson('../public/app_config/demand_growth_presets.json'),
    commodity_price_presets: readJson('../public/app_config/commodity_price_presets.json'),
    carbon_price_presets: readJson('../public/app_config/carbon_price_presets.json'),
    explanation_tag_rules: readJson('../public/app_config/explanation_tag_rules.json'),
  };
}

export function loadPkg() {
  return loadPackage();
}

export function loadFormulationFixtureData() {
  const pkg = loadPkg();

  return {
    ...pkg,
    currentConfiguration: structuredClone(pkg.defaultConfiguration),
  };
}

export function loadReferenceConfiguration() {
  const pkg = loadPkg();
  return materializeServiceControlsFromRoleControls(
    readJson('../src/configurations/reference-baseline.json'),
    { resolvedMethodYears: pkg.resolvedMethodYears },
  );
}

/**
 * Build a configuration with custom service controls and solver options.
 */
export function buildConfiguration(appConfig, overrides = {}) {
  const referenceConfiguration = loadReferenceConfiguration();

  const configuration = {
    ...referenceConfiguration,
    name: overrides.name ?? referenceConfiguration.name,
    description: overrides.description ?? referenceConfiguration.description,
    service_controls: {
      ...referenceConfiguration.service_controls,
      ...(overrides.serviceControls ?? {}),
    },
    solver_options: {
      ...referenceConfiguration.solver_options,
      ...(overrides.solverOptions ?? {}),
    },
  };

  return resolveConfigurationDocument(configuration, appConfig, overrides.name ?? 'test configuration');
}

/**
 * Build and solve a request, scoping to the given output IDs by
 * deactivating pathways for all other non-supply outputs.
 */
export function solveScoped(pkg, configuration, seedOutputIds) {
  let effectiveConfiguration = configuration;

  if (seedOutputIds && seedOutputIds.length > 0) {
    const seedSet = new Set(seedOutputIds);
    const adjustedControls = { ...effectiveConfiguration.service_controls };

    for (const [outputId, meta] of Object.entries(pkg.appConfig.output_roles)) {
      if (meta.participates_in_commodity_balance) continue;
      if (seedSet.has(outputId)) continue;
      // Deactivate pathways for out-of-scope outputs.
      adjustedControls[outputId] = {
        ...(adjustedControls[outputId] ?? {}),
        active_state_ids: [],
      };
    }

    effectiveConfiguration = { ...effectiveConfiguration, service_controls: adjustedControls };
  }

  const request = buildSolveRequest(
    {
      resolvedMethodYears: pkg.resolvedMethodYears,
      appConfig: pkg.appConfig,
      autonomousEfficiencyTracks: pkg.autonomousEfficiencyTracks,
      efficiencyPackages: pkg.efficiencyPackages,
      roleMetadata: pkg.roleMetadata,
      roleActivityDrivers: pkg.roleActivityDrivers,
      representations: pkg.representations,
      roleDecompositionEdges: pkg.roleDecompositionEdges,
      methods: pkg.methods,
    },
    effectiveConfiguration,
  );
  const result = solveWithLpAdapter(request);
  return { request, result };
}
