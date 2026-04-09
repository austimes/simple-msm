import { resolveScenarioDocument } from '../data/demandResolution.ts';
import type {
  AppConfigRegistry,
  OutputRole,
  ScenarioDocument,
  SectorState,
} from '../data/types';
import type {
  NormalizedSolverInput,
  NormalizedSolverRow,
  SolveBindingConstraintSummary,
  SolveCommodityBalanceSummary,
  SolveRequest,
  SolveResult,
  SolveStateShareSummary,
} from '../solver/contract';

const FOSSIL_COMMODITIES = ['coal', 'natural_gas', 'refined_liquid_fuels'] as const;
const ELECTRICITY_COMMODITY = 'electricity';
const HYDROGEN_COMMODITY = 'hydrogen';
const BIOMASS_COMMODITY = 'biomass';
const SEQUESTRATION_COMMODITY = 'sequestration_service';
const SHARE_DELTA_THRESHOLD = 0.05;
const FLOW_DELTA_THRESHOLD = 1e-6;

type ComparisonSolveKey =
  | 'base'
  | 'compare'
  | 'noDemandDelta'
  | 'noPriceDelta'
  | 'noElectricityModeDelta'
  | 'noStateChoiceDelta'
  | 'noRemovalsDelta'
  | 'relaxedConstraints';

interface ConfigurationMetrics {
  totalCost: number | null;
  totalEmissions: number;
  energyEmissions: number;
  processEmissions: number;
  totalElectricityDemand: number;
  totalModeledElectricityDemand: number;
  totalElectricitySupply: number;
  totalFossilDemand: number;
  totalHydrogenDemand: number;
  totalBiomassDemand: number;
  totalSequestrationDemand: number;
  sectorYearEmissions: Map<string, number>;
  commodityYearDemand: Map<string, number>;
  outputCommodityTotalDemand: Map<string, number>;
  outputYearCommodityDemand: Map<string, number>;
  outputTotalEmissions: Map<string, number>;
  outputProcessEmissions: Map<string, number>;
  confidenceActivity: Map<string, number>;
  confidenceCost: Map<string, number>;
  confidenceEmissions: Map<string, number>;
  electricityBalances: Map<number, SolveCommodityBalanceSummary>;
  stateSharesByOutputYearState: Map<string, SolveStateShareSummary>;
  dominantStatesByOutputYear: Map<string, SolveStateShareSummary>;
  bindingConstraintsByOutputYear: Map<string, SolveBindingConstraintSummary[]>;
  bindingConstraints: SolveBindingConstraintSummary[];
}

export interface ComparisonConfigurationPlan {
  order: ComparisonSolveKey[];
  configurations: Record<ComparisonSolveKey, ScenarioDocument>;
}

export interface ComparisonConfigurationSolve {
  key: ComparisonSolveKey;
  label: string;
  configuration: ScenarioDocument;
  request: SolveRequest;
  result: SolveResult;
  metrics: ConfigurationMetrics;
}

export interface ComparisonMetricCard {
  id: string;
  label: string;
  unit: string;
  base: number | null;
  compare: number | null;
  delta: number | null;
}

export interface ComparisonEffectCard {
  id: string;
  title: string;
  summary: string;
  costDelta: number | null;
  emissionsDelta: number | null;
  electricityDemandDelta: number | null;
  note?: string;
}

export interface SectorEmissionDelta {
  sector: string;
  totalDelta: number;
  yearly: Array<{ year: number; delta: number }>;
}

export interface CommodityDemandDelta {
  commodityId: string;
  label: string;
  totalDelta: number;
  yearly: Array<{ year: number; delta: number }>;
}

export interface ElectricityDelta {
  year: number;
  baseMode: string;
  compareMode: string;
  supplyDelta: number;
  modeledDemandDelta: number;
  totalDemandDelta: number;
  averageSupplyCostDelta: number | null;
  averageDirectEmissionsIntensityDelta: number | null;
}

export interface ConfidenceDelta {
  rating: string;
  activityDelta: number;
  costDelta: number;
  emissionsDelta: number;
}

export interface StateShareDelta {
  outputId: string;
  outputLabel: string;
  year: number;
  fromStateLabel: string;
  toStateLabel: string;
  winningStateLabel: string;
  winningShareDelta: number;
  losingStateLabel: string;
  losingShareDelta: number;
  signals: string[];
  narrative: string;
}

export interface ComparisonNarrative {
  id: string;
  title: string;
  summary: string;
  evidence?: string;
}

export interface ComparisonReport {
  heuristicNote: string;
  baseConfigurationName: string;
  compareConfigurationName: string;
  compareConfigurationDescription: string | null;
  configurationStatuses: Array<{ key: ComparisonSolveKey; label: string; status: SolveResult['status'] }>;
  metrics: ComparisonMetricCard[];
  decomposition: ComparisonEffectCard[];
  sectorEmissionDeltas: SectorEmissionDelta[];
  commodityDemandDeltas: CommodityDemandDelta[];
  electricityDeltas: ElectricityDelta[];
  confidenceDeltas: ConfidenceDelta[];
  stateShareDeltas: StateShareDelta[];
  narratives: ComparisonNarrative[];
}

function controlLabelForKey(key: ComparisonSolveKey): string {
  switch (key) {
    case 'base':
      return 'Reference configuration';
    case 'compare':
      return 'Transition configuration';
    case 'noDemandDelta':
      return 'Counterfactual without demand delta';
    case 'noPriceDelta':
      return 'Counterfactual without price delta';
    case 'noElectricityModeDelta':
      return 'Counterfactual without electricity-mode delta';
    case 'noStateChoiceDelta':
      return 'Counterfactual without state-choice delta';
    case 'noRemovalsDelta':
      return 'Counterfactual without removals activation';
    case 'relaxedConstraints':
      return 'Counterfactual with constrained caps';
  }
}

function outputYearKey(outputId: string, year: number): string {
  return `${outputId}::${year}`;
}

function outputYearStateKey(outputId: string, year: number, stateId: string): string {
  return `${outputId}::${year}::${stateId}`;
}

function sectorYearKey(sector: string, year: number): string {
  return `${sector}::${year}`;
}

function commodityYearKey(commodityId: string, year: number): string {
  return `${commodityId}::${year}`;
}

function outputCommodityKey(outputId: string, commodityId: string): string {
  return `${outputId}::${commodityId}`;
}

function outputYearCommodityKey(outputId: string, year: number, commodityId: string): string {
  return `${outputId}::${year}::${commodityId}`;
}

function addToMap(map: Map<string, number>, key: string, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value);
}

function getFromMap(map: Map<string, number>, key: string): number {
  return map.get(key) ?? 0;
}

function diff(compareValue: number | null, baseValue: number | null): number | null {
  if (compareValue == null || baseValue == null) {
    return null;
  }

  return compareValue - baseValue;
}

function sumInputCoefficients(inputs: NormalizedSolverInput[], commodityIds: readonly string[]): number {
  const commoditySet = new Set(commodityIds);
  return inputs.reduce((total, input) => {
    return commoditySet.has(input.commodityId) ? total + input.coefficient : total;
  }, 0);
}

function sumSpecificInputCoefficient(inputs: NormalizedSolverInput[], commodityId: string): number {
  return inputs.reduce((total, input) => {
    return input.commodityId === commodityId ? total + input.coefficient : total;
  }, 0);
}

function sumDirectEmissions(row: NormalizedSolverRow, source?: 'energy' | 'process'): number {
  return row.directEmissions.reduce((total, entry) => {
    if (source && entry.source !== source) {
      return total;
    }

    return total + entry.value;
  }, 0);
}

function resolveCommodityPrice(request: SolveRequest, commodityId: string, year: number): number {
  return request.configuration.commodityPriceByCommodity[commodityId]?.valuesByYear[String(year)] ?? 0;
}

function resolveCarbonPrice(request: SolveRequest, year: number): number {
  return request.configuration.carbonPriceByYear[String(year)] ?? 0;
}

function buildBalancedCommodityKeys(request: SolveRequest): Set<string> {
  const balanced = new Set<string>();

  for (const row of request.rows) {
    if (row.outputRole !== 'endogenous_supply_commodity') {
      continue;
    }

    const control = request.configuration.controlsByOutput[row.outputId]?.[String(row.year)];
    if (control?.mode === 'externalized') {
      continue;
    }

    balanced.add(commodityYearKey(row.outputId, row.year));
  }

  return balanced;
}

function resolveRowObjectiveCostPerUnit(
  request: SolveRequest,
  row: NormalizedSolverRow,
  balancedCommodityKeys: Set<string>,
): number {
  const conversionCost = row.conversionCostPerUnit ?? 0;
  const carbonCost = sumDirectEmissions(row) * resolveCarbonPrice(request, row.year);
  const inputCost = row.inputs.reduce((total, input) => {
    if (balancedCommodityKeys.has(commodityYearKey(input.commodityId, row.year))) {
      return total;
    }

    return total + input.coefficient * resolveCommodityPrice(request, input.commodityId, row.year);
  }, 0);

  return conversionCost + carbonCost + inputCost;
}

function formatTitle(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replaceAll('/', ' / ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatCommodityLabel(commodityId: string): string {
  switch (commodityId) {
    case 'natural_gas':
      return 'Natural gas';
    case 'refined_liquid_fuels':
      return 'Refined liquid fuels';
    case 'scrap_steel':
      return 'Scrap steel';
    case 'iron_ore':
      return 'Iron ore';
    case 'sequestration_service':
      return 'Sequestration service';
    default:
      return formatTitle(commodityId);
  }
}

function joinList(items: string[]): string {
  if (items.length === 0) {
    return '';
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function describeSigned(value: number, positiveLabel: string, negativeLabel: string): string {
  if (value > 0) {
    return positiveLabel;
  }

  if (value < 0) {
    return negativeLabel;
  }

  return 'little net change';
}

function ratingKey(value: string | undefined): string {
  return (value ?? 'unspecified').trim().toLowerCase() || 'unspecified';
}

function makeManualScenario(
  scenario: ScenarioDocument,
  notes: string,
  name = scenario.name,
  description = scenario.description ?? undefined,
): ScenarioDocument {
  return {
    ...structuredClone(scenario),
    name,
    description,
    service_demands: structuredClone(scenario.service_demands),
    external_commodity_demands: structuredClone(scenario.external_commodity_demands ?? {}),
    demand_generation: {
      mode: 'manual_table',
      anchor_year: 2025,
      preset_id: null,
      service_anchors: {},
      notes,
    },
  };
}

function cloneScenarioWithLabel(
  scenario: ScenarioDocument,
  name: string,
  description: string,
  notes: string,
): ScenarioDocument {
  return makeManualScenario(scenario, notes, name, description);
}

function applyRequiredServiceControls(
  target: ScenarioDocument,
  source: ScenarioDocument,
  appConfig: AppConfigRegistry,
): void {
  for (const [outputId, metadata] of Object.entries(appConfig.output_roles)) {
    if (metadata.output_role !== 'required_service') {
      continue;
    }

    target.service_controls[outputId] = structuredClone(source.service_controls[outputId]);
  }
}

function applyOptionalRemovalsControls(
  target: ScenarioDocument,
  source: ScenarioDocument,
  appConfig: AppConfigRegistry,
): void {
  for (const [outputId, metadata] of Object.entries(appConfig.output_roles)) {
    if (metadata.output_role !== 'optional_removals') {
      continue;
    }

    target.service_controls[outputId] = structuredClone(source.service_controls[outputId]);
  }
}

export function buildTransitionCounterfactual(
  baseConfiguration: ScenarioDocument,
  appConfig: AppConfigRegistry,
): ScenarioDocument {
  const draft = structuredClone(baseConfiguration);
  draft.name = 'Transition counterfactual';
  draft.description = 'Built-in compare run with stronger demand growth, cleaner input prices, non-zero carbon prices, optimized state choices, electricity optimization, and removals switched on for transparent heuristic attribution.';
  draft.demand_generation = {
    ...draft.demand_generation,
    mode: 'anchor_plus_preset_with_overrides',
    preset_id: 'simple_sector_growth_high',
  };
  draft.commodity_pricing = {
    selections_by_commodity: Object.fromEntries(
      Object.keys(baseConfiguration.commodity_pricing.selections_by_commodity ?? {}).map(
        (id) => [id, 'low' as const],
      ),
    ),
    overrides: {},
  };
  draft.carbon_price = {
    2025: 20,
    2030: 80,
    2035: 140,
    2040: 180,
    2045: 220,
    2050: 260,
  };

  for (const [outputId, metadata] of Object.entries(appConfig.output_roles)) {
    if (metadata.output_role === 'required_service') {
      draft.service_controls[outputId] = {
        mode: 'optimize',
      };
      continue;
    }

    if (outputId === 'electricity') {
      draft.service_controls[outputId] = {
        mode: 'optimize',
      };
      continue;
    }

    if (metadata.output_role === 'optional_removals') {
      draft.service_controls[outputId] = outputId === 'engineered_removals'
        ? { mode: 'target', target_value: 5_000_000 }
        : { mode: 'optimize' };
    }
  }

  draft.solver_options = {
    ...draft.solver_options,
    respect_max_share: false,
    respect_max_activity: false,
    soft_constraints: false,
    allow_removals_credit: true,
    share_smoothing: {
      enabled: false,
      max_delta_pp: draft.solver_options?.share_smoothing?.max_delta_pp ?? 20,
      notes: draft.solver_options?.share_smoothing?.notes ?? null,
    },
  };

  const resolved = resolveScenarioDocument(draft, appConfig, 'transition counterfactual');
  return makeManualScenario(
    resolved,
    'Compare mode locks this counterfactual into explicit milestone-year tables so partial counterfactual solves can swap one driver at a time.',
  );
}

export function buildComparisonConfigurationPlan(
  baseConfiguration: ScenarioDocument,
  appConfig: AppConfigRegistry,
): ComparisonConfigurationPlan {
  const base = makeManualScenario(
    baseConfiguration,
    'Compare mode locks the reference configuration into explicit milestone-year tables and relaxes caps in the primary baseline so state-choice deltas remain solvable.',
    `${baseConfiguration.name} (compare baseline)`,
    `${baseConfiguration.description ?? 'Reference configuration.'} Compare mode relaxes max-share and max-activity caps in the primary baseline, then re-imposes them in a shadow run when it explains constraint effects.`,
  );
  base.solver_options = {
    ...base.solver_options,
    respect_max_share: false,
    respect_max_activity: false,
  };
  base.service_controls.electricity = {
    mode: 'externalized',
  };
  const compare = buildTransitionCounterfactual(baseConfiguration, appConfig);

  const noDemandDelta = cloneScenarioWithLabel(
    compare,
    'Transition counterfactual without demand delta',
    'Matches the transition counterfactual but restores the reference demand tables so demand-growth effects can be isolated heuristically.',
    'Demand tables restored to the reference configuration for heuristic compare attribution.',
  );
  noDemandDelta.service_demands = structuredClone(base.service_demands);
  noDemandDelta.external_commodity_demands = structuredClone(base.external_commodity_demands ?? {});

  const noPriceDelta = cloneScenarioWithLabel(
    compare,
    'Transition counterfactual without price delta',
    'Matches the transition counterfactual but restores the reference commodity and carbon prices.',
    'Commodity-price and carbon-price deltas restored to the reference configuration for heuristic compare attribution.',
  );
  noPriceDelta.commodity_pricing = structuredClone(base.commodity_pricing);
  noPriceDelta.carbon_price = structuredClone(base.carbon_price);

  const noElectricityModeDelta = cloneScenarioWithLabel(
    compare,
    'Transition counterfactual without electricity-mode delta',
    'Matches the transition counterfactual but restores the reference electricity control mode.',
    'Electricity control restored to the reference configuration for heuristic compare attribution.',
  );
  noElectricityModeDelta.service_controls.electricity = structuredClone(base.service_controls.electricity);

  const noStateChoiceDelta = cloneScenarioWithLabel(
    compare,
    'Transition counterfactual without state-choice delta',
    'Matches the transition counterfactual but keeps all required-service controls at their reference settings.',
    'Required-service controls restored to the reference configuration for heuristic compare attribution.',
  );
  applyRequiredServiceControls(noStateChoiceDelta, base, appConfig);
  noStateChoiceDelta.service_controls.electricity = structuredClone(base.service_controls.electricity);

  const noRemovalsDelta = cloneScenarioWithLabel(
    compare,
    'Transition counterfactual without removals activation',
    'Matches the transition counterfactual but restores the reference removals controls.',
    'Optional-removals controls restored to the reference configuration for heuristic compare attribution.',
  );
  applyOptionalRemovalsControls(noRemovalsDelta, base, appConfig);

  const relaxedConstraints = cloneScenarioWithLabel(
    compare,
    'Transition counterfactual with constrained caps',
    'Matches the transition counterfactual but re-imposes max-share and max-activity caps to expose the constraint shadow.',
    'Max-share and max-activity caps re-imposed for heuristic constraint-shadow attribution.',
  );
  relaxedConstraints.solver_options = {
    ...relaxedConstraints.solver_options,
    respect_max_share: true,
    respect_max_activity: true,
  };

  return {
    order: [
      'base',
      'compare',
      'noDemandDelta',
      'noPriceDelta',
      'noElectricityModeDelta',
      'noStateChoiceDelta',
      'noRemovalsDelta',
      'relaxedConstraints',
    ],
    configurations: {
      base,
      compare,
      noDemandDelta,
      noPriceDelta,
      noElectricityModeDelta,
      noStateChoiceDelta,
      noRemovalsDelta,
      relaxedConstraints,
    },
  };
}

function calculateConfigurationMetrics(
  request: SolveRequest,
  result: SolveResult,
  sectorStateByRowId: Map<string, SectorState>,
): ConfigurationMetrics {
  const balancedCommodityKeys = buildBalancedCommodityKeys(request);
  const variableValues = new Map(
    result.raw?.variables.map((entry) => [entry.id, entry.value]) ?? [],
  );
  const metrics: ConfigurationMetrics = {
    totalCost: result.raw?.objectiveValue ?? null,
    totalEmissions: 0,
    energyEmissions: 0,
    processEmissions: 0,
    totalElectricityDemand: 0,
    totalModeledElectricityDemand: 0,
    totalElectricitySupply: 0,
    totalFossilDemand: 0,
    totalHydrogenDemand: 0,
    totalBiomassDemand: 0,
    totalSequestrationDemand: 0,
    sectorYearEmissions: new Map(),
    commodityYearDemand: new Map(),
    outputCommodityTotalDemand: new Map(),
    outputYearCommodityDemand: new Map(),
    outputTotalEmissions: new Map(),
    outputProcessEmissions: new Map(),
    confidenceActivity: new Map(),
    confidenceCost: new Map(),
    confidenceEmissions: new Map(),
    electricityBalances: new Map(),
    stateSharesByOutputYearState: new Map(),
    dominantStatesByOutputYear: new Map(),
    bindingConstraintsByOutputYear: new Map(),
    bindingConstraints: result.reporting.bindingConstraints,
  };

  for (const row of request.rows) {
    const activity = variableValues.get(`activity:${row.rowId}`) ?? 0;
    if (Math.abs(activity) <= FLOW_DELTA_THRESHOLD) {
      continue;
    }

    const rowEmissions = sumDirectEmissions(row) * activity;
    const rowEnergyEmissions = sumDirectEmissions(row, 'energy') * activity;
    const rowProcessEmissions = sumDirectEmissions(row, 'process') * activity;
    const rowCost = resolveRowObjectiveCostPerUnit(request, row, balancedCommodityKeys) * activity;
    const sectorState = sectorStateByRowId.get(row.rowId);
    const confidence = ratingKey(sectorState?.confidence_rating);

    metrics.totalEmissions += rowEmissions;
    metrics.energyEmissions += rowEnergyEmissions;
    metrics.processEmissions += rowProcessEmissions;
    addToMap(metrics.sectorYearEmissions, sectorYearKey(row.sector, row.year), rowEmissions);
    addToMap(metrics.outputTotalEmissions, row.outputId, rowEmissions);
    addToMap(metrics.outputProcessEmissions, row.outputId, rowProcessEmissions);
    addToMap(metrics.confidenceActivity, confidence, activity);
    addToMap(metrics.confidenceCost, confidence, rowCost);
    addToMap(metrics.confidenceEmissions, confidence, rowEmissions);

    for (const input of row.inputs) {
      const demand = input.coefficient * activity;
      if (Math.abs(demand) <= FLOW_DELTA_THRESHOLD) {
        continue;
      }

      addToMap(metrics.commodityYearDemand, commodityYearKey(input.commodityId, row.year), demand);
      addToMap(metrics.outputCommodityTotalDemand, outputCommodityKey(row.outputId, input.commodityId), demand);
      addToMap(
        metrics.outputYearCommodityDemand,
        outputYearCommodityKey(row.outputId, row.year, input.commodityId),
        demand,
      );
    }
  }

  for (const [commodityId, valuesByYear] of Object.entries(
    request.configuration.externalCommodityDemandByCommodity,
  )) {
    for (const [year, value] of Object.entries(valuesByYear)) {
      if (Math.abs(value) <= FLOW_DELTA_THRESHOLD) {
        continue;
      }

      addToMap(metrics.commodityYearDemand, commodityYearKey(commodityId, Number(year)), value);
    }
  }

  for (const balance of result.reporting.commodityBalances) {
    if (balance.commodityId !== ELECTRICITY_COMMODITY) {
      continue;
    }

    metrics.electricityBalances.set(balance.year, balance);
    metrics.totalModeledElectricityDemand += balance.modeledDemand;
    metrics.totalElectricitySupply += balance.supply;
  }

  metrics.totalElectricityDemand = Array.from(metrics.commodityYearDemand.entries())
    .filter(([key]) => key.startsWith(`${ELECTRICITY_COMMODITY}::`))
    .reduce((total, [, value]) => total + value, 0);
  metrics.totalFossilDemand = FOSSIL_COMMODITIES.reduce((total, commodityId) => {
    return total + Array.from(metrics.commodityYearDemand.entries())
      .filter(([key]) => key.startsWith(`${commodityId}::`))
      .reduce((subtotal, [, value]) => subtotal + value, 0);
  }, 0);
  metrics.totalHydrogenDemand = Array.from(metrics.commodityYearDemand.entries())
    .filter(([key]) => key.startsWith(`${HYDROGEN_COMMODITY}::`))
    .reduce((total, [, value]) => total + value, 0);
  metrics.totalBiomassDemand = Array.from(metrics.commodityYearDemand.entries())
    .filter(([key]) => key.startsWith(`${BIOMASS_COMMODITY}::`))
    .reduce((total, [, value]) => total + value, 0);
  metrics.totalSequestrationDemand = Array.from(metrics.commodityYearDemand.entries())
    .filter(([key]) => key.startsWith(`${SEQUESTRATION_COMMODITY}::`))
    .reduce((total, [, value]) => total + value, 0);

  for (const share of result.reporting.stateShares) {
    metrics.stateSharesByOutputYearState.set(
      outputYearStateKey(share.outputId, share.year, share.stateId),
      share,
    );
    const key = outputYearKey(share.outputId, share.year);
    const current = metrics.dominantStatesByOutputYear.get(key);
    const currentActivity = current?.activity ?? -1;
    if (share.activity > currentActivity) {
      metrics.dominantStatesByOutputYear.set(key, share);
    }
  }

  for (const constraint of result.reporting.bindingConstraints) {
    const key = outputYearKey(constraint.outputId, constraint.year);
    const existing = metrics.bindingConstraintsByOutputYear.get(key) ?? [];
    existing.push(constraint);
    metrics.bindingConstraintsByOutputYear.set(key, existing);
  }

  return metrics;
}

function buildStateSignals(fromState: SectorState | undefined, toState: SectorState | undefined): string[] {
  if (!fromState || !toState) {
    return [];
  }

  const fromElectricity = sumSpecificInputCoefficient(
    fromState.input_commodities.map((commodityId, index) => ({
      commodityId,
      coefficient: fromState.input_coefficients[index] ?? 0,
      unit: fromState.input_units[index] ?? '',
    })),
    ELECTRICITY_COMMODITY,
  );
  const toElectricity = sumSpecificInputCoefficient(
    toState.input_commodities.map((commodityId, index) => ({
      commodityId,
      coefficient: toState.input_coefficients[index] ?? 0,
      unit: toState.input_units[index] ?? '',
    })),
    ELECTRICITY_COMMODITY,
  );
  const fromFossils = sumInputCoefficients(
    fromState.input_commodities.map((commodityId, index) => ({
      commodityId,
      coefficient: fromState.input_coefficients[index] ?? 0,
      unit: fromState.input_units[index] ?? '',
    })),
    FOSSIL_COMMODITIES,
  );
  const toFossils = sumInputCoefficients(
    toState.input_commodities.map((commodityId, index) => ({
      commodityId,
      coefficient: toState.input_coefficients[index] ?? 0,
      unit: toState.input_units[index] ?? '',
    })),
    FOSSIL_COMMODITIES,
  );
  const fromHydrogen = sumSpecificInputCoefficient(
    fromState.input_commodities.map((commodityId, index) => ({
      commodityId,
      coefficient: fromState.input_coefficients[index] ?? 0,
      unit: fromState.input_units[index] ?? '',
    })),
    HYDROGEN_COMMODITY,
  );
  const toHydrogen = sumSpecificInputCoefficient(
    toState.input_commodities.map((commodityId, index) => ({
      commodityId,
      coefficient: toState.input_coefficients[index] ?? 0,
      unit: toState.input_units[index] ?? '',
    })),
    HYDROGEN_COMMODITY,
  );
  const fromBiomass = sumSpecificInputCoefficient(
    fromState.input_commodities.map((commodityId, index) => ({
      commodityId,
      coefficient: fromState.input_coefficients[index] ?? 0,
      unit: fromState.input_units[index] ?? '',
    })),
    BIOMASS_COMMODITY,
  );
  const toBiomass = sumSpecificInputCoefficient(
    toState.input_commodities.map((commodityId, index) => ({
      commodityId,
      coefficient: fromState.input_coefficients[index] ?? 0,
      unit: fromState.input_units[index] ?? '',
    })),
    BIOMASS_COMMODITY,
  );
  const fromSequestration = sumSpecificInputCoefficient(
    fromState.input_commodities.map((commodityId, index) => ({
      commodityId,
      coefficient: fromState.input_coefficients[index] ?? 0,
      unit: fromState.input_units[index] ?? '',
    })),
    SEQUESTRATION_COMMODITY,
  );
  const toSequestration = sumSpecificInputCoefficient(
    toState.input_commodities.map((commodityId, index) => ({
      commodityId,
      coefficient: toState.input_coefficients[index] ?? 0,
      unit: toState.input_units[index] ?? '',
    })),
    SEQUESTRATION_COMMODITY,
  );
  const fromProcess = fromState.process_emissions_by_pollutant.reduce((total, item) => total + item.value, 0);
  const toProcess = toState.process_emissions_by_pollutant.reduce((total, item) => total + item.value, 0);

  const signals: string[] = [];
  if (toElectricity > fromElectricity && toFossils < fromFossils) {
    signals.push('electrification');
  }
  if (toHydrogen > fromHydrogen && toFossils < fromFossils) {
    signals.push('hydrogen switch');
  }
  if (toBiomass > fromBiomass && toFossils < fromFossils) {
    signals.push('biomass switch');
  }
  if (toProcess < fromProcess) {
    signals.push('process abatement');
  }
  if (toSequestration > fromSequestration) {
    signals.push('sequestration dependence');
  }

  return signals;
}

function buildStateShareDeltas(
  base: ComparisonConfigurationSolve,
  compare: ComparisonConfigurationSolve,
  constraintSource: ComparisonConfigurationSolve,
  appConfig: AppConfigRegistry,
  sectorStateByRowId: Map<string, SectorState>,
): StateShareDelta[] {
  const outputYearKeys = new Set<string>([
    ...base.metrics.dominantStatesByOutputYear.keys(),
    ...compare.metrics.dominantStatesByOutputYear.keys(),
  ]);

  const deltas: StateShareDelta[] = [];

  for (const key of outputYearKeys) {
    const [outputId, yearText] = key.split('::');
    const year = Number(yearText);
    const outputLabel = appConfig.output_roles[outputId]?.display_label ?? formatTitle(outputId);
    const stateIds = new Set<string>();

    for (const shareKey of base.metrics.stateSharesByOutputYearState.keys()) {
      if (shareKey.startsWith(`${outputId}::${year}::`)) {
        stateIds.add(shareKey.split('::')[2]);
      }
    }
    for (const shareKey of compare.metrics.stateSharesByOutputYearState.keys()) {
      if (shareKey.startsWith(`${outputId}::${year}::`)) {
        stateIds.add(shareKey.split('::')[2]);
      }
    }

    let winning: { label: string; delta: number; stateId: string } | null = null;
    let losing: { label: string; delta: number; stateId: string } | null = null;

    for (const stateId of stateIds) {
      const baseShare = base.metrics.stateSharesByOutputYearState.get(
        outputYearStateKey(outputId, year, stateId),
      )?.share ?? 0;
      const compareShare = compare.metrics.stateSharesByOutputYearState.get(
        outputYearStateKey(outputId, year, stateId),
      )?.share ?? 0;
      const delta = compareShare - baseShare;
      const label = compare.metrics.stateSharesByOutputYearState.get(
        outputYearStateKey(outputId, year, stateId),
      )?.stateLabel
        ?? base.metrics.stateSharesByOutputYearState.get(outputYearStateKey(outputId, year, stateId))?.stateLabel
        ?? stateId;

      if (!winning || delta > winning.delta) {
        winning = { label, delta, stateId };
      }
      if (!losing || delta < losing.delta) {
        losing = { label, delta, stateId };
      }
    }

    const fromState = base.metrics.dominantStatesByOutputYear.get(key);
    const toState = compare.metrics.dominantStatesByOutputYear.get(key);
    const dominantChanged = fromState?.stateId !== toState?.stateId;
    const winningDelta = winning?.delta ?? 0;
    const losingDelta = losing?.delta ?? 0;

    if (!dominantChanged
      && Math.abs(winningDelta) < SHARE_DELTA_THRESHOLD
      && Math.abs(losingDelta) < SHARE_DELTA_THRESHOLD) {
      continue;
    }

    const fromStateMetadata = fromState
      ? sectorStateByRowId.get(`${fromState.stateId}::${year}`)
      : undefined;
    const toStateMetadata = toState
      ? sectorStateByRowId.get(`${toState.stateId}::${year}`)
      : undefined;
    const signals = buildStateSignals(fromStateMetadata, toStateMetadata);
    const constraintLabels = (constraintSource.metrics.bindingConstraintsByOutputYear.get(key) ?? [])
      .slice(0, 2)
      .map((constraint) => formatTitle(constraint.kind));
    const narrativeParts = [
      dominantChanged
        ? `${outputLabel} flips from ${fromState?.stateLabel ?? 'no modeled activity'} to ${toState?.stateLabel ?? 'no modeled activity'}`
        : `${outputLabel} keeps its lead state but materially rebalances shares`,
      signals.length > 0
        ? `with ${joinList(signals)} as the main technical signal`
        : 'without a clean single technical signal',
      constraintLabels.length > 0
        ? `while ${joinList(constraintLabels.map((label) => label.toLowerCase()))} stays visible in the binding set`
        : 'and no new binding cap dominates the shift',
    ];

    deltas.push({
      outputId,
      outputLabel,
      year,
      fromStateLabel: fromState?.stateLabel ?? 'No modeled activity',
      toStateLabel: toState?.stateLabel ?? 'No modeled activity',
      winningStateLabel: winning?.label ?? '—',
      winningShareDelta: winningDelta,
      losingStateLabel: losing?.label ?? '—',
      losingShareDelta: losingDelta,
      signals,
      narrative: `${narrativeParts[0]}, ${narrativeParts[1]}, ${narrativeParts[2]}.`,
    });
  }

  return deltas.sort((left, right) => {
    const leftMagnitude = Math.max(Math.abs(left.winningShareDelta), Math.abs(left.losingShareDelta));
    const rightMagnitude = Math.max(Math.abs(right.winningShareDelta), Math.abs(right.losingShareDelta));
    return rightMagnitude - leftMagnitude || left.year - right.year || left.outputLabel.localeCompare(right.outputLabel);
  });
}

function extractYearsFromMap(map: Map<string, number>): number[] {
  return Array.from(new Set(Array.from(map.keys()).map((key) => Number(key.split('::').at(-1))))).sort((a, b) => a - b);
}

function buildSectorEmissionDeltas(
  base: ConfigurationMetrics,
  compare: ConfigurationMetrics,
): SectorEmissionDelta[] {
  const sectors = new Set<string>([
    ...Array.from(base.sectorYearEmissions.keys()).map((key) => key.split('::')[0]),
    ...Array.from(compare.sectorYearEmissions.keys()).map((key) => key.split('::')[0]),
  ]);
  const years = Array.from(new Set([
    ...extractYearsFromMap(base.sectorYearEmissions),
    ...extractYearsFromMap(compare.sectorYearEmissions),
  ])).sort((a, b) => a - b);

  return Array.from(sectors)
    .map((sector) => {
      const yearly = years.map((year) => ({
        year,
        delta: getFromMap(compare.sectorYearEmissions, sectorYearKey(sector, year))
          - getFromMap(base.sectorYearEmissions, sectorYearKey(sector, year)),
      }));
      return {
        sector,
        totalDelta: yearly.reduce((total, entry) => total + entry.delta, 0),
        yearly,
      } satisfies SectorEmissionDelta;
    })
    .filter((entry) => Math.abs(entry.totalDelta) > FLOW_DELTA_THRESHOLD)
    .sort((left, right) => Math.abs(right.totalDelta) - Math.abs(left.totalDelta));
}

function buildCommodityDemandDeltas(
  base: ConfigurationMetrics,
  compare: ConfigurationMetrics,
): CommodityDemandDelta[] {
  const commodityIds = new Set<string>([
    ...Array.from(base.commodityYearDemand.keys()).map((key) => key.split('::')[0]),
    ...Array.from(compare.commodityYearDemand.keys()).map((key) => key.split('::')[0]),
  ]);
  const years = Array.from(new Set([
    ...extractYearsFromMap(base.commodityYearDemand),
    ...extractYearsFromMap(compare.commodityYearDemand),
  ])).sort((a, b) => a - b);

  return Array.from(commodityIds)
    .map((commodityId) => {
      const yearly = years.map((year) => ({
        year,
        delta: getFromMap(compare.commodityYearDemand, commodityYearKey(commodityId, year))
          - getFromMap(base.commodityYearDemand, commodityYearKey(commodityId, year)),
      }));
      return {
        commodityId,
        label: formatCommodityLabel(commodityId),
        totalDelta: yearly.reduce((total, entry) => total + entry.delta, 0),
        yearly,
      } satisfies CommodityDemandDelta;
    })
    .filter((entry) => Math.abs(entry.totalDelta) > FLOW_DELTA_THRESHOLD)
    .sort((left, right) => Math.abs(right.totalDelta) - Math.abs(left.totalDelta));
}

function buildElectricityDeltas(
  base: ConfigurationMetrics,
  compare: ConfigurationMetrics,
): ElectricityDelta[] {
  const years = Array.from(new Set([
    ...base.electricityBalances.keys(),
    ...compare.electricityBalances.keys(),
  ])).sort((a, b) => a - b);

  return years.map((year) => {
    const baseBalance = base.electricityBalances.get(year);
    const compareBalance = compare.electricityBalances.get(year);

    return {
      year,
      baseMode: baseBalance?.mode ?? 'n/a',
      compareMode: compareBalance?.mode ?? 'n/a',
      supplyDelta: (compareBalance?.supply ?? 0) - (baseBalance?.supply ?? 0),
      modeledDemandDelta: (compareBalance?.modeledDemand ?? 0) - (baseBalance?.modeledDemand ?? 0),
      totalDemandDelta: (compareBalance?.totalDemand ?? 0) - (baseBalance?.totalDemand ?? 0),
      averageSupplyCostDelta: diff(compareBalance?.averageSupplyCost ?? null, baseBalance?.averageSupplyCost ?? null),
      averageDirectEmissionsIntensityDelta: diff(
        compareBalance?.averageDirectEmissionsIntensity ?? null,
        baseBalance?.averageDirectEmissionsIntensity ?? null,
      ),
    } satisfies ElectricityDelta;
  });
}

function buildConfidenceDeltas(
  base: ConfigurationMetrics,
  compare: ConfigurationMetrics,
): ConfidenceDelta[] {
  const ratings = new Set<string>([
    ...base.confidenceActivity.keys(),
    ...compare.confidenceActivity.keys(),
    ...base.confidenceCost.keys(),
    ...compare.confidenceCost.keys(),
    ...base.confidenceEmissions.keys(),
    ...compare.confidenceEmissions.keys(),
  ]);

  const preferredOrder = ['high', 'medium', 'low', 'exploratory', 'unspecified'];

  return Array.from(ratings)
    .map((rating) => ({
      rating,
      activityDelta: getFromMap(compare.confidenceActivity, rating) - getFromMap(base.confidenceActivity, rating),
      costDelta: getFromMap(compare.confidenceCost, rating) - getFromMap(base.confidenceCost, rating),
      emissionsDelta: getFromMap(compare.confidenceEmissions, rating) - getFromMap(base.confidenceEmissions, rating),
    }))
    .sort((left, right) => {
      const leftIndex = preferredOrder.indexOf(left.rating);
      const rightIndex = preferredOrder.indexOf(right.rating);
      if (leftIndex !== rightIndex) {
        return (leftIndex === -1 ? preferredOrder.length : leftIndex)
          - (rightIndex === -1 ? preferredOrder.length : rightIndex);
      }

      return left.rating.localeCompare(right.rating);
    });
}

function topItems<T>(items: T[], selector: (item: T) => number, count: number): T[] {
  return [...items]
    .sort((left, right) => Math.abs(selector(right)) - Math.abs(selector(left)))
    .slice(0, count);
}

function buildEffectCard(
  id: string,
  title: string,
  compareConfiguration: ComparisonConfigurationSolve,
  withheldConfiguration: ComparisonConfigurationSolve,
  summary: string,
  note?: string,
): ComparisonEffectCard {
  return {
    id,
    title,
    summary,
    costDelta: diff(compareConfiguration.metrics.totalCost, withheldConfiguration.metrics.totalCost),
    emissionsDelta: compareConfiguration.metrics.totalEmissions - withheldConfiguration.metrics.totalEmissions,
    electricityDemandDelta:
      compareConfiguration.metrics.totalElectricityDemand - withheldConfiguration.metrics.totalElectricityDemand,
    note,
  };
}

function outputDemandDelta(
  base: ConfigurationMetrics,
  compare: ConfigurationMetrics,
  outputId: string,
  commodityId: string,
): number {
  return getFromMap(compare.outputCommodityTotalDemand, outputCommodityKey(outputId, commodityId))
    - getFromMap(base.outputCommodityTotalDemand, outputCommodityKey(outputId, commodityId));
}

function buildElectrificationDrivers(
  base: ConfigurationMetrics,
  compare: ConfigurationMetrics,
  appConfig: AppConfigRegistry,
): Array<{ outputId: string; outputLabel: string; electricityDelta: number; fossilDelta: number }> {
  const outputIds = new Set<string>([
    ...Array.from(base.outputCommodityTotalDemand.keys()).map((key) => key.split('::')[0]),
    ...Array.from(compare.outputCommodityTotalDemand.keys()).map((key) => key.split('::')[0]),
  ]);

  return Array.from(outputIds)
    .map((outputId) => {
      const electricityDelta = outputDemandDelta(base, compare, outputId, ELECTRICITY_COMMODITY);
      const fossilDelta = FOSSIL_COMMODITIES.reduce((total, commodityId) => {
        return total + outputDemandDelta(base, compare, outputId, commodityId);
      }, 0);
      return {
        outputId,
        outputLabel: appConfig.output_roles[outputId]?.display_label ?? formatTitle(outputId),
        electricityDelta,
        fossilDelta,
      };
    })
    .filter((entry) => entry.electricityDelta > FLOW_DELTA_THRESHOLD && entry.fossilDelta < -FLOW_DELTA_THRESHOLD)
    .sort((left, right) => Math.abs(right.electricityDelta) - Math.abs(left.electricityDelta));
}

function buildNarratives(
  configurations: Record<ComparisonSolveKey, ComparisonConfigurationSolve>,
  sectorEmissionDeltas: SectorEmissionDelta[],
  commodityDemandDeltas: CommodityDemandDelta[],
  stateShareDeltas: StateShareDelta[],
  appConfig: AppConfigRegistry,
): ComparisonNarrative[] {
  const base = configurations.base;
  const compare = configurations.compare;
  const noDemand = configurations.noDemandDelta;
  const noPrice = configurations.noPriceDelta;
  const noElectricity = configurations.noElectricityModeDelta;
  const noRemovals = configurations.noRemovalsDelta;
  const constrainedShadow = configurations.relaxedConstraints;

  const topEmissionReducers = sectorEmissionDeltas.filter((entry) => entry.totalDelta < 0).slice(0, 2);
  const topFuelMoves = topItems(commodityDemandDeltas, (entry) => entry.totalDelta, 4);
  const electrificationDrivers = buildElectrificationDrivers(base.metrics, compare.metrics, appConfig).slice(0, 3);
  const processReducers = Array.from(new Set([
    ...base.metrics.outputProcessEmissions.keys(),
    ...compare.metrics.outputProcessEmissions.keys(),
  ]))
    .map((outputId) => ({
      outputId,
      outputLabel: appConfig.output_roles[outputId]?.display_label ?? formatTitle(outputId),
      delta: getFromMap(compare.metrics.outputProcessEmissions, outputId)
        - getFromMap(base.metrics.outputProcessEmissions, outputId),
    }))
    .filter((entry) => entry.delta < -FLOW_DELTA_THRESHOLD)
    .sort((left, right) => left.delta - right.delta)
    .slice(0, 3);
  const dominantShifts = stateShareDeltas.slice(0, 3);
  const electricityControlBase = base.configuration.service_controls.electricity?.mode ?? 'fixed_shares';
  const electricityControlCompare = compare.configuration.service_controls.electricity?.mode ?? electricityControlBase;
  const constrainedBindings = constrainedShadow.metrics.bindingConstraints;
  const highlightedBindings = Array.from(new Set(constrainedBindings.slice(0, 3).map((constraint) => {
    const label = appConfig.output_roles[constraint.outputId]?.display_label ?? constraint.outputLabel;
    return `${formatTitle(constraint.kind)} on ${label} ${constraint.year}`;
  })));
  const removalsChanged = ['land_sequestration', 'engineered_removals'].some((outputId) => {
    return JSON.stringify(compare.configuration.service_controls[outputId])
      !== JSON.stringify(base.configuration.service_controls[outputId]);
  });
  const removalsNote = compare.result.diagnostics.some((diagnostic) => diagnostic.code === 'optional_rows_pending');

  return [
    {
      id: 'emissions',
      title: 'Emissions',
      summary: compare.metrics.totalEmissions < base.metrics.totalEmissions
        ? `Modeled direct emissions fall overall, with the largest reductions coming from ${joinList(topEmissionReducers.map((entry) => formatTitle(entry.sector)).slice(0, 2)) || 'smaller cross-sector changes'}${compare.metrics.processEmissions < base.metrics.processEmissions ? ', including a visible process-emissions reduction component' : ''}.`
        : 'Modeled direct emissions do not fall overall in this compare pair, so the page surfaces the main increases rather than pretending there is a clean abatement story.',
      evidence: `Total emissions move from ${base.metrics.totalEmissions.toFixed(2)} to ${compare.metrics.totalEmissions.toFixed(2)} tCO2e across the modeled years.`,
    },
    {
      id: 'fuel',
      title: 'Fuel',
      summary: topFuelMoves.length > 0
        ? `${joinList(topFuelMoves.slice(0, 3).map((entry) => entry.totalDelta > 0 ? `${entry.label} rises` : `${entry.label} falls`))}, so the comparison reads as a fuel-composition shift rather than just a demand scalar.`
        : 'Fuel demand barely moves across the compare pair, so there is no strong fuel-switch story to attribute.',
      evidence: `Largest commodity moves: ${joinList(topFuelMoves.slice(0, 4).map((entry) => `${entry.label} ${describeSigned(entry.totalDelta, 'up', 'down')}`)) || 'none'}.`,
    },
    {
      id: 'electrification',
      title: 'Electrification',
      summary: electrificationDrivers.length > 0
        ? `Electricity demand rises mainly because ${joinList(electrificationDrivers.map((entry) => entry.outputLabel))} shift away from direct fossil use and toward more electricity-intensive states.`
        : 'The compare pair does not show a strong electrification signature once service demand and state mixes are combined.',
      evidence: electrificationDrivers.length > 0
        ? `Top electricity-plus-fossil substitutions: ${joinList(electrificationDrivers.map((entry) => entry.outputLabel))}.`
        : undefined,
    },
    {
      id: 'process-abatement',
      title: 'Process Abatement',
      summary: processReducers.length > 0
        ? `Process-emissions reductions are concentrated in ${joinList(processReducers.map((entry) => entry.outputLabel))}, which is consistent with cleaner industrial-state selection rather than pure fuel switching alone.`
        : 'There is no large modeled process-abatement move in this comparison, so most of the story sits in energy emissions and commodity shifts.',
      evidence: processReducers.length > 0
        ? `Largest process-emissions deltas come from ${joinList(processReducers.map((entry) => entry.outputLabel))}.`
        : undefined,
    },
    {
      id: 'demand',
      title: 'Demand Effect',
      summary: `Holding everything else at the transition settings, the higher-demand tables ${describeSigned(compare.metrics.totalEmissions - noDemand.metrics.totalEmissions, 'raise emissions', 'lower emissions')} and ${describeSigned(diff(compare.metrics.totalCost, noDemand.metrics.totalCost) ?? 0, 'raise cost', 'lower cost')} in the direction expected from larger service requirements.`,
      evidence: `Demand-only effect versus the no-demand counterfactual: ${describeSigned(compare.metrics.totalElectricityDemand - noDemand.metrics.totalElectricityDemand, 'more electricity use', 'less electricity use')}.`,
    },
    {
      id: 'price',
      title: 'Price Effect',
      summary: `Changing the commodity-price preset and carbon-price path ${describeSigned(compare.metrics.totalEmissions - noPrice.metrics.totalEmissions, 'pushes emissions up', 'pulls emissions down')} while ${describeSigned(diff(compare.metrics.totalCost, noPrice.metrics.totalCost) ?? 0, 'raising modeled cost', 'lowering modeled cost')}. The explanation stays heuristic because price shifts also alter which states become attractive.`,
      evidence: `Reference and compare configurations use per-commodity price selections with carbon moving from ${base.configuration.carbon_price['2050'] ?? 0} to ${compare.configuration.carbon_price['2050'] ?? 0} by 2050.`,
    },
    {
      id: 'state-choice',
      title: 'State Choice',
      summary: dominantShifts.length > 0
        ? `The most material state-choice changes are ${joinList(dominantShifts.map((entry) => `${entry.outputLabel} ${entry.year}`))}, which means the configuration delta is not just about exogenous prices or demand.`
        : 'The dominant modeled states barely move, so the configuration delta is being driven more by exogenous prices and demand than by state-choice reallocation.',
      evidence: dominantShifts.length > 0
        ? dominantShifts[0].narrative
        : undefined,
    },
    {
      id: 'electricity-mode',
      title: 'Electricity Mode',
      summary: electricityControlBase !== electricityControlCompare
        ? `Electricity control moves from ${formatTitle(electricityControlBase)} to ${formatTitle(electricityControlCompare)}. That makes the electricity comparison partly a control-mode story, not only a load story.`
        : 'Electricity stays on the same control mode, so the electricity delta is mostly a load and cost-composition story.',
      evidence: `Electricity-only effect versus its withheld counterfactual changes modeled electricity demand by ${(compare.metrics.totalElectricityDemand - noElectricity.metrics.totalElectricityDemand).toFixed(2)} in aggregate.`,
    },
    {
      id: 'removals',
      title: 'Removals',
      summary: removalsChanged
        ? removalsNote
          ? 'The compare configuration turns removals on, but the current LP still treats optional removals as pending rows. The page therefore reports removals activation as a transparent heuristic flag rather than fake modeled abatement.'
          : 'The compare configuration turns removals on and the solver picks up a modeled change.'
        : 'Removals settings do not materially change between the two configurations, so there is no removals activation story here.',
      evidence: removalsChanged
        ? `Removals-only effect against its withheld counterfactual changes emissions by ${(compare.metrics.totalEmissions - noRemovals.metrics.totalEmissions).toFixed(2)} tCO2e, with diagnostics still reporting optional-removal rows as pending.`
        : undefined,
    },
    {
      id: 'constraints',
      title: 'Constraint Effect',
      summary: constrainedShadow.result.status === 'error'
        ? 'Re-imposing the modeled caps makes the transition shadow run infeasible, which is itself the clearest constraint signal available in the current LP core.'
        : constrainedBindings.length > 0
        ? `The primary compare run keeps caps relaxed so state-choice changes remain legible. Re-imposing max-share and max-activity caps ${describeSigned(constrainedShadow.metrics.totalEmissions - compare.metrics.totalEmissions, 'raises emissions', 'lowers emissions')}, which is why the page reports a separate constraint shadow instead of hiding it inside the main compare pair.`
        : 'Even after re-imposing the modeled caps, no large max-share or max-activity bind dominates the compare result.',
      evidence: highlightedBindings.length > 0
        ? `Most visible binding constraints: ${joinList(highlightedBindings)}.`
        : constrainedShadow.result.status === 'error'
          ? 'The constrained shadow run fails before an optimal solution is found, so the page treats the constraint effect as an infeasibility signal rather than a precise delta.'
        : undefined,
    },
  ];
}

export function buildComparisonReport(
  appConfig: AppConfigRegistry,
  sectorStates: SectorState[],
  solves: Array<{ key: ComparisonSolveKey; configuration: ScenarioDocument; request: SolveRequest; result: SolveResult }>,
): ComparisonReport {
  const sectorStateByRowId = new Map(sectorStates.map((row) => [`${row.state_id}::${row.year}`, row]));
  const configurations = solves.reduce<Record<ComparisonSolveKey, ComparisonConfigurationSolve>>((accumulator, solve) => {
    accumulator[solve.key] = {
      key: solve.key,
      label: controlLabelForKey(solve.key),
      configuration: solve.configuration,
      request: solve.request,
      result: solve.result,
      metrics: calculateConfigurationMetrics(solve.request, solve.result, sectorStateByRowId),
    };
    return accumulator;
  }, {} as Record<ComparisonSolveKey, ComparisonConfigurationSolve>);

  const base = configurations.base;
  const compare = configurations.compare;
  const stateShareDeltas = buildStateShareDeltas(
    base,
    compare,
    configurations.relaxedConstraints,
    appConfig,
    sectorStateByRowId,
  );
  const sectorEmissionDeltas = buildSectorEmissionDeltas(base.metrics, compare.metrics);
  const commodityDemandDeltas = buildCommodityDemandDeltas(base.metrics, compare.metrics);
  const electricityDeltas = buildElectricityDeltas(base.metrics, compare.metrics);
  const confidenceDeltas = buildConfidenceDeltas(base.metrics, compare.metrics);
  const overallInteractionResidual = {
    costDelta: (diff(compare.metrics.totalCost, base.metrics.totalCost) ?? 0)
      - (diff(compare.metrics.totalCost, configurations.noDemandDelta.metrics.totalCost) ?? 0)
      - (diff(compare.metrics.totalCost, configurations.noPriceDelta.metrics.totalCost) ?? 0)
      - (diff(compare.metrics.totalCost, configurations.noElectricityModeDelta.metrics.totalCost) ?? 0)
      - (diff(compare.metrics.totalCost, configurations.noStateChoiceDelta.metrics.totalCost) ?? 0)
      - (diff(compare.metrics.totalCost, configurations.noRemovalsDelta.metrics.totalCost) ?? 0),
    emissionsDelta: (compare.metrics.totalEmissions - base.metrics.totalEmissions)
      - (compare.metrics.totalEmissions - configurations.noDemandDelta.metrics.totalEmissions)
      - (compare.metrics.totalEmissions - configurations.noPriceDelta.metrics.totalEmissions)
      - (compare.metrics.totalEmissions - configurations.noElectricityModeDelta.metrics.totalEmissions)
      - (compare.metrics.totalEmissions - configurations.noStateChoiceDelta.metrics.totalEmissions)
      - (compare.metrics.totalEmissions - configurations.noRemovalsDelta.metrics.totalEmissions),
    electricityDemandDelta: (compare.metrics.totalElectricityDemand - base.metrics.totalElectricityDemand)
      - (compare.metrics.totalElectricityDemand - configurations.noDemandDelta.metrics.totalElectricityDemand)
      - (compare.metrics.totalElectricityDemand - configurations.noPriceDelta.metrics.totalElectricityDemand)
      - (compare.metrics.totalElectricityDemand - configurations.noElectricityModeDelta.metrics.totalElectricityDemand)
      - (compare.metrics.totalElectricityDemand - configurations.noStateChoiceDelta.metrics.totalElectricityDemand)
      - (compare.metrics.totalElectricityDemand - configurations.noRemovalsDelta.metrics.totalElectricityDemand),
  };

  const narratives = buildNarratives(
    configurations,
    sectorEmissionDeltas,
    commodityDemandDeltas,
    stateShareDeltas,
    appConfig,
  );

  return {
    heuristicNote: 'This compare page uses one built-in transition counterfactual plus several one-change counterfactual solves. The attribution is intentionally heuristic and transparent rather than a perfect causal decomposition.',
    baseConfigurationName: base.configuration.name,
    compareConfigurationName: compare.configuration.name,
    compareConfigurationDescription: compare.configuration.description ?? null,
    configurationStatuses: Object.values(configurations).map((configuration) => ({
      key: configuration.key,
      label: configuration.label,
      status: configuration.result.status,
    })),
    metrics: [
      {
        id: 'modeled-cost',
        label: 'Modeled cost',
        unit: 'objective',
        base: base.metrics.totalCost,
        compare: compare.metrics.totalCost,
        delta: diff(compare.metrics.totalCost, base.metrics.totalCost),
      },
      {
        id: 'direct-emissions',
        label: 'Direct emissions',
        unit: 'tCO2e',
        base: base.metrics.totalEmissions,
        compare: compare.metrics.totalEmissions,
        delta: compare.metrics.totalEmissions - base.metrics.totalEmissions,
      },
      {
        id: 'electricity-demand',
        label: 'Electricity demand',
        unit: 'MWh-equivalent',
        base: base.metrics.totalElectricityDemand,
        compare: compare.metrics.totalElectricityDemand,
        delta: compare.metrics.totalElectricityDemand - base.metrics.totalElectricityDemand,
      },
      {
        id: 'fossil-demand',
        label: 'Fossil demand',
        unit: 'GJ-equivalent',
        base: base.metrics.totalFossilDemand,
        compare: compare.metrics.totalFossilDemand,
        delta: compare.metrics.totalFossilDemand - base.metrics.totalFossilDemand,
      },
      {
        id: 'dominant-state-shifts',
        label: 'Dominant state shifts',
        unit: 'output-years',
        base: 0,
        compare: stateShareDeltas.length,
        delta: stateShareDeltas.length,
      },
      {
        id: 'constraint-shadow-binds',
        label: 'Constraint shadow binds',
        unit: 'constraints',
        base: 0,
        compare: configurations.relaxedConstraints.result.status === 'error'
          ? null
          : configurations.relaxedConstraints.metrics.bindingConstraints.length,
        delta: configurations.relaxedConstraints.result.status === 'error'
          ? null
          : configurations.relaxedConstraints.metrics.bindingConstraints.length,
      },
    ],
    decomposition: [
      buildEffectCard(
        'demand',
        'Demand effect',
        compare,
        configurations.noDemandDelta,
        'Keeps the transition controls and prices in place but restores the reference demand tables to show how much of the delta comes from higher service requirements.',
      ),
      buildEffectCard(
        'price',
        'Price effect',
        compare,
        configurations.noPriceDelta,
        'Restores the reference commodity-price preset and carbon path to isolate how relative prices reshape the modeled result.',
      ),
      buildEffectCard(
        'electricity-mode',
        'Electricity-mode effect',
        compare,
        configurations.noElectricityModeDelta,
        'Restores the reference electricity control so the page can separate load growth from electricity-control changes.',
      ),
      buildEffectCard(
        'state-choice',
        'State-choice effect',
        compare,
        configurations.noStateChoiceDelta,
        'Restores reference required-service controls while keeping the rest of the transition package, so the residual reflects changed state selection.',
      ),
      buildEffectCard(
        'removals',
        'Removals activation',
        compare,
        configurations.noRemovalsDelta,
        'Restores reference removals controls. Because optional removals are still outside the LP core, this effect is expected to be small and heavily caveated.',
        compare.result.diagnostics.some((diagnostic) => diagnostic.code === 'optional_rows_pending')
          ? 'Optional-removal rows remain outside the active LP core, so this row is a configuration-activation signal more than a modeled delta.'
          : undefined,
      ),
      {
        id: 'interaction',
        title: 'Interaction residual',
        summary: 'Whatever remains after the isolated one-change counterfactuals. This is the page being explicit about overlap instead of pretending the heuristics add up perfectly.',
        costDelta: overallInteractionResidual.costDelta,
        emissionsDelta: overallInteractionResidual.emissionsDelta,
        electricityDemandDelta: overallInteractionResidual.electricityDemandDelta,
      },
      {
        id: 'constraints',
        title: 'Constraint shadow',
        summary: configurations.relaxedConstraints.result.status === 'error'
          ? 'Re-imposing the modeled caps makes the transition shadow run infeasible, so compare mode exposes that failure directly instead of inventing a numeric cap delta.'
          : 'Re-imposes max-share and max-activity caps inside the transition counterfactual so the page can show what the cap shadow would block relative to the primary relaxed compare pair.',
        costDelta: configurations.relaxedConstraints.result.status === 'error'
          ? null
          : diff(configurations.relaxedConstraints.metrics.totalCost, compare.metrics.totalCost),
        emissionsDelta: configurations.relaxedConstraints.result.status === 'error'
          ? null
          : configurations.relaxedConstraints.metrics.totalEmissions - compare.metrics.totalEmissions,
        electricityDemandDelta: configurations.relaxedConstraints.result.status === 'error'
          ? null
          : configurations.relaxedConstraints.metrics.totalElectricityDemand - compare.metrics.totalElectricityDemand,
        note: configurations.relaxedConstraints.result.status === 'error'
          ? 'The constrained shadow run is infeasible under the current caps, so this card reports a qualitative constraint effect rather than a solved delta.'
          : undefined,
      },
    ],
    sectorEmissionDeltas,
    commodityDemandDeltas,
    electricityDeltas,
    confidenceDeltas,
    stateShareDeltas,
    narratives,
  };
}

export function configurationRoleSummary(
  scenario: ScenarioDocument,
  appConfig: AppConfigRegistry,
): Array<{ role: OutputRole; count: number }> {
  const counts = new Map<OutputRole, number>();

  for (const [outputId, metadata] of Object.entries(appConfig.output_roles)) {
    const control = scenario.service_controls[outputId];
    if (!control) {
      continue;
    }

    counts.set(metadata.output_role, (counts.get(metadata.output_role) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([role, count]) => ({ role, count }))
    .sort((left, right) => left.role.localeCompare(right.role));
}
