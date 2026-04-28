import type {
  ConfigurationDocument,
  Method,
  ResolvedActiveRole,
  ResolvedActiveRoleStructure,
  RoleDecompositionEdge,
  RoleMetadata,
  RoleRepresentation,
  SectorState,
} from './types.ts';

export interface RoleTopologyInputs {
  roleMetadata: RoleMetadata[];
  representations: RoleRepresentation[];
  roleDecompositionEdges: RoleDecompositionEdge[];
  methods: Method[];
}

export type RoleTopologyPackage = {
  sectorStates: SectorState[];
} & Partial<RoleTopologyInputs>;

export function hasRoleTopologyInputs(pkg: Partial<RoleTopologyInputs>): pkg is RoleTopologyInputs {
  return Array.isArray(pkg.roleMetadata)
    && Array.isArray(pkg.representations)
    && Array.isArray(pkg.roleDecompositionEdges)
    && Array.isArray(pkg.methods);
}

function methodKey(roleId: string, representationId: string, methodId: string): string {
  return `${roleId}::${representationId}::${methodId}`;
}

function buildRequiredTopLevelRoleIds(roles: RoleMetadata[]): string[] {
  return roles
    .filter((role) => role.coverage_obligation !== 'required_decomposition_child')
    .map((role) => role.role_id);
}

function selectRepresentationForRole(
  role: RoleMetadata,
  representationsByRole: Map<string, RoleRepresentation[]>,
  representationById: Map<string, RoleRepresentation>,
  selectedRepresentations: Record<string, string> | undefined,
): RoleRepresentation {
  const selectedRepresentationId = selectedRepresentations?.[role.role_id];
  if (selectedRepresentationId) {
    const selected = representationById.get(selectedRepresentationId);
    if (!selected) {
      throw new Error(
        `Unknown representation ${JSON.stringify(selectedRepresentationId)} selected for role ${JSON.stringify(role.role_id)}.`,
      );
    }
    if (selected.role_id !== role.role_id) {
      throw new Error(
        `Representation ${JSON.stringify(selectedRepresentationId)} belongs to role ${JSON.stringify(selected.role_id)}, not ${JSON.stringify(role.role_id)}.`,
      );
    }
    return selected;
  }

  const roleRepresentations = representationsByRole.get(role.role_id) ?? [];
  const defaultRepresentations = roleRepresentations.filter((representation) => representation.is_default);
  const matchingKindDefaults = defaultRepresentations.filter(
    (representation) => representation.representation_kind === role.default_representation_kind,
  );
  const candidates = matchingKindDefaults.length > 0 ? matchingKindDefaults : defaultRepresentations;

  if (candidates.length === 1) {
    return candidates[0];
  }

  if (candidates.length > 1) {
    throw new Error(
      `Role ${JSON.stringify(role.role_id)} has multiple default representations; select one in representation_by_role.`,
    );
  }

  throw new Error(
    `Missing representation selection for active role ${JSON.stringify(role.role_id)} and no default representation is authored.`,
  );
}

function validateConfiguredRepresentationSelections(
  rolesById: Map<string, RoleMetadata>,
  representationById: Map<string, RoleRepresentation>,
  selectedRepresentations: Record<string, string> | undefined,
): void {
  for (const [roleId, representationId] of Object.entries(selectedRepresentations ?? {})) {
    if (!rolesById.has(roleId)) {
      throw new Error(`Unknown role ${JSON.stringify(roleId)} in representation_by_role.`);
    }

    if (!representationId) {
      throw new Error(`Missing representation id for role ${JSON.stringify(roleId)} in representation_by_role.`);
    }

    const representation = representationById.get(representationId);
    if (!representation) {
      throw new Error(
        `Unknown representation ${JSON.stringify(representationId)} selected for role ${JSON.stringify(roleId)}.`,
      );
    }

    if (representation.role_id !== roleId) {
      throw new Error(
        `Representation ${JSON.stringify(representationId)} belongs to role ${JSON.stringify(representation.role_id)}, not ${JSON.stringify(roleId)}.`,
      );
    }
  }
}

function collectDirectMethods(
  role: RoleMetadata,
  representation: RoleRepresentation,
  methodsByRoleRepresentation: Map<string, Method[]>,
): string[] {
  const methods = methodsByRoleRepresentation.get(`${role.role_id}::${representation.representation_id}`) ?? [];
  if (methods.length === 0) {
    throw new Error(
      `Direct representation ${JSON.stringify(representation.representation_id)} for active role ${JSON.stringify(role.role_id)} has no methods.`,
    );
  }

  return methods
    .sort((left, right) => left.sort_order - right.sort_order || left.method_id.localeCompare(right.method_id))
    .map((method) => method.method_id);
}

function collectRequiredChildren(
  role: RoleMetadata,
  representation: RoleRepresentation,
  requiredChildrenByRepresentation: Map<string, RoleDecompositionEdge[]>,
): string[] {
  const children = requiredChildrenByRepresentation.get(representation.representation_id) ?? [];
  if (children.length === 0) {
    throw new Error(
      `Role decomposition ${JSON.stringify(representation.representation_id)} for active role ${JSON.stringify(role.role_id)} activates no required child roles.`,
    );
  }

  return children.map((edge) => edge.child_role_id);
}

function assertRequiredChildRolesAreActive(
  role: RoleMetadata,
  representation: RoleRepresentation,
  activeChildRoleIds: string[],
  requiredChildRoleIdsByParentRole: Map<string, string[]>,
): void {
  const activeChildRoleIdSet = new Set(activeChildRoleIds);
  for (const requiredChildRoleId of requiredChildRoleIdsByParentRole.get(role.role_id) ?? []) {
    if (!activeChildRoleIdSet.has(requiredChildRoleId)) {
      throw new Error(
        `Required child role ${JSON.stringify(requiredChildRoleId)} is inactive under decomposition ${JSON.stringify(representation.representation_id)}.`,
      );
    }
  }
}

export function resolveActiveRoleStructure(
  pkg: RoleTopologyInputs,
  configuration: Pick<ConfigurationDocument, 'representation_by_role'>,
): ResolvedActiveRoleStructure {
  const rolesById = new Map(pkg.roleMetadata.map((role) => [role.role_id, role]));
  const representationsByRole = pkg.representations.reduce<Map<string, RoleRepresentation[]>>((result, representation) => {
    const rows = result.get(representation.role_id) ?? [];
    rows.push(representation);
    result.set(representation.role_id, rows);
    return result;
  }, new Map());
  const representationById = new Map(pkg.representations.map((representation) => [
    representation.representation_id,
    representation,
  ]));
  validateConfiguredRepresentationSelections(
    rolesById,
    representationById,
    configuration.representation_by_role,
  );
  const methodsByRoleRepresentation = pkg.methods.reduce<Map<string, Method[]>>((result, method) => {
    const key = `${method.role_id}::${method.representation_id}`;
    const rows = result.get(key) ?? [];
    rows.push(method);
    result.set(key, rows);
    return result;
  }, new Map());
  const requiredChildrenByRepresentation = pkg.roleDecompositionEdges
    .filter((edge) => edge.is_required)
    .sort((left, right) => left.display_order - right.display_order || left.child_role_id.localeCompare(right.child_role_id))
    .reduce<Map<string, RoleDecompositionEdge[]>>((result, edge) => {
      const rows = result.get(edge.parent_representation_id) ?? [];
      rows.push(edge);
      result.set(edge.parent_representation_id, rows);
      return result;
    }, new Map());
  const requiredChildRoleIdsByParentRole = pkg.roleMetadata
    .reduce<Map<string, string[]>>((result, role) => {
      if (role.coverage_obligation !== 'required_decomposition_child' || !role.parent_role_id) {
        return result;
      }

      const rows = result.get(role.parent_role_id) ?? [];
      rows.push(role.role_id);
      result.set(role.parent_role_id, rows);
      return result;
    }, new Map());

  const activeRoleIds: string[] = [];
  const activeRoleSet = new Set<string>();
  const activationSourceByRoleId = new Map<string, string>();
  const activeRepresentationByRole: Record<string, string> = {};
  const activeMethodIdsByRole: Record<string, string[]> = {};
  const activeMethodKeys = new Set<string>();
  const resolvedRoles: ResolvedActiveRole[] = [];
  const resolvingRoleIds: string[] = [];

  function activateRole(roleId: string, source: string): void {
    const role = rolesById.get(roleId);
    if (!role) {
      throw new Error(`Unknown role ${JSON.stringify(roleId)} required by ${source}.`);
    }

    if (resolvingRoleIds.includes(roleId)) {
      throw new Error(
        `Role decomposition cycle detected while resolving ${[...resolvingRoleIds, roleId].join(' -> ')}.`,
      );
    }

    const existingSource = activationSourceByRoleId.get(roleId);
    if (existingSource) {
      throw new Error(
        `Role ${JSON.stringify(roleId)} is covered more than once: ${existingSource} and ${source}.`,
      );
    }

    activationSourceByRoleId.set(roleId, source);
    activeRoleSet.add(roleId);
    activeRoleIds.push(roleId);
    resolvingRoleIds.push(roleId);

    const representation = selectRepresentationForRole(
      role,
      representationsByRole,
      representationById,
      configuration.representation_by_role,
    );
    activeRepresentationByRole[roleId] = representation.representation_id;

    let activeMethodIds: string[] = [];
    let activeChildRoleIds: string[] = [];
    if (representation.representation_kind === 'role_decomposition') {
      const directMethods = methodsByRoleRepresentation.get(`${role.role_id}::${representation.representation_id}`) ?? [];
      if (directMethods.length > 0) {
        throw new Error(
          `Role decomposition ${JSON.stringify(representation.representation_id)} for ${JSON.stringify(role.role_id)} also exposes direct methods.`,
        );
      }

      activeChildRoleIds = collectRequiredChildren(role, representation, requiredChildrenByRepresentation);
      assertRequiredChildRolesAreActive(
        role,
        representation,
        activeChildRoleIds,
        requiredChildRoleIdsByParentRole,
      );
    } else {
      activeMethodIds = collectDirectMethods(role, representation, methodsByRoleRepresentation);
      for (const methodId of activeMethodIds) {
        activeMethodKeys.add(methodKey(roleId, representation.representation_id, methodId));
      }
    }

    activeMethodIdsByRole[roleId] = activeMethodIds;
    resolvedRoles.push({
      roleId,
      representationId: representation.representation_id,
      representationKind: representation.representation_kind,
      activeMethodIds,
      activeChildRoleIds,
    });

    for (const childRoleId of activeChildRoleIds) {
      activateRole(childRoleId, `decomposition ${representation.representation_id}`);
    }

    resolvingRoleIds.pop();
  }

  for (const roleId of buildRequiredTopLevelRoleIds(pkg.roleMetadata)) {
    activateRole(roleId, 'top-level coverage obligation');
  }

  for (const role of pkg.roleMetadata) {
    if (
      role.coverage_obligation !== 'required_decomposition_child'
      && !activeRoleSet.has(role.role_id)
    ) {
      throw new Error(`Required role ${JSON.stringify(role.role_id)} is inactive.`);
    }
  }

  return {
    activeRoleIds,
    inactiveRoleIds: pkg.roleMetadata
      .filter((role) => !activeRoleSet.has(role.role_id))
      .map((role) => role.role_id),
    activeRepresentationByRole,
    activeMethodIdsByRole,
    activeMethodKeys,
    roles: resolvedRoles,
  };
}

export function filterSectorStatesByActiveRoleStructure(
  rows: SectorState[],
  activeStructure: Pick<ResolvedActiveRoleStructure, 'activeMethodKeys'>,
): SectorState[] {
  return rows.filter((row) =>
    activeStructure.activeMethodKeys.has(methodKey(row.role_id, row.representation_id, row.method_id)),
  );
}

export function resolveActiveSectorStatesForConfiguration(
  pkg: RoleTopologyPackage,
  configuration: Pick<ConfigurationDocument, 'representation_by_role'>,
): SectorState[] {
  if (!hasRoleTopologyInputs(pkg)) {
    if (configuration.representation_by_role && Object.keys(configuration.representation_by_role).length > 0) {
      throw new Error('Cannot resolve representation_by_role without role topology package data.');
    }
    return pkg.sectorStates;
  }

  return filterSectorStatesByActiveRoleStructure(
    pkg.sectorStates,
    resolveActiveRoleStructure(pkg, configuration),
  );
}
