import type {
  NormalizedSolverRow,
  ResolvedSolveControl,
  SolveDiagnostic,
} from './contract.ts';

const SHARE_TOLERANCE = 1e-6;

function buildConstraintContext(
  outputId: string,
  year: number,
  stateId?: string,
): Pick<SolveDiagnostic, 'outputId' | 'year' | 'stateId'> {
  return {
    outputId,
    year,
    stateId,
  };
}

export function validateFixedShareControl(
  outputId: string,
  year: number,
  rows: NormalizedSolverRow[],
  control: ResolvedSolveControl,
  controlLabel: string,
): SolveDiagnostic[] {
  const diagnostics: SolveDiagnostic[] = [];
  const knownStateIds = new Set(rows.map((row) => row.stateId));
  const disabledStateIds = new Set(control.disabledStateIds);
  const shares = control.fixedShares;

  if (!shares || Object.keys(shares).length === 0) {
    diagnostics.push({
      code: 'missing_fixed_shares',
      severity: 'error',
      reason: 'exact_share_conflict',
      message: `${controlLabel} for ${outputId} in ${year} requires at least one positive pathway share.`,
      ...buildConstraintContext(outputId, year),
      suggestion: 'Provide at least one positive exact share or switch away from exact-share mode.',
    });
    return diagnostics;
  }

  let shareTotal = 0;
  for (const [stateId, share] of Object.entries(shares)) {
    shareTotal += share;

    if (!knownStateIds.has(stateId)) {
      diagnostics.push({
        code: 'unknown_fixed_share_state',
        severity: 'error',
        reason: 'exact_share_conflict',
        message: `Exact-share state ${JSON.stringify(stateId)} is not available for ${outputId} in ${year}.`,
        ...buildConstraintContext(outputId, year, stateId),
        suggestion: 'Choose a state that exists in the library rows for this service-year.',
      });
    }

    if (disabledStateIds.has(stateId)) {
      diagnostics.push({
        code: 'disabled_fixed_share_state',
        severity: 'error',
        reason: 'disabled_states',
        message: `Exact-share state ${JSON.stringify(stateId)} is disabled for ${outputId} in ${year}.`,
        ...buildConstraintContext(outputId, year, stateId),
        suggestion: 'Re-enable the state or remove it from the exact-share mix.',
      });
    }

    if (share < 0) {
      diagnostics.push({
        code: 'negative_fixed_share',
        severity: 'error',
        reason: 'exact_share_conflict',
        message: `Exact share for ${JSON.stringify(stateId)} in ${outputId} ${year} must be non-negative.`,
        ...buildConstraintContext(outputId, year, stateId),
        suggestion: 'Set all exact shares to zero or positive values.',
      });
    }
  }

  if (Math.abs(shareTotal - 1) > SHARE_TOLERANCE) {
    diagnostics.push({
      code: 'fixed_share_total_must_equal_one',
      severity: 'error',
      reason: 'exact_share_conflict',
      message: `Exact shares for ${outputId} in ${year} sum to ${shareTotal.toFixed(6)} instead of 1.`,
      ...buildConstraintContext(outputId, year),
      suggestion: 'Adjust the exact shares so the total equals 100%.',
    });
  }

  return diagnostics;
}
