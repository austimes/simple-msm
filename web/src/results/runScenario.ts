import type { PackageData, ConfigurationDocument } from '../data/types.ts';
import { buildSolveRequest } from '../solver/buildSolveRequest.ts';
import { solveWithLpAdapter } from '../solver/lpAdapter.ts';
import { buildAllContributionRows } from './resultContributions.ts';
import type { ExecutionSnapshot } from './executionSnapshot.ts';

export interface RunScenarioOptions {
  includeOverlays?: boolean;
}

export function runScenario(
  pkg: PackageData,
  configuration: ConfigurationDocument,
  options?: RunScenarioOptions,
): ExecutionSnapshot {
  const request = buildSolveRequest(pkg, configuration);
  const result = solveWithLpAdapter(request);

  const contributions =
    options?.includeOverlays === false
      ? buildAllContributionRows(request, result, [], configuration)
      : buildAllContributionRows(request, result, pkg.residualOverlays2025, configuration);

  return {
    configId: configuration.app_metadata?.id ?? null,
    configuration,
    request,
    result,
    contributions,
  };
}
