import type {
  BalanceType,
  ConfigurationAutonomousEfficiencyMode,
  ConfigurationControlMode,
  ConfigurationEfficiencyPackageMode,
  EfficiencyPackageClassification,
  OutputRole,
} from '../data/types.ts';

export const SOLVER_CONTRACT_VERSION = 6 as const;

export type SolverContractVersion = typeof SOLVER_CONTRACT_VERSION;
export type SolveStatus = 'partial' | 'solved' | 'error';
export type SolveDiagnosticSeverity = 'info' | 'warning' | 'error';
export type SolveDiagnosticReason =
  | 'share_exhaustion'
  | 'activity_exhaustion'
  | 'inactive_states'
  | 'commodity_balance_conflict'
  | 'decomposition_coverage_conflict'
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

export interface NormalizedSolverRowEfficiencyAttributionBasis {
  baseInputs: NormalizedSolverInput[];
  baseDirectEmissions: NormalizedSolverEmission[];
  baseConversionCostPerUnit: number | null;
  autonomousInputs: NormalizedSolverInput[];
  autonomousDirectEmissions: NormalizedSolverEmission[];
  autonomousConversionCostPerUnit: number | null;
}

export interface NormalizedSolverRowProvenance {
  kind: 'base_state' | 'efficiency_package';
  familyId: string;
  baseStateId: string;
  baseStateLabel: string;
  baseRowId: string;
  autonomousTrackIds: string[];
  packageId?: string;
  packageClassification?: EfficiencyPackageClassification;
  packageNonStackingGroup?: string | null;
}

export interface NormalizedSolverRow {
  rowId: string;
  roleId?: string;
  representationId?: string;
  methodId?: string;
  balanceType?: BalanceType;
  outputId: string;
  outputRole: OutputRole;
  outputLabel: string;
  year: number;
  stateId: string;
  stateLabel: string;
  stateDisplayLabel?: string;
  stateSortKey?: string;
  stateOptionRank?: number | null;
  sector: string;
  subsector: string;
  region: string;
  outputUnit: string;
  conversionCostPerUnit: number | null;
  currency?: string;
  costBasisYear?: number | null;
  inputs: NormalizedSolverInput[];
  directEmissions: NormalizedSolverEmission[];
  efficiencyAttributionBasis?: NormalizedSolverRowEfficiencyAttributionBasis;
  provenance?: NormalizedSolverRowProvenance;
  bounds: {
    minShare: number | null;
    maxShare: number | null;
    maxActivity: number | null;
  };
}

export interface ResolvedSolveControl {
  mode: ConfigurationControlMode;
  activeStateIds: string[] | null;
  targetValue: number | null;
}

export interface ResolvedCommodityPriceSeries {
  unit: string;
  valuesByYear: Record<string, number>;
}

export interface ResolvedConfigurationEfficiencyControls {
  autonomousMode: ConfigurationAutonomousEfficiencyMode;
  autonomousModesByOutput: Record<string, ConfigurationAutonomousEfficiencyMode>;
  activeTrackIds: string[];
  packageMode: ConfigurationEfficiencyPackageMode;
  configuredPackageIds: string[];
  activePackageIds: string[];
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
  efficiency?: ResolvedConfigurationEfficiencyControls;
  options: {
    respectMaxShare: boolean;
    respectMaxActivity: boolean;
    softConstraints: boolean;
    shareSmoothing: {
      enabled: boolean;
      maxDeltaPp: number | null;
    };
  };
}

export interface SolveObjectiveCostMetadata {
  currency: string;
  costBasisYear: number | null;
}

export interface SolveRoleTopologyRole {
  roleId: string;
  outputId: string;
  roleLabel: string;
  balanceType: BalanceType;
  outputUnit: string;
  parentRoleId: string | null;
}

export interface SolveRoleTopologyDecomposition {
  parentRoleId: string;
  parentOutputId: string;
  childRoleIds: string[];
}

export interface SolveRoleTopology {
  activeRoleIds: string[];
  activeRepresentationByRole: Record<string, string>;
  rolesById: Record<string, SolveRoleTopologyRole>;
  decompositions: SolveRoleTopologyDecomposition[];
  intermediateCommodityByRole: Record<string, string>;
}

export interface SolveRequest {
  contractVersion: SolverContractVersion;
  requestId: string;
  rows: NormalizedSolverRow[];
  configuration: ResolvedConfigurationForSolve;
  objectiveCost?: SolveObjectiveCostMetadata;
  roleTopology?: SolveRoleTopology;
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
  | 'min_share'
  | 'max_share'
  | 'max_activity'
  | 'inactive_state'
  | 'externalized_supply'
  | 'efficiency_non_stacking_group';
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
  rowId?: string;
  stateId: string;
  stateLabel: string;
  pathwayStateId?: string;
  pathwayStateLabel?: string;
  provenance?: NormalizedSolverRowProvenance;
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
