import type {
  SectorCatalogEntry,
  SubsectorCatalogEntry,
} from '../../data/configurationWorkspaceModel.ts';
import type { OutputEfficiencyControlNode } from '../../data/efficiencyControlModel.ts';
import type { DerivedOutputRunStatus } from '../../solver/solveScope.ts';
import {
  getRightSidebarStatusPresentation,
  type RightSidebarBadge,
  type RightSidebarStatusPresentation,
} from './rightSidebarStatus.ts';

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

export interface RightSidebarSectorNode extends SectorCatalogEntry {
  subsectors: RightSidebarSubsectorNode[];
  isExcluded: boolean;
  isCollapsed: boolean;
}

export function deriveRightSidebarTree(
  catalog: SectorCatalogEntry[],
  outputStatuses: Record<string, DerivedOutputRunStatus>,
  expandedSubsectors: ReadonlySet<string>,
  expandedSectors: ReadonlySet<string>,
  efficiencyControls: OutputEfficiencyControlNode[] = [],
): RightSidebarSectorNode[] {
  const efficiencyControlsByOutput = new Map(
    efficiencyControls.map((node) => [node.outputId, node]),
  );

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
      isExcluded,
      isCollapsed: isExcluded && !expandedSectors.has(sectorEntry.sector),
    };
  });
}
