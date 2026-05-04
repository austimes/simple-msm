import {
  summarizeOverlayTotals,
  summarizeResidualRoleTotals,
} from '../data/balanceDiagnostics.ts';
import { getCommodityMetadata } from '../data/commodityMetadata.ts';
import type {
  AppConfigRegistry,
  AutonomousEfficiencyTrack,
  CommodityBalance2025Row,
  ConfigurationDocument,
  ConfigurationYearKey,
  EfficiencyPackage,
  EmissionsBalance2025Row,
  ResidualOverlayRow,
  ResolvedMethodYearRow,
} from '../data/types.ts';
import {
  buildSolveRequest,
  normalizeSolverRows,
  resolveConfigurationForSolve,
} from '../solver/buildSolveRequest.ts';
import type {
  NormalizedSolverRow,
  ResolvedConfigurationForSolve,
  SolveRequest,
} from '../solver/contract.ts';

export interface ModelFormulationPipelineStep {
  title: string;
  summary: string;
  artifacts: string[];
}

export interface ModelFormulationSymbol {
  symbol: string;
  meaning: string;
}

export interface ModelFormulationEquation {
  title: string;
  body: string;
  note?: string;
}

export interface ModelFormulationSourceMappingRow {
  source: string;
  mapsTo: string;
  howItEnters: string;
}

export interface ModelFormulationDemandYearValue {
  year: number;
  value: number;
  overridden: boolean;
}

export interface ModelFormulationDemandExample {
  outputId: string;
  outputLabel: string;
  mode: ConfigurationDocument['demand_generation']['mode'];
  anchorYear: number;
  targetYear: number;
  anchorValue: number;
  growthRatePctPerYear: number | null;
  formulaValue: number | null;
  resolvedValue: number;
  yearOverrideApplied: boolean;
  yearValues: ModelFormulationDemandYearValue[];
  note: string;
}

export interface ModelFormulationObjectiveInputContribution {
  commodityId: string;
  commodityLabel: string;
  coefficient: number;
  unit: string;
  price: number;
  includedInObjective: boolean;
  contribution: number;
}

export interface ModelFormulationObjectiveExample {
  rowId: string;
  outputId: string;
  outputLabel: string;
  methodId: string;
  methodLabel: string;
  year: number;
  conversionCost: number;
  carbonIntensity: number;
  carbonPrice: number;
  carbonCost: number;
  exogenousCommodityCost: number;
  totalObjectiveCoefficient: number;
  commodityContributions: ModelFormulationObjectiveInputContribution[];
  note: string;
}

export interface ModelFormulationOverlaySummary {
  totalResidualEnergyPj: number;
  totalResidualEnergyEmissions: number;
  totalResidualNonEnergyEmissions: number;
  lulucfSinkMtco2e: number | null;
  totalCarbonBillableEmissionsMtco2e: number;
  totalOverlayCommodityCostAudm2024: number;
  totalOverlayFixedCostAudm2024: number;
  residualFinalElectricityTwh?: number;
  gridLossesOwnUseElectricityTwh?: number;
  includedResidualRoleCount?: number;
  energyResidualRoleCount?: number;
  nonEnergyResidualRoleCount?: number;
  sinkResidualRoleCount?: number;
  includedOverlayCount: number;
  energyOverlayCount: number;
  nonEnergyOverlayCount: number;
  sinkOverlayCount: number;
  commodityBalanceRowCount: number;
  emissionsBalanceRowCount: number;
  totalFinalEnergyBenchmarkPj: number | null;
  positiveEmittingBenchmarkMtco2e: number | null;
  nationalInventoryNetMtco2e: number | null;
}

export interface ModelFormulationStat {
  label: string;
  value: string;
}

export interface ModelFormulationViewModel {
  title: string;
  intro: string[];
  stats: ModelFormulationStat[];
  pipelineSteps: ModelFormulationPipelineStep[];
  symbols: ModelFormulationSymbol[];
  equations: ModelFormulationEquation[];
  serviceDemandEquations: ModelFormulationEquation[];
  commodityBalanceEquations: ModelFormulationEquation[];
  sourceMapping: ModelFormulationSourceMappingRow[];
  caveats: string[];
  liveExamplesWarning: string | null;
  demandExample: ModelFormulationDemandExample | null;
  objectiveExample: ModelFormulationObjectiveExample | null;
  overlaySummary: ModelFormulationOverlaySummary;
}

export const MODEL_FORMULATION_PREFERRED_DEMAND_OUTPUT_ID =
  'residential_building_services';
export const MODEL_FORMULATION_PREFERRED_OBJECTIVE_ROW_ID =
  'buildings__residential__incumbent_mixed_fuels::2025';

export const MODEL_FORMULATION_PIPELINE_STEPS: ModelFormulationPipelineStep[] = [
  {
    title: '1. Method-year rows',
    summary:
      'Load role-scoped method-year rows with output units, non-commodity conversion costs, commodity-input coefficients, direct emissions, and rollout bounds.',
    artifacts: ['shared/roles.csv', 'roles/*/method_years.csv'],
  },
  {
    title: '2. Configuration resolution',
    summary:
      'Resolve demand tables, commodity prices, carbon prices, output roles, and control modes before the LP is assembled.',
    artifacts: [
      'output_roles.json',
      'demandResolution.ts',
      'solveRequestModel.ts',
      'shared/commodity_price_curves.csv',
      'shared/carbon_price_curves.csv',
    ],
  },
  {
    title: '3. Normalized solve request',
    summary:
      'Convert package rows and the active configuration into the normalized request consumed by the worker-backed LP adapter.',
    artifacts: ['buildSolveRequest.ts', 'solveRequestModel.ts'],
  },
  {
    title: '4. LP solve',
    summary:
      'Minimize total modeled cost subject to service-demand equalities, commodity balances, method activation, and share/activity bounds.',
    artifacts: ['lpAdapter.ts'],
  },
  {
    title: '5. Residual role closure',
    summary:
      'Residual roles enter as ordinary required-service method rows, so omitted-sector demand, inputs, and emissions flow through the same LP and reporting path as modeled roles.',
    artifacts: [
      'roles/*/demand.csv',
      'roles/*/method_years.csv',
      'shared/roles.csv',
      'validation/baseline_commodity_balance.csv',
      'validation/baseline_emissions_balance.csv',
    ],
  },
];

export const MODEL_FORMULATION_SYMBOLS: ModelFormulationSymbol[] = [
  { symbol: 'x_r', meaning: 'activity of row r' },
  { symbol: 'k_r', meaning: 'conversionCostPerUnit' },
  {
    symbol: 'a_r,c',
    meaning: 'input coefficient from input_commodities + input_coefficients',
  },
  {
    symbol: 'e_r',
    meaning: 'direct emissions per unit from energy + process emissions',
  },
  { symbol: 'D_o,y', meaning: 'resolved service demand' },
  { symbol: 'X_c,y', meaning: 'resolved external commodity demand' },
  { symbol: 'p_c,y', meaning: 'resolved commodity price' },
  { symbol: 'carbon_y', meaning: 'resolved carbon price' },
];

export const MODEL_FORMULATION_EQUATIONS: ModelFormulationEquation[] = [
  {
    title: 'LP objective',
    body: 'min sum_r x_r * [k_r + sum_{c in exogenous inputs} a_r,c * p_c,y(r) + e_r * carbon_y(r)]',
    note:
      'The current LP objective uses row conversion cost, exogenously priced commodity inputs, and direct-emissions carbon cost.',
  },
];

export const MODEL_FORMULATION_SERVICE_DEMAND_EQUATIONS: ModelFormulationEquation[] = [
  {
    title: 'Required service',
    body: 'sum_{r in R(o,y)} x_r = D_o,y',
  },
  {
    title: 'Service min/max share',
    body: 'x_r >= minShare_r * D_o,y\nx_r <= effMaxShare_r * D_o,y',
  },
  {
    title: 'Activity / activation',
    body: 'x_r <= maxActivity_r\nx_r = 0 for inactive methods\nx_r = 0 for externalized supply methods',
  },
];

export const MODEL_FORMULATION_COMMODITY_BALANCE_EQUATIONS: ModelFormulationEquation[] = [
  {
    title: 'Endogenous supply commodity',
    body: 'sum_{r in S(c,y)} x_r - sum_{r consuming c in year y} a_r,c * x_r = X_c,y',
  },
  {
    title: 'Supply min/max share',
    body: 'x_r - minShare_r * sum_{j in S(c,y)} x_j >= 0\nx_r - effMaxShare_r * sum_{j in S(c,y)} x_j <= 0',
  },
];

export const MODEL_FORMULATION_SOURCE_MAPPING: ModelFormulationSourceMappingRow[] = [
  {
    source: 'shared/roles.csv + roles/*/method_years.csv',
    mapsTo: 'row activities, coefficients, emissions, min_share, max_share, max_activity',
    howItEnters:
      'Joined and normalized into solver rows so each method-year becomes one LP activity variable.',
  },
  {
    source: 'roles/*/demand.csv',
    mapsTo: '2025 anchors',
    howItEnters:
      'Role demand rows provide anchor values when demand tables are generated from anchor-year starting points.',
  },
  {
    source: 'shared/demand_growth_curves.csv + currentConfiguration.demand_generation',
    mapsTo: 'resolved service demand tables',
    howItEnters:
      'Resolve the D_o,y tables before solve, with year_overrides replacing the growth formula when present.',
  },
  {
    source: 'shared/commodity_price_curves.csv + currentConfiguration.commodity_pricing',
    mapsTo: 'p_c,y',
    howItEnters:
      'Resolve the per-commodity exogenous price path used for inputs that stay outside the endogenous commodity balance.',
  },
  {
    source: 'shared/carbon_price_curves.csv or currentConfiguration.carbon_price',
    mapsTo: 'carbon_y',
    howItEnters:
      'Resolve the direct-emissions carbon-price path used in the row objective.',
  },
  {
    source: 'output_roles.json + role_controls',
    mapsTo: 'output role, control mode, active-method filtering',
    howItEnters:
      'Determine whether rows behave as required services, endogenous supply commodities, or optional activities, then apply control-mode filtering.',
  },
  {
    source: 'residual roles',
    mapsTo: 'ordinary LP activity variables',
    howItEnters:
      'Load through the same role/method/demand path as modeled roles, then contribute normal commodity inputs, emissions, costs, and route shares.',
  },
  {
    source: 'validation/baseline_commodity_balance.csv + validation/baseline_emissions_balance.csv',
    mapsTo: '2025 closure diagnostics',
    howItEnters:
      'Provide the benchmark tables used to explain how modeled rows plus residual-role rows close the 2025 package balances.',
  },
];

export const MODEL_FORMULATION_CAVEATS: string[] = [
  'Share smoothing exists in the configuration but is not yet enforced in the LP core.',
  'Residual roles are coarse calibration coverage entries; they are first-class LP rows, not optimisable technology representations.',
  'Soft constraints only relax max_share and max_activity.',
];

interface ModelFormulationInput {
  resolvedMethodYears: ResolvedMethodYearRow[];
  appConfig: AppConfigRegistry;
  currentConfiguration: ConfigurationDocument;
  autonomousEfficiencyTracks: AutonomousEfficiencyTrack[];
  efficiencyPackages: EfficiencyPackage[];
  residualOverlays2025: ResidualOverlayRow[];
  commodityBalance2025: CommodityBalance2025Row[];
  emissionsBalance2025: EmissionsBalance2025Row[];
}

function yearKey(year: number): ConfigurationYearKey {
  return String(year) as ConfigurationYearKey;
}

function formatCompactNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }

  return new Intl.NumberFormat('en-AU', {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  }).format(value);
}

function countDistinctOutputs(rows: NormalizedSolverRow[]): number {
  return new Set(rows.map((row) => row.outputId)).size;
}

function countDecimalPlaces(value: number): number {
  const normalized = value.toString().toLowerCase();

  if (!normalized.includes('.') && !normalized.includes('e')) {
    return 0;
  }

  const [coefficient, exponentText] = normalized.split('e');
  const fractionLength = coefficient.split('.')[1]?.length ?? 0;
  const exponent = Number(exponentText ?? 0);

  return Math.max(fractionLength - exponent, 0);
}

function roundToPlaces(value: number, decimalPlaces: number): number {
  if (decimalPlaces <= 0) {
    return Math.round(value);
  }

  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function compareRows(left: NormalizedSolverRow, right: NormalizedSolverRow): number {
  if (left.year !== right.year) {
    return left.year - right.year;
  }

  if (left.outputId !== right.outputId) {
    return left.outputId.localeCompare(right.outputId);
  }

  return left.methodLabel.localeCompare(right.methodLabel);
}

function buildBalancedCommodityKeys(request: SolveRequest): Set<string> {
  const keys = new Set<string>();

  for (const row of request.rows) {
    if (row.outputRole !== 'endogenous_supply_commodity') {
      continue;
    }

    const control = request.configuration.controlsByOutput[row.outputId]?.[yearKey(row.year)];
    if (!control || control.mode === 'externalized') {
      continue;
    }

    keys.add(`${row.outputId}::${row.year}`);
  }

  return keys;
}

function resolveDemandAnchor(
  configuration: ConfigurationDocument,
  appConfig: AppConfigRegistry,
  outputId: string,
): number | null {
  const anchorYear = configuration.demand_generation.anchor_year;
  const explicitAnchor = configuration.demand_generation.service_anchors[outputId];
  if (typeof explicitAnchor === 'number') {
    return explicitAnchor;
  }

  const explicitTableAnchor = configuration.service_demands[outputId]?.[yearKey(anchorYear)];
  if (typeof explicitTableAnchor === 'number') {
    return explicitTableAnchor;
  }

  const baselineAnchor = appConfig.baseline_activity_anchors[outputId];
  return baselineAnchor?.anchor_kind === 'service_demand' ? baselineAnchor.value : null;
}

function resolveDemandGrowthRate(
  configuration: ConfigurationDocument,
  appConfig: AppConfigRegistry,
  outputId: string,
): number | null {
  const overrideRate = configuration.demand_generation.service_growth_rates_pct_per_year?.[outputId];
  if (typeof overrideRate === 'number') {
    return overrideRate;
  }

  const presetId = configuration.demand_generation.preset_id;
  const preset = presetId ? appConfig.demand_growth_presets[presetId] : null;
  const presetRate = preset?.annual_growth_rates_pct_per_year[outputId];
  return typeof presetRate === 'number' ? presetRate : null;
}

function buildDemandExample(
  configuration: ConfigurationDocument,
  appConfig: AppConfigRegistry,
  request: SolveRequest,
): ModelFormulationDemandExample | null {
  const availableOutputIds = Object.keys(request.configuration.serviceDemandByOutput).sort(
    (left, right) => left.localeCompare(right),
  );
  if (availableOutputIds.length === 0) {
    return null;
  }

  const outputId = availableOutputIds.includes(MODEL_FORMULATION_PREFERRED_DEMAND_OUTPUT_ID)
    ? MODEL_FORMULATION_PREFERRED_DEMAND_OUTPUT_ID
    : availableOutputIds[0];
  const outputLabel = appConfig.output_roles[outputId]?.display_label ?? outputId;
  const years = [...request.configuration.years].sort((left, right) => left - right);
  const anchorYear = configuration.demand_generation.anchor_year;
  const targetYear = years.find((year) => year !== anchorYear) ?? years[years.length - 1];
  const anchorValue = resolveDemandAnchor(configuration, appConfig, outputId);
  const growthRatePctPerYear = resolveDemandGrowthRate(configuration, appConfig, outputId);
  const resolvedValue = request.configuration.serviceDemandByOutput[outputId]?.[yearKey(targetYear)] ?? 0;
  const yearOverrideApplied =
    typeof configuration.demand_generation.year_overrides?.[yearKey(targetYear)]?.[outputId] === 'number';

  const formulaValue = anchorValue != null && growthRatePctPerYear != null
    ? roundToPlaces(
      anchorValue * (1 + growthRatePctPerYear / 100) ** (targetYear - anchorYear),
      countDecimalPlaces(anchorValue),
    )
    : null;

  const yearValues = years.map((year) => ({
    year,
    value: request.configuration.serviceDemandByOutput[outputId]?.[yearKey(year)] ?? 0,
    overridden: typeof configuration.demand_generation.year_overrides?.[yearKey(year)]?.[outputId]
      === 'number',
  }));

  let note = 'The active configuration resolves this demand table from its anchor-year value and growth preset before solve.';
  if (configuration.demand_generation.mode === 'manual_table') {
    note = 'The active configuration is in manual_table mode, so the resolved demand table comes directly from the document values.';
  } else if (yearOverrideApplied) {
    note = 'This target-year value is overridden directly in demand_generation.year_overrides, so the formula is shown for context rather than as the applied source.';
  }

  return {
    outputId,
    outputLabel,
    mode: configuration.demand_generation.mode,
    anchorYear,
    targetYear,
    anchorValue: anchorValue ?? 0,
    growthRatePctPerYear,
    formulaValue,
    resolvedValue,
    yearOverrideApplied,
    yearValues,
    note,
  };
}

function sumDirectEmissionsPerUnit(row: NormalizedSolverRow): number {
  return row.directEmissions.reduce((total, entry) => total + entry.value, 0);
}

function buildObjectiveExample(
  request: SolveRequest,
): ModelFormulationObjectiveExample | null {
  const requiredServiceRows = request.rows
    .filter((row) => row.outputRole === 'required_service')
    .sort(compareRows);
  if (requiredServiceRows.length === 0) {
    return null;
  }

  const row = requiredServiceRows.find((candidate) => candidate.rowId === MODEL_FORMULATION_PREFERRED_OBJECTIVE_ROW_ID)
    ?? requiredServiceRows[0];
  const balancedCommodityKeys = buildBalancedCommodityKeys(request);
  const commodityContributions = row.inputs.map((input) => {
    const price = request.configuration.commodityPriceByCommodity[input.commodityId]?.valuesByYear[yearKey(row.year)] ?? 0;
    const includedInObjective = !balancedCommodityKeys.has(`${input.commodityId}::${row.year}`);

    return {
      commodityId: input.commodityId,
      commodityLabel: getCommodityMetadata(input.commodityId).label,
      coefficient: input.coefficient,
      unit: input.unit,
      price,
      includedInObjective,
      contribution: includedInObjective ? input.coefficient * price : 0,
    } satisfies ModelFormulationObjectiveInputContribution;
  });

  const conversionCost = row.conversionCostPerUnit ?? 0;
  const exogenousCommodityCost = commodityContributions.reduce(
    (total, entry) => total + entry.contribution,
    0,
  );
  const carbonIntensity = sumDirectEmissionsPerUnit(row);
  const carbonPrice = request.configuration.carbonPriceByYear[yearKey(row.year)] ?? 0;
  const carbonCost = carbonIntensity * carbonPrice;
  const totalObjectiveCoefficient = conversionCost + exogenousCommodityCost + carbonCost;

  const excludedCommodityLabels = commodityContributions
    .filter((entry) => !entry.includedInObjective)
    .map((entry) => entry.commodityLabel);
  const note = excludedCommodityLabels.length > 0
    ? `${excludedCommodityLabels.join(', ')} stays out of the row objective here because that commodity is endogenous in ${row.year}, which avoids double counting within the commodity-balance part of the LP.`
    : 'Every explicit input for this row is priced exogenously in the current request, so each input contribution appears directly in the row objective.';

  return {
    rowId: row.rowId,
    outputId: row.outputId,
    outputLabel: row.outputLabel,
    methodId: row.methodId,
    methodLabel: row.methodLabel,
    year: row.year,
    conversionCost,
    carbonIntensity,
    carbonPrice,
    carbonCost,
    exogenousCommodityCost,
    totalObjectiveCoefficient,
    commodityContributions,
    note,
  };
}

function buildOverlaySummary(
  resolvedMethodYears: ResolvedMethodYearRow[],
  currentConfiguration: ConfigurationDocument,
  residualOverlays2025: ResidualOverlayRow[],
  commodityBalance2025: CommodityBalance2025Row[],
  emissionsBalance2025: EmissionsBalance2025Row[],
): ModelFormulationOverlaySummary {
  const residualRoleRows = resolvedMethodYears.filter(
    (row) => row.representation_kind === 'residual_stub' && row.year === 2025,
  );
  const includedResidualRoleIds = new Set(
    residualRoleRows
      .map((row) => row.role_id)
      .filter((roleId) => {
        const activeMethodIds = currentConfiguration.role_controls?.[roleId]?.active_method_ids;
        return !(Array.isArray(activeMethodIds) && activeMethodIds.length === 0);
      }),
  );
  const totals = residualOverlays2025.length > 0
    ? summarizeOverlayTotals(residualOverlays2025)
    : summarizeResidualRoleTotals(resolvedMethodYears, includedResidualRoleIds);
  const includedOverlayIds = new Set(
    residualOverlays2025
      .filter((row) => row.default_include)
      .map((row) => row.overlay_id),
  );
  const energyOverlayIds = new Set(
    residualOverlays2025
      .filter((row) => row.default_include && row.overlay_domain === 'energy_residual')
      .map((row) => row.overlay_id),
  );
  const nonEnergyOverlayIds = new Set(
    residualOverlays2025
      .filter((row) => row.default_include && row.overlay_domain === 'nonenergy_residual')
      .map((row) => row.overlay_id),
  );
  const sinkOverlayIds = new Set(
    residualOverlays2025
      .filter((row) => row.overlay_domain === 'net_sink')
      .map((row) => row.overlay_id),
  );
  const totalFinalEnergyRow = commodityBalance2025.find(
    (row) => row.commodity === 'total' && row.benchmark_stream === 'final_energy',
  );
  const positiveEmittingRow = emissionsBalance2025.find(
    (row) => row.official_category === 'Positive-emitting sectors total (excludes LULUCF)',
  );
  const nationalInventoryNetRow = emissionsBalance2025.find(
    (row) => row.official_category === 'National Inventory Total (net)',
  );

  return {
    ...totals,
    includedOverlayCount: residualOverlays2025.length > 0
      ? includedOverlayIds.size
      : totals.includedResidualRoleCount ?? 0,
    energyOverlayCount: residualOverlays2025.length > 0
      ? energyOverlayIds.size
      : totals.energyResidualRoleCount ?? 0,
    nonEnergyOverlayCount: residualOverlays2025.length > 0
      ? nonEnergyOverlayIds.size
      : totals.nonEnergyResidualRoleCount ?? 0,
    sinkOverlayCount: residualOverlays2025.length > 0
      ? sinkOverlayIds.size
      : totals.sinkResidualRoleCount ?? 0,
    commodityBalanceRowCount: commodityBalance2025.length,
    emissionsBalanceRowCount: emissionsBalance2025.length,
    totalFinalEnergyBenchmarkPj: totalFinalEnergyRow?.balanced_total_pj_2025 ?? null,
    positiveEmittingBenchmarkMtco2e: positiveEmittingRow?.balanced_total_mtco2e_2025 ?? null,
    nationalInventoryNetMtco2e: nationalInventoryNetRow?.balanced_total_mtco2e_2025 ?? null,
  };
}

function buildStats(
  normalizedRows: NormalizedSolverRow[],
  overlaySummary: ModelFormulationOverlaySummary,
  request: SolveRequest | null,
): ModelFormulationStat[] {
  return [
    {
      label: 'Packaged method-year rows',
      value: formatCompactNumber(normalizedRows.length),
    },
    {
      label: 'Distinct outputs',
      value: formatCompactNumber(countDistinctOutputs(normalizedRows)),
    },
    {
      label: 'Rows in current solve request',
      value: request ? formatCompactNumber(request.rows.length) : 'Unavailable',
    },
    {
      label: 'Default-included residual roles',
      value: formatCompactNumber(overlaySummary.includedOverlayCount),
    },
    {
      label: '2025 final-energy benchmark',
      value: overlaySummary.totalFinalEnergyBenchmarkPj != null
        ? `${formatCompactNumber(overlaySummary.totalFinalEnergyBenchmarkPj)} PJ`
        : '—',
    },
    {
      label: 'Positive-emitting benchmark',
      value: overlaySummary.positiveEmittingBenchmarkMtco2e != null
        ? `${formatCompactNumber(overlaySummary.positiveEmittingBenchmarkMtco2e)} MtCO2e`
        : '—',
    },
  ];
}

export function buildModelFormulationViewModel({
  resolvedMethodYears,
  appConfig,
  currentConfiguration,
  autonomousEfficiencyTracks,
  efficiencyPackages,
  residualOverlays2025,
  commodityBalance2025,
  emissionsBalance2025,
}: ModelFormulationInput): ModelFormulationViewModel {
  const overlaySummary = buildOverlaySummary(
    resolvedMethodYears,
    currentConfiguration,
    residualOverlays2025,
    commodityBalance2025,
    emissionsBalance2025,
  );

  let liveExamplesWarning: string | null = null;
  let resolvedConfiguration: ResolvedConfigurationForSolve | null = null;
  let request: SolveRequest | null = null;

  try {
    resolvedConfiguration = resolveConfigurationForSolve(currentConfiguration, appConfig, resolvedMethodYears, {
      autonomousEfficiencyTracks,
      efficiencyPackages,
    });
    request = buildSolveRequest(
      { resolvedMethodYears, appConfig, autonomousEfficiencyTracks, efficiencyPackages },
      currentConfiguration,
    );
  } catch (error) {
    liveExamplesWarning = error instanceof Error
      ? `Live examples are unavailable for the active configuration: ${error.message}`
      : 'Live examples are unavailable for the active configuration.';
  }

  const demandExample = request
    ? buildDemandExample(currentConfiguration, appConfig, request)
    : null;
  const objectiveExample = request
    ? buildObjectiveExample(request)
    : null;

  if (!liveExamplesWarning && !resolvedConfiguration) {
    liveExamplesWarning = 'Live examples are unavailable for the active configuration.';
  }

  const normalizedRows = request?.rows
    ?? normalizeSolverRows(
      { resolvedMethodYears, appConfig, autonomousEfficiencyTracks, efficiencyPackages },
      resolvedConfiguration?.efficiency,
    );

  return {
    title: 'Model Formulation',
    intro: [
      'This page explains the current LP core the app solves, how configuration inputs are resolved before solve, and how residual roles enter through the same method rows as modeled roles.',
      'It is a read-only explainer of the model wiring used in the current app, not a second configuration workspace.',
    ],
    stats: buildStats(normalizedRows, overlaySummary, request),
    pipelineSteps: MODEL_FORMULATION_PIPELINE_STEPS,
    symbols: MODEL_FORMULATION_SYMBOLS,
    equations: MODEL_FORMULATION_EQUATIONS,
    serviceDemandEquations: MODEL_FORMULATION_SERVICE_DEMAND_EQUATIONS,
    commodityBalanceEquations: MODEL_FORMULATION_COMMODITY_BALANCE_EQUATIONS,
    sourceMapping: MODEL_FORMULATION_SOURCE_MAPPING,
    caveats: MODEL_FORMULATION_CAVEATS,
    liveExamplesWarning,
    demandExample,
    objectiveExample,
    overlaySummary,
  };
}
