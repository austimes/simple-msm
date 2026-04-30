import type {
  RoleAreaNavigationEntry,
  RoleMethodNavigationEntry,
  RoleNodeNavigationEntry,
} from '../../data/configurationWorkspaceModel.ts';
import type { OutputEfficiencyControlNode } from '../../data/efficiencyControlModel.ts';
import { resolveActiveRoleStructure } from '../../data/roleTopologyResolver.ts';
import {
  buildResidualOverlayCatalog,
  SYSTEM_STRUCTURE_GROUPS,
  type ResidualOverlayCatalogEntry,
} from '../../data/systemStructureModel.ts';
import type {
  ConfigurationDocument,
  ConfigurationResidualOverlayControl,
  Method,
  MethodKind,
  RepresentationKind,
  ResidualOverlayRow,
  RoleDecompositionEdge,
  RoleKind,
  RoleMetadata,
  RoleRepresentation,
} from '../../data/types.ts';
import type { DerivedOutputRunStatus } from '../../solver/solveScope.ts';
import {
  getRightSidebarStatusPresentation,
  type RightSidebarBadge,
  type RightSidebarStatusPresentation,
} from './rightSidebarStatus.ts';

export interface RightSidebarCatalogEntry extends RoleAreaNavigationEntry {
  label?: string;
  residualOverlayIds?: string[];
  systemGroupId?: string;
}

export interface RightSidebarRepresentationOption {
  representationId: string;
  representationKind: RepresentationKind;
  label: string;
  description: string;
  directMethodKind: MethodKind | null;
  methodIds: string[];
  childRoleIds: string[];
  isSelected: boolean;
}

export interface RightSidebarRoleNode extends RoleNodeNavigationEntry {
  roleId: string;
  roleLabel: string;
  roleKind: RoleKind;
  parentRoleId: string | null;
  representationOptions: RightSidebarRepresentationOption[];
  selectedRepresentationId: string | null;
  selectedRepresentationKind: RepresentationKind | null;
  selectedRepresentationLabel: string | null;
  selectedRepresentationDescription: string | null;
  activeChildRoleIds: string[];
  childRoles: RightSidebarRoleNode[];
  isDecompositionChild: boolean;
  status: DerivedOutputRunStatus | undefined;
  presentation: RightSidebarStatusPresentation;
  badges: RightSidebarBadge[];
  activeMethodIds: string[];
  allDisabled: boolean;
  pathwaysInactive: boolean;
  outOfScope: boolean;
  canCollapse: boolean;
  isCollapsed: boolean;
  efficiencyControls?: OutputEfficiencyControlNode;
}

export interface RightSidebarResidualNode extends ResidualOverlayCatalogEntry {
  included: boolean;
  proxyOutputLabels: string[];
}

export interface RightSidebarResidualGroupNode {
  groupId: string;
  label: string;
  residuals: RightSidebarResidualNode[];
  includedCount: number;
  totalCount: number;
  allIncluded: boolean;
  allExcluded: boolean;
}

export interface RightSidebarAreaNode extends RoleAreaNavigationEntry {
  label?: string;
  residualOverlayIds?: string[];
  systemGroupId?: string;
  subsectors: RightSidebarRoleNode[];
  residualGroup?: RightSidebarResidualGroupNode;
  isExcluded: boolean;
  isCollapsed: boolean;
}

export interface RightSidebarRoleContext {
  roleMetadata: RoleMetadata[];
  representations: RoleRepresentation[];
  roleDecompositionEdges: RoleDecompositionEdge[];
  methods: Method[];
  currentConfiguration: Pick<ConfigurationDocument, 'representation_by_role'>;
}

interface DerivedRolePresentationContext {
  roleById: Map<string, RoleMetadata>;
  representationsByRole: Map<string, RoleRepresentation[]>;
  representationById: Map<string, RoleRepresentation>;
  methodIdsByRepresentation: Map<string, string[]>;
  childRoleIdsByRepresentation: Map<string, string[]>;
  activeRoleIds: Set<string>;
  activeRepresentationByRole: Record<string, string>;
  activeChildRoleIdsByRole: Map<string, string[]>;
}

export function buildSystemStructureCatalog(
  catalog: RoleAreaNavigationEntry[],
  residualOverlays2025: ResidualOverlayRow[] = [],
): RightSidebarCatalogEntry[] {
  const subsectorsByOutput = new Map<string, RoleNodeNavigationEntry>();
  for (const sectorEntry of catalog) {
    for (const subsector of sectorEntry.subsectors) {
      subsectorsByOutput.set(subsector.outputId, subsector);
    }
  }

  const residualIds = new Set(residualOverlays2025.map((row) => row.overlay_id));
  const consumedOutputIds = new Set<string>();
  const systemCatalog: RightSidebarCatalogEntry[] = [];

  for (const group of SYSTEM_STRUCTURE_GROUPS) {
    const subsectors = group.outputIds
      .map((outputId) => {
        const subsector = subsectorsByOutput.get(outputId);
        if (subsector) {
          consumedOutputIds.add(outputId);
        }
        return subsector ?? null;
      })
      .filter((subsector): subsector is RoleNodeNavigationEntry => subsector != null);
    const availableResidualIds = group.residualOverlayIds.filter((overlayId) => residualIds.has(overlayId));

    if (subsectors.length === 0 && availableResidualIds.length === 0) {
      continue;
    }

    systemCatalog.push({
      sector: group.id,
      systemGroupId: group.id,
      label: group.label,
      residualOverlayIds: availableResidualIds,
      subsectors,
    });
  }

  for (const sectorEntry of catalog) {
    const ungroupedSubsectors = sectorEntry.subsectors.filter(
      (subsector) => !consumedOutputIds.has(subsector.outputId),
    );

    if (ungroupedSubsectors.length === 0) {
      continue;
    }

    systemCatalog.push({
      ...sectorEntry,
      subsectors: ungroupedSubsectors,
    });
  }

  return systemCatalog;
}

function groupRepresentationsByRole(representations: RoleRepresentation[]): Map<string, RoleRepresentation[]> {
  return representations.reduce<Map<string, RoleRepresentation[]>>((result, representation) => {
    const rows = result.get(representation.role_id) ?? [];
    rows.push(representation);
    result.set(representation.role_id, rows);
    return result;
  }, new Map());
}

function selectFallbackRepresentation(
  role: RoleMetadata,
  representationsByRole: Map<string, RoleRepresentation[]>,
  representationById: Map<string, RoleRepresentation>,
  selectedRepresentations: Record<string, string> | undefined,
): RoleRepresentation | null {
  const selectedRepresentationId = selectedRepresentations?.[role.role_id];
  const selected = selectedRepresentationId ? representationById.get(selectedRepresentationId) : null;
  if (selected?.role_id === role.role_id) {
    return selected;
  }

  const roleRepresentations = representationsByRole.get(role.role_id) ?? [];
  return (
    roleRepresentations.find(
      (representation) =>
        representation.is_default
        && representation.representation_kind === role.default_representation_kind,
    )
    ?? roleRepresentations.find((representation) => representation.is_default)
    ?? roleRepresentations[0]
    ?? null
  );
}

function buildRolePresentationContext(
  roleContext: RightSidebarRoleContext | undefined,
): DerivedRolePresentationContext | null {
  if (!roleContext) {
    return null;
  }

  const roleById = new Map(roleContext.roleMetadata.map((role) => [role.role_id, role]));
  const representationsByRole = groupRepresentationsByRole(roleContext.representations);
  const representationById = new Map(
    roleContext.representations.map((representation) => [representation.representation_id, representation]),
  );
  const methodIdsByRepresentation = roleContext.methods.reduce<Map<string, string[]>>((result, method) => {
    const rows = result.get(method.representation_id) ?? [];
    rows.push(method.method_id);
    result.set(method.representation_id, rows);
    return result;
  }, new Map());
  const childRoleIdsByRepresentation = roleContext.roleDecompositionEdges
    .filter((edge) => edge.is_required)
    .sort((left, right) => left.display_order - right.display_order || left.child_role_id.localeCompare(right.child_role_id))
    .reduce<Map<string, string[]>>((result, edge) => {
      const rows = result.get(edge.parent_representation_id) ?? [];
      rows.push(edge.child_role_id);
      result.set(edge.parent_representation_id, rows);
      return result;
    }, new Map());

  let activeRoleIds = new Set<string>();
  let activeRepresentationByRole: Record<string, string> = {};
  let activeChildRoleIdsByRole = new Map<string, string[]>();

  try {
    const activeStructure = resolveActiveRoleStructure(roleContext, roleContext.currentConfiguration);
    activeRoleIds = new Set(activeStructure.activeRoleIds);
    activeRepresentationByRole = activeStructure.activeRepresentationByRole;
    activeChildRoleIdsByRole = new Map(
      activeStructure.roles.map((role) => [role.roleId, role.activeChildRoleIds]),
    );
  } catch {
    for (const role of roleContext.roleMetadata) {
      if (role.coverage_obligation === 'required_decomposition_child') {
        continue;
      }
      activeRoleIds.add(role.role_id);
      const representation = selectFallbackRepresentation(
        role,
        representationsByRole,
        representationById,
        roleContext.currentConfiguration.representation_by_role,
      );
      if (representation) {
        activeRepresentationByRole[role.role_id] = representation.representation_id;
        activeChildRoleIdsByRole.set(
          role.role_id,
          representation.representation_kind === 'role_decomposition'
            ? childRoleIdsByRepresentation.get(representation.representation_id) ?? []
            : [],
        );
      }
    }
  }

  return {
    roleById,
    representationsByRole,
    representationById,
    methodIdsByRepresentation,
    childRoleIdsByRepresentation,
    activeRoleIds,
    activeRepresentationByRole,
    activeChildRoleIdsByRole,
  };
}

function buildResidualGroupNode(
  sectorEntry: RightSidebarCatalogEntry,
  residualCatalogById: Map<string, ResidualOverlayCatalogEntry>,
  residualControls: Record<string, ConfigurationResidualOverlayControl>,
  outputLabelsById: Map<string, string>,
): RightSidebarResidualGroupNode | undefined {
  const residualOverlayIds = sectorEntry.residualOverlayIds ?? [];
  const residuals = residualOverlayIds
    .map((overlayId) => {
      const residual = residualCatalogById.get(overlayId);
      if (!residual) {
        return null;
      }

      return {
        ...residual,
        included: residualControls[overlayId]?.included ?? residual.defaultInclude,
        proxyOutputLabels: residual.proxyOutputIds.map((outputId) =>
          outputLabelsById.get(outputId) ?? outputId,
        ),
      };
    })
    .filter((residual): residual is RightSidebarResidualNode => residual != null);

  if (residuals.length === 0) {
    return undefined;
  }

  const includedCount = residuals.filter((residual) => residual.included).length;

  return {
    groupId: sectorEntry.systemGroupId ?? sectorEntry.sector,
    label: 'Residuals',
    residuals,
    includedCount,
    totalCount: residuals.length,
    allIncluded: includedCount === residuals.length,
    allExcluded: includedCount === 0,
  };
}

export function deriveRightSidebarTree(
  catalog: RightSidebarCatalogEntry[],
  outputStatuses: Record<string, DerivedOutputRunStatus>,
  expandedSubsectors: ReadonlySet<string>,
  expandedSectors: ReadonlySet<string>,
  efficiencyControls: OutputEfficiencyControlNode[] = [],
  residualOverlays2025: ResidualOverlayRow[] = [],
  residualControls: Record<string, ConfigurationResidualOverlayControl> = {},
  roleContext?: RightSidebarRoleContext,
): RightSidebarAreaNode[] {
  const rolePresentationContext = buildRolePresentationContext(roleContext);
  const efficiencyControlsByOutput = new Map(
    efficiencyControls.map((node) => [node.outputId, node]),
  );
  const residualCatalogById = new Map(
    buildResidualOverlayCatalog(residualOverlays2025).map((entry) => [entry.overlayId, entry]),
  );
  const outputLabelsById = new Map<string, string>();
  for (const sectorEntry of catalog) {
    for (const subsector of sectorEntry.subsectors) {
      outputLabelsById.set(subsector.outputId, subsector.outputLabel);
    }
  }

  return catalog.map((sectorEntry) => {
    const visibleNodes = sectorEntry.subsectors.map((subsectorEntry): RightSidebarRoleNode | null => {
      const role = rolePresentationContext?.roleById.get(subsectorEntry.roleId);
      const roleId = role?.role_id ?? subsectorEntry.roleId;
      const parentRoleId = role?.parent_role_id ?? subsectorEntry.parentRoleId ?? null;
      const isDecompositionChild = role?.coverage_obligation === 'required_decomposition_child';
      if (isDecompositionChild && !rolePresentationContext?.activeRoleIds.has(roleId)) {
        return null;
      }

      const selectedRepresentationId = rolePresentationContext?.activeRepresentationByRole[roleId] ?? null;
      const selectedRepresentation = selectedRepresentationId
        ? rolePresentationContext?.representationById.get(selectedRepresentationId) ?? null
        : null;
      const representationOptions: RightSidebarRepresentationOption[] = (
        rolePresentationContext?.representationsByRole.get(roleId) ?? []
      ).map((representation) => ({
        representationId: representation.representation_id,
        representationKind: representation.representation_kind,
        label: representation.representation_label,
        description: representation.description,
        directMethodKind: representation.direct_method_kind,
        methodIds: rolePresentationContext?.methodIdsByRepresentation.get(representation.representation_id) ?? [],
        childRoleIds: rolePresentationContext?.childRoleIdsByRepresentation.get(representation.representation_id) ?? [],
        isSelected: representation.representation_id === selectedRepresentationId,
      }));
      const directMethodIds = new Set(
        selectedRepresentation?.representation_kind === 'role_decomposition'
          ? []
          : rolePresentationContext?.methodIdsByRepresentation.get(selectedRepresentationId ?? '') ?? [],
      );
      const states: RoleMethodNavigationEntry[] = selectedRepresentationId
        ? subsectorEntry.states.filter((state) =>
            state.representationId === selectedRepresentationId
            && (directMethodIds.size === 0 || directMethodIds.has(state.methodId)),
          )
        : subsectorEntry.states;
      const status = outputStatuses[subsectorEntry.outputId];
      const presentation = getRightSidebarStatusPresentation(status);
      const allDisabled = status?.isDisabled ?? false;
      const outOfScope = presentation.isDimmed;
      const canCollapse = allDisabled || outOfScope;

      return {
        ...subsectorEntry,
        states,
        roleId,
        roleLabel: role?.role_label ?? subsectorEntry.roleLabel,
        roleKind: role?.role_kind ?? 'modeled',
        parentRoleId,
        defaultRepresentationKind: role?.default_representation_kind ?? subsectorEntry.defaultRepresentationKind,
        representationOptions,
        selectedRepresentationId,
        selectedRepresentationKind: selectedRepresentation?.representation_kind ?? null,
        selectedRepresentationLabel: selectedRepresentation?.representation_label ?? null,
        selectedRepresentationDescription: selectedRepresentation?.description ?? null,
        activeChildRoleIds: rolePresentationContext?.activeChildRoleIdsByRole.get(roleId) ?? [],
        childRoles: [],
        isDecompositionChild,
        status,
        presentation,
        badges: presentation.badges,
        activeMethodIds: status?.activeMethodIds ?? [],
        allDisabled,
        pathwaysInactive: presentation.arePathwaysInactive,
        outOfScope,
        canCollapse,
        isCollapsed: canCollapse && !expandedSubsectors.has(subsectorEntry.outputId),
        efficiencyControls: efficiencyControlsByOutput.get(subsectorEntry.outputId),
      };
    }).filter((subsector): subsector is RightSidebarRoleNode => subsector != null);

    const childNodesByParentRoleId = visibleNodes.reduce<Map<string, RightSidebarRoleNode[]>>((result, node) => {
      if (!node.parentRoleId || !node.isDecompositionChild) {
        return result;
      }
      const rows = result.get(node.parentRoleId) ?? [];
      rows.push(node);
      result.set(node.parentRoleId, rows);
      return result;
    }, new Map());
    const subsectors = visibleNodes
      .filter((node) => !node.isDecompositionChild || !node.parentRoleId)
      .map((node) => ({
        ...node,
        childRoles: childNodesByParentRoleId.get(node.roleId) ?? [],
      }));

    const isExcluded = subsectors.length > 0 && subsectors.every((subsector) => subsector.outOfScope);

    return {
      ...sectorEntry,
      subsectors,
      residualGroup: buildResidualGroupNode(
        sectorEntry,
        residualCatalogById,
        residualControls,
        outputLabelsById,
      ),
      isExcluded,
      isCollapsed: isExcluded && !expandedSectors.has(sectorEntry.sector),
    };
  });
}
