import { derivePathwayStateIdsForOutput } from '../data/pathwaySemantics.ts';
import type {
  ConfigurationDocument,
  PackageData,
  PriceLevel,
  SectorState,
} from '../data/types.ts';
import { buildSolveRequest } from '../solver/buildSolveRequest.ts';
import { buildConfigurationBuildFailure, buildConfigurationSolveFailure } from '../solver/configurationSolveFailure.ts';
import type { SolveRequest, SolveResult } from '../solver/contract.ts';

export type AdditionalityOrderingMethod = 'reverse_greedy_target_context';
export type AdditionalityAtomAction = 'enable' | 'disable';
export type AdditionalityAnalysisPhase =
  | 'idle'
  | 'loading'
  | 'validation'
  | 'empty'
  | 'success'
  | 'partial'
  | 'error';

export interface AdditionalityAtom {
  key: string;
  outputId: string;
  outputLabel: string;
  stateId: string;
  stateLabel: string;
  action: AdditionalityAtomAction;
}

export interface AdditionalityValidationIssue {
  code: string;
  message: string;
  outputId?: string;
}

export interface AdditionalitySkippedCandidate {
  step: number;
  atom: AdditionalityAtom;
  message: string;
}

export interface AdditionalityMetricSnapshot {
  objective: number;
  cumulativeEmissions: number;
  // Intentionally raw MWh so page-level formatting can convert to TWh while
  // preserving parity with solver reporting totalDemand for electricity in 2050.
  electricityDemand2050: number;
}

export interface AdditionalitySequenceEntry {
  step: number;
  atom: AdditionalityAtom;
  metricsBefore: AdditionalityMetricSnapshot;
  metricsAfter: AdditionalityMetricSnapshot;
  metricsDeltaFromCurrent: AdditionalityMetricSnapshot;
  absObjectiveDelta: number;
  skippedCandidateCount: number;
}

export interface AdditionalityReport {
  orderingMethod: AdditionalityOrderingMethod;
  sequenceComplete: boolean;
  baseConfigId: string;
  targetConfigId: string;
  baseMetrics: AdditionalityMetricSnapshot;
  targetMetrics: AdditionalityMetricSnapshot;
  totalObjectiveDelta: number;
  atomCount: number;
  solveCount: number;
  sequence: AdditionalitySequenceEntry[];
  skippedCandidates: AdditionalitySkippedCandidate[];
  validationIssues: AdditionalityValidationIssue[];
}

export interface AdditionalityProgress {
  completed: number;
  totalExpected: number;
}

export interface AdditionalityAnalysisState {
  phase: AdditionalityAnalysisPhase;
  report: AdditionalityReport | null;
  progress: AdditionalityProgress;
  error: string | null;
  validationIssues: AdditionalityValidationIssue[];
}

export interface AdditionalityPreparation {
  atoms: AdditionalityAtom[];
  baseConfiguration: ConfigurationDocument;
  targetConfiguration: ConfigurationDocument;
  totalExpected: number;
  validationIssues: AdditionalityValidationIssue[];
}

export interface AdditionalityRunOptions {
  baseConfiguration: ConfigurationDocument;
  baseConfigId: string;
  commoditySelections: Record<string, PriceLevel>;
  pkg: Pick<PackageData, 'appConfig' | 'sectorStates'>;
  targetConfiguration: ConfigurationDocument;
  targetConfigId: string;
}

export interface AdditionalityRunDependencies {
  buildRequest?: (
    pkg: Pick<PackageData, 'appConfig' | 'sectorStates'>,
    configuration: ConfigurationDocument,
  ) => SolveRequest;
  isCancelled?: () => boolean;
  onProgress?: (progress: AdditionalityProgress) => void;
  solve?: (request: SolveRequest) => Promise<SolveResult> | SolveResult;
}

interface AdditionalityOutputStateCatalogEntry {
  outputId: string;
  outputLabel: string;
  states: Array<{
    stateId: string;
    stateLabel: string;
  }>;
}

interface AdditionalityCandidate {
  atom: AdditionalityAtom;
  config: ConfigurationDocument;
  metricsAfter: AdditionalityMetricSnapshot;
  metricsDeltaFromCurrent: AdditionalityMetricSnapshot;
  absObjectiveDelta: number;
}

const EMPTY_PROGRESS: AdditionalityProgress = {
  completed: 0,
  totalExpected: 0,
};
const ELECTRICITY_COMMODITY = 'electricity';
const ELECTRICITY_DEMAND_YEAR = 2050;

class AdditionalityCancelledError extends Error {
  constructor() {
    super('Additionality analysis was cancelled.');
    this.name = 'AdditionalityCancelledError';
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, stableValue(nestedValue)]),
    );
  }

  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function buildOutputStateCatalog(
  sectorStates: readonly SectorState[],
  outputLabelById: Record<string, string>,
): Record<string, AdditionalityOutputStateCatalogEntry> {
  const catalog = new Map<string, AdditionalityOutputStateCatalogEntry>();

  for (const row of sectorStates) {
    let entry = catalog.get(row.service_or_output_name);
    if (!entry) {
      entry = {
        outputId: row.service_or_output_name,
        outputLabel: outputLabelById[row.service_or_output_name] ?? row.service_or_output_name,
        states: [],
      };
      catalog.set(row.service_or_output_name, entry);
    }

    if (!entry.states.some((state) => state.stateId === row.state_id)) {
      entry.states.push({
        stateId: row.state_id,
        stateLabel: row.state_label,
      });
    }
  }

  return Object.fromEntries(
    Array.from(catalog.entries())
      .sort(([, left], [, right]) => left.outputLabel.localeCompare(right.outputLabel))
      .map(([outputId, entry]) => [outputId, entry]),
  );
}

function getAllStateIds(entry: AdditionalityOutputStateCatalogEntry | undefined): string[] {
  return entry?.states.map((state) => state.stateId) ?? [];
}

function compareAtoms(left: AdditionalityAtom, right: AdditionalityAtom): number {
  return left.outputLabel.localeCompare(right.outputLabel)
    || left.stateLabel.localeCompare(right.stateLabel)
    || left.action.localeCompare(right.action);
}

function compareCandidates(left: AdditionalityCandidate, right: AdditionalityCandidate): number {
  return right.absObjectiveDelta - left.absObjectiveDelta
    || compareAtoms(left.atom, right.atom);
}

function compareReverseGreedyCandidates(left: AdditionalityCandidate, right: AdditionalityCandidate): number {
  return left.absObjectiveDelta - right.absObjectiveDelta
    || compareAtoms(left.atom, right.atom);
}

export function invertAdditionalityAtomAction(action: AdditionalityAtomAction): AdditionalityAtomAction {
  return action === 'enable' ? 'disable' : 'enable';
}

export function buildPresentationSequence(
  removalSequence: AdditionalitySequenceEntry[],
): AdditionalitySequenceEntry[] {
  const reversed = [...removalSequence].reverse();
  return reversed.map((entry, index) => ({
    step: index + 1,
    atom: {
      ...entry.atom,
      action: invertAdditionalityAtomAction(entry.atom.action),
    },
    metricsBefore: entry.metricsAfter,
    metricsAfter: entry.metricsBefore,
    metricsDeltaFromCurrent: subtractMetricSnapshots(entry.metricsBefore, entry.metricsAfter),
    absObjectiveDelta: entry.absObjectiveDelta,
    skippedCandidateCount: entry.skippedCandidateCount,
  }));
}

function normalizeControlComparison(control: ConfigurationDocument['service_controls'][string] | undefined) {
  return {
    mode: control?.mode ?? null,
    target_value: control?.target_value ?? null,
    year_overrides: control?.year_overrides ?? null,
  };
}

function getOutputLabel(
  pkg: Pick<PackageData, 'appConfig'>,
  outputId: string,
): string {
  return pkg.appConfig.output_roles[outputId]?.display_label ?? outputId;
}

function buildTopLevelMismatchIssue(
  code: string,
  field: string,
): AdditionalityValidationIssue {
  return {
    code,
    message: `Base and target must match on ${field}.`,
  };
}

function buildControlMismatchIssue(
  code: string,
  outputId: string,
  outputLabel: string,
  field: string,
): AdditionalityValidationIssue {
  return {
    code,
    outputId,
    message: `${outputLabel} differs on ${field}, which v1 additionality does not support.`,
  };
}

function checkCancelled(isCancelled: AdditionalityRunDependencies['isCancelled']): void {
  if (isCancelled?.()) {
    throw new AdditionalityCancelledError();
  }
}

function formatSolveFailure(prefix: string, result: SolveResult): string {
  const failure = buildConfigurationSolveFailure(result);
  const status = result.raw?.solutionStatus ?? result.status;
  return `${prefix} failed (${status}): ${failure.headline}`;
}

function formatBuildFailure(prefix: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const failure = buildConfigurationBuildFailure(message);
  return `${prefix} build failed: ${failure.headline}`;
}

function sumDirectEmissions(row: SolveRequest['rows'][number]): number {
  return row.directEmissions.reduce((total, entry) => total + entry.value, 0);
}

function sumSpecificInputCoefficient(
  inputs: SolveRequest['rows'][number]['inputs'],
  commodityId: string,
): number {
  return inputs.reduce((total, input) => {
    return input.commodityId === commodityId ? total + input.coefficient : total;
  }, 0);
}

function subtractMetricSnapshots(
  after: AdditionalityMetricSnapshot,
  before: AdditionalityMetricSnapshot,
): AdditionalityMetricSnapshot {
  return {
    objective: after.objective - before.objective,
    cumulativeEmissions: after.cumulativeEmissions - before.cumulativeEmissions,
    electricityDemand2050: after.electricityDemand2050 - before.electricityDemand2050,
  };
}

function buildMetricSnapshot(
  label: string,
  request: SolveRequest,
  result: SolveResult,
): AdditionalityMetricSnapshot {
  if (result.status === 'error') {
    throw new Error(formatSolveFailure(label, result));
  }

  if (!result.raw) {
    throw new Error(`${label} evaluation failed: solve result is missing raw artifact data.`);
  }

  const objective = result.raw.objectiveValue;
  if (objective == null || !Number.isFinite(objective)) {
    throw new Error(formatSolveFailure(label, result));
  }

  if (!Array.isArray(result.raw.variables)) {
    throw new Error(`${label} evaluation failed: solve result is missing raw variable data.`);
  }

  const variableValues = new Map(
    result.raw.variables.map((entry) => [entry.id, entry.value]),
  );
  let cumulativeEmissions = 0;
  // Keep electricity demand in raw MWh: exogenous demand plus modeled electricity
  // inputs should align with solver reporting commodityBalances[].totalDemand.
  let electricityDemand2050 = request.configuration.externalCommodityDemandByCommodity[
    ELECTRICITY_COMMODITY
  ]?.[String(ELECTRICITY_DEMAND_YEAR)] ?? 0;

  for (const row of request.rows) {
    const activityVariableId = `activity:${row.rowId}`;
    const activity = variableValues.get(activityVariableId);
    if (typeof activity !== 'number' || !Number.isFinite(activity)) {
      throw new Error(
        `${label} evaluation failed: missing or invalid activity variable "${activityVariableId}".`,
      );
    }

    cumulativeEmissions += activity * sumDirectEmissions(row);
    if (row.year === ELECTRICITY_DEMAND_YEAR) {
      electricityDemand2050 += activity * sumSpecificInputCoefficient(
        row.inputs,
        ELECTRICITY_COMMODITY,
      );
    }
  }

  return {
    objective,
    cumulativeEmissions,
    electricityDemand2050,
  };
}

function toProgress(
  completed: number,
  totalExpected: number,
): AdditionalityProgress {
  return { completed, totalExpected };
}

function applyAdditionalityAtomWithCatalog(
  configuration: ConfigurationDocument,
  atom: AdditionalityAtom,
  catalog: Record<string, AdditionalityOutputStateCatalogEntry>,
): ConfigurationDocument {
  const outputCatalog = catalog[atom.outputId];
  const allStateIds = getAllStateIds(outputCatalog);
  const currentActiveIds = new Set(
    derivePathwayStateIdsForOutput(configuration, atom.outputId, allStateIds).activeStateIds,
  );

  if (atom.action === 'enable') {
    currentActiveIds.add(atom.stateId);
  } else {
    currentActiveIds.delete(atom.stateId);
  }

  const orderedActiveIds = allStateIds.filter((stateId) => currentActiveIds.has(stateId));
  const nextConfiguration = structuredClone(configuration);
  const nextControl = structuredClone(nextConfiguration.service_controls[atom.outputId] ?? { mode: 'optimize' as const });

  nextControl.active_state_ids = orderedActiveIds.length === allStateIds.length
    ? null
    : orderedActiveIds;
  nextConfiguration.service_controls[atom.outputId] = nextControl;

  return nextConfiguration;
}

function getAtomKey(atom: Pick<AdditionalityAtom, 'outputId' | 'stateId' | 'action'>): string {
  return `${atom.outputId}::${atom.stateId}::${atom.action}`;
}

export function seedAdditionalityCommoditySelections(
  configuration: ConfigurationDocument,
  commodityIds: readonly string[],
): Record<string, PriceLevel> {
  return Object.fromEntries(
    commodityIds.map((commodityId) => [
      commodityId,
      configuration.commodity_pricing.selections_by_commodity?.[commodityId] ?? 'medium',
    ]),
  );
}

export function applyAdditionalityCommoditySelections(
  configuration: ConfigurationDocument,
  selections: Record<string, PriceLevel>,
): ConfigurationDocument {
  const nextConfiguration = structuredClone(configuration);
  const nextSelections = {
    ...(nextConfiguration.commodity_pricing.selections_by_commodity ?? {}),
  };
  const nextOverrides = {
    ...(nextConfiguration.commodity_pricing.overrides ?? {}),
  };

  for (const [commodityId, level] of Object.entries(selections)) {
    nextSelections[commodityId] = level;
    delete nextOverrides[commodityId];
  }

  nextConfiguration.commodity_pricing = {
    ...nextConfiguration.commodity_pricing,
    selections_by_commodity: nextSelections,
    overrides: nextOverrides,
  };

  return nextConfiguration;
}

export function validateAdditionalityPair(
  baseConfiguration: ConfigurationDocument,
  targetConfiguration: ConfigurationDocument,
  pkg: Pick<PackageData, 'appConfig'>,
): AdditionalityValidationIssue[] {
  const issues: AdditionalityValidationIssue[] = [];

  if (stableStringify(baseConfiguration.years) !== stableStringify(targetConfiguration.years)) {
    issues.push(buildTopLevelMismatchIssue('years_mismatch', 'years'));
  }

  if (stableStringify(baseConfiguration.service_demands) !== stableStringify(targetConfiguration.service_demands)) {
    issues.push(buildTopLevelMismatchIssue('service_demands_mismatch', 'service_demands'));
  }

  if (
    stableStringify(baseConfiguration.external_commodity_demands ?? {})
    !== stableStringify(targetConfiguration.external_commodity_demands ?? {})
  ) {
    issues.push(
      buildTopLevelMismatchIssue(
        'external_commodity_demands_mismatch',
        'external_commodity_demands',
      ),
    );
  }

  if (
    stableStringify(baseConfiguration.demand_generation)
    !== stableStringify(targetConfiguration.demand_generation)
  ) {
    issues.push(buildTopLevelMismatchIssue('demand_generation_mismatch', 'demand_generation'));
  }

  if (stableStringify(baseConfiguration.carbon_price) !== stableStringify(targetConfiguration.carbon_price)) {
    issues.push(buildTopLevelMismatchIssue('carbon_price_mismatch', 'carbon_price'));
  }

  if (
    stableStringify(baseConfiguration.residual_overlays ?? null)
    !== stableStringify(targetConfiguration.residual_overlays ?? null)
  ) {
    issues.push(buildTopLevelMismatchIssue('residual_overlays_mismatch', 'residual_overlays'));
  }

  if (
    stableStringify(baseConfiguration.solver_options ?? null)
    !== stableStringify(targetConfiguration.solver_options ?? null)
  ) {
    issues.push(buildTopLevelMismatchIssue('solver_options_mismatch', 'solver_options'));
  }

  const outputIds = Array.from(
    new Set([
      ...Object.keys(pkg.appConfig.output_roles),
      ...Object.keys(baseConfiguration.service_controls),
      ...Object.keys(targetConfiguration.service_controls),
    ]),
  ).sort((left, right) => getOutputLabel(pkg, left).localeCompare(getOutputLabel(pkg, right)));

  for (const outputId of outputIds) {
    const baseControl = normalizeControlComparison(baseConfiguration.service_controls[outputId]);
    const targetControl = normalizeControlComparison(targetConfiguration.service_controls[outputId]);
    const outputLabel = getOutputLabel(pkg, outputId);

    if (baseControl.mode !== targetControl.mode) {
      issues.push(
        buildControlMismatchIssue(
          'service_control_mode_mismatch',
          outputId,
          outputLabel,
          'service_controls[*].mode',
        ),
      );
    }

    if (baseControl.target_value !== targetControl.target_value) {
      issues.push(
        buildControlMismatchIssue(
          'service_control_target_value_mismatch',
          outputId,
          outputLabel,
          'service_controls[*].target_value',
        ),
      );
    }

    if (stableStringify(baseControl.year_overrides) !== stableStringify(targetControl.year_overrides)) {
      issues.push(
        buildControlMismatchIssue(
          'service_control_year_overrides_mismatch',
          outputId,
          outputLabel,
          'service_controls[*].year_overrides',
        ),
      );
    }
  }

  return issues;
}

export function deriveAdditionalityAtoms(
  baseConfiguration: ConfigurationDocument,
  targetConfiguration: ConfigurationDocument,
  pkg: Pick<PackageData, 'appConfig' | 'sectorStates'>,
): AdditionalityAtom[] {
  const outputLabelById = Object.fromEntries(
    Object.entries(pkg.appConfig.output_roles).map(([outputId, metadata]) => [outputId, metadata.display_label]),
  );
  const catalog = buildOutputStateCatalog(pkg.sectorStates, outputLabelById);
  const atoms: AdditionalityAtom[] = [];

  for (const entry of Object.values(catalog)) {
    const allStateIds = getAllStateIds(entry);
    const baseActiveIds = new Set(
      derivePathwayStateIdsForOutput(baseConfiguration, entry.outputId, allStateIds).activeStateIds,
    );
    const targetActiveIds = new Set(
      derivePathwayStateIdsForOutput(targetConfiguration, entry.outputId, allStateIds).activeStateIds,
    );

    for (const state of entry.states) {
      const activeInBase = baseActiveIds.has(state.stateId);
      const activeInTarget = targetActiveIds.has(state.stateId);

      if (activeInBase === activeInTarget) {
        continue;
      }

      const action: AdditionalityAtomAction = activeInTarget ? 'enable' : 'disable';
      atoms.push({
        key: getAtomKey({
          outputId: entry.outputId,
          stateId: state.stateId,
          action,
        }),
        outputId: entry.outputId,
        outputLabel: entry.outputLabel,
        stateId: state.stateId,
        stateLabel: state.stateLabel,
        action,
      });
    }
  }

  return atoms.sort(compareAtoms);
}

export function applyAdditionalityAtom(
  configuration: ConfigurationDocument,
  atom: AdditionalityAtom,
  pkg: Pick<PackageData, 'appConfig' | 'sectorStates'>,
): ConfigurationDocument {
  const outputLabelById = Object.fromEntries(
    Object.entries(pkg.appConfig.output_roles).map(([outputId, metadata]) => [outputId, metadata.display_label]),
  );
  const catalog = buildOutputStateCatalog(pkg.sectorStates, outputLabelById);
  return applyAdditionalityAtomWithCatalog(configuration, atom, catalog);
}

export function prepareAdditionalityAnalysis(
  options: AdditionalityRunOptions,
): AdditionalityPreparation {
  const baseConfiguration = applyAdditionalityCommoditySelections(
    options.baseConfiguration,
    options.commoditySelections,
  );
  const targetConfiguration = applyAdditionalityCommoditySelections(
    options.targetConfiguration,
    options.commoditySelections,
  );
  const validationIssues = validateAdditionalityPair(baseConfiguration, targetConfiguration, options.pkg);
  const atoms = validationIssues.length === 0
    ? deriveAdditionalityAtoms(baseConfiguration, targetConfiguration, options.pkg)
    : [];

  return {
    atoms,
    baseConfiguration,
    targetConfiguration,
    totalExpected: atoms.length === 0 ? 0 : 2 + Math.floor((atoms.length * (atoms.length + 1)) / 2),
    validationIssues,
  };
}

export async function runAdditionalityAnalysis(
  options: AdditionalityRunOptions,
  dependencies: AdditionalityRunDependencies = {},
): Promise<AdditionalityAnalysisState> {
  const {
    buildRequest = buildSolveRequest,
    isCancelled,
    onProgress,
    solve,
  } = dependencies;
  const prepared = prepareAdditionalityAnalysis(options);

  if (prepared.validationIssues.length > 0) {
    return {
      phase: 'validation',
      report: null,
      progress: EMPTY_PROGRESS,
      error: null,
      validationIssues: prepared.validationIssues,
    };
  }

  if (prepared.atoms.length === 0) {
    return {
      phase: 'empty',
      report: null,
      progress: EMPTY_PROGRESS,
      error: null,
      validationIssues: [],
    };
  }

  if (!solve) {
    throw new Error('runAdditionalityAnalysis requires a solve function.');
  }
  const solveRequest = solve;

  const outputLabelById = Object.fromEntries(
    Object.entries(options.pkg.appConfig.output_roles).map(([outputId, metadata]) => [outputId, metadata.display_label]),
  );
  const catalog = buildOutputStateCatalog(options.pkg.sectorStates, outputLabelById);
  const skippedCandidates: AdditionalitySkippedCandidate[] = [];
  const totalExpected = prepared.totalExpected;
  let completed = 0;

  function advanceProgress(): void {
    completed += 1;
    onProgress?.(toProgress(completed, totalExpected));
  }

  async function evaluateMetrics(
    configuration: ConfigurationDocument,
    label: string,
  ): Promise<AdditionalityMetricSnapshot | { error: string }> {
    checkCancelled(isCancelled);
    let request: SolveRequest;

    try {
      request = buildRequest(options.pkg, configuration);
    } catch (error) {
      advanceProgress();
      return {
        error: formatBuildFailure(label, error),
      };
    }

    try {
      const result = await solveRequest(request);
      return buildMetricSnapshot(label, request, result);
    } catch (error) {
      if (error instanceof AdditionalityCancelledError) {
        throw error;
      }

      return {
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      advanceProgress();
    }
  }

  const baseEvaluation = await evaluateMetrics(prepared.baseConfiguration, 'Base configuration');
  if ('error' in baseEvaluation) {
    return {
      phase: 'error',
      report: null,
      progress: toProgress(completed, totalExpected),
      error: baseEvaluation.error,
      validationIssues: [],
    };
  }

  const targetEvaluation = await evaluateMetrics(prepared.targetConfiguration, 'Target configuration');
  if ('error' in targetEvaluation) {
    return {
      phase: 'error',
      report: null,
      progress: toProgress(completed, totalExpected),
      error: targetEvaluation.error,
      validationIssues: [],
    };
  }

  let currentConfiguration = structuredClone(prepared.targetConfiguration);
  let currentMetrics = targetEvaluation;
  let remainingAtoms = [...prepared.atoms];
  const removalSequence: AdditionalitySequenceEntry[] = [];

  for (let step = 1; remainingAtoms.length > 0; step += 1) {
    checkCancelled(isCancelled);

    let bestCandidate: AdditionalityCandidate | null = null;
    let skippedCandidateCount = 0;

    for (const atom of remainingAtoms) {
      checkCancelled(isCancelled);

      const invertedAtom: AdditionalityAtom = {
        ...atom,
        action: invertAdditionalityAtomAction(atom.action),
      };
      const candidateConfiguration = applyAdditionalityAtomWithCatalog(
        currentConfiguration,
        invertedAtom,
        catalog,
      );
      const evaluation = await evaluateMetrics(
        candidateConfiguration,
        `Candidate ${step}: ${atom.outputLabel} / ${atom.stateLabel}`,
      );

      if ('error' in evaluation) {
        skippedCandidateCount += 1;
        skippedCandidates.push({
          step,
          atom,
          message: evaluation.error,
        });
        continue;
      }

      const metricsDeltaFromCurrent = subtractMetricSnapshots(evaluation, currentMetrics);
      const candidate: AdditionalityCandidate = {
        atom: invertedAtom,
        config: candidateConfiguration,
        metricsAfter: evaluation,
        metricsDeltaFromCurrent,
        absObjectiveDelta: Math.abs(metricsDeltaFromCurrent.objective),
      };

      if (!bestCandidate || compareReverseGreedyCandidates(candidate, bestCandidate) < 0) {
        bestCandidate = candidate;
      }
    }

    if (!bestCandidate) {
      const report: AdditionalityReport = {
        orderingMethod: 'reverse_greedy_target_context',
        sequenceComplete: false,
        baseConfigId: options.baseConfigId,
        targetConfigId: options.targetConfigId,
        baseMetrics: baseEvaluation,
        targetMetrics: targetEvaluation,
        totalObjectiveDelta: targetEvaluation.objective - baseEvaluation.objective,
        atomCount: prepared.atoms.length,
        solveCount: completed,
        sequence: buildPresentationSequence(removalSequence),
        skippedCandidates,
        validationIssues: [],
      };

      return {
        phase: 'partial',
        report,
        progress: toProgress(completed, totalExpected),
        error: `Stopped at step ${step} because every remaining candidate solve failed.`,
        validationIssues: [],
      };
    }

    removalSequence.push({
      step,
      atom: bestCandidate.atom,
      metricsBefore: currentMetrics,
      metricsAfter: bestCandidate.metricsAfter,
      metricsDeltaFromCurrent: bestCandidate.metricsDeltaFromCurrent,
      absObjectiveDelta: bestCandidate.absObjectiveDelta,
      skippedCandidateCount,
    });

    currentConfiguration = bestCandidate.config;
    currentMetrics = bestCandidate.metricsAfter;
    remainingAtoms = remainingAtoms.filter((atom) => atom.key !== bestCandidate.atom.key);
  }

  const presentationSequence = buildPresentationSequence(removalSequence);

  const report: AdditionalityReport = {
    orderingMethod: 'reverse_greedy_target_context',
    sequenceComplete: true,
    baseConfigId: options.baseConfigId,
    targetConfigId: options.targetConfigId,
    baseMetrics: baseEvaluation,
    targetMetrics: targetEvaluation,
    totalObjectiveDelta: targetEvaluation.objective - baseEvaluation.objective,
    atomCount: prepared.atoms.length,
    solveCount: completed,
    sequence: presentationSequence,
    skippedCandidates,
    validationIssues: [],
  };

  return {
    phase: 'success',
    report,
    progress: toProgress(completed, totalExpected),
    error: null,
    validationIssues: [],
  };
}

export function isAdditionalityCancelledError(error: unknown): boolean {
  return error instanceof AdditionalityCancelledError;
}
