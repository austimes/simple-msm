import type {
  ActivationClass,
  BalanceType,
  EmissionsImportanceBand,
  PackageData,
  ReportingAllocation,
  RepresentationKind,
  RoleMetric,
} from './types.ts';

export interface RoleLibraryMethod {
  roleId: string;
  representationId: string;
  methodId: string;
  representationKind: RepresentationKind;
  label: string;
  description: string;
  sortOrder: number;
  reportingAllocations: ReportingAllocation[];
  sourceIds: string[];
  assumptionIds: string[];
  confidenceRating: string;
}

export interface RoleLibraryRepresentation {
  roleId: string;
  representationId: string;
  representationKind: RepresentationKind;
  label: string;
  description: string;
  isDefault: boolean;
  methods: RoleLibraryMethod[];
  childRoleIds: string[];
}

export interface RoleLibraryRole {
  roleId: string;
  label: string;
  description: string;
  topologyAreaId: string;
  topologyAreaLabel: string;
  parentRoleId: string | null;
  balanceType: BalanceType;
  outputUnit: string;
  activationClass: ActivationClass;
  defaultRepresentationKind: RepresentationKind;
  representations: RoleLibraryRepresentation[];
  childRoleIds: string[];
  reportingAllocations: ReportingAllocation[];
  emissionsImportanceBand: EmissionsImportanceBand;
  roleMetric: RoleMetric | null;
}

export type RoleLibraryGraphNodeKind = 'role' | 'representation' | 'method';

export interface RoleLibraryGraphNode {
  id: string;
  kind: RoleLibraryGraphNodeKind;
  roleId?: string;
  representationId?: string;
  methodId?: string;
  label: string;
  meta: string;
  expanded: boolean;
  isDefault?: boolean;
  activationClass?: ActivationClass;
  balanceType?: BalanceType;
  representationKind?: RepresentationKind;
  emissionsImportanceBand?: EmissionsImportanceBand;
  representationCount?: number;
  methodCount?: number;
}

export interface RoleLibraryGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  edgeKind?: 'representation' | 'method' | 'decomposition_child';
}

export interface RoleLibraryGraphData {
  nodes: RoleLibraryGraphNode[];
  edges: RoleLibraryGraphEdge[];
}

export interface RoleLibraryModel {
  roles: RoleLibraryRole[];
  topLevelRoles: RoleLibraryRole[];
  roleById: Map<string, RoleLibraryRole>;
  representationById: Map<string, RoleLibraryRepresentation>;
  methodById: Map<string, RoleLibraryMethod>;
}

export interface RoleLibraryGraphFilters {
  search?: string;
  activationClass?: string;
  balanceType?: string;
  representationKind?: string;
}

function compareLabels(left: { label: string; roleId?: string }, right: { label: string; roleId?: string }): number {
  return left.label.localeCompare(right.label) || (left.roleId ?? '').localeCompare(right.roleId ?? '');
}

function roleNodeId(roleId: string): string {
  return `role:${roleId}`;
}

function representationNodeId(representationId: string): string {
  return `representation:${representationId}`;
}

function methodNodeId(roleId: string, representationId: string, methodId: string): string {
  return `method:${roleId}:${representationId}:${methodId}`;
}

function buildMethodKey(roleId: string, representationId: string, methodId: string): string {
  return `${roleId}::${representationId}::${methodId}`;
}

function matchesRoleSearch(role: RoleLibraryRole, search: string): boolean {
  if (!search) {
    return true;
  }

  const haystack = [
    role.roleId,
    role.label,
    role.description,
    role.topologyAreaLabel,
    role.activationClass,
    role.balanceType,
    role.defaultRepresentationKind,
    ...role.representations.flatMap((representation) => [
      representation.representationId,
      representation.label,
      representation.description,
      representation.representationKind,
      ...representation.methods.flatMap((method) => [
        method.methodId,
        method.label,
        method.description,
        method.representationKind,
      ]),
    ]),
  ].join(' ').toLowerCase();

  return haystack.includes(search.toLowerCase());
}

export function buildRoleLibraryModel(pkg: Pick<
  PackageData,
  | 'roleMetadata'
  | 'roleMetrics'
  | 'representations'
  | 'methods'
  | 'roleDecompositionEdges'
  | 'reportingAllocations'
>): RoleLibraryModel {
  const reportingAllocationsByRoleId = pkg.reportingAllocations.reduce<Map<string, ReportingAllocation[]>>(
    (result, allocation) => {
      const rows = result.get(allocation.role_id) ?? [];
      rows.push(allocation);
      result.set(allocation.role_id, rows);
      return result;
    },
    new Map<string, ReportingAllocation[]>(),
  );
  const childRoleIdsByRepresentationId = pkg.roleDecompositionEdges.reduce<Map<string, string[]>>((result, edge) => {
    const ids = result.get(edge.parent_representation_id) ?? [];
    ids.push(edge.child_role_id);
    result.set(edge.parent_representation_id, ids);
    return result;
  }, new Map<string, string[]>());
  for (const ids of childRoleIdsByRepresentationId.values()) {
    ids.sort((left, right) => left.localeCompare(right));
  }

  const representationKindById = new Map(
    pkg.representations.map((representation) => [
      representation.representation_id,
      representation.representation_kind,
    ]),
  );
  const defaultRepresentationKindByRoleId = new Map<string, RepresentationKind>();
  for (const representation of pkg.representations) {
    if (representation.is_default) {
      defaultRepresentationKindByRoleId.set(representation.role_id, representation.representation_kind);
    }
  }

  const methodsByRepresentationId = new Map<string, RoleLibraryMethod[]>();
  const methodById = new Map<string, RoleLibraryMethod>();
  for (const method of pkg.methods) {
    const representationKind = representationKindById.get(method.representation_id);
    if (!representationKind) {
      throw new Error(
        `Method ${method.method_id} references unknown representation ${method.representation_id}.`,
      );
    }
    const row = {
      roleId: method.role_id,
      representationId: method.representation_id,
      methodId: method.method_id,
      representationKind,
      label: method.method_label,
      description: method.method_description,
      sortOrder: method.sort_order,
      reportingAllocations: reportingAllocationsByRoleId.get(method.role_id) ?? [],
      sourceIds: method.source_ids,
      assumptionIds: method.assumption_ids,
      confidenceRating: method.confidence_rating,
    } satisfies RoleLibraryMethod;
    const rows = methodsByRepresentationId.get(method.representation_id) ?? [];
    rows.push(row);
    methodsByRepresentationId.set(method.representation_id, rows);
    methodById.set(buildMethodKey(method.role_id, method.representation_id, method.method_id), row);
  }

  for (const rows of methodsByRepresentationId.values()) {
    rows.sort((left, right) =>
      left.sortOrder - right.sortOrder
      || left.label.localeCompare(right.label)
      || left.methodId.localeCompare(right.methodId),
    );
  }

  const representationsByRoleId = new Map<string, RoleLibraryRepresentation[]>();
  const representationById = new Map<string, RoleLibraryRepresentation>();
  for (const representation of pkg.representations) {
    const row = {
      roleId: representation.role_id,
      representationId: representation.representation_id,
      representationKind: representation.representation_kind,
      label: representation.representation_label,
      description: representation.description,
      isDefault: representation.is_default,
      methods: methodsByRepresentationId.get(representation.representation_id) ?? [],
      childRoleIds: childRoleIdsByRepresentationId.get(representation.representation_id) ?? [],
    } satisfies RoleLibraryRepresentation;
    const rows = representationsByRoleId.get(representation.role_id) ?? [];
    rows.push(row);
    representationsByRoleId.set(representation.role_id, rows);
    representationById.set(representation.representation_id, row);
  }

  for (const rows of representationsByRoleId.values()) {
    rows.sort((left, right) =>
      Number(right.isDefault) - Number(left.isDefault)
      || left.label.localeCompare(right.label)
      || left.representationId.localeCompare(right.representationId),
    );
  }

  const childRoleIdsByRoleId = pkg.roleDecompositionEdges.reduce<Map<string, string[]>>((result, edge) => {
    const ids = result.get(edge.parent_role_id) ?? [];
    ids.push(edge.child_role_id);
    result.set(edge.parent_role_id, ids);
    return result;
  }, new Map<string, string[]>());
  const roleMetricByRoleId = new Map(pkg.roleMetrics.map((metric) => [metric.role_id, metric]));

  const roles = pkg.roleMetadata.map((role) => {
    const defaultRepresentationKind = defaultRepresentationKindByRoleId.get(role.role_id);
    if (!defaultRepresentationKind) {
      throw new Error(
        `Role ${JSON.stringify(role.role_id)} is missing a default representation in shared/representations.csv.`,
      );
    }
    return {
      roleId: role.role_id,
      label: role.role_label,
      description: role.description,
      topologyAreaId: role.topology_area_id,
      topologyAreaLabel: role.topology_area_label,
      parentRoleId: role.parent_role_id,
      balanceType: role.balance_type,
      outputUnit: role.output_unit,
      activationClass: role.activation_class,
      defaultRepresentationKind,
      representations: representationsByRoleId.get(role.role_id) ?? [],
      childRoleIds: childRoleIdsByRoleId.get(role.role_id) ?? [],
      reportingAllocations: reportingAllocationsByRoleId.get(role.role_id) ?? [],
      emissionsImportanceBand: roleMetricByRoleId.get(role.role_id)?.emissions_importance_band ?? 'unknown',
      roleMetric: roleMetricByRoleId.get(role.role_id) ?? null,
    } satisfies RoleLibraryRole;
  }).sort(compareLabels);
  const roleById = new Map(roles.map((role) => [role.roleId, role]));
  const topLevelRoles = roles
    .filter((role) => role.activationClass === 'top_level')
    .sort(compareLabels);

  return {
    roles,
    topLevelRoles,
    roleById,
    representationById,
    methodById,
  };
}

export function buildRoleLibraryGraphData(
  model: RoleLibraryModel,
  expandedNodeIds: ReadonlySet<string>,
  filters: RoleLibraryGraphFilters = {},
): RoleLibraryGraphData {
  const nodes: RoleLibraryGraphNode[] = [];
  const edges: RoleLibraryGraphEdge[] = [];
  const visibleNodeIds = new Set<string>();
  const search = filters.search?.trim() ?? '';
  const matchingRoleIds = new Set(model.roles
    .filter((role) =>
      matchesRoleSearch(role, search)
      && (!filters.activationClass || role.activationClass === filters.activationClass)
      && (!filters.balanceType || role.balanceType === filters.balanceType)
      && (!filters.representationKind || role.defaultRepresentationKind === filters.representationKind),
    )
    .map((role) => role.roleId));

  function roleSubtreeContainsMatch(role: RoleLibraryRole): boolean {
    if (matchingRoleIds.has(role.roleId)) {
      return true;
    }
    for (const representation of role.representations) {
      if (representation.representationKind === 'role_decomposition') {
        for (const childRoleId of representation.childRoleIds) {
          const childRole = model.roleById.get(childRoleId);
          if (childRole && roleSubtreeContainsMatch(childRole)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function addRole(role: RoleLibraryRole): void {
    const id = roleNodeId(role.roleId);
    if (visibleNodeIds.has(id)) {
      return;
    }
    const expanded = expandedNodeIds.has(id);
    const methodCount = role.representations.reduce((sum, representation) => sum + representation.methods.length, 0);
    nodes.push({
      id,
      kind: 'role',
      roleId: role.roleId,
      label: role.label,
      meta: `${role.defaultRepresentationKind.replaceAll('_', ' ')} · ${role.balanceType.replaceAll('_', ' ')}`,
      expanded,
      activationClass: role.activationClass,
      balanceType: role.balanceType,
      representationKind: role.defaultRepresentationKind,
      representationCount: role.representations.length,
      methodCount,
      emissionsImportanceBand: role.emissionsImportanceBand,
    });
    visibleNodeIds.add(id);

    if (!expanded) {
      return;
    }

    for (const representation of role.representations) {
      addRepresentation(role, representation);
      edges.push({
        id: `${id}->${representationNodeId(representation.representationId)}`,
        source: id,
        target: representationNodeId(representation.representationId),
        edgeKind: 'representation',
      });
    }
  }

  function addRepresentation(role: RoleLibraryRole, representation: RoleLibraryRepresentation): void {
    const id = representationNodeId(representation.representationId);
    const expanded = expandedNodeIds.has(id);
    nodes.push({
      id,
      kind: 'representation',
      roleId: role.roleId,
      representationId: representation.representationId,
      label: representation.label,
      meta: representation.representationKind.replaceAll('_', ' '),
      expanded,
      isDefault: representation.isDefault,
      representationKind: representation.representationKind,
      methodCount: representation.methods.length,
    });
    visibleNodeIds.add(id);

    if (!expanded) {
      return;
    }

    if (representation.representationKind === 'role_decomposition') {
      for (const childRoleId of representation.childRoleIds) {
        const childRole = model.roleById.get(childRoleId);
        if (!childRole) {
          continue;
        }
        addRole(childRole);
        edges.push({
          id: `${id}->${roleNodeId(childRoleId)}`,
          source: id,
          target: roleNodeId(childRoleId),
          label: 'child role',
          edgeKind: 'decomposition_child',
        });
      }
      return;
    }

    for (const method of representation.methods) {
      const methodId = methodNodeId(role.roleId, representation.representationId, method.methodId);
      nodes.push({
        id: methodId,
        kind: 'method',
        roleId: role.roleId,
        representationId: representation.representationId,
        methodId: method.methodId,
        label: method.label,
        meta: method.representationKind,
        expanded: false,
        representationKind: method.representationKind,
      });
      edges.push({
        id: `${id}->${methodId}`,
        source: id,
        target: methodId,
        edgeKind: 'method',
      });
    }
  }

  for (const role of model.topLevelRoles) {
    if (roleSubtreeContainsMatch(role)) {
      addRole(role);
    }
  }

  return { nodes, edges };
}
