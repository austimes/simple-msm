import { solve, type Model, type Solution } from 'yalps';
import { derivePathwayStateIds } from '../data/pathwaySemantics.ts';
import type {
  CommoditySolveMode,
  NormalizedSolverRow,
  RawSolveVariableValue,
  ResolvedSolveControl,
  SolveBindingConstraintSummary,
  SolveCommodityBalanceSummary,
  SolveConstraintBoundType,
  SolveConstraintKind,
  SolveDiagnostic,
  SolveReportingSummary,
  SolveRequest,
  SolveRequestSummary,
  SolveResult,
  SolveStateShareSummary,
  SolveSoftConstraintViolationSummary,
} from './contract.ts';

const CONFIGURATION_OBJECTIVE_KEY = 'total_cost';
const CONFIGURATION_DIRECTION = 'minimize' as const;
const SHARE_TOLERANCE = 1e-6;
const BINDING_TOLERANCE = 1e-6;
const SOFT_CONSTRAINT_MIN_PENALTY = 1_000_000;
const SOFT_CONSTRAINT_PENALTY_MULTIPLIER = 1000;

type ConstraintBounds = { equal?: number; min?: number; max?: number };
type SoftConstraintKind = Extract<SolveConstraintKind, 'max_share' | 'max_activity'>;

type TrackedConstraintInput = Omit<TrackedConstraint, 'constraintId' | 'boundType' | 'boundValue'>;

interface SoftConstraintMetadata {
  variableId: string;
  penaltyPerUnit: number;
}

interface RequiredServiceGroup {
  outputId: string;
  outputLabel: string;
  year: number;
  demand: number;
  control: ResolvedSolveControl;
  rows: NormalizedSolverRow[];
}

interface SupplyCommodityGroup {
  commodityId: string;
  commodityLabel: string;
  year: number;
  control: ResolvedSolveControl;
  externalDemand: number;
  rows: NormalizedSolverRow[];
}

interface TrackedConstraint {
  constraintId: string;
  kind: SolveConstraintKind;
  boundType: SolveConstraintBoundType;
  boundValue: number;
  outputId: string;
  outputLabel: string;
  year: number;
  stateId?: string;
  stateLabel?: string;
  rowId?: string;
  commodityId?: string;
  mode?: ResolvedSolveControl['mode'];
  message: string;
  softConstraint?: SoftConstraintMetadata;
}

interface ResolvedMaxShareBounds {
  rawMaxShare: number | null;
  effectiveMaxShare: number | null;
}

interface RowShareProfile {
  row: NormalizedSolverRow;
  disabled: boolean;
  active: boolean;
  capEligible: boolean;
  lowerShare: number;
  upperShare: number;
  upperShareIgnoringActivity: number;
  exactShare: number | null;
  rawMaxShare: number | null;
  effectiveMaxShare: number | null;
  maxShareLimit: number | null;
  maxActivityLimit: number | null;
  commodityCoefficient: number;
}

interface ConfigurationLpBuild {
  request: SolveRequest;
  model: Model<string, string>;
  activityScale: number;
  diagnostics: SolveDiagnostic[];
  notes: string[];
  hasUnmodeledFeatures: boolean;
  activeRows: NormalizedSolverRow[];
  requiredServiceGroups: RequiredServiceGroup[];
  supplyGroups: SupplyCommodityGroup[];
  balancedCommodityKeys: Set<string>;
  trackedConstraints: Record<string, TrackedConstraint>;
  softConstraintVariableIds: Set<string>;
  softConstraintPenaltyPerUnit: number | null;
}

function yearKey(year: number): string {
  return String(year);
}

function commodityYearKey(commodityId: string, year: number): string {
  return `${commodityId}::${year}`;
}

function activityVariableId(row: NormalizedSolverRow): string {
  return `activity:${row.rowId}`;
}

function stateConstraintId(prefix: string, row: NormalizedSolverRow): string {
  return `${prefix}:${row.rowId}`;
}

function demandConstraintId(outputId: string, year: number): string {
  return `demand:${outputId}:${year}`;
}

function commodityBalanceConstraintId(commodityId: string, year: number): string {
  return `commodity_balance:${commodityId}:${year}`;
}

function softConstraintVariableId(constraintId: string): string {
  return `soft_slack:${constraintId}`;
}

function countDistinctOutputs(request: SolveRequest): number {
  return new Set(request.rows.map((row) => row.outputId)).size;
}

function summarizeRequest(request: SolveRequest): SolveRequestSummary {
  return {
    rowCount: request.rows.length,
    yearCount: request.configuration.years.length,
    outputCount: countDistinctOutputs(request),
    serviceDemandOutputCount: Object.keys(request.configuration.serviceDemandByOutput).length,
    externalCommodityCount: Object.keys(request.configuration.externalCommodityDemandByCommodity).length,
  };
}

function emptyReporting(): SolveReportingSummary {
  return {
    commodityBalances: [],
    stateShares: [],
    bindingConstraints: [],
    softConstraintViolations: [],
  };
}

function toRawVariables(solution: Solution<string>, activityScale: number): RawSolveVariableValue[] {
  return solution.variables.map(([id, value]) => ({
    id,
    value: unscaleActivityValue(value, activityScale),
  }));
}

function sumDirectEmissionsPerUnit(row: NormalizedSolverRow): number {
  return row.directEmissions.reduce((total, emission) => total + emission.value, 0);
}

function sumInputCoefficient(row: NormalizedSolverRow, commodityId: string): number {
  return row.inputs.reduce((total, input) => {
    return input.commodityId === commodityId ? total + input.coefficient : total;
  }, 0);
}

function resolveCommodityPrice(request: SolveRequest, commodityId: string, year: number): number {
  return request.configuration.commodityPriceByCommodity[commodityId]?.valuesByYear[yearKey(year)] ?? 0;
}

function resolveRowObjectiveCost(
  request: SolveRequest,
  row: NormalizedSolverRow,
  balancedCommodityKeys: Set<string>,
): number {
  const conversionCost = row.conversionCostPerUnit ?? 0;
  const commodityCost = row.inputs.reduce((total, input) => {
    if (balancedCommodityKeys.has(commodityYearKey(input.commodityId, row.year))) {
      return total;
    }

    return total + input.coefficient * resolveCommodityPrice(request, input.commodityId, row.year);
  }, 0);
  const carbonCost = sumDirectEmissionsPerUnit(row) * (request.configuration.carbonPriceByYear[yearKey(row.year)] ?? 0);

  return conversionCost + commodityCost + carbonCost;
}

function resolveActivityScale(request: SolveRequest): number {
  let maxMagnitude = 0;

  for (const table of Object.values(request.configuration.serviceDemandByOutput)) {
    for (const value of Object.values(table)) {
      maxMagnitude = Math.max(maxMagnitude, Math.abs(value));
    }
  }

  for (const table of Object.values(request.configuration.externalCommodityDemandByCommodity)) {
    for (const value of Object.values(table)) {
      maxMagnitude = Math.max(maxMagnitude, Math.abs(value));
    }
  }

  for (const row of request.rows) {
    if (row.bounds.maxActivity != null) {
      maxMagnitude = Math.max(maxMagnitude, Math.abs(row.bounds.maxActivity));
    }
  }

  if (!Number.isFinite(maxMagnitude) || maxMagnitude < 1_000) {
    return 1;
  }

  const exponent = Math.max(0, Math.floor(Math.log10(maxMagnitude)) - 2);
  return Math.min(1_000_000, 10 ** exponent);
}

function scaleActivityValue(value: number, activityScale: number): number {
  return activityScale === 1 ? value : value / activityScale;
}

function unscaleActivityValue(value: number, activityScale: number): number {
  return activityScale === 1 ? value : value * activityScale;
}

function scaleConstraintBounds(constraint: ConstraintBounds, activityScale: number): ConstraintBounds {
  return {
    equal: constraint.equal == null ? undefined : scaleActivityValue(constraint.equal, activityScale),
    min: constraint.min == null ? undefined : scaleActivityValue(constraint.min, activityScale),
    max: constraint.max == null ? undefined : scaleActivityValue(constraint.max, activityScale),
  };
}

function resolveConstraintBound(constraint: ConstraintBounds): {
  boundType: SolveConstraintBoundType;
  boundValue: number;
} {
  if (constraint.equal != null) {
    return { boundType: 'equal', boundValue: constraint.equal };
  }

  if (constraint.min != null) {
    return { boundType: 'min', boundValue: constraint.min };
  }

  if (constraint.max != null) {
    return { boundType: 'max', boundValue: constraint.max };
  }

  throw new Error('Tracked LP constraints must define an equal, min, or max bound.');
}

function setVariableConstraintCoefficient(
  variables: Record<string, Record<string, number>>,
  variableId: string,
  constraintId: string,
  coefficient: number,
): void {
  variables[variableId][constraintId] = (variables[variableId][constraintId] ?? 0) + coefficient;
}

function trackConstraint(
  constraints: Record<string, ConstraintBounds>,
  trackedConstraints: Record<string, TrackedConstraint>,
  constraintId: string,
  constraint: ConstraintBounds,
  metadata: TrackedConstraintInput,
): void {
  constraints[constraintId] = constraint;
  trackedConstraints[constraintId] = {
    constraintId,
    ...metadata,
    ...resolveConstraintBound(constraint),
  };
}

function addConstraint(
  constraints: Record<string, ConstraintBounds>,
  trackedConstraints: Record<string, TrackedConstraint>,
  variables: Record<string, Record<string, number>>,
  variableId: string,
  constraintId: string,
  constraint: ConstraintBounds,
  metadata: TrackedConstraintInput,
): void {
  trackConstraint(constraints, trackedConstraints, constraintId, constraint, metadata);
  setVariableConstraintCoefficient(variables, variableId, constraintId, 1);
}

function addShareConstraint(
  constraints: Record<string, ConstraintBounds>,
  trackedConstraints: Record<string, TrackedConstraint>,
  variables: Record<string, Record<string, number>>,
  groupVariableIds: string[],
  constrainedVariableId: string,
  share: number,
  constraintId: string,
  constraint: ConstraintBounds,
  metadata: TrackedConstraintInput,
): void {
  trackConstraint(constraints, trackedConstraints, constraintId, constraint, metadata);

  for (const groupVariableId of groupVariableIds) {
    const coefficient = groupVariableId === constrainedVariableId ? 1 - share : -share;
    setVariableConstraintCoefficient(variables, groupVariableId, constraintId, coefficient);
  }
}

function resolveSoftConstraintPenalty(
  variables: Record<string, Record<string, number>>,
): number {
  const maxObjectiveMagnitude = Math.max(
    0,
    ...Object.values(variables).map((coefficients) => Math.abs(coefficients[CONFIGURATION_OBJECTIVE_KEY] ?? 0)),
  );

  return Math.max(
    SOFT_CONSTRAINT_MIN_PENALTY,
    (maxObjectiveMagnitude + 1) * SOFT_CONSTRAINT_PENALTY_MULTIPLIER,
  );
}

function softenTrackedConstraint(
  variables: Record<string, Record<string, number>>,
  trackedConstraints: Record<string, TrackedConstraint>,
  softConstraintVariableIds: Set<string>,
  constraintId: string,
  penaltyPerUnit: number,
): void {
  const trackedConstraint = trackedConstraints[constraintId];

  if (!trackedConstraint) {
    throw new Error(`Missing tracked constraint ${JSON.stringify(constraintId)} for softening.`);
  }

  if (trackedConstraint.boundType !== 'max') {
    throw new Error(`Only max constraints can be softened, received ${trackedConstraint.boundType}.`);
  }

  if (trackedConstraint.kind !== 'max_share' && trackedConstraint.kind !== 'max_activity') {
    throw new Error(`Constraint ${JSON.stringify(constraintId)} is not eligible for softening.`);
  }

  const variableId = softConstraintVariableId(constraintId);
  variables[variableId] = {
    [CONFIGURATION_OBJECTIVE_KEY]: penaltyPerUnit,
    [constraintId]: -1,
  };
  softConstraintVariableIds.add(variableId);
  trackedConstraint.softConstraint = {
    variableId,
    penaltyPerUnit,
  };
}

function collectRequiredServiceGroups(request: SolveRequest): RequiredServiceGroup[] {
  const groups = new Map<string, RequiredServiceGroup>();

  for (const row of request.rows) {
    if (row.outputRole !== 'required_service') {
      continue;
    }

    const demand = request.configuration.serviceDemandByOutput[row.outputId]?.[yearKey(row.year)] ?? 0;
    const control = request.configuration.controlsByOutput[row.outputId]?.[yearKey(row.year)];

    if (!control) {
      throw new Error(
        `Missing resolved control for required service ${JSON.stringify(row.outputId)} in ${row.year}.`,
      );
    }

    const key = commodityYearKey(row.outputId, row.year);
    const existing = groups.get(key);

    if (existing) {
      existing.rows.push(row);
      continue;
    }

    groups.set(key, {
      outputId: row.outputId,
      outputLabel: row.outputLabel,
      year: row.year,
      demand,
      control,
      rows: [row],
    });
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.year !== right.year) {
      return left.year - right.year;
    }

    return left.outputId.localeCompare(right.outputId);
  });
}

function collectSupplyCommodityGroups(request: SolveRequest): SupplyCommodityGroup[] {
  const groups = new Map<string, SupplyCommodityGroup>();

  for (const row of request.rows) {
    if (row.outputRole !== 'endogenous_supply_commodity') {
      continue;
    }

    const control = request.configuration.controlsByOutput[row.outputId]?.[yearKey(row.year)];

    if (!control) {
      throw new Error(
        `Missing resolved control for supply commodity ${JSON.stringify(row.outputId)} in ${row.year}.`,
      );
    }

    const key = commodityYearKey(row.outputId, row.year);
    const existing = groups.get(key);

    if (existing) {
      existing.rows.push(row);
      continue;
    }

    groups.set(key, {
      commodityId: row.outputId,
      commodityLabel: row.outputLabel,
      year: row.year,
      control,
      externalDemand: request.configuration.externalCommodityDemandByCommodity[row.outputId]?.[yearKey(row.year)] ?? 0,
      rows: [row],
    });
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.year !== right.year) {
      return left.year - right.year;
    }

    return left.commodityId.localeCompare(right.commodityId);
  });
}

function controlConstraintPrefix(controlMode: ResolvedSolveControl['mode']): string {
  return controlMode === 'pinned_single' ? 'pinned' : 'fixed_share';
}

function sharePercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

function buildConstraintContext(
  outputId: string,
  year: number,
  stateId?: string,
  rowId?: string,
): Pick<SolveDiagnostic, 'outputId' | 'year' | 'stateId' | 'rowId'> {
  return {
    outputId,
    year,
    stateId,
    rowId,
  };
}

function validateFixedShareControl(
  outputId: string,
  year: number,
  rows: NormalizedSolverRow[],
  control: ResolvedSolveControl,
  controlLabel: string,
): SolveDiagnostic[] {
  const diagnostics: SolveDiagnostic[] = [];
  const availableStateIds = new Set(rows.map((row) => row.stateId));
  const disabledStateIds = new Set(control.disabledStateIds);
  const shares = control.fixedShares;

  if (!shares || Object.keys(shares).length === 0) {
    diagnostics.push({
      code: 'missing_fixed_shares',
      severity: 'error',
      reason: 'pinned_fixed_share_conflict',
      message: `${controlLabel} for ${outputId} in ${year} requires at least one state share.`,
      ...buildConstraintContext(outputId, year),
      suggestion: 'Provide at least one fixed share or switch the control mode away from fixed_shares.',
    });
    return diagnostics;
  }

  let shareTotal = 0;
  for (const [stateId, share] of Object.entries(shares)) {
    shareTotal += share;

    if (!availableStateIds.has(stateId)) {
      diagnostics.push({
        code: 'unknown_fixed_share_state',
        severity: 'error',
        reason: 'pinned_fixed_share_conflict',
        message: `Fixed-share state ${JSON.stringify(stateId)} is not available for ${outputId} in ${year}.`,
        ...buildConstraintContext(outputId, year, stateId),
        suggestion: 'Choose a state that exists in the library rows for this service-year.',
      });
    }

    if (disabledStateIds.has(stateId)) {
      diagnostics.push({
        code: 'disabled_fixed_share_state',
        severity: 'error',
        reason: 'disabled_states',
        message: `Fixed-share state ${JSON.stringify(stateId)} is disabled for ${outputId} in ${year}.`,
        ...buildConstraintContext(outputId, year, stateId),
        suggestion: 'Re-enable the state or remove it from the fixed-share mix.',
      });
    }

    if (share < 0) {
      diagnostics.push({
        code: 'negative_fixed_share',
        severity: 'error',
        reason: 'pinned_fixed_share_conflict',
        message: `Fixed share for ${JSON.stringify(stateId)} in ${outputId} ${year} must be non-negative.`,
        ...buildConstraintContext(outputId, year, stateId),
        suggestion: 'Set all fixed shares to zero or positive values.',
      });
    }
  }

  if (Math.abs(shareTotal - 1) > SHARE_TOLERANCE) {
    diagnostics.push({
      code: 'fixed_share_total_must_equal_one',
      severity: 'error',
      reason: 'pinned_fixed_share_conflict',
      message: `Fixed shares for ${outputId} in ${year} sum to ${shareTotal.toFixed(6)} instead of 1.`,
      ...buildConstraintContext(outputId, year),
      suggestion: 'Adjust the fixed shares so the total equals 100%.',
    });
  }

  return diagnostics;
}

function validateRequiredServiceGroup(group: RequiredServiceGroup): SolveDiagnostic[] {
  const diagnostics: SolveDiagnostic[] = [];
  const availableStateIds = new Set(group.rows.map((row) => row.stateId));
  const disabledStateIds = new Set(group.control.disabledStateIds);

  if (group.control.mode === 'pinned_single') {
    if (!group.control.stateId) {
      diagnostics.push({
        code: 'missing_pinned_state',
        severity: 'error',
        reason: 'pinned_fixed_share_conflict',
        message: `Pinned control for ${group.outputId} in ${group.year} is missing state_id.`,
        ...buildConstraintContext(group.outputId, group.year),
        suggestion: 'Select a state_id for the pinned_single control.',
      });
      return diagnostics;
    }

    if (!availableStateIds.has(group.control.stateId)) {
      diagnostics.push({
        code: 'unknown_pinned_state',
        severity: 'error',
        reason: 'pinned_fixed_share_conflict',
        message: `Pinned state ${JSON.stringify(group.control.stateId)} is not available for ${group.outputId} in ${group.year}.`,
        ...buildConstraintContext(group.outputId, group.year, group.control.stateId),
        suggestion: 'Choose a pinned state that exists in the library rows for this service-year.',
      });
    }

    if (disabledStateIds.has(group.control.stateId)) {
      diagnostics.push({
        code: 'disabled_pinned_state',
        severity: 'error',
        reason: 'disabled_states',
        message: `Pinned state ${JSON.stringify(group.control.stateId)} is disabled for ${group.outputId} in ${group.year}.`,
        ...buildConstraintContext(group.outputId, group.year, group.control.stateId),
        suggestion: 'Re-enable the pinned state or choose a different pinned state.',
      });
    }

    return diagnostics;
  }

  if (group.control.mode === 'fixed_shares') {
    diagnostics.push(
      ...validateFixedShareControl(
        group.outputId,
        group.year,
        group.rows,
        group.control,
        'Fixed-share control',
      ),
    );
  }

  return diagnostics;
}

function validateSupplyCommodityGroup(group: SupplyCommodityGroup): SolveDiagnostic[] {
  const diagnostics: SolveDiagnostic[] = [];

  if (group.control.mode === 'externalized' || group.control.mode === 'optimize') {
    return diagnostics;
  }

  if (group.control.mode === 'fixed_shares') {
    diagnostics.push(
      ...validateFixedShareControl(
        group.commodityId,
        group.year,
        group.rows,
        group.control,
        'Fixed-share supply control',
      ),
    );
    return diagnostics;
  }

  diagnostics.push({
    code: 'invalid_supply_control_mode',
    severity: 'error',
    message: `Supply commodity ${group.commodityId} in ${group.year} must use fixed_shares, optimize, or externalized mode.`,
    ...buildConstraintContext(group.commodityId, group.year),
    suggestion: 'Use fixed_shares, optimize, or externalized for endogenous supply commodities.',
  });

  return diagnostics;
}

function clampShare(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function buildEffectiveMaxShareLookup(
  rows: NormalizedSolverRow[],
  control: ResolvedSolveControl,
): Map<string, ResolvedMaxShareBounds> {
  const lookup = new Map<string, ResolvedMaxShareBounds>();
  const pathwayStateIds = derivePathwayStateIds(
    rows.map((row) => row.stateId),
    control,
  );
  const capEligibleStateIds = new Set(pathwayStateIds.capEligibleStateIds);
  const capEligibleRows = rows.filter((row) => capEligibleStateIds.has(row.stateId));

  for (const row of rows) {
    lookup.set(row.rowId, {
      rawMaxShare: row.bounds.maxShare == null ? null : clampShare(row.bounds.maxShare),
      effectiveMaxShare: null,
    });
  }

  if (capEligibleRows.length === 0) {
    return lookup;
  }

  const weights = capEligibleRows.map((row) => ({
    rowId: row.rowId,
    weight: clampShare(row.bounds.maxShare ?? 1),
  }));
  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
  const fallbackShare = 1 / capEligibleRows.length;

  for (const { rowId, weight } of weights) {
    const existing = lookup.get(rowId);
    if (!existing) {
      continue;
    }

    existing.effectiveMaxShare = totalWeight <= SHARE_TOLERANCE
      ? fallbackShare
      : weight / totalWeight;
  }

  return lookup;
}

function resolveExactShare(control: ResolvedSolveControl, row: NormalizedSolverRow): number | null {
  if (control.mode === 'pinned_single') {
    return row.stateId === control.stateId ? 1 : 0;
  }

  if (control.mode === 'fixed_shares') {
    return control.fixedShares?.[row.stateId] ?? 0;
  }

  return null;
}

function buildRowShareProfiles(
  rows: NormalizedSolverRow[],
  control: ResolvedSolveControl,
  referenceDemand: number,
  request: SolveRequest,
  commodityId?: string,
): RowShareProfile[] {
  const pathwayStateIds = derivePathwayStateIds(
    rows.map((row) => row.stateId),
    control,
  );
  const availableStateIds = new Set(pathwayStateIds.availableStateIds);
  const activeStateIds = new Set(pathwayStateIds.activeStateIds);
  const capEligibleStateIds = new Set(pathwayStateIds.capEligibleStateIds);
  const maxShareLookup = buildEffectiveMaxShareLookup(rows, control);

  return [...rows]
    .sort((left, right) => left.stateLabel.localeCompare(right.stateLabel))
    .map((row) => {
      const disabled = !availableStateIds.has(row.stateId);
      const resolvedMaxShare = maxShareLookup.get(row.rowId) ?? {
        rawMaxShare: row.bounds.maxShare == null ? null : clampShare(row.bounds.maxShare),
        effectiveMaxShare: null,
      };
      const maxShareLimit = request.configuration.options.respectMaxShare
        ? resolvedMaxShare.effectiveMaxShare
        : null;
      const maxActivityLimit = request.configuration.options.respectMaxActivity ? row.bounds.maxActivity : null;
      const upperShareIgnoringActivity = disabled
        ? 0
        : maxShareLimit == null
          ? 1
          : clampShare(maxShareLimit);
      const upperShareFromActivity = disabled || referenceDemand <= SHARE_TOLERANCE || maxActivityLimit == null
        ? 1
        : Math.max(0, maxActivityLimit / referenceDemand);
      const upperShare = disabled
        ? 0
        : clampShare(Math.min(upperShareIgnoringActivity, upperShareFromActivity));

      return {
        row,
        disabled,
        active: activeStateIds.has(row.stateId),
        capEligible: capEligibleStateIds.has(row.stateId),
        lowerShare: disabled || referenceDemand <= SHARE_TOLERANCE ? 0 : Math.max(0, row.bounds.minShare ?? 0),
        upperShare,
        upperShareIgnoringActivity,
        exactShare: resolveExactShare(control, row),
        rawMaxShare: resolvedMaxShare.rawMaxShare,
        effectiveMaxShare: resolvedMaxShare.effectiveMaxShare,
        maxShareLimit,
        maxActivityLimit,
        commodityCoefficient: commodityId ? sumInputCoefficient(row, commodityId) : 0,
      } satisfies RowShareProfile;
    });
}

function sumShares(profiles: RowShareProfile[], field: 'lowerShare' | 'upperShare' | 'upperShareIgnoringActivity'): number {
  return profiles.reduce((total, profile) => total + profile[field], 0);
}

function estimateMinimumCommodityDemandForGroup(
  group: RequiredServiceGroup,
  request: SolveRequest,
  commodityId: string,
): number | null {
  if (group.demand <= SHARE_TOLERANCE) {
    return 0;
  }

  const profiles = buildRowShareProfiles(group.rows, group.control, group.demand, request, commodityId);

  if (group.control.mode === 'pinned_single' || group.control.mode === 'fixed_shares') {
    return group.demand * profiles.reduce((total, profile) => {
      return total + (profile.exactShare ?? 0) * profile.commodityCoefficient;
    }, 0);
  }

  const activeProfiles = profiles.filter((profile) => !profile.disabled);
  if (activeProfiles.length === 0) {
    return null;
  }

  const lowerTotal = sumShares(activeProfiles, 'lowerShare');
  const upperTotal = sumShares(activeProfiles, 'upperShare');
  if (lowerTotal > 1 + SHARE_TOLERANCE || upperTotal < 1 - SHARE_TOLERANCE) {
    return null;
  }

  const allocations = new Map<string, number>();
  for (const profile of activeProfiles) {
    allocations.set(profile.row.rowId, profile.lowerShare);
  }

  let remainingShare = 1 - lowerTotal;
  for (const profile of [...activeProfiles].sort((left, right) => {
    if (left.commodityCoefficient !== right.commodityCoefficient) {
      return left.commodityCoefficient - right.commodityCoefficient;
    }

    return left.row.stateLabel.localeCompare(right.row.stateLabel);
  })) {
    if (remainingShare <= SHARE_TOLERANCE) {
      break;
    }

    const currentShare = allocations.get(profile.row.rowId) ?? 0;
    const extraCapacity = profile.upperShare - currentShare;
    if (extraCapacity <= SHARE_TOLERANCE) {
      continue;
    }

    const addedShare = Math.min(remainingShare, extraCapacity);
    allocations.set(profile.row.rowId, currentShare + addedShare);
    remainingShare -= addedShare;
  }

  if (remainingShare > SHARE_TOLERANCE) {
    return null;
  }

  return group.demand * activeProfiles.reduce((total, profile) => {
    return total + (allocations.get(profile.row.rowId) ?? 0) * profile.commodityCoefficient;
  }, 0);
}

function estimateMinimumCommodityDemand(
  build: ConfigurationLpBuild,
  commodityId: string,
  year: number,
): number | null {
  let total = 0;

  for (const group of build.requiredServiceGroups) {
    if (group.year !== year) {
      continue;
    }

    const groupDemand = estimateMinimumCommodityDemandForGroup(group, build.request, commodityId);
    if (groupDemand == null) {
      const touchesCommodity = group.rows.some((row) => sumInputCoefficient(row, commodityId) !== 0);
      if (touchesCommodity) {
        return null;
      }

      continue;
    }

    total += groupDemand;
  }

  return total;
}

function estimateMaximumSupplyActivity(
  group: SupplyCommodityGroup,
  request: SolveRequest,
  includeDisabledStates = false,
): number {
  if (group.control.mode === 'externalized') {
    return 0;
  }

  const disabledStateIds = new Set(group.control.disabledStateIds);
  const rows = includeDisabledStates
    ? group.rows
    : group.rows.filter((row) => !disabledStateIds.has(row.stateId));

  if (rows.length === 0) {
    return 0;
  }

  if (group.control.mode === 'fixed_shares') {
    const fixedShares = group.control.fixedShares ?? {};
    let hasPositiveShare = false;
    let maximumActivity = Number.POSITIVE_INFINITY;

    for (const row of rows) {
      const share = fixedShares[row.stateId] ?? 0;
      if (share <= SHARE_TOLERANCE) {
        continue;
      }

      hasPositiveShare = true;
      if (request.configuration.options.respectMaxActivity && row.bounds.maxActivity != null) {
        maximumActivity = Math.min(maximumActivity, row.bounds.maxActivity / share);
      }
    }

    return hasPositiveShare ? maximumActivity : 0;
  }

  if (!request.configuration.options.respectMaxActivity) {
    return Number.POSITIVE_INFINITY;
  }

  if (rows.some((row) => row.bounds.maxActivity == null)) {
    return Number.POSITIVE_INFINITY;
  }

  return rows.reduce((total, row) => total + (row.bounds.maxActivity ?? 0), 0);
}

function buildRequiredServiceInfeasibilityDiagnostics(build: ConfigurationLpBuild): SolveDiagnostic[] {
  const diagnostics: SolveDiagnostic[] = [];

  for (const group of build.requiredServiceGroups) {
    if (group.demand <= SHARE_TOLERANCE) {
      continue;
    }

    const profiles = buildRowShareProfiles(group.rows, group.control, group.demand, build.request);
    const activeProfiles = profiles.filter((profile) => !profile.disabled);
    const disabledProfiles = profiles.filter((profile) => profile.disabled);

    if (group.control.mode === 'pinned_single' || group.control.mode === 'fixed_shares') {
      for (const profile of profiles) {
        const exactShare = profile.exactShare ?? 0;

        if (profile.disabled && exactShare > SHARE_TOLERANCE) {
          diagnostics.push({
            code: 'exact_control_hits_disabled_state',
            severity: 'error',
            reason: 'disabled_states',
            message: `${group.outputLabel} in ${group.year} requires disabled state ${profile.row.stateLabel} under the current ${group.control.mode.replaceAll('_', ' ')} control.`,
            ...buildConstraintContext(group.outputId, group.year, profile.row.stateId, profile.row.rowId),
            relatedConstraintIds: [stateConstraintId('disabled', profile.row), stateConstraintId(controlConstraintPrefix(group.control.mode), profile.row)],
            suggestion: 'Re-enable the state or relax the exact pinned or fixed-share control for this service-year.',
          });
        }

        if (exactShare > profile.upperShareIgnoringActivity + SHARE_TOLERANCE) {
          diagnostics.push({
            code: 'exact_control_share_conflict',
            severity: 'error',
            reason: 'pinned_fixed_share_conflict',
            message: `${group.outputLabel} in ${group.year} assigns ${sharePercent(exactShare)} to ${profile.row.stateLabel}, above its max share of ${sharePercent(profile.maxShareLimit ?? 0)}.`,
            ...buildConstraintContext(group.outputId, group.year, profile.row.stateId, profile.row.rowId),
            relatedConstraintIds: [stateConstraintId(controlConstraintPrefix(group.control.mode), profile.row), stateConstraintId('max_share', profile.row)],
            suggestion: 'Relax the exact control or raise the state max share cap for this service-year.',
          });
          continue;
        }

        if (exactShare > profile.upperShare + SHARE_TOLERANCE) {
          diagnostics.push({
            code: 'exact_control_activity_conflict',
            severity: 'error',
            reason: 'activity_exhaustion',
            message: `${group.outputLabel} in ${group.year} needs ${formatNumber(exactShare * group.demand)} units from ${profile.row.stateLabel}, but its max activity is ${formatNumber(profile.maxActivityLimit ?? 0)}.`,
            ...buildConstraintContext(group.outputId, group.year, profile.row.stateId, profile.row.rowId),
            relatedConstraintIds: [stateConstraintId(controlConstraintPrefix(group.control.mode), profile.row), stateConstraintId('max_activity', profile.row)],
            suggestion: 'Relax the exact control, increase max activity, or shift activity to additional states.',
          });
        }

        if (exactShare + SHARE_TOLERANCE < profile.lowerShare) {
          diagnostics.push({
            code: 'exact_control_min_share_conflict',
            severity: 'error',
            reason: 'pinned_fixed_share_conflict',
            message: `${group.outputLabel} in ${group.year} assigns ${sharePercent(exactShare)} to ${profile.row.stateLabel}, below its minimum share of ${sharePercent(profile.lowerShare)}.`,
            ...buildConstraintContext(group.outputId, group.year, profile.row.stateId, profile.row.rowId),
            relatedConstraintIds: [stateConstraintId(controlConstraintPrefix(group.control.mode), profile.row), stateConstraintId('min_share', profile.row)],
            suggestion: 'Relax the exact control or lower the minimum-share bound for the affected state.',
          });
        }
      }

      continue;
    }

    if (activeProfiles.length === 0) {
      diagnostics.push({
        code: 'service_states_disabled',
        severity: 'error',
        reason: 'disabled_states',
        message: `${group.outputLabel} in ${group.year} has positive demand but every available state is disabled.`,
        ...buildConstraintContext(group.outputId, group.year),
        relatedConstraintIds: disabledProfiles.map((profile) => stateConstraintId('disabled', profile.row)),
        suggestion: 'Re-enable at least one state for this service-year or drop the demand to zero.',
      });
      continue;
    }

    const lowerTotal = sumShares(activeProfiles, 'lowerShare');
    if (lowerTotal > 1 + SHARE_TOLERANCE) {
      diagnostics.push({
        code: 'service_min_share_exhaustion',
        severity: 'error',
        reason: 'share_exhaustion',
        message: `${group.outputLabel} in ${group.year} requires at least ${sharePercent(lowerTotal)} of demand once minimum-share bounds are applied.`,
        ...buildConstraintContext(group.outputId, group.year),
        relatedConstraintIds: activeProfiles
          .filter((profile) => profile.lowerShare > SHARE_TOLERANCE)
          .map((profile) => stateConstraintId('min_share', profile.row)),
        suggestion: 'Lower one or more minimum-share bounds so the total minimum share is at most 100%.',
      });
    }

    const upperTotal = sumShares(activeProfiles, 'upperShare');
    if (upperTotal < 1 - SHARE_TOLERANCE) {
      const upperIgnoringActivityTotal = sumShares(activeProfiles, 'upperShareIgnoringActivity');
      const upperWithDisabledStates = sumShares(profiles, 'upperShareIgnoringActivity');

      if (disabledProfiles.length > 0 && upperWithDisabledStates >= 1 - SHARE_TOLERANCE) {
        diagnostics.push({
          code: 'service_disabled_states_exhausted',
          severity: 'error',
          reason: 'disabled_states',
          message: `${group.outputLabel} in ${group.year} would have enough eligible share if disabled states were re-enabled.`,
          ...buildConstraintContext(group.outputId, group.year),
          relatedConstraintIds: disabledProfiles.map((profile) => stateConstraintId('disabled', profile.row)),
          suggestion: 'Re-enable one or more disabled states for this service-year.',
        });
      }

      if (upperIgnoringActivityTotal < 1 - SHARE_TOLERANCE) {
        diagnostics.push({
          code: 'service_max_share_exhaustion',
          severity: 'error',
          reason: 'share_exhaustion',
          message: `${group.outputLabel} in ${group.year} can cover at most ${sharePercent(upperIgnoringActivityTotal)} of demand under the current max-share bounds.`,
          ...buildConstraintContext(group.outputId, group.year),
          relatedConstraintIds: activeProfiles
            .filter((profile) => profile.maxShareLimit != null)
            .map((profile) => stateConstraintId('max_share', profile.row)),
          suggestion: 'Raise one or more max-share caps or add more eligible states to cover the remaining demand.',
        });
      } else {
        diagnostics.push({
          code: 'service_max_activity_exhaustion',
          severity: 'error',
          reason: 'activity_exhaustion',
          message: `${group.outputLabel} in ${group.year} can supply at most ${formatNumber(upperTotal * group.demand)} units after max-activity caps, below the required ${formatNumber(group.demand)}.`,
          ...buildConstraintContext(group.outputId, group.year),
          relatedConstraintIds: activeProfiles
            .filter((profile) => profile.maxActivityLimit != null)
            .map((profile) => stateConstraintId('max_activity', profile.row)),
          suggestion: 'Increase max activity, re-enable more states, or lower demand for this service-year.',
        });
      }
    }

  }

  return diagnostics;
}

function buildSupplyCommodityInfeasibilityDiagnostics(build: ConfigurationLpBuild): SolveDiagnostic[] {
  const diagnostics: SolveDiagnostic[] = [];

  for (const group of build.supplyGroups) {
    if (group.control.mode === 'externalized') {
      continue;
    }

    const minimumModeledDemand = estimateMinimumCommodityDemand(build, group.commodityId, group.year);
    if (minimumModeledDemand == null) {
      continue;
    }

    const minimumRequiredSupply = minimumModeledDemand + group.externalDemand;
    if (minimumRequiredSupply <= SHARE_TOLERANCE) {
      continue;
    }

    const profiles = buildRowShareProfiles(
      group.rows,
      group.control,
      minimumRequiredSupply,
      build.request,
      group.commodityId,
    );
    const activeProfiles = profiles.filter((profile) => !profile.disabled);
    const disabledProfiles = profiles.filter((profile) => profile.disabled);

    if (group.control.mode === 'fixed_shares') {
      for (const profile of profiles) {
        const exactShare = profile.exactShare ?? 0;

        if (exactShare > profile.upperShareIgnoringActivity + SHARE_TOLERANCE) {
          diagnostics.push({
            code: 'supply_fixed_share_conflict',
            severity: 'error',
            reason: 'pinned_fixed_share_conflict',
            message: `${group.commodityLabel} in ${group.year} assigns ${sharePercent(exactShare)} to ${profile.row.stateLabel}, above its max share of ${sharePercent(profile.maxShareLimit ?? 0)}.`,
            ...buildConstraintContext(group.commodityId, group.year, profile.row.stateId, profile.row.rowId),
            relatedConstraintIds: [stateConstraintId('fixed_share', profile.row), stateConstraintId('max_share', profile.row)],
            suggestion: 'Relax the fixed supply shares or raise the affected max-share cap.',
          });
          continue;
        }

        if (exactShare + SHARE_TOLERANCE < profile.lowerShare) {
          diagnostics.push({
            code: 'supply_fixed_share_min_conflict',
            severity: 'error',
            reason: 'pinned_fixed_share_conflict',
            message: `${group.commodityLabel} in ${group.year} assigns ${sharePercent(exactShare)} to ${profile.row.stateLabel}, below its minimum share of ${sharePercent(profile.lowerShare)}.`,
            ...buildConstraintContext(group.commodityId, group.year, profile.row.stateId, profile.row.rowId),
            relatedConstraintIds: [stateConstraintId('fixed_share', profile.row), stateConstraintId('min_share', profile.row)],
            suggestion: 'Relax the fixed supply shares or lower the state minimum share.',
          });
        }

        if (exactShare > profile.upperShare + SHARE_TOLERANCE) {
          diagnostics.push({
            code: 'supply_fixed_share_activity_conflict',
            severity: 'error',
            reason: 'electricity_balance_conflict',
            message: `${group.commodityLabel} in ${group.year} needs ${formatNumber(exactShare * minimumRequiredSupply)} units from ${profile.row.stateLabel}, but its max activity is ${formatNumber(profile.maxActivityLimit ?? 0)}.`,
            ...buildConstraintContext(group.commodityId, group.year, profile.row.stateId, profile.row.rowId),
            relatedConstraintIds: [stateConstraintId('fixed_share', profile.row), stateConstraintId('max_activity', profile.row)],
            suggestion: 'Relax the supply fixed shares, raise the max activity cap, or lower electricity demand.',
          });
        }
      }
    } else if (group.control.mode === 'optimize') {
      if (activeProfiles.length === 0) {
        diagnostics.push({
          code: 'supply_states_disabled',
          severity: 'error',
          reason: 'disabled_states',
          message: `${group.commodityLabel} in ${group.year} is required, but every supply state is disabled.`,
          ...buildConstraintContext(group.commodityId, group.year),
          relatedConstraintIds: disabledProfiles.map((profile) => stateConstraintId('disabled', profile.row)),
          suggestion: 'Re-enable at least one supply state or externalize the commodity for this year.',
        });
        continue;
      }

      const lowerTotal = sumShares(activeProfiles, 'lowerShare');
      if (lowerTotal > 1 + SHARE_TOLERANCE) {
        diagnostics.push({
          code: 'supply_min_share_exhaustion',
          severity: 'error',
          reason: 'share_exhaustion',
          message: `${group.commodityLabel} in ${group.year} requires at least ${sharePercent(lowerTotal)} of supply once minimum-share bounds are applied.`,
          ...buildConstraintContext(group.commodityId, group.year),
          relatedConstraintIds: activeProfiles
            .filter((profile) => profile.lowerShare > SHARE_TOLERANCE)
            .map((profile) => stateConstraintId('min_share', profile.row)),
          suggestion: 'Lower one or more supply minimum-share bounds so they sum to at most 100%.',
        });
      }

      const upperShareTotal = sumShares(activeProfiles, 'upperShareIgnoringActivity');
      if (upperShareTotal < 1 - SHARE_TOLERANCE) {
        diagnostics.push({
          code: 'supply_max_share_exhaustion',
          severity: 'error',
          reason: 'share_exhaustion',
          message: `${group.commodityLabel} in ${group.year} can cover at most ${sharePercent(upperShareTotal)} of required supply under the current max-share bounds.`,
          ...buildConstraintContext(group.commodityId, group.year),
          relatedConstraintIds: activeProfiles
            .filter((profile) => profile.maxShareLimit != null)
            .map((profile) => stateConstraintId('max_share', profile.row)),
          suggestion: 'Raise one or more max-share caps or externalize the commodity for this year.',
        });
      }
    }

    const maximumSupply = estimateMaximumSupplyActivity(group, build.request);
    if (Number.isFinite(maximumSupply) && maximumSupply + SHARE_TOLERANCE < minimumRequiredSupply) {
      const maximumSupplyIfReenabled = estimateMaximumSupplyActivity(group, build.request, true);
      if (
        disabledProfiles.length > 0
        && Number.isFinite(maximumSupplyIfReenabled)
        && maximumSupplyIfReenabled + SHARE_TOLERANCE >= minimumRequiredSupply
      ) {
        diagnostics.push({
          code: 'electricity_balance_disabled_supply',
          severity: 'error',
          reason: 'disabled_states',
          message: `${group.commodityLabel} in ${group.year} would meet the minimum required ${formatNumber(minimumRequiredSupply)} units if disabled supply states were re-enabled.`,
          ...buildConstraintContext(group.commodityId, group.year),
          relatedConstraintIds: disabledProfiles.map((profile) => stateConstraintId('disabled', profile.row)),
          suggestion: 'Re-enable one or more disabled supply states or externalize the commodity for this year.',
        });
      }

      diagnostics.push({
        code: 'electricity_balance_shortfall',
        severity: 'error',
        reason: 'electricity_balance_conflict',
        message: `${group.commodityLabel} in ${group.year} needs at least ${formatNumber(minimumRequiredSupply)} units to cover modeled and external demand, but the enabled supply states can provide at most ${formatNumber(maximumSupply)}.`,
        ...buildConstraintContext(group.commodityId, group.year),
        relatedConstraintIds: [commodityBalanceConstraintId(group.commodityId, group.year)],
        suggestion: 'Raise supply max activity, relax exact supply controls, re-enable supply states, or externalize the commodity for this year.',
      });
    }
  }

  return diagnostics;
}

function compareDiagnostics(left: SolveDiagnostic, right: SolveDiagnostic): number {
  const severityRank = { error: 0, warning: 1, info: 2 } satisfies Record<SolveDiagnostic['severity'], number>;

  return severityRank[left.severity] - severityRank[right.severity]
    || (left.year ?? 0) - (right.year ?? 0)
    || (left.outputId ?? '').localeCompare(right.outputId ?? '')
    || (left.stateId ?? '').localeCompare(right.stateId ?? '')
    || left.code.localeCompare(right.code)
    || left.message.localeCompare(right.message);
}

function dedupeAndSortDiagnostics(diagnostics: SolveDiagnostic[]): SolveDiagnostic[] {
  const uniqueDiagnostics = new Map<string, SolveDiagnostic>();

  for (const diagnostic of diagnostics) {
    const signature = [
      diagnostic.code,
      diagnostic.severity,
      diagnostic.reason ?? '',
      diagnostic.outputId ?? '',
      diagnostic.year ?? '',
      diagnostic.stateId ?? '',
      diagnostic.rowId ?? '',
      diagnostic.message,
    ].join('|');

    if (!uniqueDiagnostics.has(signature)) {
      uniqueDiagnostics.set(signature, diagnostic);
    }
  }

  return Array.from(uniqueDiagnostics.values()).sort(compareDiagnostics);
}

function buildConfigurationLpModel(request: SolveRequest): ConfigurationLpBuild {
  const constraints: Record<string, ConstraintBounds> = {};
  const trackedConstraints: Record<string, TrackedConstraint> = {};
  const softConstraintVariableIds = new Set<string>();
  const variables: Record<string, Record<string, number>> = {};
  const diagnostics: SolveDiagnostic[] = [];
  const notes: string[] = [];
  const requiredServiceGroups = collectRequiredServiceGroups(request);
  const supplyGroups = collectSupplyCommodityGroups(request);
  const activityScale = resolveActivityScale(request);

  if (requiredServiceGroups.length === 0) {
    throw new Error('Solve request does not include any required-service rows to optimize.');
  }

  for (const group of requiredServiceGroups) {
    diagnostics.push(...validateRequiredServiceGroup(group));
  }

  for (const group of supplyGroups) {
    diagnostics.push(...validateSupplyCommodityGroup(group));
  }

  const ignoredRows = request.rows.filter((row) => row.outputRole === 'optional_removals');
  const activeIgnoredRows = ignoredRows.filter((row) => {
    const control = request.configuration.controlsByOutput[row.outputId]?.[yearKey(row.year)];
    return !control || !control.disabledStateIds.includes(row.stateId);
  });
  const hasUnmodeledFeatures = activeIgnoredRows.length > 0 || request.configuration.options.shareSmoothing.enabled;

  if (ignoredRows.length > 0) {
    const ignoredOutputCount = new Set(ignoredRows.map((row) => row.outputId)).size;
    diagnostics.push({
      code: 'optional_rows_pending',
      severity: 'warning',
      message: `${ignoredRows.length} optional-removal rows across ${ignoredOutputCount} outputs remain outside the current LP core and are ignored for this solve.`,
    });
  }

  if (request.configuration.options.shareSmoothing.enabled) {
    diagnostics.push({
      code: 'share_smoothing_pending',
      severity: 'warning',
      message: 'Share smoothing is enabled in the configuration, but the rollout proxy is not yet enforced in the LP core.',
    });
  }

  const balancedCommodityKeys = new Set(
    supplyGroups
      .filter((group) => group.control.mode !== 'externalized')
      .map((group) => commodityYearKey(group.commodityId, group.year)),
  );

  const activeRows = request.rows.filter((row) => row.outputRole !== 'optional_removals');

  for (const row of activeRows) {
    variables[activityVariableId(row)] = {
      [CONFIGURATION_OBJECTIVE_KEY]: resolveRowObjectiveCost(request, row, balancedCommodityKeys),
    };
  }

  const softConstraintPenaltyPerUnit = request.configuration.options.softConstraints
    ? resolveSoftConstraintPenalty(variables)
    : null;

  const validationErrors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  if (validationErrors.length > 0) {
    return {
      request,
      model: {
        direction: CONFIGURATION_DIRECTION,
        objective: CONFIGURATION_OBJECTIVE_KEY,
        constraints: {},
        variables: {},
      },
      activityScale,
      diagnostics: dedupeAndSortDiagnostics(diagnostics),
      notes,
      hasUnmodeledFeatures,
      activeRows,
      requiredServiceGroups,
      supplyGroups,
      balancedCommodityKeys,
      trackedConstraints,
      softConstraintVariableIds,
      softConstraintPenaltyPerUnit,
    };
  }

  for (const group of requiredServiceGroups) {
    const demandId = demandConstraintId(group.outputId, group.year);
    const disabledStateIds = new Set(group.control.disabledStateIds);
    const fixedShares = group.control.fixedShares ?? {};
    const maxShareLookup = buildEffectiveMaxShareLookup(group.rows, group.control);

    trackConstraint(
      constraints,
      trackedConstraints,
      demandId,
      scaleConstraintBounds({ equal: group.demand }, activityScale),
      {
      kind: 'service_demand',
      outputId: group.outputId,
      outputLabel: group.outputLabel,
      year: group.year,
      mode: group.control.mode,
      message: `Meet required demand for ${group.outputLabel} in ${group.year}.`,
      },
    );

    for (const row of group.rows) {
      const variableId = activityVariableId(row);
      setVariableConstraintCoefficient(variables, variableId, demandId, 1);

      if (disabledStateIds.has(row.stateId)) {
        addConstraint(
          constraints,
          trackedConstraints,
          variables,
          variableId,
          stateConstraintId('disabled', row),
          scaleConstraintBounds({ equal: 0 }, activityScale),
          {
            kind: 'disabled_state',
            outputId: row.outputId,
            outputLabel: row.outputLabel,
            year: row.year,
            stateId: row.stateId,
            stateLabel: row.stateLabel,
            rowId: row.rowId,
            mode: group.control.mode,
            message: `${row.stateLabel} is disabled for ${row.outputLabel} in ${row.year}.`,
          },
        );
        continue;
      }

      if (group.control.mode === 'pinned_single') {
        addConstraint(
          constraints,
          trackedConstraints,
          variables,
          variableId,
          stateConstraintId('pinned', row),
          scaleConstraintBounds({ equal: row.stateId === group.control.stateId ? group.demand : 0 }, activityScale),
          {
            kind: 'pinned_state',
            outputId: row.outputId,
            outputLabel: row.outputLabel,
            year: row.year,
            stateId: row.stateId,
            stateLabel: row.stateLabel,
            rowId: row.rowId,
            mode: group.control.mode,
            message: `${row.stateLabel} is pinned for ${row.outputLabel} in ${row.year}.`,
          },
        );
      } else if (group.control.mode === 'fixed_shares') {
        addConstraint(
          constraints,
          trackedConstraints,
          variables,
          variableId,
          stateConstraintId('fixed_share', row),
          scaleConstraintBounds({ equal: (fixedShares[row.stateId] ?? 0) * group.demand }, activityScale),
          {
            kind: 'fixed_share',
            outputId: row.outputId,
            outputLabel: row.outputLabel,
            year: row.year,
            stateId: row.stateId,
            stateLabel: row.stateLabel,
            rowId: row.rowId,
            mode: group.control.mode,
            message: `${row.stateLabel} follows the fixed share for ${row.outputLabel} in ${row.year}.`,
          },
        );
      }

      if (row.bounds.minShare != null) {
        addConstraint(
          constraints,
          trackedConstraints,
          variables,
          variableId,
          stateConstraintId('min_share', row),
          scaleConstraintBounds({ min: row.bounds.minShare * group.demand }, activityScale),
          {
            kind: 'min_share',
            outputId: row.outputId,
            outputLabel: row.outputLabel,
            year: row.year,
            stateId: row.stateId,
            stateLabel: row.stateLabel,
            rowId: row.rowId,
            mode: group.control.mode,
            message: `${row.stateLabel} keeps at least its minimum share in ${row.outputLabel} ${row.year}.`,
          },
        );
      }

      const maxShareLimit = maxShareLookup.get(row.rowId)?.effectiveMaxShare ?? null;
      if (request.configuration.options.respectMaxShare && maxShareLimit != null) {
        const constraintId = stateConstraintId('max_share', row);
        addConstraint(
          constraints,
          trackedConstraints,
          variables,
          variableId,
          constraintId,
          scaleConstraintBounds({ max: maxShareLimit * group.demand }, activityScale),
          {
            kind: 'max_share',
            outputId: row.outputId,
            outputLabel: row.outputLabel,
            year: row.year,
            stateId: row.stateId,
            stateLabel: row.stateLabel,
            rowId: row.rowId,
            mode: group.control.mode,
            message: `${row.stateLabel} stays within its max share for ${row.outputLabel} in ${row.year}.`,
          },
        );

        if (softConstraintPenaltyPerUnit != null) {
          softenTrackedConstraint(
            variables,
            trackedConstraints,
            softConstraintVariableIds,
            constraintId,
            softConstraintPenaltyPerUnit,
          );
        }
      }

      if (request.configuration.options.respectMaxActivity && row.bounds.maxActivity != null) {
        const constraintId = stateConstraintId('max_activity', row);
        addConstraint(
          constraints,
          trackedConstraints,
          variables,
          variableId,
          constraintId,
          scaleConstraintBounds({ max: row.bounds.maxActivity }, activityScale),
          {
            kind: 'max_activity',
            outputId: row.outputId,
            outputLabel: row.outputLabel,
            year: row.year,
            stateId: row.stateId,
            stateLabel: row.stateLabel,
            rowId: row.rowId,
            mode: group.control.mode,
            message: `${row.stateLabel} stays within its max activity for ${row.outputLabel} in ${row.year}.`,
          },
        );

        if (softConstraintPenaltyPerUnit != null) {
          softenTrackedConstraint(
            variables,
            trackedConstraints,
            softConstraintVariableIds,
            constraintId,
            softConstraintPenaltyPerUnit,
          );
        }
      }
    }
  }

  for (const group of supplyGroups) {
    const variableIds = group.rows.map((row) => activityVariableId(row));
    const disabledStateIds = new Set(group.control.disabledStateIds);
    const fixedShares = group.control.fixedShares ?? {};
    const maxShareLookup = buildEffectiveMaxShareLookup(group.rows, group.control);

    if (group.control.mode === 'externalized') {
      for (const row of group.rows) {
        addConstraint(
          constraints,
          trackedConstraints,
          variables,
          activityVariableId(row),
          stateConstraintId('externalized', row),
          scaleConstraintBounds({ equal: 0 }, activityScale),
          {
            kind: 'externalized_supply',
            outputId: row.outputId,
            outputLabel: row.outputLabel,
            year: row.year,
            stateId: row.stateId,
            stateLabel: row.stateLabel,
            rowId: row.rowId,
            commodityId: group.commodityId,
            mode: group.control.mode,
            message: `${row.stateLabel} is bypassed because ${row.outputLabel} is externalized in ${row.year}.`,
          },
        );
      }

      continue;
    }

    const balanceId = commodityBalanceConstraintId(group.commodityId, group.year);
    trackConstraint(
      constraints,
      trackedConstraints,
      balanceId,
      scaleConstraintBounds({ equal: group.externalDemand }, activityScale),
      {
      kind: 'commodity_balance',
      outputId: group.commodityId,
      outputLabel: group.commodityLabel,
      year: group.year,
      commodityId: group.commodityId,
      mode: group.control.mode,
      message: `${group.commodityLabel} balances modeled and external demand in ${group.year}.`,
      },
    );

    for (const row of activeRows) {
      if (row.year !== group.year || row.outputId === group.commodityId) {
        continue;
      }

      const coefficient = sumInputCoefficient(row, group.commodityId);
      if (coefficient !== 0) {
        setVariableConstraintCoefficient(variables, activityVariableId(row), balanceId, -coefficient);
      }
    }

    for (const row of group.rows) {
      const variableId = activityVariableId(row);
      setVariableConstraintCoefficient(variables, variableId, balanceId, 1);

      if (disabledStateIds.has(row.stateId)) {
        addConstraint(
          constraints,
          trackedConstraints,
          variables,
          variableId,
          stateConstraintId('disabled', row),
          scaleConstraintBounds({ equal: 0 }, activityScale),
          {
            kind: 'disabled_state',
            outputId: row.outputId,
            outputLabel: row.outputLabel,
            year: row.year,
            stateId: row.stateId,
            stateLabel: row.stateLabel,
            rowId: row.rowId,
            commodityId: group.commodityId,
            mode: group.control.mode,
            message: `${row.stateLabel} is disabled for ${row.outputLabel} in ${row.year}.`,
          },
        );
        continue;
      }

      if (group.control.mode === 'fixed_shares') {
        addShareConstraint(
          constraints,
          trackedConstraints,
          variables,
          variableIds,
          variableId,
          fixedShares[row.stateId] ?? 0,
          stateConstraintId('fixed_share', row),
          { equal: 0 },
          {
            kind: 'fixed_share',
            outputId: row.outputId,
            outputLabel: row.outputLabel,
            year: row.year,
            stateId: row.stateId,
            stateLabel: row.stateLabel,
            rowId: row.rowId,
            commodityId: group.commodityId,
            mode: group.control.mode,
            message: `${row.stateLabel} follows the fixed share for ${row.outputLabel} in ${row.year}.`,
          },
        );
      }

      if (row.bounds.minShare != null) {
        addShareConstraint(
          constraints,
          trackedConstraints,
          variables,
          variableIds,
          variableId,
          row.bounds.minShare,
          stateConstraintId('min_share', row),
          { min: 0 },
          {
            kind: 'min_share',
            outputId: row.outputId,
            outputLabel: row.outputLabel,
            year: row.year,
            stateId: row.stateId,
            stateLabel: row.stateLabel,
            rowId: row.rowId,
            commodityId: group.commodityId,
            mode: group.control.mode,
            message: `${row.stateLabel} keeps at least its minimum share in ${row.outputLabel} ${row.year}.`,
          },
        );
      }

      const maxShareLimit = maxShareLookup.get(row.rowId)?.effectiveMaxShare ?? null;
      if (request.configuration.options.respectMaxShare && maxShareLimit != null) {
        const constraintId = stateConstraintId('max_share', row);
        addShareConstraint(
          constraints,
          trackedConstraints,
          variables,
          variableIds,
          variableId,
          maxShareLimit,
          constraintId,
          { max: 0 },
          {
            kind: 'max_share',
            outputId: row.outputId,
            outputLabel: row.outputLabel,
            year: row.year,
            stateId: row.stateId,
            stateLabel: row.stateLabel,
            rowId: row.rowId,
            commodityId: group.commodityId,
            mode: group.control.mode,
            message: `${row.stateLabel} stays within its max share for ${row.outputLabel} in ${row.year}.`,
          },
        );

        if (softConstraintPenaltyPerUnit != null) {
          softenTrackedConstraint(
            variables,
            trackedConstraints,
            softConstraintVariableIds,
            constraintId,
            softConstraintPenaltyPerUnit,
          );
        }
      }

      if (request.configuration.options.respectMaxActivity && row.bounds.maxActivity != null) {
        const constraintId = stateConstraintId('max_activity', row);
        addConstraint(
          constraints,
          trackedConstraints,
          variables,
          variableId,
          constraintId,
          scaleConstraintBounds({ max: row.bounds.maxActivity }, activityScale),
          {
            kind: 'max_activity',
            outputId: row.outputId,
            outputLabel: row.outputLabel,
            year: row.year,
            stateId: row.stateId,
            stateLabel: row.stateLabel,
            rowId: row.rowId,
            commodityId: group.commodityId,
            mode: group.control.mode,
            message: `${row.stateLabel} stays within its max activity for ${row.outputLabel} in ${row.year}.`,
          },
        );

        if (softConstraintPenaltyPerUnit != null) {
          softenTrackedConstraint(
            variables,
            trackedConstraints,
            softConstraintVariableIds,
            constraintId,
            softConstraintPenaltyPerUnit,
          );
        }
      }
    }
  }

  const softConstraintCount = Object.values(trackedConstraints).filter((constraint) => constraint.softConstraint).length;

  const endogenousSupplyGroupCount = supplyGroups.filter((group) => group.control.mode !== 'externalized').length;
  const externalizedSupplyGroupCount = supplyGroups.length - endogenousSupplyGroupCount;

  notes.push(
    `Built a generic LP over ${requiredServiceGroups.length} required-service groups, ${endogenousSupplyGroupCount} endogenous-supply groups, ${activeRows.length} activity variables, and ${softConstraintCount} soft-slack variables.`,
  );
  notes.push(
    'Objective coefficients combine row conversion cost, exogenously priced non-balanced commodity inputs, and direct-emissions carbon cost using the resolved configuration tables.',
  );
  notes.push(
    `Electricity-style supply commodities enforce balance when they stay in-model; ${externalizedSupplyGroupCount} supply-year groups are externalized and fixed to zero activity.`,
  );
  if (activityScale > 1) {
    notes.push(
      `Activity variables are internally scaled by ${formatNumber(activityScale)} for numerical stability before solving, then rescaled in the reported results.`,
    );
  }
  if (softConstraintPenaltyPerUnit != null) {
    notes.push(
      `Soft-constraint mode relaxes ${softConstraintCount} max-share and max-activity bounds with a penalty of ${formatNumber(softConstraintPenaltyPerUnit)} per slack unit.`,
    );
  }

  return {
    request,
    model: {
      direction: CONFIGURATION_DIRECTION,
      objective: CONFIGURATION_OBJECTIVE_KEY,
      constraints,
      variables,
    },
    activityScale,
    diagnostics: dedupeAndSortDiagnostics(diagnostics),
    notes,
    hasUnmodeledFeatures,
    activeRows,
    requiredServiceGroups,
    supplyGroups,
    balancedCommodityKeys,
    trackedConstraints,
    softConstraintVariableIds,
    softConstraintPenaltyPerUnit,
  };
}

function buildInfeasibilityDiagnostics(build: ConfigurationLpBuild): SolveDiagnostic[] {
  return dedupeAndSortDiagnostics([
    ...buildRequiredServiceInfeasibilityDiagnostics(build),
    ...buildSupplyCommodityInfeasibilityDiagnostics(build),
  ]);
}

function buildDiagnostics(
  solution: Solution<string> | null,
  build: ConfigurationLpBuild,
): SolveDiagnostic[] {
  const diagnostics = [...build.diagnostics];

  diagnostics.push({
    code: 'worker_boundary_ready',
    severity: 'info',
    message: 'The solve request was normalized, transferred to a Web Worker, and executed through the LP adapter.',
  });

  if (!solution) {
    return dedupeAndSortDiagnostics(diagnostics);
  }

  diagnostics.push({
    code: 'service_and_supply_lp_completed',
    severity: solution.status === 'optimal' ? 'info' : 'warning',
    message: `The service-and-supply LP core completed with status ${solution.status}.`,
  });

  diagnostics.push(...buildSoftConstraintDiagnostics(solution, build));

  if (solution.status !== 'optimal') {
    diagnostics.push({
      code: 'service_and_supply_lp_not_optimal',
      severity: 'error',
      message: 'The current LP core could not find an optimal feasible solution for the required-service and endogenous-supply constraints.',
    });
    diagnostics.push(...buildInfeasibilityDiagnostics(build));
  }

  if (build.hasUnmodeledFeatures && solution.status === 'optimal') {
    diagnostics.push({
      code: 'partial_domain_coverage',
      severity: 'warning',
      message: 'The LP solved required services and in-model supply commodities, but removals or rollout smoothing still need downstream tasks.',
    });
  }

  return dedupeAndSortDiagnostics(diagnostics);
}

function buildSoftConstraintDiagnostics(
  solution: Solution<string>,
  build: ConfigurationLpBuild,
): SolveDiagnostic[] {
  if (!build.request.configuration.options.softConstraints) {
    return [];
  }

  const diagnostics: SolveDiagnostic[] = [
    {
      code: 'soft_constraints_enabled',
      severity: 'info',
      message: `Soft-constraint mode is enabled for max-share and max-activity bounds with a penalty of ${formatNumber(build.softConstraintPenaltyPerUnit ?? 0)} per slack unit.`,
    },
  ];

  if (solution.status !== 'optimal') {
    return diagnostics;
  }

  for (const violation of buildSoftConstraintViolationSummary(solution, build)) {
    const kindLabel = violation.kind === 'max_share' ? 'max share' : 'max activity';
    diagnostics.push({
      code: violation.kind === 'max_share' ? 'soft_max_share_relaxed' : 'soft_max_activity_relaxed',
      severity: 'warning',
      reason: violation.kind === 'max_share' ? 'share_exhaustion' : 'activity_exhaustion',
      message: `Soft-constraint mode let ${violation.stateLabel ?? violation.outputLabel} exceed its ${kindLabel} for ${violation.outputLabel} in ${violation.year} by ${formatNumber(violation.slack)} units at a penalty of ${formatNumber(violation.totalPenalty)}.`,
      ...buildConstraintContext(violation.outputId, violation.year, violation.stateId, violation.rowId),
      relatedConstraintIds: [violation.constraintId],
      suggestion: violation.kind === 'max_share'
        ? 'Raise the max-share cap, add more eligible states, or switch back to hard constraints once the diagnosis is complete.'
        : 'Raise the max-activity cap, add more supply options, or switch back to hard constraints once the diagnosis is complete.',
    });
  }

  return diagnostics;
}

function buildScaledVariableValueMap(solution: Solution<string>): Map<string, number> {
  return new Map(solution.variables);
}

function buildVariableValueMap(solution: Solution<string>, activityScale: number): Map<string, number> {
  return new Map(solution.variables.map(([id, value]) => [id, unscaleActivityValue(value, activityScale)]));
}

function buildStateShareSummary(
  request: SolveRequest,
  rows: NormalizedSolverRow[],
  variableValues: Map<string, number>,
): SolveStateShareSummary[] {
  const groupedRows = new Map<string, { outputId: string; outputLabel: string; year: number; rows: NormalizedSolverRow[] }>();

  for (const row of rows) {
    const key = commodityYearKey(row.outputId, row.year);
    const existing = groupedRows.get(key);

    if (existing) {
      existing.rows.push(row);
      continue;
    }

    groupedRows.set(key, {
      outputId: row.outputId,
      outputLabel: row.outputLabel,
      year: row.year,
      rows: [row],
    });
  }

  return Array.from(groupedRows.values())
    .sort((left, right) => {
      if (left.year !== right.year) {
        return left.year - right.year;
      }

      return left.outputId.localeCompare(right.outputId);
    })
    .flatMap((group) => {
      const control = request.configuration.controlsByOutput[group.outputId]?.[yearKey(group.year)];
      if (!control) {
        throw new Error(`Missing resolved control for ${JSON.stringify(group.outputId)} in ${group.year}.`);
      }

      const maxShareLookup = buildEffectiveMaxShareLookup(group.rows, control);
      const totalActivity = group.rows.reduce((total, row) => {
        return total + (variableValues.get(activityVariableId(row)) ?? 0);
      }, 0);

      return [...group.rows]
        .sort((left, right) => left.stateLabel.localeCompare(right.stateLabel))
        .map((row) => {
          const activity = variableValues.get(activityVariableId(row)) ?? 0;
          const resolvedMaxShare = maxShareLookup.get(row.rowId) ?? {
            rawMaxShare: row.bounds.maxShare == null ? null : clampShare(row.bounds.maxShare),
            effectiveMaxShare: null,
          };
          return {
            outputId: group.outputId,
            outputLabel: group.outputLabel,
            year: group.year,
            stateId: row.stateId,
            stateLabel: row.stateLabel,
            activity,
            share: totalActivity > 0 ? activity / totalActivity : null,
            rawMaxShare: resolvedMaxShare.rawMaxShare,
            effectiveMaxShare: resolvedMaxShare.effectiveMaxShare,
          } satisfies SolveStateShareSummary;
        });
    });
}

function buildCommodityBalanceSummary(
  request: SolveRequest,
  build: ConfigurationLpBuild,
  variableValues: Map<string, number>,
): SolveCommodityBalanceSummary[] {
  return build.supplyGroups.map((group) => {
    const mode: CommoditySolveMode = group.control.mode === 'externalized' ? 'externalized' : 'endogenous';
    const supply = group.rows.reduce((total, row) => {
      return total + (variableValues.get(activityVariableId(row)) ?? 0);
    }, 0);
    const modeledDemand = build.activeRows.reduce((total, row) => {
      if (row.year !== group.year || row.outputId === group.commodityId) {
        return total;
      }

      const activity = variableValues.get(activityVariableId(row)) ?? 0;
      if (activity === 0) {
        return total;
      }

      return total + sumInputCoefficient(row, group.commodityId) * activity;
    }, 0);
    const totalDemand = modeledDemand + group.externalDemand;
    const averageSupplyCost = supply > 0
      ? group.rows.reduce((total, row) => {
        const activity = variableValues.get(activityVariableId(row)) ?? 0;
        return total + resolveRowObjectiveCost(request, row, build.balancedCommodityKeys) * activity;
      }, 0) / supply
      : mode === 'externalized'
        ? resolveCommodityPrice(request, group.commodityId, group.year)
        : null;
    const averageDirectEmissionsIntensity = supply > 0
      ? group.rows.reduce((total, row) => {
        const activity = variableValues.get(activityVariableId(row)) ?? 0;
        return total + sumDirectEmissionsPerUnit(row) * activity;
      }, 0) / supply
      : null;

    return {
      commodityId: group.commodityId,
      year: group.year,
      mode,
      supply,
      modeledDemand,
      externalDemand: group.externalDemand,
      totalDemand,
      pricedExogenousDemand: mode === 'externalized' ? totalDemand : 0,
      balanceGap: mode === 'endogenous' ? supply - totalDemand : null,
      averageSupplyCost,
      averageDirectEmissionsIntensity,
    } satisfies SolveCommodityBalanceSummary;
  });
}

function computeConstraintActualValue(
  constraintId: string,
  model: Model<string, string>,
  variableValues: Map<string, number>,
  ignoredVariableIds: ReadonlySet<string> = new Set<string>(),
): number {
  let total = 0;

  for (const [variableId, coefficients] of Object.entries(model.variables)) {
    if (ignoredVariableIds.has(variableId)) {
      continue;
    }

    const coefficient = coefficients[constraintId];
    if (typeof coefficient !== 'number') {
      continue;
    }

    total += coefficient * (variableValues.get(variableId) ?? 0);
  }

  return total;
}

function buildBindingConstraintSummary(
  solution: Solution<string>,
  build: ConfigurationLpBuild,
): SolveBindingConstraintSummary[] {
  const variableValues = buildScaledVariableValueMap(solution);

  return Object.values(build.trackedConstraints)
    .filter((constraint) => constraint.kind !== 'service_demand')
    .map((constraint) => {
      const scaledActualValue = computeConstraintActualValue(
        constraint.constraintId,
        build.model,
        variableValues,
        build.softConstraintVariableIds,
      );
      const scaledSlack = constraint.boundType === 'equal'
        ? Math.abs(scaledActualValue - constraint.boundValue)
        : constraint.boundType === 'min'
          ? scaledActualValue - constraint.boundValue
          : constraint.boundValue - scaledActualValue;

      return {
        constraintId: constraint.constraintId,
        kind: constraint.kind,
        boundType: constraint.boundType,
        boundValue: unscaleActivityValue(constraint.boundValue, build.activityScale),
        actualValue: unscaleActivityValue(scaledActualValue, build.activityScale),
        slack: unscaleActivityValue(scaledSlack, build.activityScale),
        outputId: constraint.outputId,
        outputLabel: constraint.outputLabel,
        year: constraint.year,
        stateId: constraint.stateId,
        stateLabel: constraint.stateLabel,
        rowId: constraint.rowId,
        commodityId: constraint.commodityId,
        mode: constraint.mode,
        message: constraint.message,
      } satisfies SolveBindingConstraintSummary;
    })
    .filter((constraint) => Math.abs(constraint.slack) <= BINDING_TOLERANCE)
    .sort((left, right) => {
      return left.year - right.year
        || left.outputId.localeCompare(right.outputId)
        || left.kind.localeCompare(right.kind)
        || (left.stateId ?? '').localeCompare(right.stateId ?? '')
        || left.constraintId.localeCompare(right.constraintId);
    });
}

function buildSoftConstraintViolationSummary(
  solution: Solution<string>,
  build: ConfigurationLpBuild,
): SolveSoftConstraintViolationSummary[] {
  const variableValues = buildScaledVariableValueMap(solution);

  return Object.values(build.trackedConstraints)
    .filter((constraint): constraint is TrackedConstraint & { softConstraint: SoftConstraintMetadata } => {
      return constraint.softConstraint != null;
    })
    .map((constraint) => {
      const scaledSlack = variableValues.get(constraint.softConstraint.variableId) ?? 0;
      const scaledActualValue = computeConstraintActualValue(
        constraint.constraintId,
        build.model,
        variableValues,
        build.softConstraintVariableIds,
      );
      const slack = unscaleActivityValue(scaledSlack, build.activityScale);

      return {
        constraintId: constraint.constraintId,
        kind: constraint.kind as SoftConstraintKind,
        boundType: constraint.boundType,
        boundValue: unscaleActivityValue(constraint.boundValue, build.activityScale),
        actualValue: unscaleActivityValue(scaledActualValue, build.activityScale),
        slack,
        penaltyPerUnit: constraint.softConstraint.penaltyPerUnit,
        totalPenalty: slack * constraint.softConstraint.penaltyPerUnit,
        outputId: constraint.outputId,
        outputLabel: constraint.outputLabel,
        year: constraint.year,
        stateId: constraint.stateId,
        stateLabel: constraint.stateLabel,
        rowId: constraint.rowId,
        commodityId: constraint.commodityId,
        mode: constraint.mode,
        message: constraint.message,
      } satisfies SolveSoftConstraintViolationSummary;
    })
    .filter((constraint) => constraint.slack > BINDING_TOLERANCE)
    .sort((left, right) => {
      return left.year - right.year
        || left.outputId.localeCompare(right.outputId)
        || left.kind.localeCompare(right.kind)
        || (left.stateId ?? '').localeCompare(right.stateId ?? '')
        || left.constraintId.localeCompare(right.constraintId);
    });
}

function buildReportingSummary(
  request: SolveRequest,
  solution: Solution<string>,
  build: ConfigurationLpBuild,
): SolveReportingSummary {
  const variableValues = buildVariableValueMap(solution, build.activityScale);

  return {
    commodityBalances: buildCommodityBalanceSummary(request, build, variableValues),
    stateShares: buildStateShareSummary(request, build.activeRows, variableValues),
    bindingConstraints: buildBindingConstraintSummary(solution, build),
    softConstraintViolations: buildSoftConstraintViolationSummary(solution, build),
  };
}

function buildAdapterErrorResult(
  request: SolveRequest,
  startedAt: number,
  diagnostics: SolveDiagnostic[],
): SolveResult {
  return {
    contractVersion: request.contractVersion,
    requestId: request.requestId,
    status: 'error',
    engine: { name: 'yalps', worker: true },
    summary: summarizeRequest(request),
    reporting: emptyReporting(),
    raw: null,
    diagnostics,
    timingsMs: {
      total: performance.now() - startedAt,
      solve: 0,
    },
  };
}

export function inspectConfigurationLpBuild(request: SolveRequest) {
  const build = buildConfigurationLpModel(request);

  return {
    diagnostics: build.diagnostics,
    notes: build.notes,
    requiredServiceGroups: build.requiredServiceGroups.map((group) => ({
      outputId: group.outputId,
      outputLabel: group.outputLabel,
      year: group.year,
      demand: group.demand,
      mode: group.control.mode,
      disabledStateIds: group.control.disabledStateIds,
      rowCount: group.rows.length,
    })),
    supplyGroups: build.supplyGroups.map((group) => ({
      commodityId: group.commodityId,
      commodityLabel: group.commodityLabel,
      year: group.year,
      externalDemand: group.externalDemand,
      mode: group.control.mode,
      disabledStateIds: group.control.disabledStateIds,
      rowCount: group.rows.length,
    })),
    variableCount: Object.keys(build.model.variables).length,
    constraintCount: Object.keys(build.model.constraints).length,
  };
}

export function solveWithLpAdapter(request: SolveRequest): SolveResult {
  const startedAt = performance.now();

  if (request.rows.length === 0) {
    return buildAdapterErrorResult(request, startedAt, [
      {
        code: 'empty_rows',
        severity: 'error',
        message: 'Solve requests must include at least one normalized library row.',
      },
    ]);
  }

  const build = buildConfigurationLpModel(request);
  const validationErrors = build.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');

  if (validationErrors.length > 0) {
    return buildAdapterErrorResult(request, startedAt, buildDiagnostics(null, build));
  }

  const solveStartedAt = performance.now();
  const solution = solve(build.model, {
    includeZeroVariables: true,
  });
  const solveDurationMs = performance.now() - solveStartedAt;
  const diagnostics = buildDiagnostics(solution, build);

  return {
    contractVersion: request.contractVersion,
    requestId: request.requestId,
    status: solution.status === 'optimal'
      ? build.hasUnmodeledFeatures
        ? 'partial'
        : 'solved'
      : 'error',
    engine: { name: 'yalps', worker: true },
    summary: summarizeRequest(request),
    reporting: solution.status === 'optimal'
      ? buildReportingSummary(request, solution, build)
      : emptyReporting(),
    raw: {
      kind: 'configuration_lp',
      objectiveDirection: CONFIGURATION_DIRECTION,
      objectiveKey: CONFIGURATION_OBJECTIVE_KEY,
      variableCount: Object.keys(build.model.variables).length,
      constraintCount: Object.keys(build.model.constraints).length,
      notes: build.notes,
      solutionStatus: solution.status,
      objectiveValue: Number.isFinite(solution.result)
        ? unscaleActivityValue(solution.result, build.activityScale)
        : null,
      variables: toRawVariables(solution, build.activityScale),
    },
    diagnostics,
    timingsMs: {
      total: performance.now() - startedAt,
      solve: solveDurationMs,
    },
  };
}
