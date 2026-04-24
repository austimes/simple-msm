import type {
  SectorCatalogEntry,
  SubsectorCatalogEntry,
} from '../../data/configurationWorkspaceModel.ts';
import type { OutputEfficiencyControlNode } from '../../data/efficiencyControlModel.ts';
import {
  buildResidualOverlayCatalog,
  SYSTEM_STRUCTURE_GROUPS,
  type ResidualOverlayCatalogEntry,
} from '../../data/systemStructureModel.ts';
import type { ConfigurationResidualOverlayControl, ResidualOverlayRow } from '../../data/types.ts';
import type { DerivedOutputRunStatus } from '../../solver/solveScope.ts';
import {
  getRightSidebarStatusPresentation,
  type RightSidebarBadge,
  type RightSidebarStatusPresentation,
} from './rightSidebarStatus.ts';

export interface RightSidebarCatalogEntry extends SectorCatalogEntry {
  label?: string;
  residualOverlayIds?: string[];
  systemGroupId?: string;
}

export interface RightSidebarSubsectorNode extends SubsectorCatalogEntry {
  status: DerivedOutputRunStatus | undefined;
  presentation: RightSidebarStatusPresentation;
  badges: RightSidebarBadge[];
  activeStateIds: string[];
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

export interface RightSidebarSectorNode extends SectorCatalogEntry {
  label?: string;
  residualOverlayIds?: string[];
  systemGroupId?: string;
  subsectors: RightSidebarSubsectorNode[];
  residualGroup?: RightSidebarResidualGroupNode;
  isExcluded: boolean;
  isCollapsed: boolean;
}

export function buildSystemStructureCatalog(
  catalog: SectorCatalogEntry[],
  residualOverlays2025: ResidualOverlayRow[] = [],
): RightSidebarCatalogEntry[] {
  const subsectorsByOutput = new Map<string, SubsectorCatalogEntry>();
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
      .filter((subsector): subsector is SubsectorCatalogEntry => subsector != null);
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
): RightSidebarSectorNode[] {
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
    const subsectors = sectorEntry.subsectors.map((subsectorEntry) => {
      const status = outputStatuses[subsectorEntry.outputId];
      const presentation = getRightSidebarStatusPresentation(status);
      const allDisabled = status?.isDisabled ?? false;
      const outOfScope = presentation.isDimmed;
      const canCollapse = allDisabled || outOfScope;

      return {
        ...subsectorEntry,
        status,
        presentation,
        badges: presentation.badges,
        activeStateIds: status?.activeStateIds ?? [],
        allDisabled,
        pathwaysInactive: presentation.arePathwaysInactive,
        outOfScope,
        canCollapse,
        isCollapsed: canCollapse && !expandedSubsectors.has(subsectorEntry.outputId),
        efficiencyControls: efficiencyControlsByOutput.get(subsectorEntry.outputId),
      };
    });

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
