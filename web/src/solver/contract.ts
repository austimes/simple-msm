import type { OutputRole, ConfigurationControlMode } from '../data/types.ts';

export const SOLVER_CONTRACT_VERSION = 3 as const;

export type SolverContractVersion = typeof SOLVER_CONTRACT_VERSION;
export type SolveStatus = 'partial' | 'solved' | 'error';
export type SolveDiagnosticSeverity = 'info' | 'warning' | 'error';
export type SolveDiagnosticReason =
  | 'exact_share_conflict'
  | 'share_exhaustion'
  | 'activity_exhaustion'
  | 'disabled_states'
  | 'electricity_balance_conflict';
// `configuration_lp` is an internal artifact label, so it can move with the solver
// contract when the broader terminology cleanup reaches this boundary.
export type RawSolveArtifactKind = 'engine_probe' | 'configuration_lp';
export type RawSolveSolutionStatus =
  | 'optimal'
  | 'infeasible'
  | 'unbounded'
  | 'timedout'
  | 'cycled';

export interface NormalizedSolverInput {
  commodityId: string;
  coefficient: number;
  unit: string;
}

export interface NormalizedSolverEmission {
  pollutant: string;
  value: number;
  source: 'energy' | 'process';
}

export interface NormalizedSolverRow {
  rowId: string;
  outputId: string;
  outputRole: OutputRole;
  outputLabel: string;
  year: number;
  stateId: string;
  stateLabel: string;
  sector: string;
  subsector: string;
  region: string;
  outputUnit: string;
  conversionCostPerUnit: number | null;
  inputs: NormalizedSolverInput[];
  directEmissions: NormalizedSolverEmission[];
  bounds: {
    minShare: number | null;
    maxShare: number | null;
    maxActivity: number | null;
  };
}

export interface ResolvedSolveControl {
  mode: ConfigurationControlMode;
  fixedShares: Record<string, number> | null;
  disabledStateIds: string[];
  targetValue: number | null;
}

export interface ResolvedCommodityPriceSeries {
  unit: string;
  valuesByYear: Record<string, number>;
}

export interface ResolvedConfigurationForSolve {
  name: string;
  description: string | null;
  years: number[];
  controlsByOutput: Record<string, Record<string, ResolvedSolveControl>>;
  serviceDemandByOutput: Record<string, Record<string, number>>;
  externalCommodityDemandByCommodity: Record<string, Record<string, number>>;
  commodityPriceByCommodity: Record<string, ResolvedCommodityPriceSeries>;
  carbonPriceByYear: Record<string, number>;
  options: {
    respectMaxShare: boolean;
    respectMaxActivity: boolean;
    softConstraints: boolean;
    allowRemovalsCredit: boolean;
    shareSmoothing: {
      enabled: boolean;
      maxDeltaPp: number | null;
    };
  };
}

export interface SolveRequest {
  contractVersion: SolverContractVersion;
  requestId: string;
  rows: NormalizedSolverRow[];
  configuration: ResolvedConfigurationForSolve;
}

export interface SolveDiagnostic {
  code: string;
  severity: SolveDiagnosticSeverity;
  message: string;
  reason?: SolveDiagnosticReason;
  outputId?: string;
  year?: number;
  stateId?: string;
  rowId?: string;
  relatedConstraintIds?: string[];
  suggestion?: string;
}

export interface RawSolveVariableValue {
  id: string;
  value: number;
}

export interface RawSolveArtifact {
  kind: RawSolveArtifactKind;
  objectiveDirection: 'minimize' | 'maximize';
  objectiveKey: string;
  variableCount: number;
  constraintCount: number;
  notes: string[];
  solutionStatus: RawSolveSolutionStatus;
  objectiveValue: number | null;
  variables: RawSolveVariableValue[];
}

export interface SolveRequestSummary {
  rowCount: number;
  yearCount: number;
  outputCount: number;
  serviceDemandOutputCount: number;
  externalCommodityCount: number;
}

export type CommoditySolveMode = 'endogenous' | 'externalized';
export type SolveConstraintBoundType = 'equal' | 'min' | 'max';
export type SolveConstraintKind =
  | 'service_demand'
  | 'commodity_balance'
  | 'fixed_share'
  | 'min_share'
  | 'max_share'
  | 'max_activity'
  | 'disabled_state'
  | 'externalized_supply';
export type SolveSoftConstraintKind = Extract<SolveConstraintKind, 'max_share' | 'max_activity'>;

export interface SolveCommodityBalanceSummary {
  commodityId: string;
  year: number;
  mode: CommoditySolveMode;
  supply: number;
  modeledDemand: number;
  externalDemand: number;
  totalDemand: number;
  pricedExogenousDemand: number;
  balanceGap: number | null;
  averageSupplyCost: number | null;
  averageDirectEmissionsIntensity: number | null;
}

export interface SolveStateShareSummary {
  outputId: string;
  outputLabel: string;
  year: number;
  stateId: string;
  stateLabel: string;
  activity: number;
  share: number | null;
  rawMaxShare: number | null;
  effectiveMaxShare: number | null;
}

export interface SolveBindingConstraintSummary {
  constraintId: string;
  kind: SolveConstraintKind;
  boundType: SolveConstraintBoundType;
  boundValue: number;
  actualValue: number;
  slack: number;
  outputId: string;
  outputLabel: string;
  year: number;
  stateId?: string;
  stateLabel?: string;
  rowId?: string;
  commodityId?: string;
  mode?: ConfigurationControlMode;
  message: string;
}

export interface SolveSoftConstraintViolationSummary {
  constraintId: string;
  kind: SolveSoftConstraintKind;
  boundType: SolveConstraintBoundType;
  boundValue: number;
  actualValue: number;
  slack: number;
  penaltyPerUnit: number;
  totalPenalty: number;
  outputId: string;
  outputLabel: string;
  year: number;
  stateId?: string;
  stateLabel?: string;
  rowId?: string;
  commodityId?: string;
  mode?: ConfigurationControlMode;
  message: string;
}

export interface SolveReportingSummary {
  commodityBalances: SolveCommodityBalanceSummary[];
  stateShares: SolveStateShareSummary[];
  bindingConstraints: SolveBindingConstraintSummary[];
  softConstraintViolations: SolveSoftConstraintViolationSummary[];
}

export interface SolveResult {
  contractVersion: SolverContractVersion;
  requestId: string;
  status: SolveStatus;
  engine: {
    name: 'yalps';
    worker: true;
  };
  summary: SolveRequestSummary;
  reporting: SolveReportingSummary;
  raw: RawSolveArtifact | null;
  diagnostics: SolveDiagnostic[];
  timingsMs: {
    total: number;
    solve: number;
  };
}

export interface SolverWorkerRequestMessage {
  type: 'solve';
  request: SolveRequest;
}

export interface SolverWorkerResponseMessage {
  type: 'solve:result';
  result: SolveResult;
}
