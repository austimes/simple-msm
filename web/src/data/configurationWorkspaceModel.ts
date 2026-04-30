import type {
  AppConfigRegistry,
  ConfigurationDocument,
  ConfigurationYearKey,
  FamilyResolution,
  MethodKind,
  PriceLevel,
  RepresentationKind,
  ResolvedMethodYearRow,
} from './types.ts';
import { derivePathwayMethodIds, derivePathwayMethodIdsForRole } from './pathwaySemantics.ts';

export interface RoleMethodCatalogEntry {
  methodLabel: string;
  roleId: string;
  representationId: string;
  methodId: string;
  methodKind: MethodKind;
}

interface RoleMethodCatalogSortEntry extends RoleMethodCatalogEntry {
  methodSortKey: string;
  methodOptionRank: number | null;
}

export interface RoleNodeCatalogEntry {
  outputId: string;
  outputLabel: string;
  roleId: string;
  roleLabel: string;
  parentRoleId: string | null;
  defaultRepresentationKind: RepresentationKind;
  coverageObligation: ResolvedMethodYearRow['coverage_obligation'];
  methods: RoleMethodCatalogEntry[];
  childRoles: RoleNodeCatalogEntry[];
}

export interface RoleAreaCatalogEntry {
  areaId: string;
  areaLabel: string;
  roles: RoleNodeCatalogEntry[];
}

export type RoleMethodNavigationEntry = RoleMethodCatalogEntry;

export interface RoleNodeNavigationEntry extends Omit<RoleNodeCatalogEntry, 'methods' | 'childRoles'> {
  subsector: string;
  familyResolution?: FamilyResolution;
  coverageScopeLabel?: string;
  states: RoleMethodNavigationEntry[];
  childRoles: RoleNodeNavigationEntry[];
}

export interface RoleAreaNavigationEntry {
  sector: string;
  subsectors: RoleNodeNavigationEntry[];
}

function resolveMethodCatalogLabel(row: ResolvedMethodYearRow): string {
  const preferredLabel = (row.method_label_standardized ?? row.state_label_standardized ?? '').trim()
    || (row.method_option_label ?? row.state_option_label ?? '').trim()
    || (row.method_label ?? row.state_label ?? '').trim();

  return preferredLabel || row.method_id || row.state_id;
}

function compareMethodSortKey(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  return left.localeCompare(right);
}

function compareMethodOptionRank(left: number | null, right: number | null): number {
  if (left == null || right == null) {
    return 0;
  }

  return left - right;
}

function compareMethodCatalogEntries(left: RoleMethodCatalogSortEntry, right: RoleMethodCatalogSortEntry): number {
  return (
    compareMethodSortKey(left.methodSortKey, right.methodSortKey)
    || compareMethodOptionRank(left.methodOptionRank, right.methodOptionRank)
    || left.methodLabel.localeCompare(right.methodLabel)
    || left.methodId.localeCompare(right.methodId)
  );
}

export function buildRoleCatalog(
  resolvedMethodYears: ResolvedMethodYearRow[],
  appConfig: AppConfigRegistry,
): RoleAreaCatalogEntry[] {
  const methodsByRole = new Map<string, Map<string, RoleMethodCatalogSortEntry>>();
  const firstRowByRole = new Map<string, ResolvedMethodYearRow>();

  for (const row of resolvedMethodYears) {
    const roleId = row.role_id;
    const representationId = row.representation_id;
    const methodId = row.method_id;
    const methodKind = row.method_kind;
    const catalogKey = `${representationId}::${methodId}`;
    const roleMethods = methodsByRole.get(roleId) ?? new Map<string, RoleMethodCatalogSortEntry>();
    if (!roleMethods.has(catalogKey)) {
      roleMethods.set(catalogKey, {
        methodLabel: resolveMethodCatalogLabel(row),
        roleId,
        representationId,
        methodId,
        methodKind,
        methodSortKey: row.method_sort_key.trim(),
        methodOptionRank: row.method_option_rank,
      });
    }
    methodsByRole.set(roleId, roleMethods);
    if (!firstRowByRole.has(roleId)) {
      firstRowByRole.set(roleId, row);
    }
  }

  const nodeByRoleId = new Map<string, RoleNodeCatalogEntry>();
  for (const [roleId, row] of firstRowByRole) {
    const outputLabel = appConfig.output_roles[row.output_id]?.display_label ?? row.output_id;
    nodeByRoleId.set(roleId, {
      outputId: row.output_id,
      outputLabel,
      roleId,
      roleLabel: row.role_label,
      parentRoleId: row.parent_role_id,
      defaultRepresentationKind: row.default_representation_kind,
      coverageObligation: row.coverage_obligation,
      methods: Array.from(methodsByRole.get(roleId)?.values() ?? [])
        .sort(compareMethodCatalogEntries)
        .map(({ methodLabel, roleId, representationId, methodId, methodKind }) => ({
          methodLabel,
          roleId,
          representationId,
          methodId,
          methodKind,
        })),
      childRoles: [],
    });
  }

  for (const node of nodeByRoleId.values()) {
    if (!node.parentRoleId) {
      continue;
    }
    nodeByRoleId.get(node.parentRoleId)?.childRoles.push(node);
  }

  const areaMap = new Map<string, RoleAreaCatalogEntry>();
  for (const [roleId, node] of nodeByRoleId) {
    if (node.parentRoleId && nodeByRoleId.has(node.parentRoleId)) {
      continue;
    }
    const row = firstRowByRole.get(roleId);
    const areaId = row?.topology_area_id ?? 'other';
    const area = areaMap.get(areaId) ?? {
      areaId,
      areaLabel: row?.topology_area_label ?? areaId,
      roles: [],
    };
    area.roles.push(node);
    areaMap.set(areaId, area);
  }

  for (const area of areaMap.values()) {
    area.roles.sort((left, right) => left.roleLabel.localeCompare(right.roleLabel));
  }

  return Array.from(areaMap.values())
    .sort((left, right) => left.areaLabel.localeCompare(right.areaLabel));
}

export function buildRoleAreaNavigationCatalog(
  resolvedMethodYears: ResolvedMethodYearRow[],
  appConfig: AppConfigRegistry,
): RoleAreaNavigationEntry[] {
  const sectors = new Map<string, Map<string, RoleNodeNavigationEntry & { sortRows: RoleMethodCatalogSortEntry[] }>>();

  for (const row of resolvedMethodYears) {
    const outputId = row.output_id ?? row.service_or_output_name;
    const roleId = row.role_id ?? outputId;
    const representationId = row.representation_id ?? `${roleId}__pathway_bundle`;
    const methodId = row.method_id ?? row.state_id;
    if (!outputId || !methodId) {
      continue;
    }

    const sector = row.sector ?? row.topology_area_id ?? 'other';
    const subsector = row.subsector ?? outputId;
    const sectorMap = sectors.get(sector) ?? new Map<string, RoleNodeNavigationEntry & { sortRows: RoleMethodCatalogSortEntry[] }>();
    const entry = sectorMap.get(subsector) ?? {
      outputId,
      outputLabel: appConfig.output_roles[outputId]?.display_label
        ?? row.coverage_scope_label
        ?? row.role_label
        ?? outputId,
      roleId,
      roleLabel: row.role_label ?? row.coverage_scope_label ?? outputId,
      parentRoleId: row.parent_role_id ?? null,
      defaultRepresentationKind: row.default_representation_kind ?? 'pathway_bundle',
      coverageObligation: row.coverage_obligation ?? 'required_top_level',
      subsector,
      familyResolution: row.family_resolution,
      coverageScopeLabel: row.coverage_scope_label ?? row.role_label ?? outputId,
      states: [],
      childRoles: [],
      sortRows: [],
    };

    if (!entry.sortRows.some((state) => state.methodId === methodId)) {
      entry.sortRows.push({
        methodLabel: resolveMethodCatalogLabel(row),
        roleId,
        representationId,
        methodId,
        methodKind: row.method_kind ?? 'pathway',
        methodSortKey: row.method_sort_key ?? row.state_sort_key ?? '',
        methodOptionRank: row.method_option_rank ?? row.state_option_rank ?? null,
      });
    }

    sectorMap.set(subsector, entry);
    sectors.set(sector, sectorMap);
  }

  return Array.from(sectors.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sector, subsectorMap]) => ({
      sector,
      subsectors: Array.from(subsectorMap.values())
        .map(({ sortRows, ...entry }) => ({
          ...entry,
          states: sortRows
            .sort(compareMethodCatalogEntries)
            .map(({ methodLabel, roleId, representationId, methodId, methodKind }) => ({
              methodLabel,
              roleId,
              representationId,
              methodId,
              methodKind,
            })),
        }))
        .sort((left, right) => left.outputLabel.localeCompare(right.outputLabel)),
    }));
}

export function getActiveMethodIds(
  configuration: ConfigurationDocument,
  roleId: string,
  allMethodIds: string[],
): string[] {
  const legacyControls = (configuration as unknown as Record<string, Record<string, unknown> | undefined>)[
    ['service', 'controls'].join('_')
  ];
  const legacyControl = legacyControls?.[roleId];
  if (legacyControl && typeof legacyControl === 'object' && !Array.isArray(legacyControl)) {
    const legacyControlRecord = legacyControl as Record<string, unknown>;
    return derivePathwayMethodIds(allMethodIds, {
      mode: legacyControlRecord.mode as NonNullable<ConfigurationDocument['role_controls']>[string]['mode'],
      activeMethodIds: legacyControlRecord[['active', 'state', 'ids'].join('_')] as string[] | null | undefined,
    }).activeMethodIds;
  }

  return derivePathwayMethodIdsForRole(configuration, roleId, allMethodIds).activeMethodIds;
}

export function getActiveDemandPreset(
  configuration: ConfigurationDocument,
  appConfig: AppConfigRegistry,
): string | null {
  const { mode, preset_id } = configuration.demand_generation;

  if (mode === 'manual_table' || !preset_id) {
    return null;
  }

  if (!appConfig.demand_growth_presets[preset_id]) {
    return null;
  }

  return preset_id;
}

export function getCommodityPriceLevel(
  configuration: ConfigurationDocument,
  commodityId: string,
): PriceLevel {
  return configuration.commodity_pricing.selections_by_commodity?.[commodityId] ?? 'medium';
}

export function getActiveCarbonPricePreset(
  configuration: ConfigurationDocument,
  appConfig: AppConfigRegistry,
): string | null {
  for (const [presetId, preset] of Object.entries(appConfig.carbon_price_presets)) {
    const match = Object.entries(preset.values_by_year).every(
      ([year, value]) => configuration.carbon_price[year as ConfigurationYearKey] === value,
    );
    if (match) return presetId;
  }
  return null;
}
