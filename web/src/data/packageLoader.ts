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
  BalanceType,
  BaselineActivityAnchor,
  CommodityBalance2025Row,
  CommodityPriceDriver,
  CommodityPriceSeries,
  CoverageObligation,
  DemandGrowthPreset,
  EfficiencyPackage,
  EfficiencyPackageClassification,
  EmissionEntry,
  EmissionsBalance2025Row,
  Method,
  MethodKind,
  MethodYear,
  OutputRole,
  PackageData,
  PriceLevel,
  ReportingAllocation,
  RepresentationKind,
  ResidualOverlayRow,
  RoleDecompositionEdge,
  RoleDemand,
  RoleKind,
  RoleMetadata,
  RolePresentationMetadata,
  RoleRepresentation,
  ResolvedMethodYearRow,
  ServiceDemandAnchorRow,
  ServiceDemandAnchorType,
  SystemStructureGroupRow,
  SystemStructureMemberRow,
} from './types.ts';

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

interface RoleAppProjection {
  appOutputId: string;
  reportingAllocation: ReportingAllocation | null;
  defaultMethodId: string;
}

interface EfficiencyArtifactValidationContext {
  sourceIds: Set<string>;
  assumptionIds: Set<string>;
  methodIdsByRoleId: Map<string, Set<string>>;
  appProjectionByRoleId: Map<string, RoleAppProjection>;
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
  const packageRoot = pathModule.resolve(moduleDir, '../../../energy_system_representation_library');
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
        '../../../energy_system_representation_library/README.md',
        '../../../energy_system_representation_library/manifest.json',
        '../../../energy_system_representation_library/schema/*.json',
        '../../../energy_system_representation_library/shared/*.csv',
        '../../../energy_system_representation_library/roles/*/*.csv',
        '../../../energy_system_representation_library/roles/*/*.md',
        '../../../energy_system_representation_library/validation/*.csv',
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

function parseNum(raw: string | undefined): number | null {
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
  const value = parseNum(raw);
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

function parseRoleKind(raw: string | undefined, label: string): RoleKind {
  const value = parseRequiredString(raw, label);
  if (value === 'modeled' || value === 'removal' || value === 'residual') {
    return value;
  }

  throw new Error(`Unknown role_kind for ${label}: ${JSON.stringify(value)}`);
}

function parseBalanceType(raw: string | undefined, label: string): BalanceType {
  const value = parseRequiredString(raw, label);
  if (
    value === 'carbon_removal'
    || value === 'commodity_supply'
    || value === 'intermediate_conversion'
    || value === 'intermediate_material'
    || value === 'residual_accounting'
    || value === 'service_demand'
  ) {
    return value;
  }

  throw new Error(`Unknown balance_type for ${label}: ${JSON.stringify(value)}`);
}

function parseCoverageObligation(raw: string | undefined, label: string): CoverageObligation {
  const value = parseRequiredString(raw, label);
  if (
    value === 'explicit_residual_top_level'
    || value === 'required_decomposition_child'
    || value === 'required_top_level'
  ) {
    return value;
  }

  throw new Error(`Unknown coverage_obligation for ${label}: ${JSON.stringify(value)}`);
}

function parseRepresentationKind(raw: string | undefined, label: string): RepresentationKind {
  const value = parseRequiredString(raw, label);
  if (value === 'pathway_bundle' || value === 'technology_bundle' || value === 'role_decomposition') {
    return value;
  }

  throw new Error(`Unknown representation_kind for ${label}: ${JSON.stringify(value)}`);
}

function parseMethodKind(raw: string | undefined, label: string): MethodKind {
  const value = parseRequiredString(raw, label);
  if (value === 'pathway' || value === 'technology' || value === 'residual') {
    return value;
  }

  throw new Error(`Unknown method_kind for ${label}: ${JSON.stringify(value)}`);
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

function outputRoleFromRole(role: RoleMetadata): OutputRole {
  if (role.balance_type === 'commodity_supply') {
    return 'endogenous_supply_commodity';
  }
  if (role.balance_type === 'carbon_removal' || role.coverage_obligation === 'required_decomposition_child') {
    return 'optional_activity';
  }
  return 'required_service';
}

function normalizeLookupCandidate(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function residualOutputIdFromMethodId(methodId: string): string | null {
  const suffix = '__residual_incumbent';
  return methodId.endsWith(suffix) ? methodId.slice(0, -suffix.length) : null;
}

function toRoleMetadata(row: Record<string, string>): RoleMetadata {
  const roleId = parseRequiredString(row['role_id'], 'shared/roles.csv.role_id');
  return {
    role_id: roleId,
    role_label: parseRequiredString(row['role_label'], `shared/roles.csv.${roleId}.role_label`),
    description: parseRequiredString(row['description'], `shared/roles.csv.${roleId}.description`),
    topology_area_id: parseRequiredString(row['topology_area_id'], `shared/roles.csv.${roleId}.topology_area_id`),
    topology_area_label: parseRequiredString(row['topology_area_label'], `shared/roles.csv.${roleId}.topology_area_label`),
    parent_role_id: parseEmptyNull(row['parent_role_id']),
    role_kind: parseRoleKind(row['role_kind'], `shared/roles.csv.${roleId}.role_kind`),
    balance_type: parseBalanceType(row['balance_type'], `shared/roles.csv.${roleId}.balance_type`),
    output_unit: parseRequiredString(row['output_unit'], `shared/roles.csv.${roleId}.output_unit`),
    coverage_obligation: parseCoverageObligation(
      row['coverage_obligation'],
      `shared/roles.csv.${roleId}.coverage_obligation`,
    ),
    default_representation_kind: parseRepresentationKind(
      row['default_representation_kind'],
      `shared/roles.csv.${roleId}.default_representation_kind`,
    ),
    notes: row['notes'] ?? '',
  };
}

function toRoleRepresentation(row: Record<string, string>): RoleRepresentation {
  const representationId = parseRequiredString(row['representation_id'], 'shared/representations.csv.representation_id');
  const representationKind = parseRepresentationKind(
    row['representation_kind'],
    `shared/representations.csv.${representationId}.representation_kind`,
  );
  const directMethodKind = parseEmptyNull(row['direct_method_kind']);
  return {
    representation_id: representationId,
    role_id: parseRequiredString(row['role_id'], `shared/representations.csv.${representationId}.role_id`),
    representation_kind: representationKind,
    representation_label: parseRequiredString(
      row['representation_label'],
      `shared/representations.csv.${representationId}.representation_label`,
    ),
    description: parseRequiredString(row['description'], `shared/representations.csv.${representationId}.description`),
    is_default: parseBool(row['is_default']),
    direct_method_kind: directMethodKind
      ? parseMethodKind(directMethodKind, `shared/representations.csv.${representationId}.direct_method_kind`)
      : null,
    notes: row['notes'] ?? '',
  };
}

function toRoleDecompositionEdge(row: Record<string, string>): RoleDecompositionEdge {
  const parentRepresentationId = parseRequiredString(
    row['parent_representation_id'],
    'shared/role_decomposition_edges.csv.parent_representation_id',
  );
  const childRoleId = parseRequiredString(
    row['child_role_id'],
    `shared/role_decomposition_edges.csv.${parentRepresentationId}.child_role_id`,
  );
  const edgeKind = parseRequiredString(
    row['edge_kind'],
    `shared/role_decomposition_edges.csv.${parentRepresentationId}.${childRoleId}.edge_kind`,
  );
  if (edgeKind !== 'required_child' && edgeKind !== 'optional_child') {
    throw new Error(`Unknown role decomposition edge kind: ${JSON.stringify(edgeKind)}`);
  }

  return {
    parent_representation_id: parentRepresentationId,
    parent_role_id: parseRequiredString(
      row['parent_role_id'],
      `shared/role_decomposition_edges.csv.${parentRepresentationId}.parent_role_id`,
    ),
    child_role_id: childRoleId,
    edge_kind: edgeKind,
    is_required: parseBool(row['is_required']),
    display_order: parseRequiredNumber(
      row['display_order'],
      `shared/role_decomposition_edges.csv.${parentRepresentationId}.${childRoleId}.display_order`,
    ),
    coverage_notes: row['coverage_notes'] ?? '',
  };
}

function toReportingAllocation(row: Record<string, string>): ReportingAllocation {
  const reportingAllocationId = parseRequiredString(
    row['reporting_allocation_id'],
    'shared/reporting_allocations.csv.reporting_allocation_id',
  );
  return {
    reporting_allocation_id: reportingAllocationId,
    role_id: parseRequiredString(row['role_id'], `shared/reporting_allocations.csv.${reportingAllocationId}.role_id`),
    reporting_system: parseRequiredString(
      row['reporting_system'],
      `shared/reporting_allocations.csv.${reportingAllocationId}.reporting_system`,
    ),
    sector: parseRequiredString(row['sector'], `shared/reporting_allocations.csv.${reportingAllocationId}.sector`),
    subsector: parseRequiredString(row['subsector'], `shared/reporting_allocations.csv.${reportingAllocationId}.subsector`),
    reporting_bucket: parseRequiredString(
      row['reporting_bucket'],
      `shared/reporting_allocations.csv.${reportingAllocationId}.reporting_bucket`,
    ),
    allocation_basis: parseRequiredString(
      row['allocation_basis'],
      `shared/reporting_allocations.csv.${reportingAllocationId}.allocation_basis`,
    ),
    allocation_share: parseRequiredNumber(
      row['allocation_share'],
      `shared/reporting_allocations.csv.${reportingAllocationId}.allocation_share`,
    ),
    notes: row['notes'] ?? '',
  };
}

function toMethod(path: string, row: Record<string, string>): Method {
  const methodId = parseRequiredString(row['method_id'], `${path}.method_id`);
  return {
    role_id: parseRequiredString(row['role_id'], `${path}.${methodId}.role_id`),
    representation_id: parseRequiredString(row['representation_id'], `${path}.${methodId}.representation_id`),
    method_id: methodId,
    method_kind: parseMethodKind(row['method_kind'], `${path}.${methodId}.method_kind`),
    method_label: parseRequiredString(row['method_label'], `${path}.${methodId}.method_label`),
    method_description: parseRequiredString(row['method_description'], `${path}.${methodId}.method_description`),
    is_residual: parseBool(row['is_residual']),
    sort_order: parseRequiredNumber(row['sort_order'], `${path}.${methodId}.sort_order`),
    source_ids: parseJsonStringArrayStrict(row['source_ids'], `${path}.${methodId}.source_ids`),
    assumption_ids: parseJsonStringArrayStrict(row['assumption_ids'], `${path}.${methodId}.assumption_ids`),
    evidence_summary: parseRequiredString(row['evidence_summary'], `${path}.${methodId}.evidence_summary`),
    derivation_method: parseRequiredString(row['derivation_method'], `${path}.${methodId}.derivation_method`),
    confidence_rating: parseRequiredString(row['confidence_rating'], `${path}.${methodId}.confidence_rating`),
    review_notes: parseRequiredString(row['review_notes'], `${path}.${methodId}.review_notes`),
  };
}

function toRoleDemand(row: Record<string, string>): RoleDemand {
  const roleId = parseRequiredString(row['role_id'], 'roles/*/demand.csv.role_id');
  return {
    role_id: roleId,
    anchor_year: parseMilestoneYear(row['anchor_year'], `roles/${roleId}/demand.csv.anchor_year`),
    anchor_value: parseRequiredNumber(row['anchor_value'], `roles/${roleId}/demand.csv.anchor_value`),
    unit: parseRequiredString(row['unit'], `roles/${roleId}/demand.csv.unit`),
    demand_growth_curve_id: parseRequiredString(
      row['demand_growth_curve_id'],
      `roles/${roleId}/demand.csv.demand_growth_curve_id`,
    ),
    anchor_status: parseRequiredString(row['anchor_status'], `roles/${roleId}/demand.csv.anchor_status`),
    source_role: parseRequiredString(row['source_role'], `roles/${roleId}/demand.csv.source_role`),
    coverage_note: parseRequiredString(row['coverage_note'], `roles/${roleId}/demand.csv.coverage_note`),
    notes: row['notes'] ?? '',
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

function buildDefaultMethodIdByRoleId(methods: Method[]): Map<string, string> {
  const result = new Map<string, string>();
  const sorted = [...methods].sort((left, right) =>
    left.role_id.localeCompare(right.role_id)
    || left.sort_order - right.sort_order
    || left.method_id.localeCompare(right.method_id),
  );

  for (const method of sorted) {
    if (!result.has(method.role_id)) {
      result.set(method.role_id, method.method_id);
    }
  }

  for (const row of parseCsv(requirePackageFile('validation/role_validation_summary.csv'))) {
    const roleId = row['role_id'];
    const methodId = row['default_method_id'];
    if (roleId && methodId) {
      result.set(roleId, methodId);
    }
  }

  return result;
}

function buildRoleAppProjection(
  roles: RoleMetadata[],
  methods: Method[],
  reportingAllocations: ReportingAllocation[],
  appConfig: AppConfigRegistry,
): Map<string, RoleAppProjection> {
  const defaultMethodIdByRoleId = buildDefaultMethodIdByRoleId(methods);
  const allocationByRoleId = new Map(reportingAllocations.map((allocation) => [allocation.role_id, allocation]));
  const knownOutputIds = new Set(Object.keys(appConfig.output_roles));
  const result = new Map<string, RoleAppProjection>();

  for (const role of roles) {
    const reportingAllocation = allocationByRoleId.get(role.role_id) ?? null;
    const defaultMethodId = defaultMethodIdByRoleId.get(role.role_id) ?? '';
    const methodDerivedId = residualOutputIdFromMethodId(defaultMethodId);
    const normalizedReportingBucket = normalizeLookupCandidate(reportingAllocation?.reporting_bucket);
    const isResidualAccountingRole = role.role_kind === 'residual' || role.balance_type === 'residual_accounting';
    const candidates = role.coverage_obligation === 'required_decomposition_child'
      ? [role.role_id]
      : isResidualAccountingRole
        ? [
            methodDerivedId,
            reportingAllocation?.subsector,
            normalizedReportingBucket,
            reportingAllocation?.reporting_bucket,
            role.role_id,
          ]
        : [
            reportingAllocation?.reporting_bucket,
            normalizedReportingBucket,
            methodDerivedId,
            reportingAllocation?.subsector,
            role.role_id,
          ];
    const knownAppOutputId = candidates.find((candidate) => candidate && knownOutputIds.has(candidate));
    const appOutputId = knownAppOutputId
      ?? (role.coverage_obligation === 'required_decomposition_child'
        ? role.role_id
        : isResidualAccountingRole
          ? methodDerivedId
            ?? reportingAllocation?.subsector
            ?? normalizedReportingBucket
            ?? role.role_id
          : normalizedReportingBucket
            ?? reportingAllocation?.subsector
            ?? methodDerivedId
            ?? role.role_id);

    result.set(role.role_id, {
      appOutputId,
      reportingAllocation,
      defaultMethodId,
    });
  }

  return result;
}

function validateMethodReferences(
  methods: Method[],
  sourceIds: Set<string>,
  assumptionIds: Set<string>,
): void {
  for (const method of methods) {
    requireKnownIds(method.source_ids, sourceIds, `${method.method_id}.source_ids`, 'source_id');
    requireKnownIds(method.assumption_ids, assumptionIds, `${method.method_id}.assumption_ids`, 'assumption_id');
  }
}

function toMethodYear(path: string, row: Record<string, string>): MethodYear {
  const roleId = parseRequiredString(row['role_id'], `${path}.role_id`);
  const methodId = parseRequiredString(row['method_id'], `${path}.${roleId}.method_id`);
  const year = parseMilestoneYear(row['year'], `${path}.${roleId}.${methodId}.year`);
  const label = `${path}.${roleId}.${methodId}.${year}`;
  return {
    role_id: roleId,
    representation_id: parseRequiredString(row['representation_id'], `${label}.representation_id`),
    method_id: methodId,
    year,
    output_cost_per_unit: parseOptionalNumber(row['output_cost_per_unit'], `${label}.output_cost_per_unit`),
    cost_basis_year: parseOptionalNumber(row['cost_basis_year'], `${label}.cost_basis_year`),
    currency: row['currency'] ?? '',
    cost_components_summary: row['cost_components_summary'] ?? '',
    input_commodities: parseJsonStringArrayStrict(row['input_commodities'], `${label}.input_commodities`),
    input_coefficients: parseJsonNumberArrayStrict(row['input_coefficients'], `${label}.input_coefficients`),
    input_units: parseJsonStringArrayStrict(row['input_units'], `${label}.input_units`),
    input_basis_notes: row['input_basis_notes'] ?? '',
    energy_emissions_by_pollutant: parseJsonArrayStrict<EmissionEntry>(
      row['energy_emissions_by_pollutant'],
      `${label}.energy_emissions_by_pollutant`,
    ),
    process_emissions_by_pollutant: parseJsonArrayStrict<EmissionEntry>(
      row['process_emissions_by_pollutant'],
      `${label}.process_emissions_by_pollutant`,
    ),
    emissions_units: row['emissions_units'] ?? '',
    emissions_boundary_notes: row['emissions_boundary_notes'] ?? '',
    max_share: parseOptionalNumber(row['max_share'], `${label}.max_share`),
    max_activity: parseOptionalNumber(row['max_activity'], `${label}.max_activity`),
    min_share: parseOptionalNumber(row['min_share'], `${label}.min_share`),
    rollout_limit_notes: row['rollout_limit_notes'] ?? '',
    availability_conditions: row['availability_conditions'] ?? '',
    source_ids: parseJsonStringArrayStrict(row['source_ids'], `${label}.source_ids`),
    assumption_ids: parseJsonStringArrayStrict(row['assumption_ids'], `${label}.assumption_ids`),
    evidence_summary: row['evidence_summary'] ?? '',
    derivation_method: row['derivation_method'] ?? '',
    confidence_rating: row['confidence_rating'] ?? '',
    review_notes: row['review_notes'] ?? '',
    candidate_expansion_pathway: row['candidate_expansion_pathway'] ?? '',
    times_or_vedalang_mapping_notes: row['times_or_vedalang_mapping_notes'] ?? '',
    would_expand_to_explicit_capacity: parseBool(row['would_expand_to_explicit_capacity']),
    would_expand_to_process_chain: parseBool(row['would_expand_to_process_chain']),
  };
}

function validateMethodYearReferences(
  methodYears: MethodYear[],
  methodsByRoleAndId: Map<string, Method>,
  sourceIds: Set<string>,
  assumptionIds: Set<string>,
): void {
  for (const row of methodYears) {
    const key = `${row.role_id}::${row.representation_id}::${row.method_id}`;
    if (!methodsByRoleAndId.has(key)) {
      throw new Error(`Missing method row for ${key} referenced by ${row.year}`);
    }
    requireKnownIds(row.source_ids, sourceIds, `${key}.${row.year}.source_ids`, 'source_id');
    requireKnownIds(row.assumption_ids, assumptionIds, `${key}.${row.year}.assumption_ids`, 'assumption_id');
  }
}

function buildSystemStructureGroups(roles: RoleMetadata[]): SystemStructureGroupRow[] {
  const byId = new Map<string, SystemStructureGroupRow>();
  for (const role of roles) {
    if (!byId.has(role.topology_area_id)) {
      byId.set(role.topology_area_id, {
        group_id: role.topology_area_id,
        group_label: role.topology_area_label,
        display_order: byId.size * 10 + 10,
        notes: '',
      });
    }
  }

  return Array.from(byId.values());
}

function buildSystemStructureMembers(
  roles: RoleMetadata[],
  appProjectionByRoleId: Map<string, RoleAppProjection>,
): SystemStructureMemberRow[] {
  return roles.map((role, index) => ({
    group_id: role.topology_area_id,
    family_id: appProjectionByRoleId.get(role.role_id)?.appOutputId ?? role.role_id,
    display_order: index * 10 + 10,
    notes: '',
  }));
}

function buildRolePresentationMetadata(
  roles: RoleMetadata[],
  appProjectionByRoleId: Map<string, RoleAppProjection>,
  reportingAllocations: ReportingAllocation[],
): RolePresentationMetadata[] {
  const allocationsByRoleId = reportingAllocations.reduce<Map<string, ReportingAllocation[]>>((result, allocation) => {
    const rows = result.get(allocation.role_id) ?? [];
    rows.push(allocation);
    result.set(allocation.role_id, rows);
    return result;
  }, new Map<string, ReportingAllocation[]>());

  return roles.map((role) => {
    const projection = appProjectionByRoleId.get(role.role_id);
    const appOutputId = projection?.appOutputId ?? role.role_id;
    return {
      role_id: role.role_id,
      role_label: role.role_label,
      topology_area_id: role.topology_area_id,
      topology_area_label: role.topology_area_label,
      output_id: appOutputId,
      region: 'Australia',
      output_role: outputRoleFromRole(role),
      output_unit: role.output_unit,
      output_quantity_basis: role.description,
      default_method_id: projection?.defaultMethodId ?? '',
      role_kind: role.role_kind,
      balance_type: role.balance_type,
      coverage_obligation: role.coverage_obligation,
      reporting_allocations: allocationsByRoleId.get(role.role_id) ?? [],
      notes: role.notes,
    };
  });
}

function methodOptionCode(method: Method): string {
  return `${method.method_kind === 'residual' ? 'R' : 'O'}${method.sort_order}`;
}

function buildResolvedMethodYearRows(
  methodYears: MethodYear[],
  rolesById: Map<string, RoleMetadata>,
  methodsByRoleAndId: Map<string, Method>,
  appProjectionByRoleId: Map<string, RoleAppProjection>,
  reportingAllocations: ReportingAllocation[],
): ResolvedMethodYearRow[] {
  const allocationsByRoleId = reportingAllocations.reduce<Map<string, ReportingAllocation[]>>((result, allocation) => {
    const rows = result.get(allocation.role_id) ?? [];
    rows.push(allocation);
    result.set(allocation.role_id, rows);
    return result;
  }, new Map<string, ReportingAllocation[]>());

  return methodYears.map((row) => {
    const role = rolesById.get(row.role_id);
    const method = methodsByRoleAndId.get(`${row.role_id}::${row.representation_id}::${row.method_id}`);
    if (!role || !method) {
      throw new Error(`Cannot build app row for ${row.role_id}::${row.representation_id}::${row.method_id}`);
    }

    const projection = appProjectionByRoleId.get(row.role_id);
    const appOutputId = projection?.appOutputId ?? row.role_id;
    const optionCode = methodOptionCode(method);
    const energyCo2e = row.energy_emissions_by_pollutant.find((entry) => entry.pollutant === 'CO2e')?.value ?? null;
    const processCo2e = row.process_emissions_by_pollutant.find((entry) => entry.pollutant === 'CO2e')?.value ?? null;

    return {
      ...row,
      method_kind: method.method_kind,
      method_label: method.method_label,
      method_description: method.method_description,
      role_kind: role.role_kind,
      balance_type: role.balance_type,
      output_id: appOutputId,
      role_label: role.role_label,
      topology_area_id: role.topology_area_id,
      topology_area_label: role.topology_area_label,
      parent_role_id: role.parent_role_id,
      coverage_obligation: role.coverage_obligation,
      default_representation_kind: role.default_representation_kind,
      reporting_allocations: allocationsByRoleId.get(row.role_id) ?? [],
      region: 'Australia',
      output_unit: role.output_unit,
      output_quantity_basis: role.description,
      energy_co2e: energyCo2e,
      process_co2e: processCo2e,
      method_stage_family: method.method_kind,
      method_stage_rank: method.sort_order,
      method_stage_code: method.method_kind,
      method_sort_key: `${appOutputId}:${String(method.sort_order).padStart(3, '0')}:${row.method_id}`,
      method_label_standardized: method.method_label,
      is_default_incumbent_2025: row.year === 2025 && row.method_id === projection?.defaultMethodId,
      method_option_rank: method.sort_order,
      method_option_code: optionCode,
      method_option_label: optionCode,
      family_id: appOutputId,
      family_resolution: role.role_kind === 'residual' ? 'residual_stub' : 'modeled',
      coverage_scope_id: row.role_id,
      coverage_scope_label: role.role_label,
      sector: (projection?.reportingAllocation?.sector ?? role.topology_area_id),
      subsector: (projection?.reportingAllocation?.subsector ?? appOutputId),
      service_or_output_name: appOutputId,
      state_id: row.method_id,
      state_label: method.method_label,
      state_description: method.method_description,
      state_stage_family: method.method_kind,
      state_stage_rank: method.sort_order,
      state_stage_code: method.method_kind,
      state_sort_key: `${appOutputId}:${String(method.sort_order).padStart(3, '0')}:${row.method_id}`,
      state_label_standardized: method.method_label,
      state_option_rank: method.sort_order,
      state_option_code: optionCode,
      state_option_label: optionCode,
      balance_tuning_flag: false,
      balance_tuning_note: '',
      benchmark_balance_note: '',
    };
  });
}

function validateEfficiencyReferences(
  roleId: string,
  artifactLabel: string,
  applicableMethodIds: string[],
  sourceIds: string[],
  assumptionIds: string[],
  context: EfficiencyArtifactValidationContext,
): void {
  const methodIds = context.methodIdsByRoleId.get(roleId);
  if (!methodIds) {
    throw new Error(`Unknown role_id ${JSON.stringify(roleId)} referenced in ${artifactLabel}`);
  }

  requireKnownIds(applicableMethodIds, methodIds, `${artifactLabel}.applicable_method_ids`, 'method_id');
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

function roleIdFromPath(path: string, suffix: string): string {
  const roleId = path.slice('roles/'.length, -suffix.length).split('/')[0];
  if (!roleId) {
    throw new Error(`Could not infer role_id from ${path}`);
  }

  return roleId;
}

function toAutonomousEfficiencyTrack(
  path: string,
  row: Record<string, string>,
  context: EfficiencyArtifactValidationContext,
): AutonomousEfficiencyTrack {
  const expectedRoleId = roleIdFromPath(path, '/autonomous_efficiency_tracks.csv');
  const role_id = parseRequiredString(row['role_id'], `${path}.role_id`);
  if (role_id !== expectedRoleId) {
    throw new Error(
      `${path} row role_id ${JSON.stringify(role_id)} must match folder role_id ${JSON.stringify(expectedRoleId)}`,
    );
  }

  const track_id = parseRequiredString(row['track_id'], `${path}.track_id`);
  const artifactLabel = `${path}:${track_id}`;
  const applicable_method_ids = parseJsonStringArrayStrict(
    row['applicable_method_ids'],
    `${artifactLabel}.applicable_method_ids`,
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
    role_id,
    artifactLabel,
    applicable_method_ids,
    source_ids,
    assumption_ids,
    context,
  );

  const family_id = context.appProjectionByRoleId.get(role_id)?.appOutputId ?? role_id;
  return {
    role_id,
    family_id,
    track_id,
    year: parseMilestoneYear(row['year'], `${artifactLabel}.year`),
    track_label: parseRequiredString(row['track_label'], `${artifactLabel}.track_label`),
    track_description: parseRequiredString(
      row['track_description'],
      `${artifactLabel}.track_description`,
    ),
    applicable_method_ids,
    applicable_state_ids: applicable_method_ids,
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
  const expectedRoleId = roleIdFromPath(path, '/efficiency_packages.csv');
  const role_id = parseRequiredString(row['role_id'], `${path}.role_id`);
  if (role_id !== expectedRoleId) {
    throw new Error(
      `${path} row role_id ${JSON.stringify(role_id)} must match folder role_id ${JSON.stringify(expectedRoleId)}`,
    );
  }

  const package_id = parseRequiredString(row['package_id'], `${path}.package_id`);
  const artifactLabel = `${path}:${package_id}`;
  const applicable_method_ids = parseJsonStringArrayStrict(
    row['applicable_method_ids'],
    `${artifactLabel}.applicable_method_ids`,
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
    role_id,
    artifactLabel,
    applicable_method_ids,
    source_ids,
    assumption_ids,
    context,
  );

  const family_id = context.appProjectionByRoleId.get(role_id)?.appOutputId ?? role_id;
  return {
    role_id,
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
    applicable_method_ids,
    applicable_state_ids: applicable_method_ids,
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
    'roles/',
    '/autonomous_efficiency_tracks.csv',
  ).flatMap((path) => parseCsv(textFiles[path] ?? '').map((row) => toAutonomousEfficiencyTrack(path, row, context)));

  const efficiencyPackages = listTextFiles(
    textFiles,
    'roles/',
    '/efficiency_packages.csv',
  ).flatMap((path) => parseCsv(textFiles[path] ?? '').map((row) => toEfficiencyPackage(path, row, context)));

  return {
    autonomousEfficiencyTracks,
    efficiencyPackages,
  };
}

function buildBaselineAnchors(
  roles: RoleMetadata[],
  roleDemands: RoleDemand[],
  appConfig: AppConfigRegistry,
  appProjectionByRoleId: Map<string, RoleAppProjection>,
): Record<string, BaselineActivityAnchor> {
  const anchors: Record<string, BaselineActivityAnchor> = {};
  const roleDemandById = new Map(roleDemands.map((row) => [row.role_id, row]));

  for (const role of roles) {
    const outputRole = outputRoleFromRole(role);
    if (outputRole === 'endogenous_supply_commodity' || role.coverage_obligation === 'required_decomposition_child') {
      continue;
    }

    const demand = roleDemandById.get(role.role_id);
    if (!demand) {
      continue;
    }

    const outputId = appProjectionByRoleId.get(role.role_id)?.appOutputId ?? role.role_id;
    anchors[outputId] = {
      output_role: (appConfig.output_roles[outputId]?.output_role ?? outputRole) as BaselineActivityAnchor['output_role'],
      anchor_kind: 'service_demand',
      anchor_year: demand.anchor_year,
      value: demand.anchor_value,
      unit: demand.unit,
      provenance_note: `${demand.source_role} - ${demand.coverage_note}`,
    };
  }

  return anchors;
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
  roleId: string | null;
} {
  const separatorIndex = curveId.indexOf('__');
  if (separatorIndex >= 0) {
    return {
      presetId: curveId.slice(0, separatorIndex),
      roleId: curveId.slice(separatorIndex + 2),
    };
  }

  return {
    presetId: curveId,
    roleId: null,
  };
}

function normalizePresetLabel(label: string): string {
  return label.split(' - ')[0]?.split(' — ')[0] ?? label;
}

function normalizePresetDescription(description: string): string {
  return description.replace(/\s+Applies to .*$/, '');
}

function buildDemandGrowthPresets(
  rows: DemandGrowthCurveRow[],
  appProjectionByRoleId: Map<string, RoleAppProjection>,
): Record<string, DemandGrowthPreset> {
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
    if (parsedId.roleId) {
      const outputId = appProjectionByRoleId.get(parsedId.roleId)?.appOutputId ?? parsedId.roleId;
      preset.milestone_multipliers_by_output![outputId] = row.values_by_year;
      if (rate != null) {
        preset.annual_growth_rates_pct_per_year[outputId] = rate;
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

function buildOutputRoles(
  appConfig: AppConfigRegistry,
  roles: RoleMetadata[],
  appProjectionByRoleId: Map<string, RoleAppProjection>,
): AppConfigRegistry['output_roles'] {
  const outputRoles = { ...appConfig.output_roles };

  for (const role of roles) {
    const projection = appProjectionByRoleId.get(role.role_id);
    const outputId = projection?.appOutputId ?? role.role_id;
    if (outputRoles[outputId]) {
      continue;
    }

    outputRoles[outputId] = {
      output_role: outputRoleFromRole(role),
      display_label: role.role_label,
      display_group: role.topology_area_label,
      display_group_order: 900,
      display_order: 900,
      participates_in_commodity_balance: role.balance_type === 'commodity_supply',
      demand_required: role.coverage_obligation !== 'required_decomposition_child'
        && (role.balance_type === 'service_demand' || role.balance_type === 'residual_accounting'),
      default_control_mode: role.balance_type === 'commodity_supply' ? 'externalized' : 'optimize',
      allowed_control_modes: role.balance_type === 'commodity_supply'
        ? ['optimize', 'externalized']
        : ['optimize'],
      explanation_group: role.topology_area_id,
    };
  }

  return outputRoles;
}

function toServiceDemandAnchorRow(
  row: Record<string, string>,
  appProjectionByRoleId: Map<string, RoleAppProjection>,
): ServiceDemandAnchorRow {
  const roleId = row['role_id'];
  const outputId = appProjectionByRoleId.get(roleId)?.appOutputId ?? roleId;
  return {
    anchor_type: row['row_type'] as ServiceDemandAnchorType,
    service_or_output_name: outputId,
    default_2025_state_id: row['default_method_id'],
    default_2025_state_option_code: row['default_method_option_code'],
    default_2025_state_option_label: row['default_method_option_code'],
    quantity_2025: parseNum(row['quantity_2025']),
    unit: row['unit'],
    anchor_status: row['anchor_status'],
    source_family: row['source_role'],
    coverage_note: row['coverage_note'],
    implied_gross_input_energy_pj_if_default: null,
    implied_benchmark_final_energy_pj_if_default: null,
    implied_energy_emissions_mtco2e_if_default: null,
    implied_process_emissions_mtco2e_if_default: null,
    implied_total_emissions_mtco2e_if_default: null,
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

function emptyPackage(appConfig: AppConfigRegistry): PackageData {
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
    roleMetadata: [],
    representations: [],
    roleDecompositionEdges: [],
    reportingAllocations: [],
    methods: [],
    methodYears: [],
    roleDemands: [],
    rolePresentationMetadata: [],
    systemStructureGroups: [],
    systemStructureMembers: [],
    resolvedMethodYears: [],
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

export function loadPackage(): PackageData {
  const appConfig = loadAppConfig();
  if (Object.keys(packageTextFiles).length === 0) {
    return emptyPackage(appConfig);
  }

  const roleMetadata = parseCsv(requirePackageFile('shared/roles.csv')).map(toRoleMetadata);
  const representations = parseCsv(requirePackageFile('shared/representations.csv')).map(toRoleRepresentation);
  const roleDecompositionEdges = parseCsv(
    requirePackageFile('shared/role_decomposition_edges.csv'),
  ).map(toRoleDecompositionEdge);
  const reportingAllocations = parseCsv(
    requirePackageFile('shared/reporting_allocations.csv'),
  ).map(toReportingAllocation);

  const sourceIds = new Set(
    parseCsv(requirePackageFile('shared/source_ledger.csv')).map((row) => row['source_id']),
  );
  const assumptionIds = new Set(
    parseCsv(requirePackageFile('shared/assumptions_ledger.csv')).map((row) => row['assumption_id']),
  );

  const rolesById = new Map(roleMetadata.map((role) => [role.role_id, role]));
  const methods = listPackageFiles('roles/', '/methods.csv').flatMap((path) =>
    parseCsv(requirePackageFile(path)).map((row) => toMethod(path, row)),
  );
  validateMethodReferences(methods, sourceIds, assumptionIds);

  const methodsByRoleAndId = new Map(
    methods.map((method) => [`${method.role_id}::${method.representation_id}::${method.method_id}`, method]),
  );
  const methodIdsByRoleId = methods.reduce<Map<string, Set<string>>>((result, method) => {
    const methodIds = result.get(method.role_id) ?? new Set<string>();
    methodIds.add(method.method_id);
    result.set(method.role_id, methodIds);
    return result;
  }, new Map<string, Set<string>>());

  const appProjectionByRoleId = buildRoleAppProjection(
    roleMetadata,
    methods,
    reportingAllocations,
    appConfig,
  );
  appConfig.output_roles = buildOutputRoles(appConfig, roleMetadata, appProjectionByRoleId);

  const methodYears = listPackageFiles('roles/', '/method_years.csv').flatMap((path) =>
    parseCsv(requirePackageFile(path)).map((row) => toMethodYear(path, row)),
  );
  validateMethodYearReferences(methodYears, methodsByRoleAndId, sourceIds, assumptionIds);
  const resolvedMethodYears = buildResolvedMethodYearRows(
    methodYears,
    rolesById,
    methodsByRoleAndId,
    appProjectionByRoleId,
    reportingAllocations,
  );

  const roleDemands = listPackageFiles('roles/', '/demand.csv').map((path) => {
    const rows = parseCsv(requirePackageFile(path));
    return toRoleDemand(rows[0] ?? {});
  });
  const demandGrowthCurves = parseCsv(requirePackageFile('shared/demand_growth_curves.csv')).map(toDemandGrowthCurveRow);
  const commodityPriceCurves = parseCsv(requirePackageFile('shared/commodity_price_curves.csv')).map(toCommodityPriceCurveRow);
  const carbonPriceCurves = parseCsv(requirePackageFile('shared/carbon_price_curves.csv')).map(toCarbonPriceCurveRow);

  appConfig.baseline_activity_anchors = buildBaselineAnchors(
    roleMetadata,
    roleDemands,
    appConfig,
    appProjectionByRoleId,
  );
  appConfig.demand_growth_presets = buildDemandGrowthPresets(demandGrowthCurves, appProjectionByRoleId);
  appConfig.commodity_price_presets = buildCommodityPricePresets(commodityPriceCurves);
  appConfig.carbon_price_presets = buildCarbonPricePresets(carbonPriceCurves);

  const { autonomousEfficiencyTracks, efficiencyPackages } = loadEfficiencyArtifacts(packageTextFiles, {
    sourceIds,
    assumptionIds,
    methodIdsByRoleId,
    appProjectionByRoleId,
  });

  const serviceDemandAnchors2025 = parseCsv(
    requirePackageFile('validation/baseline_activity_balance.csv'),
  ).map((row) => toServiceDemandAnchorRow(row, appProjectionByRoleId));
  const residualOverlays2025: ResidualOverlayRow[] = [];
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
    resolvedMethodYears,
  );

  return {
    roleMetadata,
    representations,
    roleDecompositionEdges,
    reportingAllocations,
    methods,
    methodYears,
    roleDemands,
    rolePresentationMetadata: buildRolePresentationMetadata(
      roleMetadata,
      appProjectionByRoleId,
      reportingAllocations,
    ),
    systemStructureGroups: buildSystemStructureGroups(roleMetadata),
    systemStructureMembers: buildSystemStructureMembers(roleMetadata, appProjectionByRoleId),
    resolvedMethodYears,
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
