import { loadAppConfig } from './appConfigLoader.ts';
import { buildPackageEnrichment, normalizePackageTextFiles } from './packageCompanions.ts';
import { parseCsv } from './parseCsv.ts';
import {
  loadDefaultConfiguration,
  materializeEfficiencyConfiguration,
  materializeResidualOverlayConfiguration,
} from './configurationDocumentLoader.ts';
import type {
  AppConfigRegistry,
  AutonomousEfficiencyTrack,
  BaselineActivityAnchor,
  CommodityBalance2025Row,
  CommodityPriceDriver,
  CommodityPriceSeries,
  DemandGrowthPreset,
  EmissionEntry,
  EmissionsBalance2025Row,
  EfficiencyPackage,
  EfficiencyPackageClassification,
  FamilyMetadata,
  FamilyResolution,
  OutputRole,
  PackageData,
  PriceLevel,
  ResidualOverlayDomain,
  ResidualOverlayRow,
  SectorState,
  ServiceDemandAnchorRow,
  ServiceDemandAnchorType,
  SystemStructureGroupRow,
  SystemStructureMemberRow,
} from './types.ts';

type FamilyRegistryRow = FamilyMetadata;

interface FamilyDemandRow {
  family_id: string;
  anchor_year: number;
  anchor_value: number;
  unit: string;
  demand_growth_curve_id: string;
  anchor_status: string;
  source_family: string;
  coverage_note: string;
}

interface ExternalCommodityDemandRow {
  commodity_id: string;
  anchor_year: number;
  anchor_value: number;
  unit: string;
  demand_growth_curve_id: string;
  anchor_status: string;
  source_family: string;
  coverage_note: string;
}

interface DemandGrowthCurveRow {
  demand_growth_curve_id: string;
  label: string;
  description: string;
  provenance_note: string;
  values_by_year: Record<string, number>;
}

interface CommodityPriceCurveRow {
  commodity_id: string;
  price_curve_id: PriceLevel;
  label: string;
  unit: string;
  provenance_note: string;
  values_by_year: Record<string, number>;
}

interface CarbonPriceCurveRow {
  carbon_price_curve_id: string;
  label: string;
  unit: string;
  provenance_note: string;
  values_by_year: Record<string, number>;
}

interface SystemStructureMemberLookup {
  groupId: string;
  groupLabel: string;
  groupOrder: number;
  memberOrder: number;
}

interface NodeDirectoryEntryLike {
  isDirectory(): boolean;
  name: string;
}

interface NodeFsLike {
  existsSync(path: string): boolean;
  readdirSync(path: string, options: { withFileTypes: true }): NodeDirectoryEntryLike[];
  readFileSync(path: string, encoding: 'utf8'): string;
}

interface NodePathLike {
  dirname(path: string): string;
  join(...paths: string[]): string;
  relative(from: string, to: string): string;
  resolve(...paths: string[]): string;
  sep: string;
}

interface NodeUrlLike {
  fileURLToPath(url: string | URL): string;
}

interface EfficiencyArtifactValidationContext {
  sourceIds: Set<string>;
  assumptionIds: Set<string>;
  stateIdsByFamilyId: Map<string, Set<string>>;
}

const PACKAGE_MILESTONE_YEARS = [2025, 2030, 2035, 2040, 2045, 2050] as const;
const PACKAGE_MILESTONE_YEAR_SET = new Set<number>(PACKAGE_MILESTONE_YEARS);

function getNodeBuiltin<T>(specifier: string): T | null {
  const processLike = (globalThis as { process?: { getBuiltinModule?: (name: string) => T | undefined } }).process;
  if (!processLike?.getBuiltinModule) {
    return null;
  }

  return processLike.getBuiltinModule(specifier)
    ?? processLike.getBuiltinModule(specifier.replace(/^node:/, ''))
    ?? null;
}

function loadPackageTextFilesFromFileSystem(): Record<string, string> {
  const fs = getNodeBuiltin<NodeFsLike>('node:fs');
  const path = getNodeBuiltin<NodePathLike>('node:path');
  const url = getNodeBuiltin<NodeUrlLike>('node:url');

  if (!fs || !path || !url) {
    return {};
  }

  const fsModule = fs;
  const pathModule = path;
  const urlModule = url;

  const moduleDir = pathModule.dirname(urlModule.fileURLToPath(import.meta.url));
  const packageRoot = pathModule.resolve(moduleDir, '../../../sector_trajectory_library');
  if (!fsModule.existsSync(packageRoot)) {
    return {};
  }

  const files: Record<string, string> = {};

  function walk(directory: string): void {
    for (const entry of fsModule.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = pathModule.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (!/\.(csv|json|md)$/i.test(entry.name)) {
        continue;
      }

      const relativePath = pathModule.relative(packageRoot, absolutePath).split(pathModule.sep).join('/');
      files[relativePath] = fsModule.readFileSync(absolutePath, 'utf8');
    }
  }

  walk(packageRoot);
  return files;
}

async function loadPackageTextFiles(): Promise<Record<string, string>> {
  try {
    const lazyModules = import.meta.glob<string>(
      [
        '../../../sector_trajectory_library/README.md',
        '../../../sector_trajectory_library/manifest.json',
        '../../../sector_trajectory_library/schema/*.json',
        '../../../sector_trajectory_library/shared/*.csv',
        '../../../sector_trajectory_library/families/*/*.csv',
        '../../../sector_trajectory_library/families/*/*.md',
        '../../../sector_trajectory_library/overlays/*.csv',
        '../../../sector_trajectory_library/validation/*.csv',
        '../../../sector_trajectory_library/exports/legacy/*.csv',
        '!../../../sector_trajectory_library/exports/legacy/sector_state_curves_balanced.csv',
      ],
      {
        import: 'default',
        query: '?raw',
      },
    );
    const entries = await Promise.all(
      Object.entries(lazyModules).map(
        async ([key, loader]) => [key, await loader()] as const,
      ),
    );
    return normalizePackageTextFiles(Object.fromEntries(entries));
  } catch {
    return loadPackageTextFilesFromFileSystem();
  }
}

const packageTextFiles = await loadPackageTextFiles();

function requirePackageFile(path: string): string {
  const file = packageTextFiles[path];

  if (file != null) {
    return file;
  }

  throw new Error(`Missing required package file: ${path}`);
}

function listTextFiles(textFiles: Record<string, string>, prefix: string, suffix: string): string[] {
  return Object.keys(textFiles)
    .filter((path) => path.startsWith(prefix) && path.endsWith(suffix))
    .sort((left, right) => left.localeCompare(right));
}

function listPackageFiles(prefix: string, suffix: string): string[] {
  return listTextFiles(packageTextFiles, prefix, suffix);
}

function parseJsonArray<T>(raw: string): T[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function parseNum(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseBool(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === 'true';
}

function parseEmptyNull(raw: string | undefined): string | null {
  if (!raw || raw.trim() === '') return null;
  return raw;
}

function parseRequiredString(raw: string | undefined, label: string): string {
  const value = raw?.trim();
  if (!value) {
    throw new Error(`Missing required ${label}`);
  }

  return value;
}

function parseRequiredNumber(raw: string | undefined, label: string): number {
  const value = parseNum(raw ?? '');
  if (value == null) {
    throw new Error(`Invalid number for ${label}: ${JSON.stringify(raw ?? '')}`);
  }

  return value;
}

function parseOptionalNumber(raw: string | undefined, label: string): number | null {
  if (!raw || raw.trim() === '') {
    return null;
  }

  return parseRequiredNumber(raw, label);
}

function parseJsonArrayStrict<T>(raw: string | undefined, label: string): T[] {
  const value = parseRequiredString(raw, label);

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(
      `Invalid JSON array for ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array`);
  }

  return parsed as T[];
}

function parseJsonStringArrayStrict(raw: string | undefined, label: string): string[] {
  const parsed = parseJsonArrayStrict<unknown>(raw, label);
  if (!parsed.every((item) => typeof item === 'string')) {
    throw new Error(`${label} must contain only strings`);
  }

  return parsed as string[];
}

function parseJsonNumberArrayStrict(raw: string | undefined, label: string): number[] {
  const parsed = parseJsonArrayStrict<unknown>(raw, label);
  if (!parsed.every((item) => typeof item === 'number' && Number.isFinite(item))) {
    throw new Error(`${label} must contain only finite numbers`);
  }

  return parsed as number[];
}

function parseMilestoneYear(raw: string | undefined, label: string): number {
  const year = parseRequiredNumber(raw, label);
  if (!PACKAGE_MILESTONE_YEAR_SET.has(year)) {
    throw new Error(
      `${label} must be one of ${PACKAGE_MILESTONE_YEARS.join(', ')}; received ${year}`,
    );
  }

  return year;
}

function requireKnownIds(ids: string[], knownIds: Set<string>, label: string, kind: string): void {
  for (const id of ids) {
    if (!knownIds.has(id)) {
      throw new Error(`Unknown ${kind} ${JSON.stringify(id)} referenced in ${label}`);
    }
  }
}

function familyIdFromPath(path: string, suffix: string): string {
  const familyId = path.slice('families/'.length, -suffix.length).split('/')[0];
  if (!familyId) {
    throw new Error(`Could not infer family_id from ${path}`);
  }

  return familyId;
}

function parseEfficiencyPackageClassification(
  raw: string | undefined,
  label: string,
): EfficiencyPackageClassification {
  const value = parseRequiredString(raw, label);
  if (value === 'pure_efficiency_overlay' || value === 'operational_efficiency_overlay') {
    return value;
  }

  throw new Error(
    `${label} must be "pure_efficiency_overlay" or "operational_efficiency_overlay"; received ${JSON.stringify(value)}`,
  );
}

function parseFamilyResolution(raw: string | undefined, label: string): FamilyResolution {
  const value = parseRequiredString(raw, label);
  if (value === 'modeled' || value === 'residual_stub') {
    return value;
  }

  throw new Error(
    `${label} must be "modeled" or "residual_stub"; received ${JSON.stringify(value)}`,
  );
}

function parseOutputRole(raw: string | undefined, label: string): OutputRole {
  const value = parseRequiredString(raw, label);
  if (
    value === 'required_service'
    || value === 'endogenous_supply_commodity'
    || value === 'optional_activity'
  ) {
    return value;
  }

  throw new Error(`Unknown output_role for ${label}: ${JSON.stringify(value)}`);
}

function validateEfficiencyReferences(
  familyId: string,
  artifactLabel: string,
  applicableStateIds: string[],
  sourceIds: string[],
  assumptionIds: string[],
  context: EfficiencyArtifactValidationContext,
): void {
  const familyStateIds = context.stateIdsByFamilyId.get(familyId);
  if (!familyStateIds) {
    throw new Error(`Unknown family_id ${JSON.stringify(familyId)} referenced in ${artifactLabel}`);
  }

  requireKnownIds(applicableStateIds, familyStateIds, `${artifactLabel}.applicable_state_ids`, 'state_id');
  requireKnownIds(sourceIds, context.sourceIds, `${artifactLabel}.source_ids`, 'source_id');
  requireKnownIds(assumptionIds, context.assumptionIds, `${artifactLabel}.assumption_ids`, 'assumption_id');
}

function validateAlignedArrays(
  artifactLabel: string,
  left: unknown[],
  leftLabel: string,
  right: unknown[],
  rightLabel: string,
): void {
  if (left.length !== right.length) {
    throw new Error(
      `${artifactLabel} must keep ${leftLabel} and ${rightLabel} aligned; received ${left.length} vs ${right.length}`,
    );
  }
}

function parseYearValueTable(row: Record<string, string>): Record<string, number> {
  return Object.fromEntries(
    PACKAGE_MILESTONE_YEARS.map((year) => [String(year), parseNum(row[String(year)]) ?? 0]),
  );
}

function parsePriceLevel(value: string): PriceLevel {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }

  throw new Error(`Unknown commodity price curve id "${value}"`);
}

function inferConstantGrowthRatePctPerYear(valuesByYear: Record<string, number>): number | null {
  const base = valuesByYear['2025'];
  const final = valuesByYear['2050'];
  if (!Number.isFinite(base) || !Number.isFinite(final) || base <= 0 || final <= 0) {
    return null;
  }

  const annualRate = (final / base) ** (1 / (2050 - 2025)) - 1;
  for (const year of [2030, 2035, 2040, 2045]) {
    const key = String(year);
    const expected = base * (1 + annualRate) ** (year - 2025);
    if (Math.abs(expected - valuesByYear[key]) > 1e-6) {
      return null;
    }
  }

  return Number((annualRate * 100).toFixed(6));
}

function parseDemandCurveId(curveId: string): {
  presetId: string;
  familyId: string | null;
  externalCommodityId: string | null;
} {
  const externalMarker = '__external__';
  const externalIndex = curveId.indexOf(externalMarker);
  if (externalIndex >= 0) {
    return {
      presetId: curveId.slice(0, externalIndex),
      familyId: null,
      externalCommodityId: curveId.slice(externalIndex + externalMarker.length),
    };
  }

  const separatorIndex = curveId.indexOf('__');
  if (separatorIndex >= 0) {
    return {
      presetId: curveId.slice(0, separatorIndex),
      familyId: curveId.slice(separatorIndex + 2),
      externalCommodityId: null,
    };
  }

  return {
    presetId: curveId,
    familyId: null,
    externalCommodityId: null,
  };
}

function normalizePresetLabel(label: string): string {
  return label.split(' — ')[0] ?? label;
}

function normalizePresetDescription(description: string): string {
  return description.replace(/\s+Applies to .*$/, '');
}

function toFamilyRegistryRow(row: Record<string, string>): FamilyRegistryRow {
  const familyId = parseRequiredString(row['family_id'], 'shared/families.csv.family_id');
  return {
    family_id: familyId,
    sector: parseRequiredString(row['sector'], `shared/families.csv.${familyId}.sector`),
    subsector: parseRequiredString(row['subsector'], `shared/families.csv.${familyId}.subsector`),
    service_or_output_name: parseRequiredString(
      row['service_or_output_name'],
      `shared/families.csv.${familyId}.service_or_output_name`,
    ),
    region: parseRequiredString(row['region'], `shared/families.csv.${familyId}.region`),
    output_role: parseOutputRole(row['output_role'], `shared/families.csv.${familyId}.output_role`),
    output_unit: parseRequiredString(row['output_unit'], `shared/families.csv.${familyId}.output_unit`),
    output_quantity_basis: parseRequiredString(
      row['output_quantity_basis'],
      `shared/families.csv.${familyId}.output_quantity_basis`,
    ),
    default_incumbent_state_id: parseRequiredString(
      row['default_incumbent_state_id'],
      `shared/families.csv.${familyId}.default_incumbent_state_id`,
    ),
    maintainer_owner_id: parseRequiredString(
      row['maintainer_owner_id'],
      `shared/families.csv.${familyId}.maintainer_owner_id`,
    ),
    review_owner_id: parseRequiredString(
      row['review_owner_id'],
      `shared/families.csv.${familyId}.review_owner_id`,
    ),
    family_status: parseRequiredString(
      row['family_status'],
      `shared/families.csv.${familyId}.family_status`,
    ),
    family_maturity: parseRequiredString(
      row['family_maturity'],
      `shared/families.csv.${familyId}.family_maturity`,
    ),
    family_resolution: parseFamilyResolution(
      row['family_resolution'],
      `shared/families.csv.${familyId}.family_resolution`,
    ),
    coverage_scope_id: parseRequiredString(
      row['coverage_scope_id'],
      `shared/families.csv.${familyId}.coverage_scope_id`,
    ),
    coverage_scope_label: parseRequiredString(
      row['coverage_scope_label'],
      `shared/families.csv.${familyId}.coverage_scope_label`,
    ),
    notes: row['notes'] ?? '',
  };
}

function toSystemStructureGroupRow(row: Record<string, string>): SystemStructureGroupRow {
  const groupId = parseRequiredString(row['group_id'], 'shared/system_structure_groups.csv.group_id');
  return {
    group_id: groupId,
    group_label: parseRequiredString(
      row['group_label'],
      `shared/system_structure_groups.csv.${groupId}.group_label`,
    ),
    display_order: parseRequiredNumber(
      row['display_order'],
      `shared/system_structure_groups.csv.${groupId}.display_order`,
    ),
    notes: row['notes'] ?? '',
  };
}

function toSystemStructureMemberRow(row: Record<string, string>): SystemStructureMemberRow {
  const familyId = parseRequiredString(row['family_id'], 'shared/system_structure_members.csv.family_id');
  return {
    group_id: parseRequiredString(row['group_id'], `shared/system_structure_members.csv.${familyId}.group_id`),
    family_id: familyId,
    display_order: parseRequiredNumber(
      row['display_order'],
      `shared/system_structure_members.csv.${familyId}.display_order`,
    ),
    notes: row['notes'] ?? '',
  };
}

function toFamilyDemandRow(row: Record<string, string>): FamilyDemandRow {
  return {
    family_id: row['family_id'],
    anchor_year: parseNum(row['anchor_year']) ?? 2025,
    anchor_value: parseNum(row['anchor_value']) ?? 0,
    unit: row['unit'],
    demand_growth_curve_id: row['demand_growth_curve_id'],
    anchor_status: row['anchor_status'],
    source_family: row['source_family'],
    coverage_note: row['coverage_note'],
  };
}

function toExternalCommodityDemandRow(row: Record<string, string>): ExternalCommodityDemandRow {
  return {
    commodity_id: row['commodity_id'],
    anchor_year: parseNum(row['anchor_year']) ?? 2025,
    anchor_value: parseNum(row['anchor_value']) ?? 0,
    unit: row['unit'],
    demand_growth_curve_id: row['demand_growth_curve_id'],
    anchor_status: row['anchor_status'],
    source_family: row['source_family'],
    coverage_note: row['coverage_note'],
  };
}

function toDemandGrowthCurveRow(row: Record<string, string>): DemandGrowthCurveRow {
  return {
    demand_growth_curve_id: row['demand_growth_curve_id'],
    label: row['label'],
    description: row['description'],
    provenance_note: row['provenance_note'],
    values_by_year: parseYearValueTable(row),
  };
}

function toCommodityPriceCurveRow(row: Record<string, string>): CommodityPriceCurveRow {
  return {
    commodity_id: row['commodity_id'],
    price_curve_id: parsePriceLevel(row['price_curve_id']),
    label: row['label'],
    unit: row['unit'],
    provenance_note: row['provenance_note'],
    values_by_year: parseYearValueTable(row),
  };
}

function toCarbonPriceCurveRow(row: Record<string, string>): CarbonPriceCurveRow {
  return {
    carbon_price_curve_id: row['carbon_price_curve_id'],
    label: row['label'],
    unit: row['unit'],
    provenance_note: row['provenance_note'],
    values_by_year: parseYearValueTable(row),
  };
}

function toSectorState(
  family: FamilyRegistryRow,
  row: Record<string, string>,
): SectorState {
  return {
    family_id: row['family_id'],
    family_resolution: family.family_resolution,
    coverage_scope_id: family.coverage_scope_id,
    coverage_scope_label: family.coverage_scope_label,
    sector: family.sector,
    subsector: family.subsector,
    service_or_output_name: family.service_or_output_name,
    region: family.region,
    year: Number(row['year']),
    state_id: row['state_id'],
    state_label: row['state_label'],
    state_description: row['state_description'],
    output_unit: family.output_unit,
    output_quantity_basis: family.output_quantity_basis,
    output_cost_per_unit: parseNum(row['output_cost_per_unit']),
    cost_basis_year: parseNum(row['cost_basis_year']),
    currency: row['currency'],
    cost_components_summary: row['cost_components_summary'],
    input_commodities: parseJsonArray<string>(row['input_commodities']),
    input_coefficients: parseJsonArray<number>(row['input_coefficients']),
    input_units: parseJsonArray<string>(row['input_units']),
    input_basis_notes: row['input_basis_notes'],
    energy_emissions_by_pollutant: parseJsonArray<EmissionEntry>(row['energy_emissions_by_pollutant']),
    process_emissions_by_pollutant: parseJsonArray<EmissionEntry>(row['process_emissions_by_pollutant']),
    emissions_units: row['emissions_units'],
    emissions_boundary_notes: row['emissions_boundary_notes'],
    max_share: parseNum(row['max_share']),
    max_activity: parseNum(row['max_activity']),
    min_share: parseNum(row['min_share']),
    rollout_limit_notes: row['rollout_limit_notes'],
    availability_conditions: row['availability_conditions'],
    source_ids: parseJsonArray<string>(row['source_ids']),
    evidence_summary: row['evidence_summary'],
    derivation_method: row['derivation_method'],
    assumption_ids: parseJsonArray<string>(row['assumption_ids']),
    confidence_rating: row['confidence_rating'],
    review_notes: row['review_notes'],
    candidate_expansion_pathway: row['candidate_expansion_pathway'],
    times_or_vedalang_mapping_notes: row['times_or_vedalang_mapping_notes'],
    would_expand_to_explicit_capacity: parseBool(row['would_expand_to_explicit_capacity?']),
    would_expand_to_process_chain: parseBool(row['would_expand_to_process_chain?']),
    energy_co2e: parseNum(row['energy_co2e']),
    process_co2e: parseNum(row['process_co2e']),
    state_stage_family: row['state_stage_family'] ?? '',
    state_stage_rank: parseNum(row['state_stage_rank']),
    state_stage_code: row['state_stage_code'] ?? '',
    state_sort_key: row['state_sort_key'] ?? '',
    state_label_standardized: row['state_label_standardized'] ?? '',
    is_default_incumbent_2025: parseBool(row['is_default_incumbent_2025']),
    state_option_rank: parseNum(row['state_option_rank']),
    state_option_code: row['state_option_code'] ?? '',
    state_option_label: row['state_option_label'] ?? '',
    balance_tuning_flag: parseBool(row['balance_tuning_flag']),
    balance_tuning_note: row['balance_tuning_note'] ?? '',
    benchmark_balance_note: row['benchmark_balance_note'] ?? '',
  };
}

function toServiceDemandAnchorRow(row: Record<string, string>): ServiceDemandAnchorRow {
  return {
    anchor_type: row['anchor_type'] as ServiceDemandAnchorType,
    service_or_output_name: row['service_or_output_name'],
    default_2025_state_id: row['default_2025_state_id'],
    default_2025_state_option_code: row['default_2025_state_option_code'],
    default_2025_state_option_label: row['default_2025_state_option_label'],
    quantity_2025: parseNum(row['quantity_2025']),
    unit: row['unit'],
    anchor_status: row['anchor_status'],
    source_family: row['source_family'],
    coverage_note: row['coverage_note'],
    implied_gross_input_energy_pj_if_default: parseNum(row['implied_gross_input_energy_pj_if_default']),
    implied_benchmark_final_energy_pj_if_default: parseNum(row['implied_benchmark_final_energy_pj_if_default']),
    implied_energy_emissions_mtco2e_if_default: parseNum(row['implied_energy_emissions_mtco2e_if_default']),
    implied_process_emissions_mtco2e_if_default: parseNum(row['implied_process_emissions_mtco2e_if_default']),
    implied_total_emissions_mtco2e_if_default: parseNum(row['implied_total_emissions_mtco2e_if_default']),
  };
}

function toResidualOverlayRow(row: Record<string, string>): ResidualOverlayRow {
  return {
    overlay_id: row['overlay_id'],
    overlay_label: row['overlay_label'],
    overlay_domain: row['overlay_domain'] as ResidualOverlayDomain,
    official_accounting_bucket: row['official_accounting_bucket'],
    year: Number(row['year']),
    commodity: parseEmptyNull(row['commodity']),
    final_energy_pj_2025: parseNum(row['final_energy_pj_2025']),
    native_unit: row['native_unit'] ?? '',
    native_quantity_2025: parseNum(row['native_quantity_2025']),
    direct_energy_emissions_mtco2e_2025: parseNum(row['direct_energy_emissions_mtco2e_2025']),
    other_emissions_mtco2e_2025: parseNum(row['other_emissions_mtco2e_2025']),
    carbon_billable_emissions_mtco2e_2025: parseNum(row['carbon_billable_emissions_mtco2e_2025']),
    default_price_basis: row['default_price_basis'] ?? '',
    default_price_per_native_unit_aud_2024: parseNum(row['default_price_per_native_unit_aud_2024']),
    default_commodity_cost_audm_2024: parseNum(row['default_commodity_cost_audm_2024']),
    default_fixed_noncommodity_cost_audm_2024: parseNum(row['default_fixed_noncommodity_cost_audm_2024']),
    default_total_cost_ex_carbon_audm_2024: parseNum(row['default_total_cost_ex_carbon_audm_2024']),
    default_include: parseBool(row['default_include']),
    allocation_method: row['allocation_method'] ?? '',
    cost_basis_note: row['cost_basis_note'] ?? '',
    notes: row['notes'] ?? '',
  };
}

function toCommodityBalance2025Row(row: Record<string, string>): CommodityBalance2025Row {
  return {
    commodity: row['commodity'],
    benchmark_stream: row['benchmark_stream'],
    official_benchmark_pj_2025: parseNum(row['official_benchmark_pj_2025']),
    explicit_gross_model_inputs_pj_2025: parseNum(row['explicit_gross_model_inputs_pj_2025']),
    explicit_benchmark_mapped_pj_2025: parseNum(row['explicit_benchmark_mapped_pj_2025']),
    residual_overlay_pj_2025: parseNum(row['residual_overlay_pj_2025']),
    balanced_total_pj_2025: parseNum(row['balanced_total_pj_2025']),
    difference_to_benchmark_pj_2025: parseNum(row['difference_to_benchmark_pj_2025']),
    native_unit: row['native_unit'],
    official_benchmark_native_2025: parseNum(row['official_benchmark_native_2025']),
    explicit_gross_model_inputs_native_2025: parseNum(row['explicit_gross_model_inputs_native_2025']),
    explicit_benchmark_mapped_native_2025: parseNum(row['explicit_benchmark_mapped_native_2025']),
    residual_overlay_native_2025: parseNum(row['residual_overlay_native_2025']),
    balanced_total_native_2025: parseNum(row['balanced_total_native_2025']),
    notes: row['notes'],
  };
}

function toEmissionsBalance2025Row(row: Record<string, string>): EmissionsBalance2025Row {
  return {
    official_category: row['official_category'],
    official_mtco2e_2025: parseNum(row['official_mtco2e_2025']),
    explicit_model_mtco2e_2025: parseNum(row['explicit_model_mtco2e_2025']),
    residual_energy_overlay_mtco2e_2025: parseNum(row['residual_energy_overlay_mtco2e_2025']),
    residual_nonenergy_overlay_mtco2e_2025: parseNum(row['residual_nonenergy_overlay_mtco2e_2025']),
    balanced_total_mtco2e_2025: parseNum(row['balanced_total_mtco2e_2025']),
    difference_to_official_mtco2e_2025: parseNum(row['difference_to_official_mtco2e_2025']),
    note: row['note'],
  };
}

function toAutonomousEfficiencyTrack(
  path: string,
  row: Record<string, string>,
  context: EfficiencyArtifactValidationContext,
): AutonomousEfficiencyTrack {
  const expectedFamilyId = familyIdFromPath(path, '/autonomous_efficiency_tracks.csv');
  const family_id = parseRequiredString(row['family_id'], `${path}.family_id`);
  if (family_id !== expectedFamilyId) {
    throw new Error(
      `${path} row family_id ${JSON.stringify(family_id)} must match folder family_id ${JSON.stringify(expectedFamilyId)}`,
    );
  }

  const track_id = parseRequiredString(row['track_id'], `${path}.track_id`);
  const artifactLabel = `${path}:${track_id}`;
  const applicable_state_ids = parseJsonStringArrayStrict(
    row['applicable_state_ids'],
    `${artifactLabel}.applicable_state_ids`,
  );
  const affected_input_commodities = parseJsonStringArrayStrict(
    row['affected_input_commodities'],
    `${artifactLabel}.affected_input_commodities`,
  );
  const input_multipliers = parseJsonNumberArrayStrict(
    row['input_multipliers'],
    `${artifactLabel}.input_multipliers`,
  );
  const source_ids = parseJsonStringArrayStrict(row['source_ids'], `${artifactLabel}.source_ids`);
  const assumption_ids = parseJsonStringArrayStrict(
    row['assumption_ids'],
    `${artifactLabel}.assumption_ids`,
  );

  validateAlignedArrays(
    artifactLabel,
    affected_input_commodities,
    'affected_input_commodities',
    input_multipliers,
    'input_multipliers',
  );
  validateEfficiencyReferences(
    family_id,
    artifactLabel,
    applicable_state_ids,
    source_ids,
    assumption_ids,
    context,
  );

  return {
    family_id,
    track_id,
    year: parseMilestoneYear(row['year'], `${artifactLabel}.year`),
    track_label: parseRequiredString(row['track_label'], `${artifactLabel}.track_label`),
    track_description: parseRequiredString(
      row['track_description'],
      `${artifactLabel}.track_description`,
    ),
    applicable_state_ids,
    affected_input_commodities,
    input_multipliers,
    delta_output_cost_per_unit: parseRequiredNumber(
      row['delta_output_cost_per_unit'],
      `${artifactLabel}.delta_output_cost_per_unit`,
    ),
    cost_basis_year: parseRequiredNumber(row['cost_basis_year'], `${artifactLabel}.cost_basis_year`),
    currency: parseRequiredString(row['currency'], `${artifactLabel}.currency`),
    source_ids,
    assumption_ids,
    evidence_summary: parseRequiredString(
      row['evidence_summary'],
      `${artifactLabel}.evidence_summary`,
    ),
    derivation_method: parseRequiredString(
      row['derivation_method'],
      `${artifactLabel}.derivation_method`,
    ),
    confidence_rating: parseRequiredString(
      row['confidence_rating'],
      `${artifactLabel}.confidence_rating`,
    ),
    double_counting_guardrail: parseRequiredString(
      row['double_counting_guardrail'],
      `${artifactLabel}.double_counting_guardrail`,
    ),
    review_notes: parseRequiredString(row['review_notes'], `${artifactLabel}.review_notes`),
  };
}

function toEfficiencyPackage(
  path: string,
  row: Record<string, string>,
  context: EfficiencyArtifactValidationContext,
): EfficiencyPackage {
  const expectedFamilyId = familyIdFromPath(path, '/efficiency_packages.csv');
  const family_id = parseRequiredString(row['family_id'], `${path}.family_id`);
  if (family_id !== expectedFamilyId) {
    throw new Error(
      `${path} row family_id ${JSON.stringify(family_id)} must match folder family_id ${JSON.stringify(expectedFamilyId)}`,
    );
  }

  const package_id = parseRequiredString(row['package_id'], `${path}.package_id`);
  const artifactLabel = `${path}:${package_id}`;
  const applicable_state_ids = parseJsonStringArrayStrict(
    row['applicable_state_ids'],
    `${artifactLabel}.applicable_state_ids`,
  );
  const affected_input_commodities = parseJsonStringArrayStrict(
    row['affected_input_commodities'],
    `${artifactLabel}.affected_input_commodities`,
  );
  const input_multipliers = parseJsonNumberArrayStrict(
    row['input_multipliers'],
    `${artifactLabel}.input_multipliers`,
  );
  const source_ids = parseJsonStringArrayStrict(row['source_ids'], `${artifactLabel}.source_ids`);
  const assumption_ids = parseJsonStringArrayStrict(
    row['assumption_ids'],
    `${artifactLabel}.assumption_ids`,
  );

  validateAlignedArrays(
    artifactLabel,
    affected_input_commodities,
    'affected_input_commodities',
    input_multipliers,
    'input_multipliers',
  );
  validateEfficiencyReferences(
    family_id,
    artifactLabel,
    applicable_state_ids,
    source_ids,
    assumption_ids,
    context,
  );

  return {
    family_id,
    package_id,
    year: parseMilestoneYear(row['year'], `${artifactLabel}.year`),
    package_label: parseRequiredString(row['package_label'], `${artifactLabel}.package_label`),
    package_description: parseRequiredString(
      row['package_description'],
      `${artifactLabel}.package_description`,
    ),
    classification: parseEfficiencyPackageClassification(
      row['classification'],
      `${artifactLabel}.classification`,
    ),
    applicable_state_ids,
    affected_input_commodities,
    input_multipliers,
    delta_output_cost_per_unit: parseRequiredNumber(
      row['delta_output_cost_per_unit'],
      `${artifactLabel}.delta_output_cost_per_unit`,
    ),
    cost_basis_year: parseRequiredNumber(row['cost_basis_year'], `${artifactLabel}.cost_basis_year`),
    currency: parseRequiredString(row['currency'], `${artifactLabel}.currency`),
    max_share: parseOptionalNumber(row['max_share'], `${artifactLabel}.max_share`),
    rollout_limit_notes: parseRequiredString(
      row['rollout_limit_notes'],
      `${artifactLabel}.rollout_limit_notes`,
    ),
    source_ids,
    assumption_ids,
    evidence_summary: parseRequiredString(
      row['evidence_summary'],
      `${artifactLabel}.evidence_summary`,
    ),
    derivation_method: parseRequiredString(
      row['derivation_method'],
      `${artifactLabel}.derivation_method`,
    ),
    confidence_rating: parseRequiredString(
      row['confidence_rating'],
      `${artifactLabel}.confidence_rating`,
    ),
    review_notes: parseRequiredString(row['review_notes'], `${artifactLabel}.review_notes`),
    non_stacking_group: parseEmptyNull(row['non_stacking_group']),
  };
}

export function loadEfficiencyArtifacts(
  textFiles: Record<string, string>,
  context: EfficiencyArtifactValidationContext,
): Pick<PackageData, 'autonomousEfficiencyTracks' | 'efficiencyPackages'> {
  const autonomousEfficiencyTracks = listTextFiles(
    textFiles,
    'families/',
    '/autonomous_efficiency_tracks.csv',
  ).flatMap((path) => parseCsv(textFiles[path] ?? '').map((row) => toAutonomousEfficiencyTrack(path, row, context)));

  const efficiencyPackages = listTextFiles(
    textFiles,
    'families/',
    '/efficiency_packages.csv',
  ).flatMap((path) => parseCsv(textFiles[path] ?? '').map((row) => toEfficiencyPackage(path, row, context)));

  return {
    autonomousEfficiencyTracks,
    efficiencyPackages,
  };
}

function buildBaselineAnchors(
  families: FamilyRegistryRow[],
  familyDemands: FamilyDemandRow[],
  externalCommodityDemands: ExternalCommodityDemandRow[],
  appConfig: AppConfigRegistry,
): Record<string, BaselineActivityAnchor> {
  const anchors: Record<string, BaselineActivityAnchor> = {};
  const familyDemandById = new Map(familyDemands.map((row) => [row.family_id, row]));

  for (const family of families) {
    if (family.output_role === 'endogenous_supply_commodity') {
      continue;
    }

    const demand = familyDemandById.get(family.family_id);
    if (!demand) {
      continue;
    }

    anchors[family.family_id] = {
      output_role: (appConfig.output_roles[family.family_id]?.output_role ?? family.output_role) as BaselineActivityAnchor['output_role'],
      anchor_kind: 'service_demand',
      anchor_year: demand.anchor_year,
      value: demand.anchor_value,
      unit: demand.unit,
      provenance_note: `${demand.source_family} — ${demand.coverage_note}`,
    };
  }

  for (const demand of externalCommodityDemands) {
    anchors[demand.commodity_id] = {
      output_role: 'endogenous_supply_commodity',
      anchor_kind: 'external_commodity_demand',
      anchor_year: demand.anchor_year,
      value: demand.anchor_value,
      unit: demand.unit,
      provenance_note: `${demand.source_family} — ${demand.coverage_note}`,
    };
  }

  return anchors;
}

function buildDemandGrowthPresets(rows: DemandGrowthCurveRow[]): Record<string, DemandGrowthPreset> {
  const presets: Record<string, DemandGrowthPreset> = {};

  for (const row of rows) {
    const parsedId = parseDemandCurveId(row.demand_growth_curve_id);
    const presetId = parsedId.presetId;

    const preset = presets[presetId] ?? {
      label: normalizePresetLabel(row.label),
      description: normalizePresetDescription(row.description),
      annual_growth_rates_pct_per_year: {},
      external_commodity_growth_rates_pct_per_year: {},
      milestone_multipliers_by_output: {},
      milestone_multipliers_by_external_commodity: {},
      provenance_note: row.provenance_note,
    };

    const rate = inferConstantGrowthRatePctPerYear(row.values_by_year);
    if (parsedId.familyId) {
      preset.milestone_multipliers_by_output![parsedId.familyId] = row.values_by_year;
      if (rate != null) {
        preset.annual_growth_rates_pct_per_year[parsedId.familyId] = rate;
      }
    }
    if (parsedId.externalCommodityId) {
      preset.milestone_multipliers_by_external_commodity![parsedId.externalCommodityId] = row.values_by_year;
      if (rate != null) {
        preset.external_commodity_growth_rates_pct_per_year[parsedId.externalCommodityId] = rate;
      }
    }

    presets[presetId] = preset;
  }

  return presets;
}

function buildCommodityPricePresets(rows: CommodityPriceCurveRow[]): Record<string, CommodityPriceDriver> {
  const drivers: Record<string, CommodityPriceDriver> = {};

  for (const row of rows) {
    const driver = drivers[row.commodity_id] ?? {
      label: normalizePresetLabel(row.label),
      levels: {},
      provenance_note: row.provenance_note,
    };

    driver.levels[row.price_curve_id] = {
      unit: row.unit,
      values_by_year: row.values_by_year,
    } as CommodityPriceSeries;
    drivers[row.commodity_id] = driver;
  }

  return drivers;
}

function buildCarbonPricePresets(
  rows: CarbonPriceCurveRow[],
): AppConfigRegistry['carbon_price_presets'] {
  return Object.fromEntries(
    rows.map((row) => [
      row.carbon_price_curve_id,
      {
        label: row.label,
        description: row.label,
        unit: row.unit,
        values_by_year: row.values_by_year,
        provenance_note: row.provenance_note,
      },
    ]),
  );
}

function formatLabelFromId(id: string): string {
  return id
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildSystemStructureLookup(
  groups: SystemStructureGroupRow[],
  members: SystemStructureMemberRow[],
): Map<string, SystemStructureMemberLookup> {
  const groupsById = new Map(groups.map((group) => [group.group_id, group]));
  const lookup = new Map<string, SystemStructureMemberLookup>();

  for (const member of members) {
    const group = groupsById.get(member.group_id);
    if (!group) {
      continue;
    }

    lookup.set(member.family_id, {
      groupId: group.group_id,
      groupLabel: group.group_label,
      groupOrder: group.display_order,
      memberOrder: member.display_order,
    });
  }

  return lookup;
}

function buildOutputRoles(
  appConfig: AppConfigRegistry,
  families: FamilyRegistryRow[],
  groups: SystemStructureGroupRow[],
  members: SystemStructureMemberRow[],
): AppConfigRegistry['output_roles'] {
  const systemLookup = buildSystemStructureLookup(groups, members);
  const outputRoles = { ...appConfig.output_roles };

  for (const family of families) {
    if (outputRoles[family.family_id]) {
      continue;
    }

    const structure = systemLookup.get(family.family_id);
    outputRoles[family.family_id] = {
      output_role: family.output_role,
      display_label: family.coverage_scope_label || formatLabelFromId(family.family_id),
      display_group: structure?.groupLabel ?? formatLabelFromId(family.sector),
      display_group_order: structure?.groupOrder ?? 900,
      display_order: structure?.memberOrder ?? 900,
      participates_in_commodity_balance: family.output_role === 'endogenous_supply_commodity',
      demand_required: family.output_role === 'required_service',
      default_control_mode: family.output_role === 'endogenous_supply_commodity'
        ? 'externalized'
        : 'optimize',
      allowed_control_modes: family.output_role === 'endogenous_supply_commodity'
        ? ['optimize', 'externalized']
        : ['optimize'],
      explanation_group: structure?.groupId ?? family.sector,
    };
  }

  return outputRoles;
}

function validateSystemStructure(
  families: FamilyRegistryRow[],
  groups: SystemStructureGroupRow[],
  members: SystemStructureMemberRow[],
): void {
  const groupIds = new Set(groups.map((group) => group.group_id));
  const familyIds = new Set(families.map((family) => family.family_id));
  const seenByFamily = new Map<string, number>();

  for (const member of members) {
    if (!groupIds.has(member.group_id)) {
      throw new Error(
        `Unknown system structure group ${JSON.stringify(member.group_id)} for family ${JSON.stringify(member.family_id)}`,
      );
    }
    if (!familyIds.has(member.family_id)) {
      throw new Error(`Unknown system structure family ${JSON.stringify(member.family_id)}`);
    }

    seenByFamily.set(member.family_id, (seenByFamily.get(member.family_id) ?? 0) + 1);
  }

  for (const family of families) {
    const count = seenByFamily.get(family.family_id) ?? 0;
    if (count !== 1) {
      throw new Error(
        `Family ${JSON.stringify(family.family_id)} must appear in system_structure_members.csv exactly once; found ${count}.`,
      );
    }
  }
}

export function loadPackage(): PackageData {
  const appConfig = loadAppConfig();
  if (Object.keys(packageTextFiles).length === 0) {
    const enrichment = buildPackageEnrichment({});
    const defaultConfiguration = materializeEfficiencyConfiguration(
      materializeResidualOverlayConfiguration(
        loadDefaultConfiguration(appConfig),
        [],
      ),
      [],
      [],
    );

    return {
      familyMetadata: [],
      systemStructureGroups: [],
      systemStructureMembers: [],
      sectorStates: [],
      autonomousEfficiencyTracks: [],
      efficiencyPackages: [],
      serviceDemandAnchors2025: [],
      residualOverlays2025: [],
      commodityBalance2025: [],
      emissionsBalance2025: [],
      readme: '',
      phase2Memo: '',
      enrichment,
      appConfig,
      defaultConfiguration,
    };
  }

  const families = parseCsv(requirePackageFile('shared/families.csv')).map(toFamilyRegistryRow);
  const systemStructureGroups = parseCsv(
    requirePackageFile('shared/system_structure_groups.csv'),
  ).map(toSystemStructureGroupRow);
  const systemStructureMembers = parseCsv(
    requirePackageFile('shared/system_structure_members.csv'),
  ).map(toSystemStructureMemberRow);
  validateSystemStructure(families, systemStructureGroups, systemStructureMembers);
  appConfig.output_roles = buildOutputRoles(
    appConfig,
    families,
    systemStructureGroups,
    systemStructureMembers,
  );
  const familyById = new Map(families.map((row) => [row.family_id, row]));
  const sectorStates = listPackageFiles('families/', '/family_states.csv').flatMap((path) => {
    const rows = parseCsv(requirePackageFile(path));
    return rows.map((row) => {
      const family = familyById.get(row['family_id']);
      if (!family) {
        throw new Error(`Missing family registry entry for ${JSON.stringify(row['family_id'])}`);
      }
      return toSectorState(family, row);
    });
  });
  const sourceIds = new Set(
    parseCsv(requirePackageFile('shared/source_ledger.csv')).map((row) => row['source_id']),
  );
  const assumptionIds = new Set(
    parseCsv(requirePackageFile('shared/assumptions_ledger.csv')).map((row) => row['assumption_id']),
  );
  const stateIdsByFamilyId = sectorStates.reduce<Map<string, Set<string>>>((result, row) => {
    const stateIds = result.get(row.family_id) ?? new Set<string>();
    stateIds.add(row.state_id);
    result.set(row.family_id, stateIds);
    return result;
  }, new Map<string, Set<string>>());
  const { autonomousEfficiencyTracks, efficiencyPackages } = loadEfficiencyArtifacts(packageTextFiles, {
    sourceIds,
    assumptionIds,
    stateIdsByFamilyId,
  });

  const familyDemands = listPackageFiles('families/', '/demand.csv').map((path) => {
    const rows = parseCsv(requirePackageFile(path));
    return toFamilyDemandRow(rows[0] ?? {});
  });
  const externalCommodityDemands = parseCsv(
    requirePackageFile('shared/external_commodity_demands.csv'),
  ).map(toExternalCommodityDemandRow);
  const demandGrowthCurves = parseCsv(requirePackageFile('shared/demand_growth_curves.csv')).map(toDemandGrowthCurveRow);
  const commodityPriceCurves = parseCsv(requirePackageFile('shared/commodity_price_curves.csv')).map(toCommodityPriceCurveRow);
  const carbonPriceCurves = parseCsv(requirePackageFile('shared/carbon_price_curves.csv')).map(toCarbonPriceCurveRow);

  appConfig.baseline_activity_anchors = buildBaselineAnchors(
    families,
    familyDemands,
    externalCommodityDemands,
    appConfig,
  );
  appConfig.demand_growth_presets = buildDemandGrowthPresets(demandGrowthCurves);
  appConfig.commodity_price_presets = buildCommodityPricePresets(commodityPriceCurves);
  appConfig.carbon_price_presets = buildCarbonPricePresets(carbonPriceCurves);

  const serviceDemandAnchors2025 = parseCsv(
    requirePackageFile('exports/legacy/service_demand_anchors_2025.csv'),
  ).map(toServiceDemandAnchorRow);
  const residualOverlays2025 = parseCsv(
    requirePackageFile('overlays/residual_overlays.csv'),
  ).map(toResidualOverlayRow);
  const commodityBalance2025 = parseCsv(
    requirePackageFile('validation/baseline_commodity_balance.csv'),
  ).map(toCommodityBalance2025Row);
  const emissionsBalance2025 = parseCsv(
    requirePackageFile('validation/baseline_emissions_balance.csv'),
  ).map(toEmissionsBalance2025Row);

  const enrichment = buildPackageEnrichment(packageTextFiles);
  const defaultConfiguration = materializeEfficiencyConfiguration(
    materializeResidualOverlayConfiguration(
      loadDefaultConfiguration(appConfig),
      residualOverlays2025,
    ),
    autonomousEfficiencyTracks,
    efficiencyPackages,
  );

  return {
    familyMetadata: families,
    systemStructureGroups,
    systemStructureMembers,
    sectorStates,
    autonomousEfficiencyTracks,
    efficiencyPackages,
    serviceDemandAnchors2025,
    residualOverlays2025,
    commodityBalance2025,
    emissionsBalance2025,
    readme: enrichment.readme,
    phase2Memo: enrichment.phase2Memo,
    enrichment,
    appConfig,
    defaultConfiguration,
  };
}
