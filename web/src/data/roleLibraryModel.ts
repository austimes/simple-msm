import type {
  BalanceType,
  EmissionsImportanceBand,
  MethodKind,
  PackageData,
  PhysicalEdge,
  PhysicalEdgeKind,
  PhysicalSystemNodeKind,
  ReportingAllocation,
  RepresentationKind,
  RoleMetric,
  RoleMetadata,
} from './types.ts';

export interface RoleLibraryMethod {
  roleId: string;
  representationId: string;
  methodId: string;
  methodKind: MethodKind;
  label: string;
  description: string;
  isResidual: boolean;
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
  directMethodKind: MethodKind | null;
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
  roleKind: RoleMetadata['role_kind'];
  balanceType: BalanceType;
  outputUnit: string;
  coverageObligation: RoleMetadata['coverage_obligation'];
  defaultRepresentationKind: RepresentationKind;
  representations: RoleLibraryRepresentation[];
  childRoleIds: string[];
  reportingAllocations: ReportingAllocation[];
  primaryPhysicalNodeId: string | null;
  emissionsImportanceBand: EmissionsImportanceBand;
  roleMetric: RoleMetric | null;
}

export interface RoleLibraryPhysicalNode {
  nodeId: string;
  label: string;
  description: string;
  parentNodeId: string | null;
  nodeKind: PhysicalSystemNodeKind;
  boundary: string;
  displayOrder: number;
  notes: string;
  childNodeIds: string[];
  roleIds: string[];
}

export type RoleLibraryGraphNodeKind = 'physical' | 'role' | 'representation' | 'method';

export interface RoleLibraryGraphNode {
  id: string;
  kind: RoleLibraryGraphNodeKind;
  roleId?: string;
  physicalNodeId?: string;
  representationId?: string;
  methodId?: string;
  label: string;
  meta: string;
  expanded: boolean;
  isDefault?: boolean;
  roleKind?: RoleMetadata['role_kind'];
  balanceType?: BalanceType;
  physicalNodeKind?: PhysicalSystemNodeKind;
  representationKind?: RepresentationKind;
  methodKind?: MethodKind;
  emissionsImportanceBand?: EmissionsImportanceBand;
  representationCount?: number;
  methodCount?: number;
  childNodeCount?: number;
  roleCount?: number;
}

export interface RoleLibraryGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  edgeKind?: PhysicalEdgeKind | 'physical_hierarchy' | 'role_membership' | 'representation' | 'method';
}

export interface RoleLibraryGraphData {
  nodes: RoleLibraryGraphNode[];
  edges: RoleLibraryGraphEdge[];
}

export interface RoleLibraryModel {
  physicalNodes: RoleLibraryPhysicalNode[];
  topLevelPhysicalNodes: RoleLibraryPhysicalNode[];
  physicalNodeById: Map<string, RoleLibraryPhysicalNode>;
  physicalEdges: PhysicalEdge[];
  roles: RoleLibraryRole[];
  topLevelRoles: RoleLibraryRole[];
  roleById: Map<string, RoleLibraryRole>;
  representationById: Map<string, RoleLibraryRepresentation>;
  methodById: Map<string, RoleLibraryMethod>;
}

export interface RoleLibraryGraphFilters {
  search?: string;
  roleKind?: string;
  balanceType?: string;
}

function compareLabels(left: { label: string; roleId?: string }, right: { label: string; roleId?: string }): number {
  return left.label.localeCompare(right.label) || (left.roleId ?? '').localeCompare(right.roleId ?? '');
}

function roleNodeId(roleId: string): string {
  return `role:${roleId}`;
}

function physicalNodeId(nodeId: string): string {
  return `physical:${nodeId}`;
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
    role.roleKind,
    role.balanceType,
    ...role.representations.flatMap((representation) => [
      representation.representationId,
      representation.label,
      representation.description,
      representation.representationKind,
      ...representation.methods.flatMap((method) => [
        method.methodId,
        method.label,
        method.description,
        method.methodKind,
      ]),
    ]),
  ].join(' ').toLowerCase();

  return haystack.includes(search.toLowerCase());
}

function matchesPhysicalNodeSearch(node: RoleLibraryPhysicalNode, search: string): boolean {
  if (!search) {
    return true;
  }

  const haystack = [
    node.nodeId,
    node.label,
    node.description,
    node.nodeKind,
    node.boundary,
    node.notes,
  ].join(' ').toLowerCase();

  return haystack.includes(search.toLowerCase());
}

export function buildRoleLibraryModel(pkg: Pick<
  PackageData,
  | 'roleMetadata'
  | 'roleMetrics'
  | 'physicalSystemNodes'
  | 'roleMemberships'
  | 'physicalEdges'
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

  const methodsByRepresentationId = new Map<string, RoleLibraryMethod[]>();
  const methodById = new Map<string, RoleLibraryMethod>();
  for (const method of pkg.methods) {
    const row = {
      roleId: method.role_id,
      representationId: method.representation_id,
      methodId: method.method_id,
      methodKind: method.method_kind,
      label: method.method_label,
      description: method.method_description,
      isResidual: method.is_residual,
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
      directMethodKind: representation.direct_method_kind,
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
  const primaryPhysicalNodeByRoleId = new Map(
    pkg.roleMemberships
      .filter((membership) => membership.is_primary)
      .map((membership) => [membership.role_id, membership.node_id]),
  );
  const roleIdsByPhysicalNodeId = pkg.roleMemberships.reduce<Map<string, string[]>>((result, membership) => {
    const roleIds = result.get(membership.node_id) ?? [];
    roleIds.push(membership.role_id);
    result.set(membership.node_id, roleIds);
    return result;
  }, new Map<string, string[]>());
  for (const roleIds of roleIdsByPhysicalNodeId.values()) {
    roleIds.sort((left, right) => left.localeCompare(right));
  }
  const childNodeIdsByParentNodeId = pkg.physicalSystemNodes.reduce<Map<string, string[]>>((result, node) => {
    if (!node.parent_node_id) {
      return result;
    }
    const childIds = result.get(node.parent_node_id) ?? [];
    childIds.push(node.node_id);
    result.set(node.parent_node_id, childIds);
    return result;
  }, new Map<string, string[]>());
  const physicalSourceNodeById = new Map(pkg.physicalSystemNodes.map((node) => [node.node_id, node]));
  for (const [parentNodeId, childIds] of childNodeIdsByParentNodeId) {
    childIds.sort((left, right) => {
      const leftNode = physicalSourceNodeById.get(left);
      const rightNode = physicalSourceNodeById.get(right);
      return (leftNode?.display_order ?? 0) - (rightNode?.display_order ?? 0)
        || left.localeCompare(right);
    });
    childNodeIdsByParentNodeId.set(parentNodeId, childIds);
  }

  const roles = pkg.roleMetadata.map((role) => ({
    roleId: role.role_id,
    label: role.role_label,
    description: role.description,
    topologyAreaId: role.topology_area_id,
    topologyAreaLabel: role.topology_area_label,
    parentRoleId: role.parent_role_id,
    roleKind: role.role_kind,
    balanceType: role.balance_type,
    outputUnit: role.output_unit,
    coverageObligation: role.coverage_obligation,
    defaultRepresentationKind: role.default_representation_kind,
    representations: representationsByRoleId.get(role.role_id) ?? [],
    childRoleIds: childRoleIdsByRoleId.get(role.role_id) ?? [],
    reportingAllocations: reportingAllocationsByRoleId.get(role.role_id) ?? [],
    primaryPhysicalNodeId: primaryPhysicalNodeByRoleId.get(role.role_id) ?? null,
    emissionsImportanceBand: roleMetricByRoleId.get(role.role_id)?.emissions_importance_band ?? 'unknown',
    roleMetric: roleMetricByRoleId.get(role.role_id) ?? null,
  })).sort(compareLabels);
  const roleById = new Map(roles.map((role) => [role.roleId, role]));
  const topLevelRoles = roles
    .filter((role) => role.coverageObligation !== 'required_decomposition_child')
    .sort(compareLabels);
  const physicalNodes = pkg.physicalSystemNodes.map((node) => ({
    nodeId: node.node_id,
    label: node.node_label,
    description: node.description,
    parentNodeId: node.parent_node_id,
    nodeKind: node.node_kind,
    boundary: node.boundary,
    displayOrder: node.display_order,
    notes: node.notes,
    childNodeIds: childNodeIdsByParentNodeId.get(node.node_id) ?? [],
    roleIds: roleIdsByPhysicalNodeId.get(node.node_id) ?? [],
  })).sort((left, right) =>
    left.displayOrder - right.displayOrder
    || left.label.localeCompare(right.label)
    || left.nodeId.localeCompare(right.nodeId),
  );
  const physicalNodeById = new Map(physicalNodes.map((node) => [node.nodeId, node]));
  const rootNode = physicalNodes.find((node) => node.nodeKind === 'root');
  const topLevelPhysicalNodes = physicalNodes
    .filter((node) => node.parentNodeId === rootNode?.nodeId)
    .sort((left, right) =>
      left.displayOrder - right.displayOrder
      || left.label.localeCompare(right.label)
      || left.nodeId.localeCompare(right.nodeId),
    );

  return {
    physicalNodes,
    topLevelPhysicalNodes,
    physicalNodeById,
    physicalEdges: pkg.physicalEdges,
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
      && (!filters.roleKind || role.roleKind === filters.roleKind)
      && (!filters.balanceType || role.balanceType === filters.balanceType),
    )
    .map((role) => role.roleId));

  function physicalSubtreeContainsMatch(node: RoleLibraryPhysicalNode): boolean {
    if (!search && !filters.roleKind && !filters.balanceType) {
      return true;
    }
    if (matchesPhysicalNodeSearch(node, search) && !filters.roleKind && !filters.balanceType) {
      return true;
    }
    if (node.roleIds.some((roleId) => matchingRoleIds.has(roleId))) {
      return true;
    }
    return node.childNodeIds.some((childNodeId) => {
      const childNode = model.physicalNodeById.get(childNodeId);
      return childNode ? physicalSubtreeContainsMatch(childNode) : false;
    });
  }

  function addVisibleEdge(edge: RoleLibraryGraphEdge): void {
    if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
      edges.push(edge);
    }
  }

  function addPhysicalNode(node: RoleLibraryPhysicalNode): void {
    const id = physicalNodeId(node.nodeId);
    const expanded = expandedNodeIds.has(id);
    nodes.push({
      id,
      kind: 'physical',
      physicalNodeId: node.nodeId,
      label: node.label,
      meta: node.nodeKind.replaceAll('_', ' '),
      expanded,
      physicalNodeKind: node.nodeKind,
      childNodeCount: node.childNodeIds.length,
      roleCount: node.roleIds.length,
    });
    visibleNodeIds.add(id);

    if (!expanded) {
      return;
    }

    for (const childNodeId of node.childNodeIds) {
      const childNode = model.physicalNodeById.get(childNodeId);
      if (!childNode || !physicalSubtreeContainsMatch(childNode)) {
        continue;
      }
      addPhysicalNode(childNode);
      edges.push({
        id: `${id}->${physicalNodeId(childNodeId)}`,
        source: id,
        target: physicalNodeId(childNodeId),
        edgeKind: 'physical_hierarchy',
      });
    }

    for (const roleId of node.roleIds) {
      const role = model.roleById.get(roleId);
      if (
        !role
        || role.coverageObligation === 'required_decomposition_child'
        || !matchingRoleIds.has(role.roleId)
      ) {
        continue;
      }
      addRole(role);
      edges.push({
        id: `${id}->${roleNodeId(role.roleId)}`,
        source: id,
        target: roleNodeId(role.roleId),
        label: 'role',
        edgeKind: 'role_membership',
      });
    }
  }

  function addRole(role: RoleLibraryRole): void {
    const id = roleNodeId(role.roleId);
    const expanded = expandedNodeIds.has(id);
    const methodCount = role.representations.reduce((sum, representation) => sum + representation.methods.length, 0);
    if (visibleNodeIds.has(id)) {
      return;
    }
    nodes.push({
      id,
      kind: 'role',
      roleId: role.roleId,
      label: role.label,
      meta: `${role.roleKind.replaceAll('_', ' ')} · ${role.balanceType.replaceAll('_', ' ')}`,
      expanded,
      roleKind: role.roleKind,
      balanceType: role.balanceType,
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
          edgeKind: 'role_membership',
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
        meta: method.methodKind,
        expanded: false,
        methodKind: method.methodKind,
      });
      edges.push({
        id: `${id}->${methodId}`,
        source: id,
        target: methodId,
        edgeKind: 'method',
      });
    }
  }

  for (const physicalNode of model.topLevelPhysicalNodes) {
    if (physicalSubtreeContainsMatch(physicalNode)) {
      addPhysicalNode(physicalNode);
    }
  }

  for (const physicalEdge of model.physicalEdges) {
    addVisibleEdge({
      id: `physical-edge:${physicalEdge.edge_id}`,
      source: physicalNodeId(physicalEdge.from_node_id),
      target: physicalNodeId(physicalEdge.to_node_id),
      label: physicalEdge.flow_label,
      edgeKind: physicalEdge.edge_kind,
    });
  }

  return { nodes, edges };
}
