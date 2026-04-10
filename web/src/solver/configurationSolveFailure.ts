import type { SolveDiagnostic, SolveResult } from './contract.ts';

export interface ConfigurationSolveFailure {
  stage: 'build' | 'solve';
  headline: string;
  detailLines: string[];
  diagnostics: SolveDiagnostic[];
  result: SolveResult | null;
}

function splitFailureMessage(message: string, fallbackHeadline: string): { headline: string; detailLines: string[] } {
  const lines = message
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return {
    headline: lines[0] ?? fallbackHeadline,
    detailLines: lines.slice(1),
  };
}

export function buildConfigurationBuildFailure(message: string): ConfigurationSolveFailure {
  const { headline, detailLines } = splitFailureMessage(message, 'Failed to build solve request.');

  return {
    stage: 'build',
    headline,
    detailLines,
    diagnostics: [],
    result: null,
  };
}

export function buildConfigurationSolveFailure(result: SolveResult): ConfigurationSolveFailure {
  const errorDiagnostics = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  const warningDiagnostics = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'warning');
  const primaryDiagnostic = errorDiagnostics[0] ?? warningDiagnostics[0] ?? null;

  return {
    stage: 'solve',
    headline: primaryDiagnostic?.message
      ?? `The solver returned status ${result.raw?.solutionStatus ?? result.status}.`,
    detailLines: [],
    diagnostics: result.diagnostics,
    result,
  };
}
