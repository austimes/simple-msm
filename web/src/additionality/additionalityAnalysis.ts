import {
  resolveActiveEfficiencyPackageIds,
  resolveAutonomousModeForOutput,
} from '../data/efficiencyControlModel.ts';
import { embodiedEfficiencyPathwayEntries } from '../data/efficiencyAttributionRegistry.ts';
import { derivePathwayMethodIdsForRole } from '../data/pathwaySemantics.ts';
import { normalizeConfigurationRoleControls } from '../data/configurationRoleControls.ts';
import type {
  ConfigurationAutonomousEfficiencyMode,
  ConfigurationDocument,
  ConfigurationRoleControl,
  EfficiencyPackage,
  PackageData,
  PriceLevel,
  ResolvedMethodYearRow,
} from '../data/types.ts';
import { buildAllContributionRows, type ResultContributionRow } from '../results/resultContributions.ts';
import { buildSolveRequest } from '../solver/buildSolveRequest.ts';
import { buildConfigurationBuildFailure, buildConfigurationSolveFailure } from '../solver/configurationSolveFailure.ts';
import type { SolveRequest, SolveResult } from '../solver/contract.ts';

export type AdditionalityOrderingMethod =
  | 'reverse_greedy_target_context'
  | 'shapley_permutation_sample';
export const ADDITIONALITY_SHAPLEY_SAMPLE_COUNTS = [16, 32, 64] as const;
export const DEFAULT_ADDITIONALITY_METHOD: AdditionalityOrderingMethod = 'reverse_greedy_target_context';
export const DEFAULT_ADDITIONALITY_SHAPLEY_SAMPLE_COUNT = 32;
export type AdditionalityShapleySampleCount = (typeof ADDITIONALITY_SHAPLEY_SAMPLE_COUNTS)[number];
export type AdditionalityAtomAction = 'enable' | 'disable';
export type AdditionalityAtomKind = 'method' | 'efficiency_package' | 'autonomous_efficiency';
export type AdditionalityAtomCategory = 'efficiency' | 'fuel_switching' | 'other_method_change';
export type AdditionalityMetricKey = 'cost' | 'emissions' | 'fuelEnergy';
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
  kind: AdditionalityAtomKind;
  category: AdditionalityAtomCategory;
  action: AdditionalityAtomAction;
  label: string;
  outputId: string | null;
  outputLabel: string | null;
  methodId?: string;
  methodLabel?: string;
  packageId?: string;
  packageLabel?: string;
  autonomousModeBefore?: ConfigurationAutonomousEfficiencyMode;
  autonomousModeAfter?: ConfigurationAutonomousEfficiencyMode;
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

export interface AdditionalityMetricTotals {
  cost: number;
  emissions: number;
  fuelEnergy: number;
}

export interface AdditionalityMetricVector extends AdditionalityMetricTotals {
  byYear: Record<string, AdditionalityMetricTotals>;
}

export interface AdditionalitySequenceEntry {
  step: number;
  atom: AdditionalityAtom;
  metricsBefore: AdditionalityMetricVector;
  metricsAfter: AdditionalityMetricVector;
  metricsDeltaFromCurrent: AdditionalityMetricVector;
  absCostDelta: number;
  skippedCandidateCount: number;
}

export interface AdditionalityMethodMetadata {
  method: AdditionalityOrderingMethod;
  sampleCount?: AdditionalityShapleySampleCount;
  requestedPermutations?: number;
  completedPermutations?: number;
  skippedPermutations?: number;
  skippedPermutationErrors?: string[];
  solveCount: number;
}

export interface AdditionalityReport {
  orderingMethod: AdditionalityOrderingMethod;
  sequenceComplete: boolean;
  baseConfigId: string;
  targetConfigId: string;
  baseMetrics: AdditionalityMetricVector;
  targetMetrics: AdditionalityMetricVector;
  totalDelta: AdditionalityMetricVector;
  totalObjectiveDelta: number;
  atomCount: number;
  solveCount: number;
  methodMetadata: AdditionalityMethodMetadata;
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

export type AdditionalityPackageData = Pick<PackageData, 'appConfig' | 'resolvedMethodYears'>
  & Partial<Pick<PackageData, 'autonomousEfficiencyTracks' | 'efficiencyPackages' | 'residualOverlays2025'>>;

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
  method?: AdditionalityOrderingMethod;
  pkg: AdditionalityPackageData;
  shapleySampleCount?: number;
  targetConfiguration: ConfigurationDocument;
  targetConfigId: string;
}

export interface AdditionalityRunDependencies {
  buildRequest?: (
    pkg: AdditionalityPackageData,
    configuration: ConfigurationDocument,
  ) => SolveRequest;
  isCancelled?: () => boolean;
  onProgress?: (progress: AdditionalityProgress) => void;
  solve?: (request: SolveRequest) => Promise<SolveResult> | SolveResult;
}

interface AdditionalityOutputMethodCatalogEntry {
  outputId: string;
  outputLabel: string;
  roleId: string;
  methods: Array<{
    methodId: string;
    methodLabel: string;
  }>;
}

interface AdditionalityEfficiencyPackageCatalogEntry {
  packageId: string;
  packageLabel: string;
  outputId: string;
  outputLabel: string;
  classification: EfficiencyPackage['classification'];
}

interface AdditionalityAutonomousCatalogEntry {
  outputId: string;
  outputLabel: string;
}

interface AdditionalityCandidate {
  atom: AdditionalityAtom;
  config: ConfigurationDocument;
  metricsAfter: AdditionalityMetricVector;
  metricsDeltaFromCurrent: AdditionalityMetricVector;
  absCostDelta: number;
}

interface AdditionalityMarginalAttribution {
  atom: AdditionalityAtom;
  marginal: AdditionalityMetricVector;
  absCostDelta: number;
}

type EvaluationResult = AdditionalityMetricVector | { error: string };

const EMPTY_PROGRESS: AdditionalityProgress = {
  completed: 0,
  totalExpected: 0,
};
const ZERO_TOTALS: AdditionalityMetricTotals = {
  cost: 0,
  emissions: 0,
  fuelEnergy: 0,
};
const METRIC_KEYS: AdditionalityMetricKey[] = ['cost', 'emissions', 'fuelEnergy'];
const ATOM_KIND_ORDER: Record<AdditionalityAtomKind, number> = {
  method: 0,
  efficiency_package: 1,
  autonomous_efficiency: 2,
};
const embodiedEfficiencyMethodIds = new Set(
  embodiedEfficiencyPathwayEntries.flatMap((entry) => entry.methodIds),
);
const LEGACY_OUTPUT_CONTROLS_KEY = ['service', 'controls'].join('_');
const LEGACY_ACTIVE_SELECTION_IDS_KEY = ['active', 'state', 'ids'].join('_');

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
        .filter(([key]) => key !== LEGACY_OUTPUT_CONTROLS_KEY)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, stableValue(nestedValue)]),
    );
  }

  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function cloneMetricTotals(value: AdditionalityMetricTotals = ZERO_TOTALS): AdditionalityMetricTotals {
  return {
    cost: value.cost,
    emissions: value.emissions,
    fuelEnergy: value.fuelEnergy,
  };
}

function createEmptyMetricVector(): AdditionalityMetricVector {
  return {
    cost: 0,
    emissions: 0,
    fuelEnergy: 0,
    byYear: {},
  };
}

function cloneMetricVector(vector: AdditionalityMetricVector): AdditionalityMetricVector {
  return {
    cost: vector.cost,
    emissions: vector.emissions,
    fuelEnergy: vector.fuelEnergy,
    byYear: Object.fromEntries(
      Object.entries(vector.byYear).map(([year, totals]) => [year, cloneMetricTotals(totals)]),
    ),
  };
}

function addMetricVectorInPlace(
  target: AdditionalityMetricVector,
  source: AdditionalityMetricVector,
): void {
  for (const metric of METRIC_KEYS) {
    target[metric] += source[metric];
  }

  for (const [year, totals] of Object.entries(source.byYear)) {
    const targetTotals = target.byYear[year] ?? cloneMetricTotals();
    for (const metric of METRIC_KEYS) {
      targetTotals[metric] += totals[metric];
    }
    target.byYear[year] = targetTotals;
  }
}

function divideMetricVector(
  vector: AdditionalityMetricVector,
  divisor: number,
): AdditionalityMetricVector {
  const divided = createEmptyMetricVector();

  for (const metric of METRIC_KEYS) {
    divided[metric] = vector[metric] / divisor;
  }

  for (const [year, totals] of Object.entries(vector.byYear)) {
    divided.byYear[year] = {
      cost: totals.cost / divisor,
      emissions: totals.emissions / divisor,
      fuelEnergy: totals.fuelEnergy / divisor,
    };
  }

  return divided;
}

function subtractMetricVectors(
  after: AdditionalityMetricVector,
  before: AdditionalityMetricVector,
): AdditionalityMetricVector {
  const delta = createEmptyMetricVector();

  for (const metric of METRIC_KEYS) {
    delta[metric] = after[metric] - before[metric];
  }

  const years = new Set([
    ...Object.keys(after.byYear),
    ...Object.keys(before.byYear),
  ]);
  for (const year of years) {
    const afterTotals = after.byYear[year] ?? ZERO_TOTALS;
    const beforeTotals = before.byYear[year] ?? ZERO_TOTALS;
    delta.byYear[year] = {
      cost: afterTotals.cost - beforeTotals.cost,
      emissions: afterTotals.emissions - beforeTotals.emissions,
      fuelEnergy: afterTotals.fuelEnergy - beforeTotals.fuelEnergy,
    };
  }

  return delta;
}

function buildOutputMethodCatalog(
  resolvedMethodYears: readonly ResolvedMethodYearRow[],
  outputLabelById: Record<string, string>,
): Record<string, AdditionalityOutputMethodCatalogEntry> {
  const catalog = new Map<string, AdditionalityOutputMethodCatalogEntry>();

  for (const row of resolvedMethodYears) {
    let entry = catalog.get(row.output_id);
    if (!entry) {
      entry = {
        outputId: row.output_id,
        outputLabel: outputLabelById[row.output_id] ?? row.output_id,
        roleId: row.role_id,
        methods: [],
      };
      catalog.set(row.output_id, entry);
    }

    if (!entry.methods.some((method) => method.methodId === row.method_id)) {
      entry.methods.push({
        methodId: row.method_id,
        methodLabel: row.method_label,
      });
    }
  }

  for (const entry of catalog.values()) {
    entry.methods.sort((left, right) => (
      left.methodLabel.localeCompare(right.methodLabel)
      || left.methodId.localeCompare(right.methodId)
    ));
  }

  return Object.fromEntries(
    Array.from(catalog.entries())
      .sort(([, left], [, right]) => left.outputLabel.localeCompare(right.outputLabel))
      .map(([outputId, entry]) => [outputId, entry]),
  );
}

function buildPackageCatalog(
  pkg: AdditionalityPackageData,
): Record<string, AdditionalityEfficiencyPackageCatalogEntry> {
  const catalog = new Map<string, AdditionalityEfficiencyPackageCatalogEntry>();

  for (const row of pkg.efficiencyPackages ?? []) {
    if (catalog.has(row.package_id)) {
      continue;
    }

    catalog.set(row.package_id, {
      packageId: row.package_id,
      packageLabel: row.package_label || row.package_id,
      outputId: row.family_id,
      outputLabel: getOutputLabel(pkg, row.family_id),
      classification: row.classification,
    });
  }

  return Object.fromEntries(
    Array.from(catalog.entries())
      .sort(([, left], [, right]) => (
        left.outputLabel.localeCompare(right.outputLabel)
        || left.packageLabel.localeCompare(right.packageLabel)
        || left.packageId.localeCompare(right.packageId)
      )),
  );
}

function buildAutonomousCatalog(
  pkg: AdditionalityPackageData,
): AdditionalityAutonomousCatalogEntry[] {
  return Array.from(
    new Set((pkg.autonomousEfficiencyTracks ?? []).map((track) => track.family_id)),
  )
    .sort((left, right) => getOutputLabel(pkg, left).localeCompare(getOutputLabel(pkg, right)))
    .map((outputId) => ({
      outputId,
      outputLabel: getOutputLabel(pkg, outputId),
    }));
}

function getAllMethodIds(entry: AdditionalityOutputMethodCatalogEntry | undefined): string[] {
  return entry?.methods.map((method) => method.methodId) ?? [];
}

function compareAtoms(left: AdditionalityAtom, right: AdditionalityAtom): number {
  return ATOM_KIND_ORDER[left.kind] - ATOM_KIND_ORDER[right.kind]
    || (left.outputLabel ?? '').localeCompare(right.outputLabel ?? '')
    || left.label.localeCompare(right.label)
    || left.action.localeCompare(right.action)
    || left.key.localeCompare(right.key);
}

function compareReverseGreedyCandidates(left: AdditionalityCandidate, right: AdditionalityCandidate): number {
  return left.absCostDelta - right.absCostDelta
    || compareAtoms(left.atom, right.atom);
}

function compareObjectiveImpactAttributions(
  left: AdditionalityMarginalAttribution,
  right: AdditionalityMarginalAttribution,
): number {
  return right.absCostDelta - left.absCostDelta
    || compareAtoms(left.atom, right.atom);
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

function normalizeControlComparison(control: ConfigurationRoleControl | undefined) {
  return {
    mode: control?.mode ?? null,
    target_value: control?.target_value ?? null,
    year_overrides: control?.year_overrides ?? null,
  };
}

function materializeAdditionalityConfiguration(
  configuration: ConfigurationDocument,
  pkg: Pick<PackageData, 'resolvedMethodYears'>,
): ConfigurationDocument {
  return normalizeConfigurationRoleControls(configuration, {
    resolvedMethodYears: pkg.resolvedMethodYears,
  });
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
    message: `Base and focus must match on ${field}.`,
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
    message: `${outputLabel} differs on ${field}, which saved-scenario attribution does not support.`,
  };
}

function isEvaluationError(value: EvaluationResult): value is { error: string } {
  return 'error' in value;
}

function getAtomKey(atom: Pick<AdditionalityAtom, 'kind' | 'outputId' | 'methodId' | 'packageId' | 'action'>): string {
  switch (atom.kind) {
    case 'method':
      return `method::${atom.outputId ?? ''}::${atom.methodId ?? ''}::${atom.action}`;
    case 'efficiency_package':
      return `efficiency_package::${atom.packageId ?? ''}::${atom.action}`;
    case 'autonomous_efficiency':
      return `autonomous_efficiency::${atom.outputId ?? ''}::${atom.action}`;
    default:
      return `${atom.outputId ?? ''}::${atom.action}`;
  }
}

function getActionVerb(action: AdditionalityAtomAction): string {
  return action === 'enable' ? 'Enable' : 'Disable';
}

function categorizeMethodAtom(methodId: string, methodLabel: string): AdditionalityAtomCategory {
  if (embodiedEfficiencyMethodIds.has(methodId)) {
    return 'efficiency';
  }

  if (/(electric|hydrogen|fuel|diesel|ccs|eaf|low-carbon|bev|fcev)/i.test(`${methodId} ${methodLabel}`)) {
    return 'fuel_switching';
  }

  return 'other_method_change';
}

function buildMethodAtom(
  entry: AdditionalityOutputMethodCatalogEntry,
  method: AdditionalityOutputMethodCatalogEntry['methods'][number],
  action: AdditionalityAtomAction,
): AdditionalityAtom {
  const label = `${getActionVerb(action)} ${method.methodLabel}`;
  return {
    key: getAtomKey({
      kind: 'method',
      outputId: entry.outputId,
      methodId: method.methodId,
      action,
    }),
    kind: 'method',
    category: categorizeMethodAtom(method.methodId, method.methodLabel),
    action,
    label,
    outputId: entry.outputId,
    outputLabel: entry.outputLabel,
    methodId: method.methodId,
    methodLabel: method.methodLabel,
  };
}

function buildPackageAtom(
  entry: AdditionalityEfficiencyPackageCatalogEntry,
  action: AdditionalityAtomAction,
): AdditionalityAtom {
  const label = `${getActionVerb(action)} ${entry.packageLabel}`;
  return {
    key: getAtomKey({
      kind: 'efficiency_package',
      outputId: entry.outputId,
      packageId: entry.packageId,
      action,
    }),
    kind: 'efficiency_package',
    category: 'efficiency',
    action,
    label,
    outputId: entry.outputId,
    outputLabel: entry.outputLabel,
    packageId: entry.packageId,
    packageLabel: entry.packageLabel,
  };
}

function buildAutonomousAtom(
  entry: AdditionalityAutonomousCatalogEntry,
  baseMode: ConfigurationAutonomousEfficiencyMode,
  targetMode: ConfigurationAutonomousEfficiencyMode,
): AdditionalityAtom {
  const action: AdditionalityAtomAction = targetMode === 'baseline' ? 'enable' : 'disable';
  const label = `${getActionVerb(action)} autonomous efficiency`;
  return {
    key: getAtomKey({
      kind: 'autonomous_efficiency',
      outputId: entry.outputId,
      action,
    }),
    kind: 'autonomous_efficiency',
    category: 'efficiency',
    action,
    label,
    outputId: entry.outputId,
    outputLabel: entry.outputLabel,
    autonomousModeBefore: baseMode,
    autonomousModeAfter: targetMode,
  };
}

function normalizePackageIds(ids: string[]): string[] {
  return Array.from(new Set(ids)).sort((left, right) => left.localeCompare(right));
}

function ensureEfficiencyControls(
  configuration: ConfigurationDocument,
): NonNullable<ConfigurationDocument['efficiency_controls']> {
  configuration.efficiency_controls = {
    autonomous_mode: 'baseline',
    autonomous_modes_by_role: {},
    package_mode: 'allow_list',
    package_ids: [],
    ...(configuration.efficiency_controls ?? {}),
  };
  return configuration.efficiency_controls;
}

function setAutonomousModeForOutput(
  configuration: ConfigurationDocument,
  outputId: string,
  mode: ConfigurationAutonomousEfficiencyMode,
): void {
  const controls = ensureEfficiencyControls(configuration);
  controls.autonomous_mode = 'baseline';
  controls.autonomous_modes_by_role = {
    ...(controls.autonomous_modes_by_role ?? {}),
    [outputId]: mode,
  };
}

function setActivePackageIds(
  configuration: ConfigurationDocument,
  packageIds: string[],
): void {
  const controls = ensureEfficiencyControls(configuration);
  controls.package_mode = 'allow_list';
  controls.package_ids = normalizePackageIds(packageIds);
}

function resolveAdditionalityMethod(method: AdditionalityOrderingMethod | undefined): AdditionalityOrderingMethod {
  return method ?? DEFAULT_ADDITIONALITY_METHOD;
}

function resolveShapleySampleCount(sampleCount: number | undefined): AdditionalityShapleySampleCount {
  return ADDITIONALITY_SHAPLEY_SAMPLE_COUNTS.includes(sampleCount as AdditionalityShapleySampleCount)
    ? sampleCount as AdditionalityShapleySampleCount
    : DEFAULT_ADDITIONALITY_SHAPLEY_SAMPLE_COUNT;
}

function toProgress(
  completed: number,
  totalExpected: number,
): AdditionalityProgress {
  return { completed, totalExpected };
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDeterministicPermutation(
  atoms: AdditionalityAtom[],
  seedInput: string,
): AdditionalityAtom[] {
  const random = mulberry32(fnv1a32(seedInput));
  const shuffled = [...atoms];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function invertAdditionalityAtomAction(action: AdditionalityAtomAction): AdditionalityAtomAction {
  return action === 'enable' ? 'disable' : 'enable';
}

function invertAdditionalityAtom(atom: AdditionalityAtom): AdditionalityAtom {
  return {
    ...atom,
    action: invertAdditionalityAtomAction(atom.action),
    autonomousModeBefore: atom.autonomousModeAfter,
    autonomousModeAfter: atom.autonomousModeBefore,
  };
}

export function buildPresentationSequence(
  removalSequence: AdditionalitySequenceEntry[],
): AdditionalitySequenceEntry[] {
  const reversed = [...removalSequence].reverse();
  return reversed.map((entry, index) => ({
    step: index + 1,
    atom: invertAdditionalityAtom(entry.atom),
    metricsBefore: entry.metricsAfter,
    metricsAfter: entry.metricsBefore,
    metricsDeltaFromCurrent: subtractMetricVectors(entry.metricsBefore, entry.metricsAfter),
    absCostDelta: entry.absCostDelta,
    skippedCandidateCount: entry.skippedCandidateCount,
  }));
}

export function buildAdditionalityMetricVectorFromContributions(
  contributions: ResultContributionRow[],
): AdditionalityMetricVector {
  const vector = createEmptyMetricVector();

  for (const row of contributions) {
    const yearKey = String(row.year);
    const yearTotals = vector.byYear[yearKey] ?? cloneMetricTotals();
    const metric: AdditionalityMetricKey = row.metric === 'fuel' ? 'fuelEnergy' : row.metric;

    vector[metric] += row.value;
    yearTotals[metric] += row.value;
    vector.byYear[yearKey] = yearTotals;
  }

  return vector;
}

function buildMetricVector(
  label: string,
  request: SolveRequest,
  result: SolveResult,
  configuration: ConfigurationDocument,
  pkg: AdditionalityPackageData,
): AdditionalityMetricVector {
  if (result.status === 'error') {
    throw new Error(formatSolveFailure(label, result));
  }

  const contributions = buildAllContributionRows(
    request,
    result,
    pkg.residualOverlays2025 ?? [],
    configuration,
  );
  return buildAdditionalityMetricVectorFromContributions(contributions);
}

function buildReportBase(
  options: AdditionalityRunOptions,
  method: AdditionalityOrderingMethod,
  baseMetrics: AdditionalityMetricVector,
  targetMetrics: AdditionalityMetricVector,
  atomCount: number,
  solveCount: number,
  methodMetadata: Omit<AdditionalityMethodMetadata, 'method' | 'solveCount'>,
): Pick<
  AdditionalityReport,
  | 'orderingMethod'
  | 'baseConfigId'
  | 'targetConfigId'
  | 'baseMetrics'
  | 'targetMetrics'
  | 'totalDelta'
  | 'totalObjectiveDelta'
  | 'atomCount'
  | 'solveCount'
  | 'methodMetadata'
  | 'validationIssues'
> {
  const totalDelta = subtractMetricVectors(targetMetrics, baseMetrics);

  return {
    orderingMethod: method,
    baseConfigId: options.baseConfigId,
    targetConfigId: options.targetConfigId,
    baseMetrics,
    targetMetrics,
    totalDelta,
    totalObjectiveDelta: totalDelta.cost,
    atomCount,
    solveCount,
    methodMetadata: {
      method,
      solveCount,
      ...methodMetadata,
    },
    validationIssues: [],
  };
}

function applyMethodAtomWithCatalog(
  configuration: ConfigurationDocument,
  atom: AdditionalityAtom,
  catalog: Record<string, AdditionalityOutputMethodCatalogEntry>,
): ConfigurationDocument {
  if (!atom.outputId || !atom.methodId) {
    return structuredClone(configuration);
  }

  const outputCatalog = catalog[atom.outputId];
  const allMethodIds = getAllMethodIds(outputCatalog);
  const currentActiveIds = new Set(
    derivePathwayMethodIdsForRole(configuration, outputCatalog?.roleId ?? atom.outputId, allMethodIds).activeMethodIds,
  );

  if (atom.action === 'enable') {
    currentActiveIds.add(atom.methodId);
  } else {
    currentActiveIds.delete(atom.methodId);
  }

  const orderedActiveIds = allMethodIds.filter((methodId) => currentActiveIds.has(methodId));
  const nextConfiguration = structuredClone(configuration);
  const roleId = outputCatalog?.roleId ?? atom.outputId;
  const nextControl = structuredClone(nextConfiguration.role_controls?.[roleId] ?? { mode: 'optimize' as const });

  nextControl.active_method_ids = orderedActiveIds.length === allMethodIds.length
    ? null
    : orderedActiveIds;
  nextConfiguration.role_controls = {
    ...(nextConfiguration.role_controls ?? {}),
    [roleId]: nextControl,
  };
  const legacyControls = (nextConfiguration as unknown as Record<string, unknown>)[LEGACY_OUTPUT_CONTROLS_KEY];
  if (legacyControls && typeof legacyControls === 'object' && !Array.isArray(legacyControls)) {
    const controls = legacyControls as Record<string, Record<string, unknown>>;
    controls[atom.outputId] = {
      ...(controls[atom.outputId] ?? {}),
      mode: nextControl.mode,
      [LEGACY_ACTIVE_SELECTION_IDS_KEY]: nextControl.active_method_ids,
    };
  }

  return nextConfiguration;
}

function applyAdditionalityAtomWithCatalog(
  configuration: ConfigurationDocument,
  atom: AdditionalityAtom,
  catalog: Record<string, AdditionalityOutputMethodCatalogEntry>,
  pkg: AdditionalityPackageData,
): ConfigurationDocument {
  if (atom.kind === 'method') {
    return applyMethodAtomWithCatalog(configuration, atom, catalog);
  }

  const nextConfiguration = structuredClone(configuration);

  if (atom.kind === 'efficiency_package' && atom.packageId) {
    const activePackageIds = new Set(
      resolveActiveEfficiencyPackageIds(
        nextConfiguration.efficiency_controls,
        pkg.efficiencyPackages ?? [],
      ),
    );

    if (atom.action === 'enable') {
      activePackageIds.add(atom.packageId);
    } else {
      activePackageIds.delete(atom.packageId);
    }

    setActivePackageIds(nextConfiguration, Array.from(activePackageIds));
    return nextConfiguration;
  }

  if (atom.kind === 'autonomous_efficiency' && atom.outputId) {
    setAutonomousModeForOutput(
      nextConfiguration,
      atom.outputId,
      atom.action === 'enable' ? 'baseline' : 'off',
    );
  }

  return nextConfiguration;
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

export function canonicalizeAdditionalityConfiguration(
  configuration: ConfigurationDocument,
  pkg: AdditionalityPackageData,
): ConfigurationDocument {
  const nextConfiguration = structuredClone(
    materializeAdditionalityConfiguration(configuration, pkg),
  );
  const activePackageIds = resolveActiveEfficiencyPackageIds(
    nextConfiguration.efficiency_controls,
    pkg.efficiencyPackages ?? [],
  );
  const autonomousModesByRole = Object.fromEntries(
    buildAutonomousCatalog(pkg).map((entry) => [
      entry.outputId,
      resolveAutonomousModeForOutput(nextConfiguration.efficiency_controls, entry.outputId),
    ]),
  );

  nextConfiguration.efficiency_controls = {
    ...(nextConfiguration.efficiency_controls ?? {}),
    autonomous_mode: 'baseline',
    autonomous_modes_by_role: autonomousModesByRole,
    package_mode: 'allow_list',
    package_ids: activePackageIds,
  };

  return nextConfiguration;
}

export function validateAdditionalityPair(
  baseConfiguration: ConfigurationDocument,
  targetConfiguration: ConfigurationDocument,
  pkg: Pick<PackageData, 'appConfig'> & Partial<Pick<PackageData, 'resolvedMethodYears'>>,
): AdditionalityValidationIssue[] {
  const base = pkg.resolvedMethodYears
    ? materializeAdditionalityConfiguration(baseConfiguration, { resolvedMethodYears: pkg.resolvedMethodYears })
    : baseConfiguration;
  const target = pkg.resolvedMethodYears
    ? materializeAdditionalityConfiguration(targetConfiguration, { resolvedMethodYears: pkg.resolvedMethodYears })
    : targetConfiguration;
  const issues: AdditionalityValidationIssue[] = [];

  if (stableStringify(base.years) !== stableStringify(target.years)) {
    issues.push(buildTopLevelMismatchIssue('years_mismatch', 'years'));
  }

  if (stableStringify(base.service_demands) !== stableStringify(target.service_demands)) {
    issues.push(buildTopLevelMismatchIssue('service_demands_mismatch', 'service_demands'));
  }

  if (
    stableStringify(base.external_commodity_demands ?? {})
    !== stableStringify(target.external_commodity_demands ?? {})
  ) {
    issues.push(
      buildTopLevelMismatchIssue(
        'external_commodity_demands_mismatch',
        'external_commodity_demands',
      ),
    );
  }

  if (
    stableStringify(base.demand_generation)
    !== stableStringify(target.demand_generation)
  ) {
    issues.push(buildTopLevelMismatchIssue('demand_generation_mismatch', 'demand_generation'));
  }

  if (
    stableStringify(base.commodity_pricing)
    !== stableStringify(target.commodity_pricing)
  ) {
    issues.push(buildTopLevelMismatchIssue('commodity_pricing_mismatch', 'commodity_pricing'));
  }

  if (stableStringify(base.carbon_price) !== stableStringify(target.carbon_price)) {
    issues.push(buildTopLevelMismatchIssue('carbon_price_mismatch', 'carbon_price'));
  }

  if (
    stableStringify(base.residual_overlays ?? null)
    !== stableStringify(target.residual_overlays ?? null)
  ) {
    issues.push(buildTopLevelMismatchIssue('residual_overlays_mismatch', 'residual_overlays'));
  }

  if (
    stableStringify(base.solver_options ?? null)
    !== stableStringify(target.solver_options ?? null)
  ) {
    issues.push(buildTopLevelMismatchIssue('solver_options_mismatch', 'solver_options'));
  }

  const outputIds = Array.from(
    new Set([
      ...Object.keys(pkg.appConfig.output_roles),
      ...Object.keys(base.role_controls ?? {}),
      ...Object.keys(target.role_controls ?? {}),
    ]),
  ).sort((left, right) => getOutputLabel(pkg, left).localeCompare(getOutputLabel(pkg, right)));

  for (const outputId of outputIds) {
    const baseControl = normalizeControlComparison(base.role_controls?.[outputId]);
    const targetControl = normalizeControlComparison(target.role_controls?.[outputId]);
    const outputLabel = getOutputLabel(pkg, outputId);

    if (baseControl.mode !== targetControl.mode) {
      issues.push(
        buildControlMismatchIssue(
          'service_control_mode_mismatch',
          outputId,
          outputLabel,
          'role_controls[*].mode',
        ),
      );
    }

    if (baseControl.target_value !== targetControl.target_value) {
      issues.push(
        buildControlMismatchIssue(
          'service_control_target_value_mismatch',
          outputId,
          outputLabel,
          'role_controls[*].target_value',
        ),
      );
    }

    if (stableStringify(baseControl.year_overrides) !== stableStringify(targetControl.year_overrides)) {
      issues.push(
        buildControlMismatchIssue(
          'service_control_year_overrides_mismatch',
          outputId,
          outputLabel,
          'role_controls[*].year_overrides',
        ),
      );
    }
  }

  return issues;
}

export function deriveAdditionalityAtoms(
  baseConfiguration: ConfigurationDocument,
  targetConfiguration: ConfigurationDocument,
  pkg: AdditionalityPackageData,
): AdditionalityAtom[] {
  const base = materializeAdditionalityConfiguration(baseConfiguration, pkg);
  const target = materializeAdditionalityConfiguration(targetConfiguration, pkg);
  const outputLabelById = Object.fromEntries(
    Object.entries(pkg.appConfig.output_roles).map(([outputId, metadata]) => [outputId, metadata.display_label]),
  );
  const catalog = buildOutputMethodCatalog(pkg.resolvedMethodYears, outputLabelById);
  const packageCatalog = buildPackageCatalog(pkg);
  const atoms: AdditionalityAtom[] = [];

  for (const entry of Object.values(catalog)) {
    const allMethodIds = getAllMethodIds(entry);
    const baseActiveIds = new Set(
      derivePathwayMethodIdsForRole(base, entry.roleId ?? entry.outputId, allMethodIds).activeMethodIds,
    );
    const targetActiveIds = new Set(
      derivePathwayMethodIdsForRole(target, entry.roleId ?? entry.outputId, allMethodIds).activeMethodIds,
    );

    for (const method of entry.methods) {
      const activeInBase = baseActiveIds.has(method.methodId);
      const activeInTarget = targetActiveIds.has(method.methodId);

      if (activeInBase === activeInTarget) {
        continue;
      }

      atoms.push(buildMethodAtom(entry, method, activeInTarget ? 'enable' : 'disable'));
    }
  }

  const basePackageIds = new Set(
    resolveActiveEfficiencyPackageIds(baseConfiguration.efficiency_controls, pkg.efficiencyPackages ?? []),
  );
  const targetPackageIds = new Set(
    resolveActiveEfficiencyPackageIds(targetConfiguration.efficiency_controls, pkg.efficiencyPackages ?? []),
  );
  const allPackageIds = Array.from(new Set([
    ...Object.keys(packageCatalog),
    ...basePackageIds,
    ...targetPackageIds,
  ])).sort((left, right) => {
    const leftEntry = packageCatalog[left];
    const rightEntry = packageCatalog[right];
    return (leftEntry?.outputLabel ?? '').localeCompare(rightEntry?.outputLabel ?? '')
      || (leftEntry?.packageLabel ?? left).localeCompare(rightEntry?.packageLabel ?? right)
      || left.localeCompare(right);
  });

  for (const packageId of allPackageIds) {
    const activeInBase = basePackageIds.has(packageId);
    const activeInTarget = targetPackageIds.has(packageId);

    if (activeInBase === activeInTarget) {
      continue;
    }

    atoms.push(buildPackageAtom(
      packageCatalog[packageId] ?? {
        packageId,
        packageLabel: packageId,
        outputId: packageId,
        outputLabel: packageId,
        classification: 'pure_efficiency_overlay',
      },
      activeInTarget ? 'enable' : 'disable',
    ));
  }

  for (const entry of buildAutonomousCatalog(pkg)) {
    const baseMode = resolveAutonomousModeForOutput(baseConfiguration.efficiency_controls, entry.outputId);
    const targetMode = resolveAutonomousModeForOutput(targetConfiguration.efficiency_controls, entry.outputId);

    if (baseMode === targetMode) {
      continue;
    }

    atoms.push(buildAutonomousAtom(entry, baseMode, targetMode));
  }

  return atoms.sort(compareAtoms);
}

export function applyAdditionalityAtom(
  configuration: ConfigurationDocument,
  atom: AdditionalityAtom,
  pkg: AdditionalityPackageData,
): ConfigurationDocument {
  const materializedConfiguration = materializeAdditionalityConfiguration(configuration, pkg);
  const outputLabelById = Object.fromEntries(
    Object.entries(pkg.appConfig.output_roles).map(([outputId, metadata]) => [outputId, metadata.display_label]),
  );
  const catalog = buildOutputMethodCatalog(pkg.resolvedMethodYears, outputLabelById);
  return applyAdditionalityAtomWithCatalog(materializedConfiguration, atom, catalog, pkg);
}

function calculateTotalExpected(
  atomCount: number,
  method: AdditionalityOrderingMethod,
  shapleySampleCount: AdditionalityShapleySampleCount,
): number {
  if (atomCount === 0) {
    return 0;
  }

  if (method === 'shapley_permutation_sample') {
    return 2 + shapleySampleCount * atomCount;
  }

  return 2 + Math.floor((atomCount * (atomCount + 1)) / 2);
}

export function prepareAdditionalityAnalysis(
  options: AdditionalityRunOptions,
): AdditionalityPreparation {
  const method = resolveAdditionalityMethod(options.method);
  const shapleySampleCount = resolveShapleySampleCount(options.shapleySampleCount);
  const baseConfiguration = canonicalizeAdditionalityConfiguration(
    applyAdditionalityCommoditySelections(
      options.baseConfiguration,
      options.commoditySelections,
    ),
    options.pkg,
  );
  const targetConfiguration = canonicalizeAdditionalityConfiguration(
    applyAdditionalityCommoditySelections(
      options.targetConfiguration,
      options.commoditySelections,
    ),
    options.pkg,
  );
  const validationIssues = validateAdditionalityPair(baseConfiguration, targetConfiguration, options.pkg);
  const atoms = validationIssues.length === 0
    ? deriveAdditionalityAtoms(baseConfiguration, targetConfiguration, options.pkg)
    : [];

  return {
    atoms,
    baseConfiguration,
    targetConfiguration,
    totalExpected: calculateTotalExpected(atoms.length, method, shapleySampleCount),
    validationIssues,
  };
}

async function evaluateMetricsWithProgress(
  options: AdditionalityRunOptions,
  dependencies: Required<Pick<AdditionalityRunDependencies, 'buildRequest' | 'solve'>> & Pick<AdditionalityRunDependencies, 'isCancelled' | 'onProgress'>,
  configuration: ConfigurationDocument,
  label: string,
  completedRef: { completed: number },
  totalExpected: number,
): Promise<EvaluationResult> {
  checkCancelled(dependencies.isCancelled);
  let request: SolveRequest;

  const advanceProgress = (): void => {
    completedRef.completed += 1;
    dependencies.onProgress?.(toProgress(completedRef.completed, totalExpected));
  };

  try {
    request = dependencies.buildRequest(options.pkg, configuration);
  } catch (error) {
    advanceProgress();
    return {
      error: formatBuildFailure(label, error),
    };
  }

  try {
    const result = await dependencies.solve(request);
    return buildMetricVector(label, request, result, configuration, options.pkg);
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

async function runReverseGreedyAnalysis(
  options: AdditionalityRunOptions,
  dependencies: Required<Pick<AdditionalityRunDependencies, 'buildRequest' | 'solve'>> & Pick<AdditionalityRunDependencies, 'isCancelled' | 'onProgress'>,
  prepared: AdditionalityPreparation,
): Promise<AdditionalityAnalysisState> {
  const method: AdditionalityOrderingMethod = 'reverse_greedy_target_context';
  const outputLabelById = Object.fromEntries(
    Object.entries(options.pkg.appConfig.output_roles).map(([outputId, metadata]) => [outputId, metadata.display_label]),
  );
  const catalog = buildOutputMethodCatalog(options.pkg.resolvedMethodYears, outputLabelById);
  const skippedCandidates: AdditionalitySkippedCandidate[] = [];
  const totalExpected = prepared.totalExpected;
  const completedRef = { completed: 0 };

  const baseEvaluation = await evaluateMetricsWithProgress(
    options,
    dependencies,
    prepared.baseConfiguration,
    'Base configuration',
    completedRef,
    totalExpected,
  );
  if (isEvaluationError(baseEvaluation)) {
    return {
      phase: 'error',
      report: null,
      progress: toProgress(completedRef.completed, totalExpected),
      error: baseEvaluation.error,
      validationIssues: [],
    };
  }

  const targetEvaluation = await evaluateMetricsWithProgress(
    options,
    dependencies,
    prepared.targetConfiguration,
    'Focus configuration',
    completedRef,
    totalExpected,
  );
  if (isEvaluationError(targetEvaluation)) {
    return {
      phase: 'error',
      report: null,
      progress: toProgress(completedRef.completed, totalExpected),
      error: targetEvaluation.error,
      validationIssues: [],
    };
  }

  let currentConfiguration = structuredClone(prepared.targetConfiguration);
  let currentMetrics = targetEvaluation;
  let remainingAtoms = [...prepared.atoms];
  const removalSequence: AdditionalitySequenceEntry[] = [];

  for (let step = 1; remainingAtoms.length > 0; step += 1) {
    checkCancelled(dependencies.isCancelled);

    let bestCandidate: AdditionalityCandidate | null = null;
    let skippedCandidateCount = 0;

    for (const atom of remainingAtoms) {
      checkCancelled(dependencies.isCancelled);

      const invertedAtom = invertAdditionalityAtom(atom);
      const candidateConfiguration = applyAdditionalityAtomWithCatalog(
        currentConfiguration,
        invertedAtom,
        catalog,
        options.pkg,
      );
      const evaluation = await evaluateMetricsWithProgress(
        options,
        dependencies,
        candidateConfiguration,
        `Candidate ${step}: ${atom.outputLabel ?? 'Global'} / ${atom.label}`,
        completedRef,
        totalExpected,
      );

      if (isEvaluationError(evaluation)) {
        skippedCandidateCount += 1;
        skippedCandidates.push({
          step,
          atom,
          message: evaluation.error,
        });
        continue;
      }

      const metricsDeltaFromCurrent = subtractMetricVectors(evaluation, currentMetrics);
      const candidate: AdditionalityCandidate = {
        atom: invertedAtom,
        config: candidateConfiguration,
        metricsAfter: evaluation,
        metricsDeltaFromCurrent,
        absCostDelta: Math.abs(metricsDeltaFromCurrent.cost),
      };

      if (!bestCandidate || compareReverseGreedyCandidates(candidate, bestCandidate) < 0) {
        bestCandidate = candidate;
      }
    }

    if (!bestCandidate) {
      const report: AdditionalityReport = {
        ...buildReportBase(
          options,
          method,
          baseEvaluation,
          targetEvaluation,
          prepared.atoms.length,
          completedRef.completed,
          {},
        ),
        sequenceComplete: false,
        sequence: [],
        skippedCandidates,
      };

      return {
        phase: 'partial',
        report,
        progress: toProgress(completedRef.completed, totalExpected),
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
      absCostDelta: bestCandidate.absCostDelta,
      skippedCandidateCount,
    });

    currentConfiguration = bestCandidate.config;
    currentMetrics = bestCandidate.metricsAfter;
    remainingAtoms = remainingAtoms.filter((atom) => atom.key !== bestCandidate.atom.key);
  }

  const presentationSequence = buildPresentationSequence(removalSequence);

  const report: AdditionalityReport = {
    ...buildReportBase(
      options,
      method,
      baseEvaluation,
      targetEvaluation,
      prepared.atoms.length,
      completedRef.completed,
      {},
    ),
    sequenceComplete: true,
    sequence: presentationSequence,
    skippedCandidates,
  };

  return {
    phase: 'success',
    report,
    progress: toProgress(completedRef.completed, totalExpected),
    error: null,
    validationIssues: [],
  };
}

async function runShapleyAnalysis(
  options: AdditionalityRunOptions,
  dependencies: Required<Pick<AdditionalityRunDependencies, 'buildRequest' | 'solve'>> & Pick<AdditionalityRunDependencies, 'isCancelled' | 'onProgress'>,
  prepared: AdditionalityPreparation,
  sampleCount: AdditionalityShapleySampleCount,
): Promise<AdditionalityAnalysisState> {
  const method: AdditionalityOrderingMethod = 'shapley_permutation_sample';
  const totalExpected = prepared.totalExpected;
  const completedRef = { completed: 0 };
  const evaluationCache = new Map<string, EvaluationResult>();

  async function evaluateCached(
    configuration: ConfigurationDocument,
    label: string,
  ): Promise<EvaluationResult> {
    const key = stableStringify(configuration);
    const cached = evaluationCache.get(key);
    if (cached) {
      return cached;
    }

    const evaluation = await evaluateMetricsWithProgress(
      options,
      dependencies,
      configuration,
      label,
      completedRef,
      totalExpected,
    );
    evaluationCache.set(key, evaluation);
    return evaluation;
  }

  const baseEvaluation = await evaluateCached(prepared.baseConfiguration, 'Base configuration');
  if (isEvaluationError(baseEvaluation)) {
    return {
      phase: 'error',
      report: null,
      progress: toProgress(completedRef.completed, totalExpected),
      error: baseEvaluation.error,
      validationIssues: [],
    };
  }

  const targetEvaluation = await evaluateCached(prepared.targetConfiguration, 'Focus configuration');
  if (isEvaluationError(targetEvaluation)) {
    return {
      phase: 'error',
      report: null,
      progress: toProgress(completedRef.completed, totalExpected),
      error: targetEvaluation.error,
      validationIssues: [],
    };
  }

  const accumulators = new Map(
    prepared.atoms.map((atom) => [atom.key, createEmptyMetricVector()]),
  );
  const skippedPermutationErrors: string[] = [];
  let completedPermutations = 0;

  for (let permutationIndex = 0; permutationIndex < sampleCount; permutationIndex += 1) {
    checkCancelled(dependencies.isCancelled);

    const permutation = buildDeterministicPermutation(
      prepared.atoms,
      stableStringify({
        baseConfigId: options.baseConfigId,
        targetConfigId: options.targetConfigId,
        atomKeys: prepared.atoms.map((atom) => atom.key),
        sampleCount,
        permutationIndex,
      }),
    );
    let currentConfiguration = structuredClone(prepared.baseConfiguration);
    let currentMetrics = baseEvaluation;
    const permutationMarginals = new Map<string, AdditionalityMetricVector>();
    let permutationError: string | null = null;

    for (const atom of permutation) {
      currentConfiguration = applyAdditionalityAtom(
        currentConfiguration,
        atom,
        options.pkg,
      );
      const evaluation = await evaluateCached(
        currentConfiguration,
        `Permutation ${permutationIndex + 1}: ${atom.outputLabel ?? 'Global'} / ${atom.label}`,
      );

      if (isEvaluationError(evaluation)) {
        permutationError = evaluation.error;
        break;
      }

      permutationMarginals.set(atom.key, subtractMetricVectors(evaluation, currentMetrics));
      currentMetrics = evaluation;
    }

    if (permutationError) {
      skippedPermutationErrors.push(permutationError);
      continue;
    }

    completedPermutations += 1;
    for (const [atomKey, marginal] of permutationMarginals.entries()) {
      const accumulator = accumulators.get(atomKey);
      if (accumulator) {
        addMetricVectorInPlace(accumulator, marginal);
      }
    }
  }

  if (completedPermutations === 0) {
    return {
      phase: 'error',
      report: null,
      progress: toProgress(completedRef.completed, totalExpected),
      error: 'Sampled Shapley attribution failed because zero permutations completed.',
      validationIssues: [],
    };
  }

  const attributions = prepared.atoms.map((atom) => {
    const averageMarginal = divideMetricVector(
      accumulators.get(atom.key) ?? createEmptyMetricVector(),
      completedPermutations,
    );

    return {
      atom,
      marginal: averageMarginal,
      absCostDelta: Math.abs(averageMarginal.cost),
    };
  }).sort(compareObjectiveImpactAttributions);

  let cumulativeMetrics = cloneMetricVector(baseEvaluation);
  const sequence = attributions.map((attribution, index) => {
    const metricsBefore = cloneMetricVector(cumulativeMetrics);
    const metricsAfter = cloneMetricVector(cumulativeMetrics);
    addMetricVectorInPlace(metricsAfter, attribution.marginal);
    cumulativeMetrics = metricsAfter;

    return {
      step: index + 1,
      atom: attribution.atom,
      metricsBefore,
      metricsAfter,
      metricsDeltaFromCurrent: attribution.marginal,
      absCostDelta: attribution.absCostDelta,
      skippedCandidateCount: 0,
    };
  });

  const report: AdditionalityReport = {
    ...buildReportBase(
      options,
      method,
      baseEvaluation,
      targetEvaluation,
      prepared.atoms.length,
      completedRef.completed,
      {
        sampleCount,
        requestedPermutations: sampleCount,
        completedPermutations,
        skippedPermutations: sampleCount - completedPermutations,
        skippedPermutationErrors,
      },
    ),
    sequenceComplete: true,
    sequence,
    skippedCandidates: [],
  };

  return {
    phase: 'success',
    report,
    progress: toProgress(completedRef.completed, totalExpected),
    error: null,
    validationIssues: [],
  };
}

export async function runAdditionalityAnalysis(
  options: AdditionalityRunOptions,
  dependencies: AdditionalityRunDependencies = {},
): Promise<AdditionalityAnalysisState> {
  const method = resolveAdditionalityMethod(options.method);
  const shapleySampleCount = resolveShapleySampleCount(options.shapleySampleCount);
  const buildRequest = dependencies.buildRequest ?? buildSolveRequest;
  const solve = dependencies.solve;
  const prepared = prepareAdditionalityAnalysis({
    ...options,
    method,
    shapleySampleCount,
  });

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

  const requiredDependencies = {
    buildRequest,
    isCancelled: dependencies.isCancelled,
    onProgress: dependencies.onProgress,
    solve,
  };

  if (method === 'shapley_permutation_sample') {
    return runShapleyAnalysis(options, requiredDependencies, prepared, shapleySampleCount);
  }

  return runReverseGreedyAnalysis(options, requiredDependencies, prepared);
}

export function isAdditionalityCancelledError(error: unknown): boolean {
  return error instanceof AdditionalityCancelledError;
}
